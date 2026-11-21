import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  CircleAlert,
  CloudUpload,
  FileImage,
  Fingerprint,
  Info,
  Landmark,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ScanLine,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Eyebrow,
  Field,
  InlineNote,
  Input,
  Select,
  SimBadge,
  Textarea,
} from '../../components/ui/primitives'
import ScoreDial from '../../components/fdr/ScoreDial'
import ExpertCards from '../../components/fdr/ExpertCards'
import { useStore } from '../../store/useStore'
import { toast } from '../../store/useToast'
import { BANKS, COLLEGES } from '../../data/seed'
import { SAMPLE_FIXTURES, SAMPLE_LIST, fetchSampleFile } from '../../lib/samples'
import { processDocument } from '../../lib/image'
import { runOcr } from '../../lib/ocr'
import { runForensicCheck } from '../../lib/forensic'
import { apiPost } from '../../lib/api'
import { sha256Hex } from '../../lib/hash'
import { addDays, cn, formatDate, formatINR, isoDate } from '../../lib/utils'

const WIZARD = [
  { key: 'details', label: 'Deposit details', icon: FileImage },
  { key: 'evidence', label: 'Evidence & check', icon: ScanLine },
  { key: 'review', label: 'Review & submit', icon: Send },
]

const emptyForm = () => ({
  bankId: 'hdfc',
  fdNumber: '',
  amount: '',
  issueDate: isoDate(addDays(new Date(), -365)),
  maturityDate: isoDate(addDays(new Date(), 365)),
  signatory: '',
  interestRate: '7.2',
  branch: BANKS.find((b) => b.id === 'hdfc')?.branch || '',
  notes: '',
})

function formFromFixture(fixture) {
  return {
    bankId: fixture.bankId,
    fdNumber: fixture.fdNumber,
    amount: String(fixture.amount),
    issueDate: fixture.issueDate,
    maturityDate: fixture.maturityDate,
    signatory: fixture.signatory,
    interestRate: String(fixture.interestRate),
    branch: fixture.branch,
    notes: '',
  }
}

function bandTone(band) {
  return band === 'high' ? 'olive' : band === 'low' ? 'red' : 'amber'
}

