/**
 * All money in this system is represented as integer cents (never floats),
 * both in the database and across the API boundary. This module is the only
 * place dollar-string <-> cents conversion happens.
 */

export function dollarsToCents(input: string | number): number {
  const dollars = typeof input === "string" ? Number(input) : input;
  if (!Number.isFinite(dollars)) {
    throw new RangeError(`Invalid dollar amount: ${input}`);
  }
  // Round rather than truncate so e.g. 19.999999999998 (float repr of 20.00)
  // lands on the intended integer cent value.
  return Math.round(dollars * 100);
}

export function centsToDollarsString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function formatCentsAsCurrency(cents: number, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
