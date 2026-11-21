/**
 * Lightweight API harness. Calls each Vercel handler with mock req/res objects,
 * so every endpoint can be exercised locally with zero infrastructure.
 *
 *   npm run test:api
 */
import forensic from '../api/forensic.js'
import fdrs from '../api/fdrs.js'
import consent from '../api/aa/consent.js'
import fetchAa from '../api/aa/fetch.js'
import proof from '../api/proof.js'
import ledger from '../api/ledger.js'
import events from '../api/events.js'
import risk from '../api/risk.js'
import release from '../api/release.js'
import { writeState } from '../shared/server.js'

let passed = 0
let failed = 0
const failures = []

function mockReq({ method = 'GET', body, query = {}, role, headers = {} } = {}) {
  const req = {
    method,
    query,
    headers: { ...(role ? { 'x-demo-role': role } : {}), ...headers },
  }
  if (body !== undefined) req.body = body
  return req
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    payload: undefined,
    ended: false,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value
      return this
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.payload = data
      return this
    },
    end() {
      this.ended = true
      return this
    },
  }
  return res
}

async function call(handler, options) {
  const req = mockReq(options)
  const res = mockRes()
  await handler(req, res)
  return { status: res.statusCode, data: res.payload, res }
}

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function group(title) {
  console.log(`\n${title}`)
}

const fdrFixture = {
  id: 'FDR-TEST-0001',
  fdNumber: 'HDFC123456789',
  amount: 2500000,
  bankId: 'hdfc',
  collegeId: 'c1',
  issueDate: '2022-01-10',
  maturityDate: '2024-01-10',
  status: 'ACTIVE',
}

const riskFdr = {
  ...fdrFixture,
  id: 'FDR-TEST-RISK',
  fraudRing: true,
  maturityDate: '2027-01-10',
}

const collegeFixture = { id: 'c1', compliance: 92, lateRenewals: 0, docErrors: 0 }

