import { describe, expect, it } from "vitest";
import { addPence, equalPence, formatGBP, formatPounds, fromPounds, multiplyPence, pence, toPounds } from "../src/utils/money";

describe("money", () => {
  it("rejects fractional pence", () => {
    expect(() => pence(10.5)).toThrow(RangeError);
  });

  it("parses pounds without float drift", () => {
    expect(fromPounds(18.5)).toBe(1850);
    expect(fromPounds("£1,234.56")).toBe(123456);
    expect(fromPounds("0.1")).toBe(10);
  });

  it("adds without accumulating float error", () => {
    // 0.1 + 0.2 !== 0.3 in floats; in pence it is exact.
    expect(addPence(fromPounds(0.1), fromPounds(0.2))).toBe(fromPounds(0.3));
    expect(addPence(fromPounds(350), fromPounds(18), fromPounds(13), fromPounds(40))).toBe(42100);
  });

  it("always renders two decimal places", () => {
    expect(formatGBP(pence(42150))).toBe("£421.50");
    expect(formatGBP(pence(42100))).toBe("£421.00");
    // The visible bug: £421.5 on a driver's card.
    expect(formatPounds(421.5)).toBe("£421.50");
    expect(formatPounds(350)).toBe("£350.00");
  });

  it("groups thousands", () => {
    expect(formatGBP(pence(123456))).toBe("£1,234.56");
  });

  it("handles negatives", () => {
    expect(formatGBP(pence(-2550))).toBe("-£25.50");
  });

  it("compares exactly rather than by epsilon", () => {
    expect(equalPence(fromPounds(421.0), fromPounds(421))).toBe(true);
    expect(equalPence(fromPounds(421.0), fromPounds(421.01))).toBe(false);
  });

  it("round-trips", () => {
    expect(toPounds(fromPounds(99.99))).toBe(99.99);
  });

  it("multiplies for overtime blocks", () => {
    // 45 minutes -> 2 blocks at £55
    expect(multiplyPence(fromPounds(55), Math.ceil(45 / 30))).toBe(11000);
  });
});
