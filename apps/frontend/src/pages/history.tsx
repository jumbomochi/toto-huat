import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { NumberBall } from "@/components/number-ball"

export default function HistoryPage() {
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ["draws", page],
    queryFn: () => api.draws(page, limit),
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Draw History</h2>
        {data && (
          <p className="text-sm text-muted-foreground">{data.total.toLocaleString()} total draws</p>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {data?.draws.map((draw) => (
                <div
                  key={draw.drawNumber}
                  className="flex items-center gap-4 py-2 border-b border-border last:border-0"
                >
                  <div className="w-16 text-sm font-mono text-muted-foreground">
                    #{draw.drawNumber}
                  </div>
                  <div className="w-24 text-sm text-muted-foreground">
                    {draw.drawDate}
                  </div>
                  <div className="flex gap-1.5 flex-1">
                    {draw.numbers.map((n, i) => (
                      <NumberBall key={i} number={n} size="sm" />
                    ))}
                    <span className="mx-1 text-muted-foreground">+</span>
                    <NumberBall number={draw.additional} variant="additional" size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
