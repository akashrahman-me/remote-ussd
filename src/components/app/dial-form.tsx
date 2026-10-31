"use client"

import { useState } from "react"
import { Delete, Grip, Play } from "lucide-react"
import { toast } from "sonner"
import { DeviceStatusBadge, SignalMeter } from "@/components/app/status"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { startManualRun } from "@/lib/engine"
import { BLOCKER_MESSAGES, dialBlocker, isValidCode, sanitizeCodeInput } from "@/lib/ussd"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]

interface DialFormProps {
  deviceId?: string
  onDeviceChange?: (id: string) => void
  showDeviceSelect?: boolean
  initialCode?: string
  /** Bump to re-apply `initialCode` (e.g. picking the same saved code twice). */
  codeNonce?: number
  showKeypad?: boolean
  className?: string
}

export function DialForm({ deviceId, onDeviceChange, showDeviceSelect = true, initialCode = "", codeNonce = 0, showKeypad = false, className }: DialFormProps) {
  const devices = useAppStore((s) => s.devices)
  const codes = useAppStore((s) => s.codes)
  const device = devices.find((d) => d.id === deviceId)
  // The SIM choice belongs to one device; switching targets falls back to that device's default SIM.
  const [simChoice, setSimChoice] = useState<{ deviceId?: string; slot: 1 | 2 }>({ slot: 1 })
  const defaultSlot = device ? (device.sims.some((s) => s.slot === device.defaultSim) ? device.defaultSim : device.sims[0]?.slot ?? 1) : 1
  const simSlot = simChoice.deviceId === device?.id ? simChoice.slot : defaultSlot
  const setSimSlot = (slot: 1 | 2) => setSimChoice({ deviceId: device?.id, slot })

  const [code, setCode] = useState(initialCode)
  const [keypad, setKeypad] = useState(showKeypad)

  // Re-apply a code chosen elsewhere (saved codes, ⌘K) when the request changes.
  const [applied, setApplied] = useState({ code: initialCode, n: codeNonce })
  if (applied.code !== initialCode || applied.n !== codeNonce) {
    setApplied({ code: initialCode, n: codeNonce })
    if (initialCode) setCode(initialCode)
  }

  const dirty = code.length > 1
  const blocker = dialBlocker(device, simSlot, code)
  const codeInvalid = dirty && !isValidCode(code)
  const pinned = codes.filter((c) => c.pinned)

  function run(e?: React.FormEvent) {
    e?.preventDefault()
    if (!device) return
    const res = startManualRun(device.id, simSlot, code)
    if (!res.ok) toast.error(res.message)
  }

  const hint = codeInvalid
    ? BLOCKER_MESSAGES["invalid-code"]
    : blocker && blocker !== "invalid-code"
      ? BLOCKER_MESSAGES[blocker]
      : "Runs on the selected device. Network replies stream into the console."

  return (
    <form onSubmit={run} className={cn("flex flex-col gap-4", className)}>
      {showDeviceSelect && (
        <Field>
          <FieldLabel htmlFor="dial-device">Device</FieldLabel>
          <Select value={deviceId} onValueChange={onDeviceChange}>
            <SelectTrigger id="dial-device" className="w-full">
              <SelectValue placeholder="Choose a device" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((d) => (
                <SelectItem key={d.id} value={d.id} disabled={d.status === "offline"}>
                  <span className="truncate">{d.name}</span>
                  <span className="ml-auto pl-2 text-xs text-muted-foreground">{d.status === "offline" ? "Offline" : d.status === "busy" ? "In session" : d.osVersion}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {device && device.sims.length > 1 && (
        <Tabs value={String(simSlot)} onValueChange={(v) => setSimSlot(Number(v) as 1 | 2)}>
          <TabsList className="w-full">
            {device.sims.map((s) => (
              <TabsTrigger key={s.slot} value={String(s.slot)} disabled={!s.enabled} className="min-w-0 gap-1.5">
                SIM {s.slot}
                <span className="truncate text-xs font-normal text-muted-foreground">{s.label || s.carrier}</span>
                <SignalMeter bars={s.signal} />
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      {device && device.sims.length === 1 && (
        <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
          <span>
            SIM 1 <span className="text-muted-foreground">· {device.sims[0]!.label || device.sims[0]!.carrier}</span>
          </span>
          <span className="flex items-center gap-2">
            <SignalMeter bars={device.sims[0]!.signal} />
            {device.status !== "online" && <DeviceStatusBadge status={device.status} />}
          </span>
        </div>
      )}

      <Field data-invalid={codeInvalid || undefined}>
        <FieldLabel htmlFor="dial-code" className="sr-only">USSD code</FieldLabel>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Grip className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="dial-code"
              value={code}
              onChange={(e) => setCode(sanitizeCodeInput(e.target.value))}
              placeholder="*121#"
              inputMode="tel"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={codeInvalid || undefined}
              className="h-10 pl-9 font-mono text-lg tracking-wider md:text-base"
            />
          </div>
          <Button type="submit" size="lg" className="h-10 px-4" disabled={!!blocker}>
            <Play /> Run
          </Button>
        </div>
        <FieldDescription className={cn(codeInvalid || (blocker && blocker !== "invalid-code" && dirty) ? "text-destructive" : undefined)}>{hint}</FieldDescription>
      </Field>

      {pinned.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 scrollbar-none" role="group" aria-label="Saved codes">
          {pinned.map((c) => (
            <Button key={c.id} type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setCode(c.code)}>
              <span className="font-mono font-semibold text-primary">{c.code}</span>
              {c.label}
            </Button>
          ))}
        </div>
      )}

      <div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setKeypad((k) => !k)} aria-expanded={keypad}>
          {keypad ? "Hide keypad" : "Show keypad"}
        </Button>
        {keypad && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {KEYS.map((k) => (
              <Button key={k} type="button" variant="outline" className="h-12 font-mono text-lg" onClick={() => setCode((c) => sanitizeCodeInput(c + k))}>
                {k}
              </Button>
            ))}
            <Button type="button" variant="ghost" className="col-span-3 h-10" onClick={() => setCode((c) => c.slice(0, -1))} disabled={!code}>
              <Delete /> Backspace
            </Button>
          </div>
        )}
      </div>
    </form>
  )
}
