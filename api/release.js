import { evaluateReleaseRules, REVERT, voiceRequired } from '../src/lib/release.js'
import { applyCors, fail, isObject, readBody, requireRole, send } from '../shared/server.js'

const DEFAULT_SETTINGS = {
  preApprovalLimit: 50000000,
  highValueVoiceThreshold: 1000000,
  autoPause: false,
}

/** Stateless server mirror of the client-side double-lock rules engine. */
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return fail(res, 405, 'Use POST for release operations.')
  const auth = requireRole(req, res, ['officer'])
  if (!auth.ok) return

  const body = await readBody(req)
  if (!isObject(body)) return fail(res, 400, 'A JSON body is required.')
  if (!isObject(body.fdr)) return fail(res, 422, 'An fdr object is required.')

  const settings = { ...DEFAULT_SETTINGS, ...(isObject(body.settings) ? body.settings : {}) }
  const paused = Boolean(body.paused ?? settings.autoPause)
  const evaluation = evaluateReleaseRules({
    fdr: body.fdr,
    college: isObject(body.college) ? body.college : { compliance: 90 },
    settings,
    now: body.now ? new Date(body.now) : new Date(),
    paused,
  })
  const voice = voiceRequired(body.fdr, settings)
  const action = body.action || 'evaluate'

  if (action === 'evaluate') {
    return send(res, 200, {
      ok: true,
      ...evaluation,
      voiceRequired: voice,
      key1Allowed: evaluation.allPass,
      note: 'Rule evaluation only. No funds move in this prototype.',
    })
  }

  if (action === 'signKey1') {
    if (!evaluation.allPass) {
      return send(res, 422, {
        ok: false,
        error: REVERT.rules,
        rules: evaluation.rules,
        routedTo: 'officer',
      })
    }
    const signature = `AI1:${Buffer.from(`${body.fdr.id}|${Date.now()}`).toString('base64url')}`
    return send(res, 200, {
      ok: true,
      key1: { signature, actor: 'AI release agent', at: new Date().toISOString() },
      rules: evaluation.rules,
    })
  }

  if (action === 'attempt') {
    if (paused) return send(res, 423, { ok: false, error: REVERT.pause })
    if (!evaluation.allPass) return send(res, 422, { ok: false, error: REVERT.rules, rules: evaluation.rules })
    if (!body.key1) return send(res, 409, { ok: false, error: REVERT.key1 })
    if (!body.key2) return send(res, 409, { ok: false, error: REVERT.dual })
    if (voice && !body.voice?.verified) return send(res, 409, { ok: false, error: REVERT.voice })
    return send(res, 200, {
      ok: true,
      error: null,
      release: {
        id: body.fdr.id,
        at: new Date().toISOString(),
        keys: [body.key1.signature || 'key1', body.key2.signature || 'key2'],
        voice: voice ? body.voice.method || 'additional factor' : 'not required',
        simulated: true,
      },
      notice: 'Prototype release record. No real funds were transferred.',
    })
  }

  return fail(res, 422, 'action must be evaluate, signKey1 or attempt.')
}
