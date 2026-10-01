import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { COMPANY, CREATOR, CompanyLogo } from '@/components/Brand'
import { post } from '@/lib/api'
import type { Me } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Misc'

export default function Login() {
  const qc = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const me = await post<Me>('/auth/login', { username, password })
      qc.setQueryData(['me'], me)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#0d1b2e] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#2a78d6] opacity-30 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-48 -left-24 h-[420px] w-[420px] rounded-full bg-[#1baf7a] opacity-20 blur-[120px]" />
        <div className="relative flex items-center gap-2.5">
          <CompanyLogo dark className="h-14" />
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold">Call Center Intelligence</span>
            <span className="block text-[12px] text-white/60">{COMPANY}</span>
          </span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h1 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.02em]">Field operations and voter sentiment, in one place.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">Track every constituency against target, see how opinion is moving, and spot seats at risk the day the data lands.</p>
          <ul className="mt-8 space-y-3 text-[13.5px] text-white/80">
            <li className="flex items-center gap-2.5"><Sparkles className="h-4 w-4 text-[#86b6ef]" /> Live targets, pace and ETA per constituency</li>
            <li className="flex items-center gap-2.5"><ShieldCheck className="h-4 w-4 text-[#86b6ef]" /> Role-based access per state, with a full audit trail</li>
            <li className="flex items-center gap-2.5"><Lock className="h-4 w-4 text-[#86b6ef]" /> Only aggregates leave the server, never respondent rows</li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-[360px] space-y-5">
          <div className="flex items-center gap-2.5 lg:hidden">
            <CompanyLogo className="h-12" />
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold">Call Center Intelligence</span>
              <span className="block text-[12px] text-ink-3">{COMPANY}</span>
            </span>
          </div>
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Sign in</h2>
            <p className="mt-1 text-[13.5px] text-ink-3">Use the account your administrator gave you.</p>
          </div>
          <Field label="Username">
            <Input autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">{error}</p>}
          <Button variant="primary" className="w-full justify-center" disabled={busy || !username || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-center text-[12px] text-ink-3">Forgot your password? Ask an admin to reset it.</p>
        </form>
        <p className="mt-8 text-center text-[12px] text-ink-3">
          Created by <span className="font-semibold text-accent">{CREATOR}</span>
          <br />© {COMPANY}
        </p>
      </div>
    </div>
  )
}
