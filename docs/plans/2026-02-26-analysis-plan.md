# Statistical Analysis Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a pure TypeScript analysis module that detects bias in Singapore Toto draws and generates number recommendations, accessible via CLI commands.

**Architecture:** Functional analysis modules in `apps/backend/src/analysis/` that take arrays of draw records and return typed results. A shared `DrawRecord` type bridges the DB layer to analysis. Each module is independently testable. CLI commands in a separate `analyze-cli.ts` entry point.

**Tech Stack:** TypeScript, better-sqlite3 (data access), vitest (testing). No external stats libraries.

---

## Reference: Existing Code

- **DB module** (`src/db/index.ts`): Exports `openDb(path)`, `getDrawCount(db)`, `getLatestDrawNumber(db)`, `getGaps(db)`. Does NOT yet have a `getAllDraws()` function.
- **DB schema**: `draws` table has columns `draw_number, draw_date, num1..num6, additional, created_at`. `prizes` table has `draw_number, group_num, share_amount, winners`.
- **CLI** (`src/cli.ts`): Handles `latest`, `backfill`, `status` commands. Uses `process.argv.slice(2)`.
- **Package scripts**: `ingest:latest`, `ingest:backfill`, `ingest:status`, `test`, `test:watch`.

---

### Task 1: Add DrawRecord type and getAllDraws query

**Files:**
- Modify: `apps/backend/src/db/index.ts`
- Modify: `apps/backend/src/db/index.test.ts`

**Step 1: Write the failing test**

Add to `apps/backend/src/db/index.test.ts`:

```typescript
import { initDb, upsertDraw, upsertPrizes, getLatestDrawNumber, getDrawCount, getGaps, getAllDraws } from "./index.js";

// ... inside the existing describe("database", ...) block, add:

  it("returns all draws ordered by draw_number", () => {
    upsertDraw(db, { drawNumber: 4158, drawDate: "2026-02-19", numbers: [8, 16, 17, 34, 38, 48], additional: 25 });
    upsertDraw(db, { drawNumber: 4159, drawDate: "2026-02-23", numbers: [24, 26, 30, 32, 37, 47], additional: 2 });

    const draws = getAllDraws(db);
    expect(draws).toHaveLength(2);
    expect(draws[0].drawNumber).toBe(4158);
    expect(draws[0].numbers).toEqual([8, 16, 17, 34, 38, 48]);
    expect(draws[0].additional).toBe(25);
    expect(draws[0].drawDate).toBe("2026-02-19");
    expect(draws[1].drawNumber).toBe(4159);
  });
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/db/index.test.ts
```

Expected: FAIL — `getAllDraws` not exported.

**Step 3: Implement**

Add to `apps/backend/src/db/index.ts`:

```typescript
export interface DrawRecord {
  drawNumber: number;
  drawDate: string;
  numbers: [number, number, number, number, number, number];
  additional: number;
}

export function getAllDraws(db: Database.Database): DrawRecord[] {
  const rows = db.prepare(
    "SELECT draw_number, draw_date, num1, num2, num3, num4, num5, num6, additional FROM draws ORDER BY draw_number"
  ).all() as { draw_number: number; draw_date: string; num1: number; num2: number; num3: number; num4: number; num5: number; num6: number; additional: number }[];

  return rows.map((r) => ({
    drawNumber: r.draw_number,
    drawDate: r.draw_date,
    numbers: [r.num1, r.num2, r.num3, r.num4, r.num5, r.num6] as [number, number, number, number, number, number],
    additional: r.additional,
  }));
}
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/db/index.test.ts
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat && git add apps/backend/src/db/ && git commit -m "feat: add DrawRecord type and getAllDraws query

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Stats utilities

**Files:**
- Create: `apps/backend/src/analysis/stats.ts`
- Create: `apps/backend/src/analysis/stats.test.ts`

**Step 1: Write the failing test**

Create `apps/backend/src/analysis/stats.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { chiSquaredStatistic, chiSquaredPValue, zScore } from "./stats.js";

