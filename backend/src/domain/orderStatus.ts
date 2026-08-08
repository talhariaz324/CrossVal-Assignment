export type OrderStatus = "pending" | "partially_paid" | "paid" | "overdue";

export interface OrderStatusInput {
  orderTotalCents: number;
  amountPaidCents: number;
  /** ISO calendar date, e.g. "2026-08-15". Treated as a UTC calendar date
   * (no timezone-of-user handling) — documented assumption in README. */
  dueDate: string;
  /** Always injected by the caller, never read internally (e.g. no `new Date()`
   * inside this function) so status derivation is deterministic and testable. */
  now: Date;
}

/** Due date is inclusive: a payment made any time on the due date itself is
 * on-time. "Overdue" begins the instant after the due date's calendar day
 * ends in UTC. */
function isPastDueDate(dueDate: string, now: Date): boolean {
  const endOfDueDate = new Date(`${dueDate}T23:59:59.999Z`);
  return now.getTime() > endOfDueDate.getTime();
}

/**
 * Pure, side-effect-free. This is the single source of truth for order
 * status, used by every API response — never stored as an independent
 * column, always recomputed from the current totals/payments/due-date/now.
 *
 * Precedence matters: `paid` is checked before `overdue` so an order that
 * was overdue but has since been fully paid reads as `paid`, not stuck
 * `overdue` (the edge case the assignment brief calls out explicitly).
 * `overdue` is checked before `partially_paid` because "past due and not
 * fully paid" is the definition of overdue regardless of partial payment.
 */
export function deriveOrderStatus(input: OrderStatusInput): OrderStatus {
  const { orderTotalCents, amountPaidCents, dueDate, now } = input;

  if (amountPaidCents >= orderTotalCents) {
    return "paid";
  }
  if (isPastDueDate(dueDate, now)) {
    return "overdue";
  }
  if (amountPaidCents > 0) {
    return "partially_paid";
  }
  return "pending";
}
