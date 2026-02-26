import { describe, it, expect } from "vitest";
import type { DrawRecord } from "../db/index.js";
import { chiSquaredUniformityTest, oddEvenDistribution, highLowDistribution, groupDistribution } from "./distribution.js";

const draws: DrawRecord[] = [
  { drawNumber: 1, drawDate: "2026-01-01", numbers: [1, 2, 3, 4, 5, 6], additional: 7 },
  { drawNumber: 2, drawDate: "2026-01-04", numbers: [7, 8, 9, 10, 11, 12], additional: 13 },
  { drawNumber: 3, drawDate: "2026-01-08", numbers: [13, 14, 15, 16, 17, 18], additional: 19 },
];

describe("chiSquaredUniformityTest", () => {
  it("returns statistic, pValue, degreesOfFreedom, and isSignificant", () => {
    const result = chiSquaredUniformityTest(draws);
    expect(result.degreesOfFreedom).toBe(48);
    expect(result.statistic).toBeGreaterThan(0);
    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
    expect(typeof result.isSignificant).toBe("boolean");
  });

  it("flags low sample size", () => {
    const result = chiSquaredUniformityTest(draws);
    expect(result.sampleSizeWarning).toBe(true);
  });
});

describe("oddEvenDistribution", () => {
  it("counts odd and even numbers per draw", () => {
    const result = oddEvenDistribution(draws);
    expect(result.draws[0].odd).toBe(3);
    expect(result.draws[0].even).toBe(3);
    expect(result.averageOdd).toBeCloseTo(3);
    expect(result.averageEven).toBeCloseTo(3);
  });
});

describe("highLowDistribution", () => {
  it("counts high (25-49) and low (1-24) per draw", () => {
    const result = highLowDistribution(draws);
    expect(result.draws[0].low).toBe(6);
    expect(result.draws[0].high).toBe(0);
  });
});

describe("groupDistribution", () => {
  it("returns distribution across 5 groups", () => {
    const result = groupDistribution(draws);
    expect(result.groups).toHaveLength(5);
    expect(result.groups[0].label).toBe("1-10");
    expect(result.groups[0].count).toBeGreaterThan(0);
  });

  it("sums to total numbers drawn", () => {
    const result = groupDistribution(draws);
    const total = result.groups.reduce((s, g) => s + g.count, 0);
    expect(total).toBe(draws.length * 6);
  });
});
