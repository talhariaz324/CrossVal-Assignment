import { describe, expect, it } from "vitest";
import { centsToDollarsString, dollarsToCents, formatCentsAsCurrency } from "../../src/domain/money.js";

describe("dollarsToCents", () => {
  it("converts whole dollars", () => {
    expect(dollarsToCents("500")).toBe(50000);
    expect(dollarsToCents(500)).toBe(50000);
  });

  it("converts dollars with cents", () => {
    expect(dollarsToCents("19.99")).toBe(1999);
  });

  it("rounds rather than truncates on float representation error (e.g. 0.1 + 0.2 style drift)", () => {
    // 19.999999999998 is the kind of value float math can produce for "20.00"
    expect(dollarsToCents(19.999999999998)).toBe(2000);
  });

  it("throws on non-numeric input", () => {
    expect(() => dollarsToCents("not-a-number")).toThrow(RangeError);
  });
});

describe("centsToDollarsString", () => {
  it("formats whole dollars with .00", () => {
    expect(centsToDollarsString(50000)).toBe("500.00");
  });

  it("pads single-digit cents", () => {
    expect(centsToDollarsString(50005)).toBe("500.05");
  });

  it("formats negative cents with a leading minus", () => {
    expect(centsToDollarsString(-500)).toBe("-5.00");
  });

  it("formats zero", () => {
    expect(centsToDollarsString(0)).toBe("0.00");
  });
});

describe("no float drift across repeated additions", () => {
  it("sums ten $0.01 payments to exactly 10 cents, not 9 or 11 due to float error", () => {
    const payments = Array.from({ length: 10 }, () => dollarsToCents("0.01"));
    const total = payments.reduce((sum, cents) => sum + cents, 0);
    expect(total).toBe(10);
  });
});

describe("formatCentsAsCurrency", () => {
  it("formats as USD currency string", () => {
    expect(formatCentsAsCurrency(100050)).toBe("$1,000.50");
  });
});
