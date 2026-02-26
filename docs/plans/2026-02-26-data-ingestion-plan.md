# Data Ingestion Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a pipeline that scrapes Singapore Toto draw results from Singapore Pools and stores them in SQLite, with CLI commands for backfill and ongoing ingestion, and a GitHub Actions cron for automation.

**Architecture:** A Node.js/TypeScript CLI app in `apps/backend/` that fetches draw result HTML pages from Singapore Pools, parses them with cheerio, and upserts into a local SQLite database via better-sqlite3. GitHub Actions runs the ingestion on a schedule.

**Tech Stack:** TypeScript, tsx (runner), cheerio (HTML parsing), better-sqlite3 (SQLite), vitest (testing)

---

## Reference: Singapore Pools HTML Structure

Each draw page URL: `https://www.singaporepools.com.sg/en/product/sr/Pages/toto_results.aspx?sppl={base64('DrawNumber=XXXX')}`

The page returns pre-generated HTML with these CSS selectors:
- `.drawDate` — e.g. `"Mon, 23 Feb 2026"`
- `.drawNumber` — e.g. `"Draw No. 4159"`
- `.win1` through `.win6` — winning numbers
- `.additional` — additional number
- `.jackpotPrize` — Group 1 prize (e.g. `"$1,787,436"`)
- `.tableWinningShares` — table with rows for Groups 1-7, columns: Prize Group, Share Amount, No. of Winning Shares

Latest draw page also available at: `https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_result_top_draws_en.html`

Data range: Draw #1194 (Jul 3, 1997) through present (#4159 as of Feb 2026). Draws below #1194 have corrupted dates ("01 Jan 0001") but may still have valid numbers. Draws below ~#1050 redirect to the latest draw.

---

### Task 1: Scaffold backend app

**Files:**
- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `.gitignore`

**Step 1: Create directory structure**

```bash
mkdir -p apps/backend/src/scraper apps/backend/src/db apps/backend/data
```

**Step 2: Create package.json**

```bash
cd apps/backend
pnpm init
```

Then edit `apps/backend/package.json`:

```json
{
  "name": "@toto-huat/backend",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "ingest:latest": "tsx src/cli.ts latest",
    "ingest:backfill": "tsx src/cli.ts backfill",
    "ingest:status": "tsx src/cli.ts status",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 3: Install dependencies**

```bash
cd apps/backend
pnpm add cheerio better-sqlite3
pnpm add -D typescript tsx vitest @types/better-sqlite3
```

**Step 4: Create tsconfig.json**

Create `apps/backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

**Step 5: Create .gitignore at repo root**

```
node_modules/
dist/
apps/backend/data/toto.db
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold backend app with dependencies"
```

---

### Task 2: Database layer

**Files:**
- Create: `apps/backend/src/db/schema.ts`
- Create: `apps/backend/src/db/index.ts`
- Test: `apps/backend/src/db/index.test.ts`

**Step 1: Write the failing test**

