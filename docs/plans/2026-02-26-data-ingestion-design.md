# Data Ingestion Pipeline Design

## Overview

Pipeline to scrape Singapore Toto draw results from Singapore Pools and store them in SQLite. Supports both historical backfill (draws #1195–present, Jul 1997 onward) and ongoing scheduled ingestion of new draws.

## Data Source

Singapore Pools official draw results page.

URL pattern:
```
https://www.singaporepools.com.sg/en/product/sr/Pages/toto_results.aspx?sppl={base64('DrawNumber=XXXX')}
```

Each page contains: draw number, date, 6 winning numbers (1–49), 1 additional number, and Group 1–7 prize breakdown (winner count + prize amount per share).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data source | Singapore Pools direct scrape | Authoritative source, most complete history, full prize data |
| Storage | SQLite (better-sqlite3) | Zero infrastructure, sufficient for ~3000 rows growing ~100/year |
| Scheduler | GitHub Actions cron | Free, always-on, commits data back to repo |
| Backfill | CLI command using same scraper | One codebase, consistent parsing |

## Project Structure

```
apps/
  backend/
    src/
      scraper/        # HTML fetcher + parser
      db/             # SQLite schema + queries
      cli.ts          # CLI entry point
    data/
      toto.db         # SQLite database (gitignored)
    package.json
.github/
  workflows/
    ingest.yml        # Mon/Thu 9 PM SGT
```

## Database Schema

```sql
CREATE TABLE draws (
  draw_number INTEGER PRIMARY KEY,
  draw_date   TEXT NOT NULL,        -- ISO 8601 (YYYY-MM-DD)
  num1        INTEGER NOT NULL,
  num2        INTEGER NOT NULL,
  num3        INTEGER NOT NULL,
  num4        INTEGER NOT NULL,
  num5        INTEGER NOT NULL,
  num6        INTEGER NOT NULL,
  additional  INTEGER NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE prizes (
  draw_number INTEGER NOT NULL,
  group_num   INTEGER NOT NULL,     -- 1-7
  share_amount REAL,                -- prize per winner (nullable if no winners)
  winners     INTEGER NOT NULL,
  PRIMARY KEY (draw_number, group_num),
  FOREIGN KEY (draw_number) REFERENCES draws(draw_number)
);
```

## Scraper Logic

1. **Fetch** — HTTP GET to Singapore Pools with base64-encoded draw number
2. **Parse** — cheerio extracts winning numbers, date, prize table from HTML
3. **Store** — Upsert into SQLite (safe for re-runs)
4. **Rate limiting** — 1-second delay between requests during backfill

## CLI Commands

- `pnpm ingest:latest` — Fetch most recent draw(s) not yet in DB
- `pnpm ingest:backfill --from 1195 --to <latest>` — Scrape a range of historical draws
- `pnpm ingest:status` — Show DB stats (total draws, latest draw, gaps)

## GitHub Actions Workflow

Trigger: cron schedule Mon & Thu at 13:00 UTC (9 PM SGT).

Steps:
1. Checkout repo
2. Install dependencies
3. Run `pnpm ingest:latest`
4. If new data found, commit updated DB and push

## Error Handling

- Retry failed fetches up to 3 times with exponential backoff
- Skip draws that return no data (some early draw numbers have empty pages)
- Log warnings for draws with unexpected HTML structure
- `ingest:status` reports gaps in draw number sequence
