"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash } from "lucide-react"
import { toast } from "sonner"
import { SignalMeter } from "@/components/app/status"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { uid } from "@/lib/format"
import { REPLY_RE, isValidCode, sanitizeCodeInput } from "@/lib/ussd"
import type { Automation, AutomationStep, AutomationTarget, Schedule } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"

function blank(retries: number): Automation {
  return {
    id: uid("auto_"), name: "", description: "", enabled: true, maxRetries: retries, createdAt: Date.now(),
    steps: [{ id: uid("s"), value: "", expect: "" }],
    targets: [], schedule: { kind: "manual" },
  }
}

function validate(a: Automation) {
  const errors: Record<string, string> = {}
  if (a.name.trim().length < 3) errors.name = "Give it a name of at least 3 characters."
  if (!a.steps.length) errors.steps = "Add at least one step."
  a.steps.forEach((s, i) => {
    if (i === 0 && !isValidCode(s.value)) errors[`step-${s.id}`] = "The first step must be a USSD code like *121#."
    if (i > 0 && !REPLY_RE.test(s.value)) errors[`step-${s.id}`] = "Replies are digits, * or # only."
  })
  if (!a.targets.length) errors.targets = "Pick at least one device SIM."
  if (a.schedule.kind === "interval" && (a.schedule.minutes < 5 || a.schedule.minutes > 1440)) errors.schedule = "Use between 5 and 1440 minutes."
  if (a.schedule.kind === "daily" && !/^\d{2}:\d{2}$/.test(a.schedule.time)) errors.schedule = "Pick a time."
  return errors
}

