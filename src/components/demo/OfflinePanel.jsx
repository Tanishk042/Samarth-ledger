import { AnimatePresence, motion } from 'framer-motion'
import { CloudOff, Loader2, RefreshCw, Server, Wifi, WifiOff, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useUi } from '../../store/useUi'
import { formatDateTime, formatINR } from '../../lib/utils'
import { Button, InlineNote, SimBadge } from '../ui/primitives'

export default function OfflinePanel() {
  const open = useUi((s) => s.offlineOpen)
  const setOpen = useUi((s) => s.setOfflineOpen)
  const offline = useStore((s) => s.offline)
  const setOffline = useStore((s) => s.setOffline)
  const queue = useStore((s) => s.offlineQueue)
  const replaying = useStore((s) => s.offlineReplaying)
  const syncOffline = useStore((s) => s.syncOffline)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[75] bg-ink/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-[76] flex w-full max-w-[420px] flex-col border-l border-line bg-surface shadow-lift"
            initial={{ x: 440 }}
            animate={{ x: 0 }}
            exit={{ x: 440 }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            aria-label="Offline queue"
          >
            <div className="flex items-start justify-between border-b border-line px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold">Offline queue</h2>
                  <SimBadge>Mesh relay</SimBadge>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  IndexedDB-backed local queue. Replays in order with an idempotency key so no duplicate FDR is created.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-muted hover:bg-ink/[0.05] hover:text-ink"
                aria-label="Close offline queue"
              >
                <X size={17} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="relative overflow-hidden rounded-3xl border border-line bg-paper/60 p-5">
                <MeshAnimation offline={offline} />
                <div className="relative mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Central server</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                      {offline ? <WifiOff size={14} className="text-danger" /> : <Wifi size={14} className="text-olive" />}
                      {offline ? 'Unreachable (simulated)' : 'Online'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={offline ? 'primary' : 'outline'}
                    onClick={() => setOffline(!offline)}
                    disabled={replaying}
                  >
                    {offline ? <RefreshCw size={13} /> : <CloudOff size={13} />}
                    {offline ? 'Restore & replay' : 'Simulate outage'}
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Pending submissions</p>
                <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-paper">{queue.length}</span>
              </div>

              <div className="mt-2 space-y-2">
                {queue.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold">{item.label}</p>
                      <p className="text-[10px] text-muted">
                        {formatINR(item.amount, { compact: true })} · queued {formatDateTime(item.at)}
                      </p>
                    </div>
                    <span className="chip border-amber-500/25 bg-amber-500/10 text-[9px] text-amber-700 dark:text-amber-300">
                      queued
                    </span>
                  </div>
                ))}
                {!queue.length && (
                  <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center">
                    <Server size={20} className="mx-auto text-muted/60" />
                    <p className="mt-2 text-xs font-semibold">Queue is empty</p>
                    <p className="mt-1 text-[11px] text-muted">
                      Toggle the outage and submit an FDR from the institution portal to see it here.
                    </p>
                  </div>
                )}
              </div>

              {replaying && (
                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-accent/20 bg-accent/[0.06] px-3 py-3 text-[11px] font-semibold text-accent">
                  <Loader2 size={14} className="animate-spin" /> Replaying in order and checking for duplicates…
                </div>
              )}

              <InlineNote className="mt-4" tone="accent">
                The mesh visual is illustrative. The queue, ordering, idempotency check and IndexedDB persistence are real
                browser behaviour.
              </InlineNote>
            </div>

            <div className="border-t border-line p-4">
              <Button className="w-full" variant={offline ? 'primary' : 'outline'} onClick={() => syncOffline()} disabled={offline || replaying || !queue.length}>
                {replaying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Replay queue now
              </Button>
              {offline && (
                <p className="mt-2 text-center text-[10px] text-muted">Restore the connection first to drain the queue.</p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function MeshAnimation({ offline }) {
  return (
    <svg viewBox="0 0 360 150" className="w-full" role="img" aria-label="Illustrative mesh relay between institution, local queue and AICTE">
      <defs>
        <radialGradient id="meshGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgb(255,103,27)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(255,103,27)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="180" cy="75" r="68" fill="url(#meshGlow)" />
      <path d="M60 75 L180 35 L300 75 L180 115 Z" fill="none" stroke="rgb(var(--line))" strokeDasharray="4 5" />
      <path d="M60 75 L300 75 M180 35 L180 115" fill="none" stroke="rgb(var(--line))" strokeDasharray="3 6" />
      {[
        [60, 75, 'College'],
        [300, 75, 'AICTE'],
        [180, 35, 'Queue'],
        [180, 115, 'Bank'],
      ].map(([x, y, label]) => (
        <g key={label}>
          <circle cx={x} cy={y} r="19" fill="rgb(var(--surface))" stroke="rgb(var(--line))" />
          <circle cx={x} cy={y} r="4" fill={offline && label === 'AICTE' ? 'rgb(var(--danger))' : 'rgb(var(--accent))'} />
          <text x={x} y={y + 32} textAnchor="middle" fontSize="8" fill="rgb(var(--muted))" fontFamily="Manrope">
            {label}
          </text>
        </g>
      ))}
      {offline && (
        <>
          <circle cx="180" cy="75" r="10" fill="rgb(var(--accent))">
            <animate attributeName="r" values="8;22;8" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0;0.7" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx="180" cy="75" r="8" fill="rgb(var(--accent))" />
        </>
      )}
      {!offline && (
        <circle cx="180" cy="75" r="8" fill="rgb(var(--olive))">
          <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      <text x="180" y="78" textAnchor="middle" fontSize="7" fill="white" fontWeight="700">
        {offline ? 'MESH' : 'OK'}
      </text>
    </svg>
  )
}
