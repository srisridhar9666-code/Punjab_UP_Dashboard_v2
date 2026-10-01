import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as DM from '@radix-ui/react-dropdown-menu'
import { KeyRound, MoreHorizontal, Plus, Trash2, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { api, del, patch, post } from '@/lib/api'
import type { Me, UserRow } from '@/lib/types'
import { useMe } from '@/hooks/useAuth'
import { ago } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, Field, Input, Select } from '@/components/ui/Misc'
import { Dialog } from '@/components/ui/Overlay'
import { PageHeader } from './PageHeader'

const ROLES: { value: Me['role']; label: string; desc: string }[] = [
  { value: 'admin', label: 'Admin', desc: 'Everything, including users and both states' },
  { value: 'punjab', label: 'Punjab team', desc: 'View and upload Punjab only' },
  { value: 'up', label: 'UP team', desc: 'View and upload Uttar Pradesh only' },
  { value: 'viewer', label: 'Viewer', desc: 'View both states, no uploads' },
]
const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r

function genPassword() {
  const a = new Uint32Array(4)
  crypto.getRandomValues(a)
  return Array.from(a, (n) => n.toString(36)).join('-').slice(0, 20)
}

export default function Users() {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const { data } = useQuery({ queryKey: ['users'], queryFn: () => api<UserRow[]>('/users') })
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ username: '', full_name: '', role: 'viewer' as Me['role'], password: '' })
  const [reset, setReset] = useState<{ user: UserRow; password: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })
  const onError = (e: Error) => toast.error(e.message)

  const create = useMutation({
    mutationFn: () => post<UserRow>('/users', form),
    onSuccess: (u) => {
      toast.success(`${u.username} created. Share the temporary password privately; they'll choose their own at first sign-in.`)
      setCreating(false)
      refresh()
    },
    onError,
  })
  const update = useMutation({ mutationFn: ({ id, body }: { id: number; body: Partial<UserRow> }) => patch<UserRow>(`/users/${id}`, body), onSuccess: refresh, onError })
  const doReset = useMutation({
    mutationFn: () => post<UserRow>(`/users/${reset!.user.id}/reset-password`, { password: reset!.password }),
    onSuccess: () => {
      toast.success('Password reset. They must choose a new one at next sign-in.')
      setReset(null)
      refresh()
    },
    onError,
  })
  const remove = useMutation({
    mutationFn: (u: UserRow) => del(`/users/${u.id}`),
    onSuccess: () => {
      setConfirmDelete(null)
      refresh()
    },
    onError,
  })

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-4 lg:p-8">
      <PageHeader
        title="Users & roles"
        subtitle="Access is enforced on the server: a Punjab user cannot read UP data, whatever the browser does."
        actions={
          <Button variant="primary" onClick={() => { setForm({ username: '', full_name: '', role: 'viewer', password: genPassword() }); setCreating(true) }}>
            <Plus className="h-4 w-4" /> Add user
          </Button>
        }
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className="text-left text-[12px] text-ink-3">
            <tr className="border-b hairline">
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Last sign-in</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id} className="border-b hairline last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-sunken text-[12px] font-semibold text-ink-2">{(u.full_name || u.username)[0].toUpperCase()}</span>
                    <div>
                      <div className="font-medium">{u.full_name || u.username}</div>
                      <div className="text-[12px] text-ink-3">@{u.username}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Select aria-label={`Role for ${u.username}`} value={u.role} disabled={u.id === me?.id} onChange={(e) => update.mutate({ id: u.id, body: { role: e.target.value as Me['role'] } })} className="w-[150px]">
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-3">
                  {!u.is_active ? <Badge tone="bad">Disabled</Badge> : u.must_change_password ? <Badge tone="warn">Must set password</Badge> : <Badge tone="good">Active</Badge>}
                </td>
                <td className="px-3 py-3 text-ink-3">{u.last_login_at ? ago(u.last_login_at + 'Z') : 'Never'}</td>
                <td className="px-5 py-3 text-right">
                  {u.id !== me?.id && (
                    <DM.Root>
                      <DM.Trigger className="rounded-md p-1.5 text-ink-3 hover:bg-sunken hover:text-ink" aria-label={`Actions for ${u.username}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DM.Trigger>
                      <DM.Portal>
                        <DM.Content align="end" sideOffset={4} className="z-50 min-w-[190px] rounded-xl bg-surface p-1 shadow-pop">
                          <DM.Item onSelect={() => setReset({ user: u, password: genPassword() })} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] outline-none data-[highlighted]:bg-sunken">
                            <KeyRound className="h-4 w-4 text-ink-3" /> Reset password
                          </DM.Item>
                          <DM.Item onSelect={() => update.mutate({ id: u.id, body: { is_active: !u.is_active } })} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] outline-none data-[highlighted]:bg-sunken">
                            {u.is_active ? <UserX className="h-4 w-4 text-ink-3" /> : <UserCheck className="h-4 w-4 text-ink-3" />} {u.is_active ? 'Disable sign-in' : 'Enable sign-in'}
                          </DM.Item>
                          <DM.Separator className="my-1 h-px bg-line" />
                          <DM.Item onSelect={() => setConfirmDelete(u)} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-bad outline-none data-[highlighted]:bg-sunken">
                            <Trash2 className="h-4 w-4" /> Delete user
                          </DM.Item>
                        </DM.Content>
                      </DM.Portal>
                    </DM.Root>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={creating} onOpenChange={setCreating} title="Add user" description="They'll be asked to choose their own password the first time they sign in.">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username">
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required pattern="[A-Za-z0-9_.\-]{3,}" />
            </Field>
            <Field label="Full name">
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
          </div>
          <Field label="Role" hint={ROLES.find((r) => r.value === form.role)?.desc}>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Me['role'] })}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Temporary password" hint="Generated for you. Copy it now and share it privately.">
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} className="font-mono" />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create user'}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!reset} onOpenChange={(o) => !o && setReset(null)} title={`Reset password for ${reset?.user.username}`} description="This signs them out everywhere. They'll choose a new password at next sign-in.">
        <form onSubmit={(e) => { e.preventDefault(); doReset.mutate() }} className="space-y-4">
          <Field label="Temporary password">
            <Input value={reset?.password ?? ''} onChange={(e) => reset && setReset({ ...reset, password: e.target.value })} minLength={10} className="font-mono" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setReset(null)}>Cancel</Button>
            <Button variant="primary" disabled={doReset.isPending}>Reset password</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)} title={`Delete ${confirmDelete?.username}?`} description="This can't be undone. Disabling sign-in is usually the better choice.">
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" disabled={remove.isPending} onClick={() => confirmDelete && remove.mutate(confirmDelete)}>Delete</Button>
        </div>
      </Dialog>
      <p className="text-[12px] text-ink-3">Roles: {ROLES.map((r) => `${roleLabel(r.value)} (${r.desc.toLowerCase()})`).join(' · ')}</p>
    </div>
  )
}
