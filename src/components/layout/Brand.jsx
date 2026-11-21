import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

export function Mark({ size = 34, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="11" fill="currentColor" />
      <rect x="9" y="9" width="22" height="5.5" rx="2" fill="#F6F3F1" opacity="0.92" />
      <rect x="9" y="17.2" width="22" height="5.5" rx="2" fill="#F6F3F1" opacity="0.62" />
      <rect x="9" y="25.4" width="13" height="5.5" rx="2" fill="#FF671B" />
      <circle cx="28.4" cy="28.1" r="2.6" fill="#F6F3F1" />
      <rect x="27.2" y="29.4" width="2.4" height="4.2" rx="1.1" fill="#F6F3F1" />
    </svg>
  )
}

export default function Brand({ to = '/', className, compact = false, invert = false }) {
  return (
    <Link to={to} className={cn('group inline-flex items-center gap-2.5', className)} aria-label="Samarth Ledger home">
      <span className={cn('text-ink transition-transform duration-300 group-hover:-rotate-3', invert && 'text-paper')}>
        <Mark size={compact ? 30 : 34} />
      </span>
      <span className="leading-none">
        <span className={cn('block text-[17px] font-extrabold tracking-[-0.04em]', invert ? 'text-paper' : 'text-ink')}>
          Samarth
          <span className={cn('font-medium', invert ? 'text-paper/70' : 'text-muted')}> Ledger</span>
        </span>
        {!compact && (
          <span className={cn('mt-1 block text-[8.5px] font-bold uppercase tracking-[0.2em]', invert ? 'text-paper/50' : 'text-muted/80')}>
            AICTE deposit trust layer
          </span>
        )}
      </span>
    </Link>
  )
}
