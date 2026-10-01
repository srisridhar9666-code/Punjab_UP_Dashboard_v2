import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import * as DM from '@radix-ui/react-dropdown-menu'
import { ChevronsLeft, ChevronsRight, FileClock, LayoutGrid, LogOut, Menu, Monitor, Moon, Search, ShieldCheck, Sun, Upload, Users, X } from 'lucide-react'
import { useLogout, useMe } from '@/hooks/useAuth'
import { setThemePref, useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/cn'
import { COMPANY, CREATOR, CompanyLogo } from '@/components/Brand'
import { Kbd } from '@/components/ui/Misc'
import { CommandPalette } from './CommandPalette'

const STATE_NAMES: Record<string, string> = { punjab: 'Punjab', up: 'Uttar Pradesh' }

function NavItem({ to, icon: Icon, label, collapsed, end }: { to: string; icon: typeof LayoutGrid; label: string; collapsed: boolean; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
          isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:bg-sunken hover:text-ink',
          collapsed && 'justify-center px-0',
        )
      }
    >
      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

function StateDot({ k }: { k: string }) {
  return <span className={cn('grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] text-[9px] font-bold text-white', k === 'punjab' ? 'bg-[#eb6834]' : 'bg-[#4a3aa7]')}>{k === 'punjab' ? 'PB' : 'UP'}</span>
}

export function AppShell() {
  const { data: me } = useMe()
  const logout = useLogout()
  const nav = useNavigate()
  const loc = useLocation()
  const [pref] = useTheme()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('nav') === 'collapsed'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => setMobileOpen(false), [loc.pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem('nav', c ? 'open' : 'collapsed') } catch { /* ignore */ }
      return !c
    })
  }

  if (!me) return null
  const isAdmin = me.role === 'admin'

  const sidebar = (isCollapsed: boolean) => (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className={cn('mb-3 flex h-12 items-center gap-3 px-1.5', isCollapsed && 'justify-center px-0')}>
        <CompanyLogo className="h-11" />
        {!isCollapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em]">Call Center Intelligence</p>
            <p className="text-[11px] leading-snug text-ink-3">{COMPANY}</p>
          </div>
        )}
      </div>

      <NavItem to="/" end icon={LayoutGrid} label="Overview" collapsed={isCollapsed} />
      {!isCollapsed && <p className="label mt-4 px-2.5 pb-1">States</p>}
      {isCollapsed && <div className="my-2 border-t hairline" />}
      {me.states.map((s) => (
        <NavLink
          key={s}
          to={`/s/${s}`}
          title={isCollapsed ? STATE_NAMES[s] : undefined}
          className={({ isActive }) =>
            cn('flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors', isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:bg-sunken hover:text-ink', isCollapsed && 'justify-center px-0')
          }
        >
          <StateDot k={s} />
          {!isCollapsed && STATE_NAMES[s]}
        </NavLink>
      ))}

      {(me.upload_states.length > 0 || isAdmin) && (!isCollapsed ? <p className="label mt-4 px-2.5 pb-1">Manage</p> : <div className="my-2 border-t hairline" />)}
      {me.upload_states.length > 0 && <NavItem to="/uploads" icon={Upload} label="Data uploads" collapsed={isCollapsed} />}
      {isAdmin && <NavItem to="/admin/users" icon={Users} label="Users & roles" collapsed={isCollapsed} />}
      {isAdmin && <NavItem to="/admin/audit" icon={FileClock} label="Audit log" collapsed={isCollapsed} />}

      <div className="mt-auto space-y-1">
        {!isCollapsed && (
          <div className="mb-1 rounded-lg border hairline bg-surface px-3 py-2.5 text-[11px] leading-snug text-ink-3">
            <p>
              Created by <span className="font-semibold text-accent">{CREATOR}</span>
            </p>
            <p className="truncate">© {COMPANY}</p>
          </div>
        )}
        <button onClick={toggle} className={cn('hidden h-9 w-full items-center gap-3 rounded-lg px-2.5 text-[13px] text-ink-3 hover:bg-sunken hover:text-ink lg:flex', isCollapsed && 'justify-center px-0')}>
          {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!isCollapsed && 'Collapse'}
        </button>
      </div>
    </div>
  )

  const ThemeIcon = pref === 'dark' ? Moon : pref === 'light' ? Sun : Monitor

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className={cn('hidden shrink-0 border-r hairline bg-page transition-[width] duration-200 lg:block', collapsed ? 'w-[64px]' : 'w-[248px]')}>{sidebar(collapsed)}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[264px] bg-page shadow-pop animate-fade-in">
            <button className="absolute right-3 top-4 rounded-md p-1.5 text-ink-3 hover:bg-sunken" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
            {sidebar(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b hairline bg-page/80 px-4 backdrop-blur lg:px-6">
          <button className="-ml-1 rounded-md p-1.5 text-ink-2 hover:bg-sunken lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 min-w-0 max-w-[360px] flex-1 items-center gap-2 rounded-lg bg-surface px-3 text-[13px] text-ink-3 shadow-card hover:text-ink-2"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="truncate"><span className="sm:hidden">Search…</span><span className="hidden sm:inline">Jump to a constituency, district or page…</span></span>
            <span className="ml-auto hidden items-center gap-0.5 sm:flex">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <DM.Root>
              <DM.Trigger className="rounded-lg p-2 text-ink-2 hover:bg-sunken hover:text-ink" aria-label="Theme">
                <ThemeIcon className="h-[17px] w-[17px]" />
              </DM.Trigger>
              <DM.Portal>
                <DM.Content align="end" sideOffset={6} className="z-50 min-w-[150px] rounded-xl bg-surface p-1 shadow-pop animate-fade-in">
                  {([['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'System']] as const).map(([v, I, l]) => (
                    <DM.Item key={v} onSelect={() => setThemePref(v)} className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] outline-none data-[highlighted]:bg-sunken', pref === v && 'font-semibold')}>
                      <I className="h-4 w-4 text-ink-3" /> {l}
                    </DM.Item>
                  ))}
                </DM.Content>
              </DM.Portal>
            </DM.Root>
            <DM.Root>
              <DM.Trigger className="ml-1 flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-sunken" aria-label="Account">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-ink">{(me.full_name || me.username)[0]?.toUpperCase()}</span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-[12.5px] font-medium">{me.full_name || me.username}</span>
                  <span className="block text-[11px] capitalize text-ink-3">{me.role}</span>
                </span>
              </DM.Trigger>
              <DM.Portal>
                <DM.Content align="end" sideOffset={6} className="z-50 min-w-[200px] rounded-xl bg-surface p-1 shadow-pop animate-fade-in">
                  <DM.Item onSelect={() => nav('/account/password')} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] outline-none data-[highlighted]:bg-sunken">
                    <ShieldCheck className="h-4 w-4 text-ink-3" /> Change password
                  </DM.Item>
                  <DM.Separator className="my-1 h-px bg-line" />
                  <DM.Item onSelect={() => logout().then(() => nav('/login'))} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-bad outline-none data-[highlighted]:bg-sunken">
                    <LogOut className="h-4 w-4" /> Sign out
                  </DM.Item>
                </DM.Content>
              </DM.Portal>
            </DM.Root>
          </div>
        </header>
        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
