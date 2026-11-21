/**
 * Small, dependency-free utilities shared by the client and demo scripts.
 */

export function cn(...args) {
  return args.filter(Boolean).join(' ')
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

export function uid(prefix = 'id') {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

export function formatINR(value, { compact = false } = {}) {
  const n = Number(value) || 0
  if (compact) {
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 2)} Cr`
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 2)} L`
    if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}k`
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatDate(value, opts = {}) {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  }).format(d)
}

export function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export function daysBetween(from, to) {
  const a = new Date(from)
  const b = new Date(to)
  return Math.ceil((b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)) / 86400000)
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function isoDate(value) {
  const d = value instanceof Date ? value : new Date(value)
  return d.toISOString().slice(0, 10)
}

export function shortHash(hash, size = 10) {
  if (!hash) return '—'
  return `${hash.slice(0, size)}…${hash.slice(-4)}`
}

export function titleCase(value = '') {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

export function pct(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

export function matchesQuery(haystack, query) {
  if (!query) return true
  return String(haystack).toLowerCase().includes(String(query).toLowerCase())
}

export function readableBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function downloadText(text, filename, type = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type }), filename)
}

export function toCSV(rows, columns) {
  const escape = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map((c) => escape(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => escape(c.value(row))).join(',')).join('\n')
  return `${header}\n${body}`
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function groupBy(list, keyFn) {
  return list.reduce((acc, item) => {
    const key = keyFn(item)
    ;(acc[key] ||= []).push(item)
    return acc
  }, {})
}

export function sum(list, keyFn = (x) => x) {
  return list.reduce((acc, item) => acc + (Number(keyFn(item)) || 0), 0)
}

export function unique(list) {
  return [...new Set(list)]
}

export function truncate(value = '', max = 48) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function normalizePan(value = '') {
  return value.replace(/\s+/g, '').toUpperCase()
}
