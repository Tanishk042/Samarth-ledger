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

const KEY = 'samarth:events'

const TOPICS = new Set([
  'fdr.submitted',
  'fdr.verified',
  'fdr.rejected',
  'reminder.60d',
  'reminder.30d',
  'renewal.prepared',
  'release.requested',
  'release.ai_signed',
  'release.officer_signed',
  'release.completed',
  'proof.created',
  'proof.verified',
  'risk.flagged',
  'audit.exported',
  'sync.replayed',
])

/** Mock Kafka-like topic feed. The UI visualises these as a live event stream. */
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  const auth = requireRole(req, res, ['institution', 'officer', 'bank'], { allowMissing: true })
  if (!auth.ok) return

  const events = await readState(KEY, [])

  if (req.method === 'GET') {
    const topic = req.query?.topic
    const filtered = topic ? events.filter((event) => event.topic === topic) : events
    return send(res, 200, { ok: true, count: filtered.length, topics: [...TOPICS], events: filtered.slice(-100) })
  }

  if (req.method === 'POST') {
    const body = await readBody(req)
    if (!isObject(body)) return fail(res, 400, 'A JSON body is required.')
    const missing = requireFields(body, ['topic', 'payload'])
    if (missing) return fail(res, 422, missing)
    if (!TOPICS.has(body.topic)) return fail(res, 422, `Unknown topic. Allowed: ${[...TOPICS].join(', ')}`)
    if (String(body.payload).length > 2000) return fail(res, 422, 'Payload is too long.')
    const event = {
      id: `EVT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      topic: body.topic,
      payload: body.payload,
      at: body.at || new Date().toISOString(),
      actor: auth.role || body.actor || 'demo-client',
      simulated: true,
    }
    await writeState(KEY, [...events, event].slice(-500))
    return send(res, 201, { ok: true, event })
  }

  return fail(res, 405, 'Unsupported method.')
}
