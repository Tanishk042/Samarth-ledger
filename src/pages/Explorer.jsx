import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  Blocks,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Copy,
  Database,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  LockKeyhole,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import PublicNav from '../components/layout/PublicNav'
import Footer from '../components/layout/Footer'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  InlineNote,
  Input,
  Modal,
  SimBadge,
  Stat,
  StatusPill,
  Tabs,
} from '../components/ui/primitives'
import { useStore } from '../store/useStore'
import { toast } from '../store/useToast'
import { verifyChain } from '../lib/ledger'
import { BANKS } from '../data/seed'
import {
  cn,
  downloadText,
  formatDate,
  formatDateTime,
  matchesQuery,
  shortHash,
  titleCase,
} from '../lib/utils'

const TABS = [
  { value: 'records', label: 'Public records' },
  { value: 'blocks', label: 'Chain blocks' },
]

export default function Explorer() {
  const [params, setParams] = useSearchParams()
  const fdrs = useStore((s) => s.fdrs)
  const blocks = useStore((s) => s.blocks)
  const tamperedFdrId = useStore((s) => s.tamperedFdrId)
  const tamperDemo = useStore((s) => s.tamperDemo)
  const restoreTamper = useStore((s) => s.restoreTamper)

  const [tab, setTab] = useState('records')
  const [query, setQuery] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(null)
  const [selected, setSelected] = useState(null)
  const [autoTampered, setAutoTampered] = useState(false)

  useEffect(() => {
    const flag = params.get('tampered')
    if (flag === '1' && !tamperedFdrId && !autoTampered) {
      setAutoTampered(true)
      tamperDemo()
    }
    if (flag && flag !== '1') {
      const match = blocks.find((b) => b.type === 'FDR_REGISTERED' && b.fdrId === flag)
      if (match) setSelected(match)
    }
    if (flag) {
      const next = new URLSearchParams(params)
      next.delete('tampered')
      setParams(next, { replace: true })
    }
    // Run once on entry from the footer tamper link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const publicRecords = useMemo(() => {
    const byId = new Map(fdrs.map((f) => [f.id, f]))
    return blocks
      .filter((b) => b.type === 'FDR_REGISTERED' && b.fdrId)
      .map((block) => {
        const fdr = byId.get(block.fdrId)
        return {
          block,
          fdr,
          id: block.fdrId,
          bank: BANKS.find((b) => b.id === fdr?.bankId),
          anchorBlock: block,
        }
      })
      .sort((a, b) => String(b.block.timestamp).localeCompare(String(a.block.timestamp)))
  }, [blocks, fdrs])

  const filteredRecords = useMemo(
    () =>
      publicRecords.filter((row) =>
        matchesQuery(
          `${row.id} ${row.block.fingerprint} ${row.block.hash} ${row.bank?.short || ''} ${row.fdr?.status || ''} ${row.fdr?.tokenId || ''}`,
          query,
        ),
      ),
    [publicRecords, query],
  )

  const filteredBlocks = useMemo(
    () =>
      [...blocks]
        .filter((block) => matchesQuery(`${block.id} ${block.type} ${block.fdrId} ${block.hash} ${block.prevHash}`, query))
        .reverse(),
    [blocks, query],
  )

  const tampered = Boolean(tamperedFdrId)
  const issues = result?.issues || []
  const head = blocks[blocks.length - 1]

  const runVerify = async () => {
    if (checking) return
    setChecking(true)
    try {
      const verification = await verifyChain(fdrs, blocks)
      setResult(verification)
      toast(
        verification.ok
          ? `Chain verified · ${verification.checkedBlocks} blocks and ${verification.checkedRecords} records agree.`
          : `Integrity check failed · ${verification.issues.length} issue(s). Nothing was repaired.`,
        { tone: verification.ok ? 'success' : 'danger' },
      )
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    verifyChain(fdrs, blocks).then((verification) => {
      if (!cancelled) setResult(verification)
    })
    return () => {
      cancelled = true
    }
    // Re-run when the off-chain data or chain changes.
  }, [blocks, fdrs])

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value)
      toast(`${label} copied.`, { tone: 'success' })
    } catch {
      toast('Clipboard access is blocked in this browser.', { tone: 'warning' })
    }
  }

  const exportPublic = () => {
    const payload = {
      schema: 'aicte.fdr.public-ledger.v1',
      exportedAt: new Date().toISOString(),
      network: import.meta.env.VITE_CONTRACT_ADDRESS ? 'polygon-amoy' : 'in-app-sha256-chain',
      notice:
        'Public verification export. Contains fingerprints, block hashes and status only. No names, FDR numbers, amounts, documents or contact details.',
      verification: result
        ? { ok: result.ok, checkedBlocks: result.checkedBlocks, checkedRecords: result.checkedRecords, head: result.head }
        : null,
      blocks: blocks.map((block) => ({
        id: block.id,
        index: block.index,
        type: block.type,
        recordId: block.fdrId,
        fingerprint: block.fingerprint,
        documentHash: block.docHash,
        prevHash: block.prevHash,
        hash: block.hash,
        timestamp: block.timestamp,
      })),
    }
    downloadText(JSON.stringify(payload, null, 2), `samarth-public-ledger-${Date.now()}.json`, 'application/json')
    toast('Privacy-safe public ledger exported.', { tone: 'success' })
  }

  const selectedBank = selected ? BANKS.find((b) => b.id === selected.fdr?.bankId) : null

  return (
    <div className="min-h-dvh bg-paper">
      <PublicNav />
      <main id="main">
        <section className="relative overflow-hidden border-b border-line">
          <div className="grain pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />
          <div className="container-x relative py-14 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Eyebrow>Public ledger explorer</Eyebrow>
                  <SimBadge>Illustrative data</SimBadge>
                </div>
                <h1 className="display mt-4 max-w-3xl text-4xl leading-[1.02] sm:text-6xl">
                  Verify the deposit. <em className="serif-accent">See no private data.</em>
                </h1>
                <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
                  Search an anchored record, inspect its fingerprint and recompute the hash chain in your browser.
                  Names, account numbers, amounts and documents never appear here.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                    <Input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value)
                        setTab('records')
                      }}
                      placeholder="Search FDR-2026-0021, fingerprint, block hash or bank…"
                      className="h-12 rounded-full pl-11 pr-4 text-[13px]"
                      aria-label="Search public ledger"
                    />
                  </div>
                  <Button size="lg" onClick={runVerify} disabled={checking} className="shrink-0">
                    {checking ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    Recompute chain
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <span className="inline-flex items-center gap-1.5"><EyeOff size={12} /> No PII</span>
                  <span className="inline-flex items-center gap-1.5"><LockKeyhole size={12} /> No amounts</span>
                  <span className="inline-flex items-center gap-1.5"><Fingerprint size={12} /> Fingerprints only</span>
                </div>
              </div>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Network</p>
                  <Badge tone={import.meta.env.VITE_CONTRACT_ADDRESS ? 'olive' : 'sand'}>
                    {import.meta.env.VITE_CONTRACT_ADDRESS ? 'Polygon Amoy' : 'In-app chain'}
                  </Badge>
                </div>
                <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink/80">
                  {head ? shortHash(head.hash, 22) : 'Booting the demo chain…'}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-line bg-paper/60 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Records</p>
                    <p className="mt-1 font-mono text-lg font-semibold">{publicRecords.length}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-paper/60 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Blocks</p>
                    <p className="mt-1 font-mono text-lg font-semibold">{blocks.length}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px]">
                  <span className="text-muted">Latest block</span>
                  <span className="font-mono">{head?.id || '—'}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-muted">Anchored</span>
                  <span className="font-mono">{head ? formatDateTime(head.timestamp) : '—'}</span>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <div className="container-x py-8 sm:py-10">
          {tampered && (
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-danger/30 bg-danger/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
                  <ShieldAlert size={17} />
                </span>
                <div>
                  <p className="text-[12px] font-semibold text-danger">
                    Off-chain edit detected on {tampered}
                  </p>
                  <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-muted">
                    The amount was changed after the fingerprint was anchored. The chain itself is intact; the record no
                    longer matches it. This is exactly the mismatch an officer would investigate.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  restoreTamper()
                  setResult(null)
                }}
              >
                <RotateCcw size={13} /> Restore record
              </Button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Public records" value={publicRecords.length} sub="anchored fingerprints" icon={Database} />
            <Stat label="Chain blocks" value={blocks.length} sub="every prev-hash link checked" icon={Blocks} />
            <Stat
              label="Integrity"
              value={result ? (result.ok ? 'Valid' : `${issues.length} issue(s)`) : 'Checking…'}
              sub={result?.ok ? 'records match anchors' : result ? 'open the highlighted row' : 'recomputing now'}
              icon={result?.ok ? ShieldCheck : result ? ShieldAlert : Loader2}
              tone={result?.ok ? 'olive' : result ? 'danger' : 'default'}
            />
            <Stat
              label="Tamper state"
              value={tampered ? 'Changed' : 'Clean'}
              sub={tampered ? `${tampered} differs from its anchor` : 'no off-chain edits in this tab'}
              icon={tampered ? TriangleAlert : BadgeCheck}
              tone={tampered ? 'danger' : 'olive'}
            />
          </div>

          {result && !result.ok && (
            <Card className="mt-4 border-danger/30 bg-danger/[0.035] p-4">
              <div className="flex items-start gap-3">
                <CircleAlert size={17} className="mt-0.5 shrink-0 text-danger" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-danger">Verification found {issues.length} mismatch(es)</p>
                  <ul className="mt-2 space-y-1.5">
                    {issues.map((issue, index) => (
                      <li key={`${issue.blockId}-${index}`} className="text-[10px] leading-relaxed text-muted">
                        <span className="font-mono font-semibold text-ink">{issue.blockId}</span> · {titleCase(issue.kind)} —{' '}
                        {issue.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          <Card className="mt-5 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
              <Tabs
                value={tab}
                onChange={setTab}
                items={TABS.map((item) => ({
                  ...item,
                  count: item.value === 'records' ? filteredRecords.length : filteredBlocks.length,
                }))}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative sm:w-[280px]">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tab === 'records' ? 'Filter records…' : 'Filter blocks…'}
                    className="py-2 pl-9 text-[12px]"
                    aria-label="Filter the ledger"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={exportPublic}>
                  <ArrowDownToLine size={13} /> Export public JSON
                </Button>
              </div>
            </div>

            {tab === 'records' ? (
              filteredRecords.length ? (
                <ul className="divide-y divide-line/70">
                  {filteredRecords.map((row) => {
                    const flagged = tamperedFdrId === row.id
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(row.block)}
                          className={cn(
                            'flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 text-left transition hover:bg-paper/60 sm:px-5',
                            flagged && 'bg-danger/[0.035]',
                          )}
                        >
                          <span
                            className={cn(
                              'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                              flagged ? 'bg-danger/10 text-danger' : 'bg-olive/10 text-olive',
                            )}
                          >
                            {flagged ? <TriangleAlert size={16} /> : <Fingerprint size={16} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
                              {row.id}
                              {row.fdr && <StatusPill status={row.fdr.status} />}
                              {flagged && <Badge tone="red">Fingerprint mismatch</Badge>}
                            </p>
                            <p className="mt-1 truncate font-mono text-[10px] text-muted">
                              {row.block.fingerprint ? shortHash(row.block.fingerprint, 26) : 'No fingerprint'}
                            </p>
                          </div>
                          <div className="hidden text-right md:block">
                            <p className="text-[10px] text-muted">{row.bank?.short || 'Bank'} · {formatDate(row.block.timestamp)}</p>
                            <p className="mt-0.5 font-mono text-[9px] text-muted/70">{row.block.id}</p>
                          </div>
                          <ChevronRight size={15} className="shrink-0 text-muted/60" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={Search}
                  title="No anchored record matches"
                  description="Try an FDR id such as FDR-2026-0021, or clear the filter. Rejected and unsynced records are never anchored."
                />
              )
            ) : filteredBlocks.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[11px]">
                  <thead className="border-b border-line bg-paper/50 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <tr>
                      <th className="px-4 py-2.5 font-bold">Block</th>
                      <th className="px-4 py-2.5 font-bold">Type</th>
                      <th className="px-4 py-2.5 font-bold">Record</th>
                      <th className="px-4 py-2.5 font-bold">Hash</th>
                      <th className="px-4 py-2.5 font-bold">Previous</th>
                      <th className="px-4 py-2.5 font-bold">Anchored</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {filteredBlocks.map((block) => (
                      <tr key={block.id} className="transition hover:bg-paper/50">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-semibold">{block.id}</td>
                        <td className="px-4 py-3"><Badge tone="sand">{block.type.replaceAll('_', ' ')}</Badge></td>
                        <td className="px-4 py-3 font-mono text-[10px] text-muted">{block.fdrId || '—'}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => copy(block.hash, 'Block hash')}
                            className="font-mono text-[10px] hover:text-accent"
                            title="Copy block hash"
                          >
                            {shortHash(block.hash, 12)}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-muted">{block.prevHash === 'GENESIS' ? 'GENESIS' : shortHash(block.prevHash, 10)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[10px] text-muted">{formatDateTime(block.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Blocks} title="No block matches" description="Clear the filter to see every block in the chain." />
            )}
          </Card>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                  <Sparkles size={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold">Try the tamper drill</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    Edit one anchored record in this browser, then recompute the chain. The prototype reports the mismatch
                    and offers a restore — it never claims the altered record is valid.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant={tampered ? 'ghost' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (tampered) {
                      restoreTamper()
                      setResult(null)
                    } else {
                      tamperDemo()
                      setResult(null)
                    }
                  }}
                >
                  {tampered ? <RotateCcw size={13} /> : <TriangleAlert size={13} />}
                  {tampered ? 'Restore the record' : 'Tamper with a record'}
                </Button>
                <Button size="sm" onClick={runVerify} disabled={checking}>
                  {checking ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                  Recompute chain
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">What this explorer withholds</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  'Institution and contact names',
                  'Student or staff identities',
                  'FDR account numbers',
                  'Deposit amounts and interest',
                  'Scanned documents and OCR',
                  'Bank signatory identities',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-[11px] text-muted">
                    <EyeOff size={12} className="mt-0.5 shrink-0 text-danger" />
                    {item}
                  </div>
                ))}
              </div>
              <InlineNote tone="olive" icon={KeyRound} className="mt-4">
                Public verification needs only a fingerprint and a status. The full record stays inside role-protected
                workspaces.
              </InlineNote>
            </Card>
          </div>

          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-3xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold">Want the full control room?</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Sign in as an institution, AICTE officer or bank agent. Every seeded action is reversible.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/login" className="btn-primary btn-sm">
                Open the demo <ArrowRight size={13} />
              </Link>
              <Link to="/" className="btn-outline btn-sm">Back to overview</Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.fdrId ? `Public record · ${selected.fdrId}` : 'Public record'}
        description="Fingerprint and chain proof only. No personal, institutional or financial data is exposed."
        size="lg"
        footer={
          selected ? (
            <>
              <Button variant="outline" size="sm" onClick={() => copy(selected.hash, 'Block hash')}>
                <Copy size={13} /> Copy block hash
              </Button>
              <Button variant="ghost" size="sm" onClick={() => copy(selected.fingerprint || '', 'Fingerprint')}>
                <Copy size={13} /> Copy fingerprint
              </Button>
            </>
          ) : null
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {tamperedFdrId === selected.fdrId ? (
                <Badge tone="red"><TriangleAlert size={11} /> Fingerprint mismatch</Badge>
              ) : (
                <Badge tone="olive"><CheckCircle2 size={11} /> Anchored</Badge>
              )}
              <Badge tone="sand">{selected.id}</Badge>
              {selected.docHash && <Badge tone="blue">Document hash present</Badge>}
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-paper/50 p-3.5">
                <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Record</dt>
                <dd className="mt-1 font-mono text-[11px] font-semibold">{selected.fdrId}</dd>
              </div>
              <div className="rounded-2xl border border-line bg-paper/50 p-3.5">
                <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Status</dt>
                <dd className="mt-1.5">{selectedBank ? <StatusPill status={selected.fdr?.status} /> : '—'}</dd>
              </div>
              <div className="rounded-2xl border border-line bg-paper/50 p-3.5">
                <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Bank</dt>
                <dd className="mt-1 text-[11px] font-semibold">{selectedBank?.name || '—'}</dd>
              </div>
              <div className="rounded-2xl border border-line bg-paper/50 p-3.5">
                <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Soulbound token</dt>
                <dd className="mt-1 font-mono text-[11px]">{selected.fdr?.tokenId || '—'}</dd>
              </div>
            </dl>

            <div>
              <p className="label">Record fingerprint (SHA-256)</p>
              <pre className="mt-1.5 overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-paper p-3.5 font-mono text-[10px] leading-relaxed">
                {selected.fingerprint || 'No fingerprint'}
              </pre>
            </div>
            <div>
              <p className="label">Document hash (SHA-256)</p>
              <pre className="mt-1.5 overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-paper p-3.5 font-mono text-[10px] leading-relaxed">
                {selected.docHash || 'No document hash anchored'}
              </pre>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="label">Block hash</p>
                <pre className="mt-1.5 overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-paper p-3.5 font-mono text-[10px] leading-relaxed">
                  {selected.hash}
                </pre>
              </div>
              <div>
                <p className="label">Previous block</p>
                <pre className="mt-1.5 overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-paper p-3.5 font-mono text-[10px] leading-relaxed">
                  {selected.prevHash}
                </pre>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[10px] text-muted">
              <span>Anchored {formatDateTime(selected.timestamp)}</span>
              <span className="font-mono">{selected.id}</span>
            </div>
            {tamperedFdrId === selected.fdrId && (
              <InlineNote tone="danger" icon={XCircle}>
                The off-chain record no longer hashes to this fingerprint. Recompute the chain to see the failure, then
                restore the demo record.
              </InlineNote>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
