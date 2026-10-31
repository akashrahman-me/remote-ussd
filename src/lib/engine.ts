"use client"

import { gateway, type SessionHandle } from "@/lib/gateway"
import { uid } from "@/lib/format"
import {
  BLOCKER_MESSAGES,
  REPLY_RE,
  dialBlocker,
  isTerminal,
  looksLikeFailure,
  matchesExpectation,
  nextRunFor,
  simLabel,
  type DialBlocker,
} from "@/lib/ussd"
import type { Automation, AutomationTarget, Run, RunSource, RunStatus } from "@/lib/types"
import { useAppStore } from "@/store/app-store"

/**
 * Session engine: applies the business rules, drives the gateway and records every run.
 * UI components call these functions; they never talk to the gateway directly.
 */

type MessageHook = (text: string, final: boolean) => void

const handles = new Map<string, SessionHandle>()
const messageHooks = new Map<string, MessageHook>()
const settlers = new Map<string, (status: RunStatus) => void>()

const store = () => useAppStore.getState()

export type StartResult = { ok: true; runId: string } | { ok: false; blocker: DialBlocker; message: string }

interface OpenOptions {
  deviceId: string
  simSlot: 1 | 2
  code: string
  source: RunSource
  automationId?: string
  attempt?: number
}

function openSession(opts: OpenOptions): StartResult {
  const s = store()
  const device = s.devices.find((d) => d.id === opts.deviceId)
  const code = opts.code.trim()
  const blocker = dialBlocker(device, opts.simSlot, code)
  if (blocker || !device) {
    const b = blocker ?? "device-missing"
    return { ok: false, blocker: b, message: BLOCKER_MESSAGES[b] }
  }
  const sim = device.sims.find((x) => x.slot === opts.simSlot)!
  const now = Date.now()
  const run: Run = {
    id: uid("run_"),
    code,
    deviceId: device.id,
    simSlot: opts.simSlot,
    source: opts.source,
    automationId: opts.automationId,
    status: "running",
    awaitingInput: false,
    startedAt: now,
    attempt: opts.attempt ?? 1,
    steps: [
      { dir: "sys", text: `Dialing on ${device.name} · ${simLabel(sim)}`, at: now },
      { dir: "out", text: code, at: now },
    ],
  }
  s.insertRun(run)
  s.updateDevice(device.id, { status: "busy", activeRunId: run.id })

  const handle = gateway.dial(
    {
      deviceId: device.id,
      simSlot: opts.simSlot,
      code,
      carrier: sim.carrier,
      number: sim.number,
      signal: sim.signal,
      timeoutSec: s.settings.sessionTimeoutSec,
      faults: s.settings.simulateNetworkFaults,
    },
    {
      onMessage(text, final) {
        if (!isLive(run.id)) return
        store().appendStep(run.id, { dir: "in", text, at: Date.now() })
        const hook = messageHooks.get(run.id)
        if (hook) return hook(text, final)
        if (final) finishRun(run.id, looksLikeFailure(text) ? "failed" : "success", text)
        else store().patchRun(run.id, { awaitingInput: true })
      },
      onError(code, message) {
        if (!isLive(run.id)) return
        store().appendStep(run.id, { dir: "sys", text: message, at: Date.now() })
        finishRun(run.id, code === "timeout" ? "timeout" : code === "cancelled" ? "cancelled" : "failed", message)
      },
    },
  )
  handles.set(run.id, handle)
  return { ok: true, runId: run.id }
}

function isLive(runId: string) {
  const run = store().runs.find((r) => r.id === runId)
  return !!run && !isTerminal(run.status)
}

function finishRun(runId: string, status: RunStatus, message: string) {
  const s = store()
  const run = s.runs.find((r) => r.id === runId)
  if (!run || isTerminal(run.status)) return
  const firstLine = message.split("\n")[0]
  s.patchRun(runId, {
    status,
    awaitingInput: false,
    endedAt: Date.now(),
    result: status === "success" ? firstLine : undefined,
    error: status === "success" ? undefined : firstLine,
  })
  const device = s.devices.find((d) => d.id === run.deviceId)
  if (device && device.activeRunId === runId) {
    s.updateDevice(device.id, { activeRunId: undefined, status: device.status === "offline" ? "offline" : "online" })
  }
  const handle = handles.get(runId)
  handles.delete(runId)
  messageHooks.delete(runId)
  handle?.cancel()
  settlers.get(runId)?.(status)
  settlers.delete(runId)
}