Create `apps/backend/src/db/index.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initDb, upsertDraw, upsertPrizes, getLatestDrawNumber, getDrawCount, getGaps } from "./index.js";

describe("database", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initDb(db);
  });

  afterEach(() => {
    db.close();
  });

  it("creates tables", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual(["draws", "prizes"]);
  });

  it("upserts a draw", () => {
    upsertDraw(db, {
      drawNumber: 4159,
      drawDate: "2026-02-23",
      numbers: [24, 26, 30, 32, 37, 47],
      additional: 2,
    });

    const row = db.prepare("SELECT * FROM draws WHERE draw_number = 4159").get() as any;
    expect(row.num1).toBe(24);
    expect(row.additional).toBe(2);
    expect(row.draw_date).toBe("2026-02-23");
  });

  it("upserts prizes for a draw", () => {
    upsertDraw(db, {
      drawNumber: 4159,
      drawDate: "2026-02-23",
      numbers: [24, 26, 30, 32, 37, 47],
      additional: 2,
    });

    upsertPrizes(db, 4159, [
      { group: 1, shareAmount: 893718, winners: 2 },
      { group: 2, shareAmount: 188152, winners: 2 },
      { group: 3, shareAmount: 2562, winners: 101 },
    ]);

    const rows = db.prepare("SELECT * FROM prizes WHERE draw_number = 4159").all() as any[];
    expect(rows).toHaveLength(3);
    expect(rows[0].share_amount).toBe(893718);
  });

  it("handles upsert on duplicate draw", () => {
    const draw = {
      drawNumber: 4159,
      drawDate: "2026-02-23",
      numbers: [24, 26, 30, 32, 37, 47] as [number, number, number, number, number, number],
      additional: 2,
    };
    upsertDraw(db, draw);
    upsertDraw(db, draw); // should not throw
    expect(getDrawCount(db)).toBe(1);
  });

  it("returns latest draw number", () => {
    expect(getLatestDrawNumber(db)).toBeNull();
    upsertDraw(db, {
      drawNumber: 4158,
      drawDate: "2026-02-19",
      numbers: [8, 16, 17, 34, 38, 48],
      additional: 25,
    });
    upsertDraw(db, {
      drawNumber: 4159,
      drawDate: "2026-02-23",
      numbers: [24, 26, 30, 32, 37, 47],
      additional: 2,
    });
    expect(getLatestDrawNumber(db)).toBe(4159);
  });

  it("finds gaps in draw sequence", () => {
    upsertDraw(db, { drawNumber: 100, drawDate: "2000-01-01", numbers: [1,2,3,4,5,6], additional: 7 });
    upsertDraw(db, { drawNumber: 102, drawDate: "2000-01-08", numbers: [1,2,3,4,5,6], additional: 7 });
    upsertDraw(db, { drawNumber: 105, drawDate: "2000-01-22", numbers: [1,2,3,4,5,6], additional: 7 });
    expect(getGaps(db)).toEqual([101, 103, 104]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/backend && pnpm test
```

Expected: FAIL — modules don't exist yet.

**Step 3: Implement database layer**

Create `apps/backend/src/db/schema.ts`:

```typescript
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS draws (
  draw_number INTEGER PRIMARY KEY,
  draw_date   TEXT NOT NULL,
  num1        INTEGER NOT NULL,
  num2        INTEGER NOT NULL,
  num3        INTEGER NOT NULL,
  num4        INTEGER NOT NULL,
  num5        INTEGER NOT NULL,
  num6        INTEGER NOT NULL,
  additional  INTEGER NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prizes (
  draw_number INTEGER NOT NULL,
  group_num   INTEGER NOT NULL,
  share_amount REAL,
  winners     INTEGER NOT NULL,
  PRIMARY KEY (draw_number, group_num),
  FOREIGN KEY (draw_number) REFERENCES draws(draw_number)
);
`;
```

Create `apps/backend/src/db/index.ts`:

```typescript
import Database from "better-sqlite3";
import { SCHEMA } from "./schema.js";

export interface DrawInput {
  drawNumber: number;
  drawDate: string;
  numbers: [number, number, number, number, number, number];
  additional: number;
}

export interface PrizeInput {
  group: number;
  shareAmount: number | null;
  winners: number;
}

export function initDb(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
}

export function upsertDraw(db: Database.Database, draw: DrawInput): void {
  db.prepare(`
    INSERT INTO draws (draw_number, draw_date, num1, num2, num3, num4, num5, num6, additional)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(draw_number) DO UPDATE SET
      draw_date = excluded.draw_date,
      num1 = excluded.num1, num2 = excluded.num2, num3 = excluded.num3,
      num4 = excluded.num4, num5 = excluded.num5, num6 = excluded.num6,
      additional = excluded.additional
  `).run(
    draw.drawNumber,
    draw.drawDate,
    ...draw.numbers,
    draw.additional,
  );
}

export function upsertPrizes(db: Database.Database, drawNumber: number, prizes: PrizeInput[]): void {
  const stmt = db.prepare(`
    INSERT INTO prizes (draw_number, group_num, share_amount, winners)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(draw_number, group_num) DO UPDATE SET
      share_amount = excluded.share_amount,
      winners = excluded.winners
  `);

  const tx = db.transaction((items: PrizeInput[]) => {
    for (const p of items) {
      stmt.run(drawNumber, p.group, p.shareAmount, p.winners);
    }
  });
  tx(prizes);
}

export function getLatestDrawNumber(db: Database.Database): number | null {
  const row = db.prepare("SELECT MAX(draw_number) as latest FROM draws").get() as { latest: number | null };
  return row.latest;
}