describe("chiSquaredStatistic", () => {
  it("returns 0 for perfectly uniform distribution", () => {
    const observed = [10, 10, 10, 10];
    const expected = [10, 10, 10, 10];
    expect(chiSquaredStatistic(observed, expected)).toBeCloseTo(0);
  });

  it("computes correct statistic for skewed distribution", () => {
    // (15-10)^2/10 + (5-10)^2/10 + (12-10)^2/10 + (8-10)^2/10 = 2.5+2.5+0.4+0.4 = 5.8
    const observed = [15, 5, 12, 8];
    const expected = [10, 10, 10, 10];
    expect(chiSquaredStatistic(observed, expected)).toBeCloseTo(5.8);
  });
});

describe("chiSquaredPValue", () => {
  it("returns high p-value for low statistic with many df", () => {
    // chi2 = 30, df = 48 -> p-value should be > 0.95 (not significant)
    const p = chiSquaredPValue(30, 48);
    expect(p).toBeGreaterThan(0.9);
  });

  it("returns low p-value for high statistic", () => {
    // chi2 = 100, df = 48 -> p-value should be very small (significant)
    const p = chiSquaredPValue(100, 48);
    expect(p).toBeLessThan(0.01);
  });

  it("returns ~0.05 boundary correctly for df=48", () => {
    // Critical value at p=0.05 for df=48 is ~65.17
    const p = chiSquaredPValue(65.17, 48);
    expect(p).toBeCloseTo(0.05, 1);
  });
});

