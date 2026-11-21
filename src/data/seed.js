import { addDays, isoDate } from '../lib/utils'

/**
 * Illustrative demo configuration. All names, colleges and amounts are
 * fictionalised for the prototype. Bank names are used only to make the
 * account-aggregator and co-operative-bank routes legible.
 */

export const COLLEGES = [
  { id: 'COL-RVCE', code: 'RVCE', name: 'RV College of Engineering', city: 'Bengaluru', state: 'Karnataka', compliance: 94, lateRenewals: 0, docErrors: 1, contact: 'registrar@rvce.edu.in' },
  { id: 'COL-SPIT', code: 'SPIT', name: 'Sardar Patel Institute of Technology', city: 'Mumbai', state: 'Maharashtra', compliance: 87, lateRenewals: 1, docErrors: 2, contact: 'accounts@spit.ac.in' },
  { id: 'COL-AU', code: 'AU', name: 'Anna University', city: 'Chennai', state: 'Tamil Nadu', compliance: 91, lateRenewals: 1, docErrors: 1, contact: 'finance@annauniv.edu' },
  { id: 'COL-DTU', code: 'DTU', name: 'Delhi Technological University', city: 'New Delhi', state: 'Delhi', compliance: 89, lateRenewals: 2, docErrors: 2, contact: 'accounts@dtu.ac.in' },
  { id: 'COL-VIT', code: 'VIT', name: 'Vellore Institute of Technology', city: 'Vellore', state: 'Tamil Nadu', compliance: 92, lateRenewals: 0, docErrors: 1, contact: 'deposits@vit.ac.in' },
  { id: 'COL-CET', code: 'CET', name: 'College of Engineering Trivandrum', city: 'Thiruvananthapuram', state: 'Kerala', compliance: 78, lateRenewals: 3, docErrors: 4, contact: 'office@cet.ac.in' },
  { id: 'COL-JU', code: 'JU', name: 'Jadavpur University', city: 'Kolkata', state: 'West Bengal', compliance: 85, lateRenewals: 1, docErrors: 2, contact: 'finance@jadavpuruniversity.in' },
  { id: 'COL-MNIT', code: 'MNIT', name: 'Malaviya National Institute of Technology', city: 'Jaipur', state: 'Rajasthan', compliance: 83, lateRenewals: 2, docErrors: 3, contact: 'accounts@mnit.ac.in' },
  { id: 'COL-PEC', code: 'PEC', name: 'Punjab Engineering College', city: 'Chandigarh', state: 'Punjab', compliance: 88, lateRenewals: 1, docErrors: 1, contact: 'accounts@pec.ac.in' },
  { id: 'COL-GCEA', code: 'GCEA', name: 'Government College of Engineering, Aurangabad', city: 'Aurangabad', state: 'Maharashtra', compliance: 72, lateRenewals: 4, docErrors: 5, contact: 'office@gcea.ac.in' },
  { id: 'COL-NITR', code: 'NITR', name: 'National Institute of Technology, Rourkela', city: 'Rourkela', state: 'Odisha', compliance: 86, lateRenewals: 1, docErrors: 2, contact: 'finance@nitrkl.ac.in' },
  { id: 'COL-AEC', code: 'AEC', name: 'Assam Engineering College', city: 'Guwahati', state: 'Assam', compliance: 81, lateRenewals: 2, docErrors: 3, contact: 'accounts@aec.ac.in' },
]

