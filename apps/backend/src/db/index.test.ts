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
    upsertDraw(db, draw);
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
