"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Activity, ArrowLeft, Ellipsis, Grip, Pencil, Power, Unplug, Workflow } from "lucide-react"
import { toast } from "sonner"
import { RunDetailSheet, RunsTable } from "@/components/app/runs-table"
import { BatteryIndicator, DeviceStatusBadge, PlatformIcon, RunStatusBadge, SignalMeter } from "@/components/app/status"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useNow } from "@/hooks/use-now"
import { pingDevice, restartAgent } from "@/lib/engine"
import { dateTime, relative, percent } from "@/lib/format"
import { describeSchedule } from "@/lib/ussd"
import type { Sim } from "@/lib/types"
import { useAppStore } from "@/store/app-store"

function SimCard({ deviceId, sim, isDefault }: { deviceId: string; sim: Sim; isDefault: boolean }) {
  const updateSim = useAppStore((s) => s.updateSim)
  const updateDevice = useAppStore((s) => s.updateDevice)
  const [label, setLabel] = useState(sim.label ?? "")

  return (
    <Card size="sm" className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          SIM {sim.slot} · {sim.carrier}
          {isDefault && <Badge variant="secondary">Default</Badge>}
        </CardTitle>
        <CardDescription className="font-mono">{sim.number}</CardDescription>
        <CardAction>
          <Switch
            checked={sim.enabled}
            aria-label={`Use SIM ${sim.slot} for USSD`}
            onCheckedChange={(enabled) => {
              updateSim(deviceId, sim.slot, { enabled })
              toast.success(`SIM ${sim.slot} ${enabled ? "enabled" : "disabled"} for USSD`)
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Signal</span>
          <span className="flex items-center gap-2">
            <SignalMeter bars={sim.signal} />
            <span className="font-mono text-xs text-muted-foreground">{sim.signal}/4</span>
          </span>
        </div>
        <Field>
          <FieldLabel htmlFor={`sim-label-${sim.slot}`} className="text-xs">Label</FieldLabel>
          <Input
            id={`sim-label-${sim.slot}`}
            value={label}
            placeholder={sim.carrier}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => label !== (sim.label ?? "") && updateSim(deviceId, sim.slot, { label: label.trim() || undefined })}
          />
        </Field>
        {!isDefault && (
          <Button variant="outline" size="sm" disabled={!sim.enabled} onClick={() => updateDevice(deviceId, { defaultSim: sim.slot })}>
            Make default
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function DeviceDetailView({ id }: { id: string }) {
  const router = useRouter()
  const device = useAppStore((s) => s.devices.find((d) => d.id === id))
  const allRuns = useAppStore((s) => s.runs)
  const automations = useAppStore((s) => s.automations)
  const updateDevice = useAppStore((s) => s.updateDevice)
  const removeDevice = useAppStore((s) => s.removeDevice)
  const [openRun, setOpenRun] = useState<string>()
  const [renameOpen, setRenameOpen] = useState(false)
  const [unpairOpen, setUnpairOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [pinging, setPinging] = useState(false)
  const now = useNow(5000)

  if (!device) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Device not found</EmptyTitle>
          <EmptyDescription>It may have been unpaired.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline"><Link href="/devices"><ArrowLeft /> All devices</Link></Button>
        </EmptyContent>
      </Empty>
    )
  }

  const runs = allRuns.filter((r) => r.deviceId === device.id)
  const done = runs.filter((r) => r.status !== "running")
  const rate = done.length ? (done.filter((r) => r.status === "success").length / done.length) * 100 : 100
  const linked = automations.filter((a) => a.targets.some((t) => t.deviceId === device.id))
  const offline = device.status === "offline"

  async function ping() {
    setPinging(true)
    const res = await pingDevice(device!.id)
    setPinging(false)
    if (res.ok) toast.success(`Agent answered in ${res.ms} ms`)
    else toast.error(res.message)
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="-ml-2 self-start" asChild>
        <Link href="/devices"><ArrowLeft /> Devices</Link>
      </Button>

      <div className="flex flex-col gap-4 @3xl/main:flex-row @3xl/main:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
            <PlatformIcon platform={device.platform} className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{device.name}</h2>
              <DeviceStatusBadge status={device.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {device.model} · {device.osVersion} · agent v{device.agentVersion}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild disabled={offline}>
            <Link href={`/dial?device=${device.id}`} aria-disabled={offline} className={offline ? "pointer-events-none opacity-50" : undefined}>
              <Grip /> Dial on device
            </Link>
          </Button>
          <Button variant="outline" onClick={ping} disabled={pinging || offline}>
            <Activity /> {pinging ? "Pinging…" : "Ping"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions"><Ellipsis /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => { setNewName(device.name); setRenameOpen(true) }}>
                <Pencil /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={offline}
                onSelect={() => {
                  toast.promise(restartAgent(device.id), { loading: "Restarting agent…", success: "Agent back online", error: "Restart failed" })
                }}
              >
                <Power /> Restart agent
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setUnpairOpen(true)}>
                <Unplug /> Unpair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 @3xl/main:grid-cols-4 @3xl/main:gap-4">
        {[
          { label: "Battery", value: <BatteryIndicator level={device.battery} charging={device.charging} />, hint: device.charging ? "Charging" : "On battery" },
          { label: "Last heartbeat", value: <span className="text-lg font-semibold">{relative(device.lastSeenAt, now)}</span>, hint: dateTime(device.lastSeenAt) },
          { label: "Success rate", value: <span className="text-lg font-semibold tabular">{percent(rate)}</span>, hint: `${runs.length} runs recorded` },
          { label: "Paired", value: <span className="text-lg font-semibold">{relative(device.pairedAt, now)}</span>, hint: dateTime(device.pairedAt) },
        ].map((s) => (
          <Card key={s.label} size="sm" className="gap-1.5">
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {s.value}
              <span className="truncate text-xs text-muted-foreground">{s.hint}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="sims-heading">
        <div>
          <h3 id="sims-heading" className="text-base font-semibold">SIM slots</h3>
          <p className="text-sm text-muted-foreground">Disabled SIMs are never used, by people or automations.</p>
        </div>
        <div className="grid gap-4 @xl/main:grid-cols-2">
          {device.sims.map((sim) => (
            <SimCard key={sim.slot} deviceId={device.id} sim={sim} isDefault={device.defaultSim === sim.slot} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 @5xl/main:grid-cols-[minmax(0,1fr)_22rem] @5xl/main:items-start">
        <Card className="gap-0 pb-0">
          <CardHeader className="border-b">
            <CardTitle>Runs on this device</CardTitle>
            <CardDescription>{runs.length} total</CardDescription>
          </CardHeader>
          <RunsTable runs={runs.slice(0, 12)} onSelect={setOpenRun} showDevice={false} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Automations</CardTitle>
            <CardDescription>Flows that target this device</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {linked.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
            {linked.map((a) => (
              <Link key={a.id} href="/automations" className="-m-1 flex items-center gap-3 rounded-lg p-1 hover:bg-muted/50">
                <Workflow className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.enabled ? describeSchedule(a.schedule) : "Paused"}</p>
                </div>
                {a.lastStatus && <RunStatusBadge status={a.lastStatus} />}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <RunDetailSheet runId={openRun} onOpenChange={(o) => !o && setOpenRun(undefined)} />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename device</DialogTitle>
          </DialogHeader>
          <form
            id="rename-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (newName.trim().length < 3) return toast.error("Use at least 3 characters.")
              updateDevice(device.id, { name: newName.trim() })
              setRenameOpen(false)
            }}
          >
            <Field>
              <FieldLabel htmlFor="rename">Name</FieldLabel>
              <Input id="rename" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </Field>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button type="submit" form="rename-form">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={unpairOpen} onOpenChange={setUnpairOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpair {device.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The agent is signed out and the phone is removed from {linked.length} automation{linked.length === 1 ? "" : "s"}. Run history is kept. You can pair it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={device.status === "busy"}
              onClick={() => {
                removeDevice(device.id)
                toast.success(`${device.name} unpaired`)
                router.push("/devices")
              }}
            >
              {device.status === "busy" ? "Session in progress" : "Unpair"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
