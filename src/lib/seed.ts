import { resolveCode } from "@/lib/gateway/network"
import { nextRunFor } from "@/lib/ussd"
import type { Automation, AppNotification, Device, Run, RunStatus, SavedCode, Settings } from "@/lib/types"

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DEFAULT_SETTINGS: Settings = {
  workspaceName: "Relay Ops",
  operatorName: "Operator",
  gatewayUrl: "wss://gateway.relay.example/v1",
  gatewayRegion: "ap-south",
  sessionTimeoutSec: 30,
  defaultRetries: 1,
  maskSensitive: true,
  autoRetryTimeouts: true,
  notifyOnFailure: true,
  notifyOnOffline: true,
  simulateNetworkFaults: true,
}

export function seedDevices(now: number): Device[] {
  return [
    {
      id: "dev_px8", name: "Pixel 8 · Rack A1", model: "Google Pixel 8", platform: "android", osVersion: "Android 15", agentVersion: "2.4.1",
      status: "online", battery: 92, charging: true, defaultSim: 1, lastSeenAt: now, pairedAt: now - 86400_000 * 41,
      sims: [
        { slot: 1, carrier: "Grameenphone", number: "+8801711000142", enabled: true, signal: 4 },
        { slot: 2, carrier: "Robi", number: "+8801811000917", enabled: true, signal: 3 },
      ],
    },
    {
      id: "dev_ip15", name: "iPhone 15 · Desk", model: "iPhone 15", platform: "ios", osVersion: "iOS 18.1", agentVersion: "2.3.0",
      status: "online", battery: 64, charging: false, defaultSim: 1, lastSeenAt: now, pairedAt: now - 86400_000 * 19,
      sims: [{ slot: 1, carrier: "Banglalink", number: "+8801911000388", enabled: true, signal: 3 }],
    },
    {
      id: "dev_a54", name: "Galaxy A54 · Rack A2", model: "Samsung Galaxy A54", platform: "android", osVersion: "Android 14", agentVersion: "2.4.1",
      status: "online", battery: 41, charging: false, defaultSim: 2, lastSeenAt: now, pairedAt: now - 86400_000 * 33,
      sims: [
        { slot: 1, carrier: "Teletalk", number: "+8801511000451", enabled: true, signal: 2 },
        { slot: 2, carrier: "Grameenphone", number: "+8801712000773", enabled: true, signal: 4 },
      ],
    },
    {
      id: "dev_moto", name: "Moto G84 · Rack B1", model: "Motorola G84", platform: "android", osVersion: "Android 14", agentVersion: "2.4.0",
      status: "online", battery: 78, charging: true, defaultSim: 1, lastSeenAt: now, pairedAt: now - 86400_000 * 8,
      sims: [
        { slot: 1, carrier: "Airtel", number: "+8801611000206", enabled: true, signal: 1, label: "Airtel test line" },
        { slot: 2, carrier: "Robi", number: "+8801812000664", enabled: false, signal: 3 },
      ],
    },
    {
      id: "dev_rn13", name: "Redmi Note 13 · Field", model: "Xiaomi Redmi Note 13", platform: "android", osVersion: "Android 14", agentVersion: "2.2.7",
      status: "offline", battery: 12, charging: false, defaultSim: 1, lastSeenAt: now - 2 * 3600_000, pairedAt: now - 86400_000 * 60,
      sims: [{ slot: 1, carrier: "Robi", number: "+8801813000120", enabled: true, signal: 0 }],
    },
  ]
}

export const SEED_CODES: SavedCode[] = [
  { id: "code_main", code: "*121#", label: "Main menu", pinned: true },
  { id: "code_bal", code: "*566#", label: "Balance", pinned: true },
  { id: "code_data", code: "*121*2#", label: "Internet packs", pinned: true },
  { id: "code_num", code: "*2#", label: "Own number", pinned: true },
  { id: "code_mb", code: "*8444*88#", label: "Internet balance", pinned: false },
  { id: "code_min", code: "*121*3#", label: "Minute packs", pinned: false },
]

