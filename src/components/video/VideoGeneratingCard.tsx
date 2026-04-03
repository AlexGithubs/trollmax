"use client"

import { Card, CardContent } from "@/components/ui/card"

const BARS = 12

export function VideoGeneratingCard({
  progressStep,
  progressPct,
  progressDetail,
  lastError,
}: {
  progressStep?: string | null
  progressPct?: number | null
  progressDetail?: string | null
  lastError?: string | null
}) {
  const pct = typeof progressPct === "number" ? Math.max(0, Math.min(100, progressPct)) : null

  return (
    <Card className="border-border/60 bg-card/50">
      <CardContent className="pt-8 pb-8 flex flex-col items-center gap-5">
        <div className="flex items-end gap-1 h-8">
          {Array.from({ length: BARS }, (_, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-primary/70"
              style={{
                animation: "waveBar 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.1}s`,
                height: "4px",
              }}
            />
          ))}
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">
            {lastError ? "Generation failed" : progressStep || "Generating…"}
          </p>
          {progressDetail && !lastError && (
            <p className="text-xs text-muted-foreground">{progressDetail}</p>
          )}
          {pct != null && !lastError && (
            <p className="text-xs text-muted-foreground">{pct}%</p>
          )}
          {lastError && (
            <p className="text-xs text-destructive">{lastError}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
