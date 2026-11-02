import { create } from 'zustand'

interface ModalStore {
  expectingRoute: boolean
  expectingBack: boolean
  isOpen: boolean
  isClosing: boolean
  title: string | null
  triggerRef: HTMLElement | null
  stackDepth: number
  // What's rendered at stackDepth 0 -- fixed for the whole stack's lifetime
  // (pushModal/prepareBack never touch it), so a detail sheet pushed on top
  // of the search sheet still resolves back to the search sheet when popped.
  rootSheet: 'search' | 'detail' | null
  // One-shot signal for the panel content stage: which way the in-panel
  // navigation just moved. Set by pushModal/prepareBack, consumed (cleared)
  // by the stage once the animation is started.
  navDirection: 'push' | 'pop' | null
  clearNavDirection: () => void
  openModal: (title?: string) => void
  openSearchSheet: (title?: string) => void
  pushModal: (title?: string) => void
  setTriggerRef: (el: HTMLElement | null) => void
  routeArrived: () => void
  startClosing: () => void
  prepareBack: () => void
  clearBack: () => void
  close: () => void
}

export const useModalStore = create<ModalStore>((set) => ({
  expectingRoute: false,
  expectingBack: false,
  isOpen: false,
  isClosing: false,
  title: null,
  triggerRef: null,
  stackDepth: 0,
  rootSheet: null,
  navDirection: null,
  clearNavDirection: () => set({ navDirection: null }),
  openModal: (title) =>
    set({
      navDirection: null,
      expectingRoute: true,
      expectingBack: false,
      isOpen: true,
      isClosing: false,
      title: title ?? null,
      stackDepth: 0,
      rootSheet: 'detail',
    }),
  openSearchSheet: (title) =>
    set({
      navDirection: null,
      expectingRoute: true,
      expectingBack: false,
      isOpen: true,
      isClosing: false,
      title: title ?? null,
      stackDepth: 0,
      rootSheet: 'search',
    }),
  pushModal: (title) =>
    set((state) => ({
      navDirection: 'push' as const,
      expectingRoute: true,
      expectingBack: false,
      isOpen: true,
      isClosing: false,
      title: title ?? null,
      stackDepth: state.stackDepth + 1,
    })),
  setTriggerRef: (el) => set({ triggerRef: el }),
  routeArrived: () => set({ expectingRoute: false }),
  startClosing: () => set({ isClosing: true }),
  prepareBack: () =>
    set((state) => ({
      navDirection: 'pop' as const,
      isClosing: false,
      expectingBack: true,
      expectingRoute: false,
      stackDepth: Math.max(0, state.stackDepth - 1),
    })),
  clearBack: () => set({ expectingBack: false }),
  close: () => set({
    navDirection: null,
    isOpen: false,
    expectingRoute: false,
    expectingBack: false,
    isClosing: false,
    title: null,
    triggerRef: null,
    stackDepth: 0,
    rootSheet: null,
  }),
}))
