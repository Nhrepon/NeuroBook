import { describe, expect, it } from "vitest";
import { applyRate, roundMilliToMinor, sumMinor } from "@neurobook/shared";

describe("money (§15.1 R7)", () => {
  it("never produces float accumulation error", () => {
    // 30% of 10 taka = 3 taka exactly. In floats, 0.3 × 10 drifts.
    expect(applyRate(1000n, 3000)).toBe(300n);
  });

  it("handles the 7.5% reduced band without truncation", () => {
    // 7.5% of 2.50 taka = 0.1875, which rounds half-up to 19 minor.
    expect(applyRate(250n, 750)).toBe(19n);
  });

  it("rounds half-up at the millitaka boundary", () => {
    expect(roundMilliToMinor(1850n)).toBe(2n); // 1.850 -> 2
    expect(roundMilliToMinor(1849n)).toBe(2n); // 1.849 -> 2 (half rounds up)
    expect(roundMilliToMinor(1400n)).toBe(1n);
    expect(roundMilliToMinor(1499n)).toBe(1n);
  });

  it("sums integers exactly, regardless of count", () => {
    const many = Array.from({ length: 100_000 }, () => 3n);
    expect(sumMinor(many)).toBe(300_000n);
  });

  it("rejects negative rates", () => {
    expect(() => applyRate(100n, -50)).toThrow(TypeError);
  });
});
