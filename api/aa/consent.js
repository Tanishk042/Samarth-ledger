import {
  applyCors,
  fail,
  isObject,
  readBody,
  readState,
  requireFields,
  requireRole,
  send,
  writeState,
} from '../../shared/server.js'

const KEY = 'samarth:consents'

/** Mock Account Aggregator consent artefact. Never contacts a real AA. */
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return fail(res, 405, 'Use POST to grant mock consent.')
  const auth = requireRole(req, res, ['institution'], { allowMissing: true })
  if (!auth.ok) return

  const body = await readBody(req)
  if (!isObject(body)) return fail(res, 400, 'A JSON body is required.')
  const missing = requireFields(body, ['institutionId', 'bankId', 'purpose'])
  if (missing) return fail(res, 422, missing)
  if (String(body.purpose).length > 500) return fail(res, 422, 'Purpose is too long.')

  const now = new Date()
  const ttlHours = Math.min(72, Math.max(1, Number(body.ttlHours) || 24))
  const consent = {
    id: `CNS-${now.getTime().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    provider: 'AA sandbox (mock)',
    institutionId: body.institutionId,
    bankId: body.bankId,
    purpose: body.purpose,
    requestedBy: body.requestedBy || auth.role || 'demo-client',
    grantedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlHours * 3600000).toISOString(),
    dataRange: 'FD account summary · no transaction history · no personal identifiers',
    fields: ['fdNumber', 'amount', 'issueDate', 'maturityDate', 'status', 'interestRate'],
    revoked: false,
    simulated: true,
  }

  const consents = await readState(KEY, [])
  await writeState(KEY, [consent, ...consents].slice(0, 100))

  return send(res, 201, { ok: true, consent, notice: 'Mock AA sandbox — no real bank data was accessed.' })
}
