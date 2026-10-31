"use client"

import { AppSidebar } from "@/components/app/app-sidebar"
import { MobileTabBar } from "@/components/app/mobile-tabbar"
import { SiteHeader } from "@/components/app/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAppStore } from "@/store/app-store"

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 @xl/main:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}

/** Data lives in the browser store, so pages render once it has loaded from storage. */
function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrated = useAppStore((s) => s.hydrated)
  return hydrated ? children : <PageSkeleton />
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 md:border">
        <SiteHeader />
        <main className="@container/main flex-1 px-4 pt-2 pb-28 md:px-6 md:pt-2 md:pb-8 2xl:px-10">
          <div className="mx-auto w-full max-w-[1400px]">
            <HydrationGate>{children}</HydrationGate>
          </div>
        </main>
        <MobileTabBar />
      </SidebarInset>
    </SidebarProvider>
  )
}
