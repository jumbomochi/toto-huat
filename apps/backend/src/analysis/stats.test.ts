import { describe, it, expect } from "vitest";
import { chiSquaredStatistic, chiSquaredPValue, zScore } from "./stats.js";

describe("chiSquaredStatistic", () => {
  it("returns 0 for perfectly uniform distribution", () => {
    const observed = [10, 10, 10, 10];
    const expected = [10, 10, 10, 10];
    expect(chiSquaredStatistic(observed, expected)).toBeCloseTo(0);
  });

  it("computes correct statistic for skewed distribution", () => {
    // (15-10)^2/10 + (5-10)^2/10 + (12-10)^2/10 + (8-10)^2/10 = 2.5+2.5+0.4+0.4 = 5.8
    const observed = [15, 5, 12, 8];
    const expected = [10, 10, 10, 10];
    expect(chiSquaredStatistic(observed, expected)).toBeCloseTo(5.8);
  });
});

describe("chiSquaredPValue", () => {
  it("returns high p-value for low statistic with many df", () => {
    // chi2 = 30, df = 48 -> p-value should be > 0.95 (not significant)
    const p = chiSquaredPValue(30, 48);
    expect(p).toBeGreaterThan(0.9);
  });

  it("returns low p-value for high statistic", () => {
    // chi2 = 100, df = 48 -> p-value should be very small (significant)
    const p = chiSquaredPValue(100, 48);
    expect(p).toBeLessThan(0.01);
  });

  it("returns ~0.05 boundary correctly for df=48", () => {
    // Critical value at p=0.05 for df=48 is ~65.17
    const p = chiSquaredPValue(65.17, 48);
    expect(p).toBeCloseTo(0.05, 1);
  });
});

describe("zScore", () => {
  it("returns 0 when observed equals expected", () => {
    expect(zScore(10, 10, 2)).toBeCloseTo(0);
  });

  it("computes correct positive z-score", () => {
    expect(zScore(14, 10, 2)).toBeCloseTo(2.0);
  });

  it("computes correct negative z-score", () => {
    expect(zScore(6, 10, 2)).toBeCloseTo(-2.0);
  });
});
