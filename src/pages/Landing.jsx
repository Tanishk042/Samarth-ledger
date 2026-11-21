import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileSearch,
  Fingerprint,
  History,
  Landmark,
  LockKeyhole,
  Radio,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserCheck,
  WifiOff,
} from 'lucide-react'
import PublicNav from '../components/layout/PublicNav'
import Footer from '../components/layout/Footer'
import { Button, Card, Eyebrow, InlineNote, SectionHead, SimBadge } from '../components/ui/primitives'
import { useStore } from '../store/useStore'
import { useUi } from '../store/useUi'
import { useT } from '../lib/i18n'
import { SAMPLE_LIST } from '../lib/samples'
import { HONESTY } from '../lib/constants'
import { cn, formatINR } from '../lib/utils'

const STEPS = [
  {
    icon: ScanLine,
    title: 'Submit once',
    body: 'Upload a receipt or authorise an Account Aggregator fetch. The browser crops, deskews, brightens and hashes the document before anything leaves the device.',
  },
  {
    icon: Eye,
    title: 'Three experts look',
    body: 'Eye checks image forensics, Reader reads the fields, Memory searches for duplicates and shared signatory patterns. Each explains itself.',
  },
  {
    icon: Clock3,
    title: 'The ledger remembers',
    body: 'A fingerprint and maturity date are anchored. Reminders fire at 60 and 30 days, then escalate to an officer if the institution stays silent.',
  },
  {
    icon: LockKeyhole,
    title: 'Two keys, one release',
    body: 'The AI rules key and the AICTE officer key must both sign. A high-value voice factor and a multi-official pause can block execution.',
  },
]

const MODULES = [
  { icon: Building2, title: 'Institution workspace', body: 'Submit, repair and track every deposit with expiry runway and renewal drafts.' },
  { icon: ShieldCheck, title: 'Officer command centre', body: 'Review queue, fraud graph, risk holds, releases, audit and policy settings.' },
  { icon: Landmark, title: 'Bank proof desk', body: 'Publish daily ECDSA proofs that deposits remain locked — no customer data.' },
  { icon: Fingerprint, title: 'Public explorer', body: 'Verify a fingerprint, trace the chain and see a tamper mismatch without an account.' },
  { icon: History, title: 'Reminders & time machine', body: 'Real reminder logic, renewal PDF drafts and a deterministic scenario clock.' },
  { icon: WifiOff, title: 'Offline-first queue', body: 'IndexedDB-backed submissions replay in order with idempotent duplicate checks.' },
]

const COMPARISON = [
  ['Evidence', 'Photocopies, email threads, spreadsheets', 'SHA-256 document hash + financial fingerprint'],
  ['Verification', 'An officer reads every receipt by eye', 'Three explainable experts + 10% human sampling'],
  ['Maturity', 'A calendar reminder someone may miss', 'Automatic 60/30-day reminders, then escalation'],
  ['Release', 'One approver and a forwarding email', 'AI key + officer key + voice factor for high value'],
  ['Bank proof', 'A branch letter on letterhead', 'Daily ECDSA locked-balance proof with no PII'],
  ['Audit', 'Reconstruct the story from files', 'Append-only hash chain, verifiable and exportable'],
]

const FAQ = [
  {
    q: 'Is this actually on a blockchain?',
    a: 'The in-app ledger is a real SHA-256 hash chain in your browser so the demo works offline. A Solidity contract (FDRLedger.sol) and Hardhat deployment script for Polygon Amoy are included; when VITE_CONTRACT_ADDRESS is configured the interface labels the network instead of the in-app chain.',
  },
  {
    q: 'Does the AI decide whether a deposit is genuine?',
    a: 'No. The three experts produce a probabilistic score in three bands. High-confidence records can be auto-accepted with 10% human sampling, medium records go to an officer, and low records are rejected with reasons. A human path always exists.',
  },
  {
    q: 'Are the bank integrations real?',
    a: 'No. Account Aggregator consent and fetch are deterministic sandbox routes, and bank proofs are signed locally with ECDSA P-256. Every simulated surface is labelled in the interface. Real integrations would require Setu/AA credentials and a bank agent key store.',
  },
  {
    q: 'What personal data goes to the ledger?',
    a: 'Only a cryptographic fingerprint of the deposit identity, an optional document hash, the event type and a timestamp. Names, FDR numbers, amounts and bank details stay off-chain. The public explorer deliberately omits financial fields.',
  },
  {
    q: 'What happens when the network fails?',
    a: 'The institution can continue submitting. Each submission is written to an IndexedDB queue with an idempotency key, then replayed in order when the connection returns. The queue survives a page reload.',
  },
  {
    q: 'How do I reset the scenario?',
    a: 'Use the reset control in the demo toolbar at the bottom of the app or explorer. It rebuilds the seeded 40-FDR scenario, fresh bank proofs and the hash chain. No production data exists in this prototype.',
  },
]

