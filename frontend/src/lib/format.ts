const nf = new Intl.NumberFormat('en-IN')
const nf1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })

export const num = (n: number | null | undefined) => (n == null ? '—' : nf.format(n))
export const num1 = (n: number | null | undefined) => (n == null ? '—' : nf1.format(n))
export const pct = (n: number | null | undefined, digits = 1) => (n == null ? '—' : `${n.toFixed(digits)}%`)
export const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}`

export function compact(n: number) {
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)}L`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(n)
}

export function day(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', opts)
}

export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

/** "1. Very Dissatisfied" -> "Very dissatisfied"; "18_25" -> "18–25" */
export function cleanLabel(s: string) {
  if (s === "Don't know / no answer") return 'No answer'
  return s.replace(/^\d\.\s*/, '').replace(/_/g, '–').replace(/(\d)-(\d)/g, '$1–$2')
}