describe("zScore", () => {
  it("returns 0 when observed equals expected", () => {
    expect(zScore(10, 10, 2)).toBeCloseTo(0);
  });

  it("computes correct positive z-score", () => {
    expect(zScore(14, 10, 2)).toBeCloseTo(2.0);
  });

  it("computes correct negative z-score", () => {
    expect(zScore(6, 10, 2)).toBeCloseTo(-2.0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/analysis/stats.test.ts
```

**Step 3: Implement**

Create `apps/backend/src/analysis/stats.ts`:

```typescript
/**
 * Compute chi-squared test statistic: sum of (O-E)^2 / E
 */
export function chiSquaredStatistic(observed: number[], expected: number[]): number {
  let sum = 0;
  for (let i = 0; i < observed.length; i++) {
    const diff = observed[i] - expected[i];
    sum += (diff * diff) / expected[i];
  }
  return sum;
}

/**
 * Approximate p-value for chi-squared distribution using the regularized
 * incomplete gamma function. This avoids needing lookup tables.
 *
 * P(X > x) = 1 - gammainc(df/2, x/2)
 */
export function chiSquaredPValue(statistic: number, df: number): number {
  // Use regularized lower incomplete gamma function
  // P(X <= x) = gammainc(df/2, x/2) for chi-squared
  // p-value = 1 - P(X <= x)
  const a = df / 2;
  const x = statistic / 2;
  return 1 - regularizedGammaLower(a, x);
}

/**
 * Regularized lower incomplete gamma function P(a, x) = gamma(a,x) / Gamma(a)
 * Uses series expansion for x < a+1, continued fraction otherwise.
 */
function regularizedGammaLower(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;

  if (x < a + 1) {
    return gammaIncSeries(a, x);
  } else {
    return 1 - gammaIncCF(a, x);
  }
}

/** Series expansion for lower incomplete gamma */
function gammaIncSeries(a: number, x: number): number {
  const lnGammaA = lnGamma(a);
  let sum = 1 / a;
  let term = 1 / a;
  for (let n = 1; n < 200; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-10) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGammaA);
}

/** Continued fraction for upper incomplete gamma */
function gammaIncCF(a: number, x: number): number {
  const lnGammaA = lnGamma(a);
  let f = x + 1 - a;
  let c = 1e30;
  let d = 1 / f;
  let h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    const bn = x + 2 * i + 1 - a;
    d = bn + an * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = bn + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGammaA) * h;
}

/** Log-gamma via Lanczos approximation */
function lnGamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Standard z-score: (observed - expected) / stdDev
 */
export function zScore(observed: number, expected: number, stdDev: number): number {
  return (observed - expected) / stdDev;
}
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/analysis/stats.test.ts
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat && git add apps/backend/src/analysis/ && git commit -m "feat: add chi-squared and z-score stat utilities

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Frequency analysis

**Files:**
- Create: `apps/backend/src/analysis/frequency.ts`
- Create: `apps/backend/src/analysis/frequency.test.ts`

**Step 1: Write the failing test**

Create `apps/backend/src/analysis/frequency.test.ts`:

```typescript
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
    expect(freq.main[1]).toBe(3);  // appears in all 3 draws
    expect(freq.main[2]).toBe(2);  // draws 1 and 2
    expect(freq.main[8]).toBe(1);  // draw 3 only
    expect(freq.main[49]).toBe(0); // never drawn
  });

  it("counts additional number frequencies", () => {
    const freq = getNumberFrequencies(draws);
    expect(freq.additional[7]).toBe(1);
    expect(freq.additional[4]).toBe(1);
    expect(freq.additional[2]).toBe(1);
    expect(freq.additional[1]).toBe(0); // 1 only appears as main
  });

  it("tracks total draws", () => {
    const freq = getNumberFrequencies(draws);
    expect(freq.totalDraws).toBe(3);
  });
});

describe("classifyHotCold", () => {
  it("classifies numbers relative to expected frequency", () => {
    const freq = getNumberFrequencies(draws);
    // expected per number for main: 3 * 6/49 ≈ 0.367
    const classified = classifyHotCold(freq);
    expect(classified.hot).toContain(1);   // 3 appearances, well above expected
    expect(classified.cold.length).toBeGreaterThan(0); // many numbers never drawn
    expect(classified.cold).toContain(49); // never drawn
  });
});

describe("getOverdueNumbers", () => {
  it("returns numbers sorted by draws since last appearance", () => {
    const overdue = getOverdueNumbers(draws);
    // Numbers 4,5,6 last appeared in draw 1 (2 draws ago)
    // Numbers 3 last appeared in draw 2 (1 draw ago)
    // Number 1 appeared in draw 3 (0 draws ago)
    // Numbers never drawn should be at the top
    expect(overdue[0].drawsSinceLastSeen).toBeGreaterThan(0);
    // Numbers that never appeared have drawsSinceLastSeen = totalDraws
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
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/analysis/frequency.test.ts
```

**Step 3: Implement**

Create `apps/backend/src/analysis/frequency.ts`:

```typescript
import type { DrawRecord } from "../db/index.js";

export interface NumberFrequencies {
  main: Record<number, number>;       // number -> count as main
  additional: Record<number, number>;  // number -> count as additional
  totalDraws: number;
}

export interface HotColdResult {
  hot: number[];     // numbers significantly above expected
  cold: number[];    // numbers significantly below expected
  neutral: number[]; // numbers near expected
  expectedFrequency: number;
}

export interface OverdueNumber {
  number: number;
  lastSeenDraw: number | null;  // draw_number where last seen, null if never
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

  // Draws are ordered by draw_number ascending
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
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/analysis/frequency.test.ts
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat && git add apps/backend/src/analysis/ && git commit -m "feat: add frequency analysis — counts, hot/cold, overdue

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Distribution tests

**Files:**
- Create: `apps/backend/src/analysis/distribution.ts`
- Create: `apps/backend/src/analysis/distribution.test.ts`

**Step 1: Write the failing test**

Create `apps/backend/src/analysis/distribution.test.ts`:

```typescript
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
    expect(result.degreesOfFreedom).toBe(48); // 49 numbers - 1
    expect(result.statistic).toBeGreaterThan(0);
    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
    expect(typeof result.isSignificant).toBe("boolean");
  });

  it("flags low sample size", () => {
    const result = chiSquaredUniformityTest(draws);
    // 3 draws * 6/49 ≈ 0.37 expected per cell — below minimum 5
    expect(result.sampleSizeWarning).toBe(true);
  });
});

