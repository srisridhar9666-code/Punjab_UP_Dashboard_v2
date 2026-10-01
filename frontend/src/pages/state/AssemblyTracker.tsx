import { useMemo } from 'react'
import { RotateCcw, Target } from 'lucide-react'
import type { AcRow, Overview } from '@/lib/types'
import { num, pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useTheme } from '@/hooks/useTheme'
import { Card, CardHeader } from '@/components/ui/Card'
import { Tip } from '@/components/ui/Overlay'
import type { Mode } from '@/lib/colors'
import { useStateCtx } from './StateLayout'

/** Completion brackets, v1-style "cuts", coloured as status: backlog -> done. */
export type Bracket = 'none' | 'b0' | 'b1' | 'b2' | 'b3'
export const BRACKET_COLORS: Record<Mode, Record<Bracket, string>> = {
  light: { none: '#d6d5cf', b0: '#d03b3b', b1: '#e59a00', b2: '#2a78d6', b3: '#0c8a3e' },
  dark: { none: '#45443f', b0: '#e66767', b1: '#fab219', b2: '#3987e5', b3: '#27b35a' },
}

export function defaultCuts(targets: number[]): [number, number, number] {
  const first = targets[0] ?? 50
  const last = targets[targets.length - 1] ?? first
  if (targets.length > 1) return [Math.round(first * 0.5), first, last]
  return [Math.round(first * 0.5), Math.round(first * 0.8), first]
}

export function bracketOf(complete: number, cuts: [number, number, number]): Bracket {
  if (complete < cuts[0]) return 'b0'
  if (complete < cuts[1]) return 'b1'
  if (complete < cuts[2]) return 'b2'
  return 'b3'
}

export function bracketLabels(cuts: [number, number, number]): Record<Bracket, { title: string; range: string }> {
  return {
    none: { title: 'Not started', range: 'no interviews yet' },
    b0: { title: 'Critical backlog', range: `under ${cuts[0]}` },
    b1: { title: 'In progress', range: `${cuts[0]}–${cuts[1] - 1}` },
    b2: { title: 'Near target', range: `${cuts[1]}–${cuts[2] - 1}` },
    b3: { title: 'Target reached', range: `${cuts[2]}+` },
  }
}

function Donut({ value, size = 168, color, track, children }: { value: number; size?: number; color: string; track: string; children: React.ReactNode }) {
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(value, 1))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

/** Headline: how far the whole state is toward its interview targets. */
export function TrackerHero({ rows, overview }: { rows: AcRow[]; overview?: Overview }) {
  const { meta } = useStateCtx()
  const [, mode] = useTheme()
  const final = meta.phases[meta.phases.length - 1]?.target ?? 1
  const totalAcs = Math.max(meta.total_acs, rows.length)
  const goal = totalAcs * final
  const counted = rows.reduce((s, r) => s + Math.min(r.complete, final), 0)
  const remaining = goal - counted
  const pace = overview?.avg_daily_complete_7d ?? 0
  const days = pace > 0 ? Math.ceil(remaining / pace) : null
  const surveyed = rows.filter((r) => r.complete > 0).length
  const C = BRACKET_COLORS[mode]

  return (
    <Card className="overflow-hidden">
      <div className="relative grid gap-6 p-5 lg:p-6 2xl:grid-cols-[auto_1fr]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(var(--accent)/0.10),transparent_55%)]" />
        <div className="relative flex items-center gap-5">
          <Donut value={counted / (goal || 1)} color={C.b2} track={mode === 'dark' ? '#2c2c2a' : '#ecebe6'}>
            <span className="tabular text-[34px] font-semibold leading-none tracking-[-0.03em]">{pct((counted / (goal || 1)) * 100, 0)}</span>
            <span className="mt-1 text-[11.5px] text-ink-3">of state target</span>
          </Donut>
          <div className="space-y-3">
            <div>
              <p className="label flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Assembly tracker
              </p>
              <p className="mt-1 text-[22px] font-semibold tracking-[-0.02em]">
                {num(counted)} <span className="text-[15px] font-normal text-ink-3">/ {num(goal)} interviews</span>
              </p>
              <p className="text-[12.5px] text-ink-3">
                {totalAcs} ACs × {final} complete interviews each
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[12px]">
              <span className="rounded-full bg-sunken px-2.5 py-1 text-ink-2">
                <b className="text-ink">{num(remaining)}</b> to go
              </span>
              <span className="rounded-full bg-sunken px-2.5 py-1 text-ink-2">
                <b className="text-ink">{num(Math.round(pace))}</b>/day (7-day avg)
              </span>
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent-ink">{days === null ? 'No recent pace' : remaining <= 0 ? 'Complete' : `~${days} days to finish at this pace`}</span>
            </div>
          </div>
        </div>

        <div className="relative grid content-center gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Milestone label="ACs surveyed" value={surveyed} max={totalAcs} color={C.b1} hint={`${totalAcs - surveyed} not started`} />
          {meta.phases.map((p, i) => {
            const done = rows.filter((r) => r.complete >= p.target).length
            return <Milestone key={p.name} label={`${p.name} · ${p.target} per AC`} value={done} max={totalAcs} color={i === meta.phases.length - 1 ? C.b3 : C.b2} hint={`${totalAcs - done} ACs below ${p.target}`} />
          })}
        </div>
      </div>
    </Card>
  )
}

