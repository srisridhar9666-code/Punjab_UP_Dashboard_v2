import { Command } from 'cmdk'
import * as D from '@radix-ui/react-dialog'
import { useQueries } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { BarChart3, Compass, FileClock, LayoutGrid, MapPin, Search, Sparkles, Target, Upload, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { useMe } from '@/hooks/useAuth'
import type { Meta } from '@/lib/types'

const item = 'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-ink-2 data-[selected=true]:bg-sunken data-[selected=true]:text-ink'
const group = '[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3'

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate()
  const { data: me } = useMe()
  const states = me?.states ?? []
  const metas = useQueries({
    queries: states.map((s) => ({ queryKey: ['meta', s], queryFn: () => api<Meta>(`/states/${s}/meta`), enabled: open, staleTime: 300_000 })),
  })
  const go = (to: string) => {
    onOpenChange(false)
    nav(to)
  }

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <D.Content className="fixed left-1/2 top-[10vh] z-50 w-[calc(100vw-32px)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-2xl bg-surface shadow-pop animate-fade-in">
          <D.Title className="sr-only">Search</D.Title>
          <Command label="Search" loop>
            <div className="flex items-center gap-2 border-b hairline px-4">
              <Search className="h-4 w-4 text-ink-3" />
              <Command.Input autoFocus placeholder="Search constituencies, districts and pages…" className="h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-ink-3" />
            </div>
            <Command.List className="scroll-thin max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-[13px] text-ink-3">No matches.</Command.Empty>
              <Command.Group heading="Pages" className={group}>
                <Command.Item className={item} onSelect={() => go('/')}>
                  <LayoutGrid className="h-4 w-4" /> Overview
                </Command.Item>
                {metas.map((m, i) =>
                  m.data ? (
                    [
                      ['', 'Operations', Compass],
                      ['/opinion', 'Opinion', BarChart3],
                      ['/strategy', 'Strategy', Target],
                      ['/explorer', 'Crosstab explorer', Sparkles],
                    ].map(([path, label, Icon]) => {
                      const I = Icon as typeof Compass
                      return (
                        <Command.Item key={`${states[i]}${path}`} className={item} onSelect={() => go(`/s/${states[i]}${path}`)}>
                          <I className="h-4 w-4" /> {m.data!.name} · {label as string}
                        </Command.Item>
                      )
                    })
                  ) : null,
                )}
                {(me?.upload_states.length ?? 0) > 0 && (
                  <Command.Item className={item} onSelect={() => go('/uploads')}>
                    <Upload className="h-4 w-4" /> Data uploads
                  </Command.Item>
                )}
                {me?.role === 'admin' && (
                  <>
                    <Command.Item className={item} onSelect={() => go('/admin/users')}>
                      <Users className="h-4 w-4" /> Users & roles
                    </Command.Item>
                    <Command.Item className={item} onSelect={() => go('/admin/audit')}>
                      <FileClock className="h-4 w-4" /> Audit log
                    </Command.Item>
                  </>
                )}
              </Command.Group>
              {metas.map((m, i) =>
                m.data ? (
                  <Command.Group key={states[i]} heading={`${m.data.name} constituencies & districts`} className={group}>
                    {m.data.districts.map((d) => (
                      <Command.Item key={`d-${d}`} value={`${m.data!.name} district ${d}`} className={item} onSelect={() => go(`/s/${states[i]}?district=${encodeURIComponent(d)}`)}>
                        <MapPin className="h-4 w-4" /> {d} <span className="ml-auto text-[11.5px] text-ink-3">District</span>
                      </Command.Item>
                    ))}
                    {m.data.acs.map((a) => (
                      <Command.Item
                        key={`a-${a.ac}`}
                        value={`${m.data!.name} ${a.ac} ${a.district ?? ''}`}
                        className={item}
                        onSelect={() => go(`/s/${states[i]}?district=${encodeURIComponent(a.district ?? '')}&ac=${encodeURIComponent(a.ac)}`)}
                      >
                        <Target className="h-4 w-4" /> {a.ac} <span className="ml-auto text-[11.5px] text-ink-3">{a.district}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null,
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
