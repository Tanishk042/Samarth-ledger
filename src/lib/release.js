import { daysBetween, formatDate, formatINR } from './utils.js'

/**
 * Deterministic rules engine for the double lock. Every rule returns a reason
 * so the officer can see exactly why the AI key was or was not released.
 */
export function evaluateReleaseRules({ fdr, college, settings, now = new Date(), paused = false }) {
  if (!fdr) return { rules: [], allPass: false }
  const daysToMaturity = daysBetween(now, fdr.maturityDate)
  const rules = [
    {
      key: 'maturity',
      label: 'Maturity reached',
      pass: daysToMaturity <= 0,
      detail:
        daysToMaturity <= 0
          ? `Matured on ${formatDate(fdr.maturityDate)}`
          : `${daysToMaturity} days remain until ${formatDate(fdr.maturityDate)}`,
    },
    {
      key: 'grievance',
      label: 'No pending grievance',
      pass: !fdr.grievance,
      detail: fdr.grievance ? 'An open institutional grievance is linked to this deposit.' : 'No open grievance found.',
    },
    {
      key: 'compliance',
      label: 'Compliance record good',
      pass: (college?.compliance ?? 0) >= 70,
      detail: `Institution compliance score ${college?.compliance ?? '—'}/100 (threshold 70).`,
    },
    {
      key: 'risk',
      label: 'No active risk hold',
      pass: !fdr.riskHold,
      detail: fdr.riskHold ? fdr.riskNote || 'A risk hold is active.' : 'No active risk hold.',
    },
    {
      key: 'limit',
      label: 'Below AI pre-approval limit',
      pass: Number(fdr.amount) <= Number(settings.preApprovalLimit),
      detail: `${formatINR(fdr.amount, { compact: true })} against a ${formatINR(settings.preApprovalLimit, { compact: true })} limit.`,
    },
    {
      key: 'pause',
      label: 'Emergency pause clear',
      pass: !paused,
      detail: paused ? 'The multi-official pause switch is on. All releases are blocked.' : 'Pause switch is off.',
    },
  ]
  return { rules, allPass: rules.every((r) => r.pass), daysToMaturity }
}

export function revertMessage(reason) {
  return `execution reverted: FDRLedger: ${reason}`
}

export const REVERT = {
  dual: revertMessage('dual signature required'),
  pause: revertMessage('contract paused by officials'),
  voice: revertMessage('high-value voice challenge incomplete'),
  key1: revertMessage('AI key missing or invalid'),
  key2: revertMessage('officer key missing or invalid'),
  rules: revertMessage('release rules not satisfied'),
}

export function voiceRequired(fdr, settings) {
  return Number(fdr?.amount || 0) >= Number(settings.highValueVoiceThreshold || 0)
}
