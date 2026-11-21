import { Component, lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'
import AppShell from './components/layout/AppShell'
import ToastViewport from './components/ui/Toast'
import DemoToolbar from './components/demo/DemoToolbar'
import EventStreamPanel from './components/demo/EventStreamPanel'
import OfflinePanel from './components/demo/OfflinePanel'
import GuidedDemo from './components/demo/GuidedDemo'
import { Button } from './components/ui/primitives'
import { useStore } from './store/useStore'

const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const Explorer = lazy(() => import('./pages/Explorer'))
const NotFound = lazy(() => import('./pages/NotFound'))
const InstitutionDashboard = lazy(() => import('./pages/institution/Dashboard'))
const NewFdr = lazy(() => import('./pages/institution/NewFdr'))
const FdrDetail = lazy(() => import('./pages/institution/FdrDetail'))
const Notifications = lazy(() => import('./pages/institution/Notifications'))
const OfficerDashboard = lazy(() => import('./pages/officer/Dashboard'))
const OfficerReview = lazy(() => import('./pages/officer/Review'))
const Releases = lazy(() => import('./pages/officer/Releases'))
const AuditLog = lazy(() => import('./pages/officer/Audit'))
const SettingsPage = lazy(() => import('./pages/officer/Settings'))
const BankPortal = lazy(() => import('./pages/bank/BankPortal'))

export const HOME = {
  institution: '/app/institution',
  officer: '/app/officer',
  bank: '/app/bank',
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep the console useful for judges and developers.
    console.error('Samarth Ledger crashed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center bg-paper px-5">
        <div className="card w-full max-w-lg p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger">
            <ShieldAlert size={22} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">This view hit an unexpected error</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your demo data is still on this device. Reload the page, or reset the seeded scenario if the problem repeats.
          </p>
          <pre className="mt-4 max-h-28 overflow-auto rounded-2xl bg-paper p-3 text-left font-mono text-[10px] text-muted">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button
              variant="outline"
              onClick={() => {
                localStorage.removeItem('samarth-ledger-v1')
                window.location.href = '/'
              }}
            >
              Reset local demo
            </Button>
          </div>
        </div>
      </div>
    )
  }
}

function RequireRole({ roles, children }) {
  const role = useStore((s) => s.role)
  const location = useLocation()
  if (!role) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(role)) return <Navigate to={HOME[role] || '/'} replace />
  return children
}

function RoleHome() {
  const role = useStore((s) => s.role)
  return <Navigate to={role ? HOME[role] : '/login'} replace />
}

function ScrollManager() {
  const location = useLocation()
  useEffect(() => {
    if (location.hash) {
      const timer = setTimeout(() => {
        document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
      return () => clearTimeout(timer)
    }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' })
    return undefined
  }, [location.pathname, location.hash])
  return null
}

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted">
        <Loader2 size={17} className="animate-spin text-accent" />
        Loading workspace…
      </div>
    </div>
  )
}

export default function App() {
  const theme = useStore((s) => s.theme)
  const booted = useStore((s) => s.booted)
  const bootstrap = useStore((s) => s.bootstrap)
  const location = useLocation()
  const inApp = location.pathname.startsWith('/app')
  const showToolbar = inApp || location.pathname === '/explorer'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#111110' : '#F6F3F1')
  }, [theme])

  useEffect(() => {
    if (!booted) void bootstrap()
  }, [booted, bootstrap])

  useEffect(() => {
    const titles = {
      '/': 'Samarth Ledger — Security Deposit & FDR Management',
      '/login': 'Demo login · Samarth Ledger',
      '/explorer': 'Public ledger explorer · Samarth Ledger',
    }
    document.title = titles[location.pathname] || 'Samarth Ledger'
  }, [location.pathname])

  return (
    <ErrorBoundary>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-paper"
      >
        Skip to content
      </a>
      <ScrollManager />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/explorer" element={<Explorer />} />
          <Route
            path="/app"
            element={
              <RequireRole>
                <AppShell />
              </RequireRole>
            }
          >
            <Route index element={<RoleHome />} />
            <Route
              path="institution"
              element={
                <RequireRole roles={['institution']}>
                  <InstitutionDashboard />
                </RequireRole>
              }
            />
            <Route
              path="institution/new"
              element={
                <RequireRole roles={['institution']}>
                  <NewFdr />
                </RequireRole>
              }
            />
            <Route
              path="institution/fdr/:id"
              element={
                <RequireRole roles={['institution']}>
                  <FdrDetail />
                </RequireRole>
              }
            />
            <Route
              path="institution/notifications"
              element={
                <RequireRole roles={['institution']}>
                  <Notifications />
                </RequireRole>
              }
            />
            <Route
              path="officer"
              element={
                <RequireRole roles={['officer']}>
                  <OfficerDashboard />
                </RequireRole>
              }
            />
            <Route
              path="officer/review/:id"
              element={
                <RequireRole roles={['officer']}>
                  <OfficerReview />
                </RequireRole>
              }
            />
            <Route
              path="officer/releases"
              element={
                <RequireRole roles={['officer']}>
                  <Releases />
                </RequireRole>
              }
            />
            <Route
              path="officer/audit"
              element={
                <RequireRole roles={['officer']}>
                  <AuditLog />
                </RequireRole>
              }
            />
            <Route
              path="officer/settings"
              element={
                <RequireRole roles={['officer']}>
                  <SettingsPage />
                </RequireRole>
              }
            />
            <Route
              path="bank"
              element={
                <RequireRole roles={['bank']}>
                  <BankPortal />
                </RequireRole>
              }
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      {showToolbar && <DemoToolbar />}
      <GuidedDemo />
      <EventStreamPanel />
      <OfflinePanel />
      <ToastViewport />
    </ErrorBoundary>
  )
}
