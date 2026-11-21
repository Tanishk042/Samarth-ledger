import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSeed, BANKS, COLLEGES } from '../data/seed'
import { DEFAULT_SETTINGS, ROLES } from '../lib/constants'
import { addDays, isoDate, uid } from '../lib/utils'
import { sha256Hex, sha256Blob } from '../lib/hash'
import { ANCHORABLE, createBlock } from '../lib/ledger'
import { evaluateReleaseRules, REVERT, voiceRequired } from '../lib/release'
import { generateReleaseCertificate, generateRenewalPdf } from '../lib/pdf'
import { generateBankKey, proofPayload, signPayload, verifyPayload } from '../lib/proof'
import { clearQueue, enqueue, queueAll } from '../lib/offline'
import { toast } from './useToast'
import { apiEnabled } from '../lib/api'

const DAY = 86400000
const seedNow = new Date()
const seed = buildSeed(seedNow)

const nowAt = (offset = 0) => new Date(Date.now() + offset * DAY)
const isoNow = (offset = 0) => nowAt(offset).toISOString()

function actorFor(state) {
  if (!state.user) return { actor: 'System', role: 'system' }
  return { actor: state.user.person, role: state.user.id }
}

function makeAudit(state, action, target, detail) {
  const { actor, role } = actorFor(state)
  return {
    id: `AUD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    at: isoNow(state.clockOffsetDays),
    actor,
    role,
    action,
    target,
    detail,
  }
}

function makeEvent(state, topic, payload, simulated = true) {
  return {
    id: `EVT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    topic,
    payload,
    at: isoNow(state.clockOffsetDays),
    simulated,
  }
}

