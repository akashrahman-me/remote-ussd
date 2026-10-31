import { Suspense } from "react"
import { AppFrame, PageSkeleton } from "@/components/app/app-frame"

// Dashboard data lives in the browser store, so these routes render client-side behind the shell;
// opt out of instant-navigation validation for the segments below.
export const instant = false

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="p-6"><PageSkeleton /></div>}>
      <AppFrame>{children}</AppFrame>
    </Suspense>
  )
}