describe("oddEvenDistribution", () => {
  it("counts odd and even numbers per draw", () => {
    const result = oddEvenDistribution(draws);
    // Draw 1: [1,2,3,4,5,6] -> 3 odd (1,3,5), 3 even (2,4,6)
    expect(result.draws[0].odd).toBe(3);
    expect(result.draws[0].even).toBe(3);
    expect(result.averageOdd).toBeCloseTo(3);
    expect(result.averageEven).toBeCloseTo(3);
  });
});

describe("highLowDistribution", () => {
  it("counts high (25-49) and low (1-24) per draw", () => {
    const result = highLowDistribution(draws);
    // Draw 1: all numbers 1-6, all low
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
    expect(total).toBe(draws.length * 6); // 18 main numbers total
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/analysis/distribution.test.ts
```

**Step 3: Implement**

Create `apps/backend/src/analysis/distribution.ts`:

```typescript
import type { DrawRecord } from "../db/index.js";
import { getNumberFrequencies } from "./frequency.js";
import { chiSquaredStatistic, chiSquaredPValue } from "./stats.js";

export interface ChiSquaredResult {
  statistic: number;
  pValue: number;
  degreesOfFreedom: number;
  isSignificant: boolean;   // p < 0.05
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
  const df = 48; // 49 - 1
  const pValue = chiSquaredPValue(statistic, df);

  return {
    statistic,
    pValue,
    degreesOfFreedom: df,
    isSignificant: pValue < 0.05,
    sampleSizeWarning,
  };
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
    ["1-10", 1, 10],
    ["11-20", 11, 20],
    ["21-30", 21, 30],
    ["31-40", 31, 40],
    ["41-49", 41, 49],
  ];

  const totalNumbers = draws.length * 6;
  const groups = ranges.map(([label, lo, hi]) => {
    let count = 0;
    for (const d of draws) {
      count += d.numbers.filter((n) => n >= lo && n <= hi).length;
    }
    const rangeSize = hi - lo + 1;
    const expected = totalNumbers * rangeSize / 49;
    return { label, range: [lo, hi] as [number, number], count, expected };
  });

  return { groups, totalNumbers };
}
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/analysis/distribution.test.ts
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat && git add apps/backend/src/analysis/ && git commit -m "feat: add distribution analysis — chi-squared, odd/even, high/low, groups

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Pattern analysis

**Files:**
- Create: `apps/backend/src/analysis/patterns.ts`
- Create: `apps/backend/src/analysis/patterns.test.ts`

**Step 1: Write the failing test**

Create `apps/backend/src/analysis/patterns.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { DrawRecord } from "../db/index.js";
import { consecutiveAnalysis, sumRangeAnalysis, pairFrequency } from "./patterns.js";

const draws: DrawRecord[] = [
  { drawNumber: 1, drawDate: "2026-01-01", numbers: [1, 2, 3, 20, 21, 40], additional: 7 },
  { drawNumber: 2, drawDate: "2026-01-04", numbers: [5, 10, 15, 20, 25, 30], additional: 1 },
  { drawNumber: 3, drawDate: "2026-01-08", numbers: [1, 2, 20, 21, 39, 40], additional: 3 },
];

describe("consecutiveAnalysis", () => {
  it("detects draws with consecutive numbers", () => {
    const result = consecutiveAnalysis(draws);
    // Draw 1: 1,2 and 2,3 and 20,21 -> has consecutive
    // Draw 2: no consecutive pairs
    // Draw 3: 1,2 and 20,21 and 39,40 -> has consecutive
    expect(result.drawsWithConsecutive).toBe(2);
    expect(result.totalDraws).toBe(3);
    expect(result.percentage).toBeCloseTo(66.67, 0);
  });

  it("counts consecutive pairs per draw", () => {
    const result = consecutiveAnalysis(draws);
    // Draw 1 has 3 consecutive pairs: (1,2), (2,3), (20,21)
    expect(result.draws[0].consecutivePairs).toBe(3);
    // Draw 2 has 0
    expect(result.draws[1].consecutivePairs).toBe(0);
  });
});

describe("sumRangeAnalysis", () => {
  it("computes sum of each draw", () => {
    const result = sumRangeAnalysis(draws);
    // Draw 1: 1+2+3+20+21+40 = 87
    expect(result.draws[0].sum).toBe(87);
    // Draw 2: 5+10+15+20+25+30 = 105
    expect(result.draws[1].sum).toBe(105);
  });

  it("returns average and range", () => {
    const result = sumRangeAnalysis(draws);
    expect(result.min).toBeLessThanOrEqual(result.max);
    expect(result.average).toBeGreaterThan(0);
  });
});

describe("pairFrequency", () => {
  it("finds most common co-occurring pairs", () => {
    const result = pairFrequency(draws, 5);
    // (1,2) appears in draw 1 and 3 -> count 2
    // (20,21) appears in draw 1 and 3 -> count 2
    expect(result[0].count).toBe(2);
    const topPairKeys = result.filter((p) => p.count === 2).map((p) => `${p.pair[0]}-${p.pair[1]}`);
    expect(topPairKeys).toContain("1-2");
    expect(topPairKeys).toContain("20-21");
  });

  it("returns at most topN pairs", () => {
    const result = pairFrequency(draws, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/analysis/patterns.test.ts
```

**Step 3: Implement**

Create `apps/backend/src/analysis/patterns.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/analysis/patterns.test.ts
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat && git add apps/backend/src/analysis/ && git commit -m "feat: add pattern analysis — consecutive, sum range, pair frequency

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Time-series trends

**Files:**
- Create: `apps/backend/src/analysis/trends.ts`
- Create: `apps/backend/src/analysis/trends.test.ts`

**Step 1: Write the failing test**

Create `apps/backend/src/analysis/trends.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/analysis/trends.test.ts
```

**Step 3: Implement**

Create `apps/backend/src/analysis/trends.ts`:

```typescript
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

  const window = draws.slice(-windowSize);
  const windowLen = window.length;

  // Count overall frequency
  const overallCount: Record<number, number> = {};
  const windowCount: Record<number, number> = {};
  for (let n = 1; n <= 49; n++) {
    overallCount[n] = 0;
    windowCount[n] = 0;
  }

  for (const d of draws) {
    for (const num of d.numbers) overallCount[num]++;
  }
  for (const d of window) {
    for (const num of d.numbers) windowCount[num]++;
  }

  const result: WindowFrequency[] = [];
  for (let n = 1; n <= 49; n++) {
    const wf = windowLen > 0 ? windowCount[n] / windowLen : 0;
    const of_ = total > 0 ? overallCount[n] / total : 0;
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
      direction: f.deviation > 0 ? "up" as const : "down" as const,
      windowFrequency: f.windowFrequency,
      overallFrequency: f.overallFrequency,
      deviation: f.deviation,
    }))
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/analysis/trends.test.ts
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat && git add apps/backend/src/analysis/ && git commit -m "feat: add time-series trends — sliding window, trending numbers

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Number recommendation engine

**Files:**
- Create: `apps/backend/src/analysis/recommend.ts`
- Create: `apps/backend/src/analysis/recommend.test.ts`

**Step 1: Write the failing test**

Create `apps/backend/src/analysis/recommend.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { DrawRecord } from "../db/index.js";
import { generatePicks } from "./recommend.js";

function makeDraw(n: number, nums: [number, number, number, number, number, number], add: number): DrawRecord {
  return { drawNumber: n, drawDate: `2026-01-${String(n).padStart(2, "0")}`, numbers: nums, additional: add };
}

// Create enough draws for meaningful analysis
const draws: DrawRecord[] = [];
for (let i = 1; i <= 50; i++) {
  // Number 1 appears every draw (very hot)
  // Number 49 never appears (very cold/overdue)
  // Others rotate
  const base = ((i - 1) * 6) % 47 + 2; // cycles through 2-48
  const nums = [1, base, base + 1 > 48 ? 2 : base + 1, 10, 20, 30] as [number, number, number, number, number, number];
  draws.push(makeDraw(i, nums, 7));
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
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/analysis/recommend.test.ts
```

**Step 3: Implement**

Create `apps/backend/src/analysis/recommend.ts`:

```typescript
import type { DrawRecord } from "../db/index.js";
import { getNumberFrequencies, classifyHotCold, getOverdueNumbers } from "./frequency.js";
import { trendingNumbers } from "./trends.js";

export interface NumberScore {
  number: number;
  score: number;
  factors: string[];
}

export interface Recommendation {
  numbers: [number, number, number, number, number, number];
  scores: NumberScore[];
  reasoning: string[];
  warnings: string[];
}

const MIN_DRAWS_FOR_CONFIDENCE = 40;
const TREND_WINDOW = 20;

export function generatePicks(draws: DrawRecord[]): Recommendation {
  const warnings: string[] = [];
  const reasoning: string[] = [];

  if (draws.length < MIN_DRAWS_FOR_CONFIDENCE) {
    warnings.push(`Only ${draws.length} draws available. Results may not be statistically significant (recommend ${MIN_DRAWS_FOR_CONFIDENCE}+).`);
  }

  const freq = getNumberFrequencies(draws);
  const hotCold = classifyHotCold(freq);
  const overdue = getOverdueNumbers(draws);
  const windowSize = Math.min(TREND_WINDOW, Math.floor(draws.length / 2));
  const trending = windowSize > 0 ? trendingNumbers(draws, windowSize) : [];

  // Score each number 1-49
  const scores: NumberScore[] = [];
  for (let n = 1; n <= 49; n++) {
    let score = 0;
    const factors: string[] = [];

    // Factor 1: Hot numbers get a boost (historically frequent)
    if (hotCold.hot.includes(n)) {
      score += 2;
      factors.push("hot");
    }

    // Factor 2: Overdue numbers get a boost (due for appearance)
    const overdueInfo = overdue.find((o) => o.number === n)!;
    if (overdueInfo.drawsSinceLastSeen > draws.length * 0.1) {
      const overdueScore = Math.min(overdueInfo.drawsSinceLastSeen / draws.length, 1) * 3;
      score += overdueScore;
      factors.push(`overdue (${overdueInfo.drawsSinceLastSeen} draws)`);
    }

    // Factor 3: Trending up gets a boost
    const trend = trending.find((t) => t.number === n);
    if (trend && trend.direction === "up") {
      score += 2 * Math.abs(trend.deviation);
      factors.push("trending up");
    }

    // Factor 4: Slight regression toward mean for very cold numbers
    if (hotCold.cold.includes(n)) {
      score += 1;
      factors.push("cold (regression to mean)");
    }

    scores.push({ number: n, score, factors });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Pick top 6
  const picked = scores.slice(0, 6).map((s) => s.number).sort((a, b) => a - b);

  // Generate reasoning
  const topFactors = scores.slice(0, 6);
  for (const s of topFactors) {
    if (s.factors.length > 0) {
      reasoning.push(`#${s.number}: ${s.factors.join(", ")} (score: ${s.score.toFixed(1)})`);
    }
  }

  // Re-sort scores by number for the full output
  const sortedScores = [...scores].sort((a, b) => a.number - b.number);

  return {
    numbers: picked as [number, number, number, number, number, number],
    scores: sortedScores,
    reasoning,
    warnings,
  };
}
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test src/analysis/recommend.test.ts
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat && git add apps/backend/src/analysis/ && git commit -m "feat: add number recommendation engine

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Analysis CLI commands

