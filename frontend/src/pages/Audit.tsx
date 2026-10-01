import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AuditRow } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { Badge, Select } from '@/components/ui/Misc'
import { PageHeader } from './PageHeader'

const TONE: Record<string, 'neutral' | 'good' | 'warn' | 'bad' | 'accent'> = {
  login: 'good', login_failed: 'warn', login_locked: 'bad', login_throttled: 'bad', login_disabled: 'warn',
  upload: 'accent', upload_restored: 'accent', user_created: 'accent', user_deleted: 'bad', password_reset: 'warn',
}
const ACTIONS = ['login', 'login_failed', 'login_locked', 'login_throttled', 'password_changed', 'password_reset', 'upload', 'upload_restored', 'user_created', 'user_updated', 'user_deleted']

export default function Audit() {
  const [action, setAction] = useState('')
  const { data } = useQuery({ queryKey: ['audit', action], queryFn: () => api<AuditRow[]>('/users/audit', { params: { action, limit: 500 } }) })
  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-4 lg:p-8">
      <PageHeader
        title="Audit log"
        subtitle="Every sign-in, upload, restore and user change, newest first."
        actions={
          <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-[200px]" aria-label="Filter by action">
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </Select>
        }
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className="text-left text-[12px] text-ink-3">
            <tr className="border-b hairline">
              <th className="px-5 py-3 font-medium">When</th>
              <th className="px-3 py-3 font-medium">User</th>
              <th className="px-3 py-3 font-medium">Action</th>
              <th className="px-3 py-3 font-medium">Detail</th>
              <th className="px-5 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id} className="border-b hairline last:border-0">
                <td className="tabular whitespace-nowrap px-5 py-2.5 text-ink-2">{new Date(r.at + 'Z').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="px-3 py-2.5 font-medium">{r.username ?? '—'}</td>
                <td className="px-3 py-2.5"><Badge tone={TONE[r.action] ?? 'neutral'}>{r.action.replace(/_/g, ' ')}</Badge></td>
                <td className="max-w-[360px] truncate px-3 py-2.5 text-ink-2" title={r.detail ?? ''}>{r.detail ?? ''}</td>
                <td className="tabular px-5 py-2.5 text-ink-3">{r.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
