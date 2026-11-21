import { fingerprintFdr, hashChainBlock } from './hash'

/**
 * Client-side simulated ledger.
 *
 * Each block stores a fingerprint of the *financial identity* of an FDR — never
 * the document or personal data — plus the previous block hash. The chain is
 * append-only in the UI, and the tamper demo changes an off-chain record so the
 * recomputed fingerprint no longer matches the anchored one.
 */

export const ANCHORABLE = (fdr) => fdr.status !== 'rejected' && fdr.status !== 'pending_sync' && fdr.trustScore >= 60

export async function createBlock({ blocks, fdr, type = 'FDR_REGISTERED', actor = 'system', docHash = null, timestamp }) {
  const prev = blocks[blocks.length - 1]
  const at = timestamp || new Date().toISOString()
  const fingerprint = fdr ? await fingerprintFdr(fdr) : null
  const hash = await hashChainBlock({
    prevHash: prev?.hash,
    fingerprint,
    timestamp: at,
    type,
    actor,
    docHash,
  })
  return {
    id: `BLK-${String(blocks.length + 1).padStart(4, '0')}`,
    index: blocks.length,
    type,
    fdrId: fdr?.id || null,
    fingerprint,
    docHash,
    prevHash: prev?.hash || 'GENESIS',
    hash,
    actor,
    timestamp: at,
    signers: type === 'RELEASED' ? ['AI agent', 'AICTE officer'] : ['AI verification agent'],
    simulated: true,
  }
}

export async function verifyChain(fdrs, blocks) {
  const issues = []
  let recordChecks = 0
  const byId = new Map(fdrs.map((f) => [f.id, f]))

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    const expectedPrev = i === 0 ? 'GENESIS' : blocks[i - 1].hash
    if (block.prevHash !== expectedPrev) {
      issues.push({
        blockId: block.id,
        fdrId: block.fdrId,
        kind: 'broken-link',
        detail: `Block ${block.index} points to ${String(block.prevHash).slice(0, 12)}… but the previous block hash is ${String(expectedPrev).slice(0, 12)}…`,
      })
    }
    const recomputed = await hashChainBlock({
      prevHash: block.prevHash,
      fingerprint: block.fingerprint,
      timestamp: block.timestamp,
      type: block.type,
      actor: block.actor,
      docHash: block.docHash,
    })
    if (recomputed !== block.hash) {
      issues.push({
        blockId: block.id,
        fdrId: block.fdrId,
        kind: 'block-hash',
        detail: `Block hash does not recompute. Stored ${block.hash.slice(0, 12)}…, expected ${recomputed.slice(0, 12)}…`,
      })
    }
    if (block.type === 'FDR_REGISTERED') {
      recordChecks += 1
      const fdr = byId.get(block.fdrId)
      if (!fdr) {
        issues.push({
          blockId: block.id,
          fdrId: block.fdrId,
          kind: 'missing-record',
          detail: 'Anchored record is missing from the application database.',
        })
      } else {
        const current = await fingerprintFdr(fdr)
        if (current !== block.fingerprint) {
          issues.push({
            blockId: block.id,
            fdrId: fdr.id,
            kind: 'fingerprint-mismatch',
            detail: `Off-chain record fingerprint ${current.slice(0, 12)}… does not match anchored ${String(block.fingerprint).slice(0, 12)}….`,
            anchored: block.fingerprint,
            current,
          })
        }
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    checkedBlocks: blocks.length,
    checkedRecords: recordChecks,
    head: blocks[blocks.length - 1]?.hash || null,
  }
}
