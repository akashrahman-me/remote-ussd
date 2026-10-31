"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Grip, Moon, Play, Search, Smartphone, Sun, Workflow } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { executeAutomation } from "@/lib/engine"
import { NAV } from "@/lib/nav"
import { useAppStore } from "@/store/app-store"

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const devices = useAppStore((s) => s.devices)
  const codes = useAppStore((s) => s.codes)
  const automations = useAppStore((s) => s.automations)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <Button
        variant="outline"
        className="hidden h-8 w-56 justify-start gap-2 rounded-full border-transparent bg-muted px-3 font-normal text-muted-foreground shadow-none hover:bg-accent lg:inline-flex dark:bg-muted"
        onClick={() => setOpen(true)}
      >
        <Search />
        <span className="flex-1 text-left">Search</span>
        <Kbd>⌘K</Kbd>
      </Button>
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Search" onClick={() => setOpen(true)}>
        <Search />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Command menu" description="Jump to a page, device, code or automation">
        <CommandInput placeholder="Search or jump to…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {NAV.map((n) => (
              <CommandItem key={n.href} value={`page ${n.label}`} onSelect={() => go(n.href)}>
                <n.icon />
                {n.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Devices">
            {devices.map((d) => (
              <CommandItem key={d.id} value={`device ${d.name} ${d.model}`} onSelect={() => go(`/devices/${d.id}`)}>
                <Smartphone />
                {d.name}
                <CommandShortcut className="tracking-normal">{d.status}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Saved codes">
            {codes.map((c) => (
              <CommandItem key={c.id} value={`code ${c.code} ${c.label}`} onSelect={() => go(`/dial?code=${encodeURIComponent(c.code)}`)}>
                <Grip />
                <span className="font-mono font-semibold">{c.code}</span>
                <span className="text-muted-foreground">{c.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Run automation">
            {automations.map((a) => (
              <CommandItem
                key={a.id}
                value={`automation ${a.name}`}
                onSelect={() => {
                  setOpen(false)
                  toast.promise(executeAutomation(a.id).then((s) => s ?? "skipped"), {
                    loading: `Running ${a.name}…`,
                    success: (s) => (s === "success" ? `${a.name} completed` : s === "skipped" ? `${a.name} is already running` : `${a.name} finished with failures`),
                    error: "Automation failed to start",
                  })
                }}
              >
                {a.enabled ? <Workflow /> : <Play />}
                {a.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Preferences">
            <CommandItem value="toggle theme dark light" onSelect={() => { setTheme(resolvedTheme === "dark" ? "light" : "dark"); setOpen(false) }}>
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
