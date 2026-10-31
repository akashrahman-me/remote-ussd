"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Plus, Workflow } from "lucide-react"
import { DeviceCard } from "@/components/app/device-card"
import { DialForm } from "@/components/app/dial-form"
import { RunDetailSheet, RunsTable } from "@/components/app/runs-table"
import { RunsChart } from "@/components/app/runs-chart"
import { StatCards } from "@/components/app/stat-cards"
import { RunStatusBadge } from "@/components/app/status"
import { UssdConsole } from "@/components/app/ussd-console"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useNow } from "@/hooks/use-now"
import { relative } from "@/lib/format"
import { describeSchedule } from "@/lib/ussd"
import { useAppStore } from "@/store/app-store"

function greeting(now: number) {
  const h = new Date(now).getHours()
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
}

export function OverviewView() {
  const devices = useAppStore((s) => s.devices)
  const runs = useAppStore((s) => s.runs)
  const automations = useAppStore((s) => s.automations)
  const operator = useAppStore((s) => s.settings.operatorName)
  const consoleRunId = useAppStore((s) => s.consoleRunId)
  const setConsoleRun = useAppStore((s) => s.setConsoleRun)
  const consoleRun = useAppStore((s) => s.runs.find((r) => r.id === s.consoleRunId))
  const [target, setTarget] = useState<string | undefined>(() => consoleRun?.deviceId ?? devices.find((d) => d.status === "online")?.id)
  const [openRun, setOpenRun] = useState<string>()
  const now = useNow(30_000)

  const online = devices.filter((d) => d.status !== "offline").length
  const live = runs.filter((r) => r.status === "running").length
  const upcoming = automations
    .filter((a) => a.enabled && a.nextRunAt)
    .sort((a, b) => (a.nextRunAt ?? 0) - (b.nextRunAt ?? 0))
    .slice(0, 4)
  const targetDevice = devices.find((d) => d.id === target)

  return (
    <div className="flex flex-col gap-4 @xl/main:gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {greeting(now)}, {operator.split(" ")[0]}
        </h2>
        <p className="text-sm text-muted-foreground">
          {online} of {devices.length} devices online · {live ? `${live} session${live > 1 ? "s" : ""} live` : "no live sessions"}
        </p>
      </div>

      <StatCards />

      <div className="flex flex-col gap-4 @5xl/main:grid @5xl/main:grid-cols-[minmax(0,1fr)_24rem] @5xl/main:items-start @5xl/main:gap-6 @7xl/main:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="contents @5xl/main:flex @5xl/main:min-w-0 @5xl/main:flex-col @5xl/main:gap-6">
          <section aria-labelledby="devices-heading" className="order-2 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <h3 id="devices-heading" className="text-base font-semibold">Devices</h3>
                <p className="text-sm text-muted-foreground">Select a device to target it</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/devices?pair=1"><Plus /> Pair device</Link>
              </Button>
            </div>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-2 scrollbar-none @xl/main:mx-0 @xl/main:grid @xl/main:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] @xl/main:gap-4 @xl/main:overflow-visible @xl/main:px-1 *:shrink-0 *:basis-[84%] *:snap-center @xl/main:*:basis-auto">
              {devices.map((d) => (
                <DeviceCard key={d.id} device={d} selected={d.id === target} onSelect={() => setTarget(d.id)} />
              ))}
            </div>
          </section>

          <RunsChart className="order-5" />

          <Card className="order-4 gap-0 pb-0">
            <CardHeader className="border-b">
              <CardTitle>Recent runs</CardTitle>
              <CardDescription>Manual and automated sessions across the fleet</CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/history">View all <ChevronRight /></Link>
                </Button>
              </CardAction>
            </CardHeader>
            <RunsTable runs={runs.slice(0, 6)} onSelect={setOpenRun} />
          </Card>
        </div>

        <div className="contents @5xl/main:sticky @5xl/main:top-20 @5xl/main:flex @5xl/main:flex-col @5xl/main:gap-6">
          <Card className="order-1">
            <CardHeader>
              <CardTitle>Quick dial</CardTitle>
              <CardDescription className="truncate">{targetDevice ? `Target · ${targetDevice.name}` : "Pick a device below"}</CardDescription>
            </CardHeader>
            <CardContent>
              <DialForm deviceId={target} onDeviceChange={setTarget} showDeviceSelect={false} />
            </CardContent>
          </Card>

          <UssdConsole runId={consoleRunId} className="order-3" onClear={() => setConsoleRun(undefined)} />

          <Card className="order-6">
            <CardHeader>
              <CardTitle>Upcoming automations</CardTitle>
              <CardDescription>Runs while this dashboard is open</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/automations">Manage</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No automations scheduled.</p>}
              {upcoming.map((a) => (
                <Link key={a.id} href="/automations" className="flex items-center gap-3 rounded-lg p-1 -m-1 hover:bg-muted/50">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Workflow className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {describeSchedule(a.schedule)} · next {relative(a.nextRunAt!, now)}
                    </p>
                  </div>
                  {a.lastStatus && <RunStatusBadge status={a.lastStatus} />}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <RunDetailSheet runId={openRun} onOpenChange={(o) => !o && setOpenRun(undefined)} />
    </div>
  )
}
