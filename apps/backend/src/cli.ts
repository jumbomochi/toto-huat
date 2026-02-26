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
