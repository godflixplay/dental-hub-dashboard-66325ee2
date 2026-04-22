/**
 * Date formatting helpers locked to America/Sao_Paulo (UTC-3).
 *
 * The database (Supabase) stores timestamps in UTC. Conversion to the
 * Brazilian timezone happens ONLY at display time on the frontend.
 *
 * Example: stored "2026-04-22T18:30:00Z" -> displayed "22/04/2026 15:30".
 */

const TIME_ZONE = "America/Sao_Paulo";
const LOCALE = "pt-BR";

/** Returns "" for null/undefined/invalid inputs so the UI never shows "Invalid Date". */
function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date + time in São Paulo timezone, e.g. "22/04/2026 15:30". */
export function formatDateTimeBR(
  value: string | number | Date | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleString(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Date only in São Paulo timezone, e.g. "22/04/2026". */
export function formatDateBR(
  value: string | number | Date | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleDateString(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Time only in São Paulo timezone, e.g. "15:30". */
export function formatTimeBR(
  value: string | number | Date | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleTimeString(LOCALE, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}
