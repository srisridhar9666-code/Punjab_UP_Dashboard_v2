import { useTheme } from '@/hooks/useTheme'
import { DK, OTHER, RATING, chrome, partyColor, seriesColor } from '@/lib/colors'
import { cleanLabel, num, pct } from '@/lib/format'
import type { Item } from '@/lib/types'
import { Tip } from '@/components/ui/Overlay'

/** Horizontal bars, one series = one color; values labelled at the bar end. */
export function RankedBars({ items, color, max: maxIn, party = false }: { items: Item[]; color?: string; max?: number; party?: boolean }) {
  const [, mode] = useTheme()
  const max = maxIn ?? Math.max(...items.map((i) => i.pct), 1)
  return (
    <ul className="space-y-2">
      {items.map((it) => {
        const muted = it.label === OTHER || it.label === DK
        const fill = muted ? chrome[mode].other : party ? partyColor(it.label, mode) : (color ?? seriesColor(0, mode))
        return (
          <li key={it.label} className="grid grid-cols-[minmax(96px,38%)_1fr_auto] items-center gap-3 text-[12.5px]">
            <span className={muted ? 'truncate text-ink-3' : 'truncate text-ink-2'} title={it.label}>
              {cleanLabel(it.label)}
            </span>
            <Tip content={`${cleanLabel(it.label)}: ${num(it.count)} (${pct(it.pct)})`}>
              <span className="relative block h-[10px] rounded-r-[4px] bg-transparent">
                <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${Math.max((it.pct / max) * 100, 0.8)}%`, background: fill, opacity: muted ? 0.7 : 1 }} />
              </span>
            </Tip>
            <span className="tabular w-12 text-right font-medium text-ink">{pct(it.pct)}</span>
          </li>
        )
      })}
    </ul>
  )
}

const RATING_KEYS = ['1. Very Dissatisfied', '2. Somewhat Dissatisfied', '3. Neutral', '4. Somewhat Satisfied', '5. Very Satisfied']
const CHOICE_KEYS = ['Dissatisfied', 'Average', 'Satisfied']

/** Diverging 100% bar for satisfaction scales: dissatisfied left (red), satisfied right (blue), neutral gray. */
export function RatingBar({ items }: { items: Item[] }) {
  const [, mode] = useTheme()
  const isChoice = items.some((i) => CHOICE_KEYS.includes(i.label))
  const keys = isChoice ? CHOICE_KEYS : RATING_KEYS
  const colors = isChoice ? [RATING[mode][0], RATING[mode][2], RATING[mode][4]] : RATING[mode]
  const answered = items.filter((i) => keys.includes(i.label))
  const total = answered.reduce((s, i) => s + i.count, 0) || 1
  const dk = items.find((i) => i.label === DK)
  const segs = keys.map((k, i) => {
    const it = answered.find((a) => a.label === k)
    return { key: k, count: it?.count ?? 0, share: ((it?.count ?? 0) / total) * 100, color: colors[i] }
  })
  const neg = segs.slice(0, isChoice ? 1 : 2).reduce((s, x) => s + x.share, 0)
  const pos = segs.slice(isChoice ? 2 : 3).reduce((s, x) => s + x.share, 0)
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-[12.5px]">
        <span className="text-ink-2">
          <span className="tabular text-[20px] font-semibold text-ink">{pos.toFixed(0)}%</span> satisfied
        </span>
        <span className="text-ink-2">
          <span className="tabular text-[20px] font-semibold text-ink">{neg.toFixed(0)}%</span> dissatisfied
        </span>
      </div>
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={segs.map((s) => `${cleanLabel(s.key)} ${s.share.toFixed(0)}%`).join(', ')}>
        {segs.map((s) =>
          s.share > 0 ? (
            <Tip key={s.key} content={`${cleanLabel(s.key)}: ${num(s.count)} (${s.share.toFixed(1)}% of those who answered)`}>
              <span className="h-full" style={{ width: `${s.share}%`, background: s.color }} />
            </Tip>
          ) : null,
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
        {segs.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />
            {cleanLabel(s.key)} <span className="tabular text-ink-2">{s.share.toFixed(0)}%</span>
          </span>
        ))}
        {dk && dk.count > 0 && <span className="ml-auto">+ {num(dk.count)} no answer</span>}
      </div>
    </div>
  )
}

export function ProgressBar({ value, max, tone = 'accent', label }: { value: number; max: number; tone?: 'accent' | 'good'; label?: string }) {
  const w = Math.min((value / (max || 1)) * 100, 100)
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
      <span className={tone === 'good' ? 'block h-full rounded-full bg-good' : 'block h-full rounded-full bg-accent'} style={{ width: `${w}%` }} />
    </span>
  )
}
