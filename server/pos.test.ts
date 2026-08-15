import { describe, expect, it } from "vitest";
import { calculateCheckoutTotal } from "./pos";

describe("POS checkout totals", () => {
  it("calculates a multi-line checkout after a fixed discount", () => {
    expect(calculateCheckoutTotal([{ quantity: 1, unitPrice: 45 }, { quantity: 2, unitPrice: 8 }], 5)).toEqual({ subtotal: 61, total: 56 });
  });

  it("never produces a negative total when an excessive discount is entered", () => {
    expect(calculateCheckoutTotal([{ quantity: 1, unitPrice: 12 }], 99)).toEqual({ subtotal: 12, total: 0 });
  });

  it("applies line discounts before order-level and loyalty discounts", () => {
    expect(calculateCheckoutTotal([{ quantity: 2, unitPrice: 20, lineDiscount: 3 }], 2, 1.5)).toEqual({ subtotal: 40, total: 33.5 });
  });

  it("caps an excessive line discount at its line subtotal", () => {
    expect(calculateCheckoutTotal([{ quantity: 1, unitPrice: 8, lineDiscount: 20 }], 0)).toEqual({ subtotal: 8, total: 0 });
  });
});