/* ---------------- Manual sessions ---------------- */

export function startManualRun(deviceId: string, simSlot: 1 | 2, code: string): StartResult {
  const res = openSession({ deviceId, simSlot, code, source: "manual" })
  if (res.ok) store().setConsoleRun(res.runId)
  return res
}

export function replyToRun(runId: string, input: string, masked = false): string | null {
  const value = input.trim()
  const run = store().runs.find((r) => r.id === runId)
  if (!run || run.status !== "running") return "This session is no longer active."
  if (!run.awaitingInput) return "Wait for the network to answer first."
  if (!REPLY_RE.test(value)) return "Replies can only contain digits, * and #."
  store().appendStep(runId, { dir: "out", text: value, at: Date.now(), masked })
  store().patchRun(runId, { awaitingInput: false })
  handles.get(runId)?.reply(value)
  return null
}

export function cancelRun(runId: string) {
  const handle = handles.get(runId)
  if (handle) handle.cancel()
  else finishRun(runId, "cancelled", "Session cancelled by operator.")
}

/** Re-run a finished run with the same code, device and SIM. */
export function retryRun(runId: string): StartResult {
  const run = store().runs.find((r) => r.id === runId)
  if (!run) return { ok: false, blocker: "device-missing", message: "Run not found." }
  return startManualRun(run.deviceId, run.simSlot, run.code)
}

/* ---------------- Automations ---------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function setBusy(id: string, busy: boolean) {
  useAppStore.setState((s) => ({
    busyAutomations: busy ? [...new Set([...s.busyAutomations, id])] : s.busyAutomations.filter((x) => x !== id),
  }))
}

async function waitForFreeDevice(deviceId: string, maxMs = 20_000) {
  const until = Date.now() + maxMs
  while (Date.now() < until) {
    const d = store().devices.find((x) => x.id === deviceId)
    if (!d || !d.activeRunId) return
    await sleep(500)
  }
}

function recordBlocked(a: Automation, t: AutomationTarget, attempt: number, message: string) {
  const now = Date.now()
  const step = a.steps[0]
  store().insertRun({
    id: uid("run_"), code: step?.value ?? "", deviceId: t.deviceId, simSlot: t.simSlot,
    source: "automation", automationId: a.id, status: "failed", awaitingInput: false,
    startedAt: now, endedAt: now, attempt, error: message,
    steps: [{ dir: "sys", text: message, at: now }],
  })
}

function runAutomationOnce(a: Automation, t: AutomationTarget, attempt: number): Promise<RunStatus> {
  const first = a.steps[0]
  const res = openSession({ deviceId: t.deviceId, simSlot: t.simSlot, code: first.value, source: "automation", automationId: a.id, attempt })
  if (!res.ok) {
    recordBlocked(a, t, attempt, res.message)
    return Promise.resolve("failed")
  }
  const runId = res.runId
  const mask = store().settings.maskSensitive
  let index = 0
  return new Promise<RunStatus>((resolve) => {
    settlers.set(runId, resolve)
    messageHooks.set(runId, (text, final) => {
      const step = a.steps[index]
      if (!matchesExpectation(text, step.expect)) {
        finishRun(runId, "failed", `Step ${index + 1}: expected “${step.expect}” in the network reply.`)
        return
      }
      index += 1
      if (index >= a.steps.length) {
        finishRun(runId, looksLikeFailure(text) && !step.expect ? "failed" : "success", text)
        return
      }
      if (final) {
        finishRun(runId, "failed", `The network closed the session before step ${index + 1}.`)
        return
      }
      store().patchRun(runId, { awaitingInput: true })
      const next = a.steps[index]
      setTimeout(() => replyToRun(runId, next.value, mask && !!next.sensitive), 350)
    })
  })
}

export async function executeAutomation(automationId: string) {
  const a = store().automations.find((x) => x.id === automationId)
  if (!a || store().busyAutomations.includes(a.id)) return
  if (a.steps.length === 0 || a.targets.length === 0) return
  setBusy(a.id, true)
  const { autoRetryTimeouts, notifyOnFailure } = store().settings
  const results: RunStatus[] = []
  try {
    for (const target of a.targets) {
      let status: RunStatus = "failed"
      for (let attempt = 1; attempt <= 1 + a.maxRetries; attempt++) {
        await waitForFreeDevice(target.deviceId)
        status = await runAutomationOnce(a, target, attempt)
        const retryable = status === "failed" || (status === "timeout" && autoRetryTimeouts)
        if (!retryable) break
        if (attempt <= a.maxRetries) await sleep(1500)
      }
      results.push(status)
    }
  } finally {
    setBusy(a.id, false)
  }
  const failed = results.filter((r) => r !== "success").length
  const worst: RunStatus = failed === 0 ? "success" : results.includes("timeout") && !results.includes("failed") ? "timeout" : "failed"
  const latest = store().automations.find((x) => x.id === a.id)
  store().patchAutomation(a.id, {
    lastRunAt: Date.now(),
    lastStatus: worst,
    nextRunAt: latest?.enabled ? nextRunFor(latest.schedule) : undefined,
  })
  if (failed > 0 && notifyOnFailure) {
    store().notify({ kind: "failure", title: `${a.name} had ${failed} failed target${failed > 1 ? "s" : ""}`, body: `${results.length - failed} of ${results.length} targets succeeded.`, href: "/history" })
  } else if (failed === 0) {
    store().notify({ kind: "success", title: `${a.name} completed`, body: `${results.length} of ${results.length} targets succeeded.`, href: "/history" })
  }
  return worst
}

/* ---------------- Devices ---------------- */