export default function NewFdr() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialKind = params.get('sample')
  const initialFixture = SAMPLE_FIXTURES[initialKind] || null

  const user = useStore((s) => s.user)
  const fdrs = useStore((s) => s.fdrs)
  const settings = useStore((s) => s.settings)
  const addFdr = useStore((s) => s.addFdr)
  const offline = useStore((s) => s.offline)

  const [step, setStep] = useState(0)
  const [route, setRoute] = useState('upload')
  const [sampleKind, setSampleKind] = useState(initialFixture ? initialKind : null)
  const [form, setForm] = useState(initialFixture ? formFromFixture(initialFixture) : emptyForm)
  const [errors, setErrors] = useState({})
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const [stage, setStage] = useState({ label: '', pct: 0 })
  const [imageResult, setImageResult] = useState(null)
  const [_ocrResult, setOcrResult] = useState(null)
  const [decision, setDecision] = useState(null)
  const [consent, setConsent] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [_aaLoading, setAaLoading] = useState(false)

  const bank = BANKS.find((b) => b.id === form.bankId)
  const college = COLLEGES.find((c) => c.id === user?.orgId) || COLLEGES[0]

  const patternOk = useMemo(() => {
    if (!bank?.pattern || !form.fdNumber) return true
    try {
      return new RegExp(bank.pattern, 'i').test(form.fdNumber.replace(/\s+/g, '').toUpperCase())
    } catch {
      return true
    }
  }, [bank, form.fdNumber])

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (initialFixture) {
      toast(`Loaded the built-in “${initialFixture.label}” fixture. Values are pre-filled; the image is still processed for real.`, {
        tone: 'default',
      })
    }
    // Only announce once on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const chooseBank = (id) => {
    const chosen = BANKS.find((b) => b.id === id)
    setForm((f) => ({ ...f, bankId: id, branch: chosen?.branch || f.branch }))
  }

  const chooseSample = (kind) => {
    const fixture = SAMPLE_FIXTURES[kind]
    setSampleKind(kind)
    setForm(formFromFixture(fixture))
    setFile(null)
    setDecision(null)
    setImageResult(null)
    setOcrResult(null)
    setError('')
    toast(`Loaded sample: ${fixture.label}. Continue to run the real pipeline.`, { tone: 'default' })
  }

  const onFile = (picked) => {
    if (!picked) return
    if (!/^image\/(png|jpe?g|webp)$/i.test(picked.type)) {
      toast('Use a PNG, JPEG or WebP image of the FDR receipt.', { tone: 'warning' })
      return
    }
    if (picked.size > 12 * 1024 * 1024) {
      toast('That image is larger than 12 MB. Compress it or use the AA route.', { tone: 'warning' })
      return
    }
    setSampleKind(null)
    setFile(picked)
    setDecision(null)
    setImageResult(null)
    setOcrResult(null)
    setError('')
  }

  const validateDetails = () => {
    const next = {}
    if (!form.fdNumber.trim()) next.fdNumber = 'Enter the FD number printed on the receipt.'
    if (!form.amount || Number(form.amount) < 100000) next.amount = 'Enter a principal of at least ₹1,00,000.'
    if (!form.signatory.trim()) next.signatory = 'Name the authorised signatory.'
    if (!form.branch.trim()) next.branch = 'Enter the issuing branch.'
    if (!form.issueDate) next.issueDate = 'Choose the issue date.'
    if (!form.maturityDate) next.maturityDate = 'Choose the maturity date.'
    if (form.issueDate && form.maturityDate && form.issueDate >= form.maturityDate) {
      next.maturityDate = 'Maturity must be after the issue date.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const continueFromDetails = () => {
    if (!validateDetails()) {
      toast('Fix the highlighted fields before continuing.', { tone: 'warning' })
      return
    }
    setStep(1)
  }

  const declared = {
    collegeId: user?.orgId || 'COL-RVCE',
    bankId: form.bankId,
    fdNumber: form.fdNumber.replace(/\s+/g, '').toUpperCase(),
    amount: Number(form.amount),
    issueDate: form.issueDate,
    maturityDate: form.maturityDate,
    signatory: form.signatory,
    branch: form.branch,
  }

  const runUploadCheck = async () => {
    setBusy(true)
    setError('')
    setDecision(null)
    try {
      const sourceFile = file || (sampleKind ? await fetchSampleFile(sampleKind) : null)
      if (!sourceFile) throw new Error('Add a document or pick a built-in sample first.')

      setStage({ label: 'Decoding image and honouring camera orientation', pct: 4 })
      const processed = await processDocument(sourceFile, {
        onStep: (s) => setStage({ label: s.label, pct: Math.round(s.pct * 0.52) }),
      })
      setImageResult(processed)
      if (processed.quality.tooBlurry) {
        toast('Focus is below the capture guide. The result will ask for a human decision.', { tone: 'warning' })
      }

      setStage({ label: 'Reading printed fields with OCR', pct: 56 })
      const ocr = await runOcr(processed.cleaned, {
        onProgress: (p) => setStage({ label: `Reading printed fields with OCR · ${p}%`, pct: 56 + Math.round(p * 0.22) }),
      })
      setOcrResult(ocr)
      if (!ocr.ok) {
        toast('OCR engine unavailable. The sample fixture values will be labelled if one applies.', { tone: 'warning' })
      }

      setStage({ label: 'Comparing Eye, Reader and Memory signals', pct: 82 })
      const result = await runForensicCheck({
        imageResult: processed,
        ocrResult: ocr,
        declared,
        existingFdrs: fdrs,
        sampleKind,
        settings,
        college,
        onStage: (label) => setStage({ label, pct: 90 }),
      })
      setStage({ label: 'Building the explainable decision', pct: 97 })
      setImageResult(processed)
      setOcrResult(ocr)
      setDecision(result)
      setStage({ label: 'Check complete', pct: 100 })
      setStep(2)
      toast(`Check complete · trust ${result.score}/100 · ${result.decision.label}`, {
        tone: result.decision.band === 'low' ? 'danger' : result.decision.band === 'high' ? 'success' : 'warning',
      })
    } catch (err) {
      setError(err?.message || 'The document check could not finish.')
      toast('The check could not finish. Try another file or the AA sandbox route.', { tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const runAaCheck = async () => {
    setBusy(true)
    setAaLoading(true)
    setError('')
    setDecision(null)
    try {
      setStage({ label: 'Recording purpose-limited consent', pct: 12 })
      const consentRes = await apiPost('/api/aa/consent', {
        institutionId: declared.collegeId,
        bankId: declared.bankId,
        purpose: 'FDR verification for AICTE security-deposit compliance',
        ttlHours: 24,
        requestedBy: user?.person,
      })
      const consentRecord = consentRes?.ok && consentRes.consent
        ? consentRes.consent
        : {
            id: `CNS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            provider: 'AA sandbox (local fallback)',
            purpose: 'FDR verification for AICTE security-deposit compliance',
            grantedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            dataRange: 'FD account summary · no transaction history',
            simulated: true,
          }
      setConsent(consentRecord)

      setStage({ label: 'Fetching the consented deposit record', pct: 38 })
      const fetchRes = await apiPost('/api/aa/fetch', {
        consentId: consentRecord.id,
        institutionId: declared.collegeId,
        bankId: declared.bankId,
        fdNumber: declared.fdNumber,
      })
      const record = fetchRes?.ok ? fetchRes.record : null

      const fetched = {
        fdNumber: record?.fdNumber || declared.fdNumber,
        amount: Number(record?.amount || declared.amount),
        issueDate: record?.issueDate || declared.issueDate,
        maturityDate: record?.maturityDate || declared.maturityDate,
        bankId: record?.bankId || declared.bankId,
      }

      setStage({ label: 'Scoring consented data without a document', pct: 62 })
      const hash = await sha256Hex(
        ['AA', consentRecord.id, fetched.bankId, fetched.fdNumber, fetched.amount, fetched.issueDate, fetched.maturityDate].join('|'),
      )
      const syntheticImage = {
        hash,
        quality: { blurScore: 420, brightness: 128, contrast: 42, tooBlurry: false },
        ela: { mean: 1.8, max: 18, hotspots: 0, heatmap: null, overlay: null },
        metadata: { software: null, make: null, model: null, parser: 'aa-sandbox' },
        cleaned: null,
        original: null,
        fileName: 'AA consented record',
      }
      const syntheticOcr = {
        ok: true,
        engine: 'AA sandbox (simulated fetch)',
        confidence: record?.confidence || 96,
        text: '',
        fields: {
          ...fetched,
          textLength: 480,
          fdNumber: fetched.fdNumber,
          amount: fetched.amount,
        },
      }

      setStage({ label: 'Running the same three-expert scorer', pct: 78 })
      const result = await runForensicCheck({
        imageResult: syntheticImage,
        ocrResult: syntheticOcr,
        declared: { ...declared, ...fetched },
        existingFdrs: fdrs,
        sampleKind: null,
        settings,
        college,
        onStage: (label) => setStage({ label, pct: 88 }),
      })
      setImageResult(syntheticImage)
      setOcrResult(syntheticOcr)
      setDecision(result)
      setStage({ label: 'Consented record verified', pct: 100 })
      setStep(2)
      toast(`AA sandbox check complete · trust ${result.score}/100`, {
        tone: result.decision.band === 'low' ? 'danger' : result.decision.band === 'high' ? 'success' : 'warning',
      })
    } catch (err) {
      setError(err?.message || 'The AA sandbox route could not finish.')
      toast('The AA sandbox route could not finish.', { tone: 'danger' })
    } finally {
      setBusy(false)
      setAaLoading(false)
    }
  }

  const submit = async () => {
    if (!decision || submitting) return
    setSubmitting(true)
    try {
      const experts = Object.fromEntries(
        (decision.experts || []).map((e) => [e.key, { score: e.score, reasons: e.reasons, name: e.name, role: e.role }]),
      )
      const documents =
        route === 'aa'
          ? []
          : [
              {
                name: sampleKind ? `${sampleKind}_${form.fdNumber}.png` : file?.name || 'upload.jpg',
                kind: sampleKind || 'upload',
                url: sampleKind ? `/samples/${sampleKind}.png` : imageResult?.cleaned || null,
                hash: imageResult?.hash || null,
                isSample: Boolean(sampleKind),
                metadata: imageResult?.metadata || null,
                quality: imageResult?.quality || null,
                ela: imageResult?.ela
                  ? { mean: imageResult.ela.mean, max: imageResult.ela.max, hotspots: imageResult.ela.hotspots }
                  : null,
              },
            ]
      const result = await addFdr({
        ...declared,
        source: route === 'aa' ? 'aa' : 'upload',
        decision,
        reasons: experts,
        documents,
        consent,
        notes: form.notes,
        diagnostics: {
          score: decision.score,
          band: decision.decision?.band,
          action: decision.decision?.action,
          label: decision.decision?.label,
          explanation: decision.decision?.explanation,
          sampled: decision.sampled,
          mode: decision.mode,
          caveats: decision.caveats,
          experts: decision.experts,
          comparison: decision.comparison,
          readerEngine: decision.readerEngine,
          generatedAt: decision.generatedAt,
          image: imageResult
            ? {
                hash: imageResult.hash,
                quality: imageResult.quality,
                ela: imageResult.ela
                  ? { mean: imageResult.ela.mean, max: imageResult.ela.max, hotspots: imageResult.ela.hotspots }
                  : null,
                metadata: imageResult.metadata,
              }
            : null,
        },
      })
      setSubmitted({ ...result, fdNumber: declared.fdNumber, amount: declared.amount, band: decision.decision?.band })
      toast(`${result.id} submitted. Fingerprint anchored for accepted records.`, {
        tone: result.status === 'rejected' ? 'danger' : 'success',
      })
    } catch (err) {
      toast(err?.message || 'Submission failed.', { tone: 'danger' })
    } finally {
      setSubmitting(false)
    }
  }

  const resetAll = () => {
    setSubmitted(null)
    setDecision(null)
    setImageResult(null)
    setOcrResult(null)
    setConsent(null)
    setFile(null)
    setSampleKind(null)
    setForm(emptyForm())
    setErrors({})
    setStep(0)
    setError('')
  }

  if (submitted) {
    const tone = submitted.status === 'rejected' ? 'danger' : submitted.status === 'under_review' ? 'warning' : 'olive'
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Card className="overflow-hidden">
          <div className="border-b border-line bg-gradient-to-br from-accent/[0.07] to-transparent px-6 py-8 text-center">
            <span
              className={cn(
                'mx-auto grid h-14 w-14 place-items-center rounded-2xl',
                submitted.status === 'rejected' ? 'bg-danger/10 text-danger' : 'bg-olive/10 text-olive',
              )}
            >
              {submitted.status === 'rejected' ? <CircleAlert size={26} /> : <CheckCircle2 size={26} />}
            </span>
            <h1 className="display mt-4 text-3xl">
              {submitted.status === 'rejected' ? 'Saved, but not accepted' : 'Submitted and recorded'}
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-muted">
              {submitted.status === 'verified'
                ? 'A high-confidence fingerprint was anchored. The record is now visible in your portfolio.'
                : submitted.status === 'under_review'
                  ? 'A medium-confidence result was placed in the officer queue with the reasons attached.'
                  : 'The low-confidence result was saved with its reasons. Upload a clearer original or use the AA route.'}
            </p>
            <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2">
              <Badge tone={tone}>{submitted.status.replace('_', ' ')}</Badge>
              <Badge tone="sand">{submitted.id}</Badge>
              <Badge tone="ink">{formatINR(submitted.amount, { compact: true })}</Badge>
              <Badge tone={bandTone(submitted.band)}>trust {decision?.score}/100</Badge>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-paper/40 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Decision</p>
              <p className="mt-1 text-sm font-semibold">{decision?.decision?.label}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{decision?.decision?.explanation}</p>
            </div>
            <div className="rounded-2xl border border-line bg-paper/40 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">What happens next</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {submitted.status === 'verified'
                  ? 'Reminders fire at 60 and 30 days before maturity. A release needs both keys.'
                  : submitted.status === 'under_review'
                    ? 'An AICTE officer sees the weakest expert and can approve, reject or request a clearer copy.'
                    : 'The rejection is recorded. Nothing is anchored on the ledger.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line p-4">
            <Button onClick={() => navigate(`/app/institution/fdr/${submitted.id}`)}>
              Open the record <ArrowRight size={14} />
            </Button>
            <Button variant="outline" onClick={resetAll}>
              <RefreshCw size={14} /> Submit another
            </Button>
            <Link to="/app/institution" className="btn-ghost">
              Back to deposits
            </Link>
          </div>
        </Card>
        <InlineNote icon={Info}>
          This record lives on this device and is mirrored to <span className="font-mono">/api/fdrs</span> when the API is available.
          {offline && ' You are in the simulated offline mode, so the submission is queued in IndexedDB for replay.'}
        </InlineNote>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/app/institution" className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink">
            <ArrowLeft size={12} /> My deposits
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Eyebrow>New security deposit</Eyebrow>
            <SimBadge>Demo pipeline</SimBadge>
          </div>
          <h1 className="display mt-2 text-3xl sm:text-[40px]">
            Add an FDR <em className="serif-accent">the verifiable way.</em>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            Upload a receipt for real in-browser forensics, or use the Account Aggregator sandbox to fetch consented data without a document.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <LockKeyhole size={13} />
          Files stay in this browser unless a configured API receives the document hash.
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface/60 p-2.5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
          {WIZARD.map((item, index) => {
            const active = index === step
            const done = index < step
            return (
              <button
                key={item.key}
                type="button"
                disabled={index > step}
                onClick={() => setStep(index)}
                className={cn(
                  'flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2 text-left transition',
                  active ? 'bg-ink text-paper' : done ? 'text-ink hover:bg-ink/[0.04]' : 'text-muted',
                )}
              >
                <span
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                    active ? 'bg-paper/20' : done ? 'bg-olive text-white' : 'bg-ink/[0.06]',
                  )}
                >
                  {done ? <Check size={11} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{item.label}</span>
                {index < WIZARD.length - 1 && <span className="hidden h-px flex-1 bg-line sm:block" />}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
        >
          {step === 0 && (
            <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
              <div className="space-y-4">
                <Card className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Submission route</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <RouteCard
                      active={route === 'upload'}
                      onClick={() => setRoute('upload')}
                      icon={CloudUpload}
                      title="Document upload"
                      tag="Route A"
                      points={['Real crop, deskew and ELA', 'OCR + three-expert score', 'Works offline']}
                    />
                    <RouteCard
                      active={route === 'aa'}
                      onClick={() => {
                        setRoute('aa')
                        setSampleKind(null)
                        setFile(null)
                        if (!form.fdNumber) setForm(formFromFixture(SAMPLE_FIXTURES.genuine))
                      }}
                      icon={Landmark}
                      title="Account Aggregator"
                      tag="Route B · sandbox"
                      points={['No receipt image needed', 'Purpose-limited consent', 'Data-only verification']}
                    />
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Deposit details</p>
                    <span className="chip border-olive/25 bg-olive/10 text-[9px] text-olive">
                      <Building2 size={10} /> {user?.org || 'Demo institution'}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Bank" required hint={`${bank?.branch} · ${bank?.patternNote || 'format not checked'}`}>
                      <Select value={form.bankId} onChange={(e) => chooseBank(e.target.value)}>
                        {BANKS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="FDR number"
                      required
                      hint={patternOk ? 'Matches the expected format' : `Warning: expected ${bank?.patternNote}. The Reader will flag this.`}
                      error={errors.fdNumber}
                    >
                      <Input
                        value={form.fdNumber}
                        onChange={(e) => set('fdNumber', e.target.value.toUpperCase())}
                        placeholder={bank?.prefix ? `${bank.prefix}000000000` : '20100000001'}
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Principal amount (₹)" required error={errors.amount}>
                      <Input
                        type="number"
                        min="100000"
                        step="1000"
                        value={form.amount}
                        onChange={(e) => set('amount', e.target.value)}
                        placeholder="2500000"
                      />
                    </Field>
                    <Field label="Interest rate (% p.a.)" hint="Used in renewal drafts and certificates.">
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        step="0.05"
                        value={form.interestRate}
                        onChange={(e) => set('interestRate', e.target.value)}
                      />
                    </Field>
                    <Field label="Issue date" required error={errors.issueDate}>
                      <Input type="date" value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)} />
                    </Field>
                    <Field label="Maturity date" required error={errors.maturityDate}>
                      <Input type="date" value={form.maturityDate} onChange={(e) => set('maturityDate', e.target.value)} />
                    </Field>
                    <Field label="Authorised signatory" required error={errors.signatory}>
                      <Input
                        value={form.signatory}
                        onChange={(e) => set('signatory', e.target.value)}
                        placeholder="A. Deshpande"
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Issuing branch" required error={errors.branch}>
                      <Input value={form.branch} onChange={(e) => set('branch', e.target.value)} placeholder="Mumbai Fort" />
                    </Field>
                    <Field label="Note for the officer" className="sm:col-span-2" hint="Optional context. The AI decision is not affected.">
                      <Textarea
                        value={form.notes}
                        onChange={(e) => set('notes', e.target.value)}
                        placeholder="e.g. Original receipt is held in the accounts office."
                        className="min-h-[74px]"
                      />
                    </Field>
                  </div>

                  {!patternOk && (
                    <InlineNote tone="accent" icon={CircleAlert} className="mt-3">
                      The FD number does not match the selected bank’s format. You can still continue — this is a real signal the Reader
                      will use, and a human can override the outcome.
                    </InlineNote>
                  )}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                    <p className="flex items-center gap-1.5 text-[10px] text-muted">
                      <ShieldCheck size={11} /> Required fields are checked before the evidence step.
                    </p>
                    <Button onClick={continueFromDetails}>
                      Continue to evidence <ArrowRight size={14} />
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Try a built-in sample</p>
                    <SimBadge>Fixtures</SimBadge>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">
                    Each sample loads declared values for this form. The image is then processed for real, and the expected band is
                    illustrative of the deterministic scorer.
                  </p>
                  <div className="mt-3 space-y-2">
                    {SAMPLE_LIST.map((sample) => {
                      const fixture = SAMPLE_FIXTURES[sample.kind]
                      const active = sampleKind === sample.kind
                      return (
                        <button
                          key={sample.kind}
                          type="button"
                          onClick={() => chooseSample(sample.kind)}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition',
                            active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper/40 hover:border-ink/30',
                          )}
                        >
                          <span
                            className={cn(
                              'grid h-8 w-8 shrink-0 place-items-center rounded-xl',
                              active
                                ? 'bg-paper/15 text-paper'
                                : sample.tone === 'olive'
                                  ? 'bg-olive/10 text-olive'
                                  : sample.tone === 'red'
                                    ? 'bg-danger/10 text-danger'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                            )}
                          >
                            <FileImage size={14} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">{sample.title}</span>
                              {active && <Check size={12} />}
                            </span>
                            <span className={cn('mt-0.5 block text-[10px] leading-relaxed', active ? 'text-paper/65' : 'text-muted')}>
                              {sample.outcome}
                            </span>
                            <span className={cn('mt-1 block font-mono text-[9px]', active ? 'text-paper/45' : 'text-muted/70')}>
                              {fixture.fdNumber} · {formatINR(fixture.amount, { compact: true })}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {sampleKind && (
                    <button type="button" onClick={() => setSampleKind(null)} className="mt-2 text-[10px] font-semibold text-muted hover:text-ink">
                      Clear sample selection
                    </button>
                  )}
                </Card>

                <Card className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">What happens next</p>
                  <ul className="mt-3 space-y-2.5">
                    {[
                      ['Clean-up', 'Crop, deskew, brighten. Real canvas operations.'],
                      ['Read', 'OCR extracts FD number, amount and dates.'],
                      ['Check', 'Eye, Reader and Memory each explain a score.'],
                      ['Decide', 'High auto-accepts with 10% sampling; medium asks a human.'],
                    ].map(([title, body], i) => (
                      <li key={title} className="flex items-start gap-2">
                        <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-[8px] font-bold">
                          {i + 1}
                        </span>
                        <span>
                          <span className="block text-[11px] font-semibold">{title}</span>
                          <span className="block text-[10px] leading-relaxed text-muted">{body}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <InlineNote icon={Info}>
                  All seeded names, banks and amounts are illustrative. AI scores are probabilistic signals, never proof of authenticity.
                </InlineNote>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
              <Card className="p-5">
                {route === 'upload' ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Receipt evidence</p>
                        <p className="mt-1 text-sm font-semibold">Clean, read and score the document</p>
                      </div>
                      <SimBadge>In-browser</SimBadge>
                    </div>

                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOver(true)
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragOver(false)
                        onFile(e.dataTransfer.files?.[0])
                      }}
                      className={cn(
                        'mt-4 rounded-3xl border-2 border-dashed p-5 transition',
                        dragOver ? 'border-accent bg-accent/[0.04]' : 'border-line bg-paper/30',
                      )}
                    >
                      {preview ? (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <img src={preview} alt="Selected receipt" className="max-h-44 w-full rounded-2xl border border-line object-contain sm:w-40" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-semibold">{file?.name}</p>
                            <p className="mt-0.5 text-[10px] text-muted">
                              {(file.size / 1024).toFixed(0)} KB · will be processed locally
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
                                Replace
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setFile(null)
                                  setDecision(null)
                                }}
                              >
                                <X size={12} /> Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : sampleKind ? (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <img
                            src={`/samples/${sampleKind}.png`}
                            alt={`${sampleKind} sample`}
                            className="max-h-44 w-full rounded-2xl border border-line object-contain sm:w-44"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-semibold">{SAMPLE_FIXTURES[sampleKind].label}</p>
                            <p className="mt-1 text-[10px] leading-relaxed text-muted">{SAMPLE_FIXTURES[sampleKind].note}</p>
                            <p className="mt-1.5 text-[10px] text-muted">
                              Expected band: <strong className="uppercase">{SAMPLE_FIXTURES[sampleKind].expected}</strong> · illustrative
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="py-5 text-center">
                          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
                            <CloudUpload size={22} />
                          </span>
                          <p className="mt-3 text-sm font-semibold">Drop a receipt image here</p>
                          <p className="mt-1 text-[11px] text-muted">PNG, JPEG or WebP · up to 12 MB · processed on this device</p>
                          <div className="mt-4 flex flex-wrap justify-center gap-2">
                            <Button size="sm" onClick={() => inputRef.current?.click()}>
                              <FileImage size={13} /> Choose a file
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => chooseSample('genuine')}>
                              <Sparkles size={13} /> Use a sample instead
                            </Button>
                          </div>
                        </div>
                      )}
                      <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(e) => onFile(e.target.files?.[0])}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button onClick={runUploadCheck} disabled={busy || (!file && !sampleKind)}>
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
                        {busy ? 'Running the check…' : decision ? 'Re-run the check' : 'Run three-expert check'}
                      </Button>
                      {busy && <span className="text-[10px] font-semibold text-muted">{stage.pct}%</span>}
                      {!file && !sampleKind && <span className="text-[10px] text-muted">Add a file or choose a sample to begin.</span>}
                    </div>

                    {(busy || stage.pct > 0) && (
                      <div className="mt-4 rounded-2xl border border-line bg-paper/40 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold">{stage.label || 'Preparing…'}</p>
                          <span className="font-mono text-[10px] font-bold text-accent">{stage.pct}%</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70">
                          <motion.span
                            className="block h-full rounded-full bg-accent"
                            animate={{ width: `${stage.pct}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                          {[
                            ['Clean-up', 50],
                            ['OCR read', 78],
                            ['Forensics', 92],
                            ['Decision', 100],
                          ].map(([label, threshold]) => {
                            const done = stage.pct >= threshold
                            return (
                              <div key={label} className="flex items-center gap-2 text-[10px]">
                                <span className={cn('grid h-3.5 w-3.5 place-items-center rounded-full', done ? 'bg-olive text-white' : 'bg-ink/[0.07] text-muted')}>
                                  {done ? <Check size={8} /> : null}
                                </span>
                                <span className={done ? 'text-ink' : 'text-muted'}>{label}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {error && <InlineNote tone="danger" icon={CircleAlert} className="mt-3">{error}</InlineNote>}

                    {decision && !busy && (
                      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <ScoreDial score={decision.score} band={decision.decision.band} size={104} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={bandTone(decision.decision.band)}>{decision.decision.label}</Badge>
                              {decision.sampled && <Badge tone="blue">Human sample selected</Badge>}
                              {sampleKind && <SimBadge>Fixture Reader</SimBadge>}
                            </div>
                            <p className="mt-2 text-[11px] leading-relaxed text-muted">{decision.decision.explanation}</p>
                            <Button size="sm" className="mt-3" onClick={() => setStep(2)}>
                              Review the reasons <ArrowRight size={13} />
                            </Button>
                          </div>
                        </div>
                        <ExpertCards experts={decision.experts} className="mt-3" compact />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Account Aggregator</p>
                        <p className="mt-1 text-sm font-semibold">Consent-first, document-free verification</p>
                      </div>
                      <SimBadge>Sandbox</SimBadge>
                    </div>

                    <div className="mt-4 rounded-2xl border border-line bg-paper/40 p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-olive/10 text-olive">
                          <Landmark size={16} />
                        </span>
                        <div>
                          <p className="text-[12px] font-semibold">{bank?.name} · {form.branch}</p>
                          <p className="mt-0.5 text-[10px] text-muted">FDR {form.fdNumber} · {formatINR(Number(form.amount), { compact: true })}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 text-[10px] sm:grid-cols-2">
                        {[
                          ['Purpose', 'FDR verification for AICTE compliance'],
                          ['Data requested', 'FD account summary only'],
                          ['Excluded', 'Transactions, balances, PAN, contact data'],
                          ['Validity', '24 hours, single use'],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-xl bg-surface px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.1em] text-muted">{k}</p>
                            <p className="mt-0.5 text-[10px] text-ink">{v}</p>
                          </div>
                        ))}
                      </div>
                      <Button className="mt-4" onClick={runAaCheck} disabled={busy}>
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Fingerprint size={14} />}
                        {busy ? 'Requesting consented data…' : consent ? 'Re-run sandbox fetch' : 'Grant sandbox consent & fetch'}
                      </Button>
                      <p className="mt-2 text-[10px] leading-relaxed text-muted">
                        No real AA provider is contacted. The request uses the same consent/fetch contract as the serverless endpoint, with a
                        labelled local fallback.
                      </p>
                    </div>

                    {(busy || stage.pct > 0) && (
                      <div className="mt-4 rounded-2xl border border-line bg-paper/40 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold">{stage.label || 'Preparing…'}</p>
                          <span className="font-mono text-[10px] font-bold text-accent">{stage.pct}%</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70">
                          <motion.span className="block h-full rounded-full bg-accent" animate={{ width: `${stage.pct}%` }} />
                        </div>
                      </div>
                    )}

                    {consent && (
                      <div className="mt-3 rounded-2xl border border-olive/25 bg-olive/[0.05] p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-olive">Consent artefact</p>
                        <p className="mt-1 font-mono text-[10px] text-ink">{consent.id}</p>
                        <p className="mt-1 text-[10px] leading-relaxed text-muted">
                          Granted {formatDate(consent.grantedAt)} · expires {formatDate(consent.expiresAt)} · {consent.provider}
                        </p>
                      </div>
                    )}

                    {error && <InlineNote tone="danger" icon={CircleAlert} className="mt-3">{error}</InlineNote>}

                    {decision && !busy && (
                      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <ScoreDial score={decision.score} band={decision.decision.band} size={104} />
                          <div className="min-w-0 flex-1">
                            <Badge tone={bandTone(decision.decision.band)}>{decision.decision.label}</Badge>
                            <p className="mt-2 text-[11px] leading-relaxed text-muted">{decision.decision.explanation}</p>
                            <Button size="sm" className="mt-3" onClick={() => setStep(2)}>
                              Review the result <ArrowRight size={13} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                  <Button variant="ghost" onClick={() => setStep(0)}>
                    <ArrowLeft size={14} /> Back to details
                  </Button>
                  <p className="text-[10px] text-muted">
                    {route === 'upload' ? 'Route A · document evidence' : 'Route B · AA sandbox'} · {sampleKind ? 'built-in sample' : 'your record'}
                  </p>
                </div>
              </Card>

              <div className="space-y-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Declared record</p>
                    <BadgeCheck size={14} className="text-olive" />
                  </div>
                  <dl className="mt-3 space-y-2 text-[11px]">
                    {[
                      ['Bank', bank?.short],
                      ['FDR number', form.fdNumber],
                      ['Principal', formatINR(Number(form.amount), { compact: true })],
                      ['Issue', formatDate(form.issueDate)],
                      ['Maturity', formatDate(form.maturityDate)],
                      ['Signatory', form.signatory],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-3">
                        <dt className="text-muted">{label}</dt>
                        <dd className="max-w-[170px] text-right font-semibold">{value || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>

                <Card className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Capture guide</p>
                  <ul className="mt-2.5 space-y-2 text-[10px] leading-relaxed text-muted">
                    <li className="flex gap-2"><Check size={11} className="mt-0.5 shrink-0 text-olive" /> Entire receipt inside the frame, all four corners visible.</li>
                    <li className="flex gap-2"><Check size={11} className="mt-0.5 shrink-0 text-olive" /> Flat surface, no shadow across the amount or seal.</li>
                    <li className="flex gap-2"><Check size={11} className="mt-0.5 shrink-0 text-olive" /> Avoid screenshots of screenshots and messaging apps.</li>
                    <li className="flex gap-2"><X size={11} className="mt-0.5 shrink-0 text-danger" /> Do not crop the receipt in a photo editor first.</li>
                  </ul>
                </Card>

                <InlineNote icon={ShieldCheck} tone="accent">
                  <strong>Not certainty.</strong> The score is a probabilistic signal with reasons. Every medium or low result can be
                  reviewed, re-uploaded or overridden by a human.
                </InlineNote>
              </div>
            </div>
          )}

          {step === 2 && decision && (
            <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
              <div className="space-y-4">
                <Card className="overflow-hidden">
                  <div className="flex flex-col gap-4 border-b border-line bg-gradient-to-br from-accent/[0.06] to-transparent p-5 sm:flex-row sm:items-center">
                    <ScoreDial score={decision.score} band={decision.decision.band} size={132} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Eyebrow>Recommendation</Eyebrow>
                        <Badge tone={bandTone(decision.decision.band)}>{decision.decision.label}</Badge>
                        {decision.sampled && <Badge tone="blue">Human sampling selected</Badge>}
                        {decision.mode?.includes('local') && <SimBadge>Browser scorer</SimBadge>}
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{decision.decision.explanation}</h2>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted">
                        {decision.decision.action === 'auto_accept'
                          ? 'High-band results can auto-accept, but a human path always remains. Ten percent of high-band records are sampled.'
                          : decision.decision.action === 'reject'
                            ? 'Low-band results are not anchored. Ask for a clearer original or use the AA sandbox instead.'
                            : 'A medium-band result is sent to an AICTE officer with every reason attached.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Three independent opinions</p>
                      <span className="text-[10px] text-muted">Weights 34 · 40 · 26</span>
                    </div>
                    <ExpertCards experts={decision.experts} className="mt-3" />
                  </div>
                </Card>

                <Card className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Declared vs extracted</p>
                  {decision.comparison?.checks?.length ? (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[440px] text-left">
                        <thead>
                          <tr className="border-b border-line">
                            <th className="table-head py-2">Field</th>
                            <th className="table-head py-2">Extracted</th>
                            <th className="table-head py-2">Declared</th>
                            <th className="table-head py-2 text-right">Match</th>
                          </tr>
                        </thead>
                        <tbody>
                          {decision.comparison.checks.map((c) => (
                            <tr key={c.field} className="border-b border-line/60">
                              <td className="py-2.5 text-[11px] font-semibold">{c.field}</td>
                              <td className="py-2.5 font-mono text-[10px] text-muted">
                                {c.field === 'Amount' && c.extracted ? formatINR(c.extracted) : c.extracted || '—'}
                              </td>
                              <td className="py-2.5 font-mono text-[10px] text-muted">
                                {c.field === 'Amount' && c.declared ? formatINR(c.declared) : c.declared || '—'}
                              </td>
                              <td className="py-2.5 text-right">
                                {c.match ? (
                                  <Badge tone="olive"><Check size={10} /> match</Badge>
                                ) : (
                                  <Badge tone="red"><X size={10} /> differs</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-muted">No field comparison was produced for this route.</p>
                  )}

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Metric label="Document hash" value={decision.image?.hash ? `${decision.image.hash.slice(0, 24)}…` : 'AA data only'} mono />
                    <Metric label="OCR engine" value={decision.readerEngine || '—'} />
                    <Metric
                      label="Focus variance"
                      value={decision.image?.quality?.blurScore != null ? String(decision.image.quality.blurScore) : '—'}
                      hint={decision.image?.quality?.tooBlurry ? 'below capture guide' : 'clean-scan range'}
                    />
                    <Metric
                      label="ELA mean / hotspots"
                      value={
                        decision.image?.ela
                          ? `${Number(decision.image.ela.mean || 0).toFixed(1)} / ${decision.image.ela.hotspots ?? 0}`
                          : '—'
                      }
                    />
                    <Metric label="Software tag" value={decision.image?.metadata?.software || 'none found'} danger={Boolean(decision.image?.metadata?.software)} />
                    <Metric
                      label="Duplicate / hash reuse"
                      value={decision.duplicateOf ? `duplicate of ${decision.duplicateOf}` : decision.hashReuseOf ? `hash reused by ${decision.hashReuseOf}` : 'none found'}
                      danger={Boolean(decision.duplicateOf || decision.hashReuseOf)}
                    />
                  </div>

                  {decision.caveats?.length ? (
                    <InlineNote className="mt-4" icon={Info}>
                      <ul className="space-y-1">
                        {decision.caveats.map((c) => (
                          <li key={c} className="flex gap-1.5">
                            <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-muted/70" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </InlineNote>
                  ) : null}
                </Card>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    <ArrowLeft size={14} /> Back to evidence
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setStep(0)}>
                      Edit details
                    </Button>
                    <Button onClick={submit} disabled={submitting}>
                      {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {submitting ? 'Submitting…' : 'Submit & anchor'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Card className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Submission summary</p>
                  <dl className="mt-3 space-y-2 text-[11px]">
                    {[
                      ['Institution', college?.code || user?.orgId],
                      ['Bank', bank?.name],
                      ['Branch', form.branch],
                      ['FDR number', form.fdNumber],
                      ['Principal', formatINR(Number(form.amount))],
                      ['Issue date', formatDate(form.issueDate)],
                      ['Maturity', formatDate(form.maturityDate)],
                      ['Source', route === 'aa' ? 'AA sandbox' : sampleKind ? `Upload · ${sampleKind} sample` : 'Document upload'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-3">
                        <dt className="text-muted">{k}</dt>
                        <dd className="max-w-[180px] text-right font-semibold">{v || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                  {consent && (
                    <div className="mt-3 rounded-xl bg-olive/[0.06] px-3 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-olive">Consent</p>
                      <p className="mt-0.5 break-all font-mono text-[9px] text-muted">{consent.id}</p>
                    </div>
                  )}
                </Card>

                <Card className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">What the ledger will store</p>
                  <ul className="mt-2.5 space-y-2 text-[10px] leading-relaxed text-muted">
                    <li className="flex gap-2"><Check size={11} className="mt-0.5 shrink-0 text-olive" /> A SHA-256 fingerprint of the deposit identity.</li>
                    <li className="flex gap-2"><Check size={11} className="mt-0.5 shrink-0 text-olive" /> An optional document hash and event timestamp.</li>
                    <li className="flex gap-2"><X size={11} className="mt-0.5 shrink-0 text-danger" /> No name, FDR number, amount or bank detail on-chain.</li>
                    <li className="flex gap-2"><X size={11} className="mt-0.5 shrink-0 text-danger" /> No biometric data from the voice challenge.</li>
                  </ul>
                </Card>

                {imageResult?.cleaned && (
                  <Card className="overflow-hidden">
                    <img src={imageResult.cleaned} alt="Cleaned receipt" className="max-h-48 w-full object-contain bg-[#e9e4df]" />
                    <div className="p-3">
                      <p className="text-[10px] font-semibold">Cleaned evidence</p>
                      <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
                        Auto-crop, deskew and level stretch already applied. Original pixels were never uploaded.
                      </p>
                    </div>
                  </Card>
                )}

                <InlineNote tone={decision.decision.band === 'low' ? 'danger' : decision.decision.band === 'high' ? 'olive' : 'sand'} icon={Info}>
                  {decision.decision.band === 'high'
                    ? 'High confidence is a strong signal, not proof. Ten percent of high-band records are sampled by a human.'
                    : decision.decision.band === 'medium'
                      ? 'A human must decide. The officer sees the weakest expert and every reason.'
                      : 'This will be saved as rejected and will not be anchored. A clearer original or AA data can be submitted instead.'}
                </InlineNote>

                {offline && (
                  <InlineNote tone="accent" icon={CircleAlert}>
                    Simulated outage is active. The submission will be queued in IndexedDB and replayed once, in order, when connectivity
                    returns.
                  </InlineNote>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function RouteCard({ active, onClick, icon: Icon, title, tag, points }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-4 text-left transition',
        active ? 'border-ink bg-ink text-paper shadow-soft' : 'border-line bg-paper/40 hover:border-ink/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('grid h-9 w-9 place-items-center rounded-xl', active ? 'bg-paper/15 text-paper' : 'bg-accent/10 text-accent')}>
          <Icon size={16} />
        </span>
        <span className={cn('text-[9px] font-bold uppercase tracking-[0.12em]', active ? 'text-paper/50' : 'text-muted')}>{tag}</span>
      </div>
      <p className="mt-3 text-[13px] font-semibold">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {points.map((p) => (
          <li key={p} className={cn('flex items-center gap-1.5 text-[10px]', active ? 'text-paper/65' : 'text-muted')}>
            <Check size={9} /> {p}
          </li>
        ))}
      </ul>
    </button>
  )
}

function Metric({ label, value, hint, mono, danger }) {
  return (
    <div className="rounded-xl border border-line bg-paper/40 px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={cn('mt-0.5 break-all text-[11px] font-semibold', mono && 'font-mono text-[10px]', danger && 'text-danger')}>{value || '—'}</p>
      {hint && <p className="mt-0.5 text-[9px] text-muted">{hint}</p>}
    </div>
  )
}
