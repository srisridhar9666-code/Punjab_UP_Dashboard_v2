import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useStateQuery } from '@/hooks/useStateData'
import { useFilters } from '@/hooks/useFilters'
import { useTheme } from '@/hooks/useTheme'
import type { Strategy as S, Swing } from '@/lib/types'
import { DK, chrome, partyColor } from '@/lib/colors'
import { cleanLabel, num, pct, signed } from '@/lib/format'
import { Delta, Stat } from '@/components/ui/Stat'
import { Empty, Select, Skeleton } from '@/components/ui/Misc'
import { ChartCard } from '@/components/charts/ChartCard'
import { SwingSankey } from '@/components/charts/SwingSankey'
import { RankedBars } from '@/components/charts/Bars'
import { Tip } from '@/components/ui/Overlay'
import { useStateCtx } from './StateLayout'

function ShareShift({ data }: { data: Swing }) {
  const [, mode] = useTheme()
  const rows = data.shares.filter((s) => s.party !== DK)
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.change)), 1)
  return (
    <table className="w-full text-[13px]">
      <thead className="text-left text-[12px] text-ink-3">
        <tr>
          <th className="pb-2 font-medium">Party</th>
          <th className="pb-2 text-right font-medium">Then</th>
          <th className="pb-2 text-right font-medium">Now</th>
          <th className="w-[42%] pb-2 pl-4 font-medium">Change (points)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.party} className="border-t hairline">
            <td className="py-2">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: partyColor(r.party, mode) }} />
                {r.party}
              </span>
            </td>
            <td className="tabular py-2 text-right text-ink-2">{pct(r.from_pct)}</td>
            <td className="tabular py-2 text-right font-medium">{pct(r.to_pct)}</td>
            <td className="py-2 pl-4">
              <div className="grid grid-cols-[1fr_1fr_44px] items-center gap-1">
                <span className="flex justify-end">{r.change < 0 && <span className="h-2 rounded-l-[3px] bg-bad/80" style={{ width: `${(Math.abs(r.change) / maxAbs) * 100}%` }} />}</span>
                <span className="flex border-l border-line">{r.change > 0 && <span className="h-2 rounded-r-[3px] bg-accent" style={{ width: `${(r.change / maxAbs) * 100}%` }} />}</span>
                <span className="tabular text-right text-[12px] text-ink-2">{signed(r.change)}</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Strategy() {
  const { state, meta } = useStateCtx()
  const { set } = useFilters()
  const votes = meta.vote_columns
  const [from, setFrom] = useState(votes[0].key)
  const [to, setTo] = useState(votes[votes.length - 1].key)
  const st = useStateQuery<S>(state, 'strategy')
  const sw = useStateQuery<Swing>(state, 'swing', { from, to })
  const [, mode] = useTheme()
  const s = st.data
  const label = (k: string) => votes.find((v) => v.key === k)?.label ?? k

  if (!s) return <Skeleton className="h-[600px] rounded-xl" />
  if (s.base === 0) return <Empty title="No complete interviews in this selection" hint="Clear a filter or widen the date range." />

  const inc = s.incumbent_share
  // Staying wears the incumbent's own party colour; the rest stay neutral so they never clash with a party below.
  const retention: [string, number | null, string][] = [
    ['Staying', s.retention.retained_pct, partyColor(s.incumbent, mode)],
    ['Undecided', s.retention.undecided_pct, chrome[mode].dk],
    ['Switching', s.retention.leakage_pct, chrome[mode].ink2],
  ]
  return (
    <div className={`space-y-5 animate-fade-in ${st.isFetching ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Net satisfaction with government"
          value={s.net_satisfaction == null ? '—' : signed(s.net_satisfaction, 0)}
          sub={`${pct(s.satisfied_pct, 0)} satisfied · ${pct(s.dissatisfied_pct, 0)} dissatisfied`}
        />
        <Stat
          label={`${s.incumbent} vote share now`}
          value={pct(inc?.to_pct)}
          delta={inc && <Delta value={inc.change} suffix=" pts" title="vs 2022 recall" />}
          sub={`was ${pct(inc?.from_pct)} in 2022 (recalled)`}
        />
        <Stat label={`${s.incumbent} 2022 voters staying`} value={pct(s.retention.retained_pct)} sub={`${pct(s.retention.undecided_pct)} undecided · ${pct(s.retention.leakage_pct)} switching`} />
        <Stat label="MLA seats at risk" value={s.risk.items.length} sub={`of ${s.risk.acs_rated} ACs, ≥${s.risk.threshold_pct}% unhappy with MLA`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <ChartCard
          className="xl:col-span-3"
          title="Voter flow"
          subtitle="Each band is a group of respondents moving from their earlier vote to their current choice"
          table={sw.data?.flows.map((f) => ({ From: f.from, To: f.to, Respondents: f.count, 'Share of sample %': f.pct }))}
          filename={`${state}-voter-flow.csv`}
          loading={sw.isFetching}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
            <Select aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[220px]">
              {votes.map((v) => (
                <option key={v.key} value={v.key}>{v.label}</option>
              ))}
            </Select>
            <span className="text-ink-3">to</span>
            <Select aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} className="w-[240px]">
              {votes.map((v) => (
                <option key={v.key} value={v.key}>{v.label}</option>
              ))}
            </Select>
          </div>
          {sw.data ? from === to ? <Empty title="Pick two different votes to compare" /> : <SwingSankey data={sw.data} fromLabel={label(from)} toLabel={label(to)} /> : <Skeleton className="h-[420px]" />}
        </ChartCard>
        <ChartCard className="xl:col-span-2" title="Share shift" subtitle={`${label(from)} → ${label(to)}, % of all complete interviews`}>
          {sw.data ? <ShareShift data={sw.data} /> : <Skeleton className="h-[300px]" />}
          {sw.data && <p className="mt-3 text-[11.5px] text-ink-3">Recalled past votes usually overstate the winner, so treat shifts as directional.</p>}
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title={`Where ${s.incumbent}'s 2022 voters are going`} subtitle={`${num(s.retention.base)} respondents who recall voting ${s.incumbent} in 2022`}>
          <div className="mb-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px]">
            {retention.map(([l, v, c]) => (
              <Tip key={l} content={`${l}: ${pct(v)}`}>
                <span className="h-full" style={{ width: `${v ?? 0}%`, background: c }} />
              </Tip>
            ))}
          </div>
          <div className="mb-4 flex gap-4 text-[12px] text-ink-2">
            {retention.map(([l, v, c]) => (
              <span key={l}>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-[2px]" style={{ background: c }} />
                {l} {pct(v, 0)}
              </span>
            ))}
          </div>
          <p className="label mb-2">Switching to</p>
          <RankedBars items={s.retention.leakage.map((l) => ({ label: l.to, count: l.count, pct: l.pct }))} party />
        </ChartCard>

        <ChartCard
          title="What drives dissatisfaction"
          subtitle="Top failure named by respondents dissatisfied with the government"
          table={s.drivers.map((d) => ({ Issue: d.issue, Respondents: d.count, Percent: d.pct }))}
          filename={`${state}-drivers.csv`}
        >
          {s.drivers.length ? <RankedBars items={s.drivers.map((d) => ({ label: d.issue, count: d.count, pct: d.pct }))} /> : <Empty />}
        </ChartCard>

        <ChartCard
          title="Seats at risk"
          subtitle={`ACs where ≥${s.risk.threshold_pct}% are dissatisfied with their MLA`}
          table={s.risk.items.map((r) => ({ AC: r.ac, District: r.district, Interviews: r.base, 'Dissatisfied %': r.dissatisfied_pct }))}
          filename={`${state}-seats-at-risk.csv`}
        >
          {s.risk.items.length ? (
            <ul className="scroll-thin max-h-[330px] space-y-1 overflow-auto pr-1">
              {s.risk.items.map((r) => (
                <li key={r.ac}>
                  <button onClick={() => set({ district: r.district ?? undefined, ac: r.ac })} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-sunken">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{r.ac}</span>
                      <span className="block text-[11.5px] text-ink-3">{r.district} · n = {r.base}</span>
                    </span>
                    <span className="tabular text-[13px] font-semibold text-bad">{pct(r.dissatisfied_pct, 0)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No seats over the threshold" />
          )}
        </ChartCard>
      </div>

      <ChartCard title={`${s.incumbent} vote intention across groups`} subtitle="Share intending to vote for the incumbent party, by respondent group (groups under 30 interviews hidden)">
        <div className="grid gap-6 md:grid-cols-3">
          {s.divides.map((d) => (
            <div key={d.dimension}>
              <p className="label mb-3">{d.dimension === 'locality' ? 'Urban vs rural' : d.dimension === 'gender' ? 'Gender' : 'Age'}</p>
              <RankedBars max={100} items={d.groups.filter((g) => g.pct != null).map((g) => ({ label: cleanLabel(g.group), count: g.base, pct: g.pct! }))} />
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  )
}
