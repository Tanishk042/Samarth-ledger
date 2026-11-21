import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  History,
  Landmark,
  Loader2,
  LockKeyhole,
  PauseCircle,
  Percent,
  PlayCircle,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Undo2,
  Users,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Eyebrow,
  Field,
  InlineNote,
  Input,
  Modal,
  Progress,
  SimBadge,
  Stat,
  Textarea,
  Toggle,
} from '../../components/ui/primitives'
import { useStore } from '../../store/useStore'
import { toast } from '../../store/useToast'
import { DEFAULT_SETTINGS, DECISION_BANDS } from '../../lib/constants'
import { cn, formatDateTime, formatINR } from '../../lib/utils'

const POLICY_ACTIONS = new Set([
  'SETTINGS_UPDATED',
  'EMERGENCY_PAUSE_ON',
  'EMERGENCY_PAUSE_OFF',
  'RESET_DEMO',
  'DEMO_RESET',
])

function cleanNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function policySnapshot(settings) {
  return {
    highThreshold: settings.highThreshold,
    mediumThreshold: settings.mediumThreshold,
    samplingRate: settings.samplingRate,
    preApprovalLimit: settings.preApprovalLimit,
    highValueVoiceThreshold: settings.highValueVoiceThreshold,
    reminderLeadDays: settings.reminderLeadDays,
    escalationDays: settings.escalationDays,
  }
}