**Files:**
- Create: `apps/backend/src/analyze-cli.ts`
- Modify: `apps/backend/package.json` (add scripts)

**Step 1: Create the analysis CLI**

Create `apps/backend/src/analyze-cli.ts`:

```typescript
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { openDb, getAllDraws, getDrawCount } from "./db/index.js";
import { getNumberFrequencies, classifyHotCold, getOverdueNumbers } from "./analysis/frequency.js";
import { chiSquaredUniformityTest, oddEvenDistribution, highLowDistribution, groupDistribution } from "./analysis/distribution.js";
import { consecutiveAnalysis, sumRangeAnalysis, pairFrequency } from "./analysis/patterns.js";
import { trendingNumbers } from "./analysis/trends.js";
import { generatePicks } from "./analysis/recommend.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "..", "data", "toto.db");

function frequency(): void {
  const db = openDb(DB_PATH);
  try {
    const draws = getAllDraws(db);
    if (draws.length === 0) { console.log("No draws in database. Run ingest first."); return; }

    const freq = getNumberFrequencies(draws);
    const hotCold = classifyHotCold(freq);
    const overdue = getOverdueNumbers(draws);

    console.log(`\n=== Frequency Analysis (${draws.length} draws) ===\n`);
    console.log(`Expected frequency per number: ${hotCold.expectedFrequency.toFixed(1)}\n`);

    console.log("Top 10 most frequent:");
    const sorted = Object.entries(freq.main).sort(([, a], [, b]) => b - a).slice(0, 10);
    for (const [num, count] of sorted) {
      console.log(`  #${num.padStart(2)}: ${count} times`);
    }

    console.log(`\nHot numbers (${hotCold.hot.length}): ${hotCold.hot.join(", ") || "none"}`);
    console.log(`Cold numbers (${hotCold.cold.length}): ${hotCold.cold.join(", ") || "none"}`);

    console.log("\nTop 10 most overdue:");
    for (const o of overdue.slice(0, 10)) {
      console.log(`  #${String(o.number).padStart(2)}: ${o.drawsSinceLastSeen} draws since last seen`);
    }
  } finally {
    db.close();
  }
}

