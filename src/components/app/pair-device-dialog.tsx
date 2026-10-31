"use client"

import { useEffect, useState } from "react"
import { CircleCheck, Loader2, QrCode, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { BatteryIndicator, SignalMeter } from "@/components/app/status"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { uid } from "@/lib/format"
import type { Device, Platform } from "@/lib/types"
import { useAppStore } from "@/store/app-store"

const CODE_TTL = 120

const PROFILES: Record<Platform, Pick<Device, "model" | "osVersion" | "sims">[]> = {
  android: [
    { model: "Samsung Galaxy S24", osVersion: "Android 15", sims: [{ slot: 1, carrier: "Grameenphone", number: "+8801713000555", enabled: true, signal: 4 }, { slot: 2, carrier: "Banglalink", number: "+8801913000281", enabled: true, signal: 3 }] },
    { model: "Nokia G42", osVersion: "Android 14", sims: [{ slot: 1, carrier: "Robi", number: "+8801814000732", enabled: true, signal: 3 }] },
  ],
  ios: [{ model: "iPhone 14", osVersion: "iOS 18.0", sims: [{ slot: 1, carrier: "Grameenphone", number: "+8801714000604", enabled: true, signal: 4 }] }],
}

type Stage = "details" | "waiting" | "found"

function pairingCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function PairDeviceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const addDevice = useAppStore((s) => s.addDevice)
  const devices = useAppStore((s) => s.devices)
  const [stage, setStage] = useState<Stage>("details")
  const [name, setName] = useState("")
  const [platform, setPlatform] = useState<Platform>("android")
  const [code, setCode] = useState("")
  const [left, setLeft] = useState(CODE_TTL)
  const [found, setFound] = useState<Device>()

  // Start fresh each time the dialog closes.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      setStage("details")
      setName("")
      setFound(undefined)
    }
  }

  // Countdown, and the simulated agent connecting a few seconds after the code is shown.
  useEffect(() => {
    if (stage !== "waiting") return
    const tick = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000)
    const connect = setTimeout(() => {
      const profiles = PROFILES[platform]
      const p = profiles[Math.floor(Math.random() * profiles.length)]!
      const now = Date.now()
      setFound({
        id: uid("dev_"), name: name.trim(), platform, model: p.model, osVersion: p.osVersion, sims: p.sims,
        agentVersion: "2.4.1", status: "online", battery: 60 + Math.floor(Math.random() * 40), charging: false,
        defaultSim: 1, lastSeenAt: now, pairedAt: now,
      })
      setStage("found")
    }, 4500)
    return () => {
      clearInterval(tick)
      clearTimeout(connect)
    }
  }, [stage, platform, name])

  const nameTaken = devices.some((d) => d.name.toLowerCase() === name.trim().toLowerCase())
  const nameError = name.trim().length > 0 && name.trim().length < 3 ? "Use at least 3 characters." : nameTaken ? "Another device already uses this name." : undefined

  function start() {
    setCode(pairingCode())
    setLeft(CODE_TTL)
    setStage("waiting")
  }

  function finish() {
    if (!found) return
    addDevice(found)
    toast.success(`${found.name} paired`, { description: `${found.sims.length} SIM${found.sims.length > 1 ? "s" : ""} detected.` })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pair a device</DialogTitle>
          <DialogDescription>
            Install the Relay Agent app on the phone, grant phone and accessibility permissions, then pair it with a one-time code.
          </DialogDescription>
        </DialogHeader>

        {stage === "details" && (
          <FieldGroup>
            <Field data-invalid={!!nameError || undefined}>
              <FieldLabel htmlFor="pair-name">Device name</FieldLabel>
              <Input id="pair-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Galaxy S24 · Rack B2" aria-invalid={!!nameError || undefined} />
              <FieldDescription className={nameError ? "text-destructive" : undefined}>{nameError ?? "Where it lives helps: rack, desk, field."}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="pair-platform">Platform</FieldLabel>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger id="pair-platform" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="android">Android 10 or later</SelectItem>
                  <SelectItem value="ios">iOS 17 or later (assisted mode)</SelectItem>
                </SelectContent>
              </Select>
              {platform === "ios" && (
                <FieldDescription>iOS does not let apps dial USSD silently; the agent runs codes through a Shortcut that needs the phone unlocked.</FieldDescription>
              )}
            </Field>
          </FieldGroup>
        )}

        {stage === "waiting" && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="flex size-28 items-center justify-center rounded-xl border bg-muted/50">
              <QrCode className="size-14 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Enter this code in the agent app</p>
              <p className="mt-1 font-mono text-4xl font-semibold tracking-[0.3em] tabular">{code}</p>
            </div>
            <div className="w-full">
              <Progress value={(left / CODE_TTL) * 100} />
              <p className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                {left > 0 ? <><Loader2 className="size-3.5 animate-spin" /> Waiting for {name}… expires in {left}s</> : "Code expired"}
              </p>
            </div>
          </div>
        )}

        {stage === "found" && found && (
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <CircleCheck className="size-4" /> Agent connected
            </p>
            <div>
              <p className="font-medium">{found.name}</p>
              <p className="text-sm text-muted-foreground">{found.model} · {found.osVersion} · agent {found.agentVersion}</p>
            </div>
            <div className="flex flex-col gap-2">
              {found.sims.map((s) => (
                <div key={s.slot} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                  <span>SIM {s.slot} · {s.carrier} <span className="font-mono text-xs text-muted-foreground">{s.number}</span></span>
                  <SignalMeter bars={s.signal} />
                </div>
              ))}
            </div>
            <BatteryIndicator level={found.battery} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {stage === "details" && <Button onClick={start} disabled={!name.trim() || !!nameError}>Generate pairing code</Button>}
          {stage === "waiting" && <Button variant="secondary" onClick={start}><RefreshCw /> New code</Button>}
          {stage === "found" && <Button onClick={finish}>Add device</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
