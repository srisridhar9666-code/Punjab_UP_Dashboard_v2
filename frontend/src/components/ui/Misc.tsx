import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { ChevronDown, Inbox } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-sunken', className)} />
}

export function Empty({ title = 'No data for this selection', hint, className }: { title?: string; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-12 text-center', className)}>
      <Inbox className="h-6 w-6 text-ink-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {hint && <p className="max-w-sm text-[13px] text-ink-3">{hint}</p>}
    </div>
  )
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent'; children: ReactNode; className?: string }) {
  const tones = {
    neutral: 'bg-sunken text-ink-2',
    good: 'bg-good/10 text-good',
    warn: 'bg-warn/15 text-warn',
    bad: 'bg-bad/10 text-bad',
    accent: 'bg-accent-soft text-accent-ink',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium', tones[tone], className)}>{children}</span>
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <div className={cn('relative', className)}>
    <select
      ref={ref}
      className="h-8 w-full appearance-none rounded-lg bg-surface pl-3 pr-8 text-[13px] text-ink shadow-card outline-none transition hover:bg-raised focus:ring-2 focus:ring-accent/40"
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
  </div>
))
Select.displayName = 'Select'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn('h-9 w-full rounded-lg bg-surface px-3 text-sm text-ink shadow-card outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-accent/40', className)}
    {...props}
  />
))
Input.displayName = 'Input'

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-raised px-1.5 py-px font-sans text-[11px] text-ink-3">{children}</kbd>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-ink-3">{hint}</span>}
    </label>
  )
}

export function Segmented<T extends string>({ value, onChange, options, size = 'sm' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'sm' | 'xs' }) {
  return (
    <div role="radiogroup" className="inline-flex rounded-lg bg-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md font-medium transition',
            size === 'sm' ? 'px-3 py-1 text-[12.5px]' : 'px-2 py-0.5 text-[11.5px]',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
