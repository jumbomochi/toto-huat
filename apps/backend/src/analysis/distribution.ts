import type { DrawRecord } from "../db/index.js";
import { getNumberFrequencies } from "./frequency.js";
import { chiSquaredStatistic, chiSquaredPValue } from "./stats.js";

export interface ChiSquaredResult {
  statistic: number;
  pValue: number;
  degreesOfFreedom: number;
  isSignificant: boolean;
  sampleSizeWarning: boolean;
}

export interface OddEvenResult {
  draws: { drawNumber: number; odd: number; even: number }[];
  averageOdd: number;
  averageEven: number;
}

export interface HighLowResult {
  draws: { drawNumber: number; high: number; low: number }[];
  averageHigh: number;
  averageLow: number;
}

export interface GroupResult {
  groups: { label: string; range: [number, number]; count: number; expected: number }[];
  totalNumbers: number;
}

const MIN_EXPECTED_FREQUENCY = 5;

export function chiSquaredUniformityTest(draws: DrawRecord[]): ChiSquaredResult {
  const freq = getNumberFrequencies(draws);
  const expectedPerNumber = freq.totalDraws * 6 / 49;
  const sampleSizeWarning = expectedPerNumber < MIN_EXPECTED_FREQUENCY;

  const observed: number[] = [];
  const expected: number[] = [];
  for (let n = 1; n <= 49; n++) {
    observed.push(freq.main[n]);
    expected.push(expectedPerNumber);
  }

  const statistic = chiSquaredStatistic(observed, expected);
  const df = 48;
  const pValue = chiSquaredPValue(statistic, df);

  return { statistic, pValue, degreesOfFreedom: df, isSignificant: pValue < 0.05, sampleSizeWarning };
}

export function oddEvenDistribution(draws: DrawRecord[]): OddEvenResult {
  const results = draws.map((d) => {
    const odd = d.numbers.filter((n) => n % 2 !== 0).length;
    return { drawNumber: d.drawNumber, odd, even: 6 - odd };
  });
  const avgOdd = results.reduce((s, r) => s + r.odd, 0) / results.length;
  return { draws: results, averageOdd: avgOdd, averageEven: 6 - avgOdd };
}

export function highLowDistribution(draws: DrawRecord[]): HighLowResult {
  const results = draws.map((d) => {
    const high = d.numbers.filter((n) => n >= 25).length;
    return { drawNumber: d.drawNumber, high, low: 6 - high };
  });
  const avgHigh = results.reduce((s, r) => s + r.high, 0) / results.length;
  return { draws: results, averageHigh: avgHigh, averageLow: 6 - avgHigh };
}

export function groupDistribution(draws: DrawRecord[]): GroupResult {
  const ranges: [string, number, number][] = [
    ["1-10", 1, 10], ["11-20", 11, 20], ["21-30", 21, 30], ["31-40", 31, 40], ["41-49", 41, 49],
  ];
  const totalNumbers = draws.length * 6;
  const groups = ranges.map(([label, lo, hi]) => {
    let count = 0;
    for (const d of draws) count += d.numbers.filter((n) => n >= lo && n <= hi).length;
    const rangeSize = hi - lo + 1;
    const expected = totalNumbers * rangeSize / 49;
    return { label, range: [lo, hi] as [number, number], count, expected };
  });
  return { groups, totalNumbers };
}
