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
  winners: number | null;
}

export function initDb(db: Database.Database): void {
  db.pragma("journal_mode = WAL");

  // Migrate: recreate prizes table if winners column is NOT NULL (old schema)
  const col = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='prizes'").get() as { sql: string } | undefined;
  if (col?.sql?.includes("winners     INTEGER NOT NULL")) {
    db.exec("DROP TABLE prizes");
  }

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

export function openDb(path: string): Database.Database {
  const db = new Database(path);
  // In Lambda the DB comes pre-built from S3 — skip WAL mode and migrations
  // to avoid creating -wal/-shm files in /tmp
  if (!process.env.LAMBDA_TASK_ROOT) {
    initDb(db);
  }
  return db;
}