export const BANKS = [
  { id: 'sbi', name: 'State Bank of India', short: 'SBI', aaEnabled: true, color: '#2B5C8A', ifsc: 'SBIN0001234', branch: 'Bengaluru Main', pattern: '^\\d{11}$', patternNote: '11-digit FD number', prefix: '' },
  { id: 'hdfc', name: 'HDFC Bank', short: 'HDFC', aaEnabled: true, color: '#1C4C8C', ifsc: 'HDFC0000123', branch: 'Mumbai Fort', pattern: '^HDFC\\d{9}$', patternNote: 'HDFC + 9 digits', prefix: 'HDFC' },
  { id: 'icici', name: 'ICICI Bank', short: 'ICICI', aaEnabled: true, color: '#AE2A22', ifsc: 'ICIC0000456', branch: 'Chennai Central', pattern: '^ICIC\\d{10}$', patternNote: 'ICIC + 10 digits', prefix: 'ICIC' },
  { id: 'axis', name: 'Axis Bank', short: 'Axis', aaEnabled: true, color: '#8E1F55', ifsc: 'UTIB0000789', branch: 'Pune Camp', pattern: '^UTIB\\d{10}$', patternNote: 'UTIB + 10 digits', prefix: 'UTIB' },
  { id: 'bob', name: 'Bank of Baroda', short: 'BoB', aaEnabled: true, color: '#C05118', ifsc: 'BARB0VADODA', branch: 'Vadodara Main', pattern: '^BARB\\d{10}$', patternNote: 'BARB + 10 digits', prefix: 'BARB' },
  { id: 'union', name: 'Union Bank of India', short: 'Union', aaEnabled: true, color: '#C0332C', ifsc: 'UBIN0801234', branch: 'Hyderabad MG Road', pattern: '^UBIN\\d{10}$', patternNote: 'UBIN + 10 digits', prefix: 'UBIN' },
  { id: 'saraswat', name: 'Saraswat Co-operative Bank', short: 'Saraswat', aaEnabled: false, color: '#3C6B4F', ifsc: 'SRCB0000042', branch: 'Andheri West', pattern: '^SRCB\\d{8}$', patternNote: 'SRCB + 8 digits (legacy co-op format)', prefix: 'SRCB' },
  { id: 'cosmos', name: 'Cosmos Co-operative Bank', short: 'Cosmos', aaEnabled: false, color: '#6C5B3E', ifsc: 'COSB0000017', branch: 'Pune Deccan', pattern: '^COSB\\d{8}$', patternNote: 'COSB + 8 digits (legacy co-op format)', prefix: 'COSB' },
]

export const BANK_HEALTH = BANKS.reduce((acc, bank) => {
  const wobble = bank.id.charCodeAt(0) % 7
  acc[bank.id] = Array.from({ length: 12 }, (_, i) => {
    const decline = bank.id === 'saraswat' || bank.id === 'cosmos' ? i * 1.9 : i * 0.55
    return {
      week: `W${i + 1}`,
      health: Math.round(88 - decline + ((i * 7 + wobble * 3) % 6) - 3),
      liquidity: Math.round(76 - decline * 0.55 + ((i * 5) % 5)),
      npa: Number((2.1 + decline * 0.12 + ((i * 3) % 4) * 0.08).toFixed(2)),
    }
  })
  return acc
}, {})

/** Deterministic PRNG so the demo looks identical on every reset. */
function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const AMOUNTS = [
  1800000, 4500000, 12000000, 2800000, 6200000, 950000, 15000000, 3200000, 7400000, 2200000,
  4800000, 18000000, 5400000, 8600000, 1400000, 27000000, 6800000, 12500000, 3600000, 5800000,
  9200000, 4200000, 1500000, 1200000, 1100000, 7800000, 21000000, 900000, 1600000, 3400000,
  22000000, 48000000, 17500000, 9600000, 6400000, 9000000, 12000000, 85000000, 46000000, 2800000,
]

// Days from today to maturity. Negative = already matured.
const MATURITY_OFFSETS = [
  12, 28, 58, 9, 33, 54, 19, 44, 80, 120, 150, 200, 26, 70, 95, 130, 240, 300, 360, 400, 500,
  620, 680, 720, 760, 800, 840, 300, 420, 520, 690, -40, -120, -210, -290, -2, -10, -25, -55, 45,
]

const STATUS_BY_INDEX = (i) => {
  if (i <= 20) return 'verified'
  if (i <= 27) return 'under_review'
  if (i <= 30) return 'rejected'
  if (i <= 33) return 'released'
  return 'renewal_due'
}

const SIGNATORIES = ['A. Deshpande', 'P. Krishnan', 'R. Malhotra', 'S. Banerjee', 'M. Qureshi', 'K. Reddy']
const RING_FDRS = new Set([22, 23, 24])
const RISK_HOLD = new Set([4, 12, 22, 23, 34, 35])

