import {
  applyCors,
  buildBlock,
  fail,
  isObject,
  readBody,
  readState,
  requireFields,
  requireRole,
  send,
  verifyLedger,
  writeState,
} from '../shared/server.js'

const KEY = 'samarth:ledger'
const FDRS = 'samarth:fdrs'

/** Append-only simulated hash chain. Never stores personal or financial fields. */
export default async function handler(req, res) {
  if (applyCors(req, res)) return

  const blocks = await readState(KEY, [])

  if (req.method === 'GET') {
    const action = String(req.query?.action || '')
    if (action === 'verify') {
      const fdrs = await readState(FDRS, Array.isArray(req.body?.fdrs) ? req.body.fdrs : [])
      const result = await verifyLedger(fdrs, blocks)
      return send(res, 200, { ok: result.ok, result })
    }
    return send(res, 200, { ok: true, count: blocks.length, head: blocks.at(-1)?.hash || null, blocks })
  }

  if (req.method === 'POST') {
    const body = await readBody(req)
    const action = body?.action || 'append'
    const auth = requireRole(req, res, ['institution', 'officer'], { allowMissing: action === 'verify' })
    if (!auth.ok) return

    if (action === 'verify') {
      const fdrs = Array.isArray(body.fdrs) ? body.fdrs : await readState(FDRS, [])
      if (!isObject(body.fdr)) {
        const result = await verifyLedger(fdrs, blocks)
        return send(res, 200, { ok: result.ok, result })
      }
      // Verify a single record against its anchored block.
      const target = blocks.find((block) => block.fdrId === body.fdr.id && block.type === 'FDR_REGISTERED')
      if (!target) return fail(res, 404, 'No anchored block was found for this record.')
      const result = await verifyLedger([body.fdr], [target])
      return send(res, 200, { ok: result.ok, result, block: target })
    }

    if (action === 'append') {
      const missing = requireFields(body, ['fdr'])
      if (missing || !isObject(body.fdr)) return fail(res, 422, 'An fdr object is required.')
      if (body.fdr.status === 'rejected' || body.fdr.status === 'pending_sync') {
        return fail(res, 422, 'Rejected and unsynced records are never anchored.')
      }
      const block = await buildBlock({
        blocks,
        fdr: body.fdr,
        type: body.type || 'FDR_REGISTERED',
        actor: body.actor || auth.role || 'demo-client',
        docHash: body.docHash || null,
        timestamp: body.timestamp,
      })
      await writeState(KEY, [...blocks, block])
      return send(res, 201, { ok: true, block, head: block.hash })
    }
  }

  return fail(res, 405, 'Unsupported method.')
}
