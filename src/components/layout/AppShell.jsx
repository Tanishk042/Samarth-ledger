import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  FilePlus2,
  Fingerprint,
  Inbox,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Globe,
  X,
  LockKeyhole,
} from 'lucide-react'
import Brand from './Brand'
import { useStore } from '../../store/useStore'
import { useUi } from '../../store/useUi'
import { useT } from '../../lib/i18n'
import { cn, formatDate, formatDateTime, initials } from '../../lib/utils'
import { SimBadge } from '../ui/primitives'

const NAV = {
  institution: [
    { to: '/app/institution', label: 'My deposits', icon: LayoutDashboard, end: true },
    { to: '/app/institution/new', label: 'Add new FDR', icon: FilePlus2 },
    { to: '/app/institution/notifications', label: 'Notifications', icon: Inbox },
  ],
  officer: [
    { to: '/app/officer', label: 'Overview', icon: BarChart3, end: true },
    { to: '/app/officer/releases', label: 'Release approvals', icon: LockKeyhole },
    { to: '/app/officer/audit', label: 'Audit log', icon: ClipboardList },
    { to: '/app/officer/settings', label: 'Settings', icon: Settings },
  ],
  bank: [{ to: '/app/bank', label: 'Bank desk', icon: Landmark }],
}

const SECONDARY = [{ to: '/explorer', label: 'Public explorer', icon: Fingerprint }]

const TITLES = {
  '/app/institution': 'My deposits',
  '/app/institution/new': 'Add a new FDR',
  '/app/institution/notifications': 'Notifications',
  '/app/officer': 'Officer overview',
  '/app/officer/releases': 'Double-lock releases',
  '/app/officer/audit': 'Audit log',
  '/app/officer/settings': 'Policy settings',
  '/app/bank': 'Bank proof desk',
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const role = useStore((s) => s.role)
  const notifications = useStore((s) => s.notifications)
  const markAll = useStore((s) => s.markAllNotificationsRead)
  const markRead = useStore((s) => s.markNotificationRead)
  const navigate = useNavigate()
  const audience = role === 'officer' ? 'officer' : 'institution'
  const items = notifications.filter((n) => n.audience === audience || (!n.audience && audience === 'institution'))
  const unread = items.filter((n) => !n.read).length

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2.5 text-muted transition hover:bg-ink/[0.05] hover:text-ink"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-12 z-50 w-[340px] overflow-hidden rounded-2xl border border-line bg-surface shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Inbox</p>
              <button type="button" onClick={markAll} className="text-[11px] font-semibold text-accent hover:underline">
                Mark all read
              </button>
            </div>
            <div className="max-h-[340px] overflow-y-auto">
              {items.slice(0, 6).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    markRead(n.id)
                    setOpen(false)
                    if (n.fdrId && role === 'officer') navigate(`/app/officer/review/${n.fdrId}`)
                    else if (n.fdrId && role === 'institution') navigate(`/app/institution/fdr/${n.fdrId}`)
                  }}
                  className={cn(
                    'block w-full border-b border-line/60 px-4 py-3 text-left transition hover:bg-paper/60',
                    !n.read && 'bg-accent/[0.035]',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                    <div className={cn(!n.read ? '' : 'pl-3.5')}>
                      <p className="text-[12px] font-semibold leading-snug">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted">{n.body}</p>
                      <p className="mt-1 font-mono text-[9px] text-muted/70">{formatDateTime(n.at)}</p>
                    </div>
                  </div>
                </button>
              ))}
              {!items.length && <p className="px-4 py-8 text-center text-xs text-muted">No notifications yet.</p>}
            </div>
            <Link
              to={role === 'officer' ? '/app/officer' : '/app/institution/notifications'}
              onClick={() => setOpen(false)}
              className="block bg-paper/60 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-ink hover:bg-paper"
            >
              Open notification centre
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SidebarContent({ onNavigate }) {
  const role = useStore((s) => s.role)
  const user = useStore((s) => s.user)
  const logout = useStore((s) => s.logout)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const settings = useStore((s) => s.settings)
  const t = useT()
  const navigate = useNavigate()

  const links = NAV[role] || []
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[72px] items-center justify-between px-5">
        <Brand compact />
        <span className="rounded-full border border-line bg-surface px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
          {role}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="mb-2 mt-4 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted/70">{role} workspace</p>
        <nav className="space-y-1" aria-label="Workspace navigation">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) => cn(isActive ? 'side-link-active' : 'side-link')}
            >
              <item.icon size={16} />
              <span className="flex-1">{item.label}</span>
              {item.to === '/app/institution/notifications' && <UnreadDot />}
            </NavLink>
          ))}
        </nav>

        <p className="mb-2 mt-6 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted/70">Public</p>
        <nav className="space-y-1" aria-label="Public pages">
          {SECONDARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) => cn(isActive ? 'side-link-active' : 'side-link')}
            >
              <item.icon size={16} />
              <span className="flex-1">{t('nav.explorer', item.label)}</span>
              <ArrowLeftRight size={12} className="opacity-50" />
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Ledger mode</p>
            <Activity size={13} className="text-olive" />
          </div>
          <p className="mt-2 text-[12px] font-semibold">
            {import.meta.env.VITE_CONTRACT_ADDRESS ? 'Polygon Amoy testnet' : 'Simulated hash-chain'}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            {import.meta.env.VITE_CONTRACT_ADDRESS ? (
              <span className="chip border-olive/25 bg-olive/10 text-olive">On-chain</span>
            ) : (
              <SimBadge>In-app chain</SimBadge>
            )}
          </div>
          {settings.autoPause && (
            <p className="mt-2 rounded-lg bg-danger/10 px-2 py-1 text-[10px] font-semibold text-danger">Emergency pause active</p>
          )}
        </div>
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full p-2 text-muted hover:bg-ink/[0.05] hover:text-ink"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="flex items-center gap-1 rounded-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted hover:bg-ink/[0.05] hover:text-ink"
            aria-label="Toggle language"
          >
            <Globe size={13} /> {lang === 'en' ? 'हिं' : 'EN'}
          </button>
          <Link
            to="/login"
            className="ml-auto flex items-center gap-1 rounded-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted hover:bg-ink/[0.05] hover:text-ink"
            onClick={onNavigate}
          >
            Switch
          </Link>
        </div>
        <div className="mt-2 flex items-center gap-2.5 rounded-2xl bg-surface p-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-paper">
            {initials(user?.person || role)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold">{user?.person}</p>
            <p className="truncate text-[10px] text-muted">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/')
            }}
            className="rounded-full p-1.5 text-muted hover:bg-ink/[0.06] hover:text-ink"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

