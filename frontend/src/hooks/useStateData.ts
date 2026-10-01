import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { StateKey } from '@/lib/types'
import { useFilters } from './useFilters'

/** Fetch a filtered analytics view. Keeps the previous result on screen while refetching (no skeleton flash). */
export function useStateQuery<T>(state: StateKey, view: string, extra: Record<string, string | undefined> = {}, opts: { status?: string } = {}) {
  const { filters } = useFilters()
  const params = { ...filters, ...extra, ...(opts.status ? { status: opts.status } : {}) }
  return useQuery<T>({
    queryKey: ['state', state, view, params],
    queryFn: () => api<T>(`/states/${state}/${view}`, { params }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
