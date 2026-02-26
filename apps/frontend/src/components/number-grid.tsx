import { useMemo } from "react"
import { cn } from "@/lib/utils"

interface NumberGridProps {
  frequencies: Record<string, number>
  hotNumbers: number[]
  coldNumbers: number[]
  maxFrequency: number
}

export function NumberGrid({ frequencies, hotNumbers, coldNumbers, maxFrequency }: NumberGridProps) {
  const hotSet = useMemo(() => new Set(hotNumbers), [hotNumbers])
  const coldSet = useMemo(() => new Set(coldNumbers), [coldNumbers])

  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 49 }, (_, i) => i + 1).map((n) => {
        const count = frequencies[String(n)] || 0
        const intensity = maxFrequency > 0 ? count / maxFrequency : 0
        const isHot = hotSet.has(n)
        const isCold = coldSet.has(n)

        return (
          <div
            key={n}
            className={cn(
              "aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-colors",
              isHot && "bg-amber-600/80 text-white",
              isCold && "bg-blue-600/80 text-white",
              !isHot && !isCold && "text-zinc-300",
            )}
            style={
              !isHot && !isCold
                ? { backgroundColor: `rgba(161, 161, 170, ${0.1 + intensity * 0.5})` }
                : undefined
            }
          >
            <span className="font-bold">{n}</span>
            <span className="text-[10px] opacity-75">{count}</span>
          </div>
        )
      })}
    </div>
  )
}
