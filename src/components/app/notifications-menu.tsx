"use client"

import Link from "next/link"
import { Bell, CircleCheck, CircleX, Info, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNow } from "@/hooks/use-now"
import { relative } from "@/lib/format"
import type { NotificationKind } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"

const ICON: Record<NotificationKind, [typeof Bell, string]> = {
  failure: [CircleX, "text-destructive"],
  offline: [WifiOff, "text-warning"],
  success: [CircleCheck, "text-success"],
  info: [Info, "text-info"],
}

export function NotificationsMenu() {
  const items = useAppStore((s) => s.notifications)
  const markRead = useAppStore((s) => s.markRead)
  const markAllRead = useAppStore((s) => s.markAllRead)
  const now = useNow(15000)
  const unread = items.filter((n) => !n.read).length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white tabular">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          <Button variant="ghost" size="xs" onClick={markAllRead} disabled={!unread}>
            Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>}
          {items.map((n) => {
            const [Icon, tone] = ICON[n.kind]
            const body = (
              <div className={cn("flex gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50", !n.read && "bg-primary/5")}>
                <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{relative(n.at, now)}</p>
                </div>
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              </div>
            )
            return n.href ? (
              <Link key={n.id} href={n.href} onClick={() => markRead(n.id)} className="block border-b last:border-0">
                {body}
              </Link>
            ) : (
              <button key={n.id} type="button" onClick={() => markRead(n.id)} className="block w-full border-b last:border-0">
                {body}
              </button>
            )
          })}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
