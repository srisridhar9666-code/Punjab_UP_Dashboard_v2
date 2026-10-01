import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api, ApiError, post } from '@/lib/api'
import type { Me } from '@/lib/types'

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<Me>('/auth/me')
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useSessionExpiry() {
  const qc = useQueryClient()
  useEffect(() => {
    const onExpired = () => qc.setQueryData(['me'], null)
    window.addEventListener('session-expired', onExpired)
    return () => window.removeEventListener('session-expired', onExpired)
  }, [qc])
}

export function useLogout() {
  const qc = useQueryClient()
  return async () => {
    await post('/auth/logout').catch(() => undefined)
    qc.clear()
    qc.setQueryData(['me'], null)
  }
}
