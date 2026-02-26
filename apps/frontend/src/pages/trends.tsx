import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { NumberBall } from "@/components/number-ball"

export default function TrendsPage() {
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ["trends"],
    queryFn: () => api.trends(20),
  })
  const { data: patterns, isLoading: patternsLoading } = useQuery({
    queryKey: ["patterns"],
    queryFn: api.patterns,
  })
  const { data: dist, isLoading: distLoading } = useQuery({
    queryKey: ["distribution"],
    queryFn: api.distribution,
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Trends & Patterns</h2>

      {/* Trending numbers */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trending Up</CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-2">
                {trends?.trending
                  .filter((t) => t.direction === "up")
                  .slice(0, 10)
                  .map((t) => (
                    <div key={t.number} className="flex items-center gap-3">
                      <NumberBall number={t.number} variant="hot" size="sm" />
                      <div className="flex-1 text-sm">
                        <span className="text-muted-foreground">
                          {(t.windowFrequency * 100).toFixed(0)}% recent vs{" "}
                          {(t.overallFrequency * 100).toFixed(0)}% overall
                        </span>
                      </div>
                      <Badge variant="secondary">+{(t.deviation * 100).toFixed(0)}%</Badge>
                    </div>
                  ))}
                {trends?.trending.filter((t) => t.direction === "up").length === 0 && (
                  <p className="text-sm text-muted-foreground">No numbers trending up</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trending Down</CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-2">
                {trends?.trending
                  .filter((t) => t.direction === "down")
                  .slice(0, 10)
                  .map((t) => (
                    <div key={t.number} className="flex items-center gap-3">
                      <NumberBall number={t.number} variant="cold" size="sm" />
                      <div className="flex-1 text-sm">
                        <span className="text-muted-foreground">
                          {(t.windowFrequency * 100).toFixed(0)}% recent vs{" "}
                          {(t.overallFrequency * 100).toFixed(0)}% overall
                        </span>
                      </div>
                      <Badge variant="outline">{(t.deviation * 100).toFixed(0)}%</Badge>
                    </div>
                  ))}
                {trends?.trending.filter((t) => t.direction === "down").length === 0 && (
                  <p className="text-sm text-muted-foreground">No numbers trending down</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Group distribution chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Number Group Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {distLoading ? <Skeleton className="h-48 w-full" /> : dist ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dist.groups.groups}>
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#27272a", border: "1px solid #3f3f46", borderRadius: "8px" }}
                  labelStyle={{ color: "#fafafa" }}
                  itemStyle={{ color: "#a1a1aa" }}
                />
                <Bar dataKey="count" name="Actual" radius={[4, 4, 0, 0]}>
                  {dist.groups.groups.map((_, i) => (
                    <Cell key={i} fill="#f59e0b" />
                  ))}
                </Bar>
                <Bar dataKey="expected" name="Expected" fill="#3f3f46" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </CardContent>
      </Card>

      {/* Pattern stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Draws with Consecutive Numbers</p>
            {patternsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
              <p className="text-2xl font-bold">{patterns?.consecutive.percentage.toFixed(1)}%</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Average Sum of 6 Numbers</p>
            {patternsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
              <p className="text-2xl font-bold">{patterns?.sumRange.average.toFixed(0)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sum Range</p>
            {patternsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
              <p className="text-2xl font-bold">{patterns?.sumRange.min} — {patterns?.sumRange.max}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top pairs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Co-occurring Pairs</CardTitle>
        </CardHeader>
        <CardContent>
          {patternsLoading ? <Skeleton className="h-32 w-full" /> : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {patterns?.pairs.map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-3">
                  <NumberBall number={p.pair[0]} size="sm" />
                  <NumberBall number={p.pair[1]} size="sm" />
                  <span className="text-sm text-muted-foreground ml-auto">{p.count}x</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
