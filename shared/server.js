import { fingerprintFdr, hashChainBlock } from '../src/lib/hash.js'

/**
 * Small stateless server toolkit for the Vercel functions.
 *
 * Storage is optional: the browser is the source of truth for the demo. When a
 * KV / Upstash / Neon variable is configured, the API mirrors a handful of
 * demo collections. Otherwise an in-process map keeps each function testable
 * without any infrastructure. No secrets are ever returned to the client.
 */

const MEMORY = (globalThis.__samarthServerStore ||= new Map())

function configuredStore() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return {
      kind: 'vercel-kv',
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    }
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      kind: 'upstash',
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }
  }
  if (process.env.DATABASE_URL) return { kind: 'neon', url: process.env.DATABASE_URL }
  return { kind: 'memory' }
}

const STORE = configuredStore()
let neonClient = null

async function restCommand(path) {
  const response = await fetch(`${STORE.url.replace(/\/$/, '')}${path}`, {
    headers: { Authorization: `Bearer ${STORE.token}` },
  })
  if (!response.ok) throw new Error(`REST store error ${response.status}`)
  const payload = await response.json()
  return payload?.result ?? null
}

async function neonQuery(sql, params) {
  if (!neonClient) {
    const { neon: createNeon } = await import('@neondatabase/serverless')
    neonClient = createNeon(STORE.url)
  }
  return neonQueryWith(neonClient, sql, params)
}

async function neonQueryWith(client, sql, params) {
  return client(sql, params)
}

export async function readState(key, fallback = []) {
  try {
    let raw = null
    if (STORE.kind === 'memory') raw = MEMORY.get(key) ?? null
    else if (STORE.kind === 'neon') {
      await neonQuery(
        `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now())`,
      )
      const rows = await neonQuery('SELECT value FROM kv WHERE key = $1', [key])
      raw = rows?.[0]?.value ?? null
    } else {
      raw = await restCommand(`/get/${encodeURIComponent(key)}`)
    }
    if (raw == null) return fallback
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    // A misconfigured optional store must never take down the local-first demo.
    return fallback
  }
}

export async function writeState(key, value) {
  try {
    const serialized = JSON.stringify(value)
    if (STORE.kind === 'memory') MEMORY.set(key, serialized)
    else if (STORE.kind === 'neon') {
      await neonQuery(
        `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now())`,
      )
      await neonQuery(
        `INSERT INTO kv (key, value, updated_at) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, serialized],
      )
    } else {
      await restCommand(`/set/${encodeURIComponent(key)}/${encodeURIComponent(serialized)}`)
    }
  } catch {
    // Best-effort mirror; browser state remains authoritative.
  }
  return value
}

export function storeKind() {
  return STORE.kind
}

/* ── HTTP helpers ───────────────────────────────────────────────────────── */

export function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Demo-Role, X-Demo-User')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

export function send(res, status, data) {
  res.status(status).json({ ...data, httpStatus: status, storage: storeKind() })
}

export function fail(res, status, message, extra = {}) {
  return send(res, status, { ok: false, error: message, ...extra })
}

export async function readBody(req) {
  if (req.body != null) {
    return typeof req.body === 'string' ? safeParse(req.body) : req.body
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return safeParse(Buffer.concat(chunks).toString('utf8'))
}

function safeParse(text) {
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return null
  }
}

export function roleOf(req) {
  return String(req.headers['x-demo-role'] || '').toLowerCase()
}

/**
 * Missing role is allowed on read-only / sandbox endpoints so the local-first
 * browser demo works with no API configured. When a role is supplied it must be
 * valid and permitted.
 */
export function requireRole(req, res, allowed, { allowMissing = false } = {}) {
  const role = roleOf(req)
  if (!role) {
    if (allowMissing) return { ok: true, role: null }
    fail(res, 401, 'X-Demo-Role header is required.', { allowed })
    return { ok: false }
  }
  if (!['institution', 'officer', 'bank'].includes(role)) {
    fail(res, 403, 'Unknown demo role.')
    return { ok: false }
  }
  if (allowed && !allowed.includes(role)) {
    fail(res, 403, `Role '${role}' is not permitted for this operation.`, { allowed })
    return { ok: false }
  }
  return { ok: true, role }
}

export function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function requireFields(body, fields) {
  const missing = fields.filter((field) => body?.[field] == null || body[field] === '')
  return missing.length ? `Missing required field(s): ${missing.join(', ')}` : null
}

export function clampScore(value, fallback = 50) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback
}

/* ── Ledger helpers shared by /api/ledger ────────────────────────────────── */

export async function buildBlock({ blocks, fdr, type = 'FDR_REGISTERED', actor = 'system', docHash = null, timestamp }) {
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

export async function verifyLedger(fdrs = [], blocks = []) {
  const issues = []
  const byId = new Map(fdrs.map((f) => [f.id, f]))
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    const expectedPrev = i === 0 ? 'GENESIS' : blocks[i - 1].hash
    if (block.prevHash !== expectedPrev) {
      issues.push({ blockId: block.id, kind: 'broken-link', detail: 'Previous block hash does not match the chain head.' })
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
      issues.push({ blockId: block.id, kind: 'block-hash', detail: 'Block hash does not recompute from its payload.' })
    }
    if (block.type === 'FDR_REGISTERED') {
      const fdr = byId.get(block.fdrId)
      if (!fdr) {
        issues.push({ blockId: block.id, kind: 'missing-record', detail: 'Anchored FDR record is missing.' })
      } else {
        const current = await fingerprintFdr(fdr)
        if (current !== block.fingerprint) {
          issues.push({
            blockId: block.id,
            fdrId: fdr.id,
            kind: 'fingerprint-mismatch',
            detail: 'Off-chain record fingerprint differs from the anchored fingerprint.',
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
    checkedRecords: blocks.filter((b) => b.type === 'FDR_REGISTERED').length,
    head: blocks[blocks.length - 1]?.hash || null,
    simulated: true,
  }
}

/* ── Anthropic optional opinion ─────────────────────────────────────────── */

export async function visionOpinion({ imageBase64, signals, declared }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key || !imageBase64 || !String(imageBase64).startsWith('data:image/')) return null
  try {
    const [, mimeAndData] = imageBase64.split(',')
    const [mime, data] = mimeAndData.split(';base64,')
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system:
          'You are a conservative document-review assistant. Return JSON only: {"score":0-100,"reasons":["..."]}. Never claim certainty. Treat thresholds and institutional declarations as unverified.',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mime || 'image/jpeg',
                  data,
                },
              },
              {
                type: 'text',
                text: `Review this FDR specimen for signs of alteration. Declared fields: ${JSON.stringify(declared || {})}. Local signals: ${JSON.stringify(signals || {})}. Give a cautious advisory score and two short reasons. Do not make a legal or final decision.`,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return { available: false, error: `Vision API returned ${response.status}` }
    const payload = await response.json()
    const text = payload?.content?.find((part) => part.type === 'text')?.text || ''
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    return {
      available: true,
      score: clampScore(parsed.score, 50),
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 3) : [],
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    }
  } catch (error) {
    return { available: false, error: error?.message || 'Vision opinion failed' }
  }
}
