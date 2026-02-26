const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  frequency: () => fetchJSON<FrequencyResponse>("/api/frequency"),
  distribution: () => fetchJSON<DistributionResponse>("/api/distribution"),
  patterns: () => fetchJSON<PatternsResponse>("/api/patterns"),
  trends: (windowSize = 20) => fetchJSON<TrendsResponse>(`/api/trends?window=${windowSize}`),
  recommend: () => fetchJSON<RecommendResponse>("/api/recommend"),
  draws: (page = 1, limit = 20) => fetchJSON<DrawsResponse>(`/api/draws?page=${page}&limit=${limit}`),
  bayesian: (window?: number, alpha?: number) => {
    const params = new URLSearchParams();
    if (window != null) params.set("window", String(window));
    if (alpha != null) params.set("alpha", String(alpha));
    const qs = params.toString();
    return fetchJSON<BayesianResponse>(`/api/bayesian${qs ? `?${qs}` : ""}`);
  },
  backtest: (window?: number, minTrain?: number, summaryOnly = false) => {
    const params = new URLSearchParams();
    if (window != null) params.set("window", String(window));
    if (minTrain != null) params.set("minTrain", String(minTrain));
    if (summaryOnly) params.set("summary", "true");
    const qs = params.toString();
    return fetchJSON<BacktestResponse>(`/api/backtest${qs ? `?${qs}` : ""}`);
  },
};

// Response types matching backend API
export interface FrequencyResponse {
  frequencies: { main: Record<string, number>; additional: Record<string, number>; totalDraws: number };
  hotCold: { hot: number[]; cold: number[]; neutral: number[]; expectedFrequency: number };
  overdue: { number: number; lastSeenDraw: number | null; drawsSinceLastSeen: number }[];
}

export interface DistributionResponse {
  chiSquared: { statistic: number; pValue: number; degreesOfFreedom: number; isSignificant: boolean; sampleSizeWarning: boolean };
  oddEven: { averageOdd: number; averageEven: number };
  highLow: { averageHigh: number; averageLow: number };
  groups: { groups: { label: string; range: [number, number]; count: number; expected: number }[]; totalNumbers: number };
}

export interface PatternsResponse {
  consecutive: { drawsWithConsecutive: number; totalDraws: number; percentage: number };
  sumRange: { min: number; max: number; average: number };
  pairs: { pair: [number, number]; count: number }[];
}

export interface TrendsResponse {
  trending: { number: number; direction: "up" | "down"; windowFrequency: number; overallFrequency: number; deviation: number }[];
  windowSize: number;
}

export interface RecommendResponse {
  numbers: [number, number, number, number, number, number];
  scores: { number: number; score: number; factors: string[] }[];
  reasoning: string[];
  warnings: string[];
}

export interface DrawsResponse {
  draws: { drawNumber: number; drawDate: string; numbers: [number, number, number, number, number, number]; additional: number }[];
  total: number;
  page: number;
  limit: number;
}

export interface BayesianEstimate {
  number: number;
  posteriorMean: number;
  credibleIntervalLow: number;
  credibleIntervalHigh: number;
  observedCount: number;
  deviationFromUniform: number;
}

export interface BayesianResponse {
  estimates: BayesianEstimate[];
  topPicks: number[];
  totalDrawsUsed: number;
  windowSize: number | null;
}

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

export interface BacktestResponse {
  summary: BacktestSummary;
  steps?: BacktestStep[];
}
