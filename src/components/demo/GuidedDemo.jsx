import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Check,
  Clock3,
  FileSearch,
  Fingerprint,
  Loader2,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useUi } from '../../store/useUi'
import { Button, InlineNote, Modal, SimBadge } from '../ui/primitives'
import { cn } from '../../lib/utils'

const STEPS = [
  {
    title: 'Sign in as an institution',
    body: 'The demo account belongs to RV College of Engineering. Signing in is local and instant — no password is sent anywhere.',
    icon: BadgeCheck,
    action: 'Sign in & open my deposits',
    run: async ({ login, navigate }) => {
      login('institution')
      navigate('/app/institution')
    },
  },
  {
    title: 'Inspect an anchored deposit',
    body: 'Every accepted FDR gets a SHA-256 fingerprint and an append-only ledger block. Open a clean record to see its document, expert reasons and chain proof.',
    icon: Fingerprint,
    action: 'Open FDR-2026-0021',
    run: async ({ navigate }) => navigate('/app/institution/fdr/FDR-2026-0021'),
  },
  {
    title: 'Review a suspicious submission',
    body: 'Switch to the AICTE officer and open the amount-edited sample. The Eye, Reader and Memory experts disagree with the declared values — the officer still decides.',
    icon: FileSearch,
    action: 'Switch to officer & open the review',
    run: async ({ login, navigate }) => {
      login('officer')
      navigate('/app/officer/review/FDR-2026-0023')
    },
  },
  {
    title: 'Try the double lock',
    body: 'Releases need an AI rules signature and an officer signature. High-value releases also need a voice factor. Seed requests include each failure mode.',
    icon: ShieldCheck,
    action: 'Open release approvals',
    run: async ({ navigate }) => navigate('/app/officer/releases'),
  },
  {
    title: 'Move the scenario clock forward',
    body: 'Advance 60 days. Real in-app reminder logic runs, escalation events are emitted, and AI-prepared renewal drafts are generated for approaching maturities.',
    icon: Clock3,
    action: 'Advance 60 days & open notifications',
    run: async ({ login, advanceClock, navigate }) => {
      login('institution')
      await advanceClock(60)
      navigate('/app/institution/notifications')
    },
  },
  {
    title: 'Tamper with a record',
    body: 'The demo edits an off-chain amount without re-anchoring it. Recompute the fingerprint in the explorer and see the mismatch — the ledger does not silently repair it.',
    icon: Sparkles,
    action: 'Tamper & verify the public chain',
    run: async ({ tamperDemo, navigate }) => {
      const id = tamperDemo()
      navigate(id ? `/explorer?tampered=${id}` : '/explorer')
    },
  },
  {
    title: 'Sign a bank proof',
    body: 'A bank agent publishes a daily ECDSA-signed statement that deposits remain locked — with zero customer data. The Cosmos fixture carries an invalid signature on purpose.',
    icon: Banknote,
    action: 'Switch to the bank desk',
    run: async ({ login, navigate }) => {
      login('bank')
      navigate('/app/bank')
    },
  },
  {
    title: 'That is the whole loop',
    body: 'Submit, verify, remember, review, double-lock release, prove. AI helps at each step; a human decision is always available. Reset the demo any time from the toolbar.',
    icon: Check,
    action: null,
  },
]

export default function GuidedDemo() {
  const open = useUi((s) => s.guidedOpen)
  const stepIndex = useUi((s) => s.guidedStep)
  const setStep = useUi((s) => s.setGuidedStep)
  const close = useUi((s) => s.closeGuided)
  const login = useStore((s) => s.login)
  const advanceClock = useStore((s) => s.advanceClock)
  const tamperDemo = useStore((s) => s.tamperDemo)
  const navigate = useNavigate()
  const [complete, setComplete] = useState({})
  const [busy, setBusy] = useState(false)
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)]
  const isLast = stepIndex >= STEPS.length - 1
  const done = complete[stepIndex]

  const run = async () => {
    if (busy) return
    if (!step.action) {
      close()
      navigate('/explorer')
      return
    }
    setBusy(true)
    try {
      await step.run({ login, advanceClock, tamperDemo, navigate })
      setComplete((c) => ({ ...c, [stepIndex]: true }))
    } finally {
      setBusy(false)
    }
  }

  const next = () => {
    if (isLast) {
      close()
      return
    }
    setStep(stepIndex + 1)
  }

  const restart = () => {
    setComplete({})
    setStep(0)
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Guided demo"
      description="Eight stops through the full security-deposit lifecycle. Each stop performs a real in-app action."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={restart}>
            <RotateCcw size={14} /> Restart
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={close}>
            Close
          </Button>
          {step.action && !done ? (
            <Button onClick={run} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
              {step.action}
            </Button>
          ) : (
            <Button onClick={next}>
              {isLast ? 'Finish' : 'Next step'} <ArrowRight size={14} />
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[190px_1fr]">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto sm:flex-col">
          {STEPS.map((s, i) => {
            const active = i === stepIndex
            return (
              <button
                key={s.title}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  'flex min-w-[170px] items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-[11px] font-semibold transition sm:min-w-0',
                  active
                    ? 'border-ink bg-ink text-paper'
                    : 'border-line bg-paper/50 text-muted hover:border-ink/30 hover:text-ink',
                )}
              >
                <span
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold',
                    complete[i] ? 'bg-olive text-white' : active ? 'bg-paper/20 text-paper' : 'bg-ink/[0.06]',
                  )}
                >
                  {complete[i] ? <Check size={11} /> : i + 1}
                </span>
                <span className="line-clamp-2">{s.title}</span>
              </button>
            )
          })}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent/10 text-accent">
              <step.icon size={19} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                Stop {stepIndex + 1} of {STEPS.length}
              </p>
              <h3 className="text-lg font-semibold tracking-[-0.03em]">{step.title}</h3>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">{step.body}</p>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              <span>Progress</span>
              <span>{Object.keys(complete).length}/{STEPS.length} actions run</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70">
              <motion.div
                className="h-full rounded-full bg-accent"
                animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
                transition={{ duration: 0.35 }}
              />
            </div>
          </div>

          {done && (
            <InlineNote tone="olive" icon={Check} className="mt-4">
              Action complete. Continue when you are ready.
            </InlineNote>
          )}

          <InlineNote className="mt-4" icon={Sparkles}>
            <span className="flex flex-wrap items-center gap-1.5">
              <SimBadge>Demo script</SimBadge>
              Role switching and navigation are real local actions. Nothing here changes production data.
            </span>
          </InlineNote>
        </div>
      </div>
    </Modal>
  )
}
