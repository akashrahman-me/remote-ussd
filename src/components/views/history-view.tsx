"use client"

import { useMemo, useState } from "react"
import { useNow } from "@/hooks/use-now"
import { ChevronLeft, ChevronRight, Download, ListFilter, Search, Trash } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/app/page-header"
import { RunDetailSheet, RunsTable } from "@/components/app/runs-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { number } from "@/lib/format"
import { runDuration, simLabel } from "@/lib/ussd"
import type { Run, RunSource, RunStatus } from "@/lib/types"
import { useAppStore } from "@/store/app-store"

const PAGE = 20
const RANGES = { "1": "Last 24 hours", "7": "Last 7 days", "30": "Last 30 days", all: "All time" } as const
type Range = keyof typeof RANGES

function csvCell(v: string | number) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function HistoryView() {
  const runs = useAppStore((s) => s.runs)
  const devices = useAppStore((s) => s.devices)
  const automations = useAppStore((s) => s.automations)
  const clearHistory = useAppStore((s) => s.clearHistory)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | RunStatus>("all")
  const [device, setDevice] = useState("all")
  const [source, setSource] = useState<"all" | RunSource>("all")
  const [range, setRange] = useState<Range>("7")
  const [page, setPage] = useState(0)
  const [openRun, setOpenRun] = useState<string>()
  const now = useNow(60_000)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const since = range === "all" ? 0 : now - Number(range) * 86400_000
    return runs.filter(
      (r) =>
        r.startedAt >= since &&
        (status === "all" || r.status === status) &&
        (device === "all" || r.deviceId === device) &&
        (source === "all" || r.source === source) &&
        (!q || r.code.includes(q) || (r.result ?? r.error ?? "").toLowerCase().includes(q)),
    )
  }, [runs, query, status, device, source, range, now])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const current = Math.min(page, pages - 1)
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE)
  const ok = filtered.filter((r) => r.status === "success").length
  const failed = filtered.filter((r) => r.status === "failed").length
  const timeouts = filtered.filter((r) => r.status === "timeout").length
  const reset = () => setPage(0)

  function exportCsv(rows: Run[]) {
    const header = ["id", "started_at", "code", "device", "sim", "source", "automation", "status", "duration_s", "result"]
    const lines = rows.map((r) => {
      const d = devices.find((x) => x.id === r.deviceId)
      return [
        r.id, new Date(r.startedAt).toISOString(), r.code, d?.name ?? r.deviceId, simLabel(d?.sims.find((s) => s.slot === r.simSlot)),
        r.source, automations.find((a) => a.id === r.automationId)?.name ?? "", r.status, runDuration(r).toFixed(1), r.result ?? r.error ?? "",
      ].map(csvCell).join(",")
    })
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `relay-runs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${number(rows.length)} runs`)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="History"
        description={`${number(filtered.length)} runs · ${number(ok)} completed · ${number(failed)} failed · ${number(timeouts)} timed out`}
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv(filtered)} disabled={!filtered.length}><Download /> Export CSV</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" disabled={!runs.length}><Trash /> Clear</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all run history?</AlertDialogTitle>
                  <AlertDialogDescription>Every finished run and its transcript is deleted. Live sessions are kept. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => { clearHistory(); toast.success("History cleared") }}>Clear history</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />

      <div className="grid gap-2 @xl/main:grid-cols-2 @5xl/main:grid-cols-[minmax(0,1fr)_repeat(4,10.5rem)]">
        <div className="relative @xl/main:col-span-2 @5xl/main:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); reset() }} placeholder="Search code or result" className="pl-9" aria-label="Search runs" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); reset() }}>
          <SelectTrigger className="w-full" aria-label="Status"><ListFilter /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="success">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="timeout">Timed out</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="running">Running</SelectItem>
          </SelectContent>
        </Select>
        <Select value={device} onValueChange={(v) => { setDevice(v); reset() }}>
          <SelectTrigger className="w-full" aria-label="Device"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All devices</SelectItem>
            {devices.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => { setSource(v as typeof source); reset() }}>
          <SelectTrigger className="w-full" aria-label="Source"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any source</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="automation">Automation</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={(v) => { setRange(v as Range); reset() }}>
          <SelectTrigger className="w-full" aria-label="Time range"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(RANGES).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="gap-0 py-0">
        <RunsTable runs={visible} onSelect={setOpenRun} />
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground tabular">
            {filtered.length ? `${current * PAGE + 1}–${Math.min(filtered.length, (current + 1) * PAGE)} of ${number(filtered.length)}` : "0 runs"}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft /></Button>
            <span className="px-2 font-mono text-xs tabular">{current + 1}/{pages}</span>
            <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronRight /></Button>
          </div>
        </div>
      </Card>

      <RunDetailSheet runId={openRun} onOpenChange={(o) => !o && setOpenRun(undefined)} />
    </div>
  )
}