function makeNotification(payload, state) {
  return {
    id: `NTF-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    at: isoNow(state.clockOffsetDays),
    read: false,
    audience: 'institution',
    ...payload,
  }
}

function nextFdrId(fdrs) {
  const max = fdrs.reduce((acc, f) => {
    const n = Number(String(f.id).split('-').pop())
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `FDR-2026-${String(max + 1).padStart(4, '0')}`
}

function nextReleaseId(list) {
  const max = list.reduce((acc, r) => Math.max(acc, Number(String(r.id).split('-').pop()) || 0), 0)
  return `REL-${String(max + 1).padStart(4, '0')}`
}

function statusFromDecision(decision) {
  if (!decision) return 'under_review'
  if (decision.band === 'high') return 'verified'
  if (decision.band === 'low') return 'rejected'
  return 'under_review'
}

let bootstrapPromise = null

async function serverSyncFdr(fdr, role) {
  if (!apiEnabled) return null
  try {
    const res = await fetch('/api/fdrs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Demo-Role': role || 'institution' },
      body: JSON.stringify({ fdr }),
      signal: AbortSignal.timeout(4500),
    })
    if (!res.ok) return
    const data = await res.json()
    return data
  } catch {
    // Local-first fallback: no server persistence configured or dev server has no /api.
    return null
  }
}

export const useStore = create(
  persist(
    (set, get) => ({
      // ── session & preferences ────────────────────────────────────────────────
      role: null,
      user: null,
      theme: 'light',
      lang: 'en',
      settings: { ...DEFAULT_SETTINGS },

      // ── domain data ──────────────────────────────────────────────────────────
      fdrs: seed.fdrs,
      notifications: seed.notifications,
      audit: seed.audit,
      events: seed.events,
      releaseRequests: seed.releaseRequests,
      proofs: [],
      bankKeys: {},
      blocks: [],
      clockOffsetDays: 0,
      offline: false,
      offlineQueue: [],
      offlineReplaying: false,
      tamperedFdrId: null,
      tamperBackup: null,
      booted: false,
      docsAnchored: false,
      ledgerVerification: null,

      // ── auth ─────────────────────────────────────────────────────────────────
      login: (role, email, password) => {
        if (!ROLES[role]) return { ok: false, message: 'Unknown role.' }
        if (password !== undefined && password !== '' && String(password).length < 4) {
          return { ok: false, message: 'Demo password must be at least 4 characters.' }
        }
        const meta = ROLES[role]
        const user = { ...meta, email: email || meta.email }
        set({ role, user })
        set((s) => ({
          audit: [makeAudit({ ...s, user }, 'LOGIN', meta.org, `${role} demo session started`), ...s.audit],
        }))
        toast(`Signed in as ${meta.label}`, { tone: 'success' })
        return { ok: true }
      },

      logout: () => {
        set((s) => ({
          audit: [makeAudit(s, 'LOGOUT', s.user?.org || 'Session', 'Demo session ended'), ...s.audit],
          role: null,
          user: null,
        }))
        toast('Signed out of the demo')
      },

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setLang: (lang) => set({ lang }),

      // ── ledger ───────────────────────────────────────────────────────────────
      ensureLedger: async () => {
        const { fdrs, blocks } = get()
        const anchored = new Set(blocks.filter((b) => b.type === 'FDR_REGISTERED').map((b) => b.fdrId))
        const missing = fdrs
          .filter((f) => ANCHORABLE(f) && !anchored.has(f.id))
          .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
        if (!missing.length) return blocks
        const next = [...blocks]
        for (const fdr of missing) {
          const docHash = fdr.documents?.find((d) => d.hash)?.hash || null
          const timestamp = fdr.createdAt ? `${fdr.createdAt}T10:00:00.000Z` : isoNow(get().clockOffsetDays)
          const block = await createBlock({
            blocks: next,
            fdr,
            type: 'FDR_REGISTERED',
            actor: 'AI verification agent',
            docHash,
            timestamp,
          })
          next.push(block)
        }
        set({ blocks: next })
        return next
      },

      appendLedgerBlock: async ({ fdr, type, actor, docHash, timestamp }) => {
        const block = await createBlock({
          blocks: get().blocks,
          fdr,
          type,
          actor,
          docHash,
          timestamp: timestamp || isoNow(get().clockOffsetDays),
        })
        set((s) => ({ blocks: [...s.blocks, block] }))
        return block
      },

      setLedgerVerification: (result) => set({ ledgerVerification: result }),

      tamperDemo: () => {
        const { fdrs, blocks } = get()
        const anchored = new Set(blocks.filter((b) => b.type === 'FDR_REGISTERED').map((b) => b.fdrId))
        const victim = fdrs.find((f) => anchored.has(f.id) && f.status === 'verified')
        if (!victim) {
          toast('No anchored verified record is available to tamper with.', { tone: 'danger' })
          return null
        }
        const backup = { id: victim.id, amount: victim.amount }
        set((s) => ({
          fdrs: s.fdrs.map((f) => (f.id === victim.id ? { ...f, amount: f.amount + 250000 } : f)),
          tamperedFdrId: victim.id,
          tamperBackup: backup,
          audit: [
            makeAudit(s, 'DEMO_TAMPER', victim.id, 'Off-chain amount edited by ₹2,50,000 without re-anchoring'),
            ...s.audit,
          ],
          events: [
            makeEvent(s, 'ledger.tampered', `${victim.id} · off-chain edit`),
            ...s.events,
          ].slice(0, 80),
          ledgerVerification: null,
        }))
        toast(`Tampered with ${victim.id}. Run the integrity check to see the mismatch.`, {
          tone: 'danger',
          actionLabel: 'Open explorer',
          actionHref: `/explorer?tampered=${victim.id}`,
        })
        return victim.id
      },

      restoreTamper: () => {
        const backup = get().tamperBackup
        if (!backup) return
        set((s) => ({
          fdrs: s.fdrs.map((f) => (f.id === backup.id ? { ...f, amount: backup.amount } : f)),
          tamperedFdrId: null,
          tamperBackup: null,
          audit: [makeAudit(s, 'DEMO_RESTORE', backup.id, 'Original amount restored'), ...s.audit],
          ledgerVerification: null,
        }))
        toast('Original record restored. Re-run the integrity check.', { tone: 'success' })
      },

      // ── submissions ──────────────────────────────────────────────────────────
      addFdr: async (input) => {
        const state = get()
        const id = nextFdrId(state.fdrs)
        const status = state.offline ? 'pending_sync' : statusFromDecision(input.decision)
        const sampled =
          input.decision?.band === 'high' &&
          Math.random() * 100 < Number(state.settings.samplingRate || 0)
        const fdr = {
          id,
          fdNumber: input.fdNumber,
          collegeId: input.collegeId || 'COL-RVCE',
          bankId: input.bankId,
          branch: input.branch || BANKS.find((b) => b.id === input.bankId)?.branch,
          signatory: input.signatory || 'A. Deshpande',
          amount: Number(input.amount),
          interestRate: input.interestRate || 7,
          tenureYears: input.tenureYears || 1,
          issueDate: input.issueDate,
          maturityDate: input.maturityDate,
          status,
          source: input.source || 'upload',
          trustScore: input.decision?.score ?? input.trustScore ?? 0,
          reasons: input.reasons || input.decision?.experts || {},
          samplings: sampled ? ['human_sample'] : [],
          soulbound: status === 'verified',
          tokenId: `SBT-${String(Number(id.split('-').pop())).padStart(4, '0')}`,
          riskHold: false,
          riskNote: null,
          grievance: false,
          fraudRing: false,
          documents: (input.documents || []).map((d) => ({
            id: uid('DOC'),
            uploadedAt: isoDate(nowAt(state.clockOffsetDays)),
            ...d,
          })),
          renewalDoc: null,
          releaseCertificate: null,
          lastProofAt: null,
          createdBy: state.user?.person || 'Institution user',
          createdAt: isoDate(nowAt(state.clockOffsetDays)),
          updatedAt: isoDate(nowAt(state.clockOffsetDays)),
          consent: input.consent || null,
          notes: input.notes || '',
          diagnostics: input.diagnostics || null,
        }

        const institutionNote = makeNotification(
          {
            type: status === 'verified' ? 'fdr.verified' : status === 'rejected' ? 'fdr.rejected' : 'fdr.under_review',
            title:
              status === 'verified'
                ? 'FDR verified and anchored'
                : status === 'rejected'
                  ? 'FDR rejected — request a clearer copy'
                  : 'FDR sent to an AICTE officer',
            body:
              status === 'verified'
                ? `${id} passed the explainable check with trust ${fdr.trustScore}/100. A fingerprint is now on the ledger.`
                : status === 'rejected'
                  ? `${id} scored ${fdr.trustScore}/100. Upload a clearer original or use the AA route.`
                  : `${id} scored ${fdr.trustScore}/100. An officer will review the highlighted reasons.`,
            fdrId: id,
          },
          state,
        )

        set((s) => ({
          fdrs: [fdr, ...s.fdrs],
          notifications: [institutionNote, ...s.notifications],
          audit: [
            makeAudit(s, 'FDR_SUBMITTED', id, `${input.source === 'aa' ? 'Route A · AA sandbox' : 'Route B · document upload'} · trust ${fdr.trustScore}`),
            ...s.audit,
          ],
          events: [
            makeEvent(s, 'fdr.submitted', `${id} · ${fdr.source === 'aa' ? 'AA sandbox' : 'upload'}`),
            ...(status === 'verified' ? [makeEvent(s, 'fdr.verified', `${id} · trust ${fdr.trustScore}`)] : []),
            ...(status === 'rejected' ? [makeEvent(s, 'fdr.rejected', `${id} · trust ${fdr.trustScore}`)] : []),
            ...s.events,
          ].slice(0, 80),
        }))

        if (state.offline) {
          try {
            await enqueue({
              id,
              queuedAt: isoNow(state.clockOffsetDays),
              fdr,
            })
            set((s) => ({
              offlineQueue: [
                ...s.offlineQueue,
                { id, at: isoNow(s.clockOffsetDays), label: `${id} · ${fdr.fdNumber}`, amount: fdr.amount },
              ],
            }))
            toast(`${id} stored in the offline queue. Reconnect to replay.`, { tone: 'warning' })
          } catch {
            toast('Offline queue unavailable. The submission stays pending in this tab.', { tone: 'warning' })
          }
        } else {
          await get().ensureLedger()
          void serverSyncFdr(fdr, state.role)
          toast(
            status === 'verified'
              ? `${id} verified · trust ${fdr.trustScore}/100 · fingerprint anchored`
              : status === 'rejected'
                ? `${id} rejected · trust ${fdr.trustScore}/100`
                : `${id} sent to the officer queue · trust ${fdr.trustScore}/100`,
            { tone: status === 'rejected' ? 'danger' : status === 'verified' ? 'success' : 'warning' },
          )
        }
        return { id, status, sampled }
      },

      syncOffline: async () => {
        if (get().offline || get().offlineReplaying) return { replayed: 0 }
        let items = []
        try {
          items = await queueAll()
        } catch {
          return { replayed: 0 }
        }
        if (!items.length) {
          set({ offlineQueue: [] })
          return { replayed: 0 }
        }
        items.sort((a, b) => String(a.queuedAt).localeCompare(String(b.queuedAt)))
        set({ offlineReplaying: true })
        const state = get()
        const known = new Set(state.fdrs.map((f) => f.id))
        let fdrs = [...state.fdrs]
        let notifications = [...state.notifications]
        const audits = []
        let replayed = 0
        for (const item of items) {
          const status = statusFromDecision(item.fdr?.decision || { band: 'medium' })
          const existing = fdrs.find((f) => f.id === item.id)
          if (existing) {
            fdrs = fdrs.map((f) =>
              f.id === item.id
                ? { ...f, status, soulbound: status === 'verified', trustScore: f.trustScore || item.fdr.trustScore }
                : f,
            )
          } else if (!known.has(item.id)) {
            fdrs = [{ ...item.fdr, status, soulbound: status === 'verified' }, ...fdrs]
            known.add(item.id)
          }
          replayed += 1
          notifications = [
            makeNotification(
              {
                type: 'sync.replayed',
                title: 'Offline submission replayed',
                body: `${item.id} was replayed in order and anchored once. No duplicate was created.`,
                fdrId: item.id,
              },
              state,
            ),
            ...notifications,
          ]
          audits.push(makeAudit(state, 'OFFLINE_REPLAYED', item.id, 'Queued submission flushed exactly once'))
        }
        set({
          fdrs,
          notifications,
          audit: [...audits, ...state.audit],
          events: [
            makeEvent(state, 'sync.replayed', `${replayed} submission(s) replayed in order`),
            ...state.events,
          ].slice(0, 80),
          offlineQueue: [],
          offlineReplaying: false,
        })
        await clearQueue()
        await get().ensureLedger()
        toast(`${replayed} queued submission(s) replayed. Duplicate check passed.`, { tone: 'success' })
        return { replayed }
      },

      setOffline: async (offline) => {
        set({ offline })
        toast(
          offline
            ? 'Central server outage simulated. New submissions queue locally.'
            : 'Connection restored. Replaying the local queue…',
          { tone: offline ? 'warning' : 'success' },
        )
        if (!offline) await get().syncOffline()
      },

      // ── review workflow ──────────────────────────────────────────────────────
      reviewFdr: async (fdrId, decision, note = '') => {
        const state = get()
        const fdr = state.fdrs.find((f) => f.id === fdrId)
        if (!fdr) return { ok: false }
        const status = decision === 'approve' ? 'verified' : decision === 'reject' ? 'rejected' : 'under_review'
        set((s) => ({
          fdrs: s.fdrs.map((f) =>
            f.id === fdrId
              ? {
                  ...f,
                  status,
                  soulbound: status === 'verified' ? true : f.soulbound,
                  updatedAt: isoDate(nowAt(s.clockOffsetDays)),
                  notes: note || f.notes,
                  riskHold: decision === 'approve' ? false : f.riskHold,
                }
              : f,
          ),
          notifications: [
            makeNotification(
              {
                type: 'review.decision',
                title:
                  decision === 'approve'
                    ? 'Officer approved the deposit'
                    : decision === 'reject'
                      ? 'Officer rejected the deposit'
                      : 'Officer requested a clearer copy',
                body: note || `Decision recorded for ${fdrId}.`,
                fdrId,
              },
              s,
            ),
            ...s.notifications,
          ],
          audit: [
            makeAudit(
              s,
              decision === 'approve' ? 'REVIEW_APPROVED' : decision === 'reject' ? 'REVIEW_REJECTED' : 'REUPLOAD_REQUESTED',
              fdrId,
              note || 'Decision recorded from review queue',
            ),
            ...s.audit,
          ],
          events: [
            makeEvent(
              s,
              decision === 'approve' ? 'fdr.verified' : decision === 'reject' ? 'fdr.rejected' : 'fdr.under_review',
              `${fdrId} · officer ${decision}`,
            ),
            ...s.events,
          ].slice(0, 80),
        }))
        if (decision === 'approve') await get().ensureLedger()
        toast(`Decision saved for ${fdrId}`, { tone: decision === 'reject' ? 'danger' : 'success' })
        return { ok: true, status }
      },

      requestReplacementFdr: (fdrId, reason) => {
        set((s) => ({
          notifications: [
            makeNotification(
              {
                type: 'replacement.requested',
                title: 'Replacement FDR requested',
                body: reason || 'AICTE requested a replacement FDR from a healthier bank.',
                fdrId,
              },
              s,
            ),
            ...s.notifications,
          ],
          audit: [makeAudit(s, 'REPLACEMENT_REQUESTED', fdrId, reason || 'Risk-driven replacement request'), ...s.audit],
          events: [makeEvent(s, 'risk.flagged', `${fdrId} · replacement requested`), ...s.events].slice(0, 80),
        }))
        toast(`Replacement request sent to the institution for ${fdrId}`, { tone: 'warning' })
      },

      // ── notifications ────────────────────────────────────────────────────────
      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      markAllNotificationsRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      // ── double-lock releases ─────────────────────────────────────────────────
      requestRelease: (fdrId, reason = '') => {
        const state = get()
        const existing = state.releaseRequests.find((r) => r.fdrId === fdrId && r.status === 'pending')
        if (existing) {
          toast(`A release request already exists for ${fdrId}`, { tone: 'warning' })
          return existing.id
        }
        const release = {
          id: nextReleaseId(state.releaseRequests),
          fdrId,
          requestedAt: isoNow(state.clockOffsetDays),
          requestedBy: state.user?.person || 'Institution user',
          reason: reason || 'Release requested from the institution portal.',
          status: 'pending',
          key1: null,
          key2: null,
          voice: { verified: false, method: null, phrase: null },
          revert: null,
          rulesOverride: [],
        }
        set((s) => ({
          releaseRequests: [release, ...s.releaseRequests],
          notifications: [
            makeNotification(
              {
                type: 'release.requested',
                title: 'Release requested',
                body: `${fdrId} entered the double-lock queue. Key 1 is signed only if every rule passes.`,
                fdrId,
                audience: 'officer',
              },
              s,
            ),
            ...s.notifications,
          ],
          audit: [makeAudit(s, 'RELEASE_REQUESTED', fdrId, reason || 'Institution requested release'), ...s.audit],
          events: [makeEvent(s, 'release.requested', `${fdrId} · double-lock queue`), ...s.events].slice(0, 80),
        }))
        toast(`Release request ${release.id} created`, { tone: 'success' })
        return release.id
      },

      signKey1: async (releaseId) => {
        const state = get()
        const release = state.releaseRequests.find((r) => r.id === releaseId)
        if (!release) return { ok: false, message: 'Unknown release request.' }
        const fdr = state.fdrs.find((f) => f.id === release.fdrId)
        const college = COLLEGES.find((c) => c.id === fdr?.collegeId)
        const evaluation = evaluateReleaseRules({
          fdr,
          college,
          settings: state.settings,
          now: nowAt(state.clockOffsetDays),
          paused: state.settings.autoPause,
        })
        if (!evaluation.allPass) {
          const message = state.settings.autoPause ? REVERT.pause : REVERT.rules
          set((s) => ({
            releaseRequests: s.releaseRequests.map((r) =>
              r.id === releaseId
                ? { ...r, revert: { at: isoNow(s.clockOffsetDays), message, stage: 'key1', rules: evaluation.rules } }
                : r,
            ),
            audit: [makeAudit(s, 'RELEASE_BLOCKED', fdr?.id || release.fdrId, `Key 1 refused: ${evaluation.rules.find((r) => !r.pass)?.label || 'rule failed'}`), ...s.audit],
          }))
          return { ok: false, message, rules: evaluation.rules }
        }
        const at = isoNow(state.clockOffsetDays)
        const signature = `0x${await sha256Hex(`AI-AGENT|${fdr.id}|${release.id}|${at}|v1`)}`
        set((s) => ({
          releaseRequests: s.releaseRequests.map((r) =>
            r.id === releaseId
              ? {
                  ...r,
                  key1: { actor: 'AI release agent', at, signature, rulesPassed: evaluation.rules.map((x) => x.key) },
                  revert: null,
                }
              : r,
          ),
          audit: [makeAudit(s, 'AI_KEY_SIGNED', fdr.id, `All ${evaluation.rules.length} rules passed · key 1 signed`), ...s.audit],
          events: [makeEvent(s, 'release.ai_signed', `${fdr.id} · key 1`), ...s.events].slice(0, 80),
        }))
        await get().appendLedgerBlock({
          fdr,
          type: 'AI_SIGNED',
          actor: 'AI release agent',
          timestamp: at,
        })
        toast('Key 1 signed by the AI release agent', { tone: 'success' })
        return { ok: true, rules: evaluation.rules }
      },

      signKey2: async (releaseId, { method = 'simulated', credentialId = '', label = '' } = {}) => {
        const state = get()
        const release = state.releaseRequests.find((r) => r.id === releaseId)
        if (!release) return { ok: false, message: 'Unknown release request.' }
        const fdr = state.fdrs.find((f) => f.id === release.fdrId)
        if (state.settings.autoPause) {
          set((s) => ({
            releaseRequests: s.releaseRequests.map((r) =>
              r.id === releaseId
                ? { ...r, revert: { at: isoNow(s.clockOffsetDays), message: REVERT.pause, stage: 'key2' } }
                : r,
            ),
            audit: [makeAudit(s, 'RELEASE_BLOCKED', fdr?.id, 'Officer key refused: emergency pause'), ...s.audit],
          }))
          return { ok: false, message: REVERT.pause }
        }
        if (!release.key1) {
          set((s) => ({
            releaseRequests: s.releaseRequests.map((r) =>
              r.id === releaseId
                ? { ...r, revert: { at: isoNow(s.clockOffsetDays), message: REVERT.dual, stage: 'key2' } }
                : r,
            ),
            audit: [makeAudit(s, 'RELEASE_BLOCKED', fdr?.id, 'Officer key refused: AI key missing'), ...s.audit],
          }))
          return { ok: false, message: REVERT.dual }
        }
        if (voiceRequired(fdr, state.settings) && !release.voice?.verified) {
          return { ok: false, message: REVERT.voice, needVoice: true }
        }
        const at = isoNow(state.clockOffsetDays)
        const signature = `0x${await sha256Hex(`OFFICER|${fdr.id}|${release.id}|${at}|${method}|${credentialId}`)}`
        const key2 = {
          actor: state.user?.person || 'AICTE officer',
          at,
          signature,
          method: label || method,
          credentialId,
        }
        const college = COLLEGES.find((c) => c.id === fdr.collegeId)
        const bank = BANKS.find((b) => b.id === fdr.bankId)
        const certificate = generateReleaseCertificate({
          fdr,
          college,
          bank,
          keys: { key1: release.key1, key2 },
          now: nowAt(state.clockOffsetDays),
        })
        set((s) => ({
          releaseRequests: s.releaseRequests.map((r) =>
            r.id === releaseId ? { ...r, key2, status: 'released', revert: null } : r,
          ),
          fdrs: s.fdrs.map((f) =>
            f.id === fdr.id
              ? {
                  ...f,
                  status: 'released',
                  soulbound: true,
                  releasedAt: at,
                  updatedAt: isoDate(nowAt(s.clockOffsetDays)),
                  releaseCertificate: certificate.dataUri,
                  releaseCertificateName: certificate.filename,
                }
              : f,
          ),
          notifications: [
            makeNotification(
              {
                type: 'release.completed',
                title: 'Double-lock release completed',
                body: `${fdr.id} released with both keys. Certificate and ledger block are available.`,
                fdrId: fdr.id,
              },
              s,
            ),
            ...s.notifications,
          ],
          audit: [makeAudit(s, 'RELEASE_COMPLETED', fdr.id, `Key 2 (${key2.method}) + key 1 verified · ${fdr.amount}`), ...s.audit],
          events: [
            makeEvent(s, 'release.officer_signed', `${fdr.id} · key 2`),
            makeEvent(s, 'release.completed', `${fdr.id} · both keys present`),
            ...s.events,
          ].slice(0, 80),
        }))
        await get().appendLedgerBlock({
          fdr,
          type: 'RELEASED',
          actor: key2.actor,
          timestamp: at,
        })
        toast(`Release complete for ${fdr.id}. Both keys recorded.`, { tone: 'success' })
        return { ok: true }
      },

      recordVoice: (releaseId, { verified, method = 'typed', phrase = '' }) => {
        set((s) => ({
          releaseRequests: s.releaseRequests.map((r) =>
            r.id === releaseId
              ? { ...r, voice: { verified, method, phrase, at: isoNow(s.clockOffsetDays) } }
              : r,
          ),
          audit: [
            makeAudit(
              s,
              verified ? 'VOICE_CHALLENGE_PASSED' : 'VOICE_CHALLENGE_FAILED',
              releaseId,
              `${method} factor · additional check only`,
            ),
            ...s.audit,
          ],
        }))
        if (verified) toast('Voice challenge verified — an additional factor, never the only factor.', { tone: 'success' })
      },

      attemptRelease: (releaseId) => {
        const state = get()
        const release = state.releaseRequests.find((r) => r.id === releaseId)
        if (!release) return { ok: false, message: 'Unknown release request.' }
        const fdr = state.fdrs.find((f) => f.id === release.fdrId)
        let message = null
        if (state.settings.autoPause) message = REVERT.pause
        else if (!release.key1) message = REVERT.dual
        else if (!release.key2) message = REVERT.dual
        else if (voiceRequired(fdr, state.settings) && !release.voice?.verified) message = REVERT.voice
        set((s) => ({
          releaseRequests: s.releaseRequests.map((r) =>
            r.id === releaseId
              ? { ...r, revert: message ? { at: isoNow(s.clockOffsetDays), message, stage: 'attempt' } : null }
              : r,
          ),
          audit: message
            ? [makeAudit(s, 'RELEASE_BLOCKED', fdr?.id, `Contract revert: ${message}`), ...s.audit]
            : s.audit,
        }))
        if (message) toast('Contract reverted. See the red panel for the exact reason.', { tone: 'danger' })
        return { ok: !message, message }
      },

      // ── reminders & time machine ─────────────────────────────────────────────
      advanceClock: async (days) => {
        const next = get().clockOffsetDays + Number(days)
        set({ clockOffsetDays: next })
        const result = await get().runReminders()
        toast(
          result.created
            ? `Clock +${days} days · ${result.created} reminder or escalation event(s) created`
            : `Clock +${days} days · no new reminders in this window`,
          { tone: result.created ? 'success' : 'default' },
        )
        return result
      },

      setClockOffset: async (days) => {
        set({ clockOffsetDays: Number(days) })
        return get().runReminders()
      },

      runReminders: async () => {
        const state = get()
        const now = nowAt(state.clockOffsetDays)
        const existing = new Set(state.notifications.map((n) => `${n.type}:${n.fdrId}`))
        const updates = new Map()
        const newNotifications = []
        const newEvents = []
        const audits = []
        let created = 0

        const active = state.fdrs.filter((f) => ['verified', 'renewal_due'].includes(f.status))
        const leadDays = [...(state.settings.reminderLeadDays || [60, 30])]
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
          .sort((a, b) => b - a)
        const [leadLong, leadShort] = leadDays.length >= 2 ? leadDays : [60, 30]
        const escalationDays = Number(state.settings.escalationDays ?? 7)
        const startOfDay = (value) => {
          const copy = new Date(value)
          copy.setHours(0, 0, 0, 0)
          return copy
        }
        for (const fdr of active) {
          const maturity = new Date(fdr.maturityDate)
          const days = Math.ceil((startOfDay(maturity) - startOfDay(now)) / DAY)
          const college = COLLEGES.find((c) => c.id === fdr.collegeId)
          if (days <= leadLong && days > leadShort && !existing.has(`reminder.${leadLong}d:${fdr.id}`)) {
            newNotifications.push(
              makeNotification(
                {
                  type: `reminder.${leadLong}d`,
                  title: `Maturity reminder · ${leadLong} days`,
                  body: `${fdr.fdNumber} at ${fdr.bankId.toUpperCase()} matures on ${fdr.maturityDate}. An AI-prepared renewal draft is attached.`,
                  fdrId: fdr.id,
                },
                state,
              ),
            )
            newEvents.push(makeEvent(state, `reminder.${leadLong}d`, `${fdr.id} · ${days} days`))
            audits.push(makeAudit(state, 'REMINDER_SENT', fdr.id, `${leadLong}-day reminder · ${days} days to maturity`))
            existing.add(`reminder.${leadLong}d:${fdr.id}`)
            created += 1
          }
          if (days <= leadShort && days > 0 && !existing.has(`reminder.${leadShort}d:${fdr.id}`)) {
            newNotifications.push(
              makeNotification(
                {
                  type: `reminder.${leadShort}d`,
                  title: `Maturity reminder · ${leadShort} days`,
                  body: `${fdr.fdNumber} matures in ${days} days. Confirm renewal instructions or request release.`,
                  fdrId: fdr.id,
                },
                state,
              ),
            )
            newEvents.push(makeEvent(state, `reminder.${leadShort}d`, `${fdr.id} · ${days} days`))
            audits.push(makeAudit(state, 'REMINDER_SENT', fdr.id, `${leadShort}-day reminder · ${days} days to maturity`))
            existing.add(`reminder.${leadShort}d:${fdr.id}`)
            created += 1
          }
          if (days <= 0 && fdr.status === 'verified') {
            updates.set(fdr.id, { status: 'renewal_due', updatedAt: isoDate(now) })
          }
          if (days <= 0 && !existing.has(`maturity.passed:${fdr.id}`)) {
            newNotifications.push(
              makeNotification(
                {
                  type: 'maturity.passed',
                  title: 'Maturity reached — action required',
                  body: `${fdr.fdNumber} matured on ${fdr.maturityDate}. Renewal or a double-lock release must be initiated.`,
                  fdrId: fdr.id,
                },
                state,
              ),
            )
            newEvents.push(makeEvent(state, 'renewal.prepared', `${fdr.id} · maturity reached`))
            audits.push(makeAudit(state, 'MATURITY_REACHED', fdr.id, 'Reminder escalated at maturity'))
            existing.add(`maturity.passed:${fdr.id}`)
            created += 1
          }
          if (days <= -escalationDays && days >= -(escalationDays + 365) && !existing.has(`escalation:${fdr.id}`)) {
            newNotifications.push(
              makeNotification(
                {
                  type: 'escalation',
                  title: 'No institution response — escalated',
                  body: `${fdr.fdNumber} (${college?.code || fdr.collegeId}) is past maturity with no recorded instruction. Officer review requested.`,
                  fdrId: fdr.id,
                  audience: 'officer',
                },
                state,
              ),
            )
            newEvents.push(makeEvent(state, 'renewal.prepared', `${fdr.id} · officer escalation`))
            audits.push(
              makeAudit(state, 'ESCALATED_TO_OFFICER', fdr.id, `No institution response ${escalationDays} day(s) after maturity`),
            )
            existing.add(`escalation:${fdr.id}`)
            created += 1
          }
        }

        set((s) => ({
          fdrs: s.fdrs.map((f) => (updates.has(f.id) ? { ...f, ...updates.get(f.id) } : f)),
          notifications: [...newNotifications, ...s.notifications],
          events: [...newEvents, ...s.events].slice(0, 80),
          audit: [...audits, ...s.audit],
        }))

        // Generate at most two PDF drafts per run to keep the interaction snappy.
        const needsDraft = active
          .filter((f) => !get().fdrs.find((x) => x.id === f.id)?.renewalDoc)
          .slice(0, 2)
        for (const fdr of needsDraft) {
          const days = Math.ceil((new Date(fdr.maturityDate) - new Date(now)) / DAY)
          if (days <= 60 && days > 0) {
            const bank = BANKS.find((b) => b.id === fdr.bankId)
            const college = COLLEGES.find((c) => c.id === fdr.collegeId)
            const pdf = generateRenewalPdf({ fdr, college, bank, now: new Date(now) })
            set((s) => ({
              fdrs: s.fdrs.map((f) =>
                f.id === fdr.id ? { ...f, renewalDoc: pdf.dataUri, renewalDocName: pdf.filename } : f,
              ),
              events: [makeEvent(s, 'renewal.prepared', `${fdr.id} · PDF draft`), ...s.events].slice(0, 80),
            }))
          }
        }
        return { created }
      },

      // ── bank proofs ──────────────────────────────────────────────────────────
      ensureBankKeys: async () => {
        const current = get().bankKeys
        const next = { ...current }
        for (const bank of BANKS) {
          if (!next[bank.id]) next[bank.id] = await generateBankKey()
        }
        set({ bankKeys: next })
        return next
      },

      ensureSeedProofs: async () => {
        if (get().proofs.length) return
        const keys = get().bankKeys
        const proofs = []
        const today = nowAt(get().clockOffsetDays)
        for (const bank of BANKS) {
          const fdCount = get().fdrs.filter((f) => f.bankId === bank.id && f.status !== 'released').length
          for (let d = 0; d < 5; d += 1) {
            // Saraswat deliberately skips yesterday so the "missed proof" alert is real.
            if (bank.id === 'saraswat' && d === 1) continue
            const date = isoDate(addDays(today, -d))
            const payload = proofPayload({ bank, date, fdCount })
            const signature = await signPayload(payload, keys[bank.id].privateJwk)
            proofs.push({
              id: `PRF-${bank.id}-${date}`,
              bankId: bank.id,
              date,
              payload,
              signature,
              publicJwk: keys[bank.id].publicJwk,
              valid: true,
              seeded: true,
              createdAt: `${date}T09:30:00.000Z`,
              signer: 'Daily proof agent (demo)',
            })
          }
          if (bank.id === 'cosmos') {
            const date = isoDate(addDays(today, -3))
            proofs.push({
              id: `PRF-${bank.id}-${date}-bad`,
              bankId: bank.id,
              date,
              payload: proofPayload({ bank, date, fdCount }),
              signature: 'aW52YWxpZC1kZW1vLXNpZ25hdHVyZQ==',
              publicJwk: keys[bank.id].publicJwk,
              valid: false,
              seeded: true,
              createdAt: `${date}T09:31:00.000Z`,
              signer: 'Daily proof agent (tampered demo)',
            })
          }
        }
        set({ proofs })
      },

      createProof: async (bankId) => {
        const state = get()
        const bank = BANKS.find((b) => b.id === bankId)
        if (!bank) return null
        const keys = state.bankKeys[bank.id] || (await get().ensureBankKeys())[bank.id]
        const date = isoDate(nowAt(state.clockOffsetDays))
        const fdCount = state.fdrs.filter((f) => f.bankId === bank.id && f.status !== 'released').length
        const payload = proofPayload({ bank, date, fdCount })
        const signature = await signPayload(payload, keys.privateJwk)
        const proof = {
          id: `PRF-${bank.id}-${date}-${Math.random().toString(36).slice(2, 5)}`,
          bankId: bank.id,
          date,
          payload,
          signature,
          publicJwk: keys.publicJwk,
          valid: true,
          seeded: false,
          createdAt: isoNow(state.clockOffsetDays),
          signer: `${state.user?.person || 'Bank agent'} · ${bank.short}`,
        }
        set((s) => ({
          proofs: [proof, ...s.proofs],
          audit: [makeAudit(s, 'PROOF_CREATED', bank.name, `Daily locked-balance proof · ${fdCount} FDRs · no customer data`), ...s.audit],
          events: [makeEvent(s, 'proof.created', `${bank.short} · ${date}`), ...s.events].slice(0, 80),
        }))
        toast(`Signed proof published for ${bank.short}. Amount locked: YES.`, { tone: 'success' })
        return proof
      },

      verifyProof: async (proofId) => {
        const proof = get().proofs.find((p) => p.id === proofId)
        if (!proof) return false
        const valid = await verifyPayload(proof.payload, proof.signature, proof.publicJwk)
        set((s) => ({
          proofs: s.proofs.map((p) => (p.id === proofId ? { ...p, valid, checkedAt: isoNow(s.clockOffsetDays) } : p)),
          audit: [makeAudit(s, valid ? 'PROOF_VERIFIED' : 'PROOF_INVALID', proof.bankId, `ECDSA signature ${valid ? 'verified' : 'failed'}`), ...s.audit],
        }))
        toast(valid ? 'Proof signature is valid.' : 'Proof signature is invalid — investigate the agent.', {
          tone: valid ? 'success' : 'danger',
        })
        return valid
      },

      rotateBankKey: async (bankId) => {
        const bank = BANKS.find((b) => b.id === bankId)
        if (!bank) return null
        const key = await generateBankKey()
        set((s) => ({
          bankKeys: { ...s.bankKeys, [bank.id]: key },
          audit: [
            makeAudit(s, 'BANK_KEY_ROTATED', bank.name, 'New ECDSA P-256 signing key generated · prior proofs keep their own public key'),
            ...s.audit,
          ],
          events: [makeEvent(s, 'bank.key_rotated', `${bank.short} · signing key rotated`), ...s.events].slice(0, 80),
        }))
        toast(`${bank.short} signing key rotated. Existing proofs remain verifiable.`, { tone: 'success' })
        return key
      },

      missedProofDates: (bankId) => {
        const state = get()
        const today = nowAt(state.clockOffsetDays)
        const expected = Array.from({ length: 5 }, (_, i) => isoDate(addDays(today, -i)))
        const present = new Set(state.proofs.filter((p) => p.bankId === bankId && p.valid !== false).map((p) => p.date))
        return expected.filter((d) => !present.has(d))
      },

      // ── settings ─────────────────────────────────────────────────────────────
      updateSettings: (patch) => {
        set((s) => ({
          settings: { ...s.settings, ...patch },
          audit: [makeAudit(s, 'SETTINGS_UPDATED', 'Policy settings', JSON.stringify(patch).slice(0, 180)), ...s.audit],
        }))
        toast('Policy settings saved. New checks use these values.', { tone: 'success' })
      },

      togglePause: (reason = '') => {
        const next = !get().settings.autoPause
        set((s) => ({
          settings: { ...s.settings, autoPause: next, pauseReason: next ? reason || 'Officer emergency pause' : '' },
          audit: [makeAudit(s, next ? 'EMERGENCY_PAUSE_ON' : 'EMERGENCY_PAUSE_OFF', 'System', next ? reason || 'Pause engaged' : 'Pause cleared'), ...s.audit],
        }))
        toast(next ? 'Emergency pause engaged. All releases are blocked.' : 'Emergency pause cleared.', {
          tone: next ? 'warning' : 'success',
        })
      },

      // ── bootstrap / reset ───────────────────────────────────────────────────
      bootstrap: async () => {
        // React StrictMode can mount twice. Share one bootstrap run so blocks
        // and proofs are never anchored twice.
        if (bootstrapPromise) return bootstrapPromise
        bootstrapPromise = (async () => {
          await get().ensureBankKeys()
          await get().ensureSeedProofs()
          if (!get().docsAnchored) {
            try {
              const hashes = {}
              for (const kind of ['genuine', 'edited', 'blurry']) {
                const res = await fetch(`/samples/${kind}.png`)
                if (res.ok) hashes[kind] = await sha256Blob(await res.blob())
              }
              const fdrs = get().fdrs.map((f) => ({
                ...f,
                documents: (f.documents || []).map((d) =>
                  d.kind && hashes[d.kind] ? { ...d, hash: hashes[d.kind] } : d,
                ),
              }))
              set({ fdrs })
              // Anchor one document hash per non-rejected record that carries a sample doc.
              let blocks = [...get().blocks]
              for (const fdr of fdrs) {
                if (fdr.status === 'rejected') continue
                const doc = fdr.documents?.find((d) => d.hash)
                if (!doc) continue
                const exists = blocks.some((b) => b.type === 'DOC_ANCHORED' && b.fdrId === fdr.id)
                if (exists) continue
                const block = await createBlock({
                  blocks,
                  fdr,
                  type: 'DOC_ANCHORED',
                  actor: 'Document custody agent',
                  docHash: doc.hash,
                  timestamp: `${fdr.createdAt}T11:00:00.000Z`,
                })
                blocks.push(block)
              }
              set({ blocks, docsAnchored: true })
            } catch {
              set({ docsAnchored: true })
            }
          }
          await get().ensureLedger()
          set({ booted: true })
          return true
        })()
        try {
          return await bootstrapPromise
        } finally {
          bootstrapPromise = null
        }
      },

      resetDemo: async () => {
        const fresh = buildSeed(new Date())
        set({
          fdrs: fresh.fdrs,
          notifications: fresh.notifications,
          audit: fresh.audit,
          events: fresh.events,
          releaseRequests: fresh.releaseRequests,
          proofs: [],
          bankKeys: {},
          blocks: [],
          settings: { ...DEFAULT_SETTINGS },
          clockOffsetDays: 0,
          offline: false,
          offlineQueue: [],
          offlineReplaying: false,
          tamperedFdrId: null,
          tamperBackup: null,
          booted: false,
          docsAnchored: false,
          ledgerVerification: null,
        })
        try {
          await clearQueue()
        } catch {
          // IndexedDB may be blocked in private browsing; local state still resets.
        }
        await get().bootstrap()
        toast('Demo data reset to the seeded state.', { tone: 'success' })
      },
    }),
    {
      name: 'samarth-ledger-v1',
      version: 1,
      partialize: (state) => {
        // Persist everything except transient UI-only fields.
        const { ...rest } = state
        return rest
      },
    },
  ),
)

export const useFdrById = (id) => useStore((s) => s.fdrs.find((f) => f.id === id))