function UnreadDot() {
  const notifications = useStore((s) => s.notifications)
  const unread = notifications.filter((n) => !n.read && n.audience === 'institution').length
  if (!unread) return null
  return <span className="h-1.5 w-1.5 rounded-full bg-accent" />
}

export default function AppShell() {
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  const role = useStore((s) => s.role)
  const user = useStore((s) => s.user)
  const clockOffsetDays = useStore((s) => s.clockOffsetDays)
  const offline = useStore((s) => s.offline)
  const openEvents = useUi((s) => s.toggleEvents)
  const title = useMemo(() => {
    if (location.pathname.includes('/fdr/')) return 'FDR detail'
    if (location.pathname.includes('/review/')) return 'Officer review'
    return TITLES[location.pathname] || 'Workspace'
  }, [location.pathname])

  useEffect(() => {
    setDrawer(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  const effectiveDate = formatDate(new Date(Date.now() + clockOffsetDays * 86400000))
  const RoleIcon = role === 'officer' ? ShieldCheck : role === 'bank' ? Landmark : Building2

  return (
    <div className="min-h-dvh bg-paper">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] border-r border-line bg-paper lg:block" aria-label="Sidebar">
        <SidebarContent />
      </aside>

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-xl">
          <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="rounded-full p-2 text-ink lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[13px] font-bold tracking-[-0.02em] sm:text-sm">{title}</p>
                {offline && (
                  <span className="hidden items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-300 sm:inline-flex">
                    Offline demo
                  </span>
                )}
              </div>
              <p className="hidden text-[10px] text-muted sm:block">
                {user?.org} · scenario date <span className="font-mono">{effectiveDate}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={openEvents}
              className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted transition hover:text-ink md:flex"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-olive opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-olive" />
              </span>
              Event bus
            </button>

            <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1.5 text-[10px] font-semibold text-muted xl:flex">
              {RoleIcon && <RoleIcon size={12} />}
              {role}
            </span>
            <NotificationBell />
            <Link
              to={role === 'officer' ? '/app/officer/settings' : '/app/institution'}
              className="hidden h-8 w-8 place-items-center rounded-full bg-ink text-[10px] font-bold text-paper sm:grid"
              aria-label="Account"
            >
              {initials(user?.person || 'User')}
            </Link>
          </div>
        </header>

        <main id="main" className="px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mx-auto w-full max-w-[1240px]">
            <Outlet />
          </div>
        </main>
      </div>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-[61] w-[292px] border-r border-line bg-paper lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              aria-label="Mobile navigation"
            >
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="absolute right-3 top-5 z-10 rounded-full p-2 text-muted hover:bg-ink/[0.06] hover:text-ink"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
              <SidebarContent onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
