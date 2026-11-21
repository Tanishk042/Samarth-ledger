import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  Fingerprint,
  Landmark,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import Brand from '../components/layout/Brand'
import { Button, Field, Input, InlineNote, SimBadge } from '../components/ui/primitives'
import { ROLES } from '../lib/constants'
import { useStore } from '../store/useStore'
import { useUi } from '../store/useUi'
import { cn } from '../lib/utils'

const ROLE_ICONS = { institution: Building2, officer: ShieldCheck, bank: Landmark }

const ROLE_DETAILS = {
  institution: {
    points: ['Submit an FDR with the real document pipeline', 'Track maturity and download renewal drafts', 'Request a double-lock release'],
    accent: 'bg-accent/10 text-accent',
  },
  officer: {
    points: ['Review flagged submissions with reasons', 'Hold the second release key', 'Pause releases, inspect fraud rings, export audit'],
    accent: 'bg-ink text-paper',
  },
  bank: {
    points: ['Publish a daily ECDSA locked-balance proof', 'Verify or reject a proof signature', 'See missed-proof alerts without customer data'],
    accent: 'bg-olive/10 text-olive',
  },
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useStore((s) => s.login)
  const role = useStore((s) => s.role)
  const user = useStore((s) => s.user)
  const openGuided = useUi((s) => s.openGuided)
  const [selected, setSelected] = useState(role || 'institution')
  const [email, setEmail] = useState(ROLES[role || 'institution'].email)
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState('')

  const meta = ROLES[selected]
  const details = ROLE_DETAILS[selected]
  const Icon = ROLE_ICONS[selected]

  useEffect(() => {
    setEmail(ROLES[selected].email)
    setError('')
  }, [selected])

  useEffect(() => {
    if (role && role !== selected) {
      setSelected(role)
      setEmail(ROLES[role].email)
    }
    // Only follow an external role change once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  const submit = (e) => {
    e.preventDefault()
    const result = login(selected, email, password)
    if (!result.ok) {
      setError(result.message)
      return
    }
    const from = location.state?.from
    const target = from && from.startsWith(`/app`) ? from : `/app/${selected === 'institution' ? 'institution' : selected}`
    navigate(target, { replace: true })
  }

  const oneClick = () => {
    const result = login(selected, meta.email, 'demo1234')
    if (result.ok) navigate(`/app/${selected === 'institution' ? 'institution' : selected}`, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-paper">
      <div className="paper-grain warm-glow min-h-dvh">
        <header className="container-x flex h-[76px] items-center justify-between">
          <Brand />
          <div className="flex items-center gap-2">
            <Link to="/explorer" className="btn-ghost btn-sm hidden sm:inline-flex">
              <Fingerprint size={14} /> Public explorer
            </Link>
            <Link to="/" className="btn-outline btn-sm">
              <ArrowLeft size={14} /> Home
            </Link>
          </div>
        </header>

        <main id="main" className="container-x pb-20 pt-6 sm:pt-10">
          <div className="grid gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="card relative overflow-hidden p-6 sm:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Demo login</p>
                  <h1 className="display mt-2 text-4xl sm:text-5xl">
                    Step into <em className="serif-accent">the demo.</em>
                  </h1>
                  <p className="mt-2 text-sm text-muted">Three roles. One click. Nothing to install.</p>
                </div>
                <SimBadge>Mocked auth</SimBadge>
              </div>

              {role && (
                <InlineNote tone="olive" icon={Check} className="mt-5">
                  You are already signed in as <strong>{user?.person}</strong> ({role}).{' '}
                  <Link to={`/app/${role === 'institution' ? 'institution' : role}`} className="font-bold underline">
                    Resume the workspace
                  </Link>{' '}
                  or choose another role below.
                </InlineNote>
              )}

              <div className="mt-6 grid gap-2.5">
                {Object.values(ROLES).map((r) => {
                  const RoleIcon = ROLE_ICONS[r.id]
                  const active = selected === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelected(r.id)}
                      className={cn(
                        'group flex items-start gap-3.5 rounded-2xl border p-4 text-left transition',
                        active ? 'border-ink bg-ink text-paper shadow-soft' : 'border-line bg-surface hover:border-ink/30',
                      )}
                    >
                      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', active ? 'bg-paper/15 text-paper' : 'bg-paper text-muted')}>
                        <RoleIcon size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold">{r.label}</span>
                          {active && <Check size={13} className="text-ember" />}
                        </span>
                        <span className={cn('mt-0.5 block text-[11px] leading-relaxed', active ? 'text-paper/60' : 'text-muted')}>{r.blurb}</span>
                        <span className={cn('mt-1 block text-[10px] font-semibold', active ? 'text-paper/45' : 'text-muted/70')}>
                          {r.person} · {r.org}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-muted">
                <span className="flex items-center gap-1.5"><Lock size={11} /> No password leaves this browser</span>
                <span className="h-3 w-px bg-line" />
                <span>Demo state is local-first</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="card flex flex-col p-6 sm:p-8"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn('grid h-12 w-12 place-items-center rounded-2xl', details.accent)}>
                  <Icon size={22} />
                </span>
                <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
                  {meta.org}
                </span>
              </div>

              <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">{meta.label} workspace</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Continue as <strong className="text-ink">{meta.person}</strong>. This is a mocked session for the prototype.
              </p>

              <ul className="mt-4 space-y-2">
                {details.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
                    <Check size={12} className="mt-0.5 shrink-0 text-olive" /> {p}
                  </li>
                ))}
              </ul>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <Field label="Demo email" required>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    placeholder="you@example.org"
                  />
                </Field>
                <Field label="Demo password" hint="Four characters or more. Any password is accepted locally.">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="demo1234"
                  />
                </Field>
                {error && <p className="rounded-xl border border-danger/25 bg-danger/[0.06] px-3 py-2 text-[11px] font-semibold text-danger">{error}</p>}

                <Button type="submit" className="w-full" size="lg">
                  Sign in as {meta.label} <ArrowRight size={15} />
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={oneClick}>
                  <Sparkles size={14} /> One-click demo login
                </Button>
              </form>

              <div className="mt-auto pt-6">
                <InlineNote tone="accent">
                  Credentials are illustrative. Every role starts with the same seeded 40-FDR scenario, so you can switch freely with
                  the <strong>Switch</strong> link in the app sidebar.
                </InlineNote>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
                  <button type="button" onClick={() => openGuided(0)} className="inline-flex items-center gap-1 font-bold uppercase tracking-[0.1em] text-accent hover:underline">
                    <Sparkles size={11} /> Start the guided demo
                  </button>
                  <Link to="/explorer" className="inline-flex items-center gap-1 hover:text-ink">
                    Verify without signing in <ArrowUpRight size={11} />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-[11px] leading-relaxed text-muted">
            Prototype for Smart India Hackathon. No production credentials, bank connections or personal data are used. All names,
            institutions and amounts are illustrative.
          </p>
        </main>
      </div>
    </div>
  )
}
