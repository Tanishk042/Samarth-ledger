import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownUp, Radio, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useUi } from '../../store/useUi'
import { formatDateTime, cn } from '../../lib/utils'
import { SimBadge } from '../ui/primitives'

const TOPIC_COLORS = {
  'fdr.': 'bg-olive',
  'reminder.': 'bg-amber-500',
  'renewal.': 'bg-accent',
  'release.': 'bg-ink',
  'proof.': 'bg-sky-500',
  'risk.': 'bg-danger',
  'sync.': 'bg-violet-500',
  'ledger.': 'bg-danger',
  'audit.': 'bg-muted',
}

const colorFor = (topic) => Object.entries(TOPIC_COLORS).find(([prefix]) => topic.startsWith(prefix))?.[1] || 'bg-muted'

export default function EventStreamPanel() {
  const open = useUi((s) => s.eventsOpen)
  const setOpen = useUi((s) => s.setEventsOpen)
  const events = useStore((s) => s.events)
  const [filter, setFilter] = useState('all')
  const listRef = useRef(null)
  const topics = useMemo(() => ['all', ...new Set(events.map((e) => e.topic.split('.')[0]))], [events])
  const filtered = filter === 'all' ? events : events.filter((e) => e.topic.startsWith(`${filter}.`))

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: 0 })
  }, [open])

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
            aria-label="Simulated event stream"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-olive opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-olive" />
                  </span>
                  <h2 className="text-sm font-bold">Event stream</h2>
                  <SimBadge>Kafka-style bus</SimBadge>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  Topics are published in-app by real workflow actions. No broker is connected in this prototype.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-muted hover:bg-ink/[0.05] hover:text-ink"
                aria-label="Close event stream"
              >
                <X size={17} />
              </button>
            </div>

            <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-4 py-2.5">
              {topics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setFilter(topic)}
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] transition',
                    filter === topic ? 'bg-ink text-paper' : 'bg-paper text-muted hover:text-ink',
                  )}
                >
                  {topic}
                </button>
              ))}
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto">
              {filtered.map((event, index) => (
                <div
                  key={event.id}
                  className={cn(
                    'flex gap-3 border-b border-line/60 px-5 py-3.5 transition hover:bg-paper/50',
                    index === 0 && 'animate-fade-up',
                  )}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', colorFor(event.topic))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[11px] font-semibold">{event.topic}</p>
                      {event.simulated && (
                        <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-muted">sim</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{event.payload}</p>
                    <p className="mt-1 font-mono text-[9px] text-muted/70">{formatDateTime(event.at)}</p>
                  </div>
                </div>
              ))}
              {!filtered.length && (
                <p className="px-5 py-12 text-center text-xs text-muted">No events on this topic yet.</p>
              )}
            </div>

            <div className="border-t border-line bg-paper/60 px-5 py-3">
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span className="flex items-center gap-1.5">
                  <Radio size={11} /> {events.length} retained events
                </span>
                <span className="flex items-center gap-1.5 font-mono">
                  <ArrowDownUp size={11} /> newest first
                </span>
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-muted/80">
                In production this maps to Kafka topics <span className="font-mono">fdr.*</span>,{' '}
                <span className="font-mono">reminder.*</span>, <span className="font-mono">release.*</span>. Delivery is
                simulated; ordering is the in-app array order.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
