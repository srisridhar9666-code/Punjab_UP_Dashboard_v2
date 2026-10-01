export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

type Params = Record<string, string | number | undefined | null>

function qs(params?: Params) {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export async function api<T>(path: string, init: RequestInit & { params?: Params } = {}): Promise<T> {
  const { params, headers, ...rest } = init
  const res = await fetch(`/api${path}${qs(params)}`, {
    credentials: 'same-origin',
    ...rest,
    headers: { 'X-Requested-With': 'XMLHttpRequest', ...(rest.body && !(rest.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...headers },
  })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : Array.isArray(body?.detail) ? body.detail.map((d: { msg: string }) => d.msg).join('; ') : res.statusText
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'))
    throw new ApiError(res.status, detail || 'Request failed')
  }
  return body as T
}

export const post = <T,>(path: string, data?: unknown) => api<T>(path, { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data ?? {}) })
export const patch = <T,>(path: string, data: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(data) })
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' })
