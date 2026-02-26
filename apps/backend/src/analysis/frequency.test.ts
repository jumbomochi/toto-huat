import { describe, it, expect } from "vitest";
import type { DrawRecord } from "../db/index.js";
import { getNumberFrequencies, classifyHotCold, getOverdueNumbers } from "./frequency.js";

const draws: DrawRecord[] = [
  { drawNumber: 1, drawDate: "2026-01-01", numbers: [1, 2, 3, 4, 5, 6], additional: 7 },
  { drawNumber: 2, drawDate: "2026-01-04", numbers: [1, 2, 3, 10, 11, 12], additional: 4 },
  { drawNumber: 3, drawDate: "2026-01-08", numbers: [1, 8, 9, 10, 11, 12], additional: 2 },
];

describe("getNumberFrequencies", () => {
  it("counts main number frequencies", () => {
    const freq = getNumberFrequencies(draws);
    expect(freq.main[1]).toBe(3);
    expect(freq.main[2]).toBe(2);
    expect(freq.main[8]).toBe(1);
    expect(freq.main[49]).toBe(0);
  });

  it("counts additional number frequencies", () => {
    const freq = getNumberFrequencies(draws);
    expect(freq.additional[7]).toBe(1);
    expect(freq.additional[4]).toBe(1);
    expect(freq.additional[2]).toBe(1);
    expect(freq.additional[1]).toBe(0);
  });

  it("tracks total draws", () => {
    const freq = getNumberFrequencies(draws);
    expect(freq.totalDraws).toBe(3);
  });
});

describe("classifyHotCold", () => {
  it("classifies numbers relative to expected frequency", () => {
    const freq = getNumberFrequencies(draws);
    const classified = classifyHotCold(freq);
    expect(classified.hot).toContain(1);
    expect(classified.cold.length).toBeGreaterThan(0);
    expect(classified.cold).toContain(49);
  });
});

describe("getOverdueNumbers", () => {
  it("returns numbers sorted by draws since last appearance", () => {
    const overdue = getOverdueNumbers(draws);
    expect(overdue[0].drawsSinceLastSeen).toBeGreaterThan(0);
    const neverDrawn = overdue.filter((o) => o.drawsSinceLastSeen === 3);
    expect(neverDrawn.length).toBeGreaterThan(0);
  });

  it("includes the number and last seen draw number", () => {
    const overdue = getOverdueNumbers(draws);
    const num5 = overdue.find((o) => o.number === 5)!;
    expect(num5.lastSeenDraw).toBe(1);
    expect(num5.drawsSinceLastSeen).toBe(2);
  });
});