function bias(): void {
  const db = openDb(DB_PATH);
  try {
    const draws = getAllDraws(db);
    if (draws.length === 0) { console.log("No draws in database. Run ingest first."); return; }

    console.log(`\n=== Bias Report (${draws.length} draws) ===\n`);

    const chi2 = chiSquaredUniformityTest(draws);
    console.log("Chi-Squared Uniformity Test:");
    console.log(`  Statistic: ${chi2.statistic.toFixed(2)}`);
    console.log(`  Degrees of freedom: ${chi2.degreesOfFreedom}`);
    console.log(`  p-value: ${chi2.pValue.toFixed(4)}`);
    console.log(`  Significant (p < 0.05): ${chi2.isSignificant ? "YES — bias detected" : "NO — consistent with fair draws"}`);
    if (chi2.sampleSizeWarning) console.log("  ⚠ Sample size too small for reliable chi-squared test");

    const oe = oddEvenDistribution(draws);
    console.log(`\nOdd/Even: avg ${oe.averageOdd.toFixed(1)} odd / ${oe.averageEven.toFixed(1)} even per draw (expected: 3.0/3.0)`);

    const hl = highLowDistribution(draws);
    console.log(`High/Low: avg ${hl.averageHigh.toFixed(1)} high / ${hl.averageLow.toFixed(1)} low per draw (expected: ~3.1/2.9)`);

    const gd = groupDistribution(draws);
    console.log("\nGroup distribution:");
    for (const g of gd.groups) {
      const pct = ((g.count / gd.totalNumbers) * 100).toFixed(1);
      console.log(`  ${g.label}: ${g.count} (${pct}%, expected: ${g.expected.toFixed(0)})`);
    }
  } finally {
    db.close();
  }
}

