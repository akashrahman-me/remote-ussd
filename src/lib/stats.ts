import { runDuration } from "@/lib/ussd"
import type { Device, Run } from "@/lib/types"

const DAY = 86400_000

function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export interface Kpis {
  online: number
  total: number
  runsToday: number
  runsYesterday: number
  successRate: number
  successRatePrev: number
  failedToday: number
  avgResponse: number
  avgResponsePrev: number
  hourlyRuns: number[]
  hourlySuccess: number[]
  hourlyLatency: number[]
}

function rate(runs: Run[]) {
  const done = runs.filter((r) => r.status !== "running" && r.status !== "queued")
  if (!done.length) return 100
  return (done.filter((r) => r.status === "success").length / done.length) * 100
}

function avg(runs: Run[]) {
  const ok = runs.filter((r) => r.status === "success")
  if (!ok.length) return 0
  return ok.reduce((sum, r) => sum + runDuration(r), 0) / ok.length
}

export function computeKpis(devices: Device[], runs: Run[], now = Date.now()): Kpis {
  const today = startOfDay(now)
  const todays = runs.filter((r) => r.startedAt >= today)
  // Compare against the same stretch of yesterday (midnight → this time), not the whole day.
  const yesterdays = runs.filter((r) => r.startedAt >= today - DAY && r.startedAt < now - DAY)
  const last24 = runs.filter((r) => r.startedAt >= now - DAY)
  const buckets = Array.from({ length: 8 }, (_, i) => last24.filter((r) => {
    const b = Math.floor((now - r.startedAt) / (3 * 3600_000))
    return 7 - b === i
  }))
  const online = devices.filter((d) => d.status !== "offline").length
  return {
    online,
    total: devices.length,
    runsToday: todays.length,
    runsYesterday: yesterdays.length,
    successRate: rate(todays.length ? todays : last24),
    successRatePrev: rate(yesterdays),
    failedToday: todays.filter((r) => r.status === "failed" || r.status === "timeout").length,
    avgResponse: avg(todays.length ? todays : last24),
    avgResponsePrev: avg(yesterdays),
    hourlyRuns: buckets.map((b) => b.length),
    hourlySuccess: buckets.map((b) => rate(b)),
    hourlyLatency: buckets.map((b) => avg(b) || 0),
  }
}

export interface DayPoint {
  day: string
  completed: number
  failed: number
  timedOut: number
}

export function dailySeries(runs: Run[], days = 7, now = Date.now()): DayPoint[] {
  const today = startOfDay(now)
  return Array.from({ length: days }, (_, i) => {
    const start = today - (days - 1 - i) * DAY
    const inDay = runs.filter((r) => r.startedAt >= start && r.startedAt < start + DAY)
    return {
      day: new Date(start).toLocaleDateString("en-US", { weekday: "short" }),
      completed: inDay.filter((r) => r.status === "success").length,
      failed: inDay.filter((r) => r.status === "failed" || r.status === "cancelled").length,
      timedOut: inDay.filter((r) => r.status === "timeout").length,
    }
  })
}