export function getDrawCount(db: Database.Database): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM draws").get() as { count: number };
  return row.count;
}

export function getGaps(db: Database.Database): number[] {
  const rows = db.prepare("SELECT draw_number FROM draws ORDER BY draw_number").all() as { draw_number: number }[];
  if (rows.length < 2) return [];

  const gaps: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    for (let n = rows[i - 1].draw_number + 1; n < rows[i].draw_number; n++) {
      gaps.push(n);
    }
  }
  return gaps;
}

export function openDb(path: string): Database.Database {
  const db = new Database(path);
  initDb(db);
  return db;
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/backend && pnpm test
```

Expected: all 5 tests PASS.

**Step 5: Commit**

```bash
git add apps/backend/src/db/
git commit -m "feat: add SQLite database layer with schema and queries"
```

---

### Task 3: HTML parser

**Files:**
- Create: `apps/backend/src/scraper/parser.ts`
- Test: `apps/backend/src/scraper/parser.test.ts`
- Create: `apps/backend/src/scraper/fixtures/draw-4159.html` (test fixture)

**Step 1: Create test fixture**

Save a real draw page as a test fixture. Fetch draw 4159 HTML and save the relevant `<li>` content to `apps/backend/src/scraper/fixtures/draw-4159.html`. The fixture should contain the HTML from `<div class='tables-wrap'>` through the closing `</div>` for that draw.

The fixture content (abbreviated for the plan — use the full HTML in implementation):

```html
<div class='tables-wrap'>
  <table class='table table-striped orange-header'>
    <thead><tr>
      <th width='50%' class='drawDate'>Mon, 23 Feb 2026</th>
      <th width='50%' class='drawNumber'>Draw No. 4159</th>
    </tr></thead>
  </table>
  <table class='table table-striped'>
    <thead><tr><th colspan='6'>Winning Numbers</th></tr></thead>
    <tbody><tr>
      <td width='16%' class='win1'>24</td>
      <td width='16%' class='win2'>26</td>
      <td width='16%' class='win3'>30</td>
      <td width='16%' class='win4'>32</td>
      <td width='16%' class='win5'>37</td>
      <td width='16%' class='win6'>47</td>
    </tr></tbody>
  </table>
  <table class='table table-striped'>
    <thead><tr><th>Additional Number</th></tr></thead>
    <tbody><tr><td class='additional'>2</td></tr></tbody>
  </table>
  <table class='table table-striped jackpotPrizeTable'>
    <thead><tr><th>Group 1 Prize</th></tr></thead>
    <tbody><tr><td class='jackpotPrize'>$1,787,436</td></tr></tbody>
  </table>
  <table class='table table-striped tableWinningShares'>
    <thead><tr><th colspan='3' align='center'>Winning Shares</th></tr></thead>
    <tbody>
      <tr><th>Prize Group</th><th>Share Amount</th><th>No. of Winning Shares</th></tr>
      <tr><td align='center'>Group 1</td><td align='center'>$893,718</td><td align='center'>2</td></tr>
      <tr><td align='center'>Group 2</td><td align='center'>$188,152</td><td align='center'>2</td></tr>
      <tr><td align='center'>Group 3</td><td align='center'>$2,562</td><td align='center'>101</td></tr>
      <tr><td align='center'>Group 4</td><td align='center'>$453</td><td align='center'>312</td></tr>
      <tr><td align='center'>Group 5</td><td align='center'>$50</td><td align='center'>6,204</td></tr>
      <tr><td align='center'>Group 6</td><td align='center'>$25</td><td align='center'>9,583</td></tr>
      <tr><td align='center'>Group 7</td><td align='center'>$10</td><td align='center'>122,832</td></tr>
    </tbody>
  </table>
</div>
```

**Step 2: Write the failing test**

Create `apps/backend/src/scraper/parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseDrawHtml } from "./parser.js";

const fixture = readFileSync(
  join(import.meta.dirname, "fixtures", "draw-4159.html"),
  "utf-8",
);

