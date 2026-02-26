import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { NumberGrid } from "@/components/number-grid"
import { NumberBall } from "@/components/number-ball"

export default function FrequencyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["frequency"],
    queryFn: api.frequency,
  })

  if (isLoading) return <FrequencySkeleton />
  if (!data) return null

  const maxFreq = Math.max(...Object.values(data.frequencies.main))

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Frequency Explorer</h2>

      <Card>
        <CardHeader>
          <CardTitle>Number Frequency Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <NumberGrid
            frequencies={data.frequencies.main}
            hotNumbers={data.hotCold.hot}
            coldNumbers={data.hotCold.cold}
            maxFrequency={maxFreq}
          />
          <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-amber-600" /> Hot
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-blue-600" /> Cold
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-zinc-500" /> Neutral
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hot Numbers ({data.hotCold.hot.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.hotCold.hot.map((n) => (
                <NumberBall key={n} number={n} variant="hot" size="sm" />
              ))}
              {data.hotCold.hot.length === 0 && (
                <p className="text-sm text-muted-foreground">None at current threshold</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cold Numbers ({data.hotCold.cold.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.hotCold.cold.map((n) => (
                <NumberBall key={n} number={n} variant="cold" size="sm" />
              ))}
              {data.hotCold.cold.length === 0 && (
                <p className="text-sm text-muted-foreground">None at current threshold</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Most Overdue Numbers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.overdue.slice(0, 15).map((o) => (
              <div key={o.number} className="flex items-center gap-4">
                <NumberBall number={o.number} variant="cold" size="sm" />
                <div className="flex-1">
                  <div
                    className="h-2 rounded bg-blue-600/60"
                    style={{ width: `${Math.min(100, (o.drawsSinceLastSeen / 50) * 100)}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-24 text-right">
                  {o.drawsSinceLastSeen} draws
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FrequencySkeleton() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Frequency Explorer</h2>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
