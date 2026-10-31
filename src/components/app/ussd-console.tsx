"use client"

import { useEffect, useRef, useState } from "react"
import { Grip, RefreshCw, Send, Smartphone, X } from "lucide-react"
import { toast } from "sonner"
import { RunStatusBadge } from "@/components/app/status"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useNow } from "@/hooks/use-now"
import { cancelRun, replyToRun, retryRun } from "@/lib/engine"
import { clock, seconds } from "@/lib/format"
import { maskValue, parseMenuOptions, runDuration, simLabel } from "@/lib/ussd"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"

export function UssdConsole({ runId, className, onClear }: { runId?: string; className?: string; onClear?: () => void }) {
  const run = useAppStore((s) => s.runs.find((r) => r.id === runId))
  const device = useAppStore((s) => s.devices.find((d) => d.id === run?.deviceId))
  const maskSensitive = useAppStore((s) => s.settings.maskSensitive)
  const [reply, setReply] = useState("")
  const logRef = useRef<HTMLDivElement>(null)
  const now = useNow(250)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" })
  }, [run?.steps.length, run?.status])

  const live = run?.status === "running"
  const awaiting = !!run?.awaitingInput && live
  const lastIn = run ? [...run.steps].reverse().find((s) => s.dir === "in") : undefined
  const options = awaiting && lastIn ? parseMenuOptions(lastIn.text) : []

  function send(value: string) {
    if (!run) return
    const err = replyToRun(run.id, value)
    if (err) toast.error(err)
    else setReply("")
  }

  const sim = device?.sims.find((s) => s.slot === run?.simSlot)

  return (
    <Card className={cn("gap-0 py-0", className)} aria-label="USSD session console">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", live ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          <Smartphone className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{device?.name ?? "No active session"}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {run ? `${simLabel(sim)} · ${seconds(runDuration(run, now))}` : "Dial a code to open a session"}
          </p>
        </div>
        {run && <RunStatusBadge status={run.status} awaiting={run.awaitingInput} />}
        {live && (
          <Button variant="ghost" size="icon-sm" aria-label="End session" onClick={() => cancelRun(run.id)}>
            <X />
          </Button>
        )}
      </div>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        className="flex min-h-72 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain bg-muted/40 p-4 md:max-h-[28rem]"
      >
        {!run && (
          <div className="m-auto flex max-w-56 flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <Grip className="size-7" />
            <p className="font-medium text-foreground">No active session</p>
            <p>Dial a code to start. Carrier menus and your replies appear here in real time.</p>
          </div>
        )}
        {run?.steps.map((s, i) => {
          if (s.dir === "sys") {
            return (
              <p key={i} className="self-center rounded-md px-2 py-0.5 text-center text-xs font-medium text-muted-foreground">
                {s.text}
              </p>
            )
          }
          const out = s.dir === "out"
          const text = s.masked && maskSensitive ? maskValue(s.text) : s.text
          return (
            <div key={i} className={cn("flex max-w-[88%] flex-col gap-1", out ? "items-end self-end" : "items-start self-start")}>
              <div
                className={cn(
                  "rounded-xl px-3 py-2 font-mono text-sm whitespace-pre-wrap [overflow-wrap:anywhere]",
                  out ? "rounded-br-sm bg-primary font-semibold tracking-wide text-primary-foreground" : "rounded-bl-sm border bg-card shadow-xs",
                )}
              >
                {text}
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {out ? "Sent" : "Network"} · {clock(s.at)}
              </span>
            </div>
          )
        })}
        {live && !run.awaitingInput && (
          <div className="flex h-9 items-center gap-1 self-start rounded-xl rounded-bl-sm border bg-card px-3" role="status" aria-label="Waiting for network">
            {[0, 1, 2].map((i) => (
              <i key={i} className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        )}
      </div>

      {options.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t px-4 pt-3 scrollbar-none" role="group" aria-label="Menu options">
          {options.map((o) => (
            <Button key={o.key} variant="outline" size="sm" className="rounded-full" onClick={() => send(o.key)}>
              <span className="font-mono font-semibold text-primary">{o.key}</span>
              {o.label}
            </Button>
          ))}
        </div>
      )}

      {run && !live ? (
        <div className="flex items-center gap-2 border-t px-4 py-3">
          <p className="flex-1 truncate text-sm text-muted-foreground">{run.result ?? run.error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const res = retryRun(run.id)
              if (!res.ok) toast.error(res.message)
            }}
          >
            <RefreshCw /> Run again
          </Button>
          {onClear && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          )}
        </div>
      ) : (
        <form
          className={cn("flex gap-2 px-4 pb-4", options.length ? "pt-3" : "border-t pt-3")}
          onSubmit={(e) => {
            e.preventDefault()
            send(reply)
          }}
        >
          <Input
            value={reply}
            onChange={(e) => setReply(e.target.value.replace(/[^0-9*#]/g, ""))}
            placeholder={awaiting ? "Reply with an option number" : live ? "Waiting for the network…" : "No active session"}
            disabled={!awaiting}
            inputMode="tel"
            aria-label="Reply"
            className="font-mono"
          />
          <Button type="submit" size="icon-lg" aria-label="Send reply" disabled={!awaiting || !reply}>
            <Send />
          </Button>
        </form>
      )}
    </Card>
  )
}