function Milestone({ label, value, max, color, hint }: { label: string; value: number; max: number; color: string; hint: string }) {
  const p = (value / (max || 1)) * 100
  return (
    <div className="rounded-xl border hairline bg-surface/70 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12.5px] font-medium text-ink-3">{label}</span>
        <span className="tabular shrink-0 text-[12.5px] font-medium text-ink-2">{pct(p, 0)}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="tabular text-[26px] font-semibold leading-none tracking-[-0.02em]">{value}</span>
        <span className="text-[13px] text-ink-3">/ {max} ACs</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${p}%`, background: color }} />
      </div>
      <div className="mt-2 text-[11.5px] text-ink-3">{hint}</div>
    </div>
  )
}

/** v1's completion cuts, upgraded: editable thresholds, a stacked share bar, clickable cards. */
export function BracketPanel({ rows, cuts, setCuts, active, setActive }: { rows: AcRow[]; cuts: [number, number, number]; setCuts: (c: [number, number, number]) => void; active: Bracket | null; setActive: (b: Bracket | null) => void }) {
  const { meta } = useStateCtx()
  const [, mode] = useTheme()
  const C = BRACKET_COLORS[mode]
  const L = bracketLabels(cuts)
  const totalAcs = Math.max(meta.total_acs, rows.length)
  const counts = useMemo(() => {
    const c: Record<Bracket, number> = { none: Math.max(totalAcs - rows.length, 0), b0: 0, b1: 0, b2: 0, b3: 0 }
    rows.forEach((r) => c[bracketOf(r.complete, cuts)]++)
    return c
  }, [rows, cuts, totalAcs])
  const order: Bracket[] = counts.none > 0 ? ['none', 'b0', 'b1', 'b2', 'b3'] : ['b0', 'b1', 'b2', 'b3']
  const defaults = defaultCuts(meta.phases.map((p) => p.target))

  const setCut = (i: 0 | 1 | 2, v: number) => {
    const next = [...cuts] as [number, number, number]
    next[i] = Math.max(1, v || 1)
    if (next[1] <= next[0]) next[1] = next[0] + 1
    if (next[2] <= next[1]) next[2] = next[1] + 1
    setCuts(next)
  }

  return (
    <Card>
      <CardHeader
        title="Constituency completion"
        subtitle="Every assembly seat grouped by complete interviews. Click a group to filter the table."
        actions={
          <div className="flex items-center gap-1 rounded-lg bg-sunken p-1 text-[11.5px]">
            <span className="px-1.5 text-ink-3">Cuts</span>
            {([0, 1, 2] as const).map((i) => (
              <input
                key={i}
                type="number"
                aria-label={`Cut ${i + 1}`}
                value={cuts[i]}
                onChange={(e) => setCut(i, parseInt(e.target.value))}
                className="tabular h-6 w-12 rounded-md border hairline bg-surface text-center font-semibold text-ink focus:outline-none"
                style={{ boxShadow: `inset 0 -2px 0 ${[C.b0, C.b1, C.b2][i]}` }}
              />
            ))}
            <button title={`Reset to ${defaults.join(', ')}`} onClick={() => setCuts(defaults)} className="rounded-md p-1 text-ink-3 hover:bg-surface hover:text-ink">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />
      <div className="px-5 pb-5 pt-4">
        <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-[6px]">
          {order.map((b) =>
            counts[b] ? (
              <Tip key={b} content={`${L[b].title} (${L[b].range}): ${counts[b]} ACs`}>
                <button
                  onClick={() => setActive(active === b ? null : b)}
                  className="h-full transition-opacity"
                  style={{ width: `${(counts[b] / totalAcs) * 100}%`, background: C[b], opacity: active && active !== b ? 0.3 : 1 }}
                  aria-label={`${L[b].title}: ${counts[b]} ACs`}
                />
              </Tip>
            ) : null,
          )}
        </div>
        <div className={cn('mt-4 grid gap-3 sm:grid-cols-2', order.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
          {order.map((b) => {
            const on = active === b
            return (
              <button
                key={b}
                onClick={() => setActive(on ? null : b)}
                className={cn('group relative overflow-hidden rounded-xl border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-card', on ? 'border-transparent' : 'hairline')}
                style={on ? { boxShadow: `0 0 0 2px ${C[b]}` } : undefined}
              >
                <span className="absolute inset-x-0 top-0 h-1" style={{ background: C[b] }} />
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-ink-2">{L[b].title}</span>
                  <span className="tabular rounded-full bg-sunken px-1.5 py-0.5 text-[11px] text-ink-3">{pct((counts[b] / totalAcs) * 100, 0)}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="tabular text-[26px] font-semibold leading-none tracking-[-0.02em]">{counts[b]}</span>
                  <span className="text-[12px] text-ink-3">ACs</span>
                </div>
                <div className="mt-1 text-[11.5px] text-ink-3">{L[b].range}</div>
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
