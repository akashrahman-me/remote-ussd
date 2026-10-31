import type { Metadata } from "next"
import { HistoryView } from "@/components/views/history-view"

export const metadata: Metadata = { title: "History" }

export default function HistoryPage() {
  return <HistoryView />
}

// Client-rendered from the browser store; skip instant-navigation validation.
export const instant = false
