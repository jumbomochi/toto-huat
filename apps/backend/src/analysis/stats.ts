/**
 * Compute chi-squared test statistic: sum of (O-E)^2 / E
 */
export function chiSquaredStatistic(observed: number[], expected: number[]): number {
  let sum = 0;
  for (let i = 0; i < observed.length; i++) {
    const diff = observed[i] - expected[i];
    sum += (diff * diff) / expected[i];
  }
  return sum;
}

/**
 * Approximate p-value for chi-squared distribution using the regularized
 * incomplete gamma function.
 *
 * P(X > x) = 1 - gammainc(df/2, x/2)
 */
export function chiSquaredPValue(statistic: number, df: number): number {
  const a = df / 2;
  const x = statistic / 2;
  return 1 - regularizedGammaLower(a, x);
}

function regularizedGammaLower(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;
  if (x < a + 1) {
    return gammaIncSeries(a, x);
  } else {
    return 1 - gammaIncCF(a, x);
  }
}

function gammaIncSeries(a: number, x: number): number {
  const lnGammaA = lnGamma(a);
  let sum = 1 / a;
  let term = 1 / a;
  for (let n = 1; n < 200; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-10) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGammaA);
}

function gammaIncCF(a: number, x: number): number {
  const lnGammaA = lnGamma(a);
  let f = x + 1 - a;
  let c = 1e30;
  let d = 1 / f;
  let h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    const bn = x + 2 * i + 1 - a;
    d = bn + an * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = bn + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGammaA) * h;
}

function lnGamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Standard z-score: (observed - expected) / stdDev
 */
export function zScore(observed: number, expected: number, stdDev: number): number {
  return (observed - expected) / stdDev;
}
