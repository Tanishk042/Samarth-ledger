/**
 * Shared, dependency-free forensic scorer.
 *
 * Used by the browser (offline fallback) and by /api/forensic, so the same
 * explainable logic runs in both places. Inputs are *signals*, not images:
 * the heavy image work happens in the browser and only aggregate numbers and
 * extracted fields are sent to the API.
 */

const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n))
const round = (n) => Math.round(n)

export function bandFor(score, thresholds = {}) {
  const high = thresholds.highThreshold ?? 98
  const medium = thresholds.mediumThreshold ?? 60
  if (score >= high) return 'high'
  if (score >= medium) return 'medium'
  return 'low'
}

export function decisionFor(score, thresholds = {}, sampled = false) {
  const band = bandFor(score, thresholds)
  if (band === 'high') {
    return {
      band,
      action: sampled ? 'auto_accept_sampled' : 'auto_accept',
      label: sampled ? 'Auto-accept + human sampling' : 'Auto-accept',
      humanReview: sampled,
      explanation: sampled
        ? 'High-confidence result selected for random human sampling before final acceptance.'
        : 'High-confidence result auto-accepted. A human review path remains available.',
    }
  }
  if (band === 'medium') {
    return {
      band,
      action: 'officer_review',
      label: 'Send to AICTE officer',
      humanReview: true,
      explanation: 'Placed in the human review queue with the highlighted reasons attached.',
    }
  }
  return {
    band,
    action: 'reject',
    label: 'Request a clearer or original document',
    humanReview: true,
    explanation: 'Low confidence. Ask for a clearer original or use the Account Aggregator route.',
  }
}

export function scoreEye(eye = {}) {
  const reasons = []
  let score = 98
  const blur = Number(eye.blurScore ?? eye.laplacianVariance ?? 0)
  const elaMean = Number(eye.elaMean ?? 0)
  const elaMax = Number(eye.elaMax ?? 0)
  const hotspots = Number(eye.elaHotspots ?? 0)
  const brightness = Number(eye.brightness ?? 128)

  if (blur < 45) {
    score -= 42
    reasons.push(`Very low focus score (${round(blur)}). Ask for a sharper capture.`)
  } else if (blur < 110) {
    score -= 22
    reasons.push(`Low focus score (${round(blur)}). Text edges are soft.`)
  } else if (blur < 200) {
    score -= 7
    reasons.push(`Acceptable-but-soft focus (${round(blur)}).`)
  } else {
    reasons.push(`Focus score ${round(blur)} is within the clean-scan range.`)
  }

  if (elaMean > 20) {
    score -= 24
    reasons.push(`ELA heat-map mean ${elaMean.toFixed(1)} is high: possible local recompression.`)
  } else if (elaMean > 9) {
    score -= 12
    reasons.push(`ELA heat-map mean ${elaMean.toFixed(1)} suggests an edited region worth checking.`)
  } else if (elaMean > 5.5) {
    score -= 4
    reasons.push(`Minor ELA variance (${elaMean.toFixed(1)}), typical of a re-saved scan.`)
  } else {
    reasons.push(`ELA is flat (mean ${elaMean.toFixed(1)}); no strong edit cluster.`)
  }

  // Use a ratio so a large, clean scan is not punished for a handful of
  // compression pixels. A genuine local edit occupies a meaningful share.
  const hotspotRatio = Number(eye.elaHotspotRatio ?? (hotspots > 0 ? hotspots / 1_000_000 : 0))
  if (hotspotRatio > 0.005) {
    score -= 9
    reasons.push(`${(hotspotRatio * 100).toFixed(2)}% of pixels form a high-difference ELA cluster near text or the seal.`)
  } else if (hotspotRatio > 0.002) {
    score -= 4
    reasons.push(`A modest ELA cluster (${(hotspotRatio * 100).toFixed(2)}% of pixels) is worth a human glance.`)
  }
  if (elaMax > 150) {
    score -= 4
    reasons.push('At least one high-energy ELA pixel group is present.')
  }
  if (eye.softwareFlag) {
    // A known editor tag is a serious signal, but still not proof: the human
    // reviewer sees the reason and the original document before deciding.
    score -= 44
    reasons.push(`EXIF software tag “${eye.softwareFlag}” is a known image editor.`)
  }
  if (brightness < 55 || brightness > 235) {
    score -= 5
    reasons.push(`Exposure outside the comfortable range (${round(brightness)}/255).`)
  }

  return { key: 'eye', name: 'Eye', role: 'Document & image forensics', score: clamp(round(score), 12, 99), reasons }
}

