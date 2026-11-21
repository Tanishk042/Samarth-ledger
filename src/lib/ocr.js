import { BANKS } from '../data/seed'
import { normalizePan } from './utils'

/**
 * OCR runs client-side with tesseract.js, loaded lazily from a CDN so the main
 * bundle stays small. If the CDN or WASM cannot load, the caller decides whether
 * to use a labelled sample fixture. Nothing is silently faked: every result
 * carries an `engine` label that the UI displays.
 */

let loader = null
const CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract)
  if (loader) return loader
  loader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CDN
    script.async = true
    script.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Tesseract missing')))
    script.onerror = () => reject(new Error('Could not load the OCR engine from the CDN.'))
    document.head.appendChild(script)
  })
  return loader
}

export function parseFields(raw = '') {
  const text = String(raw)
  const cleaned = text.replace(/[|]/g, ' ')

  const fdMatch =
    cleaned.match(/(?:FDR?|FD|DEPOSIT)\s*(?:NO\.?|NUMBER|#|:)?\s*[:-]?\s*([A-Z]{2,5}\s?\d{6,12})/i) ||
    cleaned.match(/\b([A-Z]{2,5}\d{8,12})\b/)
  const fdNumber = fdMatch ? fdMatch[1].replace(/\s+/g, '').toUpperCase() : null

  const amounts = [...cleaned.matchAll(/(?:₹|RS\.?|INR)?\s*([0-9][0-9,]{5,12})(?:\.\d{1,2})?/gi)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n >= 100000 && n <= 100000000)
  const amount = amounts.length ? Math.max(...amounts) : null

  const dateMatches = [
    ...cleaned.matchAll(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g),
  ].map((m) => {
    const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const fullYear = year < 100 ? 2000 + year : year
    return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  })
  const monthNames = [...cleaned.matchAll(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/gi)].map(
    (m) => {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      const month = months.indexOf(m[2].slice(0, 3).toLowerCase()) + 1
      return `${m[3]}-${String(month).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`
    },
  )
  const dates = [...dateMatches, ...monthNames].filter((d) => !d.startsWith('NaN'))

  const bank =
    BANKS.find((b) => new RegExp(b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(cleaned)) ||
    BANKS.find((b) => new RegExp(`\\b${b.short}\\b`, 'i').test(cleaned)) ||
    null

  return {
    fdNumber,
    amount,
    dates,
    issueDate: dates[0] || null,
    maturityDate: dates[1] || null,
    bankId: bank?.id || null,
    textLength: cleaned.trim().length,
  }
}

export function normalizeFdNumber(value = '') {
  return normalizePan(value).replace(/[\s-]/g, '')
}

export function compareDeclared(extracted, declared, bank) {
  if (!extracted || !declared) return { checks: [], fieldsChecked: 0, fieldsMatched: 0 }
  const checks = []
  if (declared.fdNumber) {
    checks.push({
      field: 'FDR number',
      match: normalizeFdNumber(extracted.fdNumber) === normalizeFdNumber(declared.fdNumber),
      extracted: extracted.fdNumber,
      declared: declared.fdNumber,
    })
  }
  if (declared.amount) {
    checks.push({
      field: 'Amount',
      match: Number(extracted.amount) === Number(declared.amount),
      extracted: extracted.amount,
      declared: declared.amount,
    })
  }
  if (declared.maturityDate && extracted.maturityDate) {
    checks.push({
      field: 'Maturity date',
      match: extracted.maturityDate === declared.maturityDate,
      extracted: extracted.maturityDate,
      declared: declared.maturityDate,
    })
  }
  const patternMismatch = Boolean(
    bank?.pattern && declared.fdNumber && !new RegExp(bank.pattern, 'i').test(normalizeFdNumber(declared.fdNumber)),
  )
  return {
    checks,
    fieldsChecked: checks.length,
    fieldsMatched: checks.filter((c) => c.match).length,
    patternMismatch,
    amountMismatch: checks.some((c) => c.field === 'Amount' && !c.match),
    dateMismatch: checks.some((c) => c.field === 'Maturity date' && !c.match),
  }
}

export async function runOcr(dataUrl, { onProgress, timeoutMs = 60000 } = {}) {
  try {
    const Tesseract = await loadTesseract()
    const job = Tesseract.recognize(dataUrl, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') onProgress?.(Math.round((m.progress || 0) * 100))
      },
    })
    const result = await Promise.race([
      job,
      new Promise((_, reject) => setTimeout(() => reject(new Error('OCR timed out')), timeoutMs)),
    ])
    return {
      ok: true,
      engine: 'tesseract.js (browser WASM)',
      confidence: Math.round(result.data.confidence || 0),
      text: result.data.text || '',
      fields: parseFields(result.data.text || ''),
      words: result.data.words?.length || 0,
    }
  } catch (error) {
    return {
      ok: false,
      engine: 'unavailable',
      confidence: 0,
      text: '',
      fields: null,
      error: error?.message || 'OCR failed',
    }
  }
}
