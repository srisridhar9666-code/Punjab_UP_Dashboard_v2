import { useState } from 'react'
import { useStateQuery } from '@/hooks/useStateData'
import { useTheme } from '@/hooks/useTheme'
import type { Crosstab } from '@/lib/types'
import { DK, OTHER, partyColor } from '@/lib/colors'
import { cleanLabel, num } from '@/lib/format'
import { Empty, Segmented, Select, Skeleton } from '@/components/ui/Misc'
import { ChartCard } from '@/components/charts/ChartCard'
import { useStateCtx } from './StateLayout'

export default function Explorer() {
  const { state, meta } = useStateCtx()
  const [, mode] = useTheme()
  const ratingCols = state === 'punjab' ? [{ key: 'aap_govt_rating', label: 'AAP government rating' }, { key: 'mla_satisfaction', label: 'MLA satisfaction' }] : [{ key: 'yogi_rating', label: 'Yogi Adityanath rating' }, { key: 'mla_rating', label: 'MLA rating' }]
  const colOptions = [...meta.vote_columns, ...ratingCols]
  const rowOptions = [...meta.crosstab_dimensions, { key: 'district', label: 'District' }]
  const [row, setRow] = useState('caste_category')
  const [col, setCol] = useState(meta.vote_columns[meta.vote_columns.length - 1].key)
  const [shade, setShade] = useState<'row' | 'none'>('row')
  const { data, isFetching } = useStateQuery<Crosstab>(state, 'crosstab', { row, col })

  const max = data ? Math.max(1, ...data.rows.flatMap((r) => r.cells.filter((c) => c.col !== DK).map((c) => c.pct))) : 1
  const colLabel = colOptions.find((c) => c.key === col)?.label
  const rowLabel = rowOptions.find((r) => r.key === row)?.label

  return (
    <div className="space-y-5 animate-fade-in">
      <ChartCard
        title="Crosstab explorer"
        subtitle={`${colLabel} by ${rowLabel?.toLowerCase()}. Each row sums to 100%; darker cells are higher shares.`}
        loading={isFetching}
        actions={<Segmented size="xs" value={shade} onChange={setShade} options={[{ value: 'row', label: 'Shaded' }, { value: 'none', label: 'Plain' }]} />}
        table={data?.rows.map((r) => ({ [rowLabel ?? 'Group']: cleanLabel(r.label), n: r.base, ...Object.fromEntries(r.cells.map((c) => [c.col, c.pct])) }))}
        filename={`${state}-${row}-by-${col}.csv`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-ink-3">Show</span>
          <Select value={col} onChange={(e) => setCol(e.target.value)} className="w-[220px]" aria-label="Measure">
            {colOptions.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </Select>
          <span className="text-ink-3">by</span>
          <Select value={row} onChange={(e) => setRow(e.target.value)} className="w-[200px]" aria-label="Group by">
            {rowOptions.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </Select>
        </div>
        {!data ? (
          <Skeleton className="h-[360px]" />
        ) : !data.rows.length ? (
          <Empty />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-[2px] text-[12.5px]">
              <thead>
                <tr className="text-ink-3">
                  <th className="px-2 pb-2 text-left font-medium">{rowLabel}</th>
                  <th className="px-2 pb-2 text-right font-medium">n</th>
                  {data.columns.map((c) => (
                    <th key={c} className="px-2 pb-2 text-right font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {col.startsWith('vote') && c !== OTHER && c !== DK && <span className="h-2 w-2 rounded-[2px]" style={{ background: partyColor(c, mode) }} />}
                        {c === DK ? 'No answer' : cleanLabel(c)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.label}>
                    <td className="whitespace-nowrap px-2 py-2 font-medium">{cleanLabel(r.label)}</td>
                    <td className={`tabular px-2 py-2 text-right ${r.base < 50 ? 'text-warn' : 'text-ink-3'}`} title={r.base < 50 ? 'Small base' : undefined}>{num(r.base)}</td>
                    {r.cells.map((c) => {
                      const t = c.col === DK || shade === 'none' ? 0 : c.pct / max
                      const bg = t > 0 ? (mode === 'dark' ? `rgba(57,135,229,${(t * 0.85).toFixed(3)})` : `rgba(42,120,214,${(t * 0.9).toFixed(3)})`) : 'transparent'
                      return (
                        <td key={c.col} className="tabular rounded-[4px] px-2 py-2 text-right" style={{ background: bg, color: t > 0.55 ? '#fff' : undefined }} title={`${num(c.count)} respondents`}>
                          {c.pct.toFixed(1)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11.5px] text-ink-3">Groups with fewer than 50 interviews are marked in amber. Hover a cell for the respondent count.</p>
          </div>
        )}
      </ChartCard>
    </div>
  )
}
