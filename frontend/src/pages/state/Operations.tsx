import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { useStateQuery } from '@/hooks/useStateData'
import { useFilters } from '@/hooks/useFilters'
import type { AcRow, Day, Overview } from '@/lib/types'
import { day, num, pct } from '@/lib/format'
import { downloadCsv } from '@/lib/csv'
import { cn } from '@/lib/cn'
import { Delta, Stat } from '@/components/ui/Stat'
import { Empty, Input, Skeleton } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ChartCard } from '@/components/charts/ChartCard'
import { TrendChart } from '@/components/charts/TrendChart'
import { Sparkline } from '@/components/charts/Sparkline'
import { useStateCtx } from './StateLayout'
import { BracketPanel, TrackerHero, bracketLabels, bracketOf, defaultCuts, type Bracket } from './AssemblyTracker'

type SortKey = 'ac' | 'district' | 'complete' | 'partial' | 'p0' | 'p1' | 'last_date'

/** v1-style phase bar: "count/target (pct%)" over a bar that turns green when the phase is met. */
function PhaseBar({ count, target, pct: p, done, color }: { count: number; target: number; pct: number; done: boolean; color: string }) {
  const v = Math.min(p, 100)
  return (
    <div className="w-full min-w-[150px]">
      <div className="mb-1 flex justify-end">
        <span className={cn('tabular text-[11.5px] font-semibold', done ? 'text-good' : 'text-ink-2')}>
          {num(count)}/{num(target)} ({v.toFixed(0)}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-sunken">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%`, background: done ? 'rgb(var(--good))' : color }} />
      </div>
    </div>
  )
}

function AcTable({ rows, loading, cuts, bracket }: { rows: AcRow[]; loading: boolean; cuts: [number, number, number]; bracket: Bracket | null }) {
  const { meta } = useStateCtx()
  const { set } = useFilters()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'p0', dir: -1 })
  const phaseColors = ['rgb(var(--accent))', '#7c5cd6']

  const value = (r: AcRow, k: SortKey): string | number => {
    if (k === 'p0') return r.phases[0]?.pct ?? 0
    if (k === 'p1') return r.phases[1]?.pct ?? 0
    if (k === 'district') return r.district ?? ''
    if (k === 'last_date') return r.last_date ?? ''
    return r[k]
  }

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows
      .filter((r) => (!bracket || bracketOf(r.complete, cuts) === bracket) && (!needle || r.ac.toLowerCase().includes(needle) || (r.district ?? '').toLowerCase().includes(needle)))
      .sort((a, b) => {
        const av = value(a, sort.key)
        const bv = value(b, sort.key)
        const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : av - (bv as number)
        return cmp * sort.dir
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, bracket, cuts])

  const th = (key: SortKey, label: string, extra = '') => (
    <th className={cn('cursor-pointer select-none px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-3 hover:text-ink', extra)} onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }))}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sort.key === key ? sort.dir === 1 ? <ChevronUp className="h-3 w-3 text-accent" /> : <ChevronDown className="h-3 w-3 text-accent" /> : <ChevronUp className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  )

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={bracket ? `Assembly constituency progress · ${bracketLabels(cuts)[bracket].title}` : 'Assembly constituency progress'}
        subtitle={`Targets: ${meta.phases.map((p) => `${p.name} ${p.target}`).join(' · ')} complete interviews per AC`}
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              downloadCsv(
                `${meta.key}-constituency-progress.csv`,
                shown.map((r) => ({ AC: r.ac, District: r.district, Complete: r.complete, Partial: r.partial, ...Object.fromEntries(r.phases.map((p) => [`${p.name} %`, p.pct])), 'Last survey': r.last_date })),
              )
            }
          >
            Export
          </Button>
        }
      />
      <div className="mt-3 border-y hairline px-5 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search AC or district…" className="pl-9" />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 border-b hairline px-5 py-2 text-[12px] text-ink-3">
        <span>{shown.length} ACs shown</span>
        {meta.phases.map((p, i) => (
          <span key={p.name} className={cn('inline-flex items-center gap-1 font-medium', i === 0 ? 'text-good' : 'text-accent-ink')}>
            <CheckCircle2 className="h-3.5 w-3.5" /> {p.name} done: {shown.filter((r) => r.phases[i]?.done).length}
          </span>
        ))}
      </div>
      <div className={cn('scroll-thin max-h-[640px] overflow-auto transition-opacity', loading && 'opacity-60')}>
        <table className="w-full min-w-[860px] text-[13px]">
          <thead className="sticky top-0 z-10 bg-raised shadow-[0_1px_0_rgb(var(--line))]">
            <tr>
              {th('ac', 'AC name')}
              {th('district', 'District')}
              {th('complete', 'Complete')}
              {th('partial', 'Partial')}
              {meta.phases.map((p, i) => th(i === 0 ? 'p0' : 'p1', `${p.name} progress`, 'min-w-[180px]'))}
              {th('last_date', 'Last survey')}
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgb(var(--line))]">
            {shown.map((r) => (
              <tr key={`${r.ac}-${r.district}`} className="transition-colors hover:bg-raised">
                <td className="px-4 py-3">
                  <button className="text-left font-medium text-ink hover:text-accent" onClick={() => set({ district: r.district ?? undefined, ac: r.ac })}>
                    {r.ac}
                  </button>
                </td>
                <td className="px-4 py-3 text-ink-3">{r.district ?? '—'}</td>
                <td className="tabular px-4 py-3 font-semibold text-good">{num(r.complete)}</td>
                <td className="tabular px-4 py-3 text-warn">{num(r.partial)}</td>
                {r.phases.map((p, i) => {
                  const base = i === 0 ? 0 : meta.phases[i - 1].target
                  return (
                    <td key={p.name} className="px-4 py-3">
                      <PhaseBar count={p.count} target={p.target - base} pct={p.pct} done={p.done} color={phaseColors[i] ?? phaseColors[0]} />
                    </td>
                  )
                })}
                <td className="tabular px-4 py-3 text-[12px] text-ink-3">{r.last_date ? day(r.last_date, { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <Empty title={rows.length ? 'No constituencies match' : 'No data found'} />}
      </div>
    </Card>
  )
}

export default function Operations() {
  const { state, meta } = useStateCtx()
  const ov = useStateQuery<Overview>(state, 'overview', {}, { status: 'All' })
  const trend = useStateQuery<Day[]>(state, 'trend', {}, { status: 'All' })
  const acs = useStateQuery<AcRow[]>(state, 'ac-progress', {}, { status: 'All' })
  const o = ov.data
  const latest = o?.latest_day
  const prev = o?.previous_day
  const [cuts, setCuts] = useState<[number, number, number]>(() => defaultCuts(meta.phases.map((p) => p.target)))
  const [bracket, setBracket] = useState<Bracket | null>(null)

  return (
    <div className="space-y-5 animate-fade-in">
      {acs.data ? <TrackerHero rows={acs.data} overview={o} /> : <Skeleton className="h-[220px] rounded-xl" />}
      {acs.data && <BracketPanel rows={acs.data} cuts={cuts} setCuts={setCuts} active={bracket} setActive={setBracket} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          loading={!o}
          label="Complete interviews"
          value={num(o?.complete)}
          sub={`${num(o?.partial)} partial`}
          chart={o && <Sparkline values={o.spark.map((d) => d.complete)} width={84} height={34} label="Daily completes, last 14 days" />}
        />
        <Stat loading={!o} label="Completion rate" value={pct(o?.completion_rate)} sub="Complete ÷ all calls" />
        <Stat
          loading={!o}
          label="Latest day"
          value={num(latest?.complete)}
          delta={latest && prev && <Delta value={latest.complete - prev.complete} title={`vs ${day(prev.date)}`} />}
          sub={latest ? `${day(latest.date, { weekday: 'short', day: 'numeric', month: 'short' })} · 7-day avg ${num(Math.round(o?.avg_daily_complete_7d ?? 0))}` : '—'}
        />
      </div>

      <ChartCard
        title="Daily surveys"
        subtitle="Complete and partial surveys per day"
        loading={trend.isFetching}
        table={trend.data?.map((d) => ({ Date: d.date, Complete: d.complete, Partial: d.partial, Total: d.total }))}
        filename={`${state}-daily-surveys.csv`}
      >
        {trend.data ? trend.data.length ? <TrendChart data={trend.data} height={300} /> : <Empty /> : <Skeleton className="h-[300px]" />}
      </ChartCard>

      {acs.data ? <AcTable rows={acs.data} loading={acs.isFetching} cuts={cuts} bracket={bracket} /> : <Skeleton className="h-[480px] rounded-xl" />}
    </div>
  )
}
