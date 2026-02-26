import type { DrawRecord } from "../db/index.js";
import { getNumberFrequencies, classifyHotCold, getOverdueNumbers } from "./frequency.js";
import { trendingNumbers } from "./trends.js";
import { computeBayesianModel } from "./bayesian.js";

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

  const bayesian = computeBayesianModel(draws, 200);
  const bayesianMap = new Map(bayesian.estimates.map((e) => [e.number, e]));

  const hotSet = new Set(hotCold.hot);
  const coldSet = new Set(hotCold.cold);
  const overdueMap = new Map(overdue.map((o) => [o.number, o]));
  const trendingMap = new Map(trending.map((t) => [t.number, t]));

  const scores: NumberScore[] = [];
  for (let n = 1; n <= 49; n++) {
    let score = 0;
    const factors: string[] = [];

    if (hotSet.has(n)) {
      score += 2;
      factors.push("hot");
    }

    const overdueInfo = overdueMap.get(n);
    if (overdueInfo && overdueInfo.drawsSinceLastSeen > draws.length * 0.1) {
      const overdueScore = Math.min(overdueInfo.drawsSinceLastSeen / draws.length, 1) * 3;
      score += overdueScore;
      factors.push(`overdue (${overdueInfo.drawsSinceLastSeen} draws)`);
    }

    const trend = trendingMap.get(n);
    if (trend && trend.direction === "up") {
      score += 2 * Math.abs(trend.deviation);
      factors.push("trending up");
    }

    if (coldSet.has(n)) {
      score += 1;
      factors.push("cold (regression to mean)");
    }

    // Bayesian factor
    const bayesianEstimate = bayesianMap.get(n);
    if (bayesianEstimate) {
      const bayesianScore = Math.min(bayesianEstimate.deviationFromUniform * 400, 3);
      if (bayesianScore > 0) {
        score += bayesianScore;
        factors.push("bayesian");
      }
    }

    scores.push({ number: n, score, factors });
  }

  scores.sort((a, b) => b.score - a.score);
  const picked = scores.slice(0, 6).map((s) => s.number).sort((a, b) => a - b);

  for (const s of scores.slice(0, 6)) {
    if (s.factors.length > 0) {
      reasoning.push(`#${s.number}: ${s.factors.join(", ")} (score: ${s.score.toFixed(1)})`);
    }
  }

  scores.sort((a, b) => a.number - b.number);

  return {
    numbers: picked as [number, number, number, number, number, number],
    scores,
    reasoning,
    warnings,
  };
}
