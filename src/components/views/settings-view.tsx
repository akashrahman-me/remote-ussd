"use client"

import { useState } from "react"
import { Monitor, Moon, PlugZap, RotateCcw, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { PageHeader } from "@/components/app/page-header"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Settings } from "@/lib/types"
import { useAppStore } from "@/store/app-store"

function ToggleRow({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  )
}

export function SettingsView() {
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const resetDemo = useAppStore((s) => s.resetDemo)
  const { theme, setTheme } = useTheme()
  const [draft, setDraft] = useState<Settings>(settings)
  const [testing, setTesting] = useState(false)
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const urlInvalid = !/^wss?:\/\/[^\s]+$/.test(draft.gatewayUrl)
  const timeoutInvalid = !(draft.sessionTimeoutSec >= 10 && draft.sessionTimeoutSec <= 180)
  const nameInvalid = !draft.workspaceName.trim() || !draft.operatorName.trim()
  const invalid = urlInvalid || timeoutInvalid || nameInvalid

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (invalid) return toast.error("Fix the highlighted fields first.")
    updateSettings({ ...draft, workspaceName: draft.workspaceName.trim(), operatorName: draft.operatorName.trim() })
    toast.success("Settings saved")
  }

  async function testConnection() {
    if (urlInvalid) return toast.error("Enter a ws:// or wss:// URL first.")
    setTesting(true)
    await new Promise((r) => setTimeout(r, 900))
    setTesting(false)
    toast.success("Gateway reachable", { description: `${draft.gatewayRegion} · handshake OK (simulated)` })
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6 pb-16">
      <PageHeader title="Settings" description="Workspace, gateway connection, session rules and alerts." />

      <div className="grid gap-6 @5xl/main:grid-cols-2 @5xl/main:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Shown in the sidebar and on exports.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!draft.workspaceName.trim() || undefined}>
                <FieldLabel htmlFor="s-ws">Workspace name</FieldLabel>
                <Input id="s-ws" value={draft.workspaceName} onChange={(e) => set("workspaceName", e.target.value)} />
              </Field>
              <Field data-invalid={!draft.operatorName.trim() || undefined}>
                <FieldLabel htmlFor="s-op">Your name</FieldLabel>
                <Input id="s-op" value={draft.operatorName} onChange={(e) => set("operatorName", e.target.value)} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gateway</CardTitle>
            <CardDescription>The service that relays commands to device agents.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={urlInvalid || undefined}>
                <FieldLabel htmlFor="s-url">WebSocket URL</FieldLabel>
                <Input id="s-url" value={draft.gatewayUrl} onChange={(e) => set("gatewayUrl", e.target.value)} className="font-mono" aria-invalid={urlInvalid || undefined} />
                {urlInvalid && <FieldDescription className="text-destructive">Use a ws:// or wss:// address.</FieldDescription>}
              </Field>
              <div className="flex items-end gap-2">
                <Field className="flex-1">
                  <FieldLabel htmlFor="s-region">Region</FieldLabel>
                  <Select value={draft.gatewayRegion} onValueChange={(v) => set("gatewayRegion", v)}>
                    <SelectTrigger id="s-region" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ap-south">ap-south (Mumbai)</SelectItem>
                      <SelectItem value="ap-southeast">ap-southeast (Singapore)</SelectItem>
                      <SelectItem value="eu-west">eu-west (Ireland)</SelectItem>
                      <SelectItem value="us-east">us-east (Virginia)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Button type="button" variant="outline" onClick={testConnection} disabled={testing}>
                  <PlugZap /> {testing ? "Testing…" : "Test"}
                </Button>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>Rules applied to every USSD session.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={timeoutInvalid || undefined}>
                  <FieldLabel htmlFor="s-timeout">Menu timeout (seconds)</FieldLabel>
                  <Input id="s-timeout" type="number" min={10} max={180} value={draft.sessionTimeoutSec} onChange={(e) => set("sessionTimeoutSec", Number(e.target.value))} />
                  <FieldDescription className={timeoutInvalid ? "text-destructive" : undefined}>10–180s. Most carriers close menus after 30s.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="s-retries">Default retries</FieldLabel>
                  <Select value={String(draft.defaultRetries)} onValueChange={(v) => set("defaultRetries", Number(v))}>
                    <SelectTrigger id="s-retries" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldDescription>For new automations.</FieldDescription>
                </Field>
              </div>
              <ToggleRow id="s-retry-timeout" label="Retry timed-out runs" description="Count timeouts as retryable in automations." checked={draft.autoRetryTimeouts} onChange={(v) => set("autoRetryTimeouts", v)} />
              <ToggleRow id="s-mask" label="Mask sensitive replies" description="Hide PIN steps in consoles, history and exports." checked={draft.maskSensitive} onChange={(v) => set("maskSensitive", v)} />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>What appears in the bell menu.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <ToggleRow id="s-n-fail" label="Automation failures" description="When any target of a flow fails or times out." checked={draft.notifyOnFailure} onChange={(v) => set("notifyOnFailure", v)} />
              <ToggleRow id="s-n-off" label="Devices going offline" description="When an agent stops sending heartbeats." checked={draft.notifyOnOffline} onChange={(v) => set("notifyOnOffline", v)} />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Saved on this browser.</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleGroup type="single" variant="outline" value={theme} onValueChange={(v) => v && setTheme(v)} className="w-full">
              <ToggleGroupItem value="light" className="flex-1"><Sun /> Light</ToggleGroupItem>
              <ToggleGroupItem value="dark" className="flex-1"><Moon /> Dark</ToggleGroupItem>
              <ToggleGroupItem value="system" className="flex-1"><Monitor /> System</ToggleGroupItem>
            </ToggleGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Simulation</CardTitle>
            <CardDescription>This build talks to an in-browser mock gateway. Swap it for the real one in src/lib/gateway.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <ToggleRow id="s-faults" label="Simulate network faults" description="Weak-signal SIMs drop sessions now and then, like real networks." checked={draft.simulateNetworkFaults} onChange={(v) => set("simulateNetworkFaults", v)} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" className="self-start"><RotateCcw /> Reset demo data</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset all demo data?</AlertDialogTitle>
                    <AlertDialogDescription>Devices, history, codes, automations, notifications and settings go back to the sample workspace.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => {
                        resetDemo()
                        setDraft(useAppStore.getState().settings)
                        toast.success("Demo data restored")
                      }}
                    >
                      Reset
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      {dirty && (
        <div className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-popover p-3 shadow-lg md:bottom-6">
          <p className="flex-1 text-sm">You have unsaved changes.</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(settings)}>Discard</Button>
          <Button type="submit" size="sm" disabled={invalid}>Save changes</Button>
        </div>
      )}
    </form>
  )
}
