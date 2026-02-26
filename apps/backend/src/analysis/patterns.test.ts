import { describe, it, expect } from "vitest";
import type { DrawRecord } from "../db/index.js";
import { consecutiveAnalysis, sumRangeAnalysis, pairFrequency } from "./patterns.js";

const draws: DrawRecord[] = [
  { drawNumber: 1, drawDate: "2026-01-01", numbers: [1, 2, 3, 20, 21, 40], additional: 7 },
  { drawNumber: 2, drawDate: "2026-01-04", numbers: [5, 10, 15, 20, 25, 30], additional: 1 },
  { drawNumber: 3, drawDate: "2026-01-08", numbers: [1, 2, 20, 21, 39, 40], additional: 3 },
];

describe("consecutiveAnalysis", () => {
  it("detects draws with consecutive numbers", () => {
    const result = consecutiveAnalysis(draws);
    expect(result.drawsWithConsecutive).toBe(2);
    expect(result.totalDraws).toBe(3);
    expect(result.percentage).toBeCloseTo(66.67, 0);
  });

  it("counts consecutive pairs per draw", () => {
    const result = consecutiveAnalysis(draws);
    expect(result.draws[0].consecutivePairs).toBe(3);
    expect(result.draws[1].consecutivePairs).toBe(0);
  });
});

describe("sumRangeAnalysis", () => {
  it("computes sum of each draw", () => {
    const result = sumRangeAnalysis(draws);
    expect(result.draws[0].sum).toBe(87);
    expect(result.draws[1].sum).toBe(105);
  });

  it("returns average and range", () => {
    const result = sumRangeAnalysis(draws);
    expect(result.min).toBeLessThanOrEqual(result.max);
    expect(result.average).toBeGreaterThan(0);
  });
});

describe("pairFrequency", () => {
  it("finds most common co-occurring pairs", () => {
    const result = pairFrequency(draws, 10);
    expect(result[0].count).toBe(2);
    const topPairKeys = result.filter((p) => p.count === 2).map((p) => `${p.pair[0]}-${p.pair[1]}`);
    expect(topPairKeys).toContain("1-2");
    expect(topPairKeys).toContain("20-21");
  });

  it("returns at most topN pairs", () => {
    const result = pairFrequency(draws, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});
