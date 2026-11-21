import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  FileSearch,
  Fingerprint,
  Landmark,
  LockKeyhole,
  MessageSquareWarning,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  Field,
  InlineNote,
  SimBadge,
  StatusPill,
  Textarea,
} from '../../components/ui/primitives'
import ScoreDial from '../../components/fdr/ScoreDial'
import ExpertCards from '../../components/fdr/ExpertCards'
import DocumentViewer from '../../components/fdr/DocumentViewer'
import LedgerProof from '../../components/fdr/LedgerProof'
import { useStore } from '../../store/useStore'
import { toast } from '../../store/useToast'
import { BANKS, COLLEGES } from '../../data/seed'
import { SAMPLE_FIXTURES } from '../../lib/samples'
import {
  daysBetween,
  formatDate,
  formatDateTime,
  formatINR,
  shortHash,
} from '../../lib/utils'

const SAMPLE_KINDS = new Set(['genuine', 'edited', 'blurry'])

export default function OfficerReview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fdrs = useStore((s) => s.fdrs)
  const blocks = useStore((s) => s.blocks)
  const audit = useStore((s) => s.audit)
  const releaseRequests = useStore((s) => s.releaseRequests)
  const reviewFdr = useStore((s) => s.reviewFdr)
  const requestReplacementFdr = useStore((s) => s.requestReplacementFdr)
  const clockOffsetDays = useStore((s) => s.clockOffsetDays)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [decided, setDecided] = useState(null)

  const fdr = fdrs.find((f) => f.id === id)
  const now = useMemo(() => new Date(Date.now() + clockOffsetDays * 86400000), [clockOffsetDays])

  const queue = useMemo(
    () =>
      fdrs
        .filter((f) => ['under_review', 'rejected'].includes(f.status))
        .sort((a, b) => (a.trustScore || 0) - (b.trustScore || 0)),
    [fdrs],
  )

  if (!fdr) {
    return (
      <EmptyState
        icon={FileSearch}
        title="Review item not found"
        description="This record is not in the local demo store. Return to the officer overview and pick an item from the queue."
        action={
          <Button onClick={() => navigate('/app/officer')}>
            Back to the queue <ArrowRight size={14} />
          </Button>
        }
      />
    )
  }

  const bank = BANKS.find((b) => b.id === fdr.bankId)
  const college = COLLEGES.find((c) => c.id === fdr.collegeId)
  const doc = fdr.documents?.[0]
  const sample = doc?.kind && SAMPLE_KINDS.has(doc.kind) ? SAMPLE_FIXTURES[doc.kind] : null
  const currentIndex = queue.findIndex((f) => f.id === fdr.id)
  const nextId = queue.length > 1 ? queue[(currentIndex + 1) % queue.length]?.id : null
  const fdrBlocks = blocks.filter((b) => b.fdrId === fdr.id)
  const recordAudit = audit.filter((a) => a.target === fdr.id).slice(0, 6)
  const release = releaseRequests.find((r) => r.fdrId === fdr.id)
  const days = daysBetween(now, fdr.maturityDate)
  const canDecide = !['released', 'pending_sync'].includes(fdr.status)
  const comparison = fdr.diagnostics?.comparison || null
  const weak = Object.entries(fdr.reasons || {})
    .map(([key, value]) => ({ key, score: value?.score ?? 0 }))
    .sort((a, b) => a.score - b.score)[0]

  const act = async (decision) => {
    if (busy) return
    setBusy(true)
    try {
      const result = await reviewFdr(fdr.id, decision, note.trim())
      if (result?.ok) {
        setDecided({
          decision,
          nextId,
          message:
            decision === 'approve'
              ? `${fdr.id} approved. A soulbound fingerprint is now anchored.`
              : decision === 'reject'
                ? `${fdr.id} rejected. Nothing was anchored.`
                : `${fdr.id} returned to the institution for a clearer copy.`,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(String(value))
      toast(`${label} copied.`, { tone: 'success' })
    } catch {
      toast('Clipboard is unavailable in this browser.', { tone: 'warning' })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to="/app/officer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink">
            <ArrowLeft size={12} /> Officer overview
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Eyebrow>Human review</Eyebrow>
            <span className="font-mono text-[11px] font-semibold text-muted">{fdr.id}</span>
            {fdr.fraudRing && <Badge tone="red">fraud-ring overlap</Badge>}
            {fdr.riskHold && <Badge tone="red">risk hold</Badge>}
            {fdr.grievance && <Badge tone="amber">open grievance</Badge>}
          </div>
          <h1 className="display mt-2 text-3xl sm:text-[40px]">
            Decide with <em className="serif-accent">the reasons in view.</em>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            {formatINR(fdr.amount)} · {bank?.name} · {college?.code} · submitted {formatDate(fdr.createdAt)} by {fdr.createdBy}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentIndex >= 0 && queue.length > 1 && (
            <Button variant="outline" onClick={() => navigate(`/app/officer/review/${nextId}`)}>
              <ArrowRight size={14} /> Next in queue
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate('/app/officer')}>
            Queue · {queue.length}
          </Button>
        </div>
      </div>

      {decided && (
        <div className="rounded-2xl border border-olive/30 bg-olive/[0.06] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[12px] font-semibold text-olive">
              <CheckCircle2 size={16} /> {decided.message}
            </p>
            <div className="flex flex-wrap gap-2">
              {decided.nextId && (
                <Button size="sm" onClick={() => navigate(`/app/officer/review/${decided.nextId}`)}>
                  Review next <ArrowRight size={13} />
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => navigate('/app/officer')}>
                Back to queue
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Evidence packet</p>
                <p className="mt-1 text-sm font-semibold">{doc?.name || 'Account Aggregator data fields'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={fdr.source === 'aa' ? 'blue' : 'sand'}>{fdr.source === 'aa' ? 'AA sandbox' : 'Upload'}</Badge>
                {sample && <SimBadge>{sample.label} fixture</SimBadge>}
              </div>
            </div>
            <DocumentViewer document={doc} fdr={fdr} className="mt-4" />
            {sample && (
              <InlineNote tone="accent" icon={ScanSearch} className="mt-3">
                This is the built-in <strong>{sample.label.toLowerCase()}</strong> fixture. Run the forensic re-check to inspect its ELA
                heat-map, focus score and metadata tag in this browser. Expected demo outcome: <strong>{sample.expected}</strong>.
              </InlineNote>
            )}
            {doc?.metadata?.software && (
              <InlineNote tone="danger" icon={AlertTriangle} className="mt-2">
                Stored metadata reports the software tag <span className="font-mono">{doc.metadata.software}</span>.
              </InlineNote>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {doc?.hash && (
                <Button size="sm" variant="ghost" onClick={() => copy(doc.hash, 'Document hash')}>
                  <Copy size={12} /> Copy doc hash
                </Button>
              )}
              <Link to={`/app/institution/fdr/${fdr.id}`} className="btn-ghost btn-sm">
                Full record <ArrowRight size={12} />
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Field comparison</p>
                <p className="mt-1 text-sm font-semibold">Declared values and machine-read evidence</p>
              </div>
              {comparison ? (
                <Badge tone={comparison.amountMismatch || comparison.patternMismatch ? 'red' : 'olive'}>
                  {comparison.fieldsMatched}/{comparison.fieldsChecked} fields match
                </Badge>
              ) : (
                <SimBadge>Seeded reasons</SimBadge>
              )}
            </div>

            {comparison ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="table-head py-2 pr-3">Field</th>
                      <th className="table-head py-2 pr-3">Declared</th>
                      <th className="table-head py-2 pr-3">Observed</th>
                      <th className="table-head py-2 text-right">Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(comparison.rows || []).map((row) => (
                      <tr key={row.field} className="border-b border-line/60">
                        <td className="py-2 pr-3 font-semibold">{row.field}</td>
                        <td className="py-2 pr-3 text-muted">{row.declared ?? '—'}</td>
                        <td className="py-2 pr-3 text-muted">{row.observed ?? '—'}</td>
                        <td className="py-2 text-right">
                          <Badge tone={row.match ? 'olive' : 'red'}>{row.match ? 'match' : 'differs'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ['FDR number', fdr.fdNumber],
                  ['Principal', formatINR(fdr.amount)],
                  ['Issued', formatDate(fdr.issueDate)],
                  ['Matures', formatDate(fdr.maturityDate)],
                  ['Signatory', fdr.signatory],
                  ['Branch', fdr.branch],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-line bg-paper/40 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
                    <p className="mt-0.5 text-[11px] font-semibold">{value || '—'}</p>
                  </div>
                ))}
              </div>
            )}

            {fdr.diagnostics?.readerEngine && (
              <p className="mt-3 text-[10px] text-muted">
                Reader engine: <span className="font-semibold text-ink">{fdr.diagnostics.readerEngine}</span>
              </p>
            )}
            {!comparison && (
              <InlineNote className="mt-3" icon={FileSearch}>
                Seeded records carry their expert reasons, not a stored field-by-field OCR table. Run the live document re-check above to
                inspect the underlying image signals yourself.
              </InlineNote>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Explainable scores</p>
                <p className="mt-1 text-sm font-semibold">Eye, Reader and Memory, with reasons</p>
              </div>
              {weak && <Badge tone={weak.score < 60 ? 'red' : weak.score < 90 ? 'amber' : 'olive'}>weakest · {weak.key}</Badge>}
            </div>
            <ExpertCards experts={fdr.reasons} className="mt-4" />
            {fdr.diagnostics?.caveats?.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line pt-3">
                {fdr.diagnostics.caveats.map((caveat) => (
                  <li key={caveat} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
                    <CircleAlert size={10} className="mt-0.5 shrink-0 text-accent" /> {caveat}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ScoreDial score={fdr.trustScore} size={122} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Current trust signal</p>
                <p className="mt-1 text-sm font-semibold">
                  {fdr.trustScore >= 98 ? 'High band' : fdr.trustScore >= 60 ? 'Medium band — your decision' : 'Low band — reject or re-upload'}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  The score is a weighted signal, never proof. Your signed decision is recorded in the audit log.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusPill status={fdr.status} />
                  {fdr.samplings?.includes('human_sample') && <Badge tone="blue">sampled</Badge>}
                </div>
              </div>
            </div>
          </Card>

          {canDecide ? (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Record a decision</p>
                  <p className="mt-1 text-sm font-semibold">A human signature, not an AI one</p>
                </div>
                <UserCheck size={16} className="text-olive" />
              </div>
              <Field label="Decision note" hint="Stored with your name and timestamp in the audit trail." className="mt-4">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    fdr.trustScore < 60
                      ? 'e.g. ELA cluster and amount mismatch confirmed. Request the original receipt from the bank.'
                      : 'e.g. Verified against the original held by the accounts office.'
                  }
                  className="min-h-[86px]"
                />
              </Field>
              <div className="mt-3 grid gap-2">
                <Button onClick={() => act('approve')} disabled={busy || fdr.status === 'verified'}>
                  <CheckCircle2 size={14} /> {fdr.status === 'verified' ? 'Already approved' : 'Approve & anchor fingerprint'}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => act('reupload')} disabled={busy}>
                    <RefreshCw size={13} /> Ask for a copy
                  </Button>
                  <Button variant="danger" onClick={() => act('reject')} disabled={busy || fdr.status === 'rejected'}>
                    <XCircle size={13} /> {fdr.status === 'rejected' ? 'Rejected' : 'Reject'}
                  </Button>
                </div>
              </div>
              <InlineNote className="mt-3" icon={ShieldCheck}>
                Approving anchors a fingerprint, not the document. Rejecting never writes the record to the ledger.
              </InlineNote>
            </Card>
          ) : (
            <Card className="p-5">
              <InlineNote tone="olive" icon={LockKeyhole}>
                This record is <strong>{fdr.status.replace('_', ' ')}</strong>. Review decisions are closed. Use the release queue for the
                double-lock workflow.
              </InlineNote>
              <Button className="mt-3" variant="outline" onClick={() => navigate('/app/officer/releases')}>
                <LockKeyhole size={14} /> Open release approvals
              </Button>
            </Card>
          )}

          {(fdr.riskHold || fdr.grievance || fdr.fraudRing) && (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Risk context</p>
                  <p className="mt-1 text-sm font-semibold">Why this record was flagged</p>
                </div>
                <ShieldAlert size={16} className="text-danger" />
              </div>
              <ul className="mt-3 space-y-2">
                {fdr.riskHold && (
                  <li className="rounded-xl border border-danger/20 bg-danger/[0.04] p-2.5 text-[10px] leading-relaxed">
                    <strong className="block text-danger">Risk hold</strong>
                    {fdr.riskNote || 'A risk hold is active on this deposit.'}
                  </li>
                )}
                {fdr.grievance && (
                  <li className="rounded-xl border border-amber-600/20 bg-amber-500/[0.06] p-2.5 text-[10px] leading-relaxed">
                    <strong className="block text-amber-700 dark:text-amber-300">Open grievance</strong>
                    The institution has an open grievance linked to a related deposit. Release rules will fail.
                  </li>
                )}
                {fdr.fraudRing && (
                  <li className="rounded-xl border border-danger/20 bg-danger/[0.04] p-2.5 text-[10px] leading-relaxed">
                    <strong className="block text-danger">Fraud-ring overlap</strong>
                    Signatory {fdr.signatory} and the Andheri West branch appear across unrelated institutions.
                  </li>
                )}
              </ul>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => requestReplacementFdr(fdr.id, `Replacement requested from review after risk flag on ${fdr.id}.`)}
                >
                  <MessageSquareWarning size={13} /> Request replacement
                </Button>
                {release && (
                  <Button size="sm" variant="ghost" onClick={() => navigate('/app/officer/releases')}>
                    Release record <ArrowRight size={12} />
                  </Button>
                )}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <LedgerProof fdr={fdr} />
          </Card>

          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Record trail</p>
            <ul className="mt-3 space-y-2.5">
              <li className="flex items-start gap-2">
                <Clock3 size={12} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  <p className="text-[10px] font-semibold">Submitted</p>
                  <p className="text-[9px] text-muted">{formatDateTime(fdr.createdAt)} · {fdr.createdBy}</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Fingerprint size={12} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  <p className="text-[10px] font-semibold">{fdrBlocks.length} ledger block(s)</p>
                  <p className="text-[9px] text-muted">
                    {fdrBlocks.length ? `Head ${shortHash(fdrBlocks[fdrBlocks.length - 1].hash, 12)}` : 'Not anchored yet'}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <LockKeyhole size={12} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  <p className="text-[10px] font-semibold">{release ? `${release.id} · ${release.status}` : 'No release request'}</p>
                  <p className="text-[9px] text-muted">
                    {release ? `${release.key1 ? 'Key 1 signed' : 'Key 1 pending'} · ${release.key2 ? 'Key 2 signed' : 'Key 2 pending'}` : 'Release requires maturity and both keys.'}
                  </p>
                </div>
              </li>
              {recordAudit.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <Check size={12} className="mt-0.5 shrink-0 text-olive" />
                  <div>
                    <p className="text-[10px] font-semibold">{item.action.replaceAll('_', ' ')}</p>
                    <p className="line-clamp-2 text-[9px] text-muted">{item.detail} · {formatDateTime(item.at)}</p>
                  </div>
                </li>
              ))}
              <li className="flex items-start gap-2">
                <Landmark size={12} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  <p className="text-[10px] font-semibold">{college?.name}</p>
                  <p className="text-[9px] text-muted">Compliance {college?.compliance}/100 · {days > 0 ? `${days} days to maturity` : `matured ${Math.abs(days)}d ago`}</p>
                </div>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface/60 p-4">
        <p className="flex items-center gap-2 text-[10px] text-muted">
          <BadgeCheck size={12} className="text-olive" /> Reviewer: A. K. Sharma · AICTE Finance &amp; Compliance
        </p>
        <p className="flex items-center gap-1.5 text-[10px] text-muted">
          <X size={11} /> The AI never makes the final decision.
        </p>
      </div>
    </div>
  )
}
