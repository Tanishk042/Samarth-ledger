import { scoreForensic } from '../../shared/forensic'

/**
 * Thin fetch helpers. Every call has a timeout and a local fallback contract.
 * Vite dev has no /api functions, so calls are skipped unless explicitly
 * enabled; Vercel builds (PROD) always use the real handlers.
 */
export const apiEnabled = import.meta.env.PROD || import.meta.env.VITE_ENABLE_API === '1'

export async function apiFetch(path, { method = 'GET', body, role, timeout = 8000, headers = {} } = {}) {
  if (!apiEnabled) {
    return { ok: false, offline: true, skipped: true, error: 'Serverless API disabled in local demo mode' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(role ? { 'X-Demo-Role': role } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { ok: false, error: 'Non-JSON response' }
    }
    return { ...data, httpStatus: res.status, transportOk: res.ok }
  } catch (error) {
    return { ok: false, error: error?.name === 'AbortError' ? 'Request timed out' : String(error), offline: true }
  } finally {
    clearTimeout(timer)
  }
}

export const apiGet = (path, options) => apiFetch(path, { ...options, method: 'GET' })
export const apiPost = (path, body, options) => apiFetch(path, { ...options, method: 'POST', body })

/** Local mirror of the server forensic contract, used when /api is unreachable. */
export function localForensic({ signals, thresholds, samplingRate, samplingRandom }) {
  return {
    ok: true,
    ...scoreForensic(signals, {
      thresholds,
      samplingRate,
      samplingRandom,
      mode: 'local-deterministic',
    }),
    engine: 'Browser deterministic engine',
  }
}
