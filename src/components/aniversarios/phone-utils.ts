// Utilidades para normalizar telefones BR no formato esperado pela Evolution API: 55DDXXXXXXXXX (12 ou 13 dígitos)

const VALID_DDDS = new Set<string>([
  // SP
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  // RJ/ES
  "21", "22", "24", "27", "28",
  // MG
  "31", "32", "33", "34", "35", "37", "38",
  // PR/SC/RS
  "41", "42", "43", "44", "45", "46",
  "47", "48", "49",
  "51", "53", "54", "55",
  // Centro-Oeste / Norte
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  // Nordeste
  "71", "73", "74", "75", "77",
  "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  // Norte
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

export interface NormalizedPhone {
  phone: string;
  valid: boolean;
  reason?: string;
}

export function normalizePhoneBR(input: string | null | undefined): NormalizedPhone {
  if (!input) {
    return { phone: "", valid: false, reason: "Telefone vazio" };
  }

  let digits = String(input).replace(/\D/g, "");

  if (digits.length === 0) {
    return { phone: "", valid: false, reason: "Telefone vazio" };
  }

  // Remove zeros iniciais (ex.: 021... → 21...)
  digits = digits.replace(/^0+/, "");

  // Se já começa com 55 e tem 12 ou 13 dígitos, mantém. Caso contrário, prefixa.
  if (!(digits.startsWith("55") && (digits.length === 12 || digits.length === 13))) {
    // Se tem 10 ou 11 dígitos (DDD + número), adiciona DDI 55
    if (digits.length === 10 || digits.length === 11) {
      digits = "55" + digits;
    } else if (digits.startsWith("55") && digits.length > 13) {
      // número absurdamente longo
      return {
        phone: digits,
        valid: false,
        reason: "Número com muitos dígitos. Use formato 55DDXXXXXXXXX.",
      };
    }
  }

  if (digits.length !== 12 && digits.length !== 13) {
    return {
      phone: digits,
      valid: false,
      reason: "Número deve ter 12 ou 13 dígitos no formato 55DDXXXXXXXXX (ex: 5521981089100).",
    };
  }

  if (!digits.startsWith("55")) {
    return {
      phone: digits,
      valid: false,
      reason: "Apenas números brasileiros são aceitos (DDI 55).",
    };
  }

  const ddd = digits.slice(2, 4);
  if (!VALID_DDDS.has(ddd)) {
    return {
      phone: digits,
      valid: false,
      reason: `DDD ${ddd} inválido.`,
    };
  }

  return { phone: digits, valid: true };
}

export function formatPhoneDisplay(input: string | null | undefined): string {
  const { phone, valid } = normalizePhoneBR(input);
  if (!valid) return input ?? "";
  // 55 + DDD + número
  const ddd = phone.slice(2, 4);
  const rest = phone.slice(4);
  if (rest.length === 9) {
    return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}
