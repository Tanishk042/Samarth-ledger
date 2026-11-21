/**
 * Deterministic calibration check for the three built-in samples.
 * Uses the generated image statistics plus the labelled OCR fixtures, so it
 * can be run in CI without a browser or OCR engine.
 *
 *   npm run test:scoring
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scoreForensic } from '../shared/forensic.js'
import { SAMPLE_FIXTURES } from '../src/lib/samples.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const samples = JSON.parse(fs.readFileSync(path.join(here, '..', 'public', 'samples', 'samples.json'), 'utf8'))

const MEMORY = {
  genuine: { recordsCompared: 40 },
  edited: { duplicateFd: true, sharedSignatory: true, multipleDuplicates: true, recordsCompared: 40 },
  blurry: { sharedSignatory: true, recordsCompared: 40 },
}

let failed = 0
for (const kind of ['genuine', 'edited', 'blurry']) {
  const fixture = SAMPLE_FIXTURES[kind]
  const stat = samples.stats[kind]
  const fields = [fixture.ocr.fdNumber === fixture.fdNumber, fixture.ocr.amount === fixture.amount, fixture.ocr.maturityDate === fixture.maturityDate]
  const signals = {
    eye: {
      blurScore: stat.blurVariance,
      elaMean: stat.ela.mean,
      elaMax: stat.ela.max,
      elaHotspots: stat.ela.hotspots,
      elaHotspotRatio: stat.ela.hotspots / (1400 * 990),
      brightness: 128,
      softwareFlag: kind === 'edited' ? 'Adobe Photoshop 25.0 (demo fixture)' : null,
    },
    reader: {
      available: true,
      fixture: true,
      confidence: fixture.confidence,
      textLength: fixture.ocr.textLength,
      fieldsChecked: fields.length,
      fieldsMatched: fields.filter(Boolean).length,
      amountMismatch: !fields[1],
      dateMismatch: !fields[2],
    },
    memory: MEMORY[kind],
  }
  const result = scoreForensic(signals, {
    thresholds: { highThreshold: 98, mediumThreshold: 60 },
    samplingRate: 10,
    samplingRandom: 0.9,
  })
  const ok = result.decision.band === fixture.expected
  if (!ok) failed += 1
  console.log(
    `${ok ? '✓' : '✗'} ${kind.padEnd(8)} trust ${String(result.score).padStart(3)} · ${result.decision.band.padEnd(6)} ` +
      `(expected ${fixture.expected}) · experts ${result.experts.map((e) => e.score).join('/')}`,
  )
}

if (failed) {
  console.log(`\n${failed} sample band(s) did not match their labelled expectation.`)
  process.exitCode = 1
} else {
  console.log('\nAll three labelled sample outcomes are reproducible.')
}
