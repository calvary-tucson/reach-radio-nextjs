'use client'

import { createContext, useContext } from 'react'

interface ModalContextValue {
  onDismiss: () => void
  onBack: () => void
  isClosing: boolean
}

export const ModalContext = createContext<ModalContextValue | null>(null)

export function ModalProvider({
  children,
  onDismiss,
  onBack,
  isClosing,
}: ModalContextValue & { children: React.ReactNode }) {
  return (
    <ModalContext value={{ onDismiss, onBack, isClosing }}>
      {children}
    </ModalContext>
  )
}

export function useModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within ModalProvider')
  return ctx
}