const TONE_RING = {
  olive: 'border-olive/30 bg-olive/10 text-olive',
  red: 'border-danger/25 bg-danger/10 text-danger',
  amber: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

export default function Landing() {
  const t = useT()
  const navigate = useNavigate()
  const role = useStore((s) => s.role)
  const tamperDemo = useStore((s) => s.tamperDemo)
  const openGuided = useUi((s) => s.openGuided)
  const [openFaq, setOpenFaq] = useState(0)

  const startTamper = () => {
    const id = tamperDemo()
    navigate(id ? `/explorer?tampered=${id}` : '/explorer')
  }

  return (
    <div className="min-h-dvh bg-paper">
      <PublicNav />
      <main id="main">
        {/* Hero */}
        <section className="paper-grain warm-glow relative overflow-hidden border-b border-line">
          <div className="container-x relative py-16 sm:py-24 lg:py-28">
            <div className="grid items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {t('home.eyebrow')}
                  </span>
                  <SimBadge>Prototype</SimBadge>
                </div>

                <motion.h1
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                  className="display mt-6 text-[46px] sm:text-[64px] lg:text-[76px]"
                >
                  Deposits you can <em className="serif-accent">prove.</em>
                  <br />
                  Releases you can trust.
                </motion.h1>

                <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-muted text-pretty">
                  {t('home.sub')}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-2.5">
                  <Button size="lg" onClick={() => navigate(role ? '/app' : '/login')}>
                    {role ? 'Open my workspace' : t('home.cta')} <ArrowRight size={16} />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate('/explorer')}>
                    <Fingerprint size={16} /> {t('home.cta2')}
                  </Button>
                  <button
                    type="button"
                    onClick={() => openGuided(0)}
                    className="btn-ghost btn-sm"
                  >
                    <Sparkles size={14} /> Guided story
                  </button>
                </div>

                <p className="mt-5 text-[13px] font-semibold text-ink">
                  {t('home.promise')} <span className="font-normal text-muted">Every score is explainable. A human can disagree.</span>
                </p>

                <div className="mt-9 grid max-w-lg grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface/70">
                  {[
                    ['40', 'seeded FDRs'],
                    ['12', 'institutions'],
                    ['8', 'banks'],
                  ].map(([value, label]) => (
                    <div key={label} className="px-4 py-3.5">
                      <p className="text-xl font-semibold tracking-[-0.04em]">{value}</p>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-muted/80">Illustrative seeded dataset. Design targets, not measured results.</p>
              </div>

              <HeroLedger />
            </div>
          </div>
        </section>

        {/* Problem vs solution */}
        <section className="section-pad">
          <div className="container-x">
            <SectionHead
              eyebrow="Why this exists"
              title={
                <>
                  The deposit file is <em className="serif-accent">scattered.</em> The release decision should not be.
                </>
              }
              description="Security deposits sit across receipts, spreadsheets and email chains. Samarth Ledger makes the evidence verifiable and the release deliberate."
            />

            <div className="mt-10 overflow-hidden rounded-3xl border border-line bg-surface">
              <div className="grid grid-cols-[1.1fr_1.2fr_1.35fr] border-b border-line bg-paper/60 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-muted sm:px-6">
                <span>Control</span>
                <span className="hidden sm:block">Manual process today</span>
                <span>With Samarth Ledger</span>
              </div>
              {COMPARISON.map(([label, before, after], i) => (
                <div
                  key={label}
                  className={cn(
                    'grid grid-cols-[1.1fr_1.35fr] items-start gap-4 px-4 py-4 sm:grid-cols-[1.1fr_1.2fr_1.35fr] sm:px-6',
                    i !== COMPARISON.length - 1 && 'border-b border-line/70',
                  )}
                >
                  <span className="text-[12px] font-bold sm:text-[13px]">{label}</span>
                  <span className="hidden text-[12px] leading-relaxed text-muted sm:block">{before}</span>
                  <span className="flex items-start gap-2 text-[12px] font-medium leading-relaxed">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-olive" />
                    {after}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="section-pad scroll-mt-24 border-y border-line bg-surface/50">
          <div className="container-x">
            <SectionHead
              eyebrow="One loop, four moves"
              title={
                <>
                  From a phone photo to a <em className="serif-accent">two-key</em> release.
                </>
              }
              description="Every stage is present in the prototype and every stage shows its work."
            />

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ delay: i * 0.06, duration: 0.45 }}
                  className="card relative overflow-hidden p-5"
                >
                  <span className="absolute right-4 top-4 font-mono text-[10px] font-semibold text-muted/60">
                    0{i + 1}
                  </span>
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
                    <step.icon size={20} />
                  </span>
                  <h3 className="mt-5 text-[15px] font-semibold tracking-[-0.02em]">{step.title}</h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted">{step.body}</p>
                </motion.div>
              ))}
            </div>

            <InlineNote className="mt-5" tone="accent" icon={Sparkles}>
              The weakest expert is always shown alongside the final score. Nothing is hidden behind a single “AI says yes”.
            </InlineNote>
          </div>
        </section>

        {/* Modules */}
        <section className="section-pad">
          <div className="container-x">
            <SectionHead
              eyebrow="The product surface"
              title="Six modules. One shared truth."
              description="Each role sees only what it needs. All of them read the same ledger-backed record."
              action={
                <Button variant="outline" onClick={() => navigate(role ? '/app' : '/login')}>
                  Explore the workspaces <ArrowUpRight size={15} />
                </Button>
              }
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m) => (
                <Card key={m.title} className="card-lift p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-paper">
                    <m.icon size={18} />
                  </span>
                  <h3 className="mt-4 text-[14px] font-semibold">{m.title}</h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted">{m.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Trust model */}
        <section id="trust" className="section-pad scroll-mt-24 border-y border-line bg-ink text-paper">
          <div className="container-x">
            <div className="max-w-2xl">
              <p className="eyebrow text-paper/40">Trust model</p>
              <h2 className="display mt-3 text-3xl sm:text-4xl lg:text-[46px]">
                Three opinions. Two keys. <em className="serif-accent text-ember">One human.</em>
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-paper/60">
                The score is a signal, never a verdict. Each expert publishes its reasons, and the release contract refuses to
                move with only one signature.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {[
                {
                  icon: Eye,
                  title: 'Eye',
                  role: 'Document & image forensics',
                  score: 95,
                  reasons: ['Laplacian focus is in the clean-scan range', 'ELA is flat; no dense edit cluster', 'No image-editor metadata tag'],
                },
                {
                  icon: FileSearch,
                  title: 'Reader',
                  role: 'OCR & field consistency',
                  score: 97,
                  reasons: ['FDR number matches the bank rule', 'Amount and maturity agree with declared fields', 'OCR confidence 91%'],
                },
                {
                  icon: History,
                  title: 'Memory',
                  role: 'History & network patterns',
                  score: 98,
                  reasons: ['No duplicate fingerprint in 40 records', 'No shared suspicious signatory', 'No fraud-ring overlap'],
                },
              ].map((expert) => (
                <div key={expert.title} className="rounded-3xl border border-paper/12 bg-paper/[0.04] p-5">
                  <div className="flex items-start justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-paper/10 text-ember">
                      <expert.icon size={18} />
                    </span>
                    <span className="font-mono text-2xl font-semibold">{expert.score}</span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{expert.title}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-paper/40">{expert.role}</p>
                  <ul className="mt-4 space-y-2">
                    {expert.reasons.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-[11px] leading-relaxed text-paper/60">
                        <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-ember" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <div className="rounded-3xl border border-paper/12 bg-paper/[0.04] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-paper/40">The double lock</p>
                    <p className="mt-1 text-lg font-semibold">No single actor can move money</p>
                  </div>
                  <SimBadge className="border-paper/25 bg-paper/10 text-paper/60">Contract behaviour</SimBadge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="rounded-2xl border border-paper/12 bg-paper/[0.04] p-4">
                    <div className="flex items-center gap-2 text-ember"><Sparkles size={14} /><span className="text-[10px] font-bold uppercase tracking-[0.12em]">Key 1</span></div>
                    <p className="mt-2 text-sm font-semibold">AI release agent</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-paper/50">Only signs when maturity, grievance, compliance, risk, limit and pause rules pass.</p>
                  </div>
                  <div className="hidden text-paper/30 sm:block"><LockKeyhole size={18} /></div>
                  <div className="rounded-2xl border border-paper/12 bg-paper/[0.04] p-4">
                    <div className="flex items-center gap-2 text-ember"><UserCheck size={14} /><span className="text-[10px] font-bold uppercase tracking-[0.12em]">Key 2</span></div>
                    <p className="mt-2 text-sm font-semibold">AICTE officer</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-paper/50">Passkey/WebAuthn where available, a demo signature otherwise. High value adds a voice challenge.</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-paper/50">
                  {['High band 98–100', '10% human sampling', 'Voice ≥ ₹10 L', 'Emergency pause'].map((chip) => (
                    <span key={chip} className="rounded-full border border-paper/15 px-2.5 py-1">{chip}</span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-paper/12 bg-paper/[0.04] p-5 sm:p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-paper/40">Bands</p>
                <div className="mt-4 space-y-3">
                  {[
                    ['High', '98–100', 'Auto-accept; 10% sampling', 'text-ember'],
                    ['Medium', '60–97', 'Officer review with reasons', 'text-amber-300'],
                    ['Low', '0–59', 'Reject; ask for original/AA', 'text-red-300'],
                  ].map(([band, range, action, tone]) => (
                    <div key={band} className="flex items-center justify-between gap-3 border-b border-paper/10 pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className={cn('text-sm font-semibold', tone)}>{band}</p>
                        <p className="text-[10px] text-paper/45">{action}</p>
                      </div>
                      <span className="font-mono text-xs text-paper/60">{range}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[10px] leading-relaxed text-paper/40">{HONESTY.ai}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Samples */}
        <section id="samples" className="section-pad scroll-mt-24">
          <div className="container-x">
            <SectionHead
              eyebrow="Test documents"
              title={
                <>
                  Three receipts that <em className="serif-accent">test</em> the system.
                </>
              }
              description="Download the built-in fixtures or load them inside the wizard. The printed document and the OCR reference agree, so the outcome is reproducible."
              action={
                <Button variant="outline" onClick={() => navigate(role ? '/app/institution/new?sample=genuine' : '/login')}>
                  Try them in the wizard <ArrowRight size={15} />
                </Button>
              }
            />

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {SAMPLE_LIST.map((sample) => (
                <Card key={sample.kind} className="overflow-hidden">
                  <div className="relative aspect-[3/2] overflow-hidden border-b border-line bg-paper">
                    <img
                      src={`/samples/${sample.kind}.png`}
                      alt={`${sample.title} test receipt`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className={cn('absolute left-3 top-3 chip backdrop-blur', TONE_RING[sample.tone])}>{sample.outcome}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-base font-semibold">{sample.title}</h3>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{sample.description}</p>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <a
                        href={`/samples/${sample.kind}.png`}
                        download={`${sample.kind}-fdr.png`}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-accent hover:underline"
                      >
                        <Download size={13} /> Download PNG
                      </a>
                      <span className="text-[10px] text-muted">Built-in fixture</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ['Genuine', 'High confidence', 'Auto-accept with a small human sample.'],
                ['Edited', 'Low confidence', 'Rejected with ELA, amount and duplicate reasons.'],
                ['Blurry', 'Medium confidence', 'Routed to an officer instead of guessing.'],
              ].map(([name, band, copy]) => (
                <div key={name} className="rounded-2xl border border-line bg-surface/60 px-4 py-3">
                  <p className="text-[11px] font-bold">{name} <span className="font-normal text-muted">· {band}</span></p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted">{copy}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-muted">
              Sample images are generated for this prototype. When the OCR engine is unavailable, the labelled fixture values are used
              as the Reader reference and the UI says so.
            </p>
          </div>
        </section>

        {/* Tamper demo */}
        <section className="pb-20 sm:pb-28">
          <div className="container-x">
            <div className="overflow-hidden rounded-[2rem] border border-line bg-ink text-paper">
              <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1fr] lg:items-center">
                <div>
                  <Eyebrow className="text-paper/40">Integrity, demonstrated</Eyebrow>
                  <h2 className="display mt-3 text-3xl sm:text-[40px]">
                    Edit the record. <em className="serif-accent text-ember">Break the proof.</em>
                  </h2>
                  <p className="mt-4 max-w-lg text-sm leading-relaxed text-paper/60">
                    The demo changes an off-chain amount by ₹2,50,000 without touching the anchored fingerprint. Recompute the chain
                    and the mismatch is explicit — no silent repair, no green checkmark.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <Button onClick={startTamper} variant="primary">
                      <TriangleAlert size={15} /> Run the tamper demo
                    </Button>
                    <Button onClick={() => navigate('/explorer')} variant="outline" className="border-paper/20 text-paper hover:bg-paper/10">
                      <Fingerprint size={15} /> Open the explorer
                    </Button>
                  </div>
                  <p className="mt-3 text-[10px] text-paper/40">Simulated edit on illustrative seeded data. Restore it from the explorer.</p>
                </div>

                <div className="rounded-3xl border border-paper/12 bg-paper/[0.04] p-4 sm:p-5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-paper/40">
                    <span>Append-only chain</span>
                    <span className="flex items-center gap-1.5 text-ember"><Radio size={11} /> demo</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {[
                      ['BLK-0041', 'FDR_REGISTERED', '9f2c8d…a71e', 'ok'],
                      ['BLK-0042', 'DOC_ANCHORED', '41bd07…f0c2', 'ok'],
                      ['BLK-0043', 'RELEASED', '7e13aa…91d4', 'ok'],
                    ].map(([id, type, hash, _status], i) => (
                      <div key={id} className="flex items-center gap-3 rounded-2xl border border-paper/10 bg-paper/[0.03] px-3 py-2.5">
                        <span className="font-mono text-[9px] text-paper/35">{id}</span>
                        <span className="flex-1 text-[11px] font-semibold">{type}</span>
                        <span className="font-mono text-[9px] text-paper/45">{hash}</span>
                        {i === 2 ? (
                          <span className="rounded-full bg-danger/20 px-2 py-0.5 text-[9px] font-bold text-red-200">mismatch</span>
                        ) : (
                          <CheckCircle2 size={13} className="text-ember" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-2xl border border-danger/25 bg-danger/10 px-3 py-2.5">
                    <p className="font-mono text-[10px] font-semibold text-red-200">fingerprint mismatch</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-paper/50">
                      anchored 9f2c8d…a71e · recomputed 3b70fe…2dd1
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Numbers / honesty */}
        <section className="border-y border-line bg-surface/60 py-14">
          <div className="container-x">
            <div className="grid gap-8 md:grid-cols-[0.9fr_1.4fr] md:items-center">
              <div>
                <Eyebrow>Design targets</Eyebrow>
                <h2 className="display mt-3 text-3xl">A prototype, <em className="serif-accent">measured honestly.</em></h2>
                <p className="mt-3 text-[12px] leading-relaxed text-muted">
                  These are seeded demo figures and policy defaults, not production outcomes. The interface labels every simulated
                  surface so judges can tell what is real.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['60/30', 'day reminders'],
                  ['10%', 'human sampling'],
                  ['2', 'required release keys'],
                  ['₹5 Cr', 'illustrative pre-approval limit'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-line bg-paper/70 px-4 py-4">
                    <p className="text-2xl font-semibold tracking-[-0.045em]">{value}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.09em] text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section-pad">
          <div className="container-x grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <Eyebrow>Questions judges ask</Eyebrow>
              <h2 className="display mt-3 text-3xl sm:text-4xl">
                What is <em className="serif-accent">real</em> here?
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                The document pipeline, hashes, hash chain, ECDSA proofs, offline queue, reminders and double-lock rules execute in the
                browser. Bank and AA integrations are sandbox simulations.
              </p>
              <div className="mt-5 space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-muted"><BadgeCheck size={14} className="text-olive" /> Real browser processing</div>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-muted"><Banknote size={14} className="text-accent" /> Simulated bank / AA rails</div>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-muted"><FileCheck2 size={14} className="text-olive" /> Included Solidity contract</div>
              </div>
            </div>

            <div className="divide-y divide-line rounded-3xl border border-line bg-surface">
              {FAQ.map((item, i) => {
                const open = openFaq === i
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? -1 : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      aria-expanded={open}
                    >
                      <span className="text-[13px] font-semibold">{item.q}</span>
                      <ChevronDown size={16} className={cn('shrink-0 text-muted transition', open && 'rotate-180')} />
                    </button>
                    {open && <p className="px-5 pb-4 text-[12px] leading-relaxed text-muted">{item.a}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-20 sm:pb-28">
          <div className="container-x">
            <div className="paper-grain warm-glow relative overflow-hidden rounded-[2rem] border border-line px-6 py-12 text-center sm:px-12 sm:py-16">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink text-paper"><ShieldCheck size={22} /></span>
              <h2 className="display mx-auto mt-5 max-w-2xl text-3xl sm:text-[44px]">
                Open the demo. Break the chain. <em className="serif-accent">Then decide.</em>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
                Three roles, one seeded institution, 40 deposits and a guided path through every control. No credentials required.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-2.5">
                <Button size="lg" onClick={() => navigate(role ? '/app' : '/login')}>
                  {role ? 'Return to my workspace' : 'Step into the demo'} <ArrowRight size={16} />
                </Button>
                <Button size="lg" variant="outline" onClick={() => openGuided(0)}>
                  <Sparkles size={16} /> Start the guided story
                </Button>
              </div>
              <p className="mt-5 text-[10px] text-muted">AICTE · Smart India Hackathon prototype · illustrative data only</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function HeroLedger() {
  return (
    <div className="relative mx-auto w-full max-w-[470px]">
      <div className="absolute inset-0 -z-10 grid-lines rounded-[2rem]" />
      <motion.div
        initial={{ opacity: 0, y: 24, rotate: -1.2 }}
        animate={{ opacity: 1, y: 0, rotate: -1.2 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="card relative overflow-hidden p-5 shadow-lift sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent"><Fingerprint size={17} /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Ledger pass</p>
              <p className="font-mono text-[12px] font-semibold">FDR-2026-0021</p>
            </div>
          </div>
          <span className="chip border-olive/25 bg-olive/10 text-olive"><span className="h-1.5 w-1.5 rounded-full bg-current" /> Verified</span>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-paper/60 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Principal · illustrative</p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.05em]">{formatINR(9200000)}</p>
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
            <span>State Bank of India · Bengaluru Main</span>
            <span className="font-mono">matures 2027</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ['Eye', 95],
            ['Reader', 97],
            ['Memory', 98],
          ].map(([label, score]) => (
            <div key={label} className="rounded-xl border border-line bg-surface px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
              <p className="mt-1 text-lg font-semibold">{score}</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-line/70">
                <div className="h-full rounded-full bg-accent" style={{ width: `${score}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-olive/10 text-olive"><Sparkles size={13} /></span>
            <div>
              <p className="text-[10px] font-bold">Key 1 · AI agent</p>
              <p className="font-mono text-[9px] text-muted">signed · rules 6/6</p>
            </div>
          </div>
          <span className="h-5 w-px bg-line" />
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/10 text-accent"><UserCheck size={13} /></span>
            <div>
              <p className="text-[10px] font-bold">Key 2 · officer</p>
              <p className="font-mono text-[9px] text-muted">passkey · released</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="font-mono text-[9px] text-muted">9f2c8d41…a71e</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">SHA-256 · anchored</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -14, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        className="absolute -bottom-5 -left-3 w-[230px] rounded-2xl border border-danger/25 bg-surface p-3 shadow-lift sm:-left-8"
      >
        <div className="flex items-center gap-2 text-danger"><TriangleAlert size={14} /><span className="text-[10px] font-bold uppercase tracking-[0.1em]">Fingerprint mismatch</span></div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted">₹2,50,000 edited off-chain. Recomputed hash does not match the anchored block.</p>
      </motion.div>

      <div className="absolute -right-2 -top-4 rounded-full border border-line bg-surface px-3 py-1.5 shadow-soft sm:-right-4">
        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
          <LockKeyhole size={11} className="text-accent" /> Human in the loop
        </span>
      </div>
    </div>
  )
}
