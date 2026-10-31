export type Platform = "android" | "ios"
export type DeviceStatus = "online" | "busy" | "offline"
export type SignalBars = 0 | 1 | 2 | 3 | 4

export interface Sim {
  slot: 1 | 2
  carrier: string
  number: string
  label?: string
  enabled: boolean
  signal: SignalBars
}

export interface Device {
  id: string
  name: string
  model: string
  platform: Platform
  osVersion: string
  agentVersion: string
  status: DeviceStatus
  battery: number
  charging: boolean
  sims: Sim[]
  defaultSim: 1 | 2
  lastSeenAt: number
  pairedAt: number
  /** Run currently occupying the device's USSD channel. */
  activeRunId?: string
}

export type RunStatus = "queued" | "running" | "success" | "failed" | "timeout" | "cancelled"
export type RunSource = "manual" | "automation"

export interface RunStep {
  dir: "out" | "in" | "sys"
  text: string
  at: number
  masked?: boolean
}

export interface Run {
  id: string
  code: string
  deviceId: string
  simSlot: 1 | 2
  source: RunSource
  automationId?: string
  status: RunStatus
  /** True while the network menu waits for an operator reply. */
  awaitingInput: boolean
  startedAt: number
  endedAt?: number
  steps: RunStep[]
  result?: string
  error?: string
  attempt: number
}

export interface SavedCode {
  id: string
  code: string
  label: string
  carrier?: string
  pinned: boolean
}

export interface AutomationStep {
  id: string
  /** First step is the dial code; later steps are menu replies. */
  value: string
  /** Text (or /regex/) the network reply must contain before moving on. */
  expect?: string
  sensitive?: boolean
}

export type Schedule =
  | { kind: "manual" }
  | { kind: "interval"; minutes: number }
  | { kind: "daily"; time: string }

export interface AutomationTarget {
  deviceId: string
  simSlot: 1 | 2
}

export interface Automation {
  id: string
  name: string
  description?: string
  steps: AutomationStep[]
  targets: AutomationTarget[]
  schedule: Schedule
  enabled: boolean
  maxRetries: number
  createdAt: number
  lastRunAt?: number
  lastStatus?: RunStatus
  nextRunAt?: number
}

export type NotificationKind = "failure" | "offline" | "success" | "info"

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  at: number
  read: boolean
  href?: string
}

export interface Settings {
  workspaceName: string
  operatorName: string
  gatewayUrl: string
  gatewayRegion: string
  sessionTimeoutSec: number
  defaultRetries: number
  maskSensitive: boolean
  autoRetryTimeouts: boolean
  notifyOnFailure: boolean
  notifyOnOffline: boolean
  simulateNetworkFaults: boolean
}
