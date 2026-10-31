"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Copy, RefreshCw, Smartphone, Workflow } from "lucide-react"
import { toast } from "sonner"
import { Code, RunStatusBadge } from "@/components/app/status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useNow } from "@/hooks/use-now"
import { retryRun } from "@/lib/engine"
import { clock, dateTime, relative, seconds } from "@/lib/format"
import { maskValue, runDuration, simLabel } from "@/lib/ussd"
import type { Run } from "@/lib/types"
import { useAppStore } from "@/store/app-store"

function useLookups() {
  const devices = useAppStore((s) => s.devices)
  const automations = useAppStore((s) => s.automations)
  return {
    device: (id: string) => devices.find((d) => d.id === id),
    automation: (id?: string) => automations.find((a) => a.id === id),
  }
}

export function RunsTable({ runs, onSelect, showDevice = true }: { runs: Run[]; onSelect: (id: string) => void; showDevice?: boolean }) {
  const { device, automation } = useLookups()
  const now = useNow(5000)
  if (runs.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">No runs match.</p>
  }
  return (
    <div className="@container">
      <div className="hidden @2xl:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-4">Code</TableHead>
              {showDevice && <TableHead>Device</TableHead>}
              <TableHead>Result</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="pr-4 text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => {
              const d = device(r.deviceId)
              const a = automation(r.automationId)
              return (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => onSelect(r.id)}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                      <Code>{r.code}</Code>
                      {a && (
                        <Badge variant="outline" className="max-w-36 truncate font-normal" title={a.name}>
                          <Workflow /> {a.name}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {showDevice && (
                    <TableCell>
                      <div className="font-medium">{d?.name ?? "Removed device"}</div>
                      <div className="text-xs text-muted-foreground">{simLabel(d?.sims.find((s) => s.slot === r.simSlot))}</div>
                    </TableCell>
                  )}
                  <TableCell className="max-w-72 truncate whitespace-normal text-muted-foreground">
                    <span className="line-clamp-1">{r.status === "running" ? (r.awaitingInput ? "Awaiting operator reply" : "Waiting for network…") : (r.result ?? r.error)}</span>
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={r.status} awaiting={r.awaitingInput} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground tabular">{seconds(runDuration(r, now))}</TableCell>
                  <TableCell className="pr-4 text-right font-mono text-xs text-muted-foreground tabular" title={dateTime(r.startedAt)}>
                    {r.startedAt > now - 86400_000 ? clock(r.startedAt) : dateTime(r.startedAt)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y @2xl:hidden">
        {runs.map((r) => {
          const d = device(r.deviceId)
          return (
            <li key={r.id}>
              <button type="button" onClick={() => onSelect(r.id)} className="flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:bg-muted/50">
                <span className="flex items-center justify-between gap-2">
                  <Code>{r.code}</Code>
                  <RunStatusBadge status={r.status} awaiting={r.awaitingInput} />
                </span>
                <span className="line-clamp-2 text-sm">{r.status === "running" ? "In progress…" : (r.result ?? r.error)}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {[showDevice ? d?.name : undefined, seconds(runDuration(r, now)), relative(r.startedAt, now)].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function RunDetailSheet({ runId, onOpenChange }: { runId?: string; onOpenChange: (open: boolean) => void }) {
  const run = useAppStore((s) => s.runs.find((r) => r.id === runId))
  const maskSensitive = useAppStore((s) => s.settings.maskSensitive)
  const { device, automation } = useLookups()
  const router = useRouter()
  const now = useNow(1000)
  const d = run ? device(run.deviceId) : undefined
  const a = automation(run?.automationId)

  const transcript = run?.steps.map((s) => `[${clock(s.at)}] ${s.dir === "out" ? ">" : s.dir === "in" ? "<" : "·"} ${s.masked && maskSensitive ? maskValue(s.text) : s.text}`).join("\n") ?? ""

  return (
    <Sheet open={!!runId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {run && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="flex items-center gap-2">
                <Code className="text-base">{run.code}</Code>
                <RunStatusBadge status={run.status} awaiting={run.awaitingInput} />
              </SheetTitle>
              <SheetDescription>{dateTime(run.startedAt)} · {relative(run.startedAt, now)}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Device</dt>
                  <dd className="font-medium">{d ? <Link className="hover:underline" href={`/devices/${d.id}`}>{d.name}</Link> : "Removed device"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">SIM</dt>
                  <dd className="font-medium">{simLabel(d?.sims.find((s) => s.slot === run.simSlot))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Source</dt>
                  <dd className="font-medium">{a ? a.name : run.source === "manual" ? "Manual" : "Automation"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Duration · attempt</dt>
                  <dd className="font-mono font-medium tabular">{seconds(runDuration(run, now))} · #{run.attempt}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">{run.status === "success" ? "Result" : "Outcome"}</dt>
                  <dd className={run.error ? "text-destructive" : undefined}>{run.result ?? run.error ?? "In progress"}</dd>
                </div>
              </dl>
              <div className="px-4 pb-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Transcript</p>
                <ol className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
                  {run.steps.map((s, i) => (
                    <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3 font-mono text-xs">
                      <span className="text-muted-foreground tabular">{clock(s.at)}</span>
                      <span className={s.dir === "out" ? "font-semibold text-primary" : s.dir === "sys" ? "text-muted-foreground italic" : "whitespace-pre-wrap"}>
                        {s.dir === "out" ? "→ " : ""}
                        {s.masked && maskSensitive ? maskValue(s.text) : s.text}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <SheetFooter className="flex-row border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigator.clipboard.writeText(transcript).then(() => toast.success("Transcript copied"))}
              >
                <Copy /> Copy
              </Button>
              {d && (
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/devices/${d.id}`}><Smartphone /> Device</Link>
                </Button>
              )}
              <Button
                className="flex-1"
                disabled={run.status === "running"}
                onClick={() => {
                  const res = retryRun(run.id)
                  if (res.ok) {
                    toast.success("Session started", { description: "Follow it in the Dial console.", action: { label: "Open", onClick: () => router.push("/dial") } })
                    onOpenChange(false)
                  } else toast.error(res.message)
                }}
              >
                <RefreshCw /> Retry
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
