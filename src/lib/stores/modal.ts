import { create } from 'zustand'

interface ModalStore {
  expectingRoute: boolean
  isOpen: boolean
  isClosing: boolean
  title: string | null
  originPath: string | null
  keepAlive: boolean
  triggerRef: HTMLElement | null
  openModal: (title?: string, originPath?: string) => void
  setTriggerRef: (el: HTMLElement | null) => void
  routeExpected: () => void
  routeArrived: () => void
  startClosing: () => void
  close: () => void
  setKeepAlive: (value: boolean) => void
}

export const useModalStore = create<ModalStore>((set) => ({
  expectingRoute: false,
  isOpen: false,
  isClosing: false,
  title: null,
  originPath: null,
  keepAlive: false,
  triggerRef: null,
  openModal: (title, originPath) =>
    set((state) => ({
      expectingRoute: true,
      isOpen: true,
      isClosing: false,
      title: title ?? null,
      originPath: !state.isOpen ? (originPath ?? null) : state.originPath,
    })),
  setTriggerRef: (el) => set({ triggerRef: el }),
  routeExpected: () => set({ expectingRoute: true }),
  routeArrived: () => set({ expectingRoute: false }),
  startClosing: () => set({ isClosing: true }),
  close: () => set({
    isOpen: false,
    expectingRoute: false,
    isClosing: false,
    title: null,
    keepAlive: false,
    originPath: null,
    triggerRef: null,
  }),
  setKeepAlive: (value) => set({ keepAlive: value }),
}))