const SAMPLE_DOCS = {
  21: { url: '/samples/genuine.png', name: 'FDR_HDFC_genuine.png', kind: 'genuine' },
  22: { url: '/samples/edited.png', name: 'FDR_SRCB_edited.png', kind: 'edited' },
  23: { url: '/samples/blurry.png', name: 'FDR_SRCB_blurry.png', kind: 'blurry' },
  24: { url: '/samples/edited.png', name: 'FDR_SRCB_edited_2.png', kind: 'edited' },
  25: { url: '/samples/genuine.png', name: 'FDR_ICIC_genuine.png', kind: 'genuine' },
  26: { url: '/samples/blurry.png', name: 'FDR_BARB_blurry.png', kind: 'blurry' },
  27: { url: '/samples/genuine.png', name: 'FDR_UBIN_genuine.png', kind: 'genuine' },
  28: { url: '/samples/blurry.png', name: 'FDR_COSB_blurry.png', kind: 'blurry' },
  29: { url: '/samples/edited.png', name: 'FDR_SBI_edited.png', kind: 'edited' },
  30: { url: '/samples/blurry.png', name: 'FDR_AXIS_blurry.png', kind: 'blurry' },
}

function trustFor(i, status, rng) {
  if (status === 'rejected') return [41, 33, 52][i - 28]
  if (status === 'under_review') return [96, 71, 63, 67, 88, 55, 92][i - 21]
  if (status === 'released') return 92 + Math.floor(rng() * 7)
  if (status === 'renewal_due') return 84 + Math.floor(rng() * 12)
  return 90 + Math.floor(rng() * 10)
}

function reasonsFor(i, trust, ring) {
  const eye = Math.max(35, Math.min(99, trust + (i % 5) - 2))
  const reader = Math.max(30, Math.min(99, trust + (i % 3) - 1))
  const memory = ring ? 34 : Math.max(40, Math.min(99, trust + 2))
  const eyeReasons = ring
    ? ['ELA heat-map shows a dense recompression cluster around the amount field', 'Seal region has inconsistent JPEG noise']
    : trust >= 90
      ? ['Document noise is consistent across the page', 'Seal and signature regions show no recompression edge']
      : ['Moderate compression variance around the amount block', 'Seal contrast is lower than the bank template']
  const readerReasons = ring
    ? ['FDR number matches a record already anchored by another institution', 'Amount field OCR disagrees with the declared value by ₹1,20,000']
    : trust >= 90
      ? ['FDR number matches the HDFC format rule', 'Amount and maturity date agree with declared fields']
      : ['OCR confidence is below the auto-accept threshold', 'One date field needs a human check']
  const memoryReasons = ring
    ? ['Signatory R. Malhotra appears across three unrelated colleges', 'Same Andheri branch and near-sequential FD numbers']
    : trust >= 90
      ? ['No duplicate fingerprint found in 40 seeded records', 'No shared suspicious signatory pattern']
      : ['One similar document pattern in the last 90 days', 'No confirmed duplicate fingerprint']
  return {
    eye: { score: eye, reasons: eyeReasons },
    reader: { score: reader, reasons: readerReasons },
    memory: { score: memory, reasons: memoryReasons },
  }
}

function fdNumberFor(bank, i, rng) {
  // Deliberate duplicate for the fraud-ring demo, and a duplicate that the
  // "amount-edited" sample collides with so Memory has something real to find.
  if (i === 22 || i === 10) return 'SRCB0442188'
  if (i === 17) return 'HDFC987654321'
  if (RING_FDRS.has(i)) return `SRCB04421${String(80 + (i - 22)).padStart(2, '0')}`
  if (!bank.prefix) return String(20100000000 + Math.floor(rng() * 8999999))
  if (bank.prefix === 'SRCB') return `SRCB0442${String(100 + i).padStart(3, '0')}`
  if (bank.prefix === 'COSB') return `COSB0119${String(100 + i).padStart(3, '0')}`
  const width = bank.pattern.match(/\\d\{(\d+)\}/)?.[1] || '9'
  const digits = '0123456789'.slice(0, 10)
  let body = ''
  for (let d = 0; d < Number(width); d += 1) body += digits[Math.floor(rng() * 10)]
  return `${bank.prefix}${body}`
}

