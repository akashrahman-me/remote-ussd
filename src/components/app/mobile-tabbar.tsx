"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { activeNav, NAV } from "@/lib/nav"
import { cn } from "@/lib/utils"

const TABS = ["/", "/devices", "/dial", "/automations", "/history"]

/** Floating bottom navigation for phones; the sidebar takes over from md. */
export function MobileTabBar() {
  const current = activeNav(usePathname())
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid h-16 grid-cols-5 items-center rounded-2xl border bg-popover/85 px-1.5 shadow-lg backdrop-blur-xl md:hidden"
    >
      {NAV.filter((n) => TABS.includes(n.href)).map((item) => {
        const active = current.href === item.href
        const dial = item.href === "/dial"
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className="flex h-full flex-col items-center justify-center gap-1"
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-xl transition-colors",
                dial ? "size-11 bg-brand text-brand-foreground shadow-sm" : "size-9",
                !dial && active && "bg-accent text-foreground",
                !dial && !active && "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
            </span>
            {!dial && <span className={cn("size-1 rounded-full", active ? "bg-foreground" : "bg-transparent")} />}
          </Link>
        )
      })}
    </nav>
  )
}
