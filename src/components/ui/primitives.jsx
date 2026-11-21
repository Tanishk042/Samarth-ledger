import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { STATUS, TONE_CLASSES } from '../../lib/constants'

/* ── Buttons ──────────────────────────────────────────────────────────────── */

export function Button({ variant = 'primary', size, className, type = 'button', children, ...props }) {
  const variants = {
    primary: 'btn-primary',
    ink: 'btn-ink',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  }
  return (
    <button
      type={type}
      className={cn(variants[variant] || variants.primary, size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', className)}
      {...props}
    >
      {children}
    </button>
  )
}

/* ── Surfaces ─────────────────────────────────────────────────────────────── */

export function Card({ className, children, as: Tag = 'div', ...props }) {
  return (
    <Tag className={cn('card', className)} {...props}>
      {children}
    </Tag>
  )
}

export function Badge({ tone = 'sand', className, children }) {
  return <span className={cn('chip', TONE_CLASSES[tone] || TONE_CLASSES.sand, className)}>{children}</span>
}

export function SimBadge({ children = 'Simulated', className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-dashed border-muted/40 bg-paper/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted',
        className,
      )}
      title="This behaviour is simulated in the prototype."
    >
      <span className="h-1 w-1 rounded-full bg-muted" aria-hidden />
      {children}
    </span>
  )
}

export function StatusPill({ status, className }) {
  const meta = STATUS[status] || { label: status, tone: 'sand' }
  return (
    <span className={cn('chip gap-1.5', TONE_CLASSES[meta.tone], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {meta.label}
    </span>
  )
}

export function Eyebrow({ children, className }) {
  return <p className={cn('eyebrow', className)}>{children}</p>
}

export function SectionHead({ eyebrow, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h2 className="display text-3xl sm:text-4xl lg:text-[44px]">{title}</h2>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ── Form bits ────────────────────────────────────────────────────────────── */

export function Field({ label, hint, required, error, children, className }) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="label flex items-center gap-1">
          {label}
          {required && <span className="text-accent">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1.5 block text-[11px] leading-relaxed text-muted">{hint}</span>}
      {error && <span className="mt-1.5 block text-[11px] font-semibold text-danger">{error}</span>}
    </label>
  )
}

export function Input({ className, ...props }) {
  return <input className={cn('input', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn('input appearance-none pr-9', className)} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn('input min-h-[92px] resize-y', className)} {...props} />
}

/* ── Progress / stats ─────────────────────────────────────────────────────── */

export function Progress({ value, tone = 'accent', className, label }) {
  const colors = {
    accent: 'bg-accent',
    olive: 'bg-olive',
    danger: 'bg-danger',
    ink: 'bg-ink',
  }
  return (
    <div className={className}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-line/70"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <motion.div
          className={cn('h-full rounded-full', colors[tone])}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}

export function SkeletonCard() {
  return (
    <Card className="p-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-5 h-8 w-40" />
      <Skeleton className="mt-6 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-2/3" />
    </Card>
  )
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface/50 px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Icon size={22} />
        </div>
      )}
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Stat({ label, value, hint, icon: Icon, tone = 'default', className, sub }) {
  const tones = {
    default: 'text-ink',
    accent: 'text-accent',
    danger: 'text-danger',
    olive: 'text-olive',
  }
  return (
    <Card className={cn('relative overflow-hidden p-5 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-muted">{label}</p>
        {Icon && (
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-paper text-muted">
            <Icon size={15} />
          </span>
        )}
      </div>
      <p className={cn('stat-value mt-4', tones[tone])}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      {hint && <p className="mt-3 text-[11px] leading-relaxed text-muted">{hint}</p>}
    </Card>
  )
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

export function Tabs({ items, value, onChange, className }) {
  return (
    <div className={cn('no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1', className)} role="tablist">
      {items.map((item) => {
        const active = value === item.value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition',
              active ? 'text-paper' : 'text-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-${items.map((i) => i.value).join('-')}`}
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {item.icon && <item.icon size={13} />}
              {item.label}
              {item.count != null && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', active ? 'bg-white/20' : 'bg-ink/[0.06]')}>
                  {item.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ── Toggle ───────────────────────────────────────────────────────────────── */

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors',
          checked ? 'border-accent bg-accent' : 'border-line bg-line/60',
          disabled && 'opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}

/* ── Modal ────────────────────────────────────────────────────────────────── */

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    setTimeout(() => ref.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [open, onClose])

  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose?.()
          }}
        >
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              'relative w-full rounded-t-3xl border border-line bg-surface shadow-lift outline-none sm:rounded-3xl',
              sizes[size],
              className,
            )}
            initial={{ y: 24, opacity: 0, scale: 0.99 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-base font-semibold">{title}</h3>
                {description && <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-muted transition hover:bg-ink/[0.06] hover:text-ink"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ── Misc ─────────────────────────────────────────────────────────────────── */

export function Dot({ tone = 'olive', pulse }) {
  const colors = { olive: 'bg-olive', accent: 'bg-accent', danger: 'bg-danger', muted: 'bg-muted', sand: 'bg-sand' }
  return (
    <span className="relative flex h-2 w-2">
      {pulse && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', colors[tone])} />}
      <span className={cn('relative h-2 w-2 rounded-full', colors[tone])} />
    </span>
  )
}

export function InlineNote({ tone = 'sand', icon: Icon, children, className }) {
  const tones = {
    sand: 'border-line bg-paper/70 text-muted',
    accent: 'border-accent/20 bg-accent/[0.06] text-ink',
    danger: 'border-danger/25 bg-danger/[0.06] text-danger',
    olive: 'border-olive/25 bg-olive/[0.06] text-ink',
  }
  return (
    <div className={cn('flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-[11px] leading-relaxed', tones[tone], className)}>
      {Icon && <Icon size={14} className="mt-0.5 shrink-0" />}
      <div>{children}</div>
    </div>
  )
}
