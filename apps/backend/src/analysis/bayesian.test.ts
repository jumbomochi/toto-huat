import { describe, it, expect } from "vitest";
import { normalCDF } from "./stats.js";
import { computeBayesianModel } from "./bayesian.js";
import type { DrawRecord } from "../db/index.js";

function makeDraw(drawNumber: number, numbers: [number, number, number, number, number, number]): DrawRecord {
  return { drawNumber, drawDate: "2024-01-01", numbers, additional: 7 };
}

describe("normalCDF", () => {
  it("returns ~0.5 for x=0", () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 5);
  });

  it("returns ~0.975 for x=1.96", () => {
    expect(normalCDF(1.96)).toBeCloseTo(0.975, 3);
  });

  it("returns ~0.025 for x=-1.96", () => {
    expect(normalCDF(-1.96)).toBeCloseTo(0.025, 3);
  });

  it("returns ~0.8413 for x=1", () => {
    expect(normalCDF(1)).toBeCloseTo(0.8413, 3);
  });
});

describe("computeBayesianModel", () => {
  it("returns near-uniform posteriors for uniform draws", () => {
    // Create draws where each number 1-49 appears roughly equally
    const draws: DrawRecord[] = [];
    for (let i = 0; i < 49; i++) {
      const nums = Array.from({ length: 6 }, (_, j) => ((i * 6 + j) % 49) + 1) as [number, number, number, number, number, number];
      draws.push(makeDraw(3000 + i, nums));
    }

    const result = computeBayesianModel(draws);
    const uniform = 1 / 49;

    for (const est of result.estimates) {
      expect(Math.abs(est.deviationFromUniform)).toBeLessThan(0.01);
      expect(est.posteriorMean).toBeCloseTo(uniform, 1);
    }
  });

  it("detects bias in non-uniform draws", () => {
    // Number 1 appears in every draw
    const draws: DrawRecord[] = [];
    for (let i = 0; i < 100; i++) {
      draws.push(makeDraw(3000 + i, [1, 2, 3, 4, 5, 6]));
    }

    const result = computeBayesianModel(draws);
    const est1 = result.estimates.find((e) => e.number === 1)!;
    const est49 = result.estimates.find((e) => e.number === 49)!;

    expect(est1.posteriorMean).toBeGreaterThan(est49.posteriorMean);
    expect(est1.deviationFromUniform).toBeGreaterThan(0);
    expect(est49.deviationFromUniform).toBeLessThan(0);
  });

  it("returns top 6 picks sorted ascending", () => {
    const draws: DrawRecord[] = [];
    for (let i = 0; i < 50; i++) {
      draws.push(makeDraw(3000 + i, [1, 2, 3, 4, 5, 6]));
    }

    const result = computeBayesianModel(draws);
    expect(result.topPicks).toHaveLength(6);
    // Should be sorted ascending
    for (let i = 1; i < result.topPicks.length; i++) {
      expect(result.topPicks[i]).toBeGreaterThanOrEqual(result.topPicks[i - 1]);
    }
  });

  it("respects windowSize parameter", () => {
    // First 100 draws: always [1,2,3,4,5,6]
    // Last 50 draws: always [44,45,46,47,48,49]
    const draws: DrawRecord[] = [];
    for (let i = 0; i < 100; i++) {
      draws.push(makeDraw(3000 + i, [1, 2, 3, 4, 5, 6]));
    }
    for (let i = 0; i < 50; i++) {
      draws.push(makeDraw(3100 + i, [44, 45, 46, 47, 48, 49]));
    }

    const allResult = computeBayesianModel(draws);
    const windowResult = computeBayesianModel(draws, 50);

    // With window=50, only recent draws matter so 44-49 should dominate
    expect(windowResult.totalDrawsUsed).toBe(50);
    expect(windowResult.topPicks).toEqual([44, 45, 46, 47, 48, 49]);

    // Without window, numbers 1-6 have more total weight
    expect(allResult.totalDrawsUsed).toBe(150);
    const est1All = allResult.estimates.find((e) => e.number === 1)!;
    const est1Window = windowResult.estimates.find((e) => e.number === 1)!;
    expect(est1All.posteriorMean).toBeGreaterThan(est1Window.posteriorMean);
  });

  it("returns 1/49 for empty draws", () => {
    const result = computeBayesianModel([]);
    const uniform = 1 / 49;

    expect(result.totalDrawsUsed).toBe(0);
    for (const est of result.estimates) {
      expect(est.posteriorMean).toBeCloseTo(uniform, 5);
      expect(est.observedCount).toBe(0);
    }
  });

  it("windowSize=null uses all draws", () => {
    const draws: DrawRecord[] = [];
    for (let i = 0; i < 10; i++) {
      draws.push(makeDraw(3000 + i, [1, 2, 3, 4, 5, 6]));
    }

    const result = computeBayesianModel(draws);
    expect(result.windowSize).toBeNull();
    expect(result.totalDrawsUsed).toBe(10);
  });
});
