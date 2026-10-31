const pad = (n: number) => String(n).padStart(2, "0")

export function clock(ts: number) {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function shortDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

export function dateTime(ts: number) {
  const d = new Date(ts)
  return `${shortDate(ts)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function relative(ts: number, now = Date.now()) {
  const diff = Math.round((now - ts) / 1000)
  const future = diff < 0
  const s = Math.abs(diff)
  let out: string
  if (s < 5) return "just now"
  if (s < 60) out = `${s}s`
  else if (s < 3600) out = `${Math.floor(s / 60)}m`
  else if (s < 86400) out = `${Math.floor(s / 3600)}h`
  else out = `${Math.floor(s / 86400)}d`
  return future ? `in ${out}` : `${out} ago`
}

export function seconds(value: number) {
  return `${value.toFixed(1)}s`
}

export function number(value: number) {
  return value.toLocaleString("en-US")
}

export function percent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`
}

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
}
