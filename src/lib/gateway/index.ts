import { resolveCode, step, ROOT, type MenuNode, type NetCtx } from "@/lib/gateway/network"
import type { SignalBars } from "@/lib/types"

/**
 * The gateway is the boundary between this dashboard and the phones.
 * In production, implement `UssdGateway` over your websocket/REST API to the device agents;
 * the session engine only depends on this interface.
 */
export interface DialRequest {
  deviceId: string
  simSlot: 1 | 2
  code: string
  carrier: string
  number: string
  signal: SignalBars
  /** Seconds the network keeps a menu open waiting for a reply. */
  timeoutSec: number
  faults: boolean
}

export type GatewayErrorCode = "timeout" | "network" | "mmi" | "cancelled"

export interface SessionHandlers {
  /** A network message. `final` means the network closed the session after it. */
  onMessage: (text: string, final: boolean) => void
  onError: (code: GatewayErrorCode, message: string) => void
}

export interface SessionHandle {
  reply: (input: string) => void
  cancel: () => void
}

export interface UssdGateway {
  dial: (req: DialRequest, handlers: SessionHandlers) => SessionHandle
  ping: (deviceId: string) => Promise<number>
}

function latency(signal: SignalBars) {
  return 450 + (4 - signal) * 320 + Math.random() * 600
}

/** In-browser simulation of the device agent + carrier network. */
export function createMockGateway(): UssdGateway {
  return {
    async ping() {
      const ms = Math.round(40 + Math.random() * 120)
      await new Promise((r) => setTimeout(r, ms))
      return ms
    },

    dial(req, h) {
      const ctx: NetCtx = { carrier: req.carrier, number: req.number }
      let node: MenuNode | null = null
      let closed = false
      let pending: ReturnType<typeof setTimeout> | undefined
      let expiry: ReturnType<typeof setTimeout> | undefined

      const close = () => {
        closed = true
        clearTimeout(pending)
        clearTimeout(expiry)
      }
      const armExpiry = () => {
        clearTimeout(expiry)
        expiry = setTimeout(() => {
          if (closed) return
          close()
          h.onError("timeout", "Session expired: no reply before the network timeout.")
        }, req.timeoutSec * 1000)
      }
      const deliver = (next: MenuNode | null, prefix = "") => {
        pending = setTimeout(() => {
          if (closed) return
          if (req.faults) {
            const dropChance = req.signal <= 1 ? 0.25 : req.signal === 2 ? 0.05 : 0.01
            if (Math.random() < dropChance) {
              close()
              h.onError("network", "Connection problem or invalid MMI code.")
              return
            }
          }
          if (!next) {
            close()
            h.onError("mmi", "Connection problem or invalid MMI code.")
            return
          }
          node = next
          const final = !!next.final || !next.options
          if (final) close()
          else armExpiry()
          h.onMessage(prefix + next.text(ctx), final)
        }, latency(req.signal))
      }

      deliver(resolveCode(req.code))

      return {
        reply(input) {
          if (closed || !node) return
          clearTimeout(expiry)
          const next = step(node, input)
          if (next === "back") deliver(ROOT)
          else if (next) deliver(next)
          else deliver(node, "Invalid input.\n")
        },
        cancel() {
          if (closed) return
          close()
          h.onError("cancelled", "Session cancelled by operator.")
        },
      }
    },
  }
}

export const gateway: UssdGateway = createMockGateway()