export default function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const audit = useStore((s) => s.audit)
  const fdrs = useStore((s) => s.fdrs)
  const blocks = useStore((s) => s.blocks)
  const proofs = useStore((s) => s.proofs)
  const user = useStore((s) => s.user)
  const updateSettings = useStore((s) => s.updateSettings)
  const togglePause = useStore((s) => s.togglePause)
  const resetDemo = useStore((s) => s.resetDemo)

  const [form, setForm] = useState(() => policySnapshot(settings))
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [pauseReason, setPauseReason] = useState('')
  const [pauseBusy, setPauseBusy] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetWord, setResetWord] = useState('')
  const [resetBusy, setResetBusy] = useState(false)
  const [previewScore, setPreviewScore] = useState(96)

  useEffect(() => {
    setForm(policySnapshot(settings))
  }, [settings])

  const baseline = useMemo(() => policySnapshot(settings), [settings])
  const dirty = JSON.stringify(baseline) !== JSON.stringify(form)
  const leadDays = Array.isArray(form.reminderLeadDays) ? form.reminderLeadDays : [60, 30]

  const policyAudit = useMemo(
    () => audit.filter((item) => POLICY_ACTIONS.has(item.action)).slice(0, 12),
    [audit],
  )

  const paused = Boolean(settings.autoPause)
  const band = previewScore >= form.highThreshold ? 'high' : previewScore >= form.mediumThreshold ? 'medium' : 'low'
  const bandMeta = DECISION_BANDS.find((b) => b.id === band)

  const maxValue = useMemo(
    () => Math.max(0, ...fdrs.filter((f) => f.status !== 'released').map((f) => Number(f.amount) || 0)),
    [fdrs],
  )
  const aboveLimit = useMemo(
    () => fdrs.filter((f) => Number(f.amount) > cleanNumber(form.preApprovalLimit)).length,
    [fdrs, form.preApprovalLimit],
  )

  const set = (patch) => {
    setError('')
    setForm((current) => ({ ...current, ...patch }))
  }

  const save = () => {
    const next = {
      highThreshold: cleanNumber(form.highThreshold),
      mediumThreshold: cleanNumber(form.mediumThreshold),
      samplingRate: cleanNumber(form.samplingRate),
      preApprovalLimit: cleanNumber(form.preApprovalLimit),
      highValueVoiceThreshold: cleanNumber(form.highValueVoiceThreshold),
      reminderLeadDays: [
        cleanNumber(leadDays[0], 60),
        cleanNumber(leadDays[1], 30),
      ].sort((a, b) => b - a),
      escalationDays: cleanNumber(form.escalationDays),
    }

    if (next.highThreshold < 60 || next.highThreshold > 100) {
      setError('The high-confidence threshold must sit between 60 and 100.')
      return
    }
    if (next.mediumThreshold < 1 || next.mediumThreshold >= next.highThreshold) {
      setError('The medium threshold must be below the high threshold and above zero.')
      return
    }
    if (next.samplingRate < 0 || next.samplingRate > 100) {
      setError('Human sampling must be between 0% and 100%.')
      return
    }
    if (next.preApprovalLimit < 0 || next.highValueVoiceThreshold < 0) {
      setError('Monetary limits cannot be negative.')
      return
    }
    if (next.highValueVoiceThreshold > next.preApprovalLimit) {
      setError('The voice threshold must not exceed the AI pre-approval limit.')
      return
    }
    if (next.reminderLeadDays[1] < 1 || next.reminderLeadDays[0] <= next.reminderLeadDays[1]) {
      setError('Use two positive reminder windows, with the longer window first.')
      return
    }
    if (next.escalationDays < 0 || next.escalationDays > 90) {
      setError('Escalation must fall between 0 and 90 days after maturity.')
      return
    }

    updateSettings(next)
    setSavedAt(new Date().toISOString())
  }

  const restoreDefaults = () => {
    setForm(policySnapshot({ ...DEFAULT_SETTINGS }))
    setError('')
    toast('Defaults loaded into the form. Save to apply them.', { tone: 'warning' })
  }

  const engagePause = () => {
    if (pauseBusy) return
    if (!pauseReason.trim()) {
      toast('Record a reason before engaging the emergency pause.', { tone: 'danger' })
      return
    }
    setPauseBusy(true)
    togglePause(pauseReason.trim())
    setPauseBusy(false)
    setPauseOpen(false)
    setPauseReason('')
  }

  const clearPause = () => {
    togglePause('')
    setPauseOpen(false)
  }

  const doReset = async () => {
    if (resetWord.trim().toUpperCase() !== 'RESET') {
      toast('Type RESET to confirm the scenario rebuild.', { tone: 'danger' })
      return
    }
    setResetBusy(true)
    try {
      await resetDemo()
      setResetOpen(false)
      setResetWord('')
    } finally {
      setResetBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Governance controls</Eyebrow>
            <SimBadge>Demo policy</SimBadge>
          </div>
          <h1 className="display mt-2 text-3xl sm:text-[40px]">
            Tune the policy, <em className="serif-accent">not the evidence.</em>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            Thresholds, sampling, release limits and reminders are real inputs to the in-browser rules engine. Every change is
            written to the append-only audit log with your name.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={restoreDefaults}>
            <Undo2 size={14} /> Load defaults
          </Button>
          <Button onClick={save} disabled={!dirty}>
            <Save size={14} /> Save policy
          </Button>
        </div>
      </div>

      {paused && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/[0.06] p-4">
          <p className="flex items-center gap-2 text-[12px] font-semibold text-danger">
            <ShieldAlert size={15} /> Emergency pause is active
            {settings.pauseReason ? ` — ${settings.pauseReason}` : ''}. Every release reverts until it is cleared.
          </p>
          <Button size="sm" variant="outline" onClick={clearPause}>
            <PlayCircle size={13} /> Clear pause
          </Button>
        </div>
      )}

      {dirty && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent/[0.05] px-4 py-3">
          <p className="flex items-center gap-2 text-[11px] font-semibold text-accent">
            <CircleAlert size={13} /> Unsaved policy changes. New checks use the saved values, not this draft.
          </p>
          <Button size="sm" variant="outline" onClick={() => setForm(baseline)}>
            Discard draft
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/[0.05] px-4 py-3 text-[11px] font-semibold text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="High-confidence band"
          value={`${settings.highThreshold}–100`}
          sub={`${fdrs.filter((f) => f.trustScore >= settings.highThreshold).length} seeded records`}
          icon={Sparkles}
          tone="olive"
        />
        <Stat
          label="Human sampling"
          value={`${settings.samplingRate}%`}
          sub="of high-band accepts"
          icon={Percent}
          tone="accent"
        />
        <Stat
          label="Pre-approval limit"
          value={formatINR(settings.preApprovalLimit, { compact: true })}
          sub={`${aboveLimit} record(s) above it`}
          icon={Landmark}
        />
        <Stat
          label="Pause switch"
          value={paused ? 'Engaged' : 'Clear'}
          sub={paused ? 'all releases blocked' : 'normal release path'}
          icon={paused ? PauseCircle : ShieldCheck}
          tone={paused ? 'danger' : 'olive'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Confidence &amp; sampling</p>
                <p className="mt-1 text-sm font-semibold">Where the machine stops and a human starts</p>
              </div>
              <Gauge size={17} className="text-accent" />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="High-confidence threshold"
                hint="At or above this score, a clean record can be auto-accepted."
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={60}
                    max={100}
                    value={form.highThreshold}
                    onChange={(e) => set({ highThreshold: e.target.value })}
                  />
                  <span className="shrink-0 text-[11px] font-semibold text-muted">/ 100</span>
                </div>
              </Field>
              <Field
                label="Medium threshold"
                hint="Below this score, the record is rejected with reasons instead of routed to you."
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={form.mediumThreshold}
                    onChange={(e) => set({ mediumThreshold: e.target.value })}
                  />
                  <span className="shrink-0 text-[11px] font-semibold text-muted">/ 100</span>
                </div>
              </Field>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="label mb-0">Random human sampling</span>
                <span className="font-mono text-[11px] font-semibold">{form.samplingRate}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={form.samplingRate}
                onChange={(e) => set({ samplingRate: e.target.value })}
                className="mt-2 w-full accent-[rgb(var(--accent))]"
                aria-label="Random human sampling percentage"
              />
              <p className="mt-1 text-[10px] leading-relaxed text-muted">
                A deterministic random draw is applied when a high-band record is auto-accepted. The draw is recorded on the record.
              </p>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-paper/40 p-3 sm:grid-cols-3">
              {DECISION_BANDS.map((item) => {
                const active = item.id === band
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-xl border px-3 py-2 transition',
                      active ? 'border-accent/40 bg-accent/[0.06]' : 'border-line bg-surface/60',
                    )}
                  >
                    <p className={cn('text-[10px] font-bold uppercase tracking-[0.12em]', active ? 'text-accent' : 'text-muted')}>
                      {item.label}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] font-semibold">{item.range}</p>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Release guardrails</p>
                <p className="mt-1 text-sm font-semibold">What the AI key will and will not approve</p>
              </div>
              <LockKeyhole size={17} className="text-accent" />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="AI pre-approval limit"
                hint="Key 1 refuses above this amount. The officer can still see and handle the request."
              >
                <Input
                  type="number"
                  min={0}
                  step={500000}
                  value={form.preApprovalLimit}
                  onChange={(e) => set({ preApprovalLimit: e.target.value })}
                />
                <span className="mt-1 block text-[10px] font-semibold text-accent">
                  {formatINR(cleanNumber(form.preApprovalLimit), { compact: true })}
                </span>
              </Field>
              <Field
                label="High-value voice threshold"
                hint="At or above this amount, a voice factor is required in addition to both keys."
              >
                <Input
                  type="number"
                  min={0}
                  step={100000}
                  value={form.highValueVoiceThreshold}
                  onChange={(e) => set({ highValueVoiceThreshold: e.target.value })}
                />
                <span className="mt-1 block text-[10px] font-semibold text-accent">
                  {formatINR(cleanNumber(form.highValueVoiceThreshold), { compact: true })}
                </span>
              </Field>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-paper/40 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Largest deposit</p>
                <p className="mt-1 text-[12px] font-semibold">{formatINR(maxValue, { compact: true })}</p>
              </div>
              <div className="rounded-xl border border-line bg-paper/40 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Above limit</p>
                <p className={cn('mt-1 text-[12px] font-semibold', aboveLimit ? 'text-danger' : 'text-olive')}>
                  {aboveLimit} record(s)
                </p>
              </div>
              <div className="rounded-xl border border-line bg-paper/40 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Release keys</p>
                <p className="mt-1 text-[12px] font-semibold">2 required</p>
              </div>
            </div>

            <InlineNote className="mt-4" icon={ShieldCheck}>
              These amounts are illustrative policy defaults. Changing them never edits an existing release request; the next key-1
              attempt is evaluated against the saved values.
            </InlineNote>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Reminder windows</p>
                <p className="mt-1 text-sm font-semibold">Two reminders, then an escalation</p>
              </div>
              <TimerReset size={17} className="text-accent" />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="First reminder" hint="Days before maturity.">
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={leadDays[0]}
                  onChange={(e) => set({ reminderLeadDays: [e.target.value, leadDays[1]] })}
                />
              </Field>
              <Field label="Second reminder" hint="The shorter window.">
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={leadDays[1]}
                  onChange={(e) => set({ reminderLeadDays: [leadDays[0], e.target.value] })}
                />
              </Field>
              <Field label="Escalate after" hint="Days past maturity with no response.">
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={form.escalationDays}
                  onChange={(e) => set({ escalationDays: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Badge tone="accent">{leadDays[0]} days</Badge>
              <ArrowRight size={11} className="text-muted" />
              <Badge tone="amber">{leadDays[1]} days</Badge>
              <ArrowRight size={11} className="text-muted" />
              <Badge tone="ink">maturity</Badge>
              <ArrowRight size={11} className="text-muted" />
              <Badge tone="red">+{form.escalationDays}d escalation</Badge>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted">
              Reminder logic runs in the browser when you advance the scenario clock. The seeded notification centre already contains
              examples at the default 60/30-day windows.
            </p>
          </Card>

          <Card className={cn('p-5', paused && 'border-danger/30 bg-danger/[0.035]')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Emergency pause</p>
                <p className="mt-1 text-sm font-semibold">A circuit breaker that every actor must respect</p>
              </div>
              <ShieldAlert size={17} className={paused ? 'text-danger' : 'text-muted'} />
            </div>

            <div className="mt-4">
              <Toggle
                checked={paused}
                onChange={() => {
                  if (paused) clearPause()
                  else setPauseOpen(true)
                }}
                label={paused ? 'Pause is engaged' : 'Pause is clear'}
                description={
                  paused
                    ? `Reason: ${settings.pauseReason || 'not recorded'}. Releases revert until cleared.`
                    : 'Engaging the pause blocks every release request, including ones already holding key 1.'
                }
              />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {['AICTE Finance', 'AICTE Compliance', 'AICTE Director'].map((official, index) => (
                <div
                  key={official}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-semibold',
                    paused
                      ? index < 2
                        ? 'border-danger/30 bg-danger/[0.06] text-danger'
                        : 'border-line bg-paper/40 text-muted'
                      : 'border-line bg-paper/40 text-muted',
                  )}
                >
                  <Users size={12} /> {official}
                  {paused && index < 2 && <CheckCircle2 size={11} className="ml-auto" />}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              The prototype uses one officer switch. The included contract enforces a 2-of-3 official quorum, so no single officer can
              freeze the consortium alone.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Scenario controls</p>
                <p className="mt-1 text-sm font-semibold">Rebuild the demo from its seed</p>
              </div>
              <SimBadge>Destructive demo action</SimBadge>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-paper/40 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Seeded FDRs</p>
                <p className="mt-1 text-[12px] font-semibold">{fdrs.length}</p>
              </div>
              <div className="rounded-xl border border-line bg-paper/40 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Ledger blocks</p>
                <p className="mt-1 text-[12px] font-semibold">{blocks.length}</p>
              </div>
              <div className="rounded-xl border border-line bg-paper/40 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Bank proofs</p>
                <p className="mt-1 text-[12px] font-semibold">{proofs.length}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="danger" onClick={() => setResetOpen(true)} disabled={resetBusy}>
                <RotateCcw size={14} /> Reset the whole demo
              </Button>
              <Link to="/explorer" className="btn-outline btn-sm">
                <ShieldCheck size={12} /> Verify current chain
              </Link>
            </div>
            <InlineNote className="mt-3" tone="danger" icon={AlertTriangle}>
              Reset discards submissions, reviews, releases, proofs, policy edits and the hash chain in this browser. It does not touch
              any server.
            </InlineNote>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Live band preview</p>
                <p className="mt-1 text-sm font-semibold">How a score would be routed</p>
              </div>
              <Badge tone={bandMeta?.tone || 'sand'}>{bandMeta?.label}</Badge>
            </div>

            <div className="mt-4 flex items-end justify-between gap-2">
              <p className="text-[44px] font-semibold leading-none tracking-[-0.06em]">{previewScore}</p>
              <p className="pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">of 100</p>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={previewScore}
              onChange={(e) => setPreviewScore(Number(e.target.value))}
              className="mt-3 w-full accent-[rgb(var(--accent))]"
              aria-label="Preview trust score"
            />
            <Progress
              value={previewScore}
              tone={band === 'high' ? 'olive' : band === 'medium' ? 'accent' : 'danger'}
              className="mt-2"
              label="Preview trust score"
            />

            <div className="mt-4 space-y-2 rounded-2xl border border-line bg-paper/40 p-3">
              <p className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-muted">Draft high threshold</span>
                <strong className="font-mono">{form.highThreshold}</strong>
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-muted">Draft medium threshold</span>
                <strong className="font-mono">{form.mediumThreshold}</strong>
              </p>
              <p className="flex items-center justify-between gap-2 border-t border-line pt-2 text-[11px]">
                <span className="text-muted">Routing</span>
                <strong className={band === 'high' ? 'text-olive' : band === 'medium' ? 'text-accent' : 'text-danger'}>
                  {band === 'high' ? 'Auto-accept + sample' : band === 'medium' ? 'Officer review' : 'Reject with reasons'}
                </strong>
              </p>
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-muted">
              Preview only — it uses the draft values above. Save the policy to apply it to real submissions.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Policy snapshot</p>
                <p className="mt-1 text-sm font-semibold">Currently enforced</p>
              </div>
              <BadgeCheck size={16} className="text-olive" />
            </div>
            <dl className="mt-3 space-y-2 text-[11px]">
              {[
                ['High band', `${settings.highThreshold}–100`],
                ['Medium band', `${settings.mediumThreshold}–${settings.highThreshold - 1}`],
                ['Low band', `0–${settings.mediumThreshold - 1}`],
                ['Sampling', `${settings.samplingRate}%`],
                ['Pre-approval', formatINR(settings.preApprovalLimit, { compact: true })],
                ['Voice factor', formatINR(settings.highValueVoiceThreshold, { compact: true })],
                ['Reminders', `${settings.reminderLeadDays?.[0] ?? 60} / ${settings.reminderLeadDays?.[1] ?? 30} days`],
                ['Escalation', `+${settings.escalationDays} days`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-line/60 pb-1.5 last:border-0">
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-mono text-[10px] font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            {savedAt && (
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-olive">
                <CheckCircle2 size={11} /> Saved at {formatDateTime(savedAt)}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Settings trail</p>
                <p className="mt-1 text-sm font-semibold">Who changed what</p>
              </div>
              <History size={16} className="text-muted" />
            </div>
            {policyAudit.length ? (
              <ol className="mt-3 space-y-2.5">
                {policyAudit.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <Clock3 size={11} className="mt-0.5 shrink-0 text-muted" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold">
                        {item.action.replaceAll('_', ' ')}
                        <span className="font-normal text-muted"> · {item.actor}</span>
                      </p>
                      <p className="line-clamp-2 text-[9px] leading-relaxed text-muted">{item.detail}</p>
                      <p className="mt-0.5 font-mono text-[9px] text-muted/70">{formatDateTime(item.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-[11px] text-muted">No policy changes recorded in this session.</p>
            )}
            <Link to="/app/officer/audit" className="btn-ghost btn-sm mt-3">
              Open the full audit log <ArrowRight size={12} />
            </Link>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Operator</p>
                <p className="mt-1 text-sm font-semibold">{user?.person}</p>
              </div>
              <SlidersHorizontal size={16} className="text-muted" />
            </div>
            <p className="mt-1 text-[11px] text-muted">{user?.org}</p>
            <p className="mt-3 rounded-2xl border border-line bg-paper/40 px-3 py-2 text-[10px] leading-relaxed text-muted">
              Policy changes are signed with this demo identity. In production, threshold changes would require a second official and a
              contract-level role check.
            </p>
          </Card>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[10px] leading-relaxed text-muted">
          <BadgeCheck size={12} className="shrink-0 text-olive" />
          Saving validates the ranges with real form checks; every applied change appends an audit row.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Link to="/app/officer/releases" className="btn-ghost btn-sm">
            Test a release <ArrowRight size={12} />
          </Link>
          <Button size="sm" onClick={save} disabled={!dirty}>
            <Save size={12} /> Save policy
          </Button>
        </div>
      </div>

      <Modal
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title="Engage the emergency pause"
        description="All release requests revert while the pause is active. Record the reason for the audit trail."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPauseOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={engagePause} disabled={pauseBusy || !pauseReason.trim()}>
              {pauseBusy ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
              Engage pause
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Reason" required hint="Shown to every actor in the release desk and written to the audit log.">
            <Textarea
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="e.g. Reported signatory compromise at a co-operative bank — pending forensic review."
            />
          </Field>
          <InlineNote tone="danger" icon={AlertTriangle}>
            The prototype implements a single officer switch. The Solidity contract requires a 2-of-3 official quorum before the pause
            state can be set.
          </InlineNote>
        </div>
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => {
          setResetOpen(false)
          setResetWord('')
        }}
        title="Rebuild the seeded scenario?"
        description="This clears local submissions, reviews, releases, proofs, policy edits and the hash chain."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setResetOpen(false)
                setResetWord('')
              }}
            >
              Keep my data
            </Button>
            <Button variant="danger" onClick={doReset} disabled={resetBusy || resetWord.trim().toUpperCase() !== 'RESET'}>
              {resetBusy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Rebuild demo
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-danger/25 bg-danger/[0.05] p-4 text-[11px] leading-relaxed">
            <p className="flex items-center gap-2 font-semibold text-danger">
              <AlertTriangle size={14} /> This cannot be undone
            </p>
            <p className="mt-1.5 text-muted">
              The 40 seeded FDRs, 12 institutions, 8 banks and 5 risk flags return to their original state. New bank keys and proofs are
              generated. The scenario clock returns to today.
            </p>
          </div>
          <Field label="Type RESET to confirm" required>
            <Input
              value={resetWord}
              onChange={(e) => setResetWord(e.target.value)}
              placeholder="RESET"
              className="font-mono uppercase tracking-[0.18em]"
              autoComplete="off"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
