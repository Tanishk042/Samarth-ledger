import { scoreForensic } from '../shared/forensic.js'
import {
  applyCors,
  clampScore,
  fail,
  isObject,
  readBody,
  requireRole,
  send,
  visionOpinion,
} from '../shared/server.js'

/**
 * Explainable forensic scoring. Heavy image/OCR work happens in the browser;
 * this function receives only aggregate signals plus declared fields.
 */
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return fail(res, 405, 'Use POST for forensic scoring.')

  const auth = requireRole(req, res, ['institution', 'officer'], { allowMissing: true })
  if (!auth.ok) return

  const body = await readBody(req)
  if (!isObject(body) || !isObject(body.signals)) {
    return fail(res, 400, 'A signals object is required.')
  }

  const thresholds = {
    highThreshold: clampScore(body.thresholds?.highThreshold ?? 98, 98),
    mediumThreshold: clampScore(body.thresholds?.mediumThreshold ?? 60, 60),
  }
  if (thresholds.mediumThreshold > thresholds.highThreshold) {
    return fail(res, 422, 'Medium threshold cannot exceed the high threshold.')
  }

  const result = scoreForensic(body.signals, {
    thresholds,
    samplingRate: body.samplingRate ?? 10,
    samplingRandom: body.samplingRandom ?? Math.random(),
    mode: 'server-deterministic',
  })

  const opinion = await visionOpinion({
    imageBase64: body.imageBase64,
    signals: body.signals,
    declared: body.declared,
  })

  return send(res, 200, {
    ok: true,
    ...result,
    engine: opinion?.available
      ? 'Deterministic scorer + optional vision opinion'
      : 'Deterministic explainable scorer',
    vision: opinion,
    caveat:
      'Probabilistic decision support only. A human reviewer can disagree; this function never certifies a document as genuine.',
    receivedAt: new Date().toISOString(),
  })
}
