import type { Metadata } from "next"
import { SettingsView } from "@/components/views/settings-view"

export const metadata: Metadata = { title: "Settings" }

export default function SettingsPage() {
  return <SettingsView />
}

// Client-rendered from the browser store; skip instant-navigation validation.
export const instant = false
