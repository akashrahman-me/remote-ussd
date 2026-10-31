import { Suspense } from "react"
import type { Metadata } from "next"
import { PageSkeleton } from "@/components/app/app-frame"
import { DialView } from "@/components/views/dial-view"

export const metadata: Metadata = { title: "Dial" }

export default function DialPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DialView />
    </Suspense>
  )
}

// Client-rendered from the browser store; skip instant-navigation validation.
export const instant = false
