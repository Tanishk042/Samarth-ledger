import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

const BAND = {
  high: { label: 'High confidence', tone: 'text-olive', stroke: 'rgb(var(--olive))' },
  medium: { label: 'Officer review', tone: 'text-amber-600 dark:text-amber-300', stroke: 'rgb(217 119 6)' },
  low: { label: 'Low confidence', tone: 'text-danger', stroke: 'rgb(var(--danger))' },
}

/**
 * Trust dial. 98+ is the auto-accept band, 60–97 asks a human, below 60 is a
 * low-confidence result. The band is always rendered, never just a number.
 */
export default function ScoreDial({ score = 0, band, size = 128, label = 'Trust score', className, dense = false }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0))
  const resolvedBand = band || (value >= 98 ? 'high' : value >= 60 ? 'medium' : 'low')
  const meta = BAND[resolvedBand] || BAND.medium
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 104 104" className="-rotate-90" width={size} height={size} aria-hidden>
          <circle cx="52" cy="52" r={radius} fill="none" stroke="rgb(var(--line))" strokeWidth="7" opacity="0.6" />
          <motion.circle
            cx="52"
            cy="52"
            r={radius}
            fill="none"
            stroke={meta.stroke}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Trust</span>
          <span className="text-2xl font-semibold tracking-[-0.05em]" style={{ fontSize: size * 0.22 }}>
            {value}
          </span>
          <span className="text-[9px] font-semibold text-muted">of 100</span>
        </div>
      </div>
      {!dense && (
        <div className="mt-2 text-center">
          <p className={cn('text-[11px] font-bold uppercase tracking-[0.1em]', meta.tone)}>{meta.label}</p>
          <p className="mt-0.5 text-[10px] text-muted">{label}</p>
        </div>
      )}
    </div>
  )
}
