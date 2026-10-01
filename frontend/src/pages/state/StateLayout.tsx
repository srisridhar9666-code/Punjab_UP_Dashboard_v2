import { useQuery } from '@tanstack/react-query'
import { NavLink, Navigate, Outlet, useLocation, useOutletContext, useParams } from 'react-router'
import { BarChart3, Compass, Sparkles, Target } from 'lucide-react'
import { api } from '@/lib/api'
import type { Meta, StateKey } from '@/lib/types'
import { useMe } from '@/hooks/useAuth'
import { ago, day } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge, Skeleton } from '@/components/ui/Misc'
import { FilterBar } from '@/components/layout/FilterBar'
import { PageHeader } from '../PageHeader'

export interface StateCtx {
  state: StateKey
  meta: Meta
}
export const useStateCtx = () => useOutletContext<StateCtx>()

const TABS = [
  { to: '', label: 'Operations', icon: Compass },
  { to: 'opinion', label: 'Opinion', icon: BarChart3 },
  { to: 'strategy', label: 'Strategy', icon: Target },
  { to: 'explorer', label: 'Explorer', icon: Sparkles },
]

export default function StateLayout() {
  const { state } = useParams() as { state: StateKey }
  const { data: me } = useMe()
  const loc = useLocation()
  const allowed = me?.states.includes(state)
  const { data: meta, isLoading } = useQuery({ queryKey: ['meta', state], queryFn: () => api<Meta>(`/states/${state}/meta`), enabled: !!allowed, staleTime: 300_000 })

  if (!allowed) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-8">
      <PageHeader
        eyebrow={
          meta && (
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
              <Badge tone="accent">{meta.short}</Badge>
              {meta.date_min && meta.date_max && (
                <span>
                  Fieldwork {day(meta.date_min)} – {day(meta.date_max, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
              {meta.last_upload && <span>· Updated {ago(meta.last_upload.at)}</span>}
            </div>
          )
        }
        title={meta?.name ?? <Skeleton className="h-8 w-48" />}
      />

      <nav className="mt-5 flex gap-1 overflow-x-auto border-b hairline" aria-label="Sections">
        {TABS.map((t) => (
          <NavLink
            key={t.label}
            to={{ pathname: t.to ? `/s/${state}/${t.to}` : `/s/${state}`, search: loc.search }}
            end
            className={({ isActive }) =>
              cn('-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-[13.5px] font-medium transition-colors', isActive ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink')
            }
          >
            <t.icon className="h-4 w-4" strokeWidth={1.8} />
            {t.label}
          </NavLink>
        ))}
      </nav>

      <div className="sticky top-0 z-20 -mx-4 bg-page/85 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">{meta ? <FilterBar meta={meta} /> : <Skeleton className="h-8 w-[520px] max-w-full" />}</div>

      <div className="mt-2">{isLoading || !meta ? <Skeleton className="h-[480px] rounded-xl" /> : <Outlet context={{ state, meta } satisfies StateCtx} />}</div>
    </div>
  )
}
