"use client"

import { useEffect } from "react"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { startRuntime } from "@/lib/engine"
import { useAppStore } from "@/store/app-store"

function Runtime() {
  useEffect(() => {
    void useAppStore.persist.rehydrate()
  }, [])
  const hydrated = useAppStore((s) => s.hydrated)
  useEffect(() => (hydrated ? startRuntime() : undefined), [hydrated])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={200}>
        <Runtime />
        {children}
        <Toaster richColors closeButton position="top-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
