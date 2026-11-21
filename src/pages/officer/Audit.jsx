import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileJson2,
  Fingerprint,
  Filter,
  Loader2,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  Input,
  InlineNote,
  Select,
  SimBadge,
  Stat,
  Tabs,
} from '../../components/ui/primitives'
import { useStore } from '../../store/useStore'
import { toast } from '../../store/useToast'
import { verifyChain } from '../../lib/ledger'
import { downloadText, formatDateTime, matchesQuery, shortHash, titleCase, toCSV } from '../../lib/utils'

const TABS = [
  { value: 'audit', label: 'Decision log' },
  { value: 'blocks', label: 'Ledger blocks' },
  { value: 'events', label: 'Event stream' },
]

const ROLES = ['all', 'officer', 'institution', 'bank', 'system']

const ROLE_TONE = {
  officer: 'ink',
  institution: 'accent',
  bank: 'blue',
  system: 'sand',
}

function actionTone(action = '') {
  if (action.includes('REJECT') || action.includes('BLOCK') || action.includes('PAUSE_ON') || action.includes('INVALID')) return 'danger'
  if (
    action.includes('APPROV') ||
    action.includes('SIGNED') ||
    action.includes('VERIFIED') ||
    action.includes('COMPLETED') ||
    action.includes('RELEASED')
  ) {
    return 'olive'
  }
  if (action.includes('FLAG') || action.includes('REQUEST') || action.includes('ESCALAT') || action.includes('PAUSE_OFF')) return 'amber'
  return 'sand'
}

