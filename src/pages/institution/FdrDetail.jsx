import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  Download,
  FileText,
  Fingerprint,
  Landmark,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  InlineNote,
  Progress,
  SimBadge,
  Stat,
  StatusPill,
} from '../../components/ui/primitives'
import ScoreDial from '../../components/fdr/ScoreDial'
import ExpertCards from '../../components/fdr/ExpertCards'
import DocumentViewer from '../../components/fdr/DocumentViewer'
import LedgerProof from '../../components/fdr/LedgerProof'
import { useStore } from '../../store/useStore'
import { toast } from '../../store/useToast'
import { BANKS, COLLEGES } from '../../data/seed'
import { evaluateReleaseRules, voiceRequired } from '../../lib/release'
import { downloadDataUri } from '../../lib/pdf'
import {
  daysBetween,
  downloadText,
  formatDate,
  formatDateTime,
  formatINR,
  pct,
  shortHash,
} from '../../lib/utils'
import { cn } from '../../lib/utils'

const TIMELINE_ICONS = {
  submitted: FileText,
  anchored: Fingerprint,
  release: LockKeyhole,
  key1: ShieldCheck,
  key2: BadgeCheck,
  done: CheckCircle2,
}

export default function FdrDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fdr = useStore((s) => s.fdrs.find((f) => f.id === id))
  const blocks = useStore((s) => s.blocks)
  const releaseRequests = useStore((s) => s.releaseRequests)
  const settings = useStore((s) => s.settings)
  const clockOffsetDays = useStore((s) => s.clockOffsetDays)
  const tamperedFdrId = useStore((s) => s.tamperedFdrId)
  const requestRelease = useStore((s) => s.requestRelease)
  const runReminders = useStore((s) => s.runReminders)
  const restoreTamper = useStore((s) => s.restoreTamper)
  const [busy, setBusy] = useState(false)

  const now = useMemo(() => new Date(Date.now() + clockOffsetDays * 86400000), [clockOffsetDays])

  const bank = BANKS.find((b) => b.id === fdr?.bankId)
  const college = COLLEGES.find((c) => c.id === fdr?.collegeId)
  const release = useMemo(
    () =>
      releaseRequests
        .filter((r) => r.fdrId === id)
        .sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)))[0],
    [releaseRequests, id],
  )

  const fdrBlocks = useMemo(
    () => blocks.filter((b) => b.fdrId === id).sort((a, b) => a.index - b.index),
    [blocks, id],
  )

  if (!fdr) {
    return (
      <EmptyState
        icon={FileText}
        title="Deposit not found"
        description="This FDR is not in the local demo store. It may have been removed by a reset, or the link may be from another scenario."
        action={
          <Button onClick={() => navigate('/app/institution')}>
            Back to deposits <ArrowRight size={14} />
          </Button>
        }
      />
    )
  }

  const days = daysBetween(now, fdr.maturityDate)
  const rules = evaluateReleaseRules({ fdr, college, settings, now, paused: settings.autoPause })
  const needsVoice = voiceRequired(fdr, settings)
  const sampled = fdr.samplings?.includes('human_sample')
  const doc = fdr.documents?.[0]
  const isTampered = tamperedFdrId === fdr.id
  const canRequest = fdr.status !== 'released' && fdr.status !== 'rejected' && !release

  const timeline = [
    {
      key: 'submitted',
      title: 'Submitted by the institution',
      at: fdr.createdAt,
      detail: `${fdr.source === 'aa' ? 'Account Aggregator sandbox' : 'Document upload'} · ${fdr.createdBy}`,
      done: true,
      icon: TIMELINE_ICONS.submitted,
    },
    {
      key: 'anchored',
      title: fdr.soulbound ? 'Fingerprint anchored on the ledger' : 'Awaiting acceptance',
      at: fdrBlocks.find((b) => b.type === 'FDR_REGISTERED')?.timestamp,
      detail: fdr.soulbound
        ? `Soulbound token ${fdr.tokenId} · trust ${fdr.trustScore}/100`
        : 'Only accepted records receive a soulbound token and chain anchor.',
      done: Boolean(fdr.soulbound),
      icon: TIMELINE_ICONS.anchored,
    },
    {
      key: 'release',
      title: release ? `Release ${release.status}` : canRequest ? 'No release requested' : 'Release not available',
      at: release?.requestedAt,
      detail: release ? `${release.id} · ${release.reason}` : 'A release can be requested after the maturity date.',
      done: Boolean(release),
      icon: TIMELINE_ICONS.release,
    },
    {
      key: 'key1',
      title: release?.key1 ? 'Key 1 · AI rules agent signed' : 'Key 1 not signed',
      at: release?.key1?.at,
      detail: release?.key1
        ? `${release.key1.rulesPassed?.length ?? 0} rules passed before signing.`
        : 'The AI key is refused if any release rule fails.',
      done: Boolean(release?.key1),
      icon: TIMELINE_ICONS.key1,
    },
    {
      key: 'key2',
      title: release?.voice?.verified ? 'Voice challenge complete' : needsVoice ? 'Voice challenge pending' : 'Voice not required',
      at: release?.voice?.at,
      detail: needsVoice
        ? `Additional factor for amounts at or above ${formatINR(settings.highValueVoiceThreshold, { compact: true })}. Never the only factor.`
        : 'Below the high-value threshold for an additional voice factor.',
      done: Boolean(release?.voice?.verified) || !needsVoice,
      icon: TIMELINE_ICONS.key2,
    },
    {
      key: 'done',
      title: release?.key2 ? 'Double lock complete' : 'Second key pending',
      at: release?.key2?.at,
      detail: release?.key2
        ? `${release.key2.actor} signed with ${release.key2.method}.`
        : 'Funds never move on a single signature.',
      done: Boolean(release?.key2),
      icon: TIMELINE_ICONS.done,
    },
  ]

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(String(value))
      toast(`${label} copied.`, { tone: 'success' })
    } catch {
      toast('Clipboard is unavailable in this browser.', { tone: 'warning' })
    }
  }

  const request = () => {
    if (release) {
      toast(`${release.id} already exists for ${fdr.id}.`, { tone: 'warning' })
      return
    }
    const reason = window.prompt(
      'Why is this deposit being released? (recorded in the audit log)',
      `Institution requested release for ${fdr.id}.`,
    )
    if (reason === null) return
    requestRelease(fdr.id, reason || `Institution requested release for ${fdr.id}.`)
  }

  const prepareRenewal = async () => {
    setBusy(true)
    try {
      await runReminders()
      const updated = useStore.getState().fdrs.find((f) => f.id === fdr.id)
      if (updated?.renewalDoc) {
        downloadDataUri(updated.renewalDoc, updated.renewalDocName || `Renewal_Draft_${fdr.id}.pdf`)
        toast('Renewal draft downloaded. It still needs institution confirmation and bank action.', { tone: 'success' })
      } else {
        toast(
          days > 60
            ? `The renewal window opens 60 days before maturity (${days} days remain).`
            : 'No draft generated yet. Move the scenario clock closer to maturity and try again.',
          { tone: 'warning' },
        )
      }
    } finally {
      setBusy(false)
    }
  }

  const exportRecord = () => {
    downloadText(
      JSON.stringify(
        {
          note: 'Illustrative demo export. Personal and financial data is included here because this is a local institution export, not the public ledger.',
          fdr,
          ledgerBlocks: fdrBlocks,
          release: release || null,
          rules,
        },
        null,
        2,
      ),
      `${fdr.id}-record.json`,
      'application/json',
    )
    toast('Record exported as JSON.', { tone: 'success' })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to="/app/institution" className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink">
            <ArrowLeft size={12} /> My deposits
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Eyebrow>Deposit record</Eyebrow>
            <span className="font-mono text-[11px] font-semibold text-muted">{fdr.id}</span>
            {sampled && <Badge tone="blue">Human sample</Badge>}
            {fdr.soulbound && (
              <Badge tone="ink">
                <Fingerprint size={11} /> Soulbound
              </Badge>
            )}
          </div>
          <h1 className="display mt-2 text-3xl sm:text-[40px]">
            {formatINR(fdr.amount, { compact: true })} <em className="serif-accent">security deposit.</em>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill status={fdr.status} />
            <span className="text-[12px] text-muted">
              {bank?.name} · {fdr.branch} · FDR {fdr.fdNumber}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportRecord}>
            <Download size={14} /> Export record
          </Button>
          {canRequest && (
            <Button onClick={request}>
              <LockKeyhole size={14} /> Request release
            </Button>
          )}
          {release && (
            <Button variant="outline" onClick={() => navigate('/app/officer/releases')}>
              Release queue <ArrowRight size={14} />
            </Button>
          )}
        </div>
      </div>

      {isTampered && (
        <div className="flex flex-col gap-3 rounded-2xl border border-danger/30 bg-danger/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
              <ShieldAlert size={17} />
            </span>
            <div>
              <p className="text-[12px] font-semibold text-danger">This off-chain record was edited by the tamper demo</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                The anchored fingerprint no longer matches. The ledger does not repair this silently.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={restoreTamper}>
            <RefreshCw size={13} /> Restore original
          </Button>
        </div>
      )}

      {(fdr.riskHold || fdr.grievance || fdr.fraudRing) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {fdr.riskHold && (
            <InlineNote tone="danger" icon={AlertTriangle}>
              <strong>Risk hold.</strong> {fdr.riskNote || 'An officer review holds this deposit.'}
            </InlineNote>
          )}
          {fdr.grievance && (
            <InlineNote tone="accent" icon={CircleAlert}>
              <strong>Open grievance.</strong> Release stays blocked until the grievance is closed.
            </InlineNote>
          )}
          {fdr.fraudRing && (
            <InlineNote tone="danger" icon={ShieldAlert}>
              <strong>Fraud-ring overlap.</strong> The signatory, branch and FD-number pattern appear in an open review cluster.
            </InlineNote>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Principal" value={formatINR(fdr.amount, { compact: true })} sub={`${fdr.interestRate}% p.a. · ${fdr.tenureYears} year tenure`} icon={Wallet} />
        <Stat
          label="Maturity"
          value={formatDate(fdr.maturityDate)}
          sub={days > 0 ? `${days} days remaining` : days === 0 ? 'matures today' : `matured ${Math.abs(days)} days ago`}
          icon={CalendarClock}
          tone={days <= 30 ? 'accent' : 'default'}
        />
        <Stat label="Trust score" value={`${fdr.trustScore}/100`} sub="probabilistic, not certainty" icon={Sparkles} tone="olive" />
        <Stat
          label="Lifecycle"
          value={fdr.status.replace('_', ' ')}
          sub={fdr.soulbound ? `Token ${fdr.tokenId}` : 'Not yet soulbound'}
          icon={Fingerprint}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Deposit facts</p>
                <p className="mt-1 text-sm font-semibold">What the institution declared</p>
              </div>
              <Badge tone={fdr.source === 'aa' ? 'blue' : 'sand'}>{fdr.source === 'aa' ? 'AA sandbox' : 'Document upload'}</Badge>
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-[12px] sm:grid-cols-2">
              {[
                ['Institution', `${college?.name || fdr.collegeId} (${college?.code || '—'})`],
                ['Bank / branch', `${bank?.name || fdr.bankId} · ${fdr.branch}`],
                ['FDR number', fdr.fdNumber],
                ['Authorised signatory', fdr.signatory],
                ['Issue date', formatDate(fdr.issueDate)],
                ['Maturity date', formatDate(fdr.maturityDate)],
                ['Interest rate', `${fdr.interestRate}% per annum`],
                ['Soulbound token', fdr.tokenId],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3 border-b border-line/60 pb-2.5 last:border-0">
                  <dt className="shrink-0 text-muted">{label}</dt>
                  <dd className="text-right font-semibold">{value || '—'}</dd>
                </div>
              ))}
            </dl>
            {fdr.notes && (
              <div className="mt-3 rounded-2xl bg-paper/60 p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Institution note</p>
                <p className="mt-1 text-[11px] leading-relaxed">{fdr.notes}</p>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Evidence</p>
                <p className="mt-1 text-sm font-semibold">Stored receipt and live re-check</p>
              </div>
              <SimBadge>In-browser forensics</SimBadge>
            </div>
            <DocumentViewer document={doc} fdr={fdr} className="mt-4" />
            {!doc && (
              <p className="mt-3 text-[10px] leading-relaxed text-muted">
                This record arrived through the Account Aggregator sandbox. There is no receipt image, so the Reader expert used consented
                data fields only.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Three expert opinions</p>
                <p className="mt-1 text-sm font-semibold">Each expert explains its own score</p>
              </div>
              <Badge tone={fdr.trustScore >= 98 ? 'olive' : fdr.trustScore >= 60 ? 'amber' : 'red'}>
                {fdr.trustScore >= 98 ? 'High confidence' : fdr.trustScore >= 60 ? 'Officer review' : 'Low confidence'}
              </Badge>
            </div>
            <ExpertCards experts={fdr.reasons} className="mt-4" />
            {fdr.diagnostics?.decision && (
              <div className="mt-4 rounded-2xl border border-line bg-paper/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-semibold">{fdr.diagnostics.decision.label || fdr.diagnostics.label}</p>
                  <SimBadge>Explainable result</SimBadge>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  {fdr.diagnostics.decision.explanation || fdr.diagnostics.explanation}
                </p>
              </div>
            )}
            <InlineNote className="mt-3" icon={AlertTriangle}>
              This is a probabilistic signal, not proof. An officer can always disagree, request a clearer copy or use the AA route.
            </InlineNote>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ScoreDial score={fdr.trustScore} size={124} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Decision path</p>
                <p className="mt-1 text-sm font-semibold">
                  {fdr.trustScore >= 98 ? 'Auto-accepted, with sampling' : fdr.trustScore >= 60 ? 'Human review required' : 'Rejected — clearer copy needed'}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  {sampled
                    ? 'A 10% random sample selected this clean record for a human spot-check.'
                    : fdr.trustScore >= 98
                      ? 'High-band results can be auto-accepted; a human review path remains open.'
                      : fdr.trustScore >= 60
                        ? 'Medium-band results go to the AICTE officer queue with the reasons attached.'
                        : 'Low-band results are saved but never anchored on the ledger.'}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-3 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-muted">Sampling rate</span>
                <span className="font-semibold">{settings.samplingRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">High / medium bands</span>
                <span className="font-semibold">{settings.highThreshold} / {settings.mediumThreshold}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Ledger blocks</span>
                <span className="font-semibold">{fdrBlocks.length}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Release timeline</p>
                <p className="mt-1 text-sm font-semibold">Two keys, never one</p>
              </div>
              <LockKeyhole size={16} className="text-accent" />
            </div>
            <ol className="mt-4 space-y-0">
              {timeline.map((item, index) => {
                const Icon = item.icon
                return (
                  <li key={item.key} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < timeline.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-16px)] w-px bg-line" aria-hidden />}
                    <span
                      className={cn(
                        'relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border',
                        item.done ? 'border-olive/25 bg-olive/10 text-olive' : 'border-line bg-paper text-muted',
                      )}
                    >
                      {item.done ? <Icon size={12} /> : <Clock3 size={12} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[11px] font-semibold leading-snug', !item.done && 'text-muted')}>{item.title}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{item.detail}</p>
                      {item.at && <p className="mt-0.5 font-mono text-[9px] text-muted/70">{formatDateTime(item.at)}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
              {release ? (
                <>
                  <Badge tone={release.status === 'released' ? 'olive' : 'amber'}>{release.status}</Badge>
                  <Badge tone="sand">{release.id}</Badge>
                  <Badge tone={needsVoice ? 'blue' : 'sand'}>{needsVoice ? 'voice required' : 'voice not required'}</Badge>
                </>
              ) : (
                <Badge tone="sand">No release request</Badge>
              )}
            </div>
            {release?.revert && (
              <InlineNote tone="danger" icon={X} className="mt-3">
                {release.revert.message}
              </InlineNote>
            )}
            {release?.status === 'released' && fdr.releaseCertificate && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => downloadDataUri(fdr.releaseCertificate, fdr.releaseCertificateName || `Release_Certificate_${fdr.id}.pdf`)}
              >
                <Download size={13} /> Release certificate
              </Button>
            )}
          </Card>

          <Card className="p-5">
            <LedgerProof fdr={fdr} />
          </Card>

          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Release readiness</p>
            <div className="mt-3 space-y-2">
              {rules.rules.map((rule) => (
                <div key={rule.key} className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full',
                      rule.pass ? 'bg-olive/10 text-olive' : 'bg-danger/10 text-danger',
                    )}
                  >
                    {rule.pass ? <Check size={9} /> : <X size={9} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold">{rule.label}</p>
                    <p className={cn('text-[9px] leading-relaxed', rule.pass ? 'text-muted' : 'text-danger')}>{rule.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
              <Button size="sm" variant="outline" onClick={prepareRenewal} disabled={busy}>
                {busy ? <RefreshCw size={13} className="animate-spin" /> : <FileText size={13} />}
                {busy ? 'Preparing…' : 'Prepare renewal draft'}
              </Button>
              {fdr.renewalDoc && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadDataUri(fdr.renewalDoc, fdr.renewalDocName || `Renewal_Draft_${fdr.id}.pdf`)}
                >
                  <Download size={13} /> Renewal PDF
                </Button>
              )}
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[9px] leading-relaxed text-muted">
              <Landmark size={10} className="mt-0.5 shrink-0" />
              {canRequest
                ? 'Release requests are visible to the AICTE officer. Key 1 is signed only when every rule passes.'
                : release
                  ? 'This deposit already has a release record. Open the officer queue to move it forward.'
                  : 'Rejected and released records cannot start a new release request.'}
            </p>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => copy(fdr.id, 'FDR ID')}>
              <Copy size={12} /> Copy ID
            </Button>
            <Link to={`/explorer?q=${fdr.id}`} className="btn-ghost btn-sm">
              <Banknote size={12} /> Public explorer
            </Link>
          </div>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[10px] font-semibold text-muted">
            <ShieldCheck size={12} /> Illustrative demo record · fingerprint {shortHash(fdrBlocks.find((b) => b.type === 'FDR_REGISTERED')?.fingerprint || '', 12)}
          </p>
          <p className="text-[10px] text-muted">
            Completeness <span className="font-semibold text-ink">{pct(fdrBlocks.length, 4)}%</span> of the expected audit trail
          </p>
        </div>
        <Progress className="mt-2" value={Math.min(100, fdrBlocks.length * 25)} label="Audit trail completeness" />
      </Card>
    </div>
  )
}
