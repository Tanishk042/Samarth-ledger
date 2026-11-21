import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CircleAlert,
  ClipboardList,
  Fingerprint,
  Inbox,
  Landmark,
  LockKeyhole,
  Search,
  ShieldAlert,
  Settings,
  Sparkles,
  TrendingDown,
  Users,
  Wallet,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  InlineNote,
  Input,
  Select,
  SimBadge,
  Stat,
  StatusPill,
  Tabs,
} from '../../components/ui/primitives'
import { useStore } from '../../store/useStore'
import { BANKS, BANK_HEALTH, COLLEGES, buildFraudGraph } from '../../data/seed'
import { formatDate, formatDateTime, formatINR, matchesQuery } from '../../lib/utils'
import { cn } from '../../lib/utils'

const QUEUE_TABS = [
  { value: 'review', label: 'Review queue' },
  { value: 'risk', label: 'Risk holds' },
  { value: 'rejected', label: 'Rejected' },
]

function weakExpert(fdr) {
  const list = Object.entries(fdr.reasons || {}).map(([key, value]) => ({ key, score: value?.score ?? 0 }))
  if (!list.length) return null
  return list.sort((a, b) => a.score - b.score)[0]
}

export default function OfficerDashboard() {
  const navigate = useNavigate()
  const fdrs = useStore((s) => s.fdrs)
  const audit = useStore((s) => s.audit)
  const _events = useStore((s) => s.events)
  const releaseRequests = useStore((s) => s.releaseRequests)
  const proofs = useStore((s) => s.proofs)
  const blocks = useStore((s) => s.blocks)
  const settings = useStore((s) => s.settings)
  const clockOffsetDays = useStore((s) => s.clockOffsetDays)
  const [queueTab, setQueueTab] = useState('review')
  const [bankId, setBankId] = useState('saraswat')
  const [query, setQuery] = useState('')

  const now = useMemo(() => new Date(Date.now() + clockOffsetDays * 86400000), [clockOffsetDays])

  const stats = useMemo(() => {
    const active = fdrs.filter((f) => ['verified', 'renewal_due'].includes(f.status))
    const review = fdrs.filter((f) => f.status === 'under_review')
    const rejected = fdrs.filter((f) => f.status === 'rejected')
    const holds = fdrs.filter((f) => f.riskHold)
    const pendingReleases = releaseRequests.filter((r) => r.status === 'pending')
    const total = active.reduce((acc, f) => acc + f.amount, 0)
    const trust = fdrs.length ? Math.round(fdrs.reduce((acc, f) => acc + (f.trustScore || 0), 0) / fdrs.length) : 0
    return { active, review, rejected, holds, pendingReleases, total, trust }
  }, [fdrs, releaseRequests])

  const queue = useMemo(() => {
    const base = queueTab === 'review' ? stats.review : queueTab === 'risk' ? stats.holds : stats.rejected
    return base
      .filter((f) => {
        const college = COLLEGES.find((c) => c.id === f.collegeId)
        return matchesQuery(`${f.id} ${f.fdNumber} ${f.signatory} ${college?.code} ${f.bankId}`, query)
      })
      .sort((a, b) => {
        if (queueTab === 'risk') return String(a.maturityDate).localeCompare(String(b.maturityDate))
        return (a.trustScore || 0) - (b.trustScore || 0)
      })
  }, [queueTab, stats, query])

  const graph = useMemo(() => {
    const built = buildFraudGraph(fdrs)
    const nodes = built.nodes.map((n) => ({ ...n }))
    const links = built.links.map((l) => ({ ...l }))
    const sim = forceSimulation(nodes)
      .force('link', forceLink(links).id((d) => d.id).distance(88).strength(0.72))
      .force('charge', forceManyBody().strength(-260))
      .force('center', forceCenter(340, 188))
      .force('collide', forceCollide(27))
      .stop()
    for (let i = 0; i < 220; i += 1) sim.tick()
    return { nodes, links }
  }, [fdrs])

  const health = BANK_HEALTH[bankId] || []
  const bank = BANKS.find((b) => b.id === bankId)
  const proofBank = proofs.filter((p) => p.bankId === bankId && p.valid !== false)
  const misses = BANKS.filter((b) => !proofs.some((p) => p.bankId === b.id && p.valid && p.date === new Date(now).toISOString().slice(0, 10)))

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>AICTE officer workspace</Eyebrow>
            <SimBadge>Consortium demo</SimBadge>
          </div>
          <h1 className="display mt-2 text-3xl sm:text-[40px]">
            Oversight without <em className="serif-accent">bottlenecks.</em>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            {fdrs.length} seeded deposits across {COLLEGES.length} institutions and {BANKS.length} banks · scenario date{' '}
            <span className="font-mono">{formatDate(now)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/app/officer/audit')}>
            <ClipboardList size={14} /> Audit log
          </Button>
          <Button onClick={() => navigate('/app/officer/releases')}>
            <LockKeyhole size={14} /> Release queue · {stats.pendingReleases.length}
          </Button>
        </div>
      </div>

      {settings.autoPause && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/[0.06] p-4">
          <p className="flex items-center gap-2 text-[12px] font-semibold text-danger">
            <ShieldAlert size={15} /> Emergency pause is active — every release is blocked.
          </p>
          <Link to="/app/officer/settings" className="text-[11px] font-bold uppercase tracking-[0.1em] text-danger hover:underline">
            Review the pause switch
          </Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Deposits under oversight" value={formatINR(stats.total, { compact: true })} sub={`${stats.active.length} active records`} icon={Wallet} />
        <Stat label="Awaiting a decision" value={stats.review.length} sub="medium-confidence queue" icon={Inbox} tone="accent" />
        <Stat label="Risk holds" value={stats.holds.length} sub="releases blocked" icon={ShieldAlert} tone="danger" />
        <Stat label="Average trust" value={`${stats.trust}/100`} sub={`${blocks.length} ledger blocks`} icon={Sparkles} tone="olive" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Action centre</p>
              <p className="mt-1 text-sm font-semibold">The smallest expert comes first</p>
            </div>
            <div className="relative sm:w-[210px]">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search queue"
                className="py-2 pl-9 text-[12px]"
                aria-label="Search review queue"
              />
            </div>
          </div>
          <div className="border-b border-line p-3">
            <Tabs
              items={QUEUE_TABS.map((t) => ({
                ...t,
                count: t.value === 'review' ? stats.review.length : t.value === 'risk' ? stats.holds.length : stats.rejected.length,
              }))}
              value={queueTab}
              onChange={setQueueTab}
            />
          </div>

          {queue.length ? (
            <ul className="divide-y divide-line/70">
              {queue.slice(0, 6).map((fdr) => {
                const college = COLLEGES.find((c) => c.id === fdr.collegeId)
                const bank = BANKS.find((b) => b.id === fdr.bankId)
                const weak = weakExpert(fdr)
                return (
                  <li key={fdr.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/app/officer/review/${fdr.id}`)}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-paper/60"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/[0.08] font-mono text-[10px] font-bold text-accent">
                        {fdr.trustScore}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] font-semibold">{fdr.id}</span>
                          <StatusPill status={fdr.status} />
                          {fdr.riskHold && <Badge tone="red">risk hold</Badge>}
                          {fdr.fraudRing && <Badge tone="red">ring overlap</Badge>}
                        </span>
                        <span className="mt-1 block text-[11px] font-semibold">
                          {formatINR(fdr.amount, { compact: true })} · {bank?.short} · {college?.code}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted">
                          {weak ? `Weakest expert: ${weak.key} (${weak.score}/100)` : 'Reasons attached'} · matures {formatDate(fdr.maturityDate)}
                        </span>
                      </span>
                      <ArrowRight size={14} className="mt-2 shrink-0 text-muted" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              icon={queueTab === 'review' ? Check : Search}
              title={query ? 'No queue item matches' : 'This queue is clear'}
              description="Seeded records and any medium-confidence submission appear here."
              className="m-4 border-0 bg-transparent py-10"
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[10px] text-muted">
            <span>{queue.length} item(s) · sorted by weakest expert</span>
            <Link to="/app/officer/audit" className="font-semibold text-accent hover:underline">
              See every decision
            </Link>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Bank health proxy</p>
                <p className="mt-1 text-sm font-semibold">{bank?.name}</p>
              </div>
              <div className="w-[145px]">
                <Select value={bankId} onChange={(e) => setBankId(e.target.value)} className="py-1.5 text-[11px]">
                  {BANKS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.short}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="mt-3 h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={health} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid stroke="rgb(var(--line) / 0.35)" vertical={false} />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} interval={2} />
                  <YAxis axisLine={false} tickLine={false} domain={[40, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="health" name="Health" stroke="rgb(var(--accent))" strokeWidth={2.2} dot={false} />
                  <Line type="monotone" dataKey="liquidity" name="Liquidity" stroke="rgb(var(--olive))" strokeWidth={1.6} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
              <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-accent" /> Health</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-olive" /> Liquidity</span>
              <span className="ml-auto flex items-center gap-1"><SimBadge>Illustrative series</SimBadge></span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[10px]">
              <span className="text-muted">Today’s signed proof</span>
              <Badge tone={proofBank.length ? 'olive' : 'red'}>{proofBank.length ? 'Received' : 'Missing'}</Badge>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Risk flags</p>
                <p className="mt-1 text-sm font-semibold">Holds that block release</p>
              </div>
              <TrendingDown size={16} className="text-danger" />
            </div>
            <ul className="mt-3 space-y-2">
              {stats.holds.slice(0, 4).map((fdr) => (
                <li key={fdr.id}>
                  <Link to={`/app/officer/review/${fdr.id}`} className="block rounded-2xl border border-danger/20 bg-danger/[0.04] p-2.5 transition hover:border-danger/40">
                    <p className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-semibold">
                      {fdr.id} <Badge tone="red">{fdr.riskHold ? 'hold' : 'grievance'}</Badge>
                    </p>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted">{fdr.riskNote || 'Open grievance'}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[10px]">
              <span className="text-muted">{misses.length} bank(s) missing today’s proof</span>
              <Link to="/app/bank" className="font-semibold text-accent hover:underline">
                Bank desk
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Fraud graph</p>
              <p className="mt-1 text-sm font-semibold">Shared signatory, branch and FD-number pattern</p>
            </div>
            <Badge tone="red">
              <ShieldAlert size={11} /> Ring overlap
            </Badge>
          </div>
          <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-paper/35">
            <svg viewBox="0 0 680 380" className="h-auto w-full" role="img" aria-label="Fraud link graph showing three colleges, one signatory and a shared branch">
              {graph.links.map((link, index) => {
                const source = typeof link.source === 'object' ? link.source : graph.nodes.find((n) => n.id === link.source)
                const target = typeof link.target === 'object' ? link.target : graph.nodes.find((n) => n.id === link.target)
                if (!source || !target) return null
                return (
                  <line
                    key={`${source.id}-${target.id}-${index}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={link.ring ? 'rgb(var(--danger) / 0.38)' : 'rgb(var(--line))'}
                    strokeWidth={link.ring ? 1.4 : 1}
                  />
                )
              })}
              {graph.nodes.map((node) => {
                const fill =
                  node.type === 'college'
                    ? 'rgb(var(--accent))'
                    : node.type === 'bank'
                      ? 'rgb(var(--olive))'
                      : node.type === 'signatory'
                        ? 'rgb(var(--danger))'
                        : node.type === 'fdr'
                          ? 'rgb(var(--ink))'
                          : 'rgb(var(--muted))'
                const radius = node.type === 'fdr' ? 17 : 13
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x || 0},${node.y || 0})`}
                    className={node.fdrId ? 'cursor-pointer' : undefined}
                    onClick={() => node.fdrId && navigate(`/app/officer/review/${node.fdrId}`)}
                  >
                    <circle r={radius + (node.ring ? 3 : 0)} fill={node.ring ? 'rgb(var(--danger) / 0.12)' : 'transparent'} />
                    <circle r={radius} fill={fill} opacity={node.ring ? 1 : 0.72} />
                    <text y={radius + 11} textAnchor="middle" fontSize="8" fontWeight="700" fill="rgb(var(--ink))">
                      {node.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-semibold text-muted">
            {[
              ['College', 'bg-accent'],
              ['FDR', 'bg-ink'],
              ['Bank', 'bg-olive'],
              ['Signatory / branch', 'bg-danger'],
            ].map(([label, tone]) => (
              <span key={label} className="flex items-center gap-1">
                <span className={cn('h-1.5 w-1.5 rounded-full', tone)} /> {label}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1"><SimBadge>Seeded graph</SimBadge></span>
          </div>
          <InlineNote className="mt-3" icon={Users}>
            A shared signatory is a prompt for investigation, not proof of fraud. The officer can request a replacement FDR without
            freezing unrelated deposits.
          </InlineNote>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Activity stream</p>
              <p className="mt-1 text-sm font-semibold">Recent decisions and events</p>
            </div>
            <Activity size={16} className="text-olive" />
          </div>
          <ol className="mt-3 space-y-0">
            {audit.slice(0, 8).map((item, index) => (
              <li key={item.id} className="relative flex gap-2.5 pb-3 last:pb-0">
                {index < 7 && <span className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-line" aria-hidden />}
                <span className="relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full border border-line bg-surface">
                  <span
                    className={cn(
                      'absolute inset-[4px] rounded-full',
                      item.action.includes('REJECT') || item.action.includes('BLOCK') || item.action.includes('PAUSE_ON')
                        ? 'bg-danger'
                        : item.action.includes('APPROV') || item.action.includes('SIGNED') || item.action.includes('VERIFIED')
                          ? 'bg-olive'
                          : 'bg-accent',
                    )}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold">
                    {item.action.replaceAll('_', ' ')} <span className="font-mono text-muted">· {item.target}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-muted">{item.detail}</p>
                  <p className="mt-0.5 font-mono text-[9px] text-muted/70">{formatDateTime(item.at)}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
            <Link to="/app/officer/audit" className="btn-outline btn-sm">
              Full audit log <ArrowRight size={12} />
            </Link>
            <Link to="/app/officer/settings" className="btn-ghost btn-sm">
              <Settings size={12} /> Policy
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: 'Review queue',
            body: `${stats.review.length} medium-confidence records with attached reasons.`,
            to: '/app/officer',
            icon: Inbox,
            tone: 'bg-accent/10 text-accent',
          },
          {
            title: 'Release approvals',
            body: `${stats.pendingReleases.length} double-lock requests, including failure modes.`,
            to: '/app/officer/releases',
            icon: LockKeyhole,
            tone: 'bg-olive/10 text-olive',
          },
          {
            title: 'Audit log',
            body: `${audit.length} recorded actions. Filter and export a CSV.`,
            to: '/app/officer/audit',
            icon: ClipboardList,
            tone: 'bg-ink/[0.06] text-ink',
          },
          {
            title: 'Bank proofs',
            body: `${proofs.length} ECDSA proofs, with one invalid Cosmos fixture.`,
            to: '/app/bank',
            icon: Landmark,
            tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
          },
        ].map((item) => (
          <Link key={item.title} to={item.to} className="card card-lift group p-4">
            <span className={cn('grid h-9 w-9 place-items-center rounded-xl', item.tone)}>
              <item.icon size={16} />
            </span>
            <p className="mt-3 flex items-center justify-between text-[12px] font-semibold">
              {item.title} <ArrowUpRight size={13} className="text-muted transition group-hover:text-ink" />
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">{item.body}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[10px] leading-relaxed text-muted">
          <CircleAlert size={12} className="shrink-0 text-accent" />
          All numbers are illustrative demo data. AI scores are probabilistic signals; every decision here can be overridden by a human.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Link to="/explorer" className="btn-ghost btn-sm">
            <Fingerprint size={12} /> Verify the chain
          </Link>
          <Link to="/app/officer/settings" className="btn-outline btn-sm">
            <BarChart3 size={12} /> Thresholds
          </Link>
        </div>
      </div>
    </div>
  )
}
