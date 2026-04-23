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

function pickFieldRaw(
  row: Record<string, unknown>,
  field: keyof ParsedRow["raw"],
): unknown {
  const aliases = HEADER_ALIASES[field];
  for (const key of Object.keys(row)) {
    if (aliases.includes(normalizeKey(key))) {
      const v = row[key];
      if (v === undefined || v === null) return "";
      return v;
    }
  }
  return "";
}

function pickField(
  row: Record<string, unknown>,
  field: keyof ParsedRow["raw"],
): string {
  const v = pickFieldRaw(row, field);
  if (v === undefined || v === null) return "";
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "";
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v);
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

/** Mapa de nomes de meses (PT/EN, abreviados ou completos) → número. */
const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, janeiro: 1,
  feb: 2, february: 2, fev: 2, fevereiro: 2,
  mar: 3, march: 3, marco: 3, março: 3,
  apr: 4, april: 4, abr: 4, abril: 4,
  may: 5, mai: 5, maio: 5,
  jun: 6, june: 6, junho: 6,
  jul: 7, july: 7, julho: 7,
  aug: 8, august: 8, ago: 8, agosto: 8,
  sep: 9, sept: 9, september: 9, set: 9, setembro: 9,
  oct: 10, october: 10, out: 10, outubro: 10,
  nov: 11, november: 11, novembro: 11,
  dec: 12, december: 12, dez: 12, dezembro: 12,
};

function monthFromName(name: string): number | null {
  const key = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.$/, "");
  return MONTH_NAMES[key] ?? null;
}

/** Aceita Date (JS), número (serial Excel), e strings: dd/mm, dd/mm/aaaa, ISO, dd/mmm, dd/mmm/aaaa. */
export function parseDataNascimento(input: unknown): {
  ok: boolean;
  value: string;
  motivo?: string;
} {
  // 1) Date object vindo direto do XLSX (cellDates: true)
  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      return { ok: false, value: "", motivo: "Data inválida" };
    }
    const y = input.getUTCFullYear();
    const m = String(input.getUTCMonth() + 1).padStart(2, "0");
    const d = String(input.getUTCDate()).padStart(2, "0");
    return { ok: true, value: `${y}-${m}-${d}` };
  }

  // 2) Número (serial Excel) vindo direto
  if (typeof input === "number" && !isNaN(input)) {
    if (input > 1000 && input < 100000) {
      const date = new Date(Math.round((input - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, "0");
        const d = String(date.getUTCDate()).padStart(2, "0");
        return { ok: true, value: `${y}-${m}-${d}` };
      }
    }
    return { ok: false, value: String(input), motivo: "Número fora do intervalo de data" };
  }

  if (input === null || input === undefined || !String(input).trim()) {
    return { ok: false, value: "", motivo: "Data vazia" };
  }
  const raw = String(input).trim();

  // Caso seja Excel serial number (apenas se for puramente numérico)
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const num = Number(raw);
    if (!isNaN(num) && num > 1000 && num < 100000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, "0");
        const d = String(date.getUTCDate()).padStart(2, "0");
        return { ok: true, value: `${y}-${m}-${d}` };
      }
    }
  }

  // Textual com nome de mês: "22-Apr", "22-Apr-2020", "22 Abril", "22/abr/2020", "22 de abril de 2020"
  // dd <sep> <mes-nome> [<sep> aaaa]
  const textual = raw.match(
    /^(\d{1,2})[\s/\-.]+(?:de\s+)?([A-Za-zÀ-ÿ.]+)(?:[\s/\-.]+(?:de\s+)?(\d{2,4}))?$/,
  );
  if (textual) {
    const d = Number(textual[1]);
    const m = monthFromName(textual[2]);
    if (m !== null) {
      let y = textual[3] ? Number(textual[3]) : 2000;
      if (textual[3] && textual[3].length === 2) {
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
  }

  // <mes-nome> dd [, aaaa] — formato US "Apr 22" / "Apr 22, 2020"
  const textualUS = raw.match(
    /^([A-Za-zÀ-ÿ.]+)[\s/\-.]+(\d{1,2})(?:[\s,/\-.]+(\d{2,4}))?$/,
  );
  if (textualUS) {
    const m = monthFromName(textualUS[1]);
    const d = Number(textualUS[2]);
    if (m !== null) {
      let y = textualUS[3] ? Number(textualUS[3]) : 2000;
      if (textualUS[3] && textualUS[3].length === 2) {
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

  // dd/mm/aaaa (com fallback para m/d/y formato US, comum quando Excel
  // formata datas em locale en-US — ex: "4/23/00" significa 23/abr/2000).
  const full = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (full) {
    let d = Number(full[1]);
    let m = Number(full[2]);
    let y = Number(full[3]);
    if (full[3].length === 2) {
      // ex: 90 → 1990, 10 → 2010 (regra simples: <30 → 2000s, >=30 → 1900s)
      y = y < 30 ? 2000 + y : 1900 + y;
    }
    // Heurística: se dd>12 e mm<=12, é dd/mm (já correto).
    // Se primeiro<=12 e segundo>12, é formato US m/d/y → inverter.
    if (d <= 12 && m > 12) {
      const tmp = d;
      d = m;
      m = tmp;
    }
    if (!isValidDayMonth(d, m)) {
      return { ok: false, value: raw, motivo: "Dia/mês inválido" };
    }
    return {
      ok: true,
      value: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    };
  }

  // dd/mm (sem ano) → 2000 (com fallback m/d para formato US)
  const short = raw.match(/^(\d{1,2})[/\-.](\d{1,2})$/);
  if (short) {
    let d = Number(short[1]);
    let m = Number(short[2]);
    if (d <= 12 && m > 12) {
      const tmp = d;
      d = m;
      m = tmp;
    }
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

    // Telefone repetido NÃO é mais erro — duplicidade real só ocorre quando
    // nome + telefone + data_nascimento coincidem (validado contra o banco).
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
