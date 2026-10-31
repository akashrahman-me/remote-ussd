"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { uid } from "@/lib/format"
import { DEFAULT_SETTINGS, SEED_CODES, seedAutomations, seedDevices, seedNotifications, seedRuns } from "@/lib/seed"
import { nextRunFor } from "@/lib/ussd"
import type { AppNotification, Automation, Device, Run, RunStep, SavedCode, Settings, Sim } from "@/lib/types"

const MAX_RUNS = 1500

interface Data {
  devices: Device[]
  runs: Run[]
  codes: SavedCode[]
  automations: Automation[]
  notifications: AppNotification[]
  settings: Settings
}

interface AppState extends Data {
  hydrated: boolean
  /** Automations currently executing (not persisted). */
  busyAutomations: string[]
  /** Manual session shown in the dial console (shared by Overview and Dial). */
  consoleRunId?: string

  setConsoleRun: (id?: string) => void

  addDevice: (device: Device) => void
  updateDevice: (id: string, patch: Partial<Device>) => void
  updateSim: (deviceId: string, slot: 1 | 2, patch: Partial<Sim>) => void
  removeDevice: (id: string) => void

  insertRun: (run: Run) => void
  patchRun: (id: string, patch: Partial<Run>) => void
  appendStep: (id: string, step: RunStep) => void
  clearHistory: () => void

  addCode: (code: Omit<SavedCode, "id">) => void
  updateCode: (id: string, patch: Partial<SavedCode>) => void
  removeCode: (id: string) => void

  saveAutomation: (automation: Automation) => void
  patchAutomation: (id: string, patch: Partial<Automation>) => void
  toggleAutomation: (id: string, enabled: boolean) => void
  removeAutomation: (id: string) => void

  notify: (n: Omit<AppNotification, "id" | "at" | "read">) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearNotifications: () => void

  updateSettings: (patch: Partial<Settings>) => void
  resetDemo: () => void
}

function seed(): Data {
  const now = Date.now()
  const devices = seedDevices(now)
  return {
    devices,
    runs: seedRuns(devices, now),
    codes: SEED_CODES,
    automations: seedAutomations(now),
    notifications: seedNotifications(now),
    settings: DEFAULT_SETTINGS,
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...seed(),
      hydrated: false,
      busyAutomations: [],
      consoleRunId: undefined,

      setConsoleRun: (id) => set({ consoleRunId: id }),

      addDevice: (device) => set((s) => ({ devices: [...s.devices, device] })),
      updateDevice: (id, patch) => set((s) => ({ devices: s.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
      updateSim: (deviceId, slot, patch) =>
        set((s) => ({
          devices: s.devices.map((d) =>
            d.id === deviceId ? { ...d, sims: d.sims.map((sim) => (sim.slot === slot ? { ...sim, ...patch } : sim)) } : d,
          ),
        })),
      removeDevice: (id) =>
        set((s) => ({
          devices: s.devices.filter((d) => d.id !== id),
          automations: s.automations.map((a) => ({ ...a, targets: a.targets.filter((t) => t.deviceId !== id) })),
        })),

      insertRun: (run) => set((s) => ({ runs: [run, ...s.runs].slice(0, MAX_RUNS) })),
      patchRun: (id, patch) => set((s) => ({ runs: s.runs.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      appendStep: (id, step) => set((s) => ({ runs: s.runs.map((r) => (r.id === id ? { ...r, steps: [...r.steps, step] } : r)) })),
      clearHistory: () => set((s) => ({ runs: s.runs.filter((r) => r.status === "running" || r.status === "queued") })),

      addCode: (code) => set((s) => ({ codes: [...s.codes, { ...code, id: uid("code_") }] })),
      updateCode: (id, patch) => set((s) => ({ codes: s.codes.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeCode: (id) => set((s) => ({ codes: s.codes.filter((c) => c.id !== id) })),

      saveAutomation: (automation) =>
        set((s) => {
          const next = { ...automation, nextRunAt: automation.enabled ? nextRunFor(automation.schedule) : undefined }
          const exists = s.automations.some((a) => a.id === automation.id)
          return { automations: exists ? s.automations.map((a) => (a.id === automation.id ? next : a)) : [next, ...s.automations] }
        }),
      patchAutomation: (id, patch) => set((s) => ({ automations: s.automations.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      toggleAutomation: (id, enabled) =>
        set((s) => ({
          automations: s.automations.map((a) => (a.id === id ? { ...a, enabled, nextRunAt: enabled ? nextRunFor(a.schedule) : undefined } : a)),
        })),
      removeAutomation: (id) => set((s) => ({ automations: s.automations.filter((a) => a.id !== id) })),

      notify: (n) =>
        set((s) => ({ notifications: [{ ...n, id: uid("n_"), at: Date.now(), read: false }, ...s.notifications].slice(0, 50) })),
      markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      clearNotifications: () => set({ notifications: [] }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetDemo: () => set({ ...seed(), consoleRunId: undefined }),
    }),
    {
      name: "relay-ussd",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s): Data => ({
        devices: s.devices,
        runs: s.runs,
        codes: s.codes,
        automations: s.automations,
        notifications: s.notifications,
        settings: s.settings,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Sessions cannot survive a reload: close anything left open and free the devices.
        const now = Date.now()
        useAppStore.setState({
          hydrated: true,
          runs: state.runs.map((r) =>
            r.status === "running" || r.status === "queued"
              ? { ...r, status: "cancelled", awaitingInput: false, endedAt: now, error: "Session interrupted (dashboard reloaded)." }
              : r,
          ),
          devices: state.devices.map((d) => ({ ...d, activeRunId: undefined, status: d.status === "busy" ? "online" : d.status })),
        })
      },
    },
  ),
)

export const selectDevice = (id?: string) => (s: AppState) => s.devices.find((d) => d.id === id)
export const selectRun = (id?: string) => (s: AppState) => s.runs.find((r) => r.id === id)
