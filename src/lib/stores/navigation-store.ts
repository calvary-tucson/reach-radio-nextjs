import { create } from 'zustand'

const SHOW_DELAY_MS = 150

interface NavigationStore {
  navigating: boolean
  title: string | null
  start: (title?: string) => void
  reset: () => void
}

let delayTimer: ReturnType<typeof setTimeout> | null = null

export const useNavigationStore = create<NavigationStore>((set) => ({
  navigating: false,
  title: null,
  start: (title) => {
    if (delayTimer) clearTimeout(delayTimer)
    delayTimer = setTimeout(() => {
      delayTimer = null
      set({ navigating: true, title: title ?? null })
    }, SHOW_DELAY_MS)
  },
  reset: () => {
    if (delayTimer) {
      clearTimeout(delayTimer)
      delayTimer = null
    }
    set({ navigating: false, title: null })
  },
}))