export function seedAutomations(now: number): Automation[] {
  const list: Automation[] = [
    {
      id: "auto_balance", name: "Daily balance check", description: "Reads the main balance on every active SIM each morning.",
      steps: [{ id: "s1", value: "*566#", expect: "/balance is Tk/i" }],
      targets: [{ deviceId: "dev_px8", simSlot: 1 }, { deviceId: "dev_px8", simSlot: 2 }, { deviceId: "dev_ip15", simSlot: 1 }, { deviceId: "dev_a54", simSlot: 2 }],
      schedule: { kind: "daily", time: "09:00" }, enabled: true, maxRetries: 2, createdAt: now - 86400_000 * 30,
      lastRunAt: now - 5 * 3600_000, lastStatus: "success",
    },
    {
      id: "auto_renew", name: "5 GB pack renewal", description: "Buys the 30-day 5 GB pack on the rack A1 primary line.",
      steps: [
        { id: "s1", value: "*121#", expect: "Internet Packs" },
        { id: "s2", value: "2", expect: "5 GB" },
        { id: "s3", value: "2", expect: "Confirm" },
        { id: "s4", value: "1", expect: "activated" },
      ],
      targets: [{ deviceId: "dev_px8", simSlot: 1 }],
      schedule: { kind: "daily", time: "08:30" }, enabled: false, maxRetries: 1, createdAt: now - 86400_000 * 12,
      lastRunAt: now - 86400_000 * 3, lastStatus: "success",
    },
    {
      id: "auto_probe", name: "Line health probe", description: "Confirms the SIM answers USSD every 30 minutes.",
      steps: [{ id: "s1", value: "*2#", expect: "/your number is/i" }],
      targets: [{ deviceId: "dev_a54", simSlot: 1 }, { deviceId: "dev_moto", simSlot: 1 }],
      schedule: { kind: "interval", minutes: 30 }, enabled: true, maxRetries: 1, createdAt: now - 86400_000 * 6,
      lastRunAt: now - 22 * 60_000, lastStatus: "timeout",
    },
  ]
  return list.map((a) => ({ ...a, nextRunAt: a.enabled ? nextRunFor(a.schedule, now) : undefined }))
}

const HISTORY_CODES = ["*566#", "*566#", "*121#", "*2#", "*8444*88#", "*121*1#", "*124#", "*222#"]

export function seedRuns(devices: Device[], now: number): Run[] {
  const rand = rng(20261101)
  const runs: Run[] = []
  for (let day = 6; day >= 0; day--) {
    const count = 34 + Math.floor(rand() * 26) + (6 - day) * 3
    for (let i = 0; i < count; i++) {
      const startedAt = now - day * 86400_000 - Math.floor(rand() * 86400_000)
      if (startedAt > now - 60_000) continue
      const device = devices[Math.floor(rand() * devices.length)]
      const sim = device.sims[Math.floor(rand() * device.sims.length)]
      const code = HISTORY_CODES[Math.floor(rand() * HISTORY_CODES.length)]
      const roll = rand()
      const status: RunStatus = roll < 0.9 ? "success" : roll < 0.95 ? "failed" : roll < 0.985 ? "timeout" : "cancelled"
      const duration = 1500 + rand() * (status === "timeout" ? 28000 : 7000)
      const node = resolveCode(code)
      const ctx = { carrier: sim.carrier, number: sim.number }
      const reply =
        status === "success"
          ? node?.final ? node.text(ctx) : "Balance: see menu"
          : status === "failed"
            ? "Connection problem or invalid MMI code."
            : status === "timeout"
              ? "Session expired: no reply before the network timeout."
              : "Session cancelled by operator."
      const result = status === "success" && !node?.final ? (node ? node.text(ctx).split("\n")[0] : reply) : reply.split("\n")[0]
      const automationId = rand() < 0.45 ? (code === "*2#" ? "auto_probe" : code === "*566#" ? "auto_balance" : undefined) : undefined
      runs.push({
        id: `run_${day}_${i}`,
        code, deviceId: device.id, simSlot: sim.slot,
        source: automationId ? "automation" : "manual", automationId,
        status, awaitingInput: false, startedAt, endedAt: startedAt + duration, attempt: 1,
        steps: [
          { dir: "out", text: code, at: startedAt },
          { dir: status === "success" ? "in" : "sys", text: status === "success" && node ? node.text(ctx) : reply, at: startedAt + duration },
        ],
        result: status === "success" ? result : undefined,
        error: status === "success" ? undefined : result,
      })
    }
  }
  return runs.sort((a, b) => b.startedAt - a.startedAt)
}

export function seedNotifications(now: number): AppNotification[] {
  return [
    { id: "n1", kind: "offline", title: "Redmi Note 13 · Field went offline", body: "No heartbeat for 2 hours. Battery was at 12%.", at: now - 2 * 3600_000, read: false, href: "/devices/dev_rn13" },
    { id: "n2", kind: "failure", title: "Line health probe timed out", body: "Moto G84 · Rack B1, SIM 1: session expired after 30s.", at: now - 22 * 60_000, read: false, href: "/automations" },
    { id: "n3", kind: "success", title: "Daily balance check completed", body: "4 of 4 SIMs reported a balance.", at: now - 5 * 3600_000, read: true, href: "/history" },
  ]
}
