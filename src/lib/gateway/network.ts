/**
 * Simulated carrier USSD network used by the mock gateway.
 * Each carrier exposes the same menu tree; balances are derived from the SIM number so they stay stable.
 */

export interface MenuNode {
  text: (ctx: NetCtx) => string
  options?: Record<string, MenuNode>
  /** Final nodes close the session after the message is delivered. */
  final?: boolean
}

export interface NetCtx {
  carrier: string
  number: string
}

function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

function balance(ctx: NetCtx) {
  return (40 + (hash(ctx.number) % 46000) / 100).toFixed(2)
}

function validTill() {
  const d = new Date()
  d.setDate(d.getDate() + 24)
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

const confirm = (what: string, price: string): MenuNode => ({
  text: () => `${what} for Tk ${price}\n1. Confirm\n2. Cancel`,
  options: {
    "1": { final: true, text: () => `Request accepted. ${what} activated.\nYou will receive a confirmation SMS shortly.` },
    "2": { final: true, text: () => "Request cancelled." },
  },
})

const packs = (title: string, items: [string, string][]): MenuNode => ({
  text: () => `${title}\n${items.map(([n, p], i) => `${i + 1}. ${n} · Tk ${p}`).join("\n")}\n9. Back`,
  options: Object.fromEntries(items.map(([n, p], i) => [String(i + 1), confirm(n, p)])),
})

const balanceNode: MenuNode = {
  final: true,
  text: (ctx) => `Your balance is Tk ${balance(ctx)}\nValid till ${validTill()}\nInternet: ${(hash(ctx.number) % 90) / 10 + 0.4} GB left`,
}

const ownNumber: MenuNode = { final: true, text: (ctx) => `Your number is ${ctx.number}` }

export const ROOT: MenuNode = {
  text: (ctx) => `Welcome to ${ctx.carrier}\n1. Balance & Validity\n2. Internet Packs\n3. Minute Packs\n4. Offers for you\n5. My Number\n0. Exit`,
  options: {
    "1": balanceNode,
    "2": packs("Internet Packs", [["1 GB · 7 days", "99"], ["5 GB · 30 days", "399"], ["15 GB · 30 days", "749"]]),
    "3": packs("Minute Packs", [["100 min · 7 days", "79"], ["300 min · 30 days", "249"]]),
    "4": packs("Offers for you", [["2 GB + 50 min", "129"], ["Night pack 6 GB", "59"]]),
    "5": ownNumber,
    "0": { final: true, text: () => "Thank you for using our service." },
  },
}

/** Short codes that answer directly without a menu. */
const DIRECT: Record<string, MenuNode> = {
  "*566#": balanceNode,
  "*124#": balanceNode,
  "*2#": ownNumber,
  "*8444*88#": { final: true, text: (ctx) => `Internet balance: ${(hash(ctx.number + "mb") % 120) / 10 + 0.2} GB\nValid till ${validTill()}` },
}

const MENU_ROOTS = ["*121", "*222", "*123", "*500"]

/** Resolve a dialled code to a node, following "*121*2*1#" style deep links. */
export function resolveCode(code: string): MenuNode | null {
  if (DIRECT[code]) return DIRECT[code]
  const body = code.replace(/#$/, "")
  const root = MENU_ROOTS.find((r) => body === r || body.startsWith(r + "*"))
  if (!root) return null
  const path = body.slice(root.length).split("*").filter(Boolean)
  let node: MenuNode | undefined = ROOT
  for (const key of path) {
    node = node?.options?.[key]
    if (!node) return null
  }
  return node
}

export function step(node: MenuNode, input: string): MenuNode | "back" | null {
  if (input === "9") return "back"
  return node.options?.[input] ?? null
}