describe("parseDrawHtml", () => {
  it("parses draw number", () => {
    const result = parseDrawHtml(fixture);
    expect(result.drawNumber).toBe(4159);
  });

  it("parses draw date to ISO format", () => {
    const result = parseDrawHtml(fixture);
    expect(result.drawDate).toBe("2026-02-23");
  });

  it("parses 6 winning numbers", () => {
    const result = parseDrawHtml(fixture);
    expect(result.numbers).toEqual([24, 26, 30, 32, 37, 47]);
  });

  it("parses additional number", () => {
    const result = parseDrawHtml(fixture);
    expect(result.additional).toBe(2);
  });

  it("parses 7 prize groups", () => {
    const result = parseDrawHtml(fixture);
    expect(result.prizes).toHaveLength(7);
    expect(result.prizes[0]).toEqual({ group: 1, shareAmount: 893718, winners: 2 });
    expect(result.prizes[4]).toEqual({ group: 5, shareAmount: 50, winners: 6204 });
    expect(result.prizes[6]).toEqual({ group: 7, shareAmount: 10, winners: 122832 });
  });

  it("returns null for invalid/empty HTML", () => {
    expect(parseDrawHtml("<html></html>")).toBeNull();
    expect(parseDrawHtml("")).toBeNull();
  });

  it("handles draw with bogus date (pre-1194 draws)", () => {
    const html = fixture.replace("Mon, 23 Feb 2026", "Mon, 01 Jan 0001");
    const result = parseDrawHtml(html);
    expect(result).toBeNull();
  });
});
```

**Step 3: Run test to verify it fails**

```bash
cd apps/backend && pnpm test src/scraper/parser.test.ts
```

Expected: FAIL — `parser.ts` doesn't exist.

**Step 4: Implement parser**

Create `apps/backend/src/scraper/parser.ts`:

```typescript
import * as cheerio from "cheerio";
import type { DrawInput, PrizeInput } from "../db/index.js";

export interface ParsedDraw {
  drawNumber: number;
  drawDate: string;
  numbers: [number, number, number, number, number, number];
  additional: number;
  prizes: PrizeInput[];
}

function parseDate(raw: string): string | null {
  // Input: "Mon, 23 Feb 2026" -> "2026-02-23"
  const cleaned = raw.replace(/^[A-Za-z]+,\s*/, ""); // strip day name
  const date = new Date(cleaned);
  if (isNaN(date.getTime()) || date.getFullYear() < 1968) return null;
  return date.toISOString().split("T")[0];
}

function parseCurrency(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function parseIntComma(raw: string): number {
  return parseInt(raw.replace(/,/g, ""), 10);
}

export function parseDrawHtml(html: string): ParsedDraw | null {
  if (!html || !html.trim()) return null;

  const $ = cheerio.load(html);

  // Draw number
  const drawNumText = $(".drawNumber").first().text().trim();
  const drawNumMatch = drawNumText.match(/(\d+)/);
  if (!drawNumMatch) return null;
  const drawNumber = parseInt(drawNumMatch[1], 10);

  // Draw date
  const drawDateText = $(".drawDate").first().text().trim();
  const drawDate = parseDate(drawDateText);
  if (!drawDate) return null;

  // Winning numbers
  const numbers: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const num = parseInt($(`.win${i}`).first().text().trim(), 10);
    if (isNaN(num)) return null;
    numbers.push(num);
  }

  // Additional number
  const additional = parseInt($(".additional").first().text().trim(), 10);
  if (isNaN(additional)) return null;

  // Prize table
  const prizes: PrizeInput[] = [];
  $(".tableWinningShares tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return; // skip header row

    const groupText = $(cells[0]).text().trim();
    const groupMatch = groupText.match(/(\d+)/);
    if (!groupMatch) return;

    prizes.push({
      group: parseInt(groupMatch[1], 10),
      shareAmount: parseCurrency($(cells[1]).text().trim()),
      winners: parseIntComma($(cells[2]).text().trim()),
    });
  });

  return {
    drawNumber,
    drawDate,
    numbers: numbers as [number, number, number, number, number, number],
    additional,
    prizes,
  };
}
```

**Step 5: Run test to verify it passes**

```bash
cd apps/backend && pnpm test src/scraper/parser.test.ts
```

Expected: all 7 tests PASS.

**Step 6: Commit**

```bash
git add apps/backend/src/scraper/
git commit -m "feat: add HTML parser for Singapore Pools draw results"
```

---

### Task 4: Fetcher with retry logic

**Files:**
- Create: `apps/backend/src/scraper/fetcher.ts`
- Test: `apps/backend/src/scraper/fetcher.test.ts`

**Step 1: Write the failing test**

Create `apps/backend/src/scraper/fetcher.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildDrawUrl, encodeDrawNumber } from "./fetcher.js";

