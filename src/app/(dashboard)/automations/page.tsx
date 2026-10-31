import type { Metadata } from "next"
import { AutomationsView } from "@/components/views/automations-view"

export const metadata: Metadata = { title: "Automations" }

export default function AutomationsPage() {
  return <AutomationsView />
}

// Client-rendered from the browser store; skip instant-navigation validation.
export const instant = false
