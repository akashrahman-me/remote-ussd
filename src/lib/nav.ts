import { Grip, LayoutGrid, ScrollText, Settings2, Smartphone, Workflow, type LucideIcon } from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/devices", label: "Devices", icon: Smartphone },
  { href: "/dial", label: "Dial", icon: Grip },
  { href: "/automations", label: "Flows", icon: Workflow },
  { href: "/history", label: "History", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings2 },
]

export function activeNav(pathname: string) {
  if (pathname === "/") return NAV[0]
  return NAV.find((n) => n.href !== "/" && pathname.startsWith(n.href)) ?? NAV[0]
}