describe("fetcher utilities", () => {
  it("encodes draw number to base64", () => {
    expect(encodeDrawNumber(4159)).toBe("RHJhd051bWJlcj00MTU5");
  });

  it("encodes draw number 1195", () => {
    expect(encodeDrawNumber(1195)).toBe("RHJhd051bWJlcj0xMTk1");
  });

  it("builds correct URL", () => {
    const url = buildDrawUrl(4159);
    expect(url).toBe(
      "https://www.singaporepools.com.sg/en/product/sr/Pages/toto_results.aspx?sppl=RHJhd051bWJlcj00MTU5"
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/backend && pnpm test src/scraper/fetcher.test.ts
```

Expected: FAIL.

**Step 3: Implement fetcher**

Create `apps/backend/src/scraper/fetcher.ts`:

```typescript
const BASE_URL = "https://www.singaporepools.com.sg/en/product/sr/Pages/toto_results.aspx";
const TOP_DRAWS_URL = "https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_result_top_draws_en.html";

export function encodeDrawNumber(drawNumber: number): string {
  return Buffer.from(`DrawNumber=${drawNumber}`).toString("base64");
}

export function buildDrawUrl(drawNumber: number): string {
  return `${BASE_URL}?sppl=${encodeDrawNumber(drawNumber)}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchDrawHtml(
  drawNumber: number,
  retries = 3,
): Promise<string> {
  const url = buildDrawUrl(drawNumber);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      console.warn(`Fetch draw ${drawNumber} attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw new Error("unreachable");
}

export async function fetchTopDrawsHtml(): Promise<string> {
  const res = await fetch(TOP_DRAWS_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching top draws`);
  return await res.text();
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/backend && pnpm test src/scraper/fetcher.test.ts
```

Expected: all 3 tests PASS.

**Step 5: Commit**

```bash
git add apps/backend/src/scraper/fetcher.ts apps/backend/src/scraper/fetcher.test.ts
git commit -m "feat: add draw page fetcher with retry and URL encoding"
```

---

### Task 5: CLI commands

**Files:**
- Create: `apps/backend/src/cli.ts`

**Step 1: Implement CLI**

Create `apps/backend/src/cli.ts`:

```typescript
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { openDb, upsertDraw, upsertPrizes, getLatestDrawNumber, getDrawCount, getGaps } from "./db/index.js";
import { fetchDrawHtml, fetchTopDrawsHtml } from "./scraper/fetcher.js";
import { parseDrawHtml } from "./scraper/parser.js";
import * as cheerio from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "..", "data", "toto.db");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ingestDraw(db: ReturnType<typeof openDb>, drawNumber: number): Promise<boolean> {
  const html = await fetchDrawHtml(drawNumber);
  const parsed = parseDrawHtml(html);
  if (!parsed) {
    console.warn(`Draw ${drawNumber}: no valid data, skipping`);
    return false;
  }
  upsertDraw(db, {
    drawNumber: parsed.drawNumber,
    drawDate: parsed.drawDate,
    numbers: parsed.numbers,
    additional: parsed.additional,
  });
  if (parsed.prizes.length > 0) {
    upsertPrizes(db, parsed.drawNumber, parsed.prizes);
  }
  console.log(`Draw ${parsed.drawNumber} (${parsed.drawDate}): ${parsed.numbers.join(", ")} + ${parsed.additional}`);
  return true;
}

async function latest(): Promise<void> {
  const db = openDb(DB_PATH);
  try {
    // Get the latest draw number from top draws page
    const topHtml = await fetchTopDrawsHtml();
    const $ = cheerio.load(topHtml);
    const latestOnSite = parseInt($(".drawNumber").first().text().replace(/\D/g, ""), 10);

    if (isNaN(latestOnSite)) {
      console.error("Could not determine latest draw number from Singapore Pools");
      process.exit(1);
    }

    const latestInDb = getLatestDrawNumber(db);
    const startFrom = latestInDb ? latestInDb + 1 : latestOnSite;

    if (startFrom > latestOnSite) {
      console.log(`Database is up to date (latest: ${latestInDb})`);
      return;
    }

    console.log(`Fetching draws ${startFrom} to ${latestOnSite}...`);
    let count = 0;
    for (let n = startFrom; n <= latestOnSite; n++) {
      if (await ingestDraw(db, n)) count++;
      if (n < latestOnSite) await sleep(1000);
    }
    console.log(`Ingested ${count} new draw(s)`);
  } finally {
    db.close();
  }
}

async function backfill(from: number, to: number): Promise<void> {
  const db = openDb(DB_PATH);
  try {
    console.log(`Backfilling draws ${from} to ${to}...`);
    let count = 0;
    let skipped = 0;
    for (let n = from; n <= to; n++) {
      try {
        if (await ingestDraw(db, n)) {
          count++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`Draw ${n}: fetch failed — ${err}`);
        skipped++;
      }
      if (n < to) await sleep(1000);
    }
    console.log(`Backfill complete: ${count} ingested, ${skipped} skipped`);
  } finally {
    db.close();
  }
}

function status(): void {
  const db = openDb(DB_PATH);
  try {
    const count = getDrawCount(db);
    const latest = getLatestDrawNumber(db);
    const gaps = getGaps(db);

    console.log(`Total draws: ${count}`);
    console.log(`Latest draw: ${latest ?? "none"}`);
    if (gaps.length > 0) {
      console.log(`Gaps (${gaps.length}): ${gaps.slice(0, 20).join(", ")}${gaps.length > 20 ? "..." : ""}`);
    } else if (count > 0) {
      console.log("No gaps in sequence");
    }
  } finally {
    db.close();
  }
}

// --- Main ---
const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "latest":
    await latest();
    break;
  case "backfill": {
    let from = 1194;
    let to = 4159;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--from" && args[i + 1]) from = parseInt(args[i + 1], 10);
      if (args[i] === "--to" && args[i + 1]) to = parseInt(args[i + 1], 10);
    }
    await backfill(from, to);
    break;
  }
  case "status":
    status();
    break;
  default:
    console.log("Usage: tsx src/cli.ts <latest|backfill|status>");
    console.log("  latest                    Fetch newest draws not in DB");
    console.log("  backfill [--from N --to N] Scrape historical draw range");
    console.log("  status                    Show DB stats");
    process.exit(1);
}
```

**Step 2: Manually test the CLI**

```bash
cd apps/backend && pnpm ingest:status
```

Expected: "Total draws: 0", "Latest draw: none"

```bash
cd apps/backend && pnpm ingest:latest
```

Expected: Fetches the latest draw(s) from Singapore Pools and prints the results.

**Step 3: Commit**

```bash
git add apps/backend/src/cli.ts
git commit -m "feat: add CLI for ingest:latest, ingest:backfill, ingest:status"
```

---

### Task 6: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/ingest.yml`

**Step 1: Create workflow**

Create `.github/workflows/ingest.yml`:

```yaml
name: Ingest Toto Results

on:
  schedule:
    # Mon & Thu at 13:00 UTC = 9 PM SGT
    - cron: "0 13 * * 1,4"
  workflow_dispatch: # allow manual trigger

permissions:
  contents: write

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: apps/backend/pnpm-lock.yaml

      - name: Install dependencies
        working-directory: apps/backend
        run: pnpm install --frozen-lockfile

      - name: Run ingestion
        working-directory: apps/backend
        run: pnpm ingest:latest

      - name: Commit new data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          if git diff --quiet apps/backend/data/; then
            echo "No new data"
          else
            git add apps/backend/data/toto.db
            git commit -m "data: ingest latest toto results"
            git push
          fi
```

**Step 2: Commit**

```bash
git add .github/workflows/ingest.yml
git commit -m "feat: add GitHub Actions cron for scheduled ingestion"
```

---

### Task 7: End-to-end smoke test

**Step 1: Run the full pipeline locally**

```bash
cd apps/backend
pnpm ingest:latest
pnpm ingest:status
```

Expected: Shows 1+ draws ingested, status shows the latest draw number with no gaps.

**Step 2: Test backfill with a small range**

```bash
cd apps/backend
pnpm ingest:backfill --from 4155 --to 4159
pnpm ingest:status
```

Expected: Shows 5 draws, latest is 4159, no gaps.

**Step 3: Final commit and push**

```bash
git push origin main
```
