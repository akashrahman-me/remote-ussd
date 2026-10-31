import { Suspense } from "react"
import type { Metadata } from "next"
import { PageSkeleton } from "@/components/app/app-frame"
import { DevicesView } from "@/components/views/devices-view"

export const metadata: Metadata = { title: "Devices" }

export default function DevicesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DevicesView />
    </Suspense>
  )
}

// Client-rendered from the browser store; skip instant-navigation validation.
export const instant = false
