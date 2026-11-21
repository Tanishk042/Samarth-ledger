import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Check,
  Copy,
  Fingerprint,
  Link2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { Badge, Button, InlineNote } from '../ui/primitives'
import { useStore } from '../../store/useStore'
import { fingerprintFdr } from '../../lib/hash'
import { verifyChain } from '../../lib/ledger'
import { formatDateTime } from '../../lib/utils'
import { toast } from '../../store/useToast'

/**
 * Shows the fingerprint that is actually anchored for this FDR and lets a judge
 * recompute it. A tamper demo edits the off-chain record, so the recomputation
 * visibly disagrees with the anchored value.
 */
export default function LedgerProof({ fdr, className }) {
  const blocks = useStore((s) => s.blocks)
  const fdrs = useStore((s) => s.fdrs)
  const [current, setCurrent] = useState(null)
  const [check, setCheck] = useState(null)
  const [busy, setBusy] = useState(false)

  const mine = useMemo(
    () => blocks.filter((b) => b.fdrId === fdr?.id).sort((a, b) => a.index - b.index),
    [blocks, fdr?.id],
  )
  const registered = mine.find((b) => b.type === 'FDR_REGISTERED')
  const latest = mine[mine.length - 1]

  useEffect(() => {
    let alive = true
    if (!fdr) return undefined
    fingerprintFdr(fdr).then((value) => {
      if (alive) setCurrent(value)
    })
    setCheck(null)
    return () => {
      alive = false
    }
  }, [fdr])

  const runCheck = async () => {
    if (!fdr) return
    setBusy(true)
    try {
      const fingerprint = await fingerprintFdr(fdr)
      const chain = await verifyChain(fdrs, blocks)
      setCurrent(fingerprint)
      setCheck({ fingerprint, chain })
      const localMismatch = registered && registered.fingerprint !== fingerprint
      toast(
        localMismatch
          ? 'Fingerprint mismatch — this record was edited without re-anchoring.'
          : chain.ok
            ? 'Chain and record fingerprint verified.'
            : `${chain.issues.length} chain issue(s) found.`,
        { tone: localMismatch || !chain.ok ? 'danger' : 'success' },
      )
    } finally {
      setBusy(false)
    }
  }

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value)
      toast(`${label} copied.`, { tone: 'success' })
    } catch {
      toast('Clipboard is unavailable in this browser.', { tone: 'warning' })
    }
  }

  const mismatch = Boolean(registered && current && registered.fingerprint !== current)

  return (
    <div className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Ledger proof</p>
          <p className="mt-1 text-sm font-semibold">Fingerprint and append-only block</p>
        </div>
        {registered ? (
          <Badge tone={mismatch ? 'red' : 'olive'}>
            {mismatch ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
            {mismatch ? 'Mismatch' : 'Anchored'}
          </Badge>
        ) : (
          <Badge tone="sand">Not anchored</Badge>
        )}
      </div>

      {!registered ? (
        <InlineNote className="mt-3" icon={Fingerprint}>
          This record is not anchored. {fdr?.status === 'rejected' ? 'Low-confidence records stay off the ledger.' : 'Pending records are anchored after acceptance.'}
        </InlineNote>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            <HashRow label="Anchored fingerprint" value={registered.fingerprint} onCopy={() => copy(registered.fingerprint, 'Fingerprint')} />
            <HashRow
              label="Recomputed now"
              value={current || '…'}
              tone={mismatch ? 'danger' : 'olive'}
              onCopy={current ? () => copy(current, 'Fingerprint') : undefined}
            />
            <HashRow label="Latest block hash" value={latest?.hash} onCopy={() => copy(latest?.hash, 'Block hash')} />
            <HashRow label="Previous hash" value={latest?.prevHash} onCopy={() => copy(latest?.prevHash, 'Previous hash')} />
            {latest?.docHash && (
              <HashRow label="Document hash" value={latest.docHash} onCopy={() => copy(latest.docHash, 'Document hash')} />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
            <span className="flex items-center gap-1"><Link2 size={10} /> {mine.length} block(s) for this FDR</span>
            <span>·</span>
            <span>{latest?.type}</span>
            <span>·</span>
            <span className="font-mono">{formatDateTime(latest?.timestamp)}</span>
          </div>

          {mismatch && (
            <InlineNote tone="danger" icon={ShieldAlert} className="mt-3">
              The off-chain amount or identity no longer matches the anchored fingerprint. The ledger does not repair this silently — an
              officer must investigate and re-anchor with an audit trail.
            </InlineNote>
          )}
          {check && !mismatch && (
            <InlineNote tone={check.chain.ok ? 'olive' : 'danger'} icon={check.chain.ok ? Check : ShieldAlert} className="mt-3">
              {check.chain.ok
                ? `Chain intact: ${check.chain.checkedBlocks} blocks and ${check.chain.checkedRecords} anchored records verified.`
                : `${check.chain.issues.length} issue(s) found across ${check.chain.checkedBlocks} blocks. Open the explorer for detail.`}
            </InlineNote>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={runCheck} disabled={busy}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
              {busy ? 'Verifying…' : 'Verify integrity'}
            </Button>
            <Link to={`/explorer?q=${fdr.id}`} className="btn-ghost btn-sm">
              Public explorer <ArrowUpRight size={13} />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

function HashRow({ label, value, tone, onCopy }) {
  return (
    <div className="rounded-xl border border-line bg-paper/50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
        {onCopy && (
          <button type="button" onClick={onCopy} className="text-muted transition hover:text-ink" aria-label={`Copy ${label}`}>
            <Copy size={11} />
          </button>
        )}
      </div>
      <p
        className={`mt-1 break-all font-mono text-[9px] leading-relaxed ${
          tone === 'danger' ? 'text-danger' : tone === 'olive' ? 'text-olive' : 'text-ink/80'
        }`}
      >
        {value || '—'}
      </p>
    </div>
  )
}
