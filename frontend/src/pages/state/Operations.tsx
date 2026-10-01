import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, PauseCircle, Search, TrendingUp } from 'lucide-react'
import { useStateQuery } from '@/hooks/useStateData'
import { useFilters } from '@/hooks/useFilters'
import type { AcRow, CallCenter, Day, DistrictRow, Heatmap, Overview } from '@/lib/types'
import { day, num, num1, pct } from '@/lib/format'
import { downloadCsv } from '@/lib/csv'
import { cn } from '@/lib/cn'
import { Delta, Ring, Stat } from '@/components/ui/Stat'
import { Empty, Input, Segmented, Skeleton } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ChartCard } from '@/components/charts/ChartCard'
import { TrendChart } from '@/components/charts/TrendChart'
import { HeatmapChart } from '@/components/charts/HeatmapChart'
import { Sparkline } from '@/components/charts/Sparkline'
import { ProgressBar, RankedBars } from '@/components/charts/Bars'
import { useStateCtx } from './StateLayout'

type Health = 'done' | 'on-track' | 'slow' | 'stalled'

function health(r: AcRow): Health {
  if (r.remaining === 0) return 'done'
  if (r.pace_7d === 0) return 'stalled'
  if (r.eta_days !== null && r.eta_days > 7) return 'slow'
  return 'on-track'
}

const HEALTH = {
  done: { label: 'All targets met', icon: CheckCircle2, cls: 'text-good bg-good/10' },
  'on-track': { label: 'On pace', icon: TrendingUp, cls: 'text-accent-ink bg-accent-soft' },
  slow: { label: 'Slow', icon: AlertTriangle, cls: 'text-warn bg-warn/15' },
  stalled: { label: 'Stalled', icon: PauseCircle, cls: 'text-bad bg-bad/10' },
} as const

function HealthPill({ h }: { h: Health }) {
  const H = HEALTH[h]
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium', H.cls)}>
      <H.icon className="h-3 w-3" strokeWidth={2.2} /> {H.label}
    </span>
  )
}

function AcTable({ rows, loading }: { rows: AcRow[]; loading: boolean }) {
  const { meta } = useStateCtx()
  const { set } = useFilters()
  const [q, setQ] = useState('')
  const [view, setView] = useState<'all' | Health>('all')
  const [sort, setSort] = useState<{ key: 'ac' | 'complete' | 'pace_7d' | 'eta_days' | 'remaining'; dir: 1 | -1 }>({ key: 'remaining', dir: -1 })

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, done: 0, 'on-track': 0, slow: 0, stalled: 0 }
    rows.forEach((r) => c[health(r)]++)
    return c
  }, [rows])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows
      .filter((r) => (view === 'all' || health(r) === view) && (!needle || r.ac.toLowerCase().includes(needle) || (r.district ?? '').toLowerCase().includes(needle)))
      .sort((a, b) => {
        const av = a[sort.key] ?? Infinity
        const bv = b[sort.key] ?? Infinity
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir
      })
  }, [rows, q, view, sort])

  const th = (key: typeof sort.key, label: string, right = false) => (
    <th className={cn('px-3 py-2.5 font-medium', right && 'text-right')}>
      <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === 'ac' ? 1 : -1 }))}>
        {label}
        {sort.key === key && <span aria-hidden>{sort.dir === 1 ? '↑' : '↓'}</span>}
      </button>
    </th>
  )

  return (
    <Card>
      <CardHeader
        title="Constituency progress"
        subtitle={`Targets: ${meta.phases.map((p) => `${p.name} ${p.target}`).join(' · ')} complete interviews per AC. Pace uses the last 7 days of data; ETA is to the next target. Slow means more than 7 days to go, stalled means no completes in 7 days.`}
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              downloadCsv(
                `${meta.key}-constituency-progress.csv`,
                shown.map((r) => ({ AC: r.ac, District: r.district, Complete: r.complete, Partial: r.partial, 'Next target': r.next_phase ?? 'All met', Remaining: r.remaining, 'Per day (7d)': r.pace_7d, 'ETA days': r.eta_days, Status: HEALTH[health(r)].label, 'Last interview': r.last_date })),
              )
            }
          >
            Export
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <Segmented
          value={view}
          onChange={setView}
          options={(['all', 'stalled', 'slow', 'on-track', 'done'] as const).map((v) => ({ value: v, label: `${v === 'all' ? 'All' : HEALTH[v].label} ${counts[v]}` }))}
        />
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search constituency or district" className="h-8 pl-8 text-[13px]" />
        </div>
      </div>
      <div className={cn('scroll-thin mt-3 max-h-[560px] overflow-auto transition-opacity', loading && 'opacity-60')}>
        <table className="w-full min-w-[820px] text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface text-left text-[12px] text-ink-3 shadow-[0_1px_0_rgb(var(--line))]">
            <tr>
              {th('ac', 'Constituency')}
              <th className="px-3 py-2.5 font-medium">Status</th>
              {meta.phases.map((p) => (
                <th key={p.name} className="w-[160px] px-3 py-2.5 font-medium">
                  {p.name}
                </th>
              ))}
              {th('complete', 'Complete', true)}
              {th('pace_7d', 'Per day', true)}
              {th('eta_days', 'ETA next target', true)}
              <th className="px-3 py-2.5 text-right font-medium">Last call</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={`${r.ac}-${r.district}`} className="border-b hairline last:border-0 hover:bg-raised">
                <td className="px-3 py-2.5">
                  <button className="text-left font-medium text-ink hover:text-accent" onClick={() => set({ district: r.district ?? undefined, ac: r.ac })}>
                    {r.ac}
                  </button>
                  <div className="text-[11.5px] text-ink-3">{r.district}</div>
                </td>
                <td className="px-3 py-2.5">
                  <HealthPill h={health(r)} />
                </td>
                {r.phases.map((p) => (
                  <td key={p.name} className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={p.count} max={p.target - (meta.phases[meta.phases.findIndex((x) => x.name === p.name) - 1]?.target ?? 0)} tone={p.done ? 'good' : 'accent'} label={`${p.name} ${p.pct}%`} />
                      <span className="tabular w-10 text-right text-[12px] text-ink-2">{p.pct.toFixed(0)}%</span>
                    </div>
                  </td>
                ))}
                <td className="tabular px-3 py-2.5 text-right font-medium">{num(r.complete)}</td>
                <td className="tabular px-3 py-2.5 text-right text-ink-2">{num1(r.pace_7d)}</td>
                <td className="tabular px-3 py-2.5 text-right text-ink-2" title={r.next_phase ? `${r.remaining} to go for ${r.next_phase}` : undefined}>{r.eta_days === null ? '—' : r.eta_days < 0 ? 'no pace' : `${r.eta_days} d`}</td>
                <td className="tabular px-3 py-2.5 text-right text-ink-3">{r.last_date ? day(r.last_date) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <Empty title={rows.length ? 'No constituencies match' : 'No data for this selection'} />}
      </div>
    </Card>
  )
}

