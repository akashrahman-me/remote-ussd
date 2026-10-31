import { OverviewView } from "@/components/views/overview-view"

export default function OverviewPage() {
  return <OverviewView />
}

// Client-rendered from the browser store; skip instant-navigation validation.
export const instant = false
