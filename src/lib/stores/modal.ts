import { create } from 'zustand'

interface ModalStore {
  expectingRoute: boolean
  expectingBack: boolean
  isOpen: boolean
  isClosing: boolean
  title: string | null
  triggerRef: HTMLElement | null
  stackDepth: number
  openModal: (title?: string) => void
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
  openModal: (title) =>
    set({
      expectingRoute: true,
      expectingBack: false,
      isOpen: true,
      isClosing: false,
      title: title ?? null,
      stackDepth: 0,
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
    isOpen: false,
    expectingRoute: false,
    expectingBack: false,
    isClosing: false,
    title: null,
    triggerRef: null,
    stackDepth: 0,
  }),
}))
