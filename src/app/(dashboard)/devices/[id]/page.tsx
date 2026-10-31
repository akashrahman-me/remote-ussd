import { Suspense } from "react"
import { PageSkeleton } from "@/components/app/app-frame"
import { DeviceDetailView } from "@/components/views/device-detail-view"

async function DeviceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DeviceDetailView id={id} />
}

export default function DevicePage({ params }: PageProps<"/devices/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DeviceDetail params={params} />
    </Suspense>
  )
}

// Client-rendered from the browser store; skip instant-navigation validation.
export const instant = false
