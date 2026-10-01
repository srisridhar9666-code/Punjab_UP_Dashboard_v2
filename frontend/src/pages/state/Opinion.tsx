import { AlertCircle, Users } from 'lucide-react'
import { useStateQuery } from '@/hooks/useStateData'
import type { QuestionBlock, Questions } from '@/lib/types'
import { cleanLabel, num } from '@/lib/format'
import { Skeleton } from '@/components/ui/Misc'
import { ChartCard } from '@/components/charts/ChartCard'
import { RankedBars, RatingBar } from '@/components/charts/Bars'
import { useStateCtx } from './StateLayout'

const SECTION_TITLES: Record<string, { title: string; blurb: string }> = {
  leadership: { title: 'Leadership', blurb: 'How respondents rate the state leadership' },
  mla: { title: 'Local MLA', blurb: 'Awareness, contact and satisfaction with the sitting MLA' },
  voting: { title: 'Voting', blurb: 'Past vote and current intention' },
  issues: { title: 'Issues', blurb: 'What respondents name as the government’s biggest failures and successes' },
  demographics: { title: 'Who we spoke to', blurb: 'Sample composition, so you can judge how representative the results are' },
}

function Block({ q, state }: { q: QuestionBlock; state: string }) {
  const table = q.items.map((i) => ({ Answer: cleanLabel(i.label), Respondents: i.count, Percent: i.pct }))
  const isRating = q.kind === 'rating' || (q.kind === 'choice' && q.items.some((i) => ['Satisfied', 'Dissatisfied'].includes(i.label)))
  return (
    <ChartCard
      title={q.title}
      subtitle={
        <>
          {q.question}
          <span className="ml-1 whitespace-nowrap">· n = {num(q.base)}</span>
        </>
      }
      table={table}
      filename={`${state}-${q.key}.csv`}
    >
      {q.base === 0 || q.items.length === 0 ? <p className="py-6 text-center text-[13px] text-ink-3">No answers in this selection.</p> : isRating ? <RatingBar items={q.items} /> : <RankedBars items={q.items} party={q.kind === 'party'} />}
      {q.kind === 'issue' && <p className="mt-3 text-[11.5px] text-ink-3">Percent of respondents naming the issue in their top two, so totals exceed 100%.</p>}
    </ChartCard>
  )
}

export default function Opinion() {
  const { state } = useStateCtx()
  const { data, isFetching } = useStateQuery<Questions>(state, 'questions')
  if (!data) return <Skeleton className="h-[600px] rounded-xl" />
  const low = data.respondents > 0 && data.respondents < 100

  return (
    <div className={`space-y-8 transition-opacity animate-fade-in ${isFetching ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-accent-soft/60 px-4 py-3 text-[13px] text-accent-ink">
        <Users className="h-4 w-4" />
        <span>
          Based on <b>{num(data.respondents)}</b> complete interviews in this selection.
        </span>
        {low && (
          <span className="inline-flex items-center gap-1 font-medium text-warn">
            <AlertCircle className="h-4 w-4" /> Small sample: read percentages with caution.
          </span>
        )}
      </div>
      {(Object.keys(SECTION_TITLES) as (keyof Questions['sections'])[]).map((key) => (
        <section key={key}>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{SECTION_TITLES[key].title}</h2>
            <p className="text-[12.5px] text-ink-3">{SECTION_TITLES[key].blurb}</p>
          </div>
          <div className={`grid items-start gap-4 ${key === 'demographics' ? 'md:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-2 xl:grid-cols-3'}`}>
            {data.sections[key].map((q) => (
              <Block key={q.key} q={q} state={state} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
