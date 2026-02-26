import { describe, it, expect } from "vitest";
import { runBacktest } from "./backtest.js";
import type { DrawRecord } from "../db/index.js";

function makeDraw(drawNumber: number, numbers: [number, number, number, number, number, number]): DrawRecord {
  return { drawNumber, drawDate: "2024-01-01", numbers, additional: 7 };
}

function makeRandomDraws(count: number, seed: number = 42): DrawRecord[] {
  // Simple PRNG for deterministic "random" draws
  let state = seed;
  function nextInt(max: number): number {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state % max;
  }

  const draws: DrawRecord[] = [];
  for (let i = 0; i < count; i++) {
    const nums = new Set<number>();
    while (nums.size < 6) {
      nums.add(nextInt(49) + 1);
    }
    const sorted = [...nums].sort((a, b) => a - b) as [number, number, number, number, number, number];
    draws.push(makeDraw(3000 + i, sorted));
  }
  return draws;
}

describe("runBacktest", () => {
  it("produces correct number of steps", () => {
    const draws = makeRandomDraws(150);
    const result = runBacktest(draws, { minTrainingDraws: 100 });

    expect(result.steps).toHaveLength(150 - 100);
    expect(result.summary.totalDrawsPredicted).toBe(50);
  });

  it("hits distribution sums to totalDrawsPredicted", () => {
    const draws = makeRandomDraws(200);
    const result = runBacktest(draws, { minTrainingDraws: 100 });

    const distributionSum = Object.values(result.summary.hitsDistribution).reduce((a, b) => a + b, 0);
    expect(distributionSum).toBe(result.summary.totalDrawsPredicted);
  });

  it("z-score is near 0 for random data", () => {
    const draws = makeRandomDraws(500);
    const result = runBacktest(draws, { minTrainingDraws: 100 });

    // For truly random data, z-score should be small (not statistically significant)
    expect(Math.abs(result.summary.zScore)).toBeLessThan(3);
    expect(result.summary.pValue).toBeGreaterThan(0.001);
  });

  it("cumulative hit rate tracks correctly", () => {
    const draws = makeRandomDraws(200);
    const result = runBacktest(draws, { minTrainingDraws: 100 });

    // Verify cumulative tracking
    let totalHits = 0;
    for (let i = 0; i < result.steps.length; i++) {
      totalHits += result.steps[i].hits;
      expect(result.steps[i].cumulativeHitRate).toBeCloseTo(totalHits / (i + 1), 10);
    }
  });

  it("each step has 6 predicted numbers", () => {
    const draws = makeRandomDraws(150);
    const result = runBacktest(draws, { minTrainingDraws: 100 });

    for (const step of result.steps) {
      expect(step.predicted).toHaveLength(6);
      expect(step.actual).toHaveLength(6);
      expect(step.hits).toBeGreaterThanOrEqual(0);
      expect(step.hits).toBeLessThanOrEqual(6);
    }
  });

  it("baseline hits per draw is 6*6/49", () => {
    const draws = makeRandomDraws(150);
    const result = runBacktest(draws, { minTrainingDraws: 100 });

    expect(result.summary.baselineHitsPerDraw).toBeCloseTo(36 / 49, 5);
  });

  it("respects trainingWindowSize parameter", () => {
    const draws = makeRandomDraws(300);
    const result = runBacktest(draws, {
      trainingWindowSize: 50,
      minTrainingDraws: 50,
    });

    // Should have more steps since minTrainingDraws is lower
    expect(result.summary.totalDrawsPredicted).toBe(300 - 50);
  });

  it("returns empty results for insufficient draws", () => {
    const draws = makeRandomDraws(50);
    const result = runBacktest(draws, { minTrainingDraws: 100 });

    expect(result.steps).toHaveLength(0);
    expect(result.summary.totalDrawsPredicted).toBe(0);
    expect(result.summary.averageHitsPerDraw).toBe(0);
  });
});
