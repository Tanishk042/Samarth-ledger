import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarClock,
  ChevronUp,
  Clock,
  Loader2,
  PlayCircle,
  Radio,
  RotateCcw,
  Skull,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useUi } from '../../store/useUi'
import { formatDate, isoDate } from '../../lib/utils'
import { Button, InlineNote, Modal, SimBadge } from '../ui/primitives'
import { useToast } from '../../store/useToast'

export default function DemoToolbar() {
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)
  const [slider, setSlider] = useState(0)
  const clockOffsetDays = useStore((s) => s.clockOffsetDays)
  const advanceClock = useStore((s) => s.advanceClock)
  const setClockOffset = useStore((s) => s.setClockOffset)
  const offline = useStore((s) => s.offline)
  const setOffline = useStore((s) => s.setOffline)
  const queue = useStore((s) => s.offlineQueue)
  const tamperDemo = useStore((s) => s.tamperDemo)
  const resetDemo = useStore((s) => s.resetDemo)
  const openGuided = useUi((s) => s.openGuided)
  const toggleEvents = useUi((s) => s.toggleEvents)
  const toggleOfflinePanel = useUi((s) => s.toggleOfflinePanel)
  const push = useToast((s) => s.push)
  const navigate = useNavigate()

  useEffect(() => setSlider(clockOffsetDays), [clockOffsetDays])

  const effective = new Date(Date.now() + clockOffsetDays * 86400000)

  const onAdvance = async (days) => {
    setBusy(true)
    await advanceClock(days)
    setBusy(false)
  }

  const onTamper = () => {
    const id = tamperDemo()
    if (id) navigate(`/explorer?tampered=${id}`)
  }

  const applySlider = async () => {
    if (slider === clockOffsetDays) {
      push('The scenario clock is already at that point.')
      return
    }
    setBusy(true)
    await setClockOffset(slider)
    setBusy(false)
    push(`Scenario date set to ${formatDate(new Date(Date.now() + slider * 86400000))}`, { tone: 'success' })
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <motion.div
          layout
          className="pointer-events-auto w-full max-w-[760px] overflow-hidden rounded-3xl border border-line bg-surface/95 shadow-lift backdrop-blur-xl"
        >
          <div className="flex items-center gap-1.5 px-2.5 py-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-2 py-1.5 text-left transition hover:bg-ink/[0.035]"
              aria-expanded={open}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                <Clock size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[12px] font-bold">{formatDate(effective)}</span>
                  {clockOffsetDays !== 0 && (
                    <span className="rounded-full bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-accent">
                      +{clockOffsetDays}d
                    </span>
                  )}
                </span>
                <span className="block truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Demo controls · simulated time
                </span>
              </span>
              <ChevronUp size={15} className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
            </button>

            <div className="hidden items-center gap-0.5 sm:flex">
              <IconAction label="Tamper with a record" onClick={onTamper} icon={Skull} />
              <IconAction
                label={offline ? 'Restore connection' : 'Simulate outage'}
                onClick={() => setOffline(!offline)}
                icon={offline ? WifiOff : Wifi}
                active={offline}
                tone={offline ? 'danger' : 'default'}
              />
              <button
                type="button"
                onClick={toggleEvents}
                className="relative rounded-xl p-2 text-muted transition hover:bg-ink/[0.05] hover:text-ink"
                aria-label="Open event stream"
                title="Event stream"
              >
                <Radio size={16} />
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="rounded-xl p-2 text-muted transition hover:bg-ink/[0.05] hover:text-ink"
                aria-label="Reset demo data"
                title="Reset demo data"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => openGuided()}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-paper transition hover:opacity-90"
            >
              <PlayCircle size={13} />
              <span className="hidden sm:inline">Guided demo</span>
              <span className="sm:hidden">Guide</span>
            </button>
          </div>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-t border-line"
              >
                <div className="max-h-[65vh] overflow-y-auto p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Time machine</p>
                      <p className="mt-1 text-sm font-semibold">
                        Scenario date · <span className="font-mono">{isoDate(effective)}</span>
                      </p>
                    </div>
                    <SimBadge>Clock</SimBadge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[7, 30, 60, 90].map((d) => (
                      <button
                        key={d}
                        type="button"
                        disabled={busy}
                        onClick={() => onAdvance(d)}
                        className="btn-outline btn-sm"
                      >
                        +{d} days
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        await setClockOffset(0)
                        setBusy(false)
                        push('Scenario clock reset to today.', { tone: 'success' })
                      }}
                      className="btn-ghost btn-sm"
                    >
                      Reset clock
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-line bg-paper/60 p-3">
                    <div className="flex items-center justify-between">
                      <label htmlFor="time-slider" className="text-[11px] font-semibold text-muted">
                        Move forward up to a year
                      </label>
                      <span className="font-mono text-[11px] font-bold text-accent">+{slider}d</span>
                    </div>
                    <input
                      id="time-slider"
                      type="range"
                      min="0"
                      max="365"
                      step="1"
                      value={slider}
                      onChange={(e) => setSlider(Number(e.target.value))}
                      className="mt-2 w-full accent-[rgb(var(--accent))]"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[10px] text-muted">
                        {formatDate(new Date(Date.now() + slider * 86400000))}
                      </p>
                      <Button size="sm" variant="outline" onClick={applySlider} disabled={busy}>
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />}
                        Apply date
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setOffline(!offline)}
                      className="flex items-center gap-3 rounded-2xl border border-line p-3 text-left transition hover:bg-ink/[0.03]"
                    >
                      <span className={`grid h-9 w-9 place-items-center rounded-xl ${offline ? 'bg-danger/10 text-danger' : 'bg-olive/10 text-olive'}`}>
                        {offline ? <WifiOff size={16} /> : <Wifi size={16} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold">
                          {offline ? 'Central server outage' : 'Central server online'}
                        </span>
                        <span className="block text-[10px] text-muted">
                          {offline ? `${queue.length} queued locally` : 'Toggle to simulate an outage'}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={toggleOfflinePanel}
                      className="flex items-center gap-3 rounded-2xl border border-line p-3 text-left transition hover:bg-ink/[0.03]"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent">
                        <Radio size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold">Offline queue · mesh</span>
                        <span className="block text-[10px] text-muted">
                          {queue.length ? `${queue.length} submission(s) pending` : 'No pending submissions'}
                        </span>
                      </span>
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={onTamper}>
                      <Skull size={13} /> Tamper with a record
                    </Button>
                    <Button size="sm" variant="outline" onClick={toggleEvents}>
                      <Radio size={13} /> Event stream
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
                      <RotateCcw size={13} /> Reset demo data
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openGuided(0)}>
                      <PlayCircle size={13} /> Restart the story
                    </Button>
                  </div>

                  <InlineNote className="mt-3">
                    These controls change <strong>local demo state only</strong>. The time machine triggers real in-app reminder
                    logic, the outage uses a real IndexedDB queue, and tampering edits an off-chain record to demonstrate the
                    fingerprint mismatch.
                  </InlineNote>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        description="All local changes, proofs, ledger blocks and the offline queue are replaced with the seeded 40-FDR scenario."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                setConfirmReset(false)
                setBusy(true)
                await resetDemo()
                setBusy(false)
                setOpen(false)
              }}
              disabled={busy}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Reset everything
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          This is safe: the prototype has no production data. A fresh seeded ledger is rebuilt with new sample document
          hashes and bank proofs.
        </p>
      </Modal>
    </>
  )
}

function IconAction({ label, onClick, icon: Icon, active, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl p-2 transition ${
        active || tone === 'danger' ? 'bg-danger/10 text-danger' : 'text-muted hover:bg-ink/[0.05] hover:text-ink'
      }`}
      aria-label={label}
      title={label}
    >
      <Icon size={16} />
    </button>
  )
}
