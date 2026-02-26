import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { BayesianEstimate } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { NumberBall } from "@/components/number-ball"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from "recharts"

const WINDOW_OPTIONS = [
  { label: "All", value: undefined },
  { label: "200", value: 200 },
  { label: "100", value: 100 },
  { label: "50", value: 50 },
] as const

const UNIFORM = 1 / 49

const tooltipStyle = {
  contentStyle: { backgroundColor: "#27272a", border: "1px solid #3f3f46", borderRadius: "8px" },
  labelStyle: { color: "#fafafa" },
  itemStyle: { color: "#a1a1aa" },
}

export default function BayesianPage() {
  const [windowSize, setWindowSize] = useState<number | undefined>(200)

  const { data: bayesian, isLoading: bayesianLoading, isError: bayesianError } = useQuery({
    queryKey: ["bayesian", windowSize],
    queryFn: () => api.bayesian(windowSize),
  })

  const { data: backtest, isLoading: backtestLoading, isError: backtestError } = useQuery({
    queryKey: ["backtest", windowSize],
    queryFn: () => api.backtest(windowSize, 100),
  })

  const chartData = bayesian?.estimates
    .slice()
    .sort((a: BayesianEstimate, b: BayesianEstimate) => a.number - b.number)
    .map((e: BayesianEstimate) => ({
      number: e.number,
      probability: e.posteriorMean,
      deviation: e.deviationFromUniform,
    }))

  const hitsDistData = backtest?.summary
    ? Object.entries(backtest.summary.hitsDistribution).map(([hits, count]) => ({
        hits: `${hits} hits`,
        count,
      }))
    : []

  const cumulativeData = backtest?.steps?.map((s, i) => ({
    index: i,
    drawNumber: s.drawNumber,
    hitRate: s.cumulativeHitRate,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Bayesian Model</h2>
        <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-1">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setWindowSize(opt.value)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                windowSize === opt.value
                  ? "bg-zinc-700 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {bayesianError && <p className="text-sm text-destructive">Failed to load Bayesian model data.</p>}

      {/* Top Picks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 6 Bayesian Picks</CardTitle>
        </CardHeader>
        <CardContent>
          {bayesianLoading ? <Skeleton className="h-14 w-full" /> : bayesian ? (
            <div className="flex flex-wrap gap-3">
              {bayesian.topPicks.map((n) => (
                <NumberBall key={n} number={n} variant="hot" size="lg" />
              ))}
              <span className="self-center text-sm text-muted-foreground ml-4">
                Based on {bayesian.totalDrawsUsed} draws
                {bayesian.windowSize ? ` (last ${bayesian.windowSize})` : " (all)"}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Posterior Probability Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Posterior Probabilities (1–49)</CardTitle>
        </CardHeader>
        <CardContent>
          {bayesianLoading ? <Skeleton className="h-64 w-full" /> : chartData ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <XAxis dataKey="number" stroke="#a1a1aa" fontSize={10} interval={3} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickFormatter={(v: number) => (v * 100).toFixed(1) + "%"} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: any) => [((value as number) * 100).toFixed(3) + "%", "Probability"]}
                  labelFormatter={(label: any) => `Number ${label}`}
                />
                <ReferenceLine y={UNIFORM} stroke="#71717a" strokeDasharray="3 3" label={{ value: "1/49", fill: "#71717a", fontSize: 11 }} />
                <Bar dataKey="probability" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.number}
                      fill={entry.deviation > 0 ? "#f59e0b" : "#3b82f6"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : null}
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-amber-500" /> Above uniform
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-blue-500" /> Below uniform
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-8 border-t-2 border-dashed border-zinc-500" /> 1/49 baseline
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Backtest Performance */}
      {backtestError && <p className="text-sm text-destructive">Failed to load backtest data.</p>}

      {backtest?.summary && (
        <>
          <h3 className="text-xl font-bold">Backtest Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Avg Hits / Draw</p>
                {backtestLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
                  <p className="text-2xl font-bold">{backtest.summary.averageHitsPerDraw.toFixed(3)}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Baseline</p>
                {backtestLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
                  <p className="text-2xl font-bold">{backtest.summary.baselineHitsPerDraw.toFixed(3)}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Improvement</p>
                {backtestLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
                  <p className={`text-2xl font-bold ${backtest.summary.improvementOverBaseline > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {backtest.summary.improvementOverBaseline > 0 ? "+" : ""}
                    {backtest.summary.improvementOverBaseline.toFixed(2)}%
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">p-value</p>
                {backtestLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
                  <p className={`text-2xl font-bold ${backtest.summary.pValue < 0.05 ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {backtest.summary.pValue.toFixed(4)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Hits Distribution */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Hits Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {backtestLoading ? <Skeleton className="h-48 w-full" /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={hitsDistData}>
                      <XAxis dataKey="hits" stroke="#a1a1aa" fontSize={12} />
                      <YAxis stroke="#a1a1aa" fontSize={12} />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="count" name="Draws" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Cumulative Hit Rate */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cumulative Hit Rate</CardTitle>
              </CardHeader>
              <CardContent>
                {backtestLoading ? <Skeleton className="h-48 w-full" /> : cumulativeData ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={cumulativeData}>
                      <XAxis dataKey="index" stroke="#a1a1aa" fontSize={12} tick={false} />
                      <YAxis stroke="#a1a1aa" fontSize={11} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(2)} />
                      <Tooltip
                        {...tooltipStyle}
                        labelFormatter={(i: any) => cumulativeData[i as number] ? `Draw ${cumulativeData[i as number].drawNumber}` : ""}
                        formatter={(value: any) => [(value as number).toFixed(4), "Hit Rate"]}
                      />
                      <ReferenceLine y={UNIFORM * 6} stroke="#71717a" strokeDasharray="3 3" label={{ value: "Baseline", fill: "#71717a", fontSize: 11 }} />
                      <Line type="monotone" dataKey="hitRate" stroke="#f59e0b" dot={false} strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <p className="text-sm text-muted-foreground">
            Backtest: walk-forward validation over {backtest.summary.totalDrawsPredicted} draws.
            z-score = {backtest.summary.zScore.toFixed(3)}.
            {backtest.summary.pValue > 0.05
              ? " Not statistically significant — model does not reliably beat random."
              : " Statistically significant result."}
          </p>
        </>
      )}

      {/* Estimates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All 49 Estimates</CardTitle>
        </CardHeader>
        <CardContent>
          {bayesianLoading ? <Skeleton className="h-64 w-full" /> : bayesian ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 pr-4">#</th>
                    <th className="text-right py-2 px-4">Posterior</th>
                    <th className="text-right py-2 px-4">95% CI</th>
                    <th className="text-right py-2 px-4">Deviation</th>
                    <th className="text-right py-2 pl-4">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {bayesian.estimates.map((e) => (
                    <tr key={e.number} className="border-b border-border/50">
                      <td className="py-1.5 pr-4">
                        <NumberBall number={e.number} size="sm" variant={e.deviationFromUniform > 0 ? "hot" : "cold"} />
                      </td>
                      <td className="text-right py-1.5 px-4 font-mono">{(e.posteriorMean * 100).toFixed(3)}%</td>
                      <td className="text-right py-1.5 px-4 font-mono text-muted-foreground">
                        {(e.credibleIntervalLow * 100).toFixed(2)}–{(e.credibleIntervalHigh * 100).toFixed(2)}%
                      </td>
                      <td className={`text-right py-1.5 px-4 font-mono ${e.deviationFromUniform > 0 ? "text-amber-400" : "text-blue-400"}`}>
                        {e.deviationFromUniform > 0 ? "+" : ""}{(e.deviationFromUniform * 100).toFixed(3)}%
                      </td>
                      <td className="text-right py-1.5 pl-4 font-mono">{e.observedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