export function buildSeed(now = new Date()) {
  const rng = mulberry32(20261030)
  const fdrs = Array.from({ length: 40 }, (_, i) => {
    const bank = BANKS[i % BANKS.length]
    const college = COLLEGES[(i * 5 + 3) % COLLEGES.length]
    const status = STATUS_BY_INDEX(i)
    const offset = MATURITY_OFFSETS[i]
    const maturity = addDays(now, offset)
    const tenure = [365, 730, 1095][i % 3]
    const issue = addDays(maturity, -tenure)
    const ring = RING_FDRS.has(i)
    const trust = trustFor(i, status, rng)
    const sample = SAMPLE_DOCS[i]
    const id = `FDR-2026-${String(i + 1).padStart(4, '0')}`
    const reasons = reasonsFor(i, trust, ring)
    return {
      id,
      fdNumber: fdNumberFor(bank, i, rng),
      collegeId: ring ? ['COL-CET', 'COL-MNIT', 'COL-NITR'][i - 22] : college.id,
      bankId: ring ? 'saraswat' : bank.id,
      branch: ring ? 'Andheri West' : bank.branch,
      signatory: ring ? 'R. Malhotra' : SIGNATORIES[(i * 2) % SIGNATORIES.length],
      amount: AMOUNTS[i],
      interestRate: Number((6.5 + (i % 5) * 0.25).toFixed(2)),
      tenureYears: tenure / 365,
      issueDate: isoDate(issue),
      maturityDate: isoDate(maturity),
      status,
      source: bank.aaEnabled && i % 3 !== 0 ? 'aa' : 'upload',
      trustScore: trust,
      reasons,
      samplings: trust >= 98 ? (i % 10 === 0 ? ['human_sample'] : []) : [],
      soulbound: ['verified', 'released', 'renewal_due'].includes(status),
      tokenId: `SBT-${String(i + 1).padStart(4, '0')}`,
      riskHold: RISK_HOLD.has(i),
      riskNote: RISK_HOLD.has(i)
        ? i === 4
          ? 'Issuing co-op bank liquidity indicator fell for 5 consecutive weeks.'
          : i === 12
            ? 'Two late renewals from this institution in the last 18 months.'
            : i === 34
              ? 'Bank health proxy declined across six consecutive weekly proofs; release held for officer review.'
              : i === 35
                ? 'Institution has an open grievance on a related deposit.'
                : 'Signatory and FD-number pattern overlaps an open fraud-ring review.'
        : null,
      grievance: i === 35,
      fraudRing: ring,
      documents: sample
        ? [
            {
              id: `DOC-${String(i + 1).padStart(4, '0')}`,
              name: sample.name,
              kind: sample.kind,
              url: sample.url,
              uploadedAt: isoDate(addDays(now, -(i % 20) - 1)),
              isSample: true,
              hash: null,
            },
          ]
        : [],
      renewalDoc: null,
      lastProofAt: null,
      createdBy: 'Institution user',
      createdAt: isoDate(addDays(now, -(i % 120) - 2)),
      updatedAt: isoDate(addDays(now, -(i % 30))),
    }
  })

  const due = fdrs.filter((f) => f.status === 'verified')
  const notifications = [
    {
      id: 'NTF-0001',
      type: 'reminder.60d',
      title: 'Maturity reminder · 60 days',
      body: `${due[2]?.fdNumber || 'FDR'} at ${due[2]?.bankId?.toUpperCase() || 'bank'} matures in 58 days. An AI-prepared renewal draft is available.`,
      fdrId: due[2]?.id,
      at: isoDate(addDays(now, -1)),
      read: false,
      audience: 'institution',
    },
    {
      id: 'NTF-0002',
      type: 'reminder.30d',
      title: 'Maturity reminder · 30 days',
      body: `${due[1]?.fdNumber || 'FDR'} matures in under 30 days. Confirm renewal instructions to avoid a lapse.`,
      fdrId: due[1]?.id,
      at: isoDate(now),
      read: false,
      audience: 'institution',
    },
    {
      id: 'NTF-0003',
      type: 'review.pending',
      title: 'Document needs a clearer copy',
      body: 'The Reader expert could not verify the amount field on one upload. Re-upload or use the AA route.',
      fdrId: 'FDR-2026-0027',
      at: isoDate(addDays(now, -2)),
      read: false,
      audience: 'institution',
    },
    {
      id: 'NTF-0004',
      type: 'proof.missed',
      title: 'Missed bank proof',
      body: 'Saraswat Co-operative Bank skipped yesterday’s locked-balance proof. Officer notified.',
      fdrId: 'FDR-2026-0022',
      at: isoDate(now),
      read: false,
      audience: 'officer',
    },
    {
      id: 'NTF-0005',
      type: 'risk.flagged',
      title: 'Risk flag raised',
      body: 'Co-op bank liquidity proxy declined for five weeks. A replacement FDR may be requested.',
      fdrId: 'FDR-2026-0005',
      at: isoDate(addDays(now, -3)),
      read: false,
      audience: 'officer',
    },
  ]

  const audit = [
    { id: 'AUD-0001', at: new Date(now.getTime() - 1000 * 60 * 38).toISOString(), actor: 'A. K. Sharma', role: 'officer', action: 'REVIEW_APPROVED', target: 'FDR-2026-0021', detail: 'Trust 96 · high-band sampling skipped' },
    { id: 'AUD-0002', at: new Date(now.getTime() - 1000 * 60 * 92).toISOString(), actor: 'System agent', role: 'system', action: 'AI_KEY_SIGNED', target: 'FDR-2026-0039', detail: 'All 5 release rules passed' },
    { id: 'AUD-0003', at: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(), actor: 'S. Iyer', role: 'bank', action: 'PROOF_CREATED', target: 'HDFC Bank', detail: 'Daily locked-balance proof · ECDSA P-256' },
    { id: 'AUD-0004', at: new Date(now.getTime() - 1000 * 60 * 60 * 22).toISOString(), actor: 'Dr. Meera Nair', role: 'institution', action: 'FDR_SUBMITTED', target: 'FDR-2026-0027', detail: 'Route B · document upload' },
    { id: 'AUD-0005', at: new Date(now.getTime() - 1000 * 60 * 60 * 30).toISOString(), actor: 'A. K. Sharma', role: 'officer', action: 'REVIEW_REJECTED', target: 'FDR-2026-0029', detail: 'ELA and OCR both inconsistent' },
    { id: 'AUD-0006', at: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(), actor: 'System agent', role: 'system', action: 'LEDGER_APPENDED', target: 'FDR-2026-0021', detail: 'Fingerprint 9f2c… anchored' },
    { id: 'AUD-0007', at: new Date(now.getTime() - 1000 * 60 * 60 * 70).toISOString(), actor: 'Dr. Meera Nair', role: 'institution', action: 'CONSENT_GRANTED', target: 'AA / HDFC', detail: 'Purpose: FDR verification · valid 24h' },
    { id: 'AUD-0008', at: new Date(now.getTime() - 1000 * 60 * 60 * 96).toISOString(), actor: 'A. K. Sharma', role: 'officer', action: 'EMERGENCY_PAUSE_OFF', target: 'System', detail: 'Resumed after reconciliation' },
    { id: 'AUD-0009', at: new Date(now.getTime() - 1000 * 60 * 60 * 120).toISOString(), actor: 'A. K. Sharma', role: 'officer', action: 'SETTINGS_UPDATED', target: 'Thresholds', detail: 'High band 98, sampling 10%' },
    { id: 'AUD-0010', at: new Date(now.getTime() - 1000 * 60 * 60 * 150).toISOString(), actor: 'R. Iyer', role: 'institution', action: 'RELEASE_REQUESTED', target: 'FDR-2026-0038', detail: 'Amount above pre-approval limit' },
    { id: 'AUD-0011', at: new Date(now.getTime() - 1000 * 60 * 60 * 190).toISOString(), actor: 'System agent', role: 'system', action: 'RISK_FLAG_RAISED', target: 'FDR-2026-0005', detail: 'Bank health proxy declining 5 weeks' },
    { id: 'AUD-0012', at: new Date(now.getTime() - 1000 * 60 * 60 * 210).toISOString(), actor: 'A. K. Sharma', role: 'officer', action: 'AUDIT_EXPORTED', target: 'Audit log', detail: 'CSV · 12 rows' },
  ]

  const events = [
    { id: 'EVT-001', topic: 'fdr.verified', payload: 'FDR-2026-0021 · trust 96', at: new Date(now.getTime() - 1000 * 60 * 36).toISOString(), simulated: true },
    { id: 'EVT-002', topic: 'reminder.30d', payload: 'FDR-2026-0002 · 28 days', at: new Date(now.getTime() - 1000 * 60 * 70).toISOString(), simulated: true },
    { id: 'EVT-003', topic: 'proof.verified', payload: 'HDFC Bank · proof #401', at: new Date(now.getTime() - 1000 * 60 * 110).toISOString(), simulated: true },
    { id: 'EVT-004', topic: 'release.ai_signed', payload: 'FDR-2026-0039 · key 1', at: new Date(now.getTime() - 1000 * 60 * 150).toISOString(), simulated: true },
    { id: 'EVT-005', topic: 'risk.flagged', payload: 'FDR-2026-0005 · co-op liquidity', at: new Date(now.getTime() - 1000 * 60 * 240).toISOString(), simulated: true },
    { id: 'EVT-006', topic: 'fdr.submitted', payload: 'FDR-2026-0027 · upload', at: new Date(now.getTime() - 1000 * 60 * 300).toISOString(), simulated: true },
    { id: 'EVT-007', topic: 'renewal.prepared', payload: 'FDR-2026-0003 · draft ready', at: new Date(now.getTime() - 1000 * 60 * 380).toISOString(), simulated: true },
    { id: 'EVT-008', topic: 'release.requested', payload: 'FDR-2026-0037 · ₹1.2 Cr', at: new Date(now.getTime() - 1000 * 60 * 420).toISOString(), simulated: true },
  ]

  const releaseRequests = [
    {
      id: 'REL-0001',
      fdrId: 'FDR-2026-0037',
      requestedAt: new Date(now.getTime() - 1000 * 60 * 60 * 26).toISOString(),
      requestedBy: 'Institution user',
      reason: 'Deposit no longer required after affiliation renewal.',
      status: 'pending',
      key1: null,
      key2: null,
      voice: { verified: false, method: null, phrase: null },
      revert: null,
      rulesOverride: [],
    },
    {
      id: 'REL-0002',
      fdrId: 'FDR-2026-0039',
      requestedAt: new Date(now.getTime() - 1000 * 60 * 60 * 50).toISOString(),
      requestedBy: 'Institution user',
      reason: 'Institution closing the corpus account.',
      status: 'pending',
      key1: {
        actor: 'AI release agent',
        at: new Date(now.getTime() - 1000 * 60 * 60 * 49).toISOString(),
        signature: 'pending-seed-key1',
      },
      key2: null,
      voice: { verified: false, method: null, phrase: null },
      revert: null,
      rulesOverride: [],
    },
    {
      id: 'REL-0003',
      fdrId: 'FDR-2026-0035',
      requestedAt: new Date(now.getTime() - 1000 * 60 * 60 * 72).toISOString(),
      requestedBy: 'Institution user',
      reason: 'Partial corpus release request.',
      status: 'pending',
      key1: null,
      key2: null,
      voice: { verified: false, method: null, phrase: null },
      revert: null,
      rulesOverride: [],
    },
    {
      id: 'REL-0004',
      fdrId: 'FDR-2026-0038',
      requestedAt: new Date(now.getTime() - 1000 * 60 * 60 * 90).toISOString(),
      requestedBy: 'Institution user',
      reason: 'High-value release for new campus corpus.',
      status: 'pending',
      key1: null,
      key2: null,
      voice: { verified: false, method: null, phrase: null },
      revert: null,
      rulesOverride: [],
    },
  ]

  return { fdrs, notifications, audit, events, releaseRequests }
}

