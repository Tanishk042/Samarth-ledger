import { create } from 'zustand'

/** Ephemeral toast queue — intentionally not persisted. */
export const useToast = create((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`
    const item = { id, tone: 'default', duration: 4800, ...toast }
    set((s) => ({ toasts: [...s.toasts, item] }))
    if (item.duration > 0) {
      setTimeout(() => get().dismiss(id), item.duration)
    }
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

export const toast = (message, options = {}) => useToast.getState().push({ message, ...options })
