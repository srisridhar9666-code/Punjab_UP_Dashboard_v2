import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { useMe, useSessionExpiry } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui/Misc'
import Login from '@/pages/Login'

const Portfolio = lazy(() => import('@/pages/Portfolio'))
const ChangePassword = lazy(() => import('@/pages/ChangePassword'))
const StateLayout = lazy(() => import('@/pages/state/StateLayout'))
const Operations = lazy(() => import('@/pages/state/Operations'))
const Opinion = lazy(() => import('@/pages/state/Opinion'))
const Strategy = lazy(() => import('@/pages/state/Strategy'))
const Explorer = lazy(() => import('@/pages/state/Explorer'))
const Uploads = lazy(() => import('@/pages/Uploads'))
const Users = lazy(() => import('@/pages/Users'))
const Audit = lazy(() => import('@/pages/Audit'))

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="p-8"><Skeleton className="h-[480px] rounded-xl" /></div>}>{children}</Suspense>
}

function Guard({ children, admin, upload }: { children: ReactNode; admin?: boolean; upload?: boolean }) {
  const { data: me } = useMe()
  if (!me) return <Navigate to="/login" replace />
  if (admin && me.role !== 'admin') return <Navigate to="/" replace />
  if (upload && !me.upload_states.length) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  useSessionExpiry()
  const { data: me, isLoading } = useMe()
  const loc = useLocation()

  if (isLoading) return <div className="grid h-dvh place-items-center"><Skeleton className="h-10 w-40" /></div>
  if (!me) return loc.pathname === '/login' ? <Login /> : <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  if (me.must_change_password && loc.pathname !== '/account/password') return <Navigate to="/account/password" replace />
  if (loc.pathname === '/login') return <Navigate to={(loc.state as { from?: string } | null)?.from ?? '/'} replace />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Page><Portfolio /></Page>} />
        <Route path="account/password" element={<Page><ChangePassword /></Page>} />
        <Route path="s/:state" element={<Page><StateLayout /></Page>}>
          <Route index element={<Page><Operations /></Page>} />
          <Route path="opinion" element={<Page><Opinion /></Page>} />
          <Route path="strategy" element={<Page><Strategy /></Page>} />
          <Route path="explorer" element={<Page><Explorer /></Page>} />
        </Route>
        <Route path="uploads" element={<Guard upload><Page><Uploads /></Page></Guard>} />
        <Route path="admin/users" element={<Guard admin><Page><Users /></Page></Guard>} />
        <Route path="admin/audit" element={<Guard admin><Page><Audit /></Page></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
