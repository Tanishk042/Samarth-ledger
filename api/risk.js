import {
  applyCors,
  clampScore,
  fail,
  isObject,
  readBody,
  requireRole,
  send,
} from '../shared/server.js'

/** Deterministic early-warning score over seeded indicators. Not a trained model. */
function riskTrack(series = []) {
  return series.slice(-6).map((point, index, all) => {
    const previous = all[index - 1]?.health ?? point.health ?? 80
    return {
      week: point.week || `W${index + 1}`,
      health: Number(point.health) || 0,
      delta: Number((Number(point.health) - Number(previous)).toFixed(1)),
    }
  })
}

function scoreRisk({ fdr = {}, college = {}, health = [], now = new Date() }) {
  const reasons = []
  let score = 12

  const track = riskTrack(health)
  const declines = track.filter((point) => point.delta < 0).length
  const latest = track.at(-1)?.health ?? 80
  if (declines >= 4) {
    score += 32
    reasons.push(`Bank health proxy declined for ${declines} consecutive seeded weeks.`)
  } else if (declines >= 2) {
    score += 16
    reasons.push(`Bank health proxy softened across ${declines} of the last six weeks.`)
  }
  if (latest < 70) {
    score += 14
    reasons.push(`Latest bank health proxy is ${latest}/100, below the 70 watch line.`)
  }

  const lateRenewals = Number(college.lateRenewals) || 0
  const docErrors = Number(college.docErrors) || 0
  if (lateRenewals >= 3) {
    score += 14
    reasons.push(`${lateRenewals} late renewals recorded for this institution.`)
  } else if (lateRenewals > 0) {
    score += 6
    reasons.push(`${lateRenewals} late renewal recorded for this institution.`)
  }
  if (docErrors >= 4) {
    score += 12
    reasons.push(`${docErrors} document errors in the seeded compliance history.`)
  } else if (docErrors > 0) {
    score += 5
    reasons.push(`${docErrors} document error(s) in the compliance history.`)
  }

  if (fdr.grievance) {
    score += 16
    reasons.push('An open grievance is linked to this deposit.')
  }
  if (fdr.fraudRing) {
    score += 26
    reasons.push('FDR belongs to the seeded shared-signatory fraud-ring cluster.')
  }
  if (fdr.riskHold) {
    score += 10
    reasons.push('An existing officer risk hold applies to this record.')
  }
  const days = Math.ceil((new Date(fdr.maturityDate) - now) / 86400000)
  if (Number.isFinite(days) && days < 0) {
    score += 8
    reasons.push(`Deposit matured ${Math.abs(days)} days ago and remains unresolved.`)
  }

  score = clampScore(score, 12)
  return {
    ok: true,
    score,
    band: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    label: score >= 70 ? 'Escalate to officer' : score >= 40 ? 'Monitor closely' : 'Within tolerance',
    reasons: reasons.length ? reasons : ['No seeded indicator crossed a watch threshold.'],
    trend: track,
    note: 'Illustrative rule-based signal over seeded data. It is not a trained or calibrated risk model.',
    simulated: true,
    generatedAt: new Date().toISOString(),
  }
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return fail(res, 405, 'Use POST to score risk.')
  const auth = requireRole(req, res, ['officer'], { allowMissing: true })
  if (!auth.ok) return

  const body = await readBody(req)
  if (!isObject(body)) return fail(res, 400, 'A JSON body is required.')
  if (!isObject(body.fdr) || !isObject(body.college)) {
    return fail(res, 422, 'fdr and college objects are required.')
  }
  if (!Array.isArray(body.health)) return fail(res, 422, 'health must be an array of seeded weekly points.')

  return send(res, 200, scoreRisk(body))
}
