import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

export const FILTER_KEYS = ['district', 'ac', 'date_from', 'date_to', 'gender', 'age', 'locality', 'education', 'occupation', 'religion', 'caste_category', 'income'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]
export type Filters = Partial<Record<FilterKey, string>>

export const DEMOGRAPHIC_KEYS: FilterKey[] = ['gender', 'age', 'locality', 'education', 'occupation', 'religion', 'caste_category', 'income']
export const FILTER_LABELS: Record<FilterKey, string> = {
  district: 'District', ac: 'Constituency', date_from: 'From', date_to: 'To', gender: 'Gender', age: 'Age',
  locality: 'Locality', education: 'Education', occupation: 'Occupation', religion: 'Religion', caste_category: 'Caste category', income: 'Income',
}

/** Filters live in the URL, so every view is shareable and survives reloads. */
export function useFilters() {
  const [sp, setSp] = useSearchParams()
  const filters = useMemo(() => {
    const f: Filters = {}
    for (const k of FILTER_KEYS) {
      const v = sp.get(k)
      if (v) f[k] = v
    }
    return f
  }, [sp])

  const set = useCallback(
    (patch: Filters) => {
      setSp((prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v)
          else next.delete(k)
        }
        if ('district' in patch && !('ac' in patch)) next.delete('ac')
        return next
      }, { replace: true })
    },
    [setSp],
  )

  const clear = useCallback(() => {
    setSp((prev) => {
      const next = new URLSearchParams(prev)
      FILTER_KEYS.forEach((k) => next.delete(k))
      return next
    }, { replace: true })
  }, [setSp])

  return { filters, set, clear, active: Object.keys(filters).length }
}
