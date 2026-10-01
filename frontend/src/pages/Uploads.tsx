import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, History, RotateCcw, UploadCloud, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api, post } from '@/lib/api'
import type { StateKey, UploadLog, UploadPreview } from '@/lib/types'
import { useMe } from '@/hooks/useAuth'
import { ago, day, num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, Empty, Segmented } from '@/components/ui/Misc'
import { Dialog } from '@/components/ui/Overlay'
import { PageHeader } from './PageHeader'

const NAMES: Record<StateKey, string> = { punjab: 'Punjab', up: 'Uttar Pradesh' }

export default function Uploads() {
  const { data: me } = useMe()
  const qc = useQueryClient()
  const states = me?.upload_states ?? []
  const [state, setState] = useState<StateKey>(states[0] ?? 'punjab')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<UploadPreview | null>(null)
  const [drag, setDrag] = useState(false)
  const [restoreId, setRestoreId] = useState<UploadLog | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const history = useQuery({ queryKey: ['uploads'], queryFn: () => api<UploadLog[]>('/uploads') })

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['uploads'] })
    qc.invalidateQueries({ queryKey: ['state'] })
    qc.invalidateQueries({ queryKey: ['meta'] })
    qc.invalidateQueries({ queryKey: ['portfolio'] })
  }

  const check = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData()
      fd.append('file', f)
      return post<UploadPreview>(`/uploads/${state}/preview`, fd)
    },
    onSuccess: setPreview,
    onError: (e: Error) => toast.error(e.message),
  })

  const commit = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('file', file!)
      return post<UploadLog>(`/uploads/${state}`, fd)
    },
    onSuccess: (log) => {
      toast.success(`${NAMES[state]} updated with ${num(log.rows_imported)} rows`)
      setFile(null)
      setPreview(null)
      refreshAll()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const restore = useMutation({
    mutationFn: (log: UploadLog) => post<UploadLog>(`/uploads/${log.state}/restore/${log.id}`),
    onSuccess: (log) => {
      toast.success(`Restored ${log.filename}`)
      setRestoreId(null)
      refreshAll()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const pick = (f: File | undefined) => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) return toast.error('Please choose a .csv file')
    setFile(f)
    setPreview(null)
    check.mutate(f)
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-4 lg:p-8">
      <PageHeader title="Data uploads" subtitle="Export the day's Google Sheet as CSV and drop it here. You'll see a check before anything changes." />

      <Card className="p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-medium text-ink-2">State</span>
          {states.length > 1 ? (
            <Segmented value={state} onChange={(v) => { setState(v); setFile(null); setPreview(null) }} options={states.map((s) => ({ value: s, label: NAMES[s] }))} />
          ) : (
            <Badge tone="accent">{NAMES[state]}</Badge>
          )}
        </div>

        <button
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }}
          className={cn('flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition', drag ? 'border-accent bg-accent-soft/50' : 'border-line hover:border-ink-3/50 hover:bg-raised')}
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
            {file ? <FileSpreadsheet className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
          </span>
          {file ? (
            <span>
              <span className="block text-[14px] font-medium">{file.name}</span>
              <span className="text-[12.5px] text-ink-3">{(file.size / 1024 / 1024).toFixed(2)} MB · click to choose another</span>
            </span>
          ) : (
            <span>
              <span className="block text-[14px] font-medium">Drop the {NAMES[state]} CSV here, or click to browse</span>
              <span className="text-[12.5px] text-ink-3">Max 25 MB. The file is checked first; nothing is replaced until you confirm.</span>
            </span>
          )}
        </button>
        <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />

        {check.isPending && <p className="mt-4 text-[13px] text-ink-3">Checking the file…</p>}

        {preview && (
          <div className="mt-5 animate-fade-in rounded-xl border hairline p-5">
            <div className="flex items-start gap-3">
              {preview.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-good" /> : <XCircle className="mt-0.5 h-5 w-5 text-bad" />}
              <div className="flex-1">
                <p className="text-[14px] font-semibold">{preview.ok ? 'Looks good. Ready to import.' : 'This file can’t be imported'}</p>
                {!preview.ok && preview.missing_required.length > 0 && (
                  <p className="mt-1 text-[13px] text-bad">
                    Missing columns: {preview.missing_required.join(', ')}. Is this the {NAMES[state]} sheet?
                  </p>
                )}
              </div>
            </div>
            {preview.ok && (
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ['Rows', num(preview.total_rows)],
                  ['Constituencies', num(preview.acs)],
                  ['Districts', num(preview.districts)],
                  ['Dates', preview.date_min && preview.date_max ? `${day(preview.date_min)} – ${day(preview.date_max)}` : '—'],
                  ...Object.entries(preview.statuses).slice(0, 3).map(([k, v]) => [k, num(v)]),
                  ['Duplicates flagged', num(preview.duplicates)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[12px] text-ink-3">{k}</dt>
                    <dd className="tabular text-[15px] font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {preview.warnings.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {preview.warnings.map((w) => (
                  <li key={w} className="flex gap-2 text-[13px] text-warn">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            )}
            {preview.unknown_columns.length > 0 && <p className="mt-3 text-[12px] text-ink-3">Ignored columns: {preview.unknown_columns.join(', ')}</p>}
            {preview.ok && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={() => commit.mutate()} disabled={commit.isPending}>
                  {commit.isPending ? 'Importing…' : `Replace ${NAMES[state]} data with ${num(preview.total_rows)} rows`}
                </Button>
                <span className="text-[12px] text-ink-3">The previous file is kept, so you can roll back from the history below.</span>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><History className="h-4 w-4 text-ink-3" /> Upload history</span>} subtitle="The latest 10 files per state are kept for rollback." />
        <div className="mt-3 overflow-x-auto">
          {history.data?.length ? (
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="text-left text-[12px] text-ink-3">
                <tr className="border-b hairline">
                  <th className="px-5 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 text-right font-medium">Rows</th>
                  <th className="px-3 py-2 font-medium">Dates</th>
                  <th className="px-3 py-2 font-medium">By</th>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {history.data.map((h, i) => {
                  const live = history.data!.findIndex((x) => x.state === h.state) === i
                  return (
                    <tr key={h.id} className="border-b hairline last:border-0">
                      <td className="max-w-[260px] truncate px-5 py-2.5 font-medium" title={h.filename}>
                        {h.filename} {h.restored_from && <Badge className="ml-1">restored</Badge>}
                      </td>
                      <td className="px-3 py-2.5">{NAMES[h.state]}</td>
                      <td className="tabular px-3 py-2.5 text-right">{num(h.rows_imported)}</td>
                      <td className="px-3 py-2.5 text-ink-2">{h.date_min && h.date_max ? `${day(h.date_min)} – ${day(h.date_max)}` : '—'}</td>
                      <td className="px-3 py-2.5 text-ink-2">{h.uploaded_by}</td>
                      <td className="px-3 py-2.5 text-ink-3" title={new Date(h.uploaded_at + 'Z').toLocaleString()}>{ago(h.uploaded_at + 'Z')}</td>
                      <td className="px-5 py-2.5 text-right">
                        {live ? (
                          <Badge tone="good">Live</Badge>
                        ) : h.can_restore ? (
                          <Button size="sm" variant="ghost" onClick={() => setRestoreId(h)}>
                            <RotateCcw className="h-3.5 w-3.5" /> Restore
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <Empty title="No uploads yet" />
          )}
        </div>
      </Card>

      <Dialog open={!!restoreId} onOpenChange={(o) => !o && setRestoreId(null)} title="Restore this upload?" description={restoreId ? `${NAMES[restoreId.state]} will go back to ${restoreId.filename} (${num(restoreId.rows_imported)} rows). You can undo this the same way.` : ''}>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setRestoreId(null)}>Cancel</Button>
          <Button variant="primary" disabled={restore.isPending} onClick={() => restoreId && restore.mutate(restoreId)}>
            {restore.isPending ? 'Restoring…' : 'Restore'}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