export function buildFraudGraph(fdrs) {
  const ring = fdrs.filter((f) => f.fraudRing)
  const related = fdrs.filter((f) => !f.fraudRing && f.signatory === 'R. Malhotra').slice(0, 1)
  const selected = [...ring, ...related]
  const nodes = []
  const links = []
  const seen = new Set()
  const addNode = (id, label, type, meta = {}) => {
    if (seen.has(id)) return
    seen.add(id)
    nodes.push({ id, label, type, ...meta })
  }

  selected.forEach((f) => {
    const college = COLLEGES.find((c) => c.id === f.collegeId)
    const bank = BANKS.find((b) => b.id === f.bankId)
    addNode(f.collegeId, college?.code || f.collegeId, 'college', { ring: f.fraudRing })
    addNode(f.bankId, bank?.short || f.bankId, 'bank', { ring: f.fraudRing })
    addNode(`sig:${f.signatory}`, f.signatory, 'signatory', { ring: f.fraudRing })
    addNode(`branch:${f.branch}`, f.branch, 'branch', { ring: f.fraudRing })
    addNode(`fdr:${f.id}`, f.fdNumber, 'fdr', { ring: f.fraudRing, fdrId: f.id })
    links.push({ source: f.collegeId, target: `fdr:${f.id}`, ring: f.fraudRing })
    links.push({ source: `fdr:${f.id}`, target: f.bankId, ring: f.fraudRing })
    links.push({ source: f.collegeId, target: `sig:${f.signatory}`, ring: f.fraudRing })
    links.push({ source: `sig:${f.signatory}`, target: `branch:${f.branch}`, ring: f.fraudRing })
  })
  return { nodes, links }
}
