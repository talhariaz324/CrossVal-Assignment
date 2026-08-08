import { describe, expect, it } from "vitest";
import { deriveOrderStatus } from "../../src/domain/orderStatus.js";

const NOW = new Date("2026-08-08T12:00:00.000Z");

describe("deriveOrderStatus", () => {
  it("returns 'paid' for a zero-total order with no payments (edge case, documented in README)", () => {
    expect(
      deriveOrderStatus({ orderTotalCents: 0, amountPaidCents: 0, dueDate: "2026-09-01", now: NOW }),
    ).toBe("paid");
  });

  it("returns 'pending' when due date is in the future and no payments recorded", () => {
    expect(
      deriveOrderStatus({ orderTotalCents: 100000, amountPaidCents: 0, dueDate: "2026-09-01", now: NOW }),
    ).toBe("pending");
  });

  it("returns 'overdue' when due date is in the past and no payments recorded", () => {
    expect(
      deriveOrderStatus({ orderTotalCents: 100000, amountPaidCents: 0, dueDate: "2026-01-01", now: NOW }),
    ).toBe("overdue");
  });

  it("returns 'partially_paid' for a partial payment before the due date", () => {
    expect(
      deriveOrderStatus({ orderTotalCents: 100000, amountPaidCents: 40000, dueDate: "2026-09-01", now: NOW }),
    ).toBe("partially_paid");
  });

  it("returns 'overdue' (not 'partially_paid') for a partial payment past the due date", () => {
    expect(
      deriveOrderStatus({ orderTotalCents: 100000, amountPaidCents: 40000, dueDate: "2026-01-01", now: NOW }),
    ).toBe("overdue");
  });

  it("returns 'paid' when fully paid before the due date", () => {
    expect(
      deriveOrderStatus({ orderTotalCents: 100000, amountPaidCents: 100000, dueDate: "2026-09-01", now: NOW }),
    ).toBe("paid");
  });

  it("returns 'paid' (not stuck 'overdue') when an order was overdue but is now fully paid — the named edge case from the brief", () => {
    expect(
      deriveOrderStatus({ orderTotalCents: 100000, amountPaidCents: 100000, dueDate: "2026-01-01", now: NOW }),
    ).toBe("paid");
  });

  it("treats the due date as inclusive: a payment made any time on the due date itself is on-time", () => {
    const dueDateNoon = new Date("2026-08-08T23:59:00.000Z");
    expect(
      deriveOrderStatus({ orderTotalCents: 100000, amountPaidCents: 40000, dueDate: "2026-08-08", now: dueDateNoon }),
    ).toBe("partially_paid");
  });

  it("becomes overdue the instant after the due date's calendar day ends (UTC)", () => {
    const oneMillisecondAfterDueDate = new Date("2026-08-09T00:00:00.001Z");
    expect(
      deriveOrderStatus({
        orderTotalCents: 100000,
        amountPaidCents: 40000,
        dueDate: "2026-08-08",
        now: oneMillisecondAfterDueDate,
      }),
    ).toBe("overdue");
  });

  it("never rounds up to 'paid' on an off-by-one-cent shortfall, even past the due date", () => {
    expect(
      deriveOrderStatus({ orderTotalCents: 100000, amountPaidCents: 99999, dueDate: "2026-01-01", now: NOW }),
    ).toBe("overdue");
  });

  it("degrades to 'paid' rather than throwing if amountPaidCents somehow exceeds orderTotalCents", () => {
    // Should never happen in practice (DB CHECK constraint + locked
    // transaction prevent it), but a pure function must not throw on
    // merely-unusual input.
    expect(
      deriveOrderStatus({ orderTotalCents: 100000, amountPaidCents: 100001, dueDate: "2026-09-01", now: NOW }),
    ).toBe("paid");
  });
});
