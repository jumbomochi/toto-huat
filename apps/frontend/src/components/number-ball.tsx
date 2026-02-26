import { cn } from "@/lib/utils"

interface NumberBallProps {
  number: number
  variant?: "default" | "hot" | "cold" | "additional"
  size?: "sm" | "md" | "lg"
}

export function NumberBall({ number, variant = "default", size = "md" }: NumberBallProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold",
        size === "sm" && "h-8 w-8 text-xs",
        size === "md" && "h-10 w-10 text-sm",
        size === "lg" && "h-14 w-14 text-lg",
        variant === "default" && "bg-zinc-700 text-zinc-100",
        variant === "hot" && "bg-amber-600 text-white",
        variant === "cold" && "bg-blue-600 text-white",
        variant === "additional" && "bg-emerald-600 text-white",
      )}
    >
      {number}
    </span>
  )
}
