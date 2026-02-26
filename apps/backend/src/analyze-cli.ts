import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { DrawRecord } from "./db/index.js";
import { openDb, getAllDraws } from "./db/index.js";
import { getNumberFrequencies, classifyHotCold, getOverdueNumbers } from "./analysis/frequency.js";
import { chiSquaredUniformityTest, oddEvenDistribution, highLowDistribution, groupDistribution } from "./analysis/distribution.js";
import { consecutiveAnalysis, sumRangeAnalysis, pairFrequency } from "./analysis/patterns.js";
import { trendingNumbers } from "./analysis/trends.js";
import { generatePicks } from "./analysis/recommend.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "..", "data", "toto.db");

function frequency(draws: DrawRecord[]): void {
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
}

function bias(draws: DrawRecord[]): void {
  console.log(`\n=== Bias Report (${draws.length} draws) ===\n`);

  const chi2 = chiSquaredUniformityTest(draws);
  console.log("Chi-Squared Uniformity Test:");
  console.log(`  Statistic: ${chi2.statistic.toFixed(2)}`);
  console.log(`  Degrees of freedom: ${chi2.degreesOfFreedom}`);
  console.log(`  p-value: ${chi2.pValue.toFixed(4)}`);
  console.log(`  Significant (p < 0.05): ${chi2.isSignificant ? "YES — bias detected" : "NO — consistent with fair draws"}`);
  if (chi2.sampleSizeWarning) console.log("  Warning: Sample size too small for reliable chi-squared test");

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
}

function patterns(draws: DrawRecord[]): void {
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
}

function trends(draws: DrawRecord[]): void {
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
}

function recommend(draws: DrawRecord[]): void {
  const result = generatePicks(draws);

  console.log(`\n=== Recommended Numbers (based on ${draws.length} draws) ===\n`);

  if (result.warnings.length > 0) {
    for (const w of result.warnings) console.log(`Warning: ${w}`);
    console.log();
  }

  console.log(`Pick: ${result.numbers.join(", ")}\n`);

  console.log("Reasoning:");
  for (const r of result.reasoning) console.log(`  ${r}`);

  console.log("\nDisclaimer: These picks are based on historical pattern analysis.");
  console.log("Lottery draws are designed to be random. Past results do not guarantee future outcomes.");
}

const [command] = process.argv.slice(2);

if (!["frequency", "bias", "patterns", "trends", "recommend"].includes(command)) {
  console.log("Usage: tsx src/analyze-cli.ts <frequency|bias|patterns|trends|recommend>");
  process.exit(1);
}

const db = openDb(DB_PATH);
const draws = getAllDraws(db);
db.close();

if (draws.length === 0) {
  console.log("No draws in database. Run ingest first.");
  process.exit(0);
}

switch (command) {
  case "frequency": frequency(draws); break;
  case "bias": bias(draws); break;
  case "patterns": patterns(draws); break;
  case "trends": trends(draws); break;
  case "recommend": recommend(draws); break;
}
