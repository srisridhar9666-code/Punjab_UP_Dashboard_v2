import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Skeleton } from './Misc'

export function Delta({ value, suffix = '', goodWhenUp = true, title }: { value: number | null | undefined; suffix?: string; goodWhenUp?: boolean; title?: string }) {
  if (value == null || Number.isNaN(value)) return null
  const up = value > 0
  const flat = value === 0
  const good = flat ? null : up === goodWhenUp
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span title={title} className={cn('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium', good === null ? 'bg-sunken text-ink-3' : good ? 'bg-good/10 text-good' : 'bg-bad/10 text-bad')}>
      <Icon className="h-3 w-3" strokeWidth={2.4} />
      {Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
      {suffix}
    </span>
  )
}

export function Stat({ label, value, sub, delta, chart, loading, className }: { label: string; value: ReactNode; sub?: ReactNode; delta?: ReactNode; chart?: ReactNode; loading?: boolean; className?: string }) {
  return (
    <div className={cn('card flex min-h-[118px] flex-col justify-between gap-3 p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink-3">{label}</span>
        {delta}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink">{value}</div>
            {sub && <div className="mt-1.5 truncate text-[12px] text-ink-3">{sub}</div>}
          </div>
          {chart && <div className="shrink-0">{chart}</div>}
        </div>
      )}
    </div>
  )
}

/** Small ring for "x of y" targets. */
export function Ring({ value, max, size = 40 }: { value: number; max: number; size?: number }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const p = Math.min(value / (max || 1), 1)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(p * 100)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth={5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgb(var(--accent))"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}
