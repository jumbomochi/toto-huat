import type { DrawRecord } from "../db/index.js";

export interface BayesianEstimate {
  number: number;
  posteriorMean: number;
  credibleIntervalLow: number;
  credibleIntervalHigh: number;
  observedCount: number;
  deviationFromUniform: number;
}

export interface BayesianResult {
  estimates: BayesianEstimate[];
  topPicks: number[];
  totalDrawsUsed: number;
  windowSize: number | null;
}

const TOTAL_NUMBERS = 49;
const NUMBERS_PER_DRAW = 6;
const UNIFORM_PROB = 1 / TOTAL_NUMBERS;
const Z_95 = 1.96;

/**
 * Dirichlet-Multinomial conjugate model for Toto number probabilities.
 *
 * Prior: Dirichlet(alpha, ..., alpha) across 49 numbers.
 * Posterior alpha_i = priorAlpha + count_i.
 * Posterior mean for number i: alpha_i / S where S = sum of all alpha_i.
 * 95% credible interval: Normal approximation to Beta marginal.
 */
export function computeBayesianModel(
  draws: DrawRecord[],
  windowSize?: number,
  priorAlpha: number = 1.0,
): BayesianResult {
  const usedDraws = windowSize != null ? draws.slice(-windowSize) : draws;
  const totalDrawsUsed = usedDraws.length;

  // Count occurrences of each number
  const counts = new Array<number>(TOTAL_NUMBERS + 1).fill(0);
  for (const draw of usedDraws) {
    for (const n of draw.numbers) {
      counts[n]++;
    }
  }

  // S = sum of all posterior alpha values = 49 * priorAlpha + 6 * totalDrawsUsed
  const S = TOTAL_NUMBERS * priorAlpha + NUMBERS_PER_DRAW * totalDrawsUsed;

  const estimates: BayesianEstimate[] = [];
  for (let n = 1; n <= TOTAL_NUMBERS; n++) {
    const alpha_i = priorAlpha + counts[n];
    const beta_i = S - alpha_i;
    const posteriorMean = alpha_i / S;

    // Normal approximation to Beta(alpha_i, beta_i) marginal
    const variance = (alpha_i * beta_i) / (S * S * (S + 1));
    const stdDev = Math.sqrt(variance);
    const credibleIntervalLow = posteriorMean - Z_95 * stdDev;
    const credibleIntervalHigh = posteriorMean + Z_95 * stdDev;

    estimates.push({
      number: n,
      posteriorMean,
      credibleIntervalLow,
      credibleIntervalHigh,
      observedCount: counts[n],
      deviationFromUniform: posteriorMean - UNIFORM_PROB,
    });
  }

  // Sort by posteriorMean descending
  estimates.sort((a, b) => b.posteriorMean - a.posteriorMean);

  const topPicks = estimates.slice(0, 6).map((e) => e.number).sort((a, b) => a - b);

  return {
    estimates,
    topPicks,
    totalDrawsUsed,
    windowSize: windowSize ?? null,
  };
}
