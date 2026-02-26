import { describe, it, expect } from "vitest";
import type { DrawRecord } from "../db/index.js";
import { generatePicks } from "./recommend.js";

function makeDraw(n: number, nums: [number, number, number, number, number, number], add: number): DrawRecord {
  return { drawNumber: n, drawDate: `2026-01-${String(n).padStart(2, "0")}`, numbers: nums, additional: add };
}

// 50 draws: number 1 appears every draw (hot), number 49 never appears (cold/overdue)
const draws: DrawRecord[] = [];
const pool = Array.from({ length: 43 }, (_, i) => i + 2).filter((n) => n !== 49);
for (let i = 0; i < 50; i++) {
  const offset = (i * 5) % pool.length;
  const picks: number[] = [1];
  for (let j = 0; j < 5; j++) {
    picks.push(pool[(offset + j) % pool.length]);
  }
  draws.push(makeDraw(i + 1, picks.sort((a, b) => a - b) as [number, number, number, number, number, number], 7));
}

describe("generatePicks", () => {
  it("returns exactly 6 numbers", () => {
    const result = generatePicks(draws);
    expect(result.numbers).toHaveLength(6);
  });

  it("returns numbers in range 1-49", () => {
    const result = generatePicks(draws);
    for (const n of result.numbers) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(49);
    }
  });

  it("returns unique numbers", () => {
    const result = generatePicks(draws);
    const unique = new Set(result.numbers);
    expect(unique.size).toBe(6);
  });

  it("returns sorted numbers", () => {
    const result = generatePicks(draws);
    for (let i = 1; i < result.numbers.length; i++) {
      expect(result.numbers[i]).toBeGreaterThan(result.numbers[i - 1]);
    }
  });

  it("includes scores for each number", () => {
    const result = generatePicks(draws);
    expect(result.scores).toHaveLength(49);
    expect(result.scores[0].number).toBe(1);
    expect(typeof result.scores[0].score).toBe("number");
  });

  it("includes reasoning", () => {
    const result = generatePicks(draws);
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it("warns about small sample size", () => {
    const smallDraws = draws.slice(0, 5);
    const result = generatePicks(smallDraws);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
