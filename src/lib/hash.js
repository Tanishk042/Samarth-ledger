/**
 * SHA-256 helpers. Web Crypto only — no server round-trip, no third-party hash.
 */

export function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(digest)
}

export async function sha256Blob(blob) {
  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return bytesToHex(digest)
}

export async function sha256File(file) {
  return sha256Blob(file)
}

export async function sha256DataUrl(dataUrl) {
  const res = await fetch(dataUrl)
  return sha256Blob(await res.blob())
}

/**
 * Canonical record string. Deliberately excludes mutable workflow state
 * (status, notes) so a status change does not look like tampering, while any
 * change to the financial identity of the FDR breaks the fingerprint.
 */
export function canonicalFdr(fdr) {
  return [
    fdr.id,
    fdr.fdNumber,
    String(fdr.amount),
    fdr.bankId,
    fdr.collegeId,
    fdr.issueDate,
    fdr.maturityDate,
  ].join('|')
}

export async function fingerprintFdr(fdr) {
  return sha256Hex(canonicalFdr(fdr))
}

export async function hashChainBlock({ prevHash, fingerprint, timestamp, type, actor, docHash }) {
  return sha256Hex(
    [prevHash || 'GENESIS', fingerprint || '', timestamp || '', type || '', actor || '', docHash || ''].join(
      '::',
    ),
  )
}

export function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function base64ToBytes(base64) {
  const binary = atob(base64)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}