function patterns(): void {
  const db = openDb(DB_PATH);
  try {
    const draws = getAllDraws(db);
    if (draws.length === 0) { console.log("No draws in database. Run ingest first."); return; }

    console.log(`\n=== Pattern Analysis (${draws.length} draws) ===\n`);

    const consec = consecutiveAnalysis(draws);
    console.log(`Consecutive numbers: ${consec.drawsWithConsecutive}/${consec.totalDraws} draws (${consec.percentage.toFixed(1)}%)`);

    const sums = sumRangeAnalysis(draws);
    console.log(`\nSum of 6 numbers: min=${sums.min}, max=${sums.max}, avg=${sums.average.toFixed(1)}`);

    const pairs = pairFrequency(draws, 10);
    console.log("\nTop 10 co-occurring pairs:");
    for (const p of pairs) {
      console.log(`  (${p.pair[0]}, ${p.pair[1]}): ${p.count} times`);
    }
  } finally {
    db.close();
  }
}

function trends(): void {
  const db = openDb(DB_PATH);
  try {
    const draws = getAllDraws(db);
    if (draws.length === 0) { console.log("No draws in database. Run ingest first."); return; }

    const windowSize = Math.min(20, Math.floor(draws.length / 2));
    console.log(`\n=== Trend Analysis (window: last ${windowSize} of ${draws.length} draws) ===\n`);

    const trending = trendingNumbers(draws, windowSize);
    const up = trending.filter((t) => t.direction === "up");
    const down = trending.filter((t) => t.direction === "down");

    console.log(`Trending UP (${up.length}):`);
    for (const t of up.slice(0, 10)) {
      console.log(`  #${String(t.number).padStart(2)}: ${(t.windowFrequency * 100).toFixed(0)}% recent vs ${(t.overallFrequency * 100).toFixed(0)}% overall (+${(t.deviation * 100).toFixed(0)}%)`);
    }

    console.log(`\nTrending DOWN (${down.length}):`);
    for (const t of down.slice(0, 10)) {
      console.log(`  #${String(t.number).padStart(2)}: ${(t.windowFrequency * 100).toFixed(0)}% recent vs ${(t.overallFrequency * 100).toFixed(0)}% overall (${(t.deviation * 100).toFixed(0)}%)`);
    }
  } finally {
    db.close();
  }
}