try {
  group('CORS')
  {
    const { status, res } = await call(forensic, { method: 'OPTIONS' })
    check('OPTIONS returns 204', status === 204, `got ${status}`)
    check('CORS headers applied', res.headers['access-control-allow-origin'] === '*')
    check('request ended without body', res.ended && res.payload === undefined)
  }

  group('/api/forensic')
  {
    const bad = await call(forensic, { method: 'POST', body: {} })
    check('missing signals returns 400', bad.status === 400, `got ${bad.status}`)

    const badThreshold = await call(forensic, {
      method: 'POST',
      body: { signals: {}, thresholds: { highThreshold: 50, mediumThreshold: 80 } },
    })
    check('inverted thresholds return 422', badThreshold.status === 422, `got ${badThreshold.status}`)

    const ok = await call(forensic, {
      method: 'POST',
      body: {
        signals: {
          eye: { blurVariance: 1500, elaMean: 1.05, softwareTag: false },
          reader: { exactMatch: true, fieldsChecked: 6, fieldsMatched: 6 },
          memory: { duplicates: 0, recordsCompared: 40 },
        },
        declared: { fdNumber: 'HDFC123456789' },
        samplingRandom: 0.9,
      },
    })
    check('valid signals return 200', ok.status === 200, `got ${ok.status}`)
    check('score is 0–100', ok.data?.score >= 0 && ok.data?.score <= 100, `got ${ok.data?.score}`)
    check('three experts returned', ok.data?.experts?.length === 3)
    check('caveat never claims certainty', /not certainty|never/i.test(ok.data?.caveats?.join(' ') || ''))

    const wrongMethod = await call(forensic, { method: 'GET' })
    check('GET returns 405', wrongMethod.status === 405, `got ${wrongMethod.status}`)
  }

  group('/api/fdrs')
  {
    const noRole = await call(fdrs, { method: 'POST', body: { fdr: fdrFixture } })
    check('POST without role returns 401', noRole.status === 401, `got ${noRole.status}`)

    const created = await call(fdrs, {
      method: 'POST',
      role: 'institution',
      body: { fdr: fdrFixture },
    })
    check('institution creates FDR (201)', created.status === 201, `got ${created.status}`)

    const duplicate = await call(fdrs, {
      method: 'POST',
      role: 'institution',
      body: { fdr: fdrFixture },
    })
    check('duplicate id returns 409', duplicate.status === 409, `got ${duplicate.status}`)

    const missing = await call(fdrs, { method: 'POST', role: 'institution', body: { fdr: { id: 'X' } } })
    check('incomplete FDR returns 422', missing.status === 422, `got ${missing.status}`)

    const list = await call(fdrs, { method: 'GET', query: { bankId: 'hdfc' } })
    check('GET lists mirrored FDR', list.data?.count === 1, `got ${list.data?.count}`)

    const bankWrite = await call(fdrs, { method: 'PUT', role: 'bank', body: { id: fdrFixture.id, status: 'BANK' } })
    check('bank cannot edit FDR (403)', bankWrite.status === 403, `got ${bankWrite.status}`)

    const updated = await call(fdrs, {
      method: 'PUT',
      role: 'officer',
      body: { id: fdrFixture.id, status: 'REVIEWED' },
    })
    check('officer edits FDR (200)', updated.status === 200, `got ${updated.status}`)

    const bankDelete = await call(fdrs, { method: 'DELETE', role: 'bank', query: { id: fdrFixture.id } })
    check('bank cannot delete (403)', bankDelete.status === 403, `got ${bankDelete.status}`)
  }

  group('/api/aa/consent + /api/aa/fetch')
  {
    const missing = await call(consent, { method: 'POST', body: { institutionId: 'c1' } })
    check('consent requires fields (422)', missing.status === 422, `got ${missing.status}`)

    const granted = await call(consent, {
      method: 'POST',
      body: {
        institutionId: 'c1',
        bankId: 'hdfc',
        purpose: 'FDR verification for AICTE security-deposit compliance',
        ttlHours: 24,
      },
    })
    check('consent granted (201)', granted.status === 201, `got ${granted.status}`)
    check('consent is labelled simulated', granted.data?.consent?.simulated === true)
    check('consent has expiry', Boolean(granted.data?.consent?.expiresAt))

    const consentId = granted.data?.consent?.id
    const noConsent = await call(fetchAa, {
      method: 'POST',
      body: { consentId: 'CNS-NOPE', institutionId: 'c1', bankId: 'hdfc' },
    })
    check('unknown consent returns 404', noConsent.status === 404, `got ${noConsent.status}`)

    const mismatch = await call(fetchAa, {
      method: 'POST',
      body: { consentId, institutionId: 'c2', bankId: 'hdfc' },
    })
    check('scope mismatch returns 403', mismatch.status === 403, `got ${mismatch.status}`)

    const fetched = await call(fetchAa, {
      method: 'POST',
      body: { consentId, institutionId: 'c1', bankId: 'hdfc', fdNumber: 'HDFC123456789' },
    })
    check('consented fetch returns 200', fetched.status === 200, `got ${fetched.status}`)
    check('payload is labelled mock', fetched.data?.simulated === true)
    check('payload has no personal fields', !/name|email|phone/i.test(JSON.stringify(fetched.data?.record || {})))

    const wrongMethod = await call(consent, { method: 'GET' })
    check('consent GET returns 405', wrongMethod.status === 405, `got ${wrongMethod.status}`)
  }

  group('/api/proof')
  {
    const officerCreate = await call(proof, {
      method: 'POST',
      role: 'officer',
      body: { action: 'create', bankId: 'hdfc', bankCode: 'HDFC0000001', proofDate: '2026-11-21', fdrCount: 8 },
    })
    check('officer cannot create proof (403)', officerCreate.status === 403, `got ${officerCreate.status}`)

    const created = await call(proof, {
      method: 'POST',
      role: 'bank',
      body: {
        action: 'create',
        bankId: 'hdfc',
        bankCode: 'HDFC0000001',
        proofDate: '2026-11-21',
        fdrCount: 8,
      },
    })
    check('bank creates proof (201)', created.status === 201, `got ${created.status}`)
    check(
      'public JWK present',
      created.data?.proof?.publicJwk?.kty === 'EC' && Boolean(created.data?.proof?.publicJwk?.x),
    )
    check('private JWK never returned', !JSON.stringify(created.data).includes('privateJwk'))
    check('signature present', typeof created.data?.proof?.signature === 'string')

    const { payload, signature, publicJwk } = created.data.proof
    const verified = await call(proof, {
      method: 'POST',
      body: { action: 'verify', payload, signature, publicJwk },
    })
    check('genuine signature verifies', verified.data?.valid === true)

    const tampered = await call(proof, {
      method: 'POST',
      body: { action: 'verify', payload: { ...payload, fdrCount: 99 }, signature, publicJwk },
    })
    check('tampered payload fails closed', tampered.data?.valid === false)

    const badVerify = await call(proof, { method: 'POST', body: { action: 'verify', payload: {} } })
    check('verify validates inputs (422)', badVerify.status === 422, `got ${badVerify.status}`)
  }

  group('/api/ledger')
  {
    await writeState('samarth:fdrs', [fdrFixture])
    await writeState('samarth:ledger', [])

    const empty = await call(ledger, { method: 'GET' })
    check('empty chain returns 200', empty.status === 200 && empty.data?.count === 0)

    const appended = await call(ledger, {
      method: 'POST',
      role: 'institution',
      body: { fdr: fdrFixture, docHash: 'a'.repeat(64) },
    })
    check('FDR block appended (201)', appended.status === 201, `got ${appended.status}`)
    check('block has genesis predecessor', appended.data?.block?.prevHash === 'GENESIS')
    check('block hash is 64 hex chars', /^[a-f0-9]{64}$/.test(appended.data?.block?.hash || ''))

    const reject = await call(ledger, {
      method: 'POST',
      role: 'institution',
      body: { fdr: { ...fdrFixture, id: 'FDR-REJECT', status: 'rejected' } },
    })
    check('rejected FDR is never anchored (422)', reject.status === 422, `got ${reject.status}`)

    const good = await call(ledger, { method: 'POST', body: { action: 'verify', fdrs: [fdrFixture] } })
    check('chain verifies when intact', good.data?.result?.ok === true)

    await writeState('samarth:fdrs', [{ ...fdrFixture, amount: 9999999 }])
    const tampered = await call(ledger, { method: 'POST', body: { action: 'verify' } })
    check('tampering is detected', tampered.data?.result?.ok === false)
    check(
      'fingerprint mismatch reported',
      tampered.data?.result?.issues?.some((issue) => issue.kind === 'fingerprint-mismatch') === true,
    )

    await writeState('samarth:fdrs', [fdrFixture])
    const single = await call(ledger, { method: 'POST', body: { action: 'verify', fdr: fdrFixture } })
    check('single-record verification works', single.status === 200 && single.data?.ok === true)
  }

  group('/api/events')
  {
    const bad = await call(events, {
      method: 'POST',
      body: { topic: 'unknown.topic', payload: { id: 1 } },
    })
    check('unknown topic returns 422', bad.status === 422, `got ${bad.status}`)

    const created = await call(events, {
      method: 'POST',
      role: 'institution',
      body: { topic: 'fdr.submitted', payload: { id: fdrFixture.id } },
    })
    check('event created (201)', created.status === 201, `got ${created.status}`)
    check('event is labelled simulated', created.data?.event?.simulated === true)

    const filtered = await call(events, { method: 'GET', query: { topic: 'fdr.submitted' } })
    check('topic filter works', filtered.data?.count >= 1, `got ${filtered.data?.count}`)

    const noMatch = await call(events, { method: 'GET', query: { topic: 'release.completed' } })
    check('non-matching filter returns zero', noMatch.data?.count === 0, `got ${noMatch.data?.count}`)
  }

  group('/api/risk')
  {
    const missing = await call(risk, { method: 'POST', body: { fdr: fdrFixture } })
    check('incomplete input returns 422', missing.status === 422, `got ${missing.status}`)

    const low = await call(risk, {
      method: 'POST',
      body: {
        fdr: fdrFixture,
        college: collegeFixture,
        health: [{ week: 'W1', health: 88 }, { week: 'W2', health: 90 }],
      },
    })
    check('healthy record scores low', low.data?.band === 'low', `got ${low.data?.band}/${low.data?.score}`)

    const high = await call(risk, {
      method: 'POST',
      body: {
        fdr: riskFdr,
        college: { ...collegeFixture, lateRenewals: 4, docErrors: 5 },
        health: [
          { week: 'W1', health: 92 },
          { week: 'W2', health: 86 },
          { week: 'W3', health: 80 },
          { week: 'W4', health: 74 },
          { week: 'W5', health: 68 },
          { week: 'W6', health: 62 },
        ],
      },
    })
    check('fraud-ring record scores high', high.data?.band === 'high', `got ${high.data?.band}/${high.data?.score}`)
    check('reasons are explainable', (high.data?.reasons?.length || 0) >= 3)
    check('model is labelled rule-based', /rule-based|not a trained/i.test(high.data?.note || ''))
  }

  group('/api/release')
  {
    const noRole = await call(release, { method: 'POST', body: { fdr: fdrFixture } })
    check('officer role required (401)', noRole.status === 401, `got ${noRole.status}`)

    const evaluate = await call(release, {
      method: 'POST',
      role: 'officer',
      body: {
        fdr: fdrFixture,
        college: collegeFixture,
        settings: { preApprovalLimit: 50000000, highValueVoiceThreshold: 1000000 },
        now: '2026-11-21T00:00:00.000Z',
      },
    })
    check('matured FDR passes rules', evaluate.data?.allPass === true, JSON.stringify(evaluate.data?.rules))
    check('voice required over threshold', evaluate.data?.voiceRequired === true)

    const sign = await call(release, {
      method: 'POST',
      role: 'officer',
      body: {
        action: 'signKey1',
        fdr: fdrFixture,
        college: collegeFixture,
        now: '2026-11-21T00:00:00.000Z',
      },
    })
    check('AI key1 signed', sign.status === 200 && Boolean(sign.data?.key1?.signature))

    const noKeys = await call(release, {
      method: 'POST',
      role: 'officer',
      body: {
        action: 'attempt',
        fdr: fdrFixture,
        college: collegeFixture,
        now: '2026-11-21T00:00:00.000Z',
      },
    })
    check('missing key1 reverts with 409', noKeys.status === 409, `got ${noKeys.status}`)

    const noVoice = await call(release, {
      method: 'POST',
      role: 'officer',
      body: {
        action: 'attempt',
        fdr: fdrFixture,
        college: collegeFixture,
        now: '2026-11-21T00:00:00.000Z',
        key1: { signature: 'AI1:demo' },
        key2: { signature: 'OFF:demo' },
      },
    })
    check('voice challenge enforced', noVoice.status === 409 && /voice/i.test(noVoice.data?.error || ''))

    const completed = await call(release, {
      method: 'POST',
      role: 'officer',
      body: {
        action: 'attempt',
        fdr: fdrFixture,
        college: collegeFixture,
        now: '2026-11-21T00:00:00.000Z',
        key1: { signature: 'AI1:demo' },
        key2: { signature: 'OFF:demo' },
        voice: { verified: true, method: 'simulated challenge' },
      },
    })
    check('dual-signed release accepted', completed.status === 200 && completed.data?.ok === true)
    check('release is labelled simulated', completed.data?.release?.simulated === true)

    const paused = await call(release, {
      method: 'POST',
      role: 'officer',
      body: {
        action: 'attempt',
        fdr: fdrFixture,
        college: collegeFixture,
        paused: true,
        now: '2026-11-21T00:00:00.000Z',
        key1: { signature: 'AI1:demo' },
        key2: { signature: 'OFF:demo' },
        voice: { verified: true },
      },
    })
    check('emergency pause blocks release (423)', paused.status === 423, `got ${paused.status}`)
  }
} catch (error) {
  failed += 1
  failures.push(`Harness crashed: ${error?.stack || error}`)
  console.error(error)
}

console.log(`\n${'─'.repeat(60)}`)
console.log(`API checks: ${passed} passed, ${failed} failed`)
if (failures.length) {
  console.log('\nFailures:')
  failures.forEach((item) => console.log(`  • ${item}`))
  process.exitCode = 1
} else {
  console.log('All serverless endpoints behave as documented.')
}
