import type { DrawRecord } from "../db/index.js";

export interface NumberFrequencies {
  main: Record<number, number>;
  additional: Record<number, number>;
  totalDraws: number;
}

export interface HotColdResult {
  hot: number[];
  cold: number[];
  neutral: number[];
  expectedFrequency: number;
}

export interface OverdueNumber {
  number: number;
  lastSeenDraw: number | null;
  drawsSinceLastSeen: number;
}

export function getNumberFrequencies(draws: DrawRecord[]): NumberFrequencies {
  const main: Record<number, number> = {};
  const additional: Record<number, number> = {};

  for (let n = 1; n <= 49; n++) {
    main[n] = 0;
    additional[n] = 0;
  }

  for (const draw of draws) {
    for (const num of draw.numbers) {
      main[num]++;
    }
    additional[draw.additional]++;
  }

  return { main, additional, totalDraws: draws.length };
}

export function classifyHotCold(freq: NumberFrequencies, thresholdZ = 1.5): HotColdResult {
  const expected = freq.totalDraws * 6 / 49;
  const stdDev = Math.sqrt(freq.totalDraws * (6 / 49) * (1 - 6 / 49));

  const hot: number[] = [];
  const cold: number[] = [];
  const neutral: number[] = [];

  for (let n = 1; n <= 49; n++) {
    const z = stdDev > 0 ? (freq.main[n] - expected) / stdDev : 0;
    if (z > thresholdZ) hot.push(n);
    else if (z < -thresholdZ) cold.push(n);
    else neutral.push(n);
  }

  return { hot, cold, neutral, expectedFrequency: expected };
}

export function getOverdueNumbers(draws: DrawRecord[]): OverdueNumber[] {
  const lastSeen: Record<number, number | null> = {};
  for (let n = 1; n <= 49; n++) lastSeen[n] = null;

  for (const draw of draws) {
    for (const num of draw.numbers) {
      lastSeen[num] = draw.drawNumber;
    }
    lastSeen[draw.additional] = draw.drawNumber;
  }

  const latestDraw = draws.length > 0 ? draws[draws.length - 1].drawNumber : 0;

  const result: OverdueNumber[] = [];
  for (let n = 1; n <= 49; n++) {
    result.push({
      number: n,
      lastSeenDraw: lastSeen[n],
      drawsSinceLastSeen: lastSeen[n] === null ? draws.length : latestDraw - lastSeen[n],
    });
  }

  result.sort((a, b) => b.drawsSinceLastSeen - a.drawsSinceLastSeen);
  return result;
}