export function scoreReader(reader = {}) {
  const reasons = []
  const textLength = Number(reader.textLength ?? 0)
  const confidence = Number(reader.confidence ?? 0)
  const checks = Number(reader.fieldsChecked ?? 0)
  const matches = Number(reader.fieldsMatched ?? 0)
  const patternMismatch = Boolean(reader.patternMismatch)
  const amountMismatch = Boolean(reader.amountMismatch)
  const dateMismatch = Boolean(reader.dateMismatch)

  if (!reader.available && !reader.fixture) {
    return {
      key: 'reader',
      name: 'Reader',
      role: 'OCR & field consistency',
      score: 38,
      reasons: ['OCR engine unavailable and no cached fixture for this document.', 'Fields could not be independently read.'],
    }
  }

  if (textLength < 25 && !reader.fixture) {
    return {
      key: 'reader',
      name: 'Reader',
      role: 'OCR & field consistency',
      score: 34,
      reasons: ['Almost no machine-readable text was recovered.', 'A clearer original is required.'],
    }
  }

  let score = 55 + Math.min(35, confidence * 0.35)
  reasons.push(`OCR confidence ${round(confidence)}% across ${textLength} characters.`)

  if (checks > 0) {
    score += (matches / checks) * 12
    reasons.push(`${matches}/${checks} extracted fields agree with the declared values.`)
  }
  if (patternMismatch) {
    score -= 20
    reasons.push('FDR number does not match the expected format for this bank.')
  }
  if (amountMismatch) {
    score -= 18
    reasons.push('Extracted amount disagrees with the amount declared by the institution.')
  }
  if (dateMismatch) {
    score -= 8
    reasons.push('One or more dates disagree with the declared record.')
  }

  if (reader.fixture) {
    reasons.push(reader.fixtureNote || 'Pre-labelled sample fixture used for this built-in demo file.')
  }

  if (score >= 90 && !patternMismatch && !amountMismatch) {
    reasons.push('Reader agrees with the bank-specific number rule and declared fields.')
  }

  return { key: 'reader', name: 'Reader', role: 'OCR & field consistency', score: clamp(round(score), 12, 99), reasons }
}

export function scoreMemory(memory = {}) {
  const reasons = []
  let score = 97
  if (memory.duplicateFd) {
    score -= 55
    reasons.push('FDR number already exists in the register (possible duplicate submission).')
  }
  if (memory.hashReuse) {
    score -= 38
    reasons.push('This exact cleaned document hash has been seen before.')
  }
  if (memory.fraudRing) {
    score -= 42
    reasons.push('Shared signatory / branch pattern matches an open fraud-ring cluster.')
  } else if (memory.sharedSignatory) {
    score -= 12
    reasons.push('A signatory is shared across unrelated institutions; monitored, not proof of fraud.')
  }
  if (memory.multipleDuplicates) {
    score -= 8
    reasons.push('More than one near-duplicate record was found in the last 180 days.')
  }
  if (score >= 95) {
    reasons.push(`No duplicate fingerprint in ${memory.recordsCompared ?? 40} seeded records.`)
    reasons.push('No shared suspicious signatory pattern above the alert threshold.')
  }
  return {
    key: 'memory',
    name: 'Memory',
    role: 'History & network patterns',
    score: clamp(round(score), 8, 99),
    reasons,
  }
}

/**
 * @param {{eye: object, reader: object, memory: object}} signals
 * @param {{thresholds?: object, samplingRate?: number, samplingRandom?: number, mode?: string}} options
 */
export function scoreForensic(signals = {}, options = {}) {
  const experts = [scoreEye(signals.eye), scoreReader(signals.reader), scoreMemory(signals.memory)]
  const weights = { eye: 0.34, reader: 0.4, memory: 0.26 }
  const weighted = experts.reduce((acc, e) => acc + e.score * weights[e.key], 0)
  const score = clamp(round(weighted))
  const thresholds = {
    highThreshold: options.thresholds?.highThreshold ?? 98,
    mediumThreshold: options.thresholds?.mediumThreshold ?? 60,
  }
  const samplingRate = Number(options.samplingRate ?? 10)
  const sampled = score >= thresholds.highThreshold && Number(options.samplingRandom ?? 0.5) * 100 < samplingRate
  const decision = decisionFor(score, thresholds, sampled)
  const lowerExpert = [...experts].sort((a, b) => a.score - b.score)[0]

  return {
    score,
    experts,
    decision,
    sampled,
    mode: options.mode || 'deterministic-heuristic',
    caveats: [
      'This is a probabilistic signal, not certainty. The reasons above are provided so a human can disagree.',
      `Weakest expert: ${lowerExpert.name} (${lowerExpert.score}/100).`,
      'No biometric or personal data is written to the ledger; only a fingerprint is anchored.',
    ],
    generatedAt: new Date().toISOString(),
  }
}
