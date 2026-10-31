"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Grip } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { activeNav, NAV } from "@/lib/nav"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand font-mono text-[11px] font-bold tracking-tighter text-brand-foreground", className)}>
      *#
    </span>
  )
}

export function AppSidebar() {
  const current = activeNav(usePathname())
  const { setOpenMobile } = useSidebar()
  const workspace = useAppStore((s) => s.settings.workspaceName)
  const live = useAppStore((s) => s.devices.filter((d) => d.status !== "offline").length)
  const deviceCount = useAppStore((s) => s.devices.length)
  const flowCount = useAppStore((s) => s.automations.filter((a) => a.enabled).length)
  const counts: Record<string, number> = { "/devices": deviceCount, "/automations": flowCount }
  const close = () => setOpenMobile(false)

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" onClick={close}>
                <BrandMark />
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold tracking-tight">Relay</span>
                  <span className="truncate text-xs text-muted-foreground">{workspace}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Dial"
                  className="h-9 bg-brand font-medium text-brand-foreground hover:bg-brand/90 hover:text-brand-foreground active:bg-brand/90 active:text-brand-foreground"
                >
                  <Link href="/dial" onClick={close}>
                    <Grip />
                    <span>New session</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = current.href === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="h-9">
                      <Link href={item.href} onClick={close}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {counts[item.href] != null && (
                      <SidebarMenuBadge className="top-2 font-mono text-[11px] text-muted-foreground tabular">{counts[item.href]}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-brand" />
          </span>
          <span className="group-data-[collapsible=icon]:hidden">
            Gateway · <span className="font-mono tabular">{live}</span> live
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