export async function pingDevice(deviceId: string): Promise<{ ok: true; ms: number } | { ok: false; message: string }> {
  const d = store().devices.find((x) => x.id === deviceId)
  if (!d) return { ok: false, message: "Device not found." }
  if (d.status === "offline") return { ok: false, message: `${d.name} is offline.` }
  const ms = await gateway.ping(deviceId)
  store().updateDevice(deviceId, { lastSeenAt: Date.now() })
  return { ok: true, ms }
}

export async function restartAgent(deviceId: string) {
  const d = store().devices.find((x) => x.id === deviceId)
  if (!d || d.status === "offline") return false
  if (d.activeRunId) cancelRun(d.activeRunId)
  store().updateDevice(deviceId, { status: "offline" })
  await sleep(2500)
  store().updateDevice(deviceId, { status: "online", lastSeenAt: Date.now() })
  return true
}

/* ---------------- Background runtime ---------------- */

function heartbeat() {
  const now = Date.now()
  const { devices, settings } = store()
  const wentOffline: string[] = []
  const next = devices.map((d) => {
    if (d.status === "offline") return d
    let { battery, charging } = d
    if (charging) battery = Math.min(100, battery + (Math.random() < 0.4 ? 1 : 0))
    else if (Math.random() < 0.15) battery = Math.max(0, battery - 1)
    if (battery >= 100) charging = false
    if (!charging && battery <= 15 && Math.random() < 0.3) charging = true
    const sims = d.sims.map((sim) => {
      if (sim.signal === 0 || Math.random() > 0.06) return sim
      const delta = Math.random() < 0.5 ? -1 : 1
      return { ...sim, signal: Math.min(4, Math.max(1, sim.signal + delta)) as typeof sim.signal }
    })
    if (battery === 0) {
      wentOffline.push(d.name)
      return { ...d, battery, charging, sims, status: "offline" as const }
    }
    return { ...d, battery, charging, sims, lastSeenAt: now }
  })
  useAppStore.setState({ devices: next })
  if (settings.notifyOnOffline) {
    for (const name of wentOffline) store().notify({ kind: "offline", title: `${name} went offline`, body: "The battery ran out.", href: "/devices" })
  }
}

function scheduler() {
  const now = Date.now()
  for (const a of store().automations) {
    if (!a.enabled || !a.nextRunAt || a.nextRunAt > now) continue
    if (store().busyAutomations.includes(a.id)) continue
    store().patchAutomation(a.id, { nextRunAt: nextRunFor(a.schedule, now) })
    void executeAutomation(a.id)
  }
}

let started = false

/** Starts heartbeats and the automation scheduler. Runs while the dashboard is open. */
export function startRuntime() {
  if (started) return () => {}
  started = true
  const hb = setInterval(heartbeat, 4000)
  const sc = setInterval(scheduler, 10_000)
  scheduler()
  return () => {
    clearInterval(hb)
    clearInterval(sc)
    started = false
  }
}
