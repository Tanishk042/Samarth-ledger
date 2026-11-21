import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useToast } from '../../store/useToast'
import { cn } from '../../lib/utils'

const TONES = {
  default: { icon: Info, cls: 'border-line bg-surface text-ink', iconCls: 'text-accent' },
  success: { icon: CheckCircle2, cls: 'border-olive/30 bg-surface text-ink', iconCls: 'text-olive' },
  warning: { icon: AlertTriangle, cls: 'border-amber-500/30 bg-surface text-ink', iconCls: 'text-amber-600' },
  danger: { icon: XCircle, cls: 'border-danger/30 bg-surface text-ink', iconCls: 'text-danger' },
}

export default function ToastViewport() {
  const toasts = useToast((s) => s.toasts)
  const dismiss = useToast((s) => s.dismiss)

  return (
    <div
      className="pointer-events-none fixed bottom-24 left-3 right-3 z-[95] flex flex-col items-center gap-2 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.slice(-4).map((t) => {
          const meta = TONES[t.tone] || TONES.default
          const Icon = meta.icon
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-2xl border px-4 py-3 shadow-lift',
                meta.cls,
              )}
              role="status"
            >
              <Icon size={17} className={cn('mt-0.5 shrink-0', meta.iconCls)} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-snug">{t.title || t.message}</p>
                {t.title && t.message && <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{t.message}</p>}
                {t.actionHref && (
                  <Link
                    to={t.actionHref}
                    onClick={() => dismiss(t.id)}
                    className="mt-1.5 inline-block text-[11px] font-bold uppercase tracking-[0.1em] text-accent underline-offset-2 hover:underline"
                  >
                    {t.actionLabel || 'Open'}
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded-full p-1 text-muted transition hover:bg-ink/[0.06] hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
