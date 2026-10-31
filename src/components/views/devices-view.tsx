"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Plus, Search, Smartphone } from "lucide-react"
import { DeviceCard } from "@/components/app/device-card"
import { PageHeader } from "@/components/app/page-header"
import { PairDeviceDialog } from "@/components/app/pair-device-dialog"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { DeviceStatus, Platform } from "@/lib/types"
import { useAppStore } from "@/store/app-store"

type StatusFilter = "all" | DeviceStatus

export function DevicesView() {
  const devices = useAppStore((s) => s.devices)
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [platform, setPlatform] = useState<"all" | Platform>("all")
  const pairOpen = params.get("pair") === "1"
  const setPairOpen = (open: boolean) => router.replace(open ? `${pathname}?pair=1` : pathname, { scroll: false })

  const counts = useMemo(
    () => ({
      all: devices.length,
      online: devices.filter((d) => d.status === "online").length,
      busy: devices.filter((d) => d.status === "busy").length,
      offline: devices.filter((d) => d.status === "offline").length,
    }),
    [devices],
  )

  const filtered = devices.filter((d) => {
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || [d.name, d.model, d.osVersion, ...d.sims.flatMap((s) => [s.carrier, s.number, s.label ?? ""])].some((v) => v.toLowerCase().includes(q))
    return matchesQuery && (status === "all" || d.status === status) && (platform === "all" || d.platform === platform)
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Devices"
        description={`${counts.online + counts.busy} of ${counts.all} phones reachable. Each runs the Relay Agent and exposes its SIM slots.`}
        actions={<Button onClick={() => setPairOpen(true)}><Plus /> Pair device</Button>}
      />

      <div className="flex flex-col gap-3 @3xl/main:flex-row @3xl/main:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, carrier or number" className="pl-9" aria-label="Search devices" />
        </div>
        <div className="flex gap-2">
          <ToggleGroup type="single" variant="outline" value={status} onValueChange={(v) => v && setStatus(v as StatusFilter)} className="flex-1 overflow-x-auto scrollbar-none">
            {(["all", "online", "busy", "offline"] as const).map((s) => (
              <ToggleGroupItem key={s} value={s} className="gap-1.5 px-3 capitalize">
                {s === "busy" ? "In session" : s}
                <span className="font-mono text-xs text-muted-foreground tabular">{counts[s]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={platform} onValueChange={(v) => setPlatform(v as "all" | Platform)}>
            <SelectTrigger className="w-36" aria-label="Platform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              <SelectItem value="android">Android</SelectItem>
              <SelectItem value="ios">iOS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3 @7xl/main:grid-cols-4">
          {filtered.map((d) => (
            <DeviceCard key={d.id} device={d} href={`/devices/${d.id}`} />
          ))}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Smartphone /></EmptyMedia>
            <EmptyTitle>{devices.length ? "No devices match" : "No devices yet"}</EmptyTitle>
            <EmptyDescription>{devices.length ? "Try another search or filter." : "Pair a phone running the Relay Agent to start dialing remotely."}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {devices.length ? (
              <Button variant="outline" onClick={() => { setQuery(""); setStatus("all"); setPlatform("all") }}>Clear filters</Button>
            ) : (
              <Button onClick={() => setPairOpen(true)}><Plus /> Pair device</Button>
            )}
          </EmptyContent>
        </Empty>
      )}

      <PairDeviceDialog open={pairOpen} onOpenChange={setPairOpen} />
    </div>
  )
}
