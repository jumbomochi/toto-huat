import type { DrawRecord } from "../db/index.js";

export interface WindowFrequency {
  number: number;
  windowFrequency: number;   // frequency in last N draws (0-1)
  overallFrequency: number;  // frequency across all draws (0-1)
  deviation: number;         // window - overall
}

export interface TrendResult {
  number: number;
  direction: "up" | "down";
  windowFrequency: number;
  overallFrequency: number;
  deviation: number;
}

export function slidingWindowFrequency(draws: DrawRecord[], windowSize: number): WindowFrequency[] {
  const total = draws.length;
  if (total === 0) return [];

  const windowStart = Math.max(0, total - windowSize);
  const windowLen = total - windowStart;

  const overallCount: Record<number, number> = {};
  const windowCount: Record<number, number> = {};
  for (let n = 1; n <= 49; n++) {
    overallCount[n] = 0;
    windowCount[n] = 0;
  }

  for (let i = 0; i < total; i++) {
    for (const num of draws[i].numbers) {
      overallCount[num]++;
      if (i >= windowStart) windowCount[num]++;
    }
  }

  const result: WindowFrequency[] = [];
  for (let n = 1; n <= 49; n++) {
    const wf = windowCount[n] / windowLen;
    const of_ = overallCount[n] / total;
    result.push({
      number: n,
      windowFrequency: wf,
      overallFrequency: of_,
      deviation: wf - of_,
    });
  }

  return result;
}

export function trendingNumbers(draws: DrawRecord[], windowSize: number, thresholdDeviation = 0.15): TrendResult[] {
  const freqs = slidingWindowFrequency(draws, windowSize);

  return freqs
    .filter((f) => Math.abs(f.deviation) > thresholdDeviation)
    .map((f) => ({
      number: f.number,
      direction: f.deviation > 0 ? "up" : "down",
      windowFrequency: f.windowFrequency,
      overallFrequency: f.overallFrequency,
      deviation: f.deviation,
    }))
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}
