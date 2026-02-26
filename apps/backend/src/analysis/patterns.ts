import type { DrawRecord } from "../db/index.js";

export interface ConsecutiveResult {
  drawsWithConsecutive: number;
  totalDraws: number;
  percentage: number;
  draws: { drawNumber: number; consecutivePairs: number }[];
}

export interface SumRangeResult {
  draws: { drawNumber: number; sum: number }[];
  min: number;
  max: number;
  average: number;
}

export interface PairResult {
  pair: [number, number];
  count: number;
}

export function consecutiveAnalysis(draws: DrawRecord[]): ConsecutiveResult {
  const results = draws.map((d) => {
    const sorted = [...d.numbers].sort((a, b) => a - b);
    let pairs = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) pairs++;
    }
    return { drawNumber: d.drawNumber, consecutivePairs: pairs };
  });

  const withConsec = results.filter((r) => r.consecutivePairs > 0).length;
  return {
    drawsWithConsecutive: withConsec,
    totalDraws: draws.length,
    percentage: (withConsec / draws.length) * 100,
    draws: results,
  };
}

export function sumRangeAnalysis(draws: DrawRecord[]): SumRangeResult {
  const results = draws.map((d) => ({
    drawNumber: d.drawNumber,
    sum: d.numbers.reduce((a, b) => a + b, 0),
  }));

  const sums = results.map((r) => r.sum);
  return {
    draws: results,
    min: Math.min(...sums),
    max: Math.max(...sums),
    average: sums.reduce((a, b) => a + b, 0) / sums.length,
  };
}

export function pairFrequency(draws: DrawRecord[], topN = 10): PairResult[] {
  const counts = new Map<string, number>();

  for (const d of draws) {
    const sorted = [...d.numbers].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}-${sorted[j]}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }

  const pairs: PairResult[] = [];
  for (const [key, count] of counts) {
    const [a, b] = key.split("-").map(Number);
    pairs.push({ pair: [a, b] as [number, number], count });
  }

  pairs.sort((a, b) => b.count - a.count);
  return pairs.slice(0, topN);
}
