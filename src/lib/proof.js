import { bufferToBase64, base64ToBytes } from './hash'

/**
 * Real ECDSA P-256 signatures for the bank "daily proof" demo. Keys are generated
 * in the browser and kept in the demo store; a production agent would hold a
 * hardware-backed key and publish only the public JWK.
 */

const ALGO = { name: 'ECDSA', namedCurve: 'P-256' }

export function canonicalPayload(payload) {
  return JSON.stringify(payload, Object.keys(payload).sort())
}

export async function generateBankKey() {
  const pair = await crypto.subtle.generateKey(ALGO, true, ['sign', 'verify'])
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  return { privateJwk, publicJwk }
}

export async function signPayload(payload, privateJwk) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, ALGO, false, ['sign'])
  const data = new TextEncoder().encode(canonicalPayload(payload))
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data)
  return bufferToBase64(signature)
}

export async function verifyPayload(payload, signatureB64, publicJwk) {
  try {
    const key = await crypto.subtle.importKey('jwk', publicJwk, ALGO, false, ['verify'])
    const data = new TextEncoder().encode(canonicalPayload(payload))
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      base64ToBytes(signatureB64),
      data,
    )
  } catch {
    return false
  }
}

export function proofPayload({ bank, date, fdCount }) {
  // Deliberately contains no institution names, FDR numbers, amounts or people.
  return {
    schema: 'aicte.fdr.locked-proof.v1',
    bankCode: bank.short,
    bankId: bank.id,
    proofDate: date,
    fdrCount: fdCount,
    amountLocked: 'YES',
    customerDataIncluded: false,
    nonce: crypto.randomUUID(),
  }
}
