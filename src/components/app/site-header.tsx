"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Monitor, Moon, Settings2, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { BrandMark } from "@/components/app/app-sidebar"
import { CommandMenu } from "@/components/app/command-menu"
import { NotificationsMenu } from "@/components/app/notifications-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { activeNav } from "@/lib/nav"
import { useAppStore } from "@/store/app-store"

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "OP"
}

function AccountMenu() {
  const { theme, setTheme } = useTheme()
  const operator = useAppStore((s) => s.settings.operatorName)
  const workspace = useAppStore((s) => s.settings.workspaceName)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account">
          <Avatar className="size-8">
            <AvatarFallback className="bg-brand text-xs font-semibold text-brand-foreground">{initials(operator)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{operator}</p>
          <p className="text-xs text-muted-foreground">{workspace}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light"><Sun /> Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon /> Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><Monitor /> System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings"><Settings2 /> Settings</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SiteHeader() {
  const nav = activeNav(usePathname())
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 bg-background/80 px-3 backdrop-blur-xl md:rounded-t-xl md:px-5">
      <Link href="/" className="flex items-center gap-2 md:hidden" aria-label="Relay home">
        <BrandMark />
      </Link>
      <SidebarTrigger className="hidden text-muted-foreground md:inline-flex" />
      <span className="sr-only">{nav.label}</span>
      <div className="ml-auto flex items-center gap-1">
        <CommandMenu />
        <NotificationsMenu />
        <SidebarTrigger className="text-muted-foreground md:hidden" />
        <AccountMenu />
      </div>
    </header>
  )
}
