"use client"

import Link from "next/link"
import { BatteryIndicator, DeviceStatusBadge, PlatformIcon, SignalMeter } from "@/components/app/status"
import { Card } from "@/components/ui/card"
import { useNow } from "@/hooks/use-now"
import { relative } from "@/lib/format"
import type { Device } from "@/lib/types"
import { cn } from "@/lib/utils"

interface DeviceCardProps {
  device: Device
  selected?: boolean
  onSelect?: () => void
  href?: string
  className?: string
}

export function DeviceCard({ device, selected, onSelect, href, className }: DeviceCardProps) {
  const now = useNow(5000)
  const offline = device.status === "offline"
  const interactive = !!onSelect && !offline
  const [name, place] = device.name.split(" · ")

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            selected ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <PlatformIcon platform={device.platform} className="size-[18px]" />
        </span>
        <DeviceStatusBadge status={device.status} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{place ?? device.model}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {device.sims.map((s) => (
          <div key={s.slot} className={cn("flex items-center gap-2 text-xs", !s.enabled && "opacity-40")}>
            <span className="font-mono text-muted-foreground">{s.slot}</span>
            <span className="min-w-0 flex-1 truncate">{s.label || s.carrier}</span>
            <SignalMeter bars={s.signal} />
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between pt-1 text-xs text-muted-foreground">
        <BatteryIndicator level={device.battery} charging={device.charging} />
        <span className="font-mono tabular">{relative(device.lastSeenAt, now)}</span>
      </div>
    </>
  )

  const classes = cn(
    "h-full gap-3 p-4 transition-[box-shadow,border-color,opacity]",
    interactive && "cursor-pointer hover:border-foreground/20",
    selected && "border-brand ring-2 ring-brand/40 hover:border-brand",
    offline && "opacity-60",
    className,
  )

  if (href) {
    return (
      <Link href={href} className="block h-full rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Card className={cn(classes, "hover:border-foreground/20")}>{body}</Card>
      </Link>
    )
  }
  return (
    <Card
      className={classes}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? !!selected : undefined}
      aria-label={interactive ? `Target ${device.name}` : undefined}
      onClick={interactive ? onSelect : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onSelect?.()
              }
            }
          : undefined
      }
    >
      {body}
    </Card>
  )
}
