import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  Fingerprint,
  KeyRound,
  Landmark,
  Loader2,
  LockKeyhole,
  Mic,
  MicOff,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Unlock,
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
  Input,
  Modal,
  Progress,
  SimBadge,
  Stat,
  StatusPill,
  Tabs,
  Textarea,
} from '../../components/ui/primitives'
import { useStore } from '../../store/useStore'
import { toast } from '../../store/useToast'
import { BANKS, COLLEGES } from '../../data/seed'
import { evaluateReleaseRules, REVERT, voiceRequired } from '../../lib/release'
import { downloadDataUri } from '../../lib/pdf'
import { cn, formatDate, formatDateTime, formatINR, shortHash } from '../../lib/utils'

const FILTERS = [
  { value: 'pending', label: 'Awaiting signatures' },
  { value: 'released', label: 'Released' },
  { value: 'all', label: 'All requests' },
]

function b64url(bytes) {
  let binary = ''
  const view = new Uint8Array(bytes)
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i])
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function randomChallenge() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytes
}

/**
 * Best-effort WebAuthn ceremony. Public-key credentials require a secure
 * context and a platform authenticator; anything unavailable falls back to a
 * clearly labelled demo signature so the flow is never a dead end.
 */
async function tryPasskey({ person, email }) {
  if (!window.PublicKeyCredential || !navigator.credentials?.create) {
    return { ok: false, reason: 'This browser does not expose WebAuthn.' }
  }
  try {
    if (window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      if (!available) return { ok: false, reason: 'No platform authenticator (Touch ID / Windows Hello) is available.' }
    }
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: 'Samarth Ledger (demo)', id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(email || person || 'officer'),
          name: email || 'officer@aicte.gov.in',
          displayName: person || 'AICTE officer',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 45000,
        attestation: 'none',
      },
    })
    if (!credential) return { ok: false, reason: 'The passkey ceremony returned no credential.' }
    return {
      ok: true,
      credentialId: b64url(credential.rawId),
      method: 'webauthn',
      label: 'WebAuthn platform passkey',
    }
  } catch (error) {
    return { ok: false, reason: error?.message || 'The passkey ceremony was cancelled.' }
  }
}

