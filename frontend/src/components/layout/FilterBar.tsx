import * as P from '@radix-ui/react-popover'
import { CalendarDays, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Misc'
import { DEMOGRAPHIC_KEYS, FILTER_LABELS, useFilters, type FilterKey } from '@/hooks/useFilters'
import { cleanLabel, day } from '@/lib/format'
import type { Meta } from '@/lib/types'
import { cn } from '@/lib/cn'

function shift(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

/** One filter row scoping every chart on the page. State lives in the URL. */
export function FilterBar({ meta }: { meta: Meta }) {
  const { filters, set, clear, active } = useFilters()
  const acs = meta.acs.filter((a) => !filters.district || a.district === filters.district)
  const max = meta.date_max
  const presets = max
    ? [
        { label: 'All dates', from: undefined, to: undefined },
        { label: 'Latest day', from: max, to: max },
        { label: 'Last 3 days', from: shift(max, -2), to: max },
        { label: 'Last 7 days', from: shift(max, -6), to: max },
      ]
    : []
  const presetLabel = presets.find((p) => p.from === filters.date_from && p.to === filters.date_to)?.label
  const dateLabel = presetLabel ?? (filters.date_from || filters.date_to ? `${filters.date_from ? day(filters.date_from) : '…'} – ${filters.date_to ? day(filters.date_to) : '…'}` : 'All dates')
  const demoActive = DEMOGRAPHIC_KEYS.filter((k) => filters[k])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="District" value={filters.district ?? ''} onChange={(e) => set({ district: e.target.value || undefined })} className="w-[170px]">
          <option value="">All districts</option>
          {meta.districts.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
        <Select aria-label="Constituency" value={filters.ac ?? ''} onChange={(e) => set({ ac: e.target.value || undefined, district: filters.district })} className="w-[190px]">
          <option value="">All constituencies</option>
          {acs.map((a) => (
            <option key={a.ac} value={a.ac}>
              {a.ac}
            </option>
          ))}
        </Select>

        <P.Root>
          <P.Trigger asChild>
            <Button size="sm" className={cn((filters.date_from || filters.date_to) && 'ring-2 ring-accent/30')}>
              <CalendarDays className="h-3.5 w-3.5 text-ink-3" /> {dateLabel}
            </Button>
          </P.Trigger>
          <P.Portal>
            <P.Content align="start" sideOffset={6} className="z-50 w-[260px] rounded-xl bg-surface p-1.5 shadow-pop animate-fade-in">
              {presets.map((p) => (
                <P.Close asChild key={p.label}>
                  <button
                    onClick={() => set({ date_from: p.from, date_to: p.to })}
                    className={cn('flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-sunken', presetLabel === p.label && 'font-semibold')}
                  >
                    {p.label}
                    {presetLabel === p.label && <span className="text-accent">✓</span>}
                  </button>
                </P.Close>
              ))}
              <div className="mt-1.5 space-y-2 border-t hairline px-2.5 pb-1.5 pt-2.5">
                <p className="label">Custom range</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" aria-label="From" min={meta.date_min ?? undefined} max={max ?? undefined} value={filters.date_from ?? ''} onChange={(e) => set({ date_from: e.target.value || undefined })} className="h-8 rounded-md bg-sunken px-2 text-[12px] outline-none" />
                  <input type="date" aria-label="To" min={meta.date_min ?? undefined} max={max ?? undefined} value={filters.date_to ?? ''} onChange={(e) => set({ date_to: e.target.value || undefined })} className="h-8 rounded-md bg-sunken px-2 text-[12px] outline-none" />
                </div>
              </div>
            </P.Content>
          </P.Portal>
        </P.Root>

        <P.Root>
          <P.Trigger asChild>
            <Button size="sm" className={cn(demoActive.length > 0 && 'ring-2 ring-accent/30')}>
              <SlidersHorizontal className="h-3.5 w-3.5 text-ink-3" /> Respondents
              {demoActive.length > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] text-white">{demoActive.length}</span>}
            </Button>
          </P.Trigger>
          <P.Portal>
            <P.Content align="start" sideOffset={6} className="z-50 w-[340px] rounded-xl bg-surface p-4 shadow-pop animate-fade-in">
              <p className="mb-3 text-[13px] font-semibold">Filter by respondent</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                {DEMOGRAPHIC_KEYS.map((k) => (
                  <label key={k} className="space-y-1">
                    <span className="text-[11.5px] text-ink-3">{FILTER_LABELS[k]}</span>
                    <Select value={filters[k] ?? ''} onChange={(e) => set({ [k]: e.target.value || undefined })}>
                      <option value="">Any</option>
                      {(meta.filter_options[k] ?? []).map((o) => (
                        <option key={o} value={o}>
                          {cleanLabel(o)}
                        </option>
                      ))}
                    </Select>
                  </label>
                ))}
              </div>
            </P.Content>
          </P.Portal>
        </P.Root>

        {active > 0 && (
          <Button size="sm" variant="ghost" onClick={clear}>
            Clear all
          </Button>
        )}
      </div>
      {active > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(filters) as FilterKey[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pl-2.5 pr-1 text-[12px] text-accent-ink">
              <span className="text-accent-ink/70">{FILTER_LABELS[k]}:</span> {k.startsWith('date') ? day(filters[k]!) : cleanLabel(filters[k]!)}
              <button aria-label={`Remove ${FILTER_LABELS[k]} filter`} onClick={() => set({ [k]: undefined })} className="rounded-full p-0.5 hover:bg-accent/15">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