export default function AuditLog() {
  const audit = useStore((s) => s.audit)
  const blocks = useStore((s) => s.blocks)
  const events = useStore((s) => s.events)
  const fdrs = useStore((s) => s.fdrs)
  const setLedgerVerification = useStore((s) => s.setLedgerVerification)
  const storedVerification = useStore((s) => s.ledgerVerification)
  const [tab, setTab] = useState('audit')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [action, setAction] = useState('all')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(storedVerification)

  const actions = useMemo(() => ['all', ...new Set(audit.map((item) => item.action))], [audit])

  const runVerify = async () => {
    if (checking) return
    setChecking(true)
    try {
      const verification = await verifyChain(fdrs, blocks)
      setResult(verification)
      setLedgerVerification(verification)
      toast(
        verification.ok
          ? `Chain verified · ${verification.checkedBlocks} blocks and ${verification.checkedRecords} records match.`
          : `Integrity issue found in ${verification.issues.length} place(s). Nothing was silently repaired.`,
        { tone: verification.ok ? 'success' : 'danger' },
      )
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const verification = await verifyChain(fdrs, blocks)
      if (!cancelled) {
        setResult(verification)
        setLedgerVerification(verification)
      }
    })()
    return () => {
      cancelled = true
    }
    // Run once when the audit screen mounts; the manual button re-runs it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredAudit = useMemo(
    () =>
      audit
        .filter((item) => (role === 'all' ? true : item.role === role))
        .filter((item) => (action === 'all' ? true : item.action === action))
        .filter((item) => matchesQuery(`${item.id} ${item.actor} ${item.action} ${item.target} ${item.detail}`, query))
        .sort((a, b) => String(b.at).localeCompare(String(a.at))),
    [audit, role, action, query],
  )

  const filteredBlocks = useMemo(
    () => [...blocks].filter((block) => matchesQuery(`${block.id} ${block.type} ${block.fdrId} ${block.actor}`, query)).reverse(),
    [blocks, query],
  )

  const filteredEvents = useMemo(
    () => events.filter((event) => matchesQuery(`${event.id} ${event.topic} ${event.payload}`, query)),
    [events, query],
  )

  const exportAudit = () => {
    const csv = toCSV(filteredAudit, [
      { label: 'Audit ID', value: (row) => row.id },
      { label: 'Timestamp', value: (row) => row.at },
      { label: 'Actor', value: (row) => row.actor },
      { label: 'Role', value: (row) => row.role },
      { label: 'Action', value: (row) => row.action },
      { label: 'Target', value: (row) => row.target },
      { label: 'Detail', value: (row) => row.detail },
    ])
    downloadText(csv, `samarth-audit-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
    toast(`${filteredAudit.length} audit row(s) exported.`, { tone: 'success' })
  }

  const exportLedger = () => {
    const payload = {
      schema: 'aicte.fdr.ledger-export.v1',
      exportedAt: new Date().toISOString(),
      network: import.meta.env.VITE_CONTRACT_ADDRESS ? 'polygon-amoy' : 'in-app-sha256-chain',
      contract: import.meta.env.VITE_CONTRACT_ADDRESS || null,
      note: 'Illustrative prototype ledger. Contains fingerprints, document hashes and events — no personal data.',
      verification: result,
      blocks,
    }
    downloadText(JSON.stringify(payload, null, 2), `samarth-ledger-${Date.now()}.json`, 'application/json')
    toast('Ledger blocks exported as JSON.', { tone: 'success' })
  }

  const issues = result?.issues || []

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Immutable trail</Eyebrow>
            <SimBadge>In-app hash chain</SimBadge>
          </div>
          <h1 className="display mt-2 text-3xl sm:text-[40px]">
            Every decision, <em className="serif-accent">on the record.</em>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            Human decisions are append-only audit rows. Ledger blocks carry a fingerprint and the previous hash. Recompute the
            chain to see whether the off-chain record still matches what was anchored.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportAudit}>
            <ArrowDownToLine size={14} /> Export CSV
          </Button>
          <Button onClick={runVerify} disabled={checking}>
            {checking ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Verify chain
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Audit entries" value={audit.length} sub="human and system actions" icon={ClipboardList} />
        <Stat label="Ledger blocks" value={blocks.length} sub="append-only in this tab" icon={Fingerprint} tone="accent" />
        <Stat label="Anchored records" value={result?.checkedRecords ?? '—'} sub="fingerprints recomputed" icon={BadgeCheck} tone="olive" />
        <Stat
          label="Integrity"
          value={result ? (result.ok ? 'Valid' : `${issues.length} issue(s)`) : 'Not checked'}
          sub={result ? (result.ok ? 'chain and records agree' : 'investigate the highlighted block') : 'run the verifier'}
          icon={result?.ok ? ShieldCheck : ShieldAlert}
          tone={result?.ok ? 'olive' : result ? 'danger' : 'default'}
        />
      </div>

      <Card className={result?.ok ? 'border-olive/30 bg-olive/[0.035] p-4' : result ? 'border-danger/30 bg-danger/[0.04] p-4' : 'p-4'}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                result?.ok ? 'bg-olive/10 text-olive' : result ? 'bg-danger/10 text-danger' : 'bg-ink/[0.06] text-muted'
              }`}
            >
              {result?.ok ? <CheckCircle2 size={17} /> : result ? <CircleAlert size={17} /> : <Fingerprint size={17} />}
            </span>
            <div>
              <p className="text-[12px] font-semibold">
                {result
                  ? result.ok
                    ? `Chain valid · ${result.checkedBlocks} blocks recomputed`
                    : `Integrity check failed · ${issues.length} issue(s)`
                  : 'Chain has not been checked in this session'}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                {result
                  ? result.ok
                    ? `Head ${shortHash(result.head, 18)} · every prev-hash link and off-chain fingerprint matches.`
                    : 'A mismatch means the application record changed after the fingerprint was anchored. The ledger does not repair it.'
                  : 'The verifier recomputes each block hash and each anchored FDR fingerprint in the browser.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={exportLedger}>
              <FileJson2 size={12} /> Export ledger JSON
            </Button>
            <Link to="/explorer" className="btn-ghost btn-sm">
              Public view <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {issues.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-danger/20 pt-3">
            {issues.map((issue, index) => (
              <li key={`${issue.blockId}-${issue.kind}-${index}`} className="flex items-start gap-2 text-[10px] leading-relaxed">
                <XCircle size={11} className="mt-0.5 shrink-0 text-danger" />
                <span>
                  <strong className="font-mono">{issue.blockId}</strong> · {titleCase(issue.kind)} — {issue.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            items={TABS.map((item) => ({
              ...item,
              count: item.value === 'audit' ? audit.length : item.value === 'blocks' ? blocks.length : events.length,
            }))}
            value={tab}
            onChange={setTab}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            {tab === 'audit' && (
              <>
                <Select value={role} onChange={(e) => setRole(e.target.value)} className="py-2 text-[11px] sm:w-[130px]" aria-label="Filter by role">
                  {ROLES.map((item) => (
                    <option key={item} value={item}>
                      {item === 'all' ? 'All roles' : titleCase(item)}
                    </option>
                  ))}
                </Select>
                <Select value={action} onChange={(e) => setAction(e.target.value)} className="py-2 text-[11px] sm:w-[180px]" aria-label="Filter by action">
                  {actions.map((item) => (
                    <option key={item} value={item}>
                      {item === 'all' ? 'All actions' : titleCase(item)}
                    </option>
                  ))}
                </Select>
              </>
            )}
            <div className="relative sm:w-[230px]">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tab === 'events' ? 'Search topics or payloads' : 'Search actor, action or target'}
                className="py-2 pl-9 text-[12px]"
                aria-label="Search audit trail"
              />
            </div>
          </div>
        </div>

        {tab === 'audit' && (
          <>
            {filteredAudit.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="table-head px-4 py-3">When</th>
                      <th className="table-head px-4 py-3">Actor</th>
                      <th className="table-head px-4 py-3">Action</th>
                      <th className="table-head px-4 py-3">Target</th>
                      <th className="table-head px-4 py-3">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudit.map((item) => (
                      <tr key={item.id} className="border-b border-line/60 align-top transition hover:bg-paper/50">
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="font-mono text-[10px]">{formatDateTime(item.at)}</p>
                          <p className="mt-0.5 font-mono text-[9px] text-muted/70">{item.id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{item.actor}</p>
                          <Badge tone={ROLE_TONE[item.role] || 'sand'} className="mt-1">{item.role}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={actionTone(item.action)}>{item.action.replaceAll('_', ' ')}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {String(item.target).startsWith('FDR-') ? (
                            <Link to={`/app/officer/review/${item.target}`} className="font-mono text-[10px] font-semibold hover:text-accent">
                              {item.target}
                            </Link>
                          ) : (
                            <span className="font-mono text-[10px]">{item.target}</span>
                          )}
                        </td>
                        <td className="max-w-[320px] px-4 py-3 text-[10px] leading-relaxed text-muted">{item.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Filter}
                title="No audit entries match"
                description="Clear the role, action or search filters to see the full trail."
                className="m-4 border-0 bg-transparent py-10"
              />
            )}
          </>
        )}

        {tab === 'blocks' && (
          <>
            {filteredBlocks.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="table-head px-4 py-3">Block</th>
                      <th className="table-head px-4 py-3">Type</th>
                      <th className="table-head px-4 py-3">FDR</th>
                      <th className="table-head px-4 py-3">Hash</th>
                      <th className="table-head px-4 py-3">Previous</th>
                      <th className="table-head px-4 py-3">Actor / time</th>
                      <th className="table-head px-4 py-3 text-right">Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBlocks.map((block) => {
                      const issue = issues.find((i) => i.blockId === block.id)
                      return (
                        <tr key={block.id} className="border-b border-line/60 align-top transition hover:bg-paper/50">
                          <td className="px-4 py-3">
                            <p className="font-mono text-[10px] font-semibold">{block.id}</p>
                            <p className="font-mono text-[9px] text-muted">#{block.index}</p>
                          </td>
                          <td className="px-4 py-3"><Badge tone={block.type === 'RELEASED' ? 'ink' : block.type === 'AI_SIGNED' ? 'olive' : 'sand'}>{block.type}</Badge></td>
                          <td className="px-4 py-3">
                            {block.fdrId ? (
                              <Link to={`/explorer?fdr=${block.fdrId}`} className="font-mono text-[10px] font-semibold hover:text-accent">
                                {block.fdrId}
                              </Link>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3"><span className="font-mono text-[10px]">{shortHash(block.hash, 18)}</span></td>
                          <td className="px-4 py-3"><span className="font-mono text-[9px] text-muted">{shortHash(block.prevHash === 'GENESIS' ? null : block.prevHash, 14) || 'GENESIS'}</span></td>
                          <td className="px-4 py-3">
                            <p className="text-[10px] font-semibold">{block.actor}</p>
                            <p className="font-mono text-[9px] text-muted">{formatDateTime(block.timestamp)}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {issue ? <Badge tone="red">mismatch</Badge> : <Badge tone="olive">ok</Badge>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Fingerprint} title="No ledger blocks match" className="m-4 border-0 bg-transparent py-10" />
            )}
          </>
        )}

        {tab === 'events' && (
          <>
            {filteredEvents.length ? (
              <ul className="divide-y divide-line/70">
                {filteredEvents.map((event) => (
                  <li key={event.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-[11px] font-semibold">{event.topic}</p>
                        <span className="font-mono text-[9px] text-muted">{formatDateTime(event.at)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{event.payload}</p>
                      <p className="mt-1 font-mono text-[9px] text-muted/70">{event.id} · {event.simulated ? 'simulated broker' : 'live action'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Radio} title="No events match" className="m-4 border-0 bg-transparent py-10" />
            )}
          </>
        )}

        <div className="flex flex-col gap-2 border-t border-line px-4 py-3 text-[10px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1.5">
            <Clock3 size={11} /> Scenario clock does not rewrite recorded timestamps.
          </span>
          <span className="flex items-center gap-1.5">
            <Activity size={11} /> {filteredAudit.length + filteredBlocks.length + filteredEvents.length} row(s) in this view
          </span>
        </div>
      </Card>

      <InlineNote tone="accent" icon={BadgeCheck}>
        The audit log is a real append-only array in this browser, and the ledger is a real SHA-256 hash chain. Neither is a
        production WORM store. The included Solidity contract shows how the same double-lock and pause rules move on-chain.
      </InlineNote>
    </div>
  )
}