function CallCenters({ rows }: { rows: CallCenter[] }) {
  const max = Math.max(...rows.map((r) => r.complete_per_day), 1)
  return (
    <ChartCard
      title="Call center productivity"
      subtitle="Complete interviews per active day, and share of calls completed"
      table={rows.map((r) => ({ Center: r.center, Complete: r.complete, Partial: r.partial, 'Completion %': r.completion_rate, 'Active days': r.active_days, 'Complete / day': r.complete_per_day }))}
      filename="call-centers.csv"
    >
      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.center}>
            <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="font-medium">{r.center}</span>
              <span className="tabular text-ink-2">
                <b className="text-ink">{num1(r.complete_per_day)}</b>/day · {pct(r.completion_rate, 0)} complete
              </span>
            </div>
            <ProgressBar value={r.complete_per_day} max={max} label={`${r.center} completes per day`} />
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

export default function Operations() {
  const { state, meta } = useStateCtx()
  const ov = useStateQuery<Overview>(state, 'overview', {}, { status: 'All' })
  const trend = useStateQuery<Day[]>(state, 'trend', {}, { status: 'All' })
  const acs = useStateQuery<AcRow[]>(state, 'ac-progress', {}, { status: 'All' })
  const heat = useStateQuery<Heatmap>(state, 'heatmap', {}, { status: 'All' })
  const dist = useStateQuery<DistrictRow[]>(state, 'districts', {}, { status: 'All' })
  const cc = useStateQuery<CallCenter[]>(state, 'call-centers', {}, { status: 'All' })
  const o = ov.data

  const latest = o?.latest_day
  const prev = o?.previous_day
  return (
    <div className="space-y-5 animate-fade-in">
      <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-3', meta.phases.length > 1 ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
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
        {(o?.phases ?? meta.phases.map((p) => ({ ...p, done: 0, acs: 0 }))).map((p) => (
          <Stat
            key={p.name}
            loading={!o}
            label={`${p.name} · ${p.target} per AC`}
            value={
              <>
                {p.done}
                <span className="text-[15px] font-normal text-ink-3"> / {p.acs}</span>
              </>
            }
            sub="ACs at target"
            chart={<Ring value={p.done} max={p.acs} />}
          />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Daily interviews"
          subtitle="Complete and partial calls per day"
          loading={trend.isFetching}
          table={trend.data?.map((d) => ({ Date: d.date, Complete: d.complete, Partial: d.partial, Total: d.total }))}
          filename={`${state}-daily.csv`}
        >
          {trend.data ? trend.data.length ? <TrendChart data={trend.data} /> : <Empty /> : <Skeleton className="h-[260px]" />}
        </ChartCard>
        {meta.has_call_centers && cc.data?.length ? (
          <CallCenters rows={cc.data} />
        ) : (
          <ChartCard
            title="Completion by district"
            subtitle="Share of calls that were complete"
            table={dist.data?.map((d) => ({ District: d.district, ACs: d.acs, Complete: d.complete, Partial: d.partial, 'Completion %': d.completion_rate }))}
            filename={`${state}-districts.csv`}
          >
            {dist.data ? (
              <div className="scroll-thin max-h-[270px] overflow-auto pr-1">
                <RankedBars items={[...dist.data].sort((a, b) => b.completion_rate - a.completion_rate).map((d) => ({ label: d.district, count: d.complete, pct: d.completion_rate }))} max={100} />
              </div>
            ) : (
              <Skeleton className="h-[260px]" />
            )}
          </ChartCard>
        )}
      </div>

      <ChartCard
        title="Fieldwork heatmap"
        subtitle="Complete interviews per district per day. Gaps show days a district wasn't worked."
        loading={heat.isFetching}
        table={heat.data?.rows.map((r) => ({ District: r.district, Total: r.total, ...Object.fromEntries(heat.data!.dates.map((d, i) => [d, r.values[i]])) }))}
        filename={`${state}-heatmap.csv`}
      >
        {heat.data ? heat.data.rows.length ? <HeatmapChart data={heat.data} /> : <Empty /> : <Skeleton className="h-[320px]" />}
      </ChartCard>

      {acs.data ? <AcTable rows={acs.data} loading={acs.isFetching} /> : <Skeleton className="h-[480px] rounded-xl" />}
    </div>
  )
}
