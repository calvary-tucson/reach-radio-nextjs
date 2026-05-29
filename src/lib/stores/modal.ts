import { create } from 'zustand'

interface ModalStore {
  expectingRoute: boolean
  isOpen: boolean
  isClosing: boolean
  title: string | null
  triggerRef: HTMLElement | null
  openModal: (title?: string) => void
  setTriggerRef: (el: HTMLElement | null) => void
  routeArrived: () => void
  startClosing: () => void
  close: () => void
}

export const useModalStore = create<ModalStore>((set) => ({
  expectingRoute: false,
  isOpen: false,
  isClosing: false,
  title: null,
  triggerRef: null,
  openModal: (title) =>
    set({
      expectingRoute: true,
      isOpen: true,
      isClosing: false,
      title: title ?? null,
    }),
  setTriggerRef: (el) => set({ triggerRef: el }),
  routeArrived: () => set({ expectingRoute: false }),
  startClosing: () => set({ isClosing: true }),
  close: () => set({
    isOpen: false,
    expectingRoute: false,
    isClosing: false,
    title: null,
    triggerRef: null,
  }),
}))
