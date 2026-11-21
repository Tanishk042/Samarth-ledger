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

const KEY = 'samarth:fdrs'

/** Demo FDR mirror. Browser localStorage remains authoritative when unconfigured. */
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  const auth = requireRole(req, res, ['institution', 'officer', 'bank'], { allowMissing: req.method === 'GET' })
  if (!auth.ok) return

  const fdrs = await readState(KEY, [])

  if (req.method === 'GET') {
    const { q, bankId, collegeId, status } = req.query || {}
    const filtered = fdrs.filter((fdr) => {
      if (bankId && fdr.bankId !== bankId) return false
      if (collegeId && fdr.collegeId !== collegeId) return false
      if (status && fdr.status !== status) return false
      if (q && !JSON.stringify(fdr).toLowerCase().includes(String(q).toLowerCase())) return false
      return true
    })
    return send(res, 200, { ok: true, count: filtered.length, fdrs: filtered })
  }

  if (req.method === 'POST') {
    if (auth.role === 'bank') return fail(res, 403, 'Bank agents cannot create FDR records.')
    const body = await readBody(req)
    const fdr = isObject(body?.fdr) ? body.fdr : body
    const missing = requireFields(fdr, ['id', 'fdNumber', 'amount', 'bankId', 'collegeId', 'maturityDate'])
    if (missing) return fail(res, 422, missing)
    if (fdrs.some((item) => item.id === fdr.id)) return fail(res, 409, 'An FDR with this id already exists.')
    const record = {
      ...fdr,
      amount: Number(fdr.amount),
      createdAt: fdr.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mirroredBy: auth.role || 'demo-client',
    }
    await writeState(KEY, [record, ...fdrs])
    return send(res, 201, { ok: true, fdr: record, count: fdrs.length + 1 })
  }

  if (req.method === 'PUT') {
    if (auth.role === 'bank') return fail(res, 403, 'Bank agents cannot edit FDR records.')
    const body = await readBody(req)
    const id = body?.id || body?.fdr?.id
    if (!id) return fail(res, 422, 'An FDR id is required.')
    const index = fdrs.findIndex((item) => item.id === id)
    if (index < 0) return fail(res, 404, 'FDR record not found.')
    const patch = isObject(body?.fdr) ? body.fdr : body
    const updated = { ...fdrs[index], ...patch, id, updatedAt: new Date().toISOString() }
    const next = [...fdrs]
    next[index] = updated
    await writeState(KEY, next)
    return send(res, 200, { ok: true, fdr: updated })
  }

  if (req.method === 'DELETE') {
    if (auth.role !== 'officer') return fail(res, 403, 'Only an officer can delete FDR records.')
    const id = req.query?.id || (await readBody(req))?.id
    if (!id) return fail(res, 422, 'An FDR id is required.')
    const next = fdrs.filter((item) => item.id !== id)
    if (next.length === fdrs.length) return fail(res, 404, 'FDR record not found.')
    await writeState(KEY, next)
    return send(res, 200, { ok: true, deleted: id, count: next.length })
  }

  return fail(res, 405, 'Unsupported method.')
}
