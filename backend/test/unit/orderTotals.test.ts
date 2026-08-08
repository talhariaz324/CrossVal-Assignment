import { describe, expect, it } from "vitest";
import { computeAmountDueCents, computeOrderTotals } from "../../src/domain/orderTotals.js";

describe("computeOrderTotals", () => {
  it("returns 0 for an order with no line items", () => {
    expect(computeOrderTotals([])).toEqual({ subtotalCents: 0, orderTotalCents: 0 });
  });

  it("sums a single line item (qty * unit price)", () => {
    expect(computeOrderTotals([{ quantity: 2, unitPriceCents: 50000 }])).toEqual({
      subtotalCents: 100000,
      orderTotalCents: 100000,
    });
  });

  it("matches the sample scenario from the brief: 2 x $500 = $1000", () => {
    const { orderTotalCents } = computeOrderTotals([{ quantity: 2, unitPriceCents: 50000 }]);
    expect(orderTotalCents).toBe(100000);
  });

  it("sums multiple line items", () => {
    expect(
      computeOrderTotals([
        { quantity: 2, unitPriceCents: 50000 },
        { quantity: 1, unitPriceCents: 25000 },
        { quantity: 3, unitPriceCents: 1000 },
      ]),
    ).toEqual({ subtotalCents: 128000, orderTotalCents: 128000 });
  });

  it("handles a zero-price line item", () => {
    expect(computeOrderTotals([{ quantity: 5, unitPriceCents: 0 }])).toEqual({
      subtotalCents: 0,
      orderTotalCents: 0,
    });
  });
});

describe("computeAmountDueCents", () => {
  it("returns the difference between total and paid", () => {
    expect(computeAmountDueCents(100000, 40000)).toBe(60000);
  });

  it("returns 0 when fully paid", () => {
    expect(computeAmountDueCents(100000, 100000)).toBe(0);
  });

  it("clamps at 0 rather than going negative if paid somehow exceeds total", () => {
    expect(computeAmountDueCents(100000, 150000)).toBe(0);
  });

  it("returns 0 for a zero-total order", () => {
    expect(computeAmountDueCents(0, 0)).toBe(0);
  });
});
