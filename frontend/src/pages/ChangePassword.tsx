import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { post } from '@/lib/api'
import type { Me } from '@/lib/types'
import { useMe } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Misc'

export default function ChangePassword() {
  const { data: me } = useMe()
  const qc = useQueryClient()
  const nav = useNavigate()
  const [oldPw, setOld] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const forced = me?.must_change_password

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw !== pw2) return setError('The new passwords do not match')
    setBusy(true)
    setError('')
    try {
      const next = await post<Me>('/auth/change-password', { old_password: oldPw, new_password: pw })
      qc.setQueryData(['me'], next)
      toast.success('Password updated. Other sessions were signed out.')
      nav('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-[400px] space-y-5 p-7">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-ink">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em]">{forced ? 'Choose a new password' : 'Change password'}</h2>
          <p className="mt-1 text-[13px] text-ink-3">{forced ? 'Your account was created or reset by an admin, so you need your own password before continuing.' : 'Changing it signs you out everywhere else.'}</p>
        </div>
        <Field label="Current password">
          <Input type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOld(e.target.value)} required />
        </Field>
        <Field label="New password" hint="At least 10 characters, and not containing your username.">
          <Input type="password" autoComplete="new-password" minLength={10} value={pw} onChange={(e) => setPw(e.target.value)} required />
        </Field>
        <Field label="Repeat new password">
          <Input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">{error}</p>}
        <Button variant="primary" className="w-full justify-center" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </div>
  )
}
