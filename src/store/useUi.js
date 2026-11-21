import { create } from 'zustand'

/** Ephemeral demo UI state. Not persisted. */
export const useUi = create((set) => ({
  guidedOpen: false,
  guidedStep: 0,
  eventsOpen: false,
  offlineOpen: false,
  openGuided: (step = 0) => set({ guidedOpen: true, guidedStep: step, eventsOpen: false, offlineOpen: false }),
  closeGuided: () => set({ guidedOpen: false }),
  setGuidedStep: (step) => set({ guidedStep: Math.max(0, step) }),
  toggleEvents: () => set((s) => ({ eventsOpen: !s.eventsOpen, offlineOpen: false })),
  setEventsOpen: (open) => set({ eventsOpen: open }),
  toggleOfflinePanel: () => set((s) => ({ offlineOpen: !s.offlineOpen, eventsOpen: false })),
  setOfflineOpen: (open) => set({ offlineOpen: open }),
  closeAll: () => set({ guidedOpen: false, eventsOpen: false, offlineOpen: false }),
}))
