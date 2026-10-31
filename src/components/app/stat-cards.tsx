"use client"

import { useMemo } from "react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useNow } from "@/hooks/use-now"
import { number } from "@/lib/format"
import { computeKpis } from "@/lib/stats"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"

function Spark({ id, points, color }: { id: string; points: number[]; color: string }) {
  if (points.length < 2) return <div className="h-10" />
  const min = Math.min(...points)
  const span = Math.max(...points) - min || 1
  const xy = points.map((v, i) => [(i / (points.length - 1)) * 100, 36 - ((v - min) / span) * 30] as const)
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-10 w-full overflow-visible" style={{ color }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity={0.25} />
          <stop offset="1" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L100 40 L0 40 Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

interface Stat {
  id: string
  label: string
  value: string
  unit?: string
  delta?: string
  up?: boolean
  good?: boolean
  spark: number[]
  color: string
}

export function StatCards() {
  const devices = useAppStore((s) => s.devices)
  const runs = useAppStore((s) => s.runs)
  const now = useNow(30_000)
  const k = useMemo(() => computeKpis(devices, runs, now), [devices, runs, now])

  const runDelta = k.runsYesterday ? ((k.runsToday - k.runsYesterday) / k.runsYesterday) * 100 : 0
  const rateDelta = k.successRate - k.successRatePrev
  const latDelta = k.avgResponse - k.avgResponsePrev

  const stats: Stat[] = [
    { id: "online", label: "Online", value: String(k.online), unit: `/${k.total}`, color: "var(--chart-3)", spark: devices.map((d) => (d.status === "offline" ? 0 : d.battery)) },
    { id: "runs", label: "Runs today", value: number(k.runsToday), delta: k.runsYesterday ? `${Math.abs(runDelta).toFixed(0)}%` : undefined, up: runDelta >= 0, good: true, spark: k.hourlyRuns, color: "var(--chart-1)" },
    { id: "rate", label: "Success", value: k.successRate.toFixed(1), unit: "%", delta: k.runsYesterday ? Math.abs(rateDelta).toFixed(1) : undefined, up: rateDelta >= 0, good: rateDelta >= 0, spark: k.hourlySuccess, color: "var(--chart-1)" },
    { id: "lat", label: "Avg reply", value: k.avgResponse.toFixed(1), unit: "s", delta: k.avgResponsePrev ? `${Math.abs(latDelta).toFixed(1)}s` : undefined, up: latDelta > 0, good: latDelta <= 0, spark: k.hourlyLatency, color: "var(--chart-2)" },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 @3xl/main:grid-cols-4 @3xl/main:gap-4">
      {stats.map((s) => (
        <Card key={s.id} size="sm" className="gap-1 overflow-hidden pb-0">
          <div className="flex items-center justify-between px-4">
            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            {s.delta && (
              <span className={cn("inline-flex items-center font-mono text-[11px] font-medium tabular", s.good ? "text-success" : "text-destructive")}>
                {s.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {s.delta}
              </span>
            )}
          </div>
          <div className="px-4 text-3xl font-semibold tracking-tight tabular">
            {s.value}
            {s.unit && <span className="ml-0.5 text-base font-medium tracking-normal text-muted-foreground">{s.unit}</span>}
          </div>
          <Spark id={`spark-${s.id}`} points={s.spark} color={s.color} />
        </Card>
      ))}
    </div>
  )
}
