export interface LineItemInput {
  quantity: number;
  unitPriceCents: number;
}

/**
 * Pure. No tax/discount in this assignment, so orderTotalCents === subtotalCents
 * today — kept as two named fields (not collapsed into one) so that adding
 * order-level tax/discount later is a localized change to this one function,
 * not a refactor across every caller. This is the one deliberate seam left
 * for future business needs; nothing else is speculatively abstracted.
 */
export function computeOrderTotals(lineItems: LineItemInput[]): {
  subtotalCents: number;
  orderTotalCents: number;
} {
  const subtotalCents = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  return { subtotalCents, orderTotalCents: subtotalCents };
}

/** Clamped at 0 defensively — amountPaidCents should never exceed orderTotalCents
 * (enforced by the DB CHECK constraint and the payment service's locked
 * transaction), but this function does not trust that and never returns a
 * negative "amount due". */
export function computeAmountDueCents(orderTotalCents: number, amountPaidCents: number): number {
  return Math.max(0, orderTotalCents - amountPaidCents);
}
