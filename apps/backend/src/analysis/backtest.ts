import type { DrawRecord } from "../db/index.js";
import { computeBayesianModel } from "./bayesian.js";
import { normalCDF } from "./stats.js";

export interface BacktestStep {
  drawNumber: number;
  predicted: number[];
  actual: number[];
  hits: number;
  cumulativeHitRate: number;
}

export interface BacktestSummary {
  totalDrawsPredicted: number;
  totalHits: number;
  averageHitsPerDraw: number;
  baselineHitsPerDraw: number;
  improvementOverBaseline: number;
  hitsDistribution: Record<number, number>;
  zScore: number;
  pValue: number;
}

export interface BacktestResult {
  summary: BacktestSummary;
  steps: BacktestStep[];
}

const NUMBERS_PER_DRAW = 6;
const TOTAL_NUMBERS = 49;
// Expected hits per draw when picking 6 from 49: 6*6/49
const BASELINE_HITS = (NUMBERS_PER_DRAW * NUMBERS_PER_DRAW) / TOTAL_NUMBERS;

/**
 * Walk-forward backtesting of the Bayesian model.
 *
 * For each draw from minTrainingDraws to the end:
 * 1. Train on draws [max(0, t - windowSize) .. t-1]
 * 2. Predict top 6 from the Bayesian model
 * 3. Count how many of the predicted numbers match the actual draw
 */
export function runBacktest(
  draws: DrawRecord[],
  params: {
    trainingWindowSize?: number;
    minTrainingDraws?: number;
    priorAlpha?: number;
  } = {},
): BacktestResult {
  const { trainingWindowSize, minTrainingDraws = 100, priorAlpha = 1.0 } = params;

  const steps: BacktestStep[] = [];
  let totalHits = 0;
  const hitsDistribution: Record<number, number> = {};
  for (let h = 0; h <= NUMBERS_PER_DRAW; h++) {
    hitsDistribution[h] = 0;
  }

  for (let t = minTrainingDraws; t < draws.length; t++) {
    // Training slice
    const start = trainingWindowSize != null ? Math.max(0, t - trainingWindowSize) : 0;
    const trainingSlice = draws.slice(start, t);

    // Predict
    const model = computeBayesianModel(trainingSlice, undefined, priorAlpha);
    const predicted = model.topPicks;

    // Evaluate
    const actualSet = new Set(draws[t].numbers);
    const hits = predicted.filter((n) => actualSet.has(n)).length;

    totalHits += hits;
    hitsDistribution[hits]++;

    const cumulativeHitRate = totalHits / (steps.length + 1);

    steps.push({
      drawNumber: draws[t].drawNumber,
      predicted,
      actual: [...draws[t].numbers],
      hits,
      cumulativeHitRate,
    });
  }

  const totalDrawsPredicted = steps.length;
  const averageHitsPerDraw = totalDrawsPredicted > 0 ? totalHits / totalDrawsPredicted : 0;

  // Z-test: is our hit rate significantly different from baseline?
  // Each draw has hypergeometric hits, but with large N we approximate:
  // Var(hits per draw) ≈ k*K*(N-K)*(N-k) / (N^2*(N-1))
  // where N=49, K=6 (actual), k=6 (predicted)
  const N = TOTAL_NUMBERS;
  const K = NUMBERS_PER_DRAW;
  const k = NUMBERS_PER_DRAW;
  const variancePerDraw = (k * K * (N - K) * (N - k)) / (N * N * (N - 1));
  const stdErr = totalDrawsPredicted > 0 ? Math.sqrt(variancePerDraw / totalDrawsPredicted) : 1;
  const z = totalDrawsPredicted > 0 ? (averageHitsPerDraw - BASELINE_HITS) / stdErr : 0;
  // Two-tailed p-value
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  const improvementOverBaseline =
    BASELINE_HITS > 0 ? ((averageHitsPerDraw - BASELINE_HITS) / BASELINE_HITS) * 100 : 0;

  return {
    summary: {
      totalDrawsPredicted,
      totalHits,
      averageHitsPerDraw,
      baselineHitsPerDraw: BASELINE_HITS,
      improvementOverBaseline,
      hitsDistribution,
      zScore: z,
      pValue,
    },
    steps,
  };
}
