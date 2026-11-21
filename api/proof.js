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
} from '../shared/server.js'

const KEY = 'samarth:proofs'
const ALGO = { name: 'ECDSA', namedCurve: 'P-256' }
const canonicalPayload = (payload) => JSON.stringify(payload, Object.keys(payload).sort())

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64')
}

async function sign(payload, privateJwk) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, ALGO, false, ['sign'])
  const data = new TextEncoder().encode(canonicalPayload(payload))
  return bytesToBase64(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data))
}

async function verify(payload, signature, publicJwk) {
  try {
    const key = await crypto.subtle.importKey('jwk', publicJwk, ALGO, false, ['verify'])
    const data = new TextEncoder().encode(canonicalPayload(payload))
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      Buffer.from(signature, 'base64'),
      data,
    )
  } catch {
    return false
  }
}

/** ECDSA P-256 locked-balance proof. Payload contains no customer data. */
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return fail(res, 405, 'Use POST for proof operations.')

  const body = await readBody(req)
  const action = body?.action || 'verify'
  const auth = requireRole(req, res, action === 'create' ? ['bank'] : ['bank', 'officer'], {
    allowMissing: action === 'verify',
  })
  if (!auth.ok) return

  if (action === 'create') {
    const missing = requireFields(body, ['bankId', 'bankCode', 'proofDate', 'fdrCount'])
    if (missing) return fail(res, 422, missing)
    const fdrCount = Number(body.fdrCount)
    if (!Number.isInteger(fdrCount) || fdrCount < 0) return fail(res, 422, 'fdrCount must be a non-negative integer.')

    const pair = await crypto.subtle.generateKey(ALGO, true, ['sign', 'verify'])
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
    const payload = {
      schema: 'aicte.fdr.locked-proof.v1',
      bankCode: String(body.bankCode),
      bankId: String(body.bankId),
      proofDate: String(body.proofDate),
      fdrCount,
      amountLocked: 'YES',
      customerDataIncluded: false,
      nonce: crypto.randomUUID(),
    }
    const signature = await sign(payload, privateJwk)
    const proof = {
      id: `PRF-${body.bankId}-${body.proofDate}-${Date.now().toString(36)}`,
      bankId: body.bankId,
      date: body.proofDate,
      payload,
      signature,
      publicJwk,
      valid: true,
      signer: 'API bank proof agent (demo)',
      createdAt: new Date().toISOString(),
      simulated: true,
    }
    // Only public verification material is persisted; the private key is never stored.
    const proofs = await readState(KEY, [])
    await writeState(KEY, [proof, ...proofs].slice(0, 200))
    return send(res, 201, { ok: true, proof, notice: 'Signed demo proof. Private key discarded after signing.' })
  }

  if (action === 'verify') {
    if (!isObject(body?.payload) || !body?.signature || !isObject(body?.publicJwk)) {
      return fail(res, 422, 'payload, signature and publicJwk are required.')
    }
    const valid = await verify(body.payload, String(body.signature), body.publicJwk)
    return send(res, 200, {
      ok: true,
      valid,
      message: valid ? 'ECDSA signature verified.' : 'Signature verification failed — fail closed.',
      checkedAt: new Date().toISOString(),
    })
  }

  return fail(res, 422, 'action must be create or verify.')
}
