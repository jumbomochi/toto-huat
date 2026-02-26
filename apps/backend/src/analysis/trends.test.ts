import { describe, it, expect } from "vitest";
import type { DrawRecord } from "../db/index.js";
import { slidingWindowFrequency, trendingNumbers } from "./trends.js";

function makeDraw(n: number, nums: [number, number, number, number, number, number]): DrawRecord {
  return { drawNumber: n, drawDate: `2026-01-${String(n).padStart(2, "0")}`, numbers: nums, additional: 49 };
}

// 10 draws where number 1 appears in the last 3 but not earlier
const draws: DrawRecord[] = [
  makeDraw(1, [10, 11, 12, 13, 14, 15]),
  makeDraw(2, [10, 11, 12, 13, 14, 15]),
  makeDraw(3, [10, 11, 12, 13, 14, 15]),
  makeDraw(4, [10, 11, 12, 13, 14, 15]),
  makeDraw(5, [10, 11, 12, 13, 14, 15]),
  makeDraw(6, [10, 11, 12, 13, 14, 15]),
  makeDraw(7, [10, 11, 12, 13, 14, 15]),
  makeDraw(8, [1, 2, 3, 4, 5, 6]),
  makeDraw(9, [1, 2, 3, 4, 5, 6]),
  makeDraw(10, [1, 2, 3, 4, 5, 6]),
];

describe("slidingWindowFrequency", () => {
  it("computes frequency in window vs overall", () => {
    const result = slidingWindowFrequency(draws, 3);
    // Number 1: overall 3/10 = 0.3, window (last 3 draws) 3/3 = 1.0
    const num1 = result.find((r) => r.number === 1)!;
    expect(num1.windowFrequency).toBeCloseTo(1.0);
    expect(num1.overallFrequency).toBeCloseTo(0.3);
    // Number 10: overall 7/10 = 0.7, window 0/3 = 0
    const num10 = result.find((r) => r.number === 10)!;
    expect(num10.windowFrequency).toBeCloseTo(0);
    expect(num10.overallFrequency).toBeCloseTo(0.7);
  });
});

describe("trendingNumbers", () => {
  it("identifies numbers trending up", () => {
    const result = trendingNumbers(draws, 3);
    // Number 1 went from 0 frequency in first 7 draws to 100% in last 3
    const trendingUp = result.filter((r) => r.direction === "up").map((r) => r.number);
    expect(trendingUp).toContain(1);
  });

  it("identifies numbers trending down", () => {
    const result = trendingNumbers(draws, 3);
    const trendingDown = result.filter((r) => r.direction === "down").map((r) => r.number);
    expect(trendingDown).toContain(10);
  });
});
