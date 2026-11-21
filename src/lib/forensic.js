import { BANKS } from '../data/seed'
import { compareDeclared, normalizeFdNumber } from './ocr'
import { SAMPLE_FIXTURES } from './samples'
import { scoreForensic } from '../../shared/forensic'
import { apiPost } from './api'

/**
 * Combines real image signals + OCR reads + register history into the
 * three-expert payload, then asks the serverless scorer (or the identical
 * local scorer when offline) for a trust score.
 */
export async function runForensicCheck({
  imageResult,
  ocrResult,
  declared,
  existingFdrs,
  sampleKind,
  settings,
  college,
  onStage,
}) {
  const bank = BANKS.find((b) => b.id === declared.bankId)
  const fixture = sampleKind ? SAMPLE_FIXTURES[sampleKind] : null

  const useFixture = Boolean(fixture)
  const extracted = useFixture ? fixture.ocr : ocrResult?.fields
  const confidence = useFixture ? fixture.confidence : ocrResult?.confidence || 0
  const textLength = useFixture ? fixture.ocr.textLength : ocrResult?.fields?.textLength || 0

  const comparison = compareDeclared(extracted, declared, bank)

  const duplicate = existingFdrs.find(
    (f) => normalizeFdNumber(f.fdNumber) === normalizeFdNumber(declared.fdNumber) && f.status !== 'released',
  )
  const hashReuse = existingFdrs.find((f) => f.documents?.some((d) => d.hash && d.hash === imageResult?.hash))
  const sharedSignatory = existingFdrs.filter(
    (f) => f.signatory === declared.signatory && f.collegeId !== declared.collegeId,
  )
  const ringMatch =
    sharedSignatory.some((f) => f.fraudRing) ||
    (existingFdrs.some((f) => f.fraudRing) && sharedSignatory.length >= 2)

  const signals = {
    eye: {
      blurScore: imageResult?.quality?.blurScore ?? 0,
      elaMean: imageResult?.ela?.mean ?? 0,
      elaMax: imageResult?.ela?.max ?? 0,
      elaHotspots: imageResult?.ela?.hotspots ?? 0,
      elaHotspotRatio: imageResult?.ela?.hotspotRatio ?? 0,
      brightness: imageResult?.quality?.brightness ?? 128,
      softwareFlag: imageResult?.metadata?.software || null,
    },
    reader: {
      available: useFixture || Boolean(ocrResult?.ok),
      fixture: useFixture,
      fixtureNote: useFixture
        ? 'Built-in sample fixture (the generated test receipt) used as the Reader reference.'
        : undefined,
      confidence,
      textLength,
      fieldsChecked: comparison.fieldsChecked,
      fieldsMatched: comparison.fieldsMatched,
      patternMismatch: comparison.patternMismatch,
      amountMismatch: comparison.amountMismatch,
      dateMismatch: comparison.dateMismatch,
    },
    memory: {
      duplicateFd: Boolean(duplicate),
      duplicateOf: duplicate?.id || null,
      hashReuse: Boolean(hashReuse),
      fraudRing: ringMatch,
      sharedSignatory: sharedSignatory.length > 0,
      multipleDuplicates: sharedSignatory.length > 1,
      recordsCompared: existingFdrs.length,
    },
  }

  onStage?.('Merging three expert opinions')
  const local = scoreForensic(signals, {
    thresholds: settings,
    samplingRate: settings.samplingRate,
    samplingRandom: Math.random(),
    mode: 'local-deterministic',
  })

  const payload = {
    signals,
    declared,
    context: {
      collegeId: declared.collegeId,
      bankId: declared.bankId,
      sampleKind: sampleKind || null,
      recordsCompared: existingFdrs.length,
    },
    thresholds: {
      highThreshold: settings.highThreshold,
      mediumThreshold: settings.mediumThreshold,
    },
    samplingRate: settings.samplingRate,
    samplingRandom: Math.random(),
    imageBase64: imageResult?.cleaned?.startsWith('data:image') ? imageResult.cleaned : undefined,
  }

  onStage?.('Requesting the serverless forensic check')
  const server = await apiPost('/api/forensic', payload, { timeout: 12000 })
  const result = server?.ok && server.score != null ? server : local

  return {
    ...result,
    signals,
    comparison,
    duplicateOf: duplicate?.id || null,
    hashReuseOf: hashReuse?.id || null,
    readerEngine: useFixture
      ? `Sample fixture values · OCR ${ocrResult?.ok ? 'also ran' : 'engine unavailable'}`
      : ocrResult?.engine || 'OCR unavailable',
    image: {
      hash: imageResult?.hash,
      ela: imageResult?.ela,
      quality: imageResult?.quality,
      metadata: imageResult?.metadata,
      cleaned: imageResult?.cleaned,
      original: imageResult?.original,
    },
    collegeId: college?.id,
  }
}
