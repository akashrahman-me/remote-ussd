"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CalendarClock, ChevronRight, Copy, Ellipsis, Loader2, Pencil, Play, Plus, Trash, Workflow } from "lucide-react"
import { toast } from "sonner"
import { AutomationEditor } from "@/components/app/automation-editor"
import { PageHeader } from "@/components/app/page-header"
import { Code, RunStatusBadge } from "@/components/app/status"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Switch } from "@/components/ui/switch"
import { useNow } from "@/hooks/use-now"
import { executeAutomation } from "@/lib/engine"
import { relative, uid } from "@/lib/format"
import { describeSchedule, maskValue } from "@/lib/ussd"
import type { Automation } from "@/lib/types"
import { useAppStore } from "@/store/app-store"

function runNow(a: Automation) {
  toast.promise(executeAutomation(a.id).then((s) => s ?? "skipped"), {
    loading: `Running ${a.name} on ${a.targets.length} target${a.targets.length > 1 ? "s" : ""}…`,
    success: (s) => (s === "success" ? `${a.name} completed` : s === "skipped" ? `${a.name} is already running` : `${a.name} finished with failures`),
    error: "Could not run automation",
  })
}

function AutomationCard({ a, onEdit, onDelete }: { a: Automation; onEdit: () => void; onDelete: () => void }) {
  const devices = useAppStore((s) => s.devices)
  const busy = useAppStore((s) => s.busyAutomations.includes(a.id))
  const toggle = useAppStore((s) => s.toggleAutomation)
  const saveAutomation = useAppStore((s) => s.saveAutomation)
  const allRuns = useAppStore((s) => s.runs)
  const runs = useMemo(() => allRuns.filter((r) => r.automationId === a.id), [allRuns, a.id])
  const now = useNow(10_000)
  const done = runs.filter((r) => r.status !== "running")
  const rate = done.length ? Math.round((done.filter((r) => r.status === "success").length / done.length) * 100) : null
  const targetNames = a.targets.map((t) => devices.find((d) => d.id === t.deviceId)?.name.split(" · ")[0]).filter(Boolean)

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {a.name}
          {busy && <span className="inline-flex items-center gap-1 text-xs font-normal text-info"><Loader2 className="size-3 animate-spin" /> Running</span>}
        </CardTitle>
        <CardDescription className="line-clamp-2">{a.description || "No description"}</CardDescription>
        <CardAction className="flex items-center gap-1">
          <Switch checked={a.enabled} onCheckedChange={(v) => { toggle(a.id, v); toast.success(`${a.name} ${v ? "enabled" : "paused"}`) }} aria-label={a.enabled ? "Pause" : "Enable"} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More actions"><Ellipsis /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { saveAutomation({ ...structuredClone(a), id: uid("auto_"), name: `${a.name} (copy)`, enabled: false, createdAt: Date.now(), lastRunAt: undefined, lastStatus: undefined }); toast.success("Duplicated as paused copy") }}>
                <Copy /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {a.steps.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3 text-muted-foreground" />}
              <Code>{s.sensitive ? maskValue(s.value) : s.value}</Code>
            </span>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Schedule</dt>
            <dd className="flex items-center gap-1.5 font-medium"><CalendarClock className="size-3.5 text-muted-foreground" />{describeSchedule(a.schedule)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Next run</dt>
            <dd className="font-medium">{a.enabled && a.nextRunAt ? relative(a.nextRunAt, now) : a.enabled ? "Manual" : "Paused"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Targets · {a.targets.length} SIM{a.targets.length === 1 ? "" : "s"}</dt>
            <dd className="truncate font-medium">{[...new Set(targetNames)].join(", ") || "None"}</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="gap-2 border-t">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
          {a.lastStatus ? <RunStatusBadge status={a.lastStatus} /> : <span>Never run</span>}
          {a.lastRunAt && <span className="truncate">{relative(a.lastRunAt, now)}</span>}
          {rate !== null && <span className="hidden truncate sm:inline">· {rate}% success</span>}
        </div>
        <Button size="sm" variant="outline" disabled={busy || !a.targets.length} onClick={() => runNow(a)}>
          <Play /> Run now
        </Button>
      </CardFooter>
    </Card>
  )
}

export function AutomationsView() {
  const automations = useAppStore((s) => s.automations)
  const removeAutomation = useAppStore((s) => s.removeAutomation)
  const [editing, setEditing] = useState<Automation | undefined>()
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleting, setDeleting] = useState<Automation>()
  const enabled = automations.filter((a) => a.enabled).length

  const openEditor = (a?: Automation) => {
    setEditing(a)
    setEditorOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Automations"
        description={`${enabled} of ${automations.length} enabled. Scheduled flows run while a dashboard tab is open; the production gateway runs them server-side.`}
        actions={
          <>
            <Button variant="outline" asChild><Link href="/history">Run history</Link></Button>
            <Button onClick={() => openEditor()}><Plus /> New automation</Button>
          </>
        }
      />
      {automations.length ? (
        <div className="grid gap-4 @3xl/main:grid-cols-2 @7xl/main:grid-cols-3">
          {automations.map((a) => (
            <AutomationCard key={a.id} a={a} onEdit={() => openEditor(a)} onDelete={() => setDeleting(a)} />
          ))}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Workflow /></EmptyMedia>
            <EmptyTitle>No automations yet</EmptyTitle>
            <EmptyDescription>Chain a code and its menu replies, pick SIMs and a schedule, and Relay runs it for you.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><Button onClick={() => openEditor()}><Plus /> New automation</Button></EmptyContent>
        </Empty>
      )}

      <AutomationEditor automation={editing} open={editorOpen} onOpenChange={setEditorOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Scheduled runs stop immediately. Past runs stay in History.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { if (deleting) { removeAutomation(deleting.id); toast.success("Automation deleted") } }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
