"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { DialForm } from "@/components/app/dial-form"
import { PageHeader } from "@/components/app/page-header"
import { RunDetailSheet, RunsTable } from "@/components/app/runs-table"
import { SavedCodes } from "@/components/app/saved-codes"
import { UssdConsole } from "@/components/app/ussd-console"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAppStore } from "@/store/app-store"

export function DialView() {
  const params = useSearchParams()
  const devices = useAppStore((s) => s.devices)
  const runs = useAppStore((s) => s.runs)
  const consoleRunId = useAppStore((s) => s.consoleRunId)
  const setConsoleRun = useAppStore((s) => s.setConsoleRun)
  const consoleRun = runs.find((r) => r.id === consoleRunId)

  const requested = params.get("device") ?? undefined
  const [deviceId, setDeviceId] = useState<string | undefined>(
    () => (devices.some((d) => d.id === requested) ? requested : consoleRun?.deviceId ?? devices.find((d) => d.status === "online")?.id),
  )
  const [code, setCode] = useState({ value: params.get("code") ?? "", n: 0 })
  const applyCode = (value: string) => setCode((c) => ({ value, n: c.n + 1 }))
  const [openRun, setOpenRun] = useState<string>()

  const device = devices.find((d) => d.id === deviceId)
  const manualRuns = runs.filter((r) => r.source === "manual" && (!deviceId || r.deviceId === deviceId)).slice(0, 8)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dial" description="Run a USSD code on a remote phone and answer the carrier menu live." />

      <div className="grid gap-6 @4xl/main:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] @6xl/main:grid-cols-[24rem_minmax(0,1fr)] @4xl/main:items-start">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>New session</CardTitle>
              <CardDescription>One session per phone at a time; carriers close idle menus after a timeout.</CardDescription>
            </CardHeader>
            <CardContent>
              <DialForm deviceId={deviceId} onDeviceChange={setDeviceId} initialCode={code.value} codeNonce={code.n} />
            </CardContent>
          </Card>
          <div className="hidden @4xl/main:block">
            <SavedCodes onUse={applyCode} />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <UssdConsole runId={consoleRunId} onClear={() => setConsoleRun(undefined)} />
          <Card className="gap-0 pb-0">
            <CardHeader className="border-b">
              <CardTitle>Session history</CardTitle>
              <CardDescription>Manual runs{device ? ` on ${device.name}` : ""}</CardDescription>
            </CardHeader>
            <RunsTable runs={manualRuns} onSelect={(id) => (runs.find((r) => r.id === id)?.status === "running" ? setConsoleRun(id) : setOpenRun(id))} showDevice={!deviceId} />
          </Card>
          <div className="@4xl/main:hidden">
            <SavedCodes onUse={applyCode} />
          </div>
        </div>
      </div>

      <RunDetailSheet runId={openRun} onOpenChange={(o) => !o && setOpenRun(undefined)} />
    </div>
  )
}
