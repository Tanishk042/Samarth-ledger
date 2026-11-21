import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  FileKey2,
  Fingerprint,
  KeyRound,
  Landmark,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Signature,
  XCircle,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  InlineNote,
  Modal,
  SimBadge,
  Stat,
  StatusPill,
  Tabs,
} from '../../components/ui/primitives'
import { useStore } from '../../store/useStore'
import { toast } from '../../store/useToast'
import { BANKS, COLLEGES } from '../../data/seed'
import { sha256Hex } from '../../lib/hash'
import {
  addDays,
  cn,
  formatDate,
  formatDateTime,
  formatINR,
  isoDate,
  matchesQuery,
  shortHash,
} from '../../lib/utils'

const DAY = 86400000

function jwkThumbprint(jwk) {
  if (!jwk) return null
  return sha256Hex(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }))
}

function dayLabel(date, today) {
  if (!date) return 'No proof'
  if (date === today) return 'Today'
  if (date === isoDate(addDays(new Date(`${today}T00:00:00Z`), -1))) return 'Yesterday'
  return formatDate(`${date}T00:00:00Z`)
}

export default function BankPortal() {
  const user = useStore((s) => s.user)
  const proofs = useStore((s) => s.proofs)
  const bankKeys = useStore((s) => s.bankKeys)
  const fdrs = useStore((s) => s.fdrs)
  const clockOffsetDays = useStore((s) => s.clockOffsetDays)
  const createProof = useStore((s) => s.createProof)
  const verifyProof = useStore((s) => s.verifyProof)
  const rotateBankKey = useStore((s) => s.rotateBankKey)
  const missedProofDates = useStore((s) => s.missedProofDates)

  const initialBank = useMemo(() => {
    const fromOrg = String(user?.orgId || '').replace('BANK-', '').toLowerCase()
    return BANKS.some((b) => b.id === fromOrg) ? fromOrg : 'hdfc'
  }, [user?.orgId])

  const [bankId, setBankId] = useState(initialBank)
  const [tab, setTab] = useState('today')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState('')
  const [thumbprint, setThumbprint] = useState('')
  const [selectedProof, setSelectedProof] = useState(null)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [showPrivate, setShowPrivate] = useState(false)

  const today = useMemo(() => isoDate(new Date(Date.now() + clockOffsetDays * DAY)), [clockOffsetDays])
  const bank = BANKS.find((b) => b.id === bankId) || BANKS[1]
  const key = bankKeys[bank.id]

  useEffect(() => {
    let cancelled = false
    jwkThumbprint(key?.publicJwk).then((value) => {
      if (!cancelled) setThumbprint(value || '')
    })
    return () => {
      cancelled = true
    }
  }, [key])

  useEffect(() => {
    setShowPrivate(false)
  }, [bankId])

  const bankProofs = useMemo(
    () =>
      proofs
        .filter((p) => p.bankId === bank.id)
        .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)),
    [proofs, bank.id],
  )

  const todaysProofs = bankProofs.filter((p) => p.date === today && p.valid !== false)
  const todaysProof = todaysProofs[0] || null
  const misses = missedProofDates(bank.id)
  const bankFdrs = useMemo(
    () => fdrs.filter((f) => f.bankId === bank.id && f.status !== 'released'),
    [fdrs, bank.id],
  )
  const lockedAmount = useMemo(() => bankFdrs.reduce((acc, f) => acc + Number(f.amount || 0), 0), [bankFdrs])
  const coverage = Math.max(0, 5 - misses.length)

  const consortium = useMemo(
    () =>
      BANKS.map((item) => {
        const list = proofs.filter((p) => p.bankId === item.id)
        const todayProof = list.find((p) => p.date === today && p.valid !== false)
        const latest = [...list].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))[0]
        const invalid = list.filter((p) => p.valid === false).length
        const missed = missedProofDates(item.id).length
        return { bank: item, todayProof, latest, invalid, missed, count: list.length }
      }).sort((a, b) => b.missed - a.missed || b.invalid - a.invalid),
    [proofs, today, missedProofDates],
  )

  const filteredProofs = useMemo(
    () =>
      bankProofs.filter((p) =>
        matchesQuery(`${p.id} ${p.date} ${p.signer} ${p.valid ? 'valid' : 'invalid'}`, query),
      ),
    [bankProofs, query],
  )

  const run = async (name, fn) => {
    if (busy) return
    setBusy(name)
    try {
      await fn()
    } catch (error) {
      toast(error?.message || 'The proof operation failed.', { tone: 'danger' })
    } finally {
      setBusy('')
    }
  }

  const publish = () =>
    run('publish', async () => {
      const proof = await createProof(bank.id)
      if (proof) setTab('history')
    })

  const verify = (proof) =>
    run(`verify-${proof.id}`, async () => {
      await verifyProof(proof.id)
    })

  const rotate = () =>
    run('rotate', async () => {
      await rotateBankKey(bank.id)
      setRotateOpen(false)
    })

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value)
      toast(`${label} copied.`, { tone: 'success' })
    } catch {
      toast('Clipboard access is blocked in this browser.', { tone: 'warning' })
    }
  }

  const latest5 = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const date = isoDate(addDays(new Date(`${today}T00:00:00Z`), -i))
      const ok = bankProofs.find((p) => p.date === date && p.valid !== false)
      const bad = bankProofs.find((p) => p.date === date && p.valid === false)
      return { date, ok, bad }
    })
  }, [today, bankProofs])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Bank proof desk</Eyebrow>
            <SimBadge>Illustrative bank agent</SimBadge>
          </div>
          <h1 className="display mt-2 text-3xl sm:text-[40px]">
            Prove the lock. <em className="serif-accent">Reveal nothing else.</em>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            Publish a daily signed statement that deposits are still held. The payload contains a bank code,
            a date and a count — never an institution, FDR number, amount or person.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2">
            <Landmark size={15} style={{ color: bank.color }} />
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              className="max-w-[190px] bg-transparent text-[12px] font-semibold outline-none"
              aria-label="Select bank desk"
            >
              {BANKS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={publish} disabled={busy === 'publish'}>
            {busy === 'publish' ? <Loader2 size={14} className="animate-spin" /> : <Signature size={14} />}
            {todaysProof ? 'Publish another proof' : 'Sign today’s proof'}
          </Button>
        </div>
      </div>

      {misses.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-600/30 bg-amber-500/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>{misses.length} missing proof{misses.length > 1 ? 's' : ''}</strong> in the last five days for{' '}
              {bank.short}. Missing proofs are visible to the AICTE officer and never auto-filled.
            </span>
          </p>
          <span className="chip border-amber-600/25 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            {misses.map((date) => formatDate(`${date}T00:00:00Z`)).join(' · ')}
          </span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Today’s proof"
          value={todaysProof ? 'Published' : 'Not yet'}
          sub={todaysProof ? `${formatDateTime(todaysProof.createdAt)} · ${todaysProof.signer}` : 'Sign a locked-balance statement'}
          icon={todaysProof ? BadgeCheck : AlertTriangle}
          tone={todaysProof ? 'olive' : 'danger'}
        />
        <Stat
          label="Locked FDRs"
          value={bankFdrs.length}
          sub={`${formatINR(lockedAmount, { compact: true })} aggregate · never included in the proof`}
          icon={LockKeyhole}
        />
        <Stat
          label="5-day coverage"
          value={`${coverage}/5`}
          sub={misses.length ? `${misses.length} gap${misses.length > 1 ? 's' : ''} visible to oversight` : 'No gaps in the rolling window'}
          icon={ShieldCheck}
          tone={misses.length ? 'accent' : 'olive'}
        />
        <Stat
          label="Signing key"
          value={key ? 'P-256' : 'Loading'}
          sub={thumbprint ? `Thumbprint ${shortHash(thumbprint, 10)}` : 'Generating key in this browser'}
          icon={KeyRound}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Proof ledger · {bank.short}</p>
              <p className="mt-1 text-[11px] text-muted">
                Real ECDSA signatures generated in this browser. Each row can be independently re-verified.
              </p>
            </div>
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { value: 'today', label: 'Today', count: todaysProofs.length },
                { value: 'history', label: 'History', count: bankProofs.length },
                { value: 'consortium', label: 'Consortium' },
              ]}
            />
          </div>

          {tab === 'today' && (
            <div className="p-5">
              {todaysProof ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-olive/25 bg-olive/[0.05] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-olive/10 text-olive">
                          <CheckCircle2 size={20} />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">Locked-balance proof signed</p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted">{todaysProof.id}</p>
                        </div>
                      </div>
                      <Badge tone="olive">Signature valid</Badge>
                    </div>
                    <dl className="mt-4 grid gap-3 text-[11px] sm:grid-cols-3">
                      <div>
                        <dt className="font-bold uppercase tracking-[0.1em] text-muted">Date</dt>
                        <dd className="mt-1 font-semibold">{formatDate(`${todaysProof.date}T00:00:00Z`)}</dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-[0.1em] text-muted">FDRs covered</dt>
                        <dd className="mt-1 font-semibold">{todaysProof.payload?.fdrCount}</dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-[0.1em] text-muted">Amount locked</dt>
                        <dd className="mt-1 font-semibold">{todaysProof.payload?.amountLocked === 'YES' ? 'Yes' : '—'}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedProof(todaysProof)}>
                      <FileKey2 size={13} /> Inspect payload
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => verify(todaysProof)}
                      disabled={busy === `verify-${todaysProof.id}`}
                    >
                      {busy === `verify-${todaysProof.id}` ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                      Re-verify signature
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => copy(JSON.stringify(todaysProof.payload, null, 2), 'Payload')}>
                      <Copy size={13} /> Copy payload
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Signature}
                  title="No proof published yet today"
                  description={`Sign a statement for ${formatDate(`${today}T00:00:00Z`)}. The officer dashboard flags a missing proof after the daily window.`}
                  action={<Button onClick={publish} disabled={busy === 'publish'}>Sign today’s proof</Button>}
                />
              )}

              <div className="mt-5 rounded-2xl border border-line bg-paper/50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Last five days</p>
                  <span className="text-[10px] text-muted">{coverage} verified</span>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {latest5.map((item) => (
                    <div
                      key={item.date}
                      className={cn(
                        'rounded-xl border px-2 py-2.5 text-center',
                        item.ok
                          ? 'border-olive/25 bg-olive/[0.06]'
                          : item.bad
                            ? 'border-danger/25 bg-danger/[0.06]'
                            : 'border-dashed border-line bg-surface',
                      )}
                    >
                      <p className="text-[9px] font-bold uppercase tracking-[0.06em] text-muted">
                        {dayLabel(item.date, today)}
                      </p>
                      <div className="mt-1.5 flex justify-center">
                        {item.ok ? (
                          <Check size={14} className="text-olive" />
                        ) : item.bad ? (
                          <XCircle size={14} className="text-danger" />
                        ) : (
                          <Ban size={13} className="text-muted/50" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div>
              <div className="border-b border-line p-4">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search proof id, date, signer or validity…"
                  className="input h-9 text-[12px]"
                  aria-label="Search proofs"
                />
              </div>
              {filteredProofs.length ? (
                <ul className="divide-y divide-line/70">
                  {filteredProofs.slice(0, 40).map((proof) => (
                    <li key={proof.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <span
                        className={cn(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-xl',
                          proof.valid === false ? 'bg-danger/10 text-danger' : 'bg-olive/10 text-olive',
                        )}
                      >
                        {proof.valid === false ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold">
                          {formatDate(`${proof.date}T00:00:00Z`)}
                          <span className="ml-2 font-mono text-[10px] font-normal text-muted">{shortHash(proof.id, 8)}</span>
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-muted">
                          {proof.payload?.fdrCount ?? '—'} FDRs · {proof.signer || 'Daily proof agent'} · ECDSA P-256
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedProof(proof)}
                          className="rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted transition hover:bg-ink/[0.05] hover:text-ink"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => verify(proof)}
                          disabled={busy === `verify-${proof.id}`}
                          className="rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-accent transition hover:bg-accent/[0.07] disabled:opacity-50"
                        >
                          {busy === `verify-${proof.id}` ? 'Checking…' : proof.checkedAt ? 'Re-verify' : 'Verify'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={FileKey2} title="No matching proofs" description="Clear the search or publish a new signed proof." />
              )}
            </div>
          )}

          {tab === 'consortium' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-[11px]">
                <thead className="border-b border-line bg-paper/50 text-[9px] uppercase tracking-[0.12em] text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Bank</th>
                    <th className="px-4 py-2.5 font-bold">Today</th>
                    <th className="px-4 py-2.5 font-bold">Latest proof</th>
                    <th className="px-4 py-2.5 font-bold">5-day gaps</th>
                    <th className="px-4 py-2.5 font-bold">Invalid</th>
                    <th className="px-4 py-2.5 font-bold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {consortium.map((row) => (
                    <tr key={row.bank.id} className={cn(row.bank.id === bank.id && 'bg-accent/[0.035]')}>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setBankId(row.bank.id)}
                          className="flex items-center gap-2 font-semibold hover:text-accent"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.bank.color }} />
                          {row.bank.short}
                        </button>
                        <p className="mt-0.5 pl-4 text-[9px] text-muted">{row.bank.branch}</p>
                      </td>
                      <td className="px-4 py-3">
                        {row.todayProof ? (
                          <span className="inline-flex items-center gap-1 text-olive"><CheckCircle2 size={12} /> Signed</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"><AlertTriangle size={12} /> Missing</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {row.latest ? formatDate(`${row.latest.date}T00:00:00Z`) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('font-mono font-semibold', row.missed ? 'text-danger' : 'text-olive')}>{row.missed}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('font-mono font-semibold', row.invalid ? 'text-danger' : 'text-muted')}>{row.invalid}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-line px-4 py-3 text-[10px] leading-relaxed text-muted">
                The consortium view is an illustrative cross-bank monitor. A production deployment would receive proofs
                through a regulated message bus, not from another bank’s browser.
              </p>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Signing identity</p>
                <p className="mt-1 text-sm font-semibold">{bank.name}</p>
                <p className="text-[11px] text-muted">{bank.branch} · IFSC {bank.ifsc}</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-paper text-muted">
                <Fingerprint size={16} />
              </span>
            </div>

            {key ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-line bg-paper/60 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Public key thumbprint</span>
                    <button
                      type="button"
                      onClick={() => copy(thumbprint, 'Thumbprint')}
                      className="rounded-full p-1 text-muted hover:bg-ink/[0.06] hover:text-ink"
                      aria-label="Copy thumbprint"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  <p className="mt-1.5 break-all font-mono text-[10px] leading-relaxed text-ink/80">{thumbprint || 'Computing…'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-xl border border-line bg-surface p-2.5">
                    <p className="font-bold uppercase tracking-[0.08em] text-muted">Curve</p>
                    <p className="mt-1 font-mono">{key.publicJwk?.crv || 'P-256'}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-2.5">
                    <p className="font-bold uppercase tracking-[0.08em] text-muted">Algorithm</p>
                    <p className="mt-1 font-mono">ECDSA / SHA-256</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrivate((v) => !v)}
                  className="text-[10px] font-semibold text-muted underline decoration-dotted underline-offset-2 hover:text-ink"
                >
                  {showPrivate ? 'Hide' : 'Show'} demo private key
                </button>
                {showPrivate && (
                  <div className="rounded-2xl border border-danger/20 bg-danger/[0.04] p-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-danger">
                      Demo only · never expose a real private key
                    </p>
                    <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-all font-mono text-[9px] leading-relaxed text-muted">
                      {JSON.stringify(key.privateJwk, null, 2)}
                    </pre>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={() => setRotateOpen(true)}>
                  <RefreshCw size={13} /> Rotate signing key
                </Button>
              </div>
            ) : (
              <p className="mt-4 flex items-center gap-2 text-[11px] text-muted">
                <Loader2 size={13} className="animate-spin" /> Generating a browser-held demo key…
              </p>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">What the proof contains</p>
            <div className="mt-3 space-y-2 text-[11px]">
              {[
                ['Bank code', 'Included'],
                ['Proof date', 'Included'],
                ['Locked FDR count', 'Included'],
                ['Amount locked flag', 'Included'],
                ['Nonce / replay guard', 'Included'],
                ['Institution or student data', 'Never'],
                ['FDR number or amount', 'Never'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-line/60 pb-2 last:border-0 last:pb-0">
                  <span className="text-muted">{label}</span>
                  <span className={cn('font-semibold', value === 'Never' ? 'text-danger' : 'text-ink')}>{value}</span>
                </div>
              ))}
            </div>
            <InlineNote tone="olive" icon={ShieldCheck} className="mt-4">
              A bank cannot alter history quietly: changing one field breaks the ECDSA signature, and the officer sees
              the invalid proof instead of a silent repair.
            </InlineNote>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Held deposits</p>
              <Badge tone="sand">{bankFdrs.length}</Badge>
            </div>
            {bankFdrs.length ? (
              <ul className="mt-3 divide-y divide-line/60">
                {bankFdrs.slice(0, 6).map((fdr) => {
                  const college = COLLEGES.find((c) => c.id === fdr.collegeId)
                  return (
                    <li key={fdr.id} className="flex items-center justify-between gap-3 py-2.5 text-[11px]">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{fdr.fdNumber}</p>
                        <p className="truncate text-[10px] text-muted">{college?.code || fdr.collegeId} · {formatDate(fdr.maturityDate)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono font-semibold">{formatINR(fdr.amount, { compact: true })}</p>
                        <p className="mt-0.5"><StatusPill status={fdr.status} /></p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-3 text-[11px] text-muted">No held deposits for this desk.</p>
            )}
            <p className="mt-3 text-[10px] leading-relaxed text-muted">
              Shown only inside the bank’s own desk. None of these fields enter the signed proof or the public explorer.
            </p>
          </Card>
        </div>
      </div>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
            <Ban size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold">Invalid-signature drill</p>
            <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-muted">
              The Cosmos co-operative desk carries one deliberately tampered seeded proof. Verify it to see the officer
              path fail closed — the prototype never claims the signature is valid.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setBankId('cosmos')
            setTab('history')
          }}
        >
          Open Cosmos proofs <ArrowUpRight size={13} />
        </Button>
      </Card>

      <Modal
        open={Boolean(selectedProof)}
        onClose={() => setSelectedProof(null)}
        title="Signed proof payload"
        description="Canonical JSON, signature and verification material. No personal or financial records are present."
        size="lg"
        footer={
          selectedProof ? (
            <>
              <Button variant="outline" size="sm" onClick={() => copy(JSON.stringify(selectedProof.payload, null, 2), 'Payload')}>
                <Copy size={13} /> Copy payload
              </Button>
              <Button
                size="sm"
                onClick={() => verify(selectedProof)}
                disabled={busy === `verify-${selectedProof.id}`}
              >
                {busy === `verify-${selectedProof.id}` ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                Re-verify
              </Button>
            </>
          ) : null
        }
      >
        {selectedProof && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {selectedProof.valid === false ? (
                <Badge tone="red"><XCircle size={11} /> Invalid signature</Badge>
              ) : (
                <Badge tone="olive"><CheckCircle2 size={11} /> Valid signature</Badge>
              )}
              <Badge tone="sand">{selectedProof.id}</Badge>
              {selectedProof.seeded && <SimBadge>Seeded proof</SimBadge>}
            </div>
            <div>
              <p className="label">Canonical payload</p>
              <pre className="mt-1.5 max-h-52 overflow-auto rounded-2xl bg-paper p-3.5 font-mono text-[10px] leading-relaxed text-ink/80">
                {JSON.stringify(selectedProof.payload, null, 2)}
              </pre>
            </div>
            <div>
              <p className="label">Signature (base64)</p>
              <pre className="mt-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-paper p-3.5 font-mono text-[10px] leading-relaxed text-ink/80">
                {selectedProof.signature}
              </pre>
            </div>
            <div>
              <p className="label">Public JWK</p>
              <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-paper p-3.5 font-mono text-[10px] leading-relaxed text-ink/80">
                {JSON.stringify(selectedProof.publicJwk, null, 2)}
              </pre>
            </div>
            {selectedProof.checkedAt && (
              <InlineNote tone={selectedProof.valid === false ? 'danger' : 'olive'} icon={selectedProof.valid === false ? ShieldAlert : ShieldCheck}>
                Last checked {formatDateTime(selectedProof.checkedAt)}. Verification recomputes the canonical payload and
                checks the ECDSA signature against the public key stored with this proof.
              </InlineNote>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        title="Rotate the demo signing key?"
        description="New proofs will use a new ECDSA P-256 key. Existing proofs keep the public key they were signed with, so they remain verifiable."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRotateOpen(false)}>Cancel</Button>
            <Button onClick={rotate} disabled={busy === 'rotate'}>
              {busy === 'rotate' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Rotate key
            </Button>
          </>
        }
      >
        <InlineNote tone="sand" icon={KeyRound}>
          This is a browser-held demo key, not an HSM-backed production key. Rotation is recorded in the audit log, and no
          past signature is rewritten.
        </InlineNote>
      </Modal>
    </div>
  )
}
