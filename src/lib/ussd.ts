import type { Device, Run, RunStatus, Schedule, Sim } from "@/lib/types"

/** A USSD/MMI code starts with * or #, contains digits, * and #, and ends with #. */
export const USSD_CODE_RE = /^[*#][0-9*#]*#$/
export const REPLY_RE = /^[0-9*#]{1,20}$/

export function isValidCode(code: string) {
  return USSD_CODE_RE.test(code.trim())
}

export function sanitizeCodeInput(value: string) {
  return value.replace(/[^0-9*#]/g, "").slice(0, 40)
}

export interface MenuOption {
  key: string
  label: string
}

/** Lines shaped "1. Label" or "1) Label" become tap-to-reply options. */
export function parseMenuOptions(text: string): MenuOption[] {
  const out: MenuOption[] = []
  for (const line of text.split("\n")) {
    const m = /^\s*(\d{1,2})[.)]\s+(.+)$/.exec(line)
    if (m) out.push({ key: m[1], label: m[2].trim() })
  }
  return out
}

const FAILURE_RE = /(invalid|error|failed|failure|problem|not allowed|insufficient|unknown application|try again)/i

export function looksLikeFailure(text: string) {
  return FAILURE_RE.test(text)
}

/** `expect` is either plain text (case-insensitive contains) or /pattern/flags. */
export function matchesExpectation(text: string, expect?: string) {
  if (!expect?.trim()) return true
  const re = /^\/(.+)\/([gimsuy]*)$/.exec(expect.trim())
  if (re) {
    try {
      return new RegExp(re[1], re[2]).test(text)
    } catch {
      return false
    }
  }
  return text.toLowerCase().includes(expect.trim().toLowerCase())
}

export function maskValue(value: string) {
  return "•".repeat(Math.max(4, value.length))
}

export function isTerminal(status: RunStatus) {
  return status === "success" || status === "failed" || status === "timeout" || status === "cancelled"
}

export function runDuration(run: Run, now = Date.now()) {
  return ((run.endedAt ?? now) - run.startedAt) / 1000
}

export function simLabel(sim?: Sim) {
  if (!sim) return "No SIM"
  return `SIM ${sim.slot} · ${sim.label || sim.carrier}`
}

export type DialBlocker =
  | "device-missing"
  | "device-offline"
  | "device-busy"
  | "sim-missing"
  | "sim-disabled"
  | "no-signal"
  | "invalid-code"

export const BLOCKER_MESSAGES: Record<DialBlocker, string> = {
  "device-missing": "Select a device first.",
  "device-offline": "This device is offline. Wait for it to reconnect.",
  "device-busy": "This device already has a USSD session open. End it or wait.",
  "sim-missing": "This SIM slot is empty.",
  "sim-disabled": "This SIM is disabled for automation.",
  "no-signal": "No network on this SIM.",
  "invalid-code": "A USSD code starts with * or # and ends with #.",
}

/** Business rules for opening a session; returns the first rule that blocks it. */
export function dialBlocker(device: Device | undefined, simSlot: number, code?: string): DialBlocker | null {
  if (!device) return "device-missing"
  if (device.status === "offline") return "device-offline"
  if (device.activeRunId) return "device-busy"
  const sim = device.sims.find((s) => s.slot === simSlot)
  if (!sim) return "sim-missing"
  if (!sim.enabled) return "sim-disabled"
  if (sim.signal === 0) return "no-signal"
  if (code !== undefined && !isValidCode(code)) return "invalid-code"
  return null
}

export function nextRunFor(schedule: Schedule, from = Date.now()): number | undefined {
  if (schedule.kind === "manual") return undefined
  if (schedule.kind === "interval") return from + Math.max(1, schedule.minutes) * 60_000
  const [hh, mm] = schedule.time.split(":").map(Number)
  const next = new Date(from)
  next.setHours(hh || 0, mm || 0, 0, 0)
  if (next.getTime() <= from) next.setDate(next.getDate() + 1)
  return next.getTime()
}

export function describeSchedule(schedule: Schedule) {
  if (schedule.kind === "manual") return "Manual"
  if (schedule.kind === "interval") {
    const m = schedule.minutes
    return m % 60 === 0 ? `Every ${m / 60}h` : `Every ${m} min`
  }
  return `Daily at ${schedule.time}`
}
