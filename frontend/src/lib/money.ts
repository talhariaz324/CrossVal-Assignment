/**
 * The API speaks integer cents; the UI only ever converts to/from a display
 * dollar string at the render/input boundary — never does math on formatted
 * strings, and never sends floats for money to the API.
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** Parses a user-entered dollar string into a plain number of dollars
 * (e.g. "19.99" -> 19.99) for the request body; the backend is the one
 * source of truth that converts to integer cents. Rejects more than 2
 * decimal places so the round-trip through the backend's Math.round never
 * silently changes the entered value. */
export function parseDollarsInput(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Enter a valid amount with up to 2 decimal places");
  }
  return Number(trimmed);
}
