import { Hono } from "hono";
import { cors } from "hono/cors";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { openDb, getAllDraws, getDrawCount } from "./db/index.js";
import { getNumberFrequencies, classifyHotCold, getOverdueNumbers } from "./analysis/frequency.js";
import { chiSquaredUniformityTest, oddEvenDistribution, highLowDistribution, groupDistribution } from "./analysis/distribution.js";
import { consecutiveAnalysis, sumRangeAnalysis, pairFrequency } from "./analysis/patterns.js";
import { trendingNumbers } from "./analysis/trends.js";
import { generatePicks } from "./analysis/recommend.js";
import type { DrawRecord } from "./db/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.TOTO_DB_PATH || resolve(__dirname, "..", "data", "toto.db");

// Draw 2995 (2014-10-09) is the first draw under the 6/49 format.
// Before this, the pool was 1-45. Mixing eras skews analysis for numbers 46-49.
const FIRST_6_OF_49_DRAW = 2995;

function withDraws<T>(fn: (draws: DrawRecord[]) => T): T {
  const db = openDb(DB_PATH);
  try {
    const draws = getAllDraws(db).filter((d) => d.drawNumber >= FIRST_6_OF_49_DRAW);
    return fn(draws);
  } finally {
    db.close();
  }
}

export const app = new Hono();

app.use("/api/*", cors({ origin: "*" }));

app.get("/api/frequency", (c) => {
  return c.json(withDraws((draws) => {
    const frequencies = getNumberFrequencies(draws);
    const hotCold = classifyHotCold(frequencies);
    const overdue = getOverdueNumbers(draws);
    return { frequencies, hotCold, overdue };
  }));
});

app.get("/api/distribution", (c) => {
  return c.json(withDraws((draws) => {
    const chiSquared = chiSquaredUniformityTest(draws);
    const oddEven = oddEvenDistribution(draws);
    const highLow = highLowDistribution(draws);
    const groups = groupDistribution(draws);
    return { chiSquared, oddEven, highLow, groups };
  }));
});

app.get("/api/patterns", (c) => {
  return c.json(withDraws((draws) => {
    const consecutive = consecutiveAnalysis(draws);
    const sumRange = sumRangeAnalysis(draws);
    const pairs = pairFrequency(draws, 10);
    return { consecutive, sumRange, pairs };
  }));
});

app.get("/api/trends", (c) => {
  const window = parseInt(c.req.query("window") || "20", 10);
  return c.json(withDraws((draws) => {
    const windowSize = Math.min(window, Math.floor(draws.length / 2));
    const trending = trendingNumbers(draws, windowSize);
    return { trending, windowSize };
  }));
});

app.get("/api/recommend", (c) => {
  return c.json(withDraws((draws) => generatePicks(draws)));
});

app.get("/api/draws", (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "20", 10)));

  // History page shows all draws, not just the 6/49 era
  const db = openDb(DB_PATH);
  try {
    const total = getDrawCount(db);
    const allDraws = getAllDraws(db);
    const start = (page - 1) * limit;
    const paginated = allDraws.reverse().slice(start, start + limit);
    return c.json({ draws: paginated, total, page, limit });
  } finally {
    db.close();
  }
});
