"use client"

import { Smartphone, TabletSmartphone } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DeviceStatus, Platform, RunStatus, SignalBars } from "@/lib/types"

type Tone = "success" | "info" | "warning" | "danger" | "neutral"

const DOT: Record<Tone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground/50",
}

/** Quiet status label: a coloured dot carries the tone, the word carries the meaning. */
export function StatusPill({ tone, pulse, children, className }: { tone: Tone; pulse?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 text-xs font-medium whitespace-nowrap text-foreground/80", className)}>
      <span className="relative flex size-1.5">
        {pulse && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-70", DOT[tone])} />}
        <span className={cn("relative inline-flex size-1.5 rounded-full", DOT[tone])} />
      </span>
      {children}
    </span>
  )
}

const RUN: Record<RunStatus, [Tone, string]> = {
  queued: ["warning", "Queued"],
  running: ["info", "Running"],
  success: ["success", "Done"],
  failed: ["danger", "Failed"],
  timeout: ["warning", "Timeout"],
  cancelled: ["neutral", "Cancelled"],
}

export function RunStatusBadge({ status, awaiting }: { status: RunStatus; awaiting?: boolean }) {
  const [tone, label] = RUN[status]
  if (status === "running" && awaiting) return <StatusPill tone="success" pulse>Your turn</StatusPill>
  return <StatusPill tone={tone} pulse={status === "running"}>{label}</StatusPill>
}

const DEVICE: Record<DeviceStatus, [Tone, string]> = {
  online: ["success", "Online"],
  busy: ["info", "Busy"],
  offline: ["neutral", "Offline"],
}

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const [tone, label] = DEVICE[status]
  return <StatusPill tone={tone} pulse={status === "busy"}>{label}</StatusPill>
}

export function SignalMeter({ bars, className }: { bars: SignalBars; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`Signal ${bars} of 4`}
      className={cn("inline-flex h-3 items-end gap-[2px]", bars <= 1 ? "text-warning" : "text-foreground", className)}
    >
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={cn("w-[3px] rounded-full", i < bars ? "bg-current" : "bg-foreground/15")} style={{ height: 4 + i * 2.7 }} />
      ))}
    </span>
  )
}

export function BatteryIndicator({ level, charging }: { level: number; charging?: boolean }) {
  const low = level <= 20
  return (
    <span
      role="img"
      aria-label={`Battery ${level}%${charging ? ", charging" : ""}`}
      className={cn("inline-flex items-center gap-1.5 font-mono text-xs tabular", low ? "text-destructive" : "text-muted-foreground")}
    >
      <span className="relative h-[10px] w-[20px] rounded-[3px] border-[1.5px] border-current p-[1.5px] after:absolute after:top-[2px] after:-right-[4px] after:h-[3px] after:w-[2px] after:rounded-r-[1px] after:bg-current">
        <span
          className={cn("block h-full rounded-[1px]", low ? "bg-destructive" : charging ? "bg-brand" : "bg-foreground/70")}
          style={{ width: `${level}%` }}
        />
      </span>
      {level}%
    </span>
  )
}

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const Icon = platform === "ios" ? Smartphone : TabletSmartphone
  return <Icon className={className} aria-label={platform === "ios" ? "iOS" : "Android"} />
}

export function Code({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code className={cn("rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] font-medium whitespace-nowrap", className)}>
      {children}
    </code>
  )
}
