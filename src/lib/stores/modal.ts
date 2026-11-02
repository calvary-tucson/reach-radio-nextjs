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
  // True once the teacher panel has played its enter animation. The panel chrome
  // remounts on every teacher swap (it lives in the per-slug page), so it reads
  // this at mount to skip replaying the slide-in. Reset on open/close.
  panelEntered: boolean
  markPanelEntered: () => void
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
  panelEntered: false,
  markPanelEntered: () => set({ panelEntered: true }),
  openModal: (title) =>
    set({
      panelEntered: false,
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
      panelEntered: false,
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
      isClosing: false,
      expectingBack: true,
      expectingRoute: false,
      stackDepth: Math.max(0, state.stackDepth - 1),
    })),
  clearBack: () => set({ expectingBack: false }),
  close: () => set({
    panelEntered: false,
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
