import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Download,
  FilePlus2,
  FileText,
  Filter,
  Inbox,
  Landmark,
  LockKeyhole,
  Search,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  Input,
  Progress,
  SimBadge,
  Stat,
  StatusPill,
  Tabs,
} from '../../components/ui/primitives'
import { useStore } from '../../store/useStore'
import { toast } from '../../store/useToast'
import { BANKS, COLLEGES } from '../../data/seed'
import { useT } from '../../lib/i18n'
import { downloadDataUri } from '../../lib/pdf'
import { downloadText, daysBetween, formatDate, formatINR, matchesQuery, pct, toCSV } from '../../lib/utils'

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'verified', label: 'Verified' },
  { value: 'renewal_due', label: 'Renewal due' },
  { value: 'under_review', label: 'Under review' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'released', label: 'Released' },
]

export default function InstitutionDashboard() {
  const t = useT()
  const navigate = useNavigate()
  const user = useStore((s) => s.user)
  const fdrs = useStore((s) => s.fdrs)
  const notifications = useStore((s) => s.notifications)
  const releaseRequests = useStore((s) => s.releaseRequests)
  const clockOffsetDays = useStore((s) => s.clockOffsetDays)
  const requestRelease = useStore((s) => s.requestRelease)
  const runReminders = useStore((s) => s.runReminders)
  const [scope, setScope] = useState('all')
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')

  const mine = user?.orgId || 'COL-RVCE'
  const scoped = useMemo(() => (scope === 'mine' ? fdrs.filter((f) => f.collegeId === mine) : fdrs), [fdrs, scope, mine])

  const list = useMemo(() => {
    return scoped
      .filter((f) => (tab === 'all' ? true : f.status === tab))
      .filter((f) => {
        const bank = BANKS.find((b) => b.id === f.bankId)
        const college = COLLEGES.find((c) => c.id === f.collegeId)
        return matchesQuery(
          `${f.id} ${f.fdNumber} ${f.status} ${bank?.name || ''} ${bank?.short || ''} ${college?.code || ''}`,
          query,
        )
      })
      .sort((a, b) => String(a.maturityDate).localeCompare(String(b.maturityDate)))
  }, [scoped, tab, query])

  const stats = useMemo(() => {
    const active = scoped.filter((f) => ['verified', 'renewal_due'].includes(f.status))
    const due = scoped.filter((f) => f.status === 'renewal_due')
    const review = scoped.filter((f) => f.status === 'under_review')
    const released = scoped.filter((f) => f.status === 'released')
    const total = scoped.filter((f) => f.status !== 'released').reduce((acc, f) => acc + f.amount, 0)
    const trust = scoped.length ? Math.round(scoped.reduce((acc, f) => acc + (f.trustScore || 0), 0) / scoped.length) : 0
    const next = [...active]
      .filter((f) => daysBetween(new Date(Date.now() + clockOffsetDays * 86400000), f.maturityDate) >= 0)
      .sort((a, b) => String(a.maturityDate).localeCompare(String(b.maturityDate)))[0]
    return { active, due, review, released, total, trust, next }
  }, [scoped, clockOffsetDays])

  const chartData = useMemo(
    () => [
      { name: 'Verified', value: scoped.filter((f) => f.status === 'verified').length, fill: 'rgb(var(--olive))' },
      { name: 'Due', value: scoped.filter((f) => f.status === 'renewal_due').length, fill: 'rgb(217 119 6)' },
      { name: 'Review', value: scoped.filter((f) => f.status === 'under_review').length, fill: 'rgb(var(--accent))' },
      { name: 'Rejected', value: scoped.filter((f) => f.status === 'rejected').length, fill: 'rgb(var(--danger))' },
      { name: 'Released', value: scoped.filter((f) => f.status === 'released').length, fill: 'rgb(var(--ink))' },
    ],
    [scoped],
  )

  const recentNotifications = notifications.filter((n) => n.audience === 'institution').slice(0, 3)
  const unread = notifications.filter((n) => n.audience === 'institution' && !n.read).length

  const request = (fdr) => {
    const existing = releaseRequests.find((r) => r.fdrId === fdr.id && r.status === 'pending')
    if (existing) {
      toast(`Release ${existing.id} is already in the officer queue.`, { tone: 'warning' })
      return
    }
    requestRelease(fdr.id, `Release requested from the institution dashboard for ${fdr.id}.`)
  }

  const prepareRenewal = async (fdr) => {
    await runReminders()
    const updated = useStore.getState().fdrs.find((f) => f.id === fdr.id)
    if (updated?.renewalDoc) {
      downloadDataUri(updated.renewalDoc, updated.renewalDocName || `Renewal_Draft_${fdr.id}.pdf`)
      toast('Renewal draft downloaded. It still needs institution confirmation and bank action.', { tone: 'success' })
      return
    }
    const days = daysBetween(new Date(Date.now() + clockOffsetDays * 86400000), fdr.maturityDate)
    toast(
      days > 60
        ? `No draft yet — the renewal window opens 60 days before maturity (${days} days remain).`
        : 'No draft generated. Advance the scenario clock closer to maturity and try again.',
      { tone: 'warning' },
    )
  }

  const exportCsv = () => {
    const csv = toCSV(list, [
      { label: 'FDR ID', value: (f) => f.id },
      { label: 'FDR number', value: (f) => f.fdNumber },
      { label: 'Institution', value: (f) => COLLEGES.find((c) => c.id === f.collegeId)?.code || f.collegeId },
      { label: 'Bank', value: (f) => BANKS.find((b) => b.id === f.bankId)?.name || f.bankId },
      { label: 'Amount INR', value: (f) => f.amount },
      { label: 'Status', value: (f) => f.status },
      { label: 'Trust', value: (f) => f.trustScore },
      { label: 'Maturity', value: (f) => f.maturityDate },
    ])
    downloadText(csv, `samarth-deposits-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
    toast('Deposit list exported as CSV.', { tone: 'success' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Institution workspace</Eyebrow>
            <SimBadge>Seeded demo</SimBadge>
          </div>
          <h1 className="display mt-2 text-3xl sm:text-[40px]">{t('dash.title', 'My deposits')}</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            {user?.org} · {scope === 'mine' ? 'your institution scope' : 'demo consortium view'} · scenario date{' '}
            <span className="font-mono">{formatDate(new Date(Date.now() + clockOffsetDays * 86400000))}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </Button>
          <Button onClick={() => navigate('/app/institution/new')}>
            <FilePlus2 size={15} /> {t('dash.new', 'Add new FDR')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">View</span>
          <Tabs
            items={[
              { value: 'all', label: 'Demo consortium', count: fdrs.length },
              { value: 'mine', label: 'My institution', count: fdrs.filter((f) => f.collegeId === mine).length },
            ]}
            value={scope}
            onChange={setScope}
          />
        </div>
        <p className="text-[10px] leading-relaxed text-muted sm:max-w-md sm:text-right">
          The seeded consortium is visible so every demo path can be explored. New submissions belong to {user?.org || 'your institution'}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Deposits under management" value={formatINR(stats.total, { compact: true })} sub={`${scoped.length} records in view`} icon={Wallet} />
        <Stat label="Active / due" value={`${stats.active.length} / ${stats.due.length}`} sub="verified or renewal window" icon={CalendarClock} tone="accent" />
        <Stat label="Awaiting officer" value={stats.review.length} sub="medium-confidence queue" icon={Inbox} tone="accent" />
        <Stat label="Average trust" value={`${stats.trust}/100`} sub="three-expert weighted signal" icon={TrendingUp} tone="olive" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Portfolio shape</p>
              <p className="mt-1 text-sm font-semibold">Records by lifecycle state</p>
            </div>
            <BarChart3 size={17} className="text-muted" />
          </div>
          <div className="mt-4 h-[185px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgb(var(--line) / 0.25)' }} />
                <Bar dataKey="value" radius={[8, 8, 3, 3]} maxBarSize={44}>
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold text-muted">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-olive" /> {pct(stats.active.length, scoped.length)}% active</span>
            <span className="flex items-center gap-1.5"><LockKeyhole size={11} className="text-accent" /> {stats.released.length} released</span>
            <span className="flex items-center gap-1.5"><CircleAlert size={11} className="text-danger" /> {scoped.filter((f) => f.status === 'rejected').length} rejected</span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Next maturity</p>
              <p className="mt-1 text-sm font-semibold">Runway and reminders</p>
            </div>
            <CalendarClock size={17} className="text-accent" />
          </div>
          {stats.next ? (
            <div className="mt-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] text-muted">{stats.next.id}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{formatINR(stats.next.amount, { compact: true })}</p>
                </div>
                <Badge tone="amber">
                  {daysBetween(new Date(Date.now() + clockOffsetDays * 86400000), stats.next.maturityDate)} days
                </Badge>
              </div>
              <p className="mt-2 text-[11px] text-muted">
                {stats.next.fdNumber} · {BANKS.find((b) => b.id === stats.next.bankId)?.name} · matures {formatDate(stats.next.maturityDate)}
              </p>
              <Progress
                className="mt-4"
                value={Math.max(4, Math.min(100, 100 - daysBetween(new Date(Date.now() + clockOffsetDays * 86400000), stats.next.maturityDate) / 4))}
                label="Maturity runway"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => prepareRenewal(stats.next)}>
                  <FileText size={13} /> Prepare renewal
                </Button>
                <Link to={`/app/institution/fdr/${stats.next.id}`} className="btn-ghost btn-sm">
                  Open record <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState className="mt-4 border-0 bg-transparent py-8" icon={CalendarClock} title="No upcoming maturity" />
          )}
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <span className="text-[10px] font-semibold text-muted">Reminder engine</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-olive">60 / 30 day live</span>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              items={TABS.map((tabItem) => ({
                ...tabItem,
                count:
                  tabItem.value === 'all'
                    ? scoped.length
                    : scoped.filter((f) => f.status === tabItem.value).length,
              }))}
              value={tab}
              onChange={setTab}
            />
            <div className="relative sm:w-[230px]">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('dash.search', 'Search FDR, bank or number')}
                className="py-2 pl-9 text-[12px]"
                aria-label="Search deposits"
              />
            </div>
          </div>

          {list.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
                <thead>
                  <tr className="border-b border-line">
                    <th className="table-head px-4 py-3">Deposit</th>
                    <th className="table-head px-4 py-3">Bank / branch</th>
                    <th className="table-head px-4 py-3">Amount</th>
                    <th className="table-head px-4 py-3">Maturity</th>
                    <th className="table-head px-4 py-3">Status</th>
                    <th className="table-head px-4 py-3">Trust</th>
                    <th className="table-head px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((fdr) => {
                    const bank = BANKS.find((b) => b.id === fdr.bankId)
                    const college = COLLEGES.find((c) => c.id === fdr.collegeId)
                    const release = releaseRequests.find((r) => r.fdrId === fdr.id && r.status === 'pending')
                    const days = daysBetween(new Date(Date.now() + clockOffsetDays * 86400000), fdr.maturityDate)
                    return (
                      <tr key={fdr.id} className="border-b border-line/60 transition hover:bg-paper/50">
                        <td className="px-4 py-3.5">
                          <Link to={`/app/institution/fdr/${fdr.id}`} className="font-mono text-[11px] font-semibold hover:text-accent">
                            {fdr.id}
                          </Link>
                          <p className="mt-0.5 text-[10px] text-muted">
                            {fdr.fdNumber} · {college?.code}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-[12px] font-semibold">{bank?.short}</p>
                          <p className="text-[10px] text-muted">{fdr.branch}</p>
                        </td>
                        <td className="px-4 py-3.5 text-[12px] font-semibold">{formatINR(fdr.amount, { compact: true })}</td>
                        <td className="px-4 py-3.5">
                          <p className="text-[11px]">{formatDate(fdr.maturityDate)}</p>
                          <p className={days <= 0 ? 'text-[10px] font-semibold text-danger' : 'text-[10px] text-muted'}>
                            {days <= 0 ? `matured ${Math.abs(days)}d ago` : `${days} days`}
                          </p>
                        </td>
                        <td className="px-4 py-3.5"><StatusPill status={fdr.status} /></td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold">{fdr.trustScore}</span>
                            <span className="h-1 w-10 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-accent" style={{ width: `${fdr.trustScore}%` }} /></span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-1">
                            {release ? (
                              <span className="chip border-accent/25 bg-accent/10 text-[9px] text-accent">release queued</span>
                            ) : (
                              ['verified', 'renewal_due'].includes(fdr.status) && days <= 0 && (
                                <Button size="sm" variant="outline" onClick={() => request(fdr)}>
                                  Release
                                </Button>
                              )
                            )}
                            <Link to={`/app/institution/fdr/${fdr.id}`} className="btn-ghost btn-sm px-2" aria-label={`Open ${fdr.id}`}>
                              <ArrowRight size={14} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Filter}
              title="No deposits match this filter"
              description="Change the lifecycle tab, switch the scope or clear the search."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setTab('all')
                    setQuery('')
                  }}
                >
                  Clear filters
                </Button>
              }
              className="m-4"
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[10px] text-muted">
            <span>{list.length} of {scoped.length} records · illustrative data</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={11} /> Fingerprints anchored on verification</span>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Inbox</p>
              <Link to="/app/institution/notifications" className="text-[10px] font-bold uppercase tracking-[0.1em] text-accent hover:underline">
                Open · {unread} unread
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {recentNotifications.map((n) => (
                <Link
                  key={n.id}
                  to={n.fdrId ? `/app/institution/fdr/${n.fdrId}` : '/app/institution/notifications'}
                  className="block rounded-2xl border border-line bg-paper/40 p-3 transition hover:border-ink/20"
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                    <div className={n.read ? 'pl-3.5' : ''}>
                      <p className="text-[11px] font-semibold leading-snug">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted">{n.body}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {!recentNotifications.length && <p className="py-4 text-center text-[11px] text-muted">No notifications yet.</p>}
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Quick actions</p>
            <div className="mt-3 space-y-2">
              <Link to="/app/institution/new?sample=genuine" className="flex items-center gap-3 rounded-2xl border border-line p-3 transition hover:bg-paper/60">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-olive/10 text-olive"><FilePlus2 size={14} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold">Verify a clean sample</span>
                  <span className="block text-[10px] text-muted">Real cleanup + three experts</span>
                </span>
                <ArrowRight size={13} className="text-muted" />
              </Link>
              <Link to="/app/institution/new?sample=edited" className="flex items-center gap-3 rounded-2xl border border-line p-3 transition hover:bg-paper/60">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-danger/10 text-danger"><CircleAlert size={14} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold">Test an edited receipt</span>
                  <span className="block text-[10px] text-muted">See the rejection reasons</span>
                </span>
                <ArrowRight size={13} className="text-muted" />
              </Link>
              <Link to="/explorer" className="flex items-center gap-3 rounded-2xl border border-line p-3 transition hover:bg-paper/60">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent"><Landmark size={14} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold">Verify the public chain</span>
                  <span className="block text-[10px] text-muted">No personal data on-chain</span>
                </span>
                <ArrowRight size={13} className="text-muted" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