export function AutomationEditor({ automation, open, onOpenChange }: { automation?: Automation; open: boolean; onOpenChange: (o: boolean) => void }) {
  const devices = useAppStore((s) => s.devices)
  const defaultRetries = useAppStore((s) => s.settings.defaultRetries)
  const saveAutomation = useAppStore((s) => s.saveAutomation)
  const [draft, setDraft] = useState<Automation>(() => automation ?? blank(defaultRetries))
  const [touched, setTouched] = useState(false)

  // Load a fresh draft each time the sheet opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) {
      setDraft(automation ? structuredClone(automation) : blank(defaultRetries))
      setTouched(false)
    }
  }

  const errors = validate(draft)
  const show = (key: string) => (touched ? errors[key] : undefined)
  const set = (patch: Partial<Automation>) => setDraft((d) => ({ ...d, ...patch }))
  const setStep = (id: string, patch: Partial<AutomationStep>) => set({ steps: draft.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const move = (i: number, dir: -1 | 1) => {
    const steps = [...draft.steps]
    const [s] = steps.splice(i, 1)
    steps.splice(i + dir, 0, s!)
    set({ steps })
  }
  const hasTarget = (t: AutomationTarget) => draft.targets.some((x) => x.deviceId === t.deviceId && x.simSlot === t.simSlot)
  const toggleTarget = (t: AutomationTarget) =>
    set({ targets: hasTarget(t) ? draft.targets.filter((x) => !(x.deviceId === t.deviceId && x.simSlot === t.simSlot)) : [...draft.targets, t] })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(errors).length) {
      toast.error("Fix the highlighted fields first.")
      return
    }
    saveAutomation({ ...draft, name: draft.name.trim(), steps: draft.steps.map((s) => ({ ...s, expect: s.expect?.trim() || undefined })) })
    toast.success(automation ? "Automation updated" : "Automation created")
    onOpenChange(false)
  }

  const schedule = draft.schedule

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{automation ? "Edit automation" : "New automation"}</SheetTitle>
          <SheetDescription>A flow dials a code, then answers each menu in order. Every reply can be checked before moving on.</SheetDescription>
        </SheetHeader>
        <form id="automation-form" onSubmit={submit} className="flex-1 overflow-y-auto p-4">
          <FieldGroup>
            <Field data-invalid={!!show("name") || undefined}>
              <FieldLabel htmlFor="a-name">Name</FieldLabel>
              <Input id="a-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Daily balance check" aria-invalid={!!show("name") || undefined} />
              {show("name") && <FieldDescription className="text-destructive">{show("name")}</FieldDescription>}
            </Field>
            <Field>
              <FieldLabel htmlFor="a-desc">Description</FieldLabel>
              <Textarea id="a-desc" value={draft.description ?? ""} onChange={(e) => set({ description: e.target.value })} rows={2} placeholder="What this flow is for" />
            </Field>

            <FieldSet>
              <FieldLegend>Steps</FieldLegend>
              <FieldDescription>Step 1 is the code to dial. Later steps are menu replies. “Expect” is text the reply must contain, or a /regex/.</FieldDescription>
              <ol className="flex flex-col gap-3">
                {draft.steps.map((s, i) => (
                  <li key={s.id} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center gap-1">
                      <span className="flex size-6 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold">{i + 1}</span>
                      <span className="flex-1 text-sm font-medium">{i === 0 ? "Dial" : "Reply"}</span>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="Move down" disabled={i === draft.steps.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove step" disabled={draft.steps.length === 1} onClick={() => set({ steps: draft.steps.filter((x) => x.id !== s.id) })}><Trash /></Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                      <Input
                        value={s.value}
                        onChange={(e) => setStep(s.id, { value: sanitizeCodeInput(e.target.value) })}
                        placeholder={i === 0 ? "*121#" : "1"}
                        inputMode="tel"
                        className="font-mono"
                        aria-label={`Step ${i + 1} value`}
                        aria-invalid={!!show(`step-${s.id}`) || undefined}
                      />
                      <Input value={s.expect ?? ""} onChange={(e) => setStep(s.id, { expect: e.target.value })} placeholder="Expect (optional), e.g. Internet Packs" aria-label={`Step ${i + 1} expectation`} />
                    </div>
                    {i > 0 && (
                      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox checked={!!s.sensitive} onCheckedChange={(v) => setStep(s.id, { sensitive: v === true })} />
                        Sensitive (PIN): mask it in logs
                      </label>
                    )}
                    {show(`step-${s.id}`) && <p className="mt-2 text-xs text-destructive">{show(`step-${s.id}`)}</p>}
                  </li>
                ))}
              </ol>
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set({ steps: [...draft.steps, { id: uid("s"), value: "", expect: "" }] })}>
                <Plus /> Add reply step
              </Button>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Targets</FieldLegend>
              <FieldDescription>Each selected SIM gets its own run. Disabled and offline SIMs are skipped and logged as failed.</FieldDescription>
              <div className="flex flex-col divide-y rounded-lg border">
                {devices.flatMap((d) =>
                  d.sims.map((sim) => {
                    const t = { deviceId: d.id, simSlot: sim.slot }
                    const unavailable = d.status === "offline" || !sim.enabled
                    return (
                      <label key={`${d.id}-${sim.slot}`} className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5", unavailable && "opacity-60")}>
                        <Checkbox checked={hasTarget(t)} onCheckedChange={() => toggleTarget(t)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{d.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            SIM {sim.slot} · {sim.label || sim.carrier}
                            {d.status === "offline" ? " · offline" : !sim.enabled ? " · disabled" : ""}
                          </span>
                        </span>
                        <SignalMeter bars={sim.signal} />
                      </label>
                    )
                  }),
                )}
              </div>
              {show("targets") && <p className="text-xs text-destructive">{show("targets")}</p>}
            </FieldSet>

            <FieldSet>
              <FieldLegend>Schedule</FieldLegend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="a-sched">Runs</FieldLabel>
                  <Select
                    value={schedule.kind}
                    onValueChange={(kind) =>
                      set({ schedule: (kind === "interval" ? { kind, minutes: 60 } : kind === "daily" ? { kind, time: "09:00" } : { kind: "manual" }) as Schedule })
                    }
                  >
                    <SelectTrigger id="a-sched" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manually</SelectItem>
                      <SelectItem value="interval">On an interval</SelectItem>
                      <SelectItem value="daily">Daily at a time</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {schedule.kind === "interval" && (
                  <Field data-invalid={!!show("schedule") || undefined}>
                    <FieldLabel htmlFor="a-int">Every (minutes)</FieldLabel>
                    <Input id="a-int" type="number" min={5} max={1440} value={schedule.minutes} onChange={(e) => set({ schedule: { kind: "interval", minutes: Number(e.target.value) } })} />
                  </Field>
                )}
                {schedule.kind === "daily" && (
                  <Field>
                    <FieldLabel htmlFor="a-time">At</FieldLabel>
                    <Input id="a-time" type="time" value={schedule.time} onChange={(e) => set({ schedule: { kind: "daily", time: e.target.value } })} />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="a-retries">Retries on failure</FieldLabel>
                  <Select value={String(draft.maxRetries)} onValueChange={(v) => set({ maxRetries: Number(v) })}>
                    <SelectTrigger id="a-retries" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{n === 0 ? "No retries" : `${n} retr${n > 1 ? "ies" : "y"}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {show("schedule") && <p className="text-xs text-destructive">{show("schedule")}</p>}
              <Field orientation="horizontal">
                <Switch id="a-enabled" checked={draft.enabled} onCheckedChange={(enabled) => set({ enabled })} />
                <FieldLabel htmlFor="a-enabled">Enabled</FieldLabel>
              </Field>
            </FieldSet>
          </FieldGroup>
        </form>
        <SheetFooter className="flex-row justify-end border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="automation-form">{automation ? "Save changes" : "Create automation"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
