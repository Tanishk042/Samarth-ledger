import {
  applyCors,
  fail,
  readBody,
  readState,
  requireFields,
  requireRole,
  send,
} from '../../shared/server.js'

const CONSENTS = 'samarth:consents'

const BANK_RULES = {
  sbi: { prefix: '', digits: 11 },
  hdfc: { prefix: 'HDFC', digits: 9 },
  icici: { prefix: 'ICIC', digits: 10 },
  axis: { prefix: 'UTIB', digits: 10 },
  bob: { prefix: 'BARB', digits: 10 },
  union: { prefix: 'UBIN', digits: 10 },
  saraswat: { prefix: 'SRCB', digits: 8 },
  cosmos: { prefix: 'COSB', digits: 8 },
}

function seededFrom(text, seed = 7) {
  let hash = seed
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 2147483647
  return hash
}

function isoPlus(date, days) {
  return new Date(date.getTime() + days * 86400000).toISOString().slice(0, 10)
}

/** Deterministic mock bank payload, returned only for a recorded consent id. */
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return fail(res, 405, 'Use POST to fetch consented data.')
  const auth = requireRole(req, res, ['institution'], { allowMissing: true })
  if (!auth.ok) return

  const body = await readBody(req)
  const missing = requireFields(body, ['consentId', 'institutionId', 'bankId'])
  if (missing) return fail(res, 422, missing)

  const consents = await readState(CONSENTS, [])
  const consent = consents.find((item) => item.id === body.consentId)
  if (!consent) return fail(res, 404, 'Consent artefact not found. Grant consent first.')
  if (consent.revoked) return fail(res, 403, 'Consent has been revoked.')
  if (new Date(consent.expiresAt).getTime() < Date.now()) return fail(res, 410, 'Consent artefact has expired.')
  if (consent.institutionId !== body.institutionId || consent.bankId !== body.bankId) {
    return fail(res, 403, 'Consent does not cover this institution and bank.')
  }

  const rule = BANK_RULES[body.bankId] || { prefix: 'FD', digits: 10 }
  const seed = seededFrom(`${body.fdNumber || body.bankId}${body.institutionId}`)
  const digits = String(seed).padStart(rule.digits, '0').slice(-rule.digits)
  const fdNumber = body.fdNumber && String(body.fdNumber).startsWith(rule.prefix)
    ? String(body.fdNumber)
    : `${rule.prefix}${digits}`
  const amount = 500000 + (seed % 95) * 150000
  const issueDate = isoPlus(new Date(), -((seed % 700) + 60))
  const maturityDate = isoPlus(new Date(issueDate), 730 + (seed % 4) * 365)

  return send(res, 200, {
    ok: true,
    simulated: true,
    notice: 'Mock AA sandbox payload — deterministic demo values, not real bank data.',
    record: {
      fdNumber,
      amount,
      issueDate,
      maturityDate,
      bankId: body.bankId,
      status: 'ACTIVE',
      interestRate: Number((6.5 + (seed % 6) * 0.25).toFixed(2)),
      confidence: 96,
      consentId: consent.id,
      fetchedAt: new Date().toISOString(),
    },
  })
}
