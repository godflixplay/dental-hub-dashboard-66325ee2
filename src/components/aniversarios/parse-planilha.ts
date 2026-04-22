// Parsing e validação padronizada de planilhas de contatos.
// Fluxo: leitura → limpeza → validação → resultado (válidos + inválidos com motivo).

import * as XLSX from "xlsx";

export interface ParsedRow {
  linha: number; // 1-indexada (linha real da planilha, considerando header)
  nome: string;
  telefone: string; // somente dígitos, 10 ou 11
  data_nascimento: string; // YYYY-MM-DD
  raw: {
    nome: string;
    telefone: string;
    data_nascimento: string;
  };
}

export interface InvalidRow {
  linha: number;
  motivo: string;
  raw: {
    nome: string;
    telefone: string;
    data_nascimento: string;
  };
}

export interface ParseResult {
  validos: ParsedRow[];
  invalidos: InvalidRow[];
  total: number;
}

const HEADER_ALIASES: Record<keyof ParsedRow["raw"], string[]> = {
  nome: ["nome", "name", "cliente", "contato"],
  telefone: ["telefone", "phone", "celular", "fone", "whatsapp", "numero"],
  data_nascimento: [
    "data_nascimento",
    "data nascimento",
    "datanascimento",
    "nascimento",
    "aniversario",
    "aniversário",
    "data",
    "dt_nascimento",
    "birthday",
  ],
};

function normalizeKey(k: string): string {
  return k
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pickField(
  row: Record<string, unknown>,
  field: keyof ParsedRow["raw"],
): string {
  const aliases = HEADER_ALIASES[field];
  for (const key of Object.keys(row)) {
    if (aliases.includes(normalizeKey(key))) {
      const v = row[key];
      if (v === undefined || v === null) return "";
      return String(v);
    }
  }
  return "";
}

/** Limpa telefone: remove tudo que não for dígito; remove DDI 55 se presente para checar 10/11. */
export function cleanTelefone(input: string): {
  ok: boolean;
  value: string;
  motivo?: string;
} {
  if (!input || !input.trim()) {
    return { ok: false, value: "", motivo: "Telefone vazio" };
  }
  let digits = String(input).replace(/\D/g, "");
  digits = digits.replace(/^0+/, "");
  // Se vier com DDI 55 (12 ou 13 dígitos), remove para validar 10/11
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) {
    return {
      ok: false,
      value: digits,
      motivo: `Telefone deve ter 10 ou 11 dígitos (recebido: ${digits.length})`,
    };
  }
  return { ok: true, value: digits };
}

/** Aceita dd/mm ou dd/mm/aaaa (separadores: / - .). Retorna YYYY-MM-DD. Sem ano → 2000. */
export function parseDataNascimento(input: string): {
  ok: boolean;
  value: string;
  motivo?: string;
} {
  if (!input || !String(input).trim()) {
    return { ok: false, value: "", motivo: "Data vazia" };
  }
  const raw = String(input).trim();

  // Caso seja Excel serial number
  const num = Number(raw);
  if (!isNaN(num) && raw !== "" && num > 1000 && num < 100000) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      return { ok: true, value: `${y}-${m}-${d}` };
    }
  }

  // ISO YYYY-MM-DD
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (isValidDayMonth(d, m)) {
      return {
        ok: true,
        value: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      };
    }
    return { ok: false, value: raw, motivo: "Dia/mês inválido" };
  }

  // dd/mm/aaaa
  const full = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (full) {
    const d = Number(full[1]);
    const m = Number(full[2]);
    let y = Number(full[3]);
    if (full[3].length === 2) {
      // ex: 90 → 1990, 10 → 2010 (regra simples: <30 → 2000s, >=30 → 1900s)
      y = y < 30 ? 2000 + y : 1900 + y;
    }
    if (!isValidDayMonth(d, m)) {
      return { ok: false, value: raw, motivo: "Dia/mês inválido" };
    }
    return {
      ok: true,
      value: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    };
  }

  // dd/mm (sem ano) → 2000
  const short = raw.match(/^(\d{1,2})[/\-.](\d{1,2})$/);
  if (short) {
    const d = Number(short[1]);
    const m = Number(short[2]);
    if (!isValidDayMonth(d, m)) {
      return { ok: false, value: raw, motivo: "Dia/mês inválido" };
    }
    return {
      ok: true,
      value: `2000-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    };
  }

  return {
    ok: false,
    value: raw,
    motivo: "Formato de data inválido (use dd/mm ou dd/mm/aaaa)",
  };
}

function isValidDayMonth(d: number, m: number): boolean {
  if (!Number.isInteger(d) || !Number.isInteger(m)) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const daysInMonth = new Date(2000, m, 0).getDate(); // 2000 é bissexto, cobre fev=29
  return d <= daysInMonth;
}

export async function parsePlanilhaFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    raw: false,
    defval: "",
  });

  const validos: ParsedRow[] = [];
  const invalidos: InvalidRow[] = [];
  // Dedup interno: telefone já visto na própria planilha
  const seen = new Set<string>();

  rows.forEach((row, idx) => {
    const linha = idx + 2; // +1 header, +1 base 1
    const rawNome = pickField(row, "nome");
    const rawTel = pickField(row, "telefone");
    const rawData = pickField(row, "data_nascimento");

    const raw = {
      nome: rawNome,
      telefone: rawTel,
      data_nascimento: rawData,
    };

    const nome = rawNome.trim();
    if (!nome) {
      invalidos.push({ linha, motivo: "Nome vazio", raw });
      return;
    }

    const tel = cleanTelefone(rawTel);
    if (!tel.ok) {
      invalidos.push({ linha, motivo: tel.motivo ?? "Telefone inválido", raw });
      return;
    }

    const data = parseDataNascimento(rawData);
    if (!data.ok) {
      invalidos.push({ linha, motivo: data.motivo ?? "Data inválida", raw });
      return;
    }

    if (seen.has(tel.value)) {
      invalidos.push({
        linha,
        motivo: "Telefone duplicado na planilha",
        raw,
      });
      return;
    }
    seen.add(tel.value);

    validos.push({
      linha,
      nome,
      telefone: tel.value,
      data_nascimento: data.value,
      raw,
    });
  });

  return { validos, invalidos, total: rows.length };
}
