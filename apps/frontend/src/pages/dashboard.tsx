import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { NumberBall } from "@/components/number-ball"

export default function DashboardPage() {
  const { data: rec, isLoading: recLoading } = useQuery({
    queryKey: ["recommend"],
    queryFn: api.recommend,
  })
  const { data: freq, isLoading: freqLoading } = useQuery({
    queryKey: ["frequency"],
    queryFn: api.frequency,
  })
  const { data: dist, isLoading: distLoading } = useQuery({
    queryKey: ["distribution"],
    queryFn: api.distribution,
  })
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ["trends"],
    queryFn: () => api.trends(20),
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Recommended picks */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Numbers</CardTitle>
        </CardHeader>
        <CardContent>
          {recLoading ? (
            <div className="flex gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-14 rounded-full" />
              ))}
            </div>
          ) : rec ? (
            <>
              <div className="flex gap-3 mb-4">
                {rec.numbers.map((n) => (
                  <NumberBall key={n} number={n} variant="hot" size="lg" />
                ))}
              </div>
              {rec.warnings.length > 0 && (
                <p className="text-sm text-muted-foreground mb-2">{rec.warnings[0]}</p>
              )}
              <div className="space-y-1">
                {rec.reasoning.map((r, i) => (
                  <p key={i} className="text-sm text-muted-foreground">{r}</p>
                ))}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Draws</p>
            {freqLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (
              <p className="text-2xl font-bold">{freq?.frequencies.totalDraws.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Bias Detected</p>
            {distLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (
              <Badge variant={dist?.chiSquared.isSignificant ? "destructive" : "secondary"}>
                {dist?.chiSquared.isSignificant ? "Yes" : "No"}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Hot Numbers</p>
            {freqLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (
              <p className="text-2xl font-bold">{freq?.hotCold.hot.length}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Trending Up</p>
            {trendsLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (
              <p className="text-2xl font-bold">
                {trends?.trending.filter((t) => t.direction === "up").length}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hot & Cold numbers */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hot Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            {freqLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {freq?.hotCold.hot.map((n) => (
                  <NumberBall key={n} number={n} variant="hot" size="sm" />
                ))}
                {freq?.hotCold.hot.length === 0 && (
                  <p className="text-sm text-muted-foreground">None</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Most Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            {freqLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="space-y-2">
                {freq?.overdue.slice(0, 5).map((o) => (
                  <div key={o.number} className="flex items-center justify-between">
                    <NumberBall number={o.number} variant="cold" size="sm" />
                    <span className="text-sm text-muted-foreground">
                      {o.drawsSinceLastSeen} draws ago
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