function recommend(): void {
  const db = openDb(DB_PATH);
  try {
    const draws = getAllDraws(db);
    if (draws.length === 0) { console.log("No draws in database. Run ingest first."); return; }

    const result = generatePicks(draws);

    console.log(`\n=== Recommended Numbers (based on ${draws.length} draws) ===\n`);

    if (result.warnings.length > 0) {
      for (const w of result.warnings) console.log(`⚠ ${w}`);
      console.log();
    }

    console.log(`Pick: ${result.numbers.join(", ")}\n`);

    console.log("Reasoning:");
    for (const r of result.reasoning) console.log(`  ${r}`);

    console.log("\nDisclaimer: These picks are based on historical pattern analysis.");
    console.log("Lottery draws are designed to be random. Past results do not guarantee future outcomes.");
  } finally {
    db.close();
  }
}

const [command] = process.argv.slice(2);

switch (command) {
  case "frequency": frequency(); break;
  case "bias": bias(); break;
  case "patterns": patterns(); break;
  case "trends": trends(); break;
  case "recommend": recommend(); break;
  default:
    console.log("Usage: tsx src/analyze-cli.ts <frequency|bias|patterns|trends|recommend>");
    process.exit(1);
}
```

**Step 2: Add scripts to package.json**

Add these scripts to `apps/backend/package.json`:

```json
"analyze:frequency": "tsx src/analyze-cli.ts frequency",
"analyze:bias": "tsx src/analyze-cli.ts bias",
"analyze:patterns": "tsx src/analyze-cli.ts patterns",
"analyze:trends": "tsx src/analyze-cli.ts trends",
"analyze:recommend": "tsx src/analyze-cli.ts recommend"
```

**Step 3: Run all tests to verify nothing is broken**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm test
```

Expected: all tests PASS.

**Step 4: Smoke test the CLI with existing data**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm analyze:frequency
cd /Users/huiliang/GitHub/toto-huat/apps/backend && pnpm analyze:recommend
```

Expected: Output with warnings about small sample size (only 5 draws in DB).

**Step 5: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat && git add apps/backend/src/analyze-cli.ts apps/backend/package.json && git commit -m "feat: add analysis CLI — frequency, bias, patterns, trends, recommend

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