function RulesMatrix({ rules, compact = false }) {
  if (!rules?.length) {
    return <p className="text-[11px] text-muted">Select a request to evaluate the release rules.</p>
  }
  const passed = rules.filter((r) => r.pass).length
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Deterministic rules</p>
        <Badge tone={passed === rules.length ? 'olive' : 'red'}>
          {passed}/{rules.length} pass
        </Badge>
      </div>
      <Progress value={(passed / rules.length) * 100} tone={passed === rules.length ? 'olive' : 'danger'} className="mt-2" label="Rules passed" />
      <ul className={cn('mt-3 divide-y divide-line/70', compact && 'text-[10px]')}>
        {rules.map((rule) => (
          <li key={rule.key} className="flex items-start gap-2.5 py-2">
            {rule.pass ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-olive" aria-label="pass" />
            ) : (
              <XCircle size={14} className="mt-0.5 shrink-0 text-danger" aria-label="fail" />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn('text-[11px] font-semibold', !rule.pass && 'text-danger')}>{rule.label}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{rule.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Releases() {
  const fdrs = useStore((s) => s.fdrs)
  const releaseRequests = useStore((s) => s.releaseRequests)
  const settings = useStore((s) => s.settings)
  const clockOffsetDays = useStore((s) => s.clockOffsetDays)
  const user = useStore((s) => s.user)
  const audit = useStore((s) => s.audit)
  const blocks = useStore((s) => s.blocks)
  const signKey1 = useStore((s) => s.signKey1)
  const signKey2 = useStore((s) => s.signKey2)
  const recordVoice = useStore((s) => s.recordVoice)
  const attemptRelease = useStore((s) => s.attemptRelease)
  const requestRelease = useStore((s) => s.requestRelease)
  const [filter, setFilter] = useState('pending')
  const [selectedId, setSelectedId] = useState(releaseRequests[0]?.id || null)
  const [busy, setBusy] = useState('')
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voicePhrase, setVoicePhrase] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [note, setNote] = useState('')
  const [passkeyNote, setPasskeyNote] = useState('')
  const [newFdrId, setNewFdrId] = useState('')
  const recognitionRef = useRef(null)

  const now = useMemo(() => new Date(Date.now() + clockOffsetDays * 86400000), [clockOffsetDays])

  const list = useMemo(() => {
    const items = filter === 'all' ? releaseRequests : releaseRequests.filter((r) => r.status === filter)
    return [...items].sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)))
  }, [releaseRequests, filter])

  useEffect(() => {
    if (!list.some((r) => r.id === selectedId)) setSelectedId(list[0]?.id || null)
  }, [list, selectedId])

  useEffect(() => {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition
    setVoiceSupported(Boolean(Rec))
    return () => {
      try {
        recognitionRef.current?.stop?.()
      } catch {
        // no-op
      }
    }
  }, [])

  const selected = releaseRequests.find((r) => r.id === selectedId) || null
  const fdr = selected ? fdrs.find((f) => f.id === selected.fdrId) : null
  const bank = fdr ? BANKS.find((b) => b.id === fdr.bankId) : null
  const college = fdr ? COLLEGES.find((c) => c.id === fdr.collegeId) : null
  const evaluation = useMemo(
    () =>
      fdr
        ? evaluateReleaseRules({ fdr, college, settings, now, paused: settings.autoPause })
        : { rules: [], allPass: false },
    [fdr, college, settings, now],
  )
  const needsVoice = Boolean(fdr && voiceRequired(fdr, settings))

  const stats = useMemo(() => {
    const pending = releaseRequests.filter((r) => r.status === 'pending')
    return {
      pending: pending.length,
      key1: pending.filter((r) => r.key1).length,
      released: releaseRequests.filter((r) => r.status === 'released').length,
      value: pending.reduce((acc, r) => acc + (fdrs.find((f) => f.id === r.fdrId)?.amount || 0), 0),
    }
  }, [releaseRequests, fdrs])

  const releaseTargets = useMemo(
    () =>
      fdrs
        .filter((f) => ['verified', 'renewal_due'].includes(f.status))
        .filter((f) => !releaseRequests.some((r) => r.fdrId === f.id && r.status === 'pending'))
        .sort((a, b) => String(a.maturityDate).localeCompare(String(b.maturityDate)))
        .slice(0, 12),
    [fdrs, releaseRequests],
  )

  const doKey1 = async () => {
    if (!selected || busy) return
    setBusy('key1')
    const result = await signKey1(selected.id)
    setBusy('')
    if (result?.ok) toast('Key 1 signed. The officer key can now be applied.', { tone: 'success' })
    else toast(result?.message || 'Key 1 refused by the rules engine.', { tone: 'danger' })
  }

  const doPasskey = async () => {
    if (!selected || busy) return
    setPasskeyNote('')
    setBusy('passkey')
    const result = await tryPasskey({ person: user?.person, email: user?.email })
    if (result.ok) {
      const signed = await signKey2(selected.id, {
        method: result.method,
        credentialId: result.credentialId,
        label: result.label,
      })
      setBusy('')
      if (!signed.ok) toast(signed.message || 'Officer key refused.', { tone: 'danger' })
      return
    }
    setBusy('')
    setPasskeyNote(result.reason)
    toast(`${result.reason} Use the labelled demo signature to continue.`, { tone: 'warning' })
  }

  const doSimulatedKey2 = async () => {
    if (!selected || busy) return
    setBusy('simulated')
    const result = await signKey2(selected.id, {
      method: 'simulated',
      credentialId: `demo-${Date.now().toString(36)}`,
      label: 'Simulated demo signature',
    })
    setBusy('')
    if (!result.ok) toast(result.message || 'Officer key refused.', { tone: 'danger' })
  }

  const startVoice = () => {
    setVoiceError('')
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Rec) {
      setVoiceError('Speech recognition is unavailable in this browser. Type the phrase to run the labelled simulation.')
      return
    }
    try {
      const recognition = new Rec()
      recognition.lang = 'en-IN'
      recognition.interimResults = true
      recognition.continuous = false
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join(' ')
        setVoicePhrase(transcript)
      }
      recognition.onerror = (event) => {
        setVoiceError(
          event.error === 'not-allowed'
            ? 'Microphone permission was denied. Type the phrase instead.'
            : `Speech recognition stopped (${event.error}). Type the phrase instead.`,
        )
        setListening(false)
      }
      recognition.onend = () => setListening(false)
      recognitionRef.current = recognition
      recognition.start()
      setListening(true)
    } catch (error) {
      setVoiceError(error?.message || 'Could not start the microphone.')
      setListening(false)
    }
  }

  const stopVoice = () => {
    try {
      recognitionRef.current?.stop?.()
    } catch {
      // no-op
    }
    setListening(false)
  }

  const confirmVoice = () => {
    if (!selected) return
    const expected = `release ${selected.fdrId.replaceAll('-', ' ')}`
    const spoken = voicePhrase.trim().toLowerCase()
    const matches = spoken.includes('release') && (spoken.includes('confirm') || spoken.includes(fdr?.fdNumber?.toLowerCase() || ''))
    if (!spoken) {
      setVoiceError('Speak or type the challenge phrase first.')
      return
    }
    if (!matches) {
      recordVoice(selected.id, { verified: false, method: voiceSupported ? 'speech' : 'typed', phrase: voicePhrase.trim() })
      setVoiceError(`The phrase did not match. Say or type: “Confirm release ${selected.fdrId}”.`)
      return
    }
    recordVoice(selected.id, {
      verified: true,
      method: voiceSupported && listening === false && spoken ? 'speech' : 'typed',
      phrase: voicePhrase.trim(),
    })
    setVoiceOpen(false)
    setVoicePhrase('')
    setVoiceError('')
    toast('Voice factor verified. It is an additional check, never the only factor.', { tone: 'success' })
    void expected
  }

  const doAttempt = () => {
    if (!selected) return
    attemptRelease(selected.id)
  }

  const downloadCertificate = () => {
    if (!fdr?.releaseCertificate) {
      toast('No certificate is available for this record yet.', { tone: 'warning' })
      return
    }
    downloadDataUri(fdr.releaseCertificate, fdr.releaseCertificateName || `Release_Certificate_${fdr.id}.pdf`)
    toast('Release certificate downloaded.', { tone: 'success' })
  }

  const createRequest = () => {
    if (!newFdrId) {
      toast('Choose a deposit to place in the release queue.', { tone: 'warning' })
      return
    }
    requestRelease(newFdrId, note.trim() || 'Release requested from the officer release desk.')
    setNewFdrId('')
    setNote('')
    setFilter('pending')
  }

  const relatedAudit = selected ? audit.filter((a) => a.target === selected.fdrId || a.target === selected.id).slice(0, 5) : []
  const releaseBlocks = selected ? blocks.filter((b) => b.fdrId === selected.fdrId && ['AI_SIGNED', 'RELEASED'].includes(b.type)) : []

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Double-lock release desk</Eyebrow>
            <SimBadge>Policy simulation</SimBadge>
          </div>
          <h1 className="display mt-2 text-3xl sm:text-[40px]">
            Two keys. <em className="serif-accent">No shortcuts.</em>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            The AI release agent signs only when every deterministic rule passes. An AICTE officer holds the second key.
            High-value releases add a voice factor, and the contract reverts loudly when either key is missing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setFilter('all')} className="hidden sm:inline-flex">
            <ScrollText size={14} /> All requests
          </Button>
          <Button onClick={() => setFilter('pending')}>
            <LockKeyhole size={14} /> Pending · {stats.pending}
          </Button>
        </div>
      </div>

      {settings.autoPause && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/[0.06] p-4">
          <p className="flex items-center gap-2 text-[12px] font-semibold text-danger">
            <ShieldAlert size={15} /> Emergency pause is on{settings.pauseReason ? ` — ${settings.pauseReason}` : ''}. Every release reverts.
          </p>
          <Link to="/app/officer/settings" className="text-[11px] font-bold uppercase tracking-[0.1em] text-danger hover:underline">
            Open policy settings
          </Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Awaiting signatures" value={stats.pending} sub="double-lock queue" icon={LockKeyhole} tone="accent" />
        <Stat label="Key 1 already signed" value={stats.key1} sub="AI rules key present" icon={Sparkles} tone="olive" />
        <Stat label="Released in demo" value={stats.released} sub="certificates issued" icon={Unlock} />
        <Stat label="Value in queue" value={formatINR(stats.value, { compact: true })} sub="illustrative amounts" icon={Landmark} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.35fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Release queue</p>
                <p className="mt-1 text-sm font-semibold">{list.length} request(s)</p>
              </div>
              <SimBadge>Seeded + live</SimBadge>
            </div>
            <div className="mt-3">
              <Tabs items={FILTERS} value={filter} onChange={setFilter} />
            </div>
          </div>

          {list.length ? (
            <ul className="divide-y divide-line/70">
              {list.map((release) => {
                const itemFdr = fdrs.find((f) => f.id === release.fdrId)
                const itemCollege = COLLEGES.find((c) => c.id === itemFdr?.collegeId)
                const itemBank = BANKS.find((b) => b.id === itemFdr?.bankId)
                const voice = itemFdr ? voiceRequired(itemFdr, settings) : false
                return (
                  <li key={release.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(release.id)}
                      className={cn(
                        'w-full px-4 py-3.5 text-left transition hover:bg-paper/60',
                        selectedId === release.id && 'bg-accent/[0.055]',
                      )}
                      aria-pressed={selectedId === release.id}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[10px] font-semibold">{release.id}</span>
                        <Badge tone={release.status === 'released' ? 'ink' : release.key1 ? 'olive' : 'amber'}>
                          {release.status === 'released' ? 'released' : release.key1 ? 'key 1 signed' : 'awaiting key 1'}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-[12px] font-semibold">
                        {release.fdrId} · {formatINR(itemFdr?.amount, { compact: true })}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {itemBank?.short} · {itemCollege?.code} · {formatDate(release.requestedAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <span className={cn('chip gap-1 px-2 py-0.5 text-[9px]', release.key1 ? 'border-olive/25 bg-olive/10 text-olive' : 'text-muted')}>
                          <Sparkles size={9} /> AI key
                        </span>
                        <span className={cn('chip gap-1 px-2 py-0.5 text-[9px]', release.key2 ? 'border-olive/25 bg-olive/10 text-olive' : 'text-muted')}>
                          <UserCheck size={9} /> Officer key
                        </span>
                        {voice && (
                          <span className={cn('chip gap-1 px-2 py-0.5 text-[9px]', release.voice?.verified ? 'border-olive/25 bg-olive/10 text-olive' : 'border-amber-600/25 bg-amber-500/10 text-amber-700 dark:text-amber-300')}>
                            <Mic size={9} /> Voice
                          </span>
                        )}
                        {release.revert && <Badge tone="red">reverted</Badge>}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              icon={Check}
              title="Nothing in this queue"
              description="Switch the filter or place a mature deposit into the release queue below."
              className="m-4 border-0 bg-transparent py-10"
            />
          )}
        </Card>

        <div className="space-y-4">
          {selected && fdr ? (
            <>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] font-semibold text-muted">
                      {selected.id} · {selected.requestedBy} · {formatDateTime(selected.requestedAt)}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                      {formatINR(fdr.amount)} <span className="text-muted">from {bank?.short}</span>
                    </h2>
                    <p className="mt-1 text-[11px] text-muted">
                      {fdr.id} · {fdr.fdNumber} · {college?.name} · matures {formatDate(fdr.maturityDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill status={fdr.status} />
                    {needsVoice && <Badge tone="amber">voice required</Badge>}
                  </div>
                </div>
                <p className="mt-3 rounded-2xl border border-line bg-paper/50 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted">
                  <strong className="text-ink">Institution reason:</strong> {selected.reason}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Link to={`/app/officer/review/${fdr.id}`} className="btn-ghost btn-sm">
                    Open evidence packet <ArrowRight size={12} />
                  </Link>
                  <Link to={`/explorer?fdr=${fdr.id}`} className="btn-ghost btn-sm">
                    <Fingerprint size={12} /> Public proof
                  </Link>
                  {selected.key2 && (
                    <Button size="sm" variant="outline" onClick={downloadCertificate} disabled={!fdr.releaseCertificate}>
                      <Download size={12} /> Certificate
                    </Button>
                  )}
                </div>
              </Card>

              {selected.revert && (
                <Card className="border-danger/30 bg-danger/[0.04] p-4">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0 text-danger" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold text-danger">Contract reverted · stage {selected.revert.stage}</p>
                      <p className="mt-1 break-words font-mono text-[10px] leading-relaxed text-danger/90">{selected.revert.message}</p>
                      <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                        {selected.revert.message === REVERT.pause
                          ? 'A multi-official pause blocks every release until policy settings clear it.'
                          : selected.revert.message === REVERT.voice
                            ? 'Complete the high-value voice factor, then retry the release.'
                            : 'Both signatures must be present. Sign the missing key and retry.'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" onClick={doAttempt}>
                          <RotateCcw size={12} /> Retry release
                        </Button>
                        {selected.revert.message === REVERT.voice && (
                          <Button size="sm" onClick={() => setVoiceOpen(true)}>
                            <Mic size={12} /> Voice challenge
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <RulesMatrix rules={evaluation.rules} />
                  <InlineNote className="mt-3" icon={ShieldCheck}>
                    Rules are evaluated against scenario date <span className="font-mono">{formatDate(now)}</span>. Changing them in policy
                    settings changes the next key-1 attempt.
                  </InlineNote>
                </Card>

                <Card className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Signature slots</p>
                    {fdr.amount >= settings.preApprovalLimit && <Badge tone="red">above pre-approval limit</Badge>}
                  </div>

                  <div className="mt-3 space-y-3">
                    <div className={cn('rounded-2xl border p-3', selected.key1 ? 'border-olive/30 bg-olive/[0.05]' : 'border-line bg-paper/40')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('grid h-8 w-8 place-items-center rounded-xl', selected.key1 ? 'bg-olive/10 text-olive' : 'bg-ink/[0.05] text-muted')}>
                            <Sparkles size={14} />
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold">Key 1 · AI release agent</p>
                            <p className="text-[9px] text-muted">
                              {selected.key1 ? `${formatDateTime(selected.key1.at)} · rules signed` : 'Refuses unless every rule passes'}
                            </p>
                          </div>
                        </div>
                        {selected.key1 ? <CheckCircle2 size={15} className="text-olive" /> : <KeyRound size={15} className="text-muted" />}
                      </div>
                      {selected.key1 ? (
                        <p className="mt-2 break-all rounded-lg bg-surface/70 px-2 py-1.5 font-mono text-[9px] text-muted">
                          {selected.key1.signature}
                        </p>
                      ) : (
                        <Button size="sm" className="mt-2.5 w-full" onClick={doKey1} disabled={busy === 'key1' || fdr.status === 'released'}>
                          {busy === 'key1' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                          Ask the AI agent to sign
                        </Button>
                      )}
                    </div>

                    <div className={cn('rounded-2xl border p-3', selected.key2 ? 'border-olive/30 bg-olive/[0.05]' : 'border-line bg-paper/40')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('grid h-8 w-8 place-items-center rounded-xl', selected.key2 ? 'bg-olive/10 text-olive' : 'bg-accent/10 text-accent')}>
                            <UserCheck size={14} />
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold">Key 2 · AICTE officer</p>
                            <p className="text-[9px] text-muted">
                              {selected.key2 ? `${selected.key2.method} · ${formatDateTime(selected.key2.at)}` : 'Passkey or labelled demo signature'}
                            </p>
                          </div>
                        </div>
                        {selected.key2 ? <CheckCircle2 size={15} className="text-olive" /> : <KeyRound size={15} className="text-muted" />}
                      </div>
                      {selected.key2 ? (
                        <p className="mt-2 break-all rounded-lg bg-surface/70 px-2 py-1.5 font-mono text-[9px] text-muted">
                          {selected.key2.signature}
                        </p>
                      ) : (
                        <div className="mt-2.5 space-y-1.5">
                          <Button size="sm" className="w-full" onClick={doPasskey} disabled={Boolean(busy) || !selected.key1}>
                            {busy === 'passkey' ? <Loader2 size={13} className="animate-spin" /> : <Fingerprint size={13} />}
                            Verify with passkey
                          </Button>
                          <Button size="sm" variant="outline" className="w-full" onClick={doSimulatedKey2} disabled={Boolean(busy) || !selected.key1}>
                            {busy === 'simulated' ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                            Use labelled demo signature
                          </Button>
                          {passkeyNote && <p className="text-[9px] leading-relaxed text-muted">{passkeyNote}</p>}
                          <SimBadge className="mt-0.5">WebAuthn where supported</SimBadge>
                        </div>
                      )}
                    </div>

                    {needsVoice && (
                      <div className={cn('rounded-2xl border p-3', selected.voice?.verified ? 'border-olive/30 bg-olive/[0.05]' : 'border-amber-600/25 bg-amber-500/[0.05]')}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={cn('grid h-8 w-8 place-items-center rounded-xl', selected.voice?.verified ? 'bg-olive/10 text-olive' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300')}>
                              <Mic size={14} />
                            </span>
                            <div>
                              <p className="text-[11px] font-semibold">High-value voice factor</p>
                              <p className="text-[9px] text-muted">Required at or above {formatINR(settings.highValueVoiceThreshold, { compact: true })}</p>
                            </div>
                          </div>
                          {selected.voice?.verified ? <CheckCircle2 size={15} className="text-olive" /> : <Mic size={15} className="text-amber-700 dark:text-amber-300" />}
                        </div>
                        {selected.voice?.verified ? (
                          <p className="mt-2 text-[9px] text-muted">
                            Verified via {selected.voice.method} · “{selected.voice.phrase}”. Additional factor only.
                          </p>
                        ) : (
                          <Button size="sm" variant="outline" className="mt-2.5 w-full" onClick={() => setVoiceOpen(true)} disabled={Boolean(busy)}>
                            <Mic size={13} /> Run voice challenge
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
                    <Button size="sm" variant={selected.key1 && selected.key2 ? 'primary' : 'outline'} onClick={doAttempt}>
                      <Unlock size={13} /> Attempt release
                    </Button>
                    {selected.status === 'released' && (
                      <Button size="sm" variant="outline" onClick={downloadCertificate} disabled={!fdr.releaseCertificate}>
                        <Download size={13} /> Certificate
                      </Button>
                    )}
                  </div>
                  <InlineNote className="mt-2" tone="accent" icon={CircleAlert}>
                    Attempting the release runs the same guard checks as <span className="font-mono">FDRLedger.release()</span>. A missing key or an
                    active pause produces an explicit revert, not a silent failure.
                  </InlineNote>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Ledger evidence</p>
                  <ul className="mt-3 space-y-2">
                    {releaseBlocks.length ? (
                      releaseBlocks.map((block) => (
                        <li key={block.id} className="rounded-xl border border-line bg-paper/40 p-2.5">
                          <p className="flex items-center justify-between gap-2 font-mono text-[10px] font-semibold">
                            {block.type} <span className="text-muted">{shortHash(block.hash, 14)}</span>
                          </p>
                          <p className="mt-0.5 text-[9px] text-muted">by {block.actor} · {formatDateTime(block.timestamp)}</p>
                        </li>
                      ))
                    ) : (
                      <li className="text-[11px] text-muted">No release block has been written for this record yet.</li>
                    )}
                  </ul>
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Recent trail</p>
                    <ul className="mt-2 space-y-1.5">
                      {relatedAudit.map((item) => (
                        <li key={item.id} className="flex items-start gap-2 text-[10px]">
                          <Clock3 size={11} className="mt-0.5 shrink-0 text-muted" />
                          <span className="text-muted">
                            <strong className="text-ink">{item.action.replaceAll('_', ' ')}</strong> · {item.detail}
                          </span>
                        </li>
                      ))}
                      {!relatedAudit.length && <li className="text-[10px] text-muted">No audit entries for this release.</li>}
                    </ul>
                  </div>
                </Card>

                <Card className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Policy at a glance</p>
                  <ul className="mt-3 space-y-2 text-[11px] text-muted">
                    <li className="flex items-center justify-between gap-2 border-b border-line/60 pb-2">
                      <span>Pre-approval limit</span>
                      <strong className="text-ink">{formatINR(settings.preApprovalLimit, { compact: true })}</strong>
                    </li>
                    <li className="flex items-center justify-between gap-2 border-b border-line/60 pb-2">
                      <span>Voice threshold</span>
                      <strong className="text-ink">{formatINR(settings.highValueVoiceThreshold, { compact: true })}</strong>
                    </li>
                    <li className="flex items-center justify-between gap-2 border-b border-line/60 pb-2">
                      <span>High-confidence band</span>
                      <strong className="text-ink">{settings.highThreshold}–100</strong>
                    </li>
                    <li className="flex items-center justify-between gap-2 border-b border-line/60 pb-2">
                      <span>Human sampling</span>
                      <strong className="text-ink">{settings.samplingRate}%</strong>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Emergency pause</span>
                      <strong className={settings.autoPause ? 'text-danger' : 'text-olive'}>{settings.autoPause ? 'on' : 'off'}</strong>
                    </li>
                  </ul>
                  <Link to="/app/officer/settings" className="btn-outline btn-sm mt-4">
                    Change policy <ArrowRight size={12} />
                  </Link>
                </Card>
              </div>
            </>
          ) : (
            <EmptyState
              icon={LockKeyhole}
              title="Select a release request"
              description="Choose a request from the queue to inspect its rules, signature slots and revert behaviour."
            />
          )}
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Place a deposit in the queue</p>
            <p className="mt-1 text-sm font-semibold">Demonstrate a fresh double-lock path</p>
          </div>
          <SimBadge>Local demo action</SimBadge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.2fr_auto]">
          <Field label="Verified deposit">
            <select className="input" value={newFdrId} onChange={(e) => setNewFdrId(e.target.value)} aria-label="Deposit to release">
              <option value="">Choose a deposit…</option>
              {releaseTargets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} · {formatINR(item.amount, { compact: true })} · {formatDate(item.maturityDate)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Institution reason">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Corpus reallocation after governing-council approval" />
          </Field>
          <div className="flex items-end">
            <Button onClick={createRequest} className="w-full sm:w-auto">
              <LockKeyhole size={14} /> Queue release
            </Button>
          </div>
        </div>
        <InlineNote className="mt-3">
          New requests start with no keys. Key 1 is refused if any rule fails, including the illustrative {formatINR(settings.preApprovalLimit, { compact: true })} pre-approval limit.
        </InlineNote>
      </Card>

      <Modal
        open={voiceOpen}
        onClose={() => {
          stopVoice()
          setVoiceOpen(false)
        }}
        title="High-value voice challenge"
        description="An additional factor for releases at or above the configured threshold. It never replaces the two required keys."
        footer={
          <>
            <Button variant="ghost" onClick={() => setVoiceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmVoice} disabled={!voicePhrase.trim()}>
              <Check size={14} /> Confirm factor
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-accent/25 bg-accent/[0.05] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Challenge phrase</p>
            <p className="mt-1 font-mono text-sm font-semibold">
              Confirm release {selected?.fdrId || 'FDR-2026-0000'}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              {selected && `This release is ${formatINR(fdr?.amount, { compact: true })} for ${college?.name}.`}
            </p>
          </div>

          {voiceSupported ? (
            <div className="flex flex-wrap gap-2">
              {!listening ? (
                <Button variant="outline" onClick={startVoice}>
                  <Mic size={14} /> Start listening
                </Button>
              ) : (
                <Button variant="danger" onClick={stopVoice}>
                  <Square size={13} /> Stop listening
                </Button>
              )}
              <SimBadge>Browser speech recognition</SimBadge>
            </div>
          ) : (
            <InlineNote tone="accent" icon={MicOff}>
              Speech recognition is not available here. Type the phrase to run the labelled simulated voice factor.
            </InlineNote>
          )}

          <Field
            label="Transcript or typed phrase"
            hint="This demo matches the words, not a voiceprint. Production would use an accredited voice-biometrics provider with consent."
            error={voiceError}
          >
            <Textarea
              value={voicePhrase}
              onChange={(e) => {
                setVoicePhrase(e.target.value)
                setVoiceError('')
              }}
              placeholder={`Confirm release ${selected?.fdrId || ''}`}
              className="min-h-[78px] font-mono text-[12px]"
            />
          </Field>

          <InlineNote icon={ShieldCheck}>
            The voice factor is deliberately labelled a simulation. It cannot release funds on its own; both the AI key and the officer key remain
            mandatory.
          </InlineNote>
        </div>
      </Modal>

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[10px] leading-relaxed text-muted">
          <BadgeCheck size={12} className="shrink-0 text-olive" />
          Every number on this page is illustrative. The contract behaviour is included in <span className="font-mono">contracts/FDRLedger.sol</span>.
        </p>
        <p className="flex items-center gap-1.5 text-[10px] text-muted">
          <X size={11} /> No single actor can move money.
        </p>
      </div>
    </div>
  )
}
