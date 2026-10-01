import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowRight, CloudUpload } from 'lucide-react'
import { api } from '@/lib/api'
import type { PortfolioItem } from '@/lib/types'
import { useMe } from '@/hooks/useAuth'
import { ago, day, num, pct } from '@/lib/format'
import { Delta, Ring } from '@/components/ui/Stat'
import { Skeleton, Empty } from '@/components/ui/Misc'
import { Sparkline } from '@/components/charts/Sparkline'
import { ProgressBar } from '@/components/charts/Bars'
import { PageHeader } from './PageHeader'

function StateCard({ s }: { s: PortfolioItem }) {
  const o = s.overview
  const latest = o.latest_day
  const prev = o.previous_day
  const final = o.phases[o.phases.length - 1]
  return (
    <Link to={`/s/${s.key}`} className="card group block p-6 transition hover:shadow-pop">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-xl text-[13px] font-bold text-white ${s.key === 'punjab' ? 'bg-[#eb6834]' : 'bg-[#4a3aa7]'}`}>{s.short}</span>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{s.name}</h2>
            <p className="text-[12.5px] text-ink-3">{s.last_upload ? `Data updated ${ago(s.last_upload.at)} by ${s.last_upload.by}` : 'No upload recorded yet'}</p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
      </div>

      {o.total === 0 ? (
        <Empty title="No survey data yet" hint="Upload this state's CSV to get started." />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <div>
              <p className="text-[12px] text-ink-3">Complete interviews</p>
              <p className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">{num(o.complete)}</p>
              <p className="text-[12px] text-ink-3">{pct(o.completion_rate, 0)} of {num(o.total)} calls</p>
            </div>
            <div>
              <p className="text-[12px] text-ink-3">Latest day</p>
              <p className="mt-1 flex items-center gap-2 text-[24px] font-semibold tracking-[-0.02em]">
                {num(latest?.complete ?? 0)}
                {latest && prev && <Delta value={latest.complete - prev.complete} title="vs previous day" />}
              </p>
              <p className="text-[12px] text-ink-3">{latest ? day(latest.date, { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</p>
            </div>
            <div>
              <p className="whitespace-nowrap text-[12px] text-ink-3">ACs at {final.name.toLowerCase()} target</p>
              <div className="mt-1 flex items-center gap-2.5">
                <Ring value={final.done} max={o.acs_surveyed} size={34} />
                <p className="whitespace-nowrap text-[20px] font-semibold tracking-[-0.02em]">
                  {final.done}
                  <span className="text-[13px] font-normal text-ink-3"> / {o.acs_surveyed}</span>
                </p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[12px] text-ink-3">Last 14 days</p>
              <Sparkline values={o.spark.map((d) => d.complete)} width={130} height={40} label={`${s.name} daily completes, last 14 days`} />
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-[12px] text-ink-3">
              <span>Constituency coverage</span>
              <span className="tabular">
                {o.acs_surveyed} of {o.total_acs} ACs surveyed
              </span>
            </div>
            <ProgressBar value={o.acs_surveyed} max={o.total_acs} label="Constituency coverage" />
          </div>
        </>
      )}
    </Link>
  )
}

export default function Portfolio() {
  const { data: me } = useMe()
  const { data, isLoading } = useQuery({ queryKey: ['portfolio'], queryFn: () => api<PortfolioItem[]>('/states'), staleTime: 60_000 })
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 lg:p-8">
      <PageHeader
        title={`${greet}, ${(me?.full_name || me?.username || '').split(' ')[0]}`}
        subtitle="Here's where fieldwork stands across your states."
        actions={
          (me?.upload_states.length ?? 0) > 0 && (
            <Link to="/uploads" className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white shadow-sm hover:bg-accent/90">
              <CloudUpload className="h-4 w-4" /> Upload today's data
            </Link>
          )
        }
      />
      <div className="grid gap-5 xl:grid-cols-2">
        {isLoading ? [0, 1].map((i) => <Skeleton key={i} className="h-[300px] rounded-xl" />) : data?.map((s) => <StateCard key={s.key} s={s} />)}
      </div>
    </div>
  )
}
