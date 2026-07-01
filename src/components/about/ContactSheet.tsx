'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ModalProvider } from '@/components/modals/ModalContext'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
import { ContactForm } from '@/components/about/ContactForm'
import { EXIT_DURATION } from '@/lib/constants/modal'
import { postMessageToNative } from '@/lib/bridge/post-message'

interface ContactSheetProps {
  open: boolean
  onClose: () => void
}

export function ContactSheet({ open, onClose }: ContactSheetProps) {
  const [mounted, setMounted] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement as HTMLElement
  }, [open])

  // Hide native bottom nav while sheet is open (matches @modal/layout.tsx behavior)
  useEffect(() => {
    if (!open) return
    postMessageToNative({ showMobileNav: false })
    return () => { postMessageToNative({ showMobileNav: true }) }
  }, [open])

  const handleDismiss = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setIsClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setIsClosing(false)
      onClose()
      triggerRef.current?.focus()
    }, EXIT_DURATION)
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleDismiss() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, handleDismiss])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open || !mounted) return null

  return createPortal(
    <div
      id="contact-sheet"
      data-testid="contact-sheet-backdrop"
      className={`fixed inset-0 z-[70] bg-black/80 [will-change:opacity] cursor-pointer ${
        isClosing
          ? 'motion-safe:animate-[fade-out_0.15s_ease-in_forwards]'
          : 'motion-safe:animate-[fade-in_0.2s_ease-out_both]'
      }`}
      onClick={handleDismiss}
    >
      <div role="dialog" aria-modal="true" aria-label="Contact Us" onClick={(e) => e.stopPropagation()}>
        <ModalProvider
          onDismiss={handleDismiss}
          onBack={handleDismiss}
          isClosing={isClosing}
          stackDepth={0}
        >
          <SheetChrome title="Contact Us" autoFocusInput>
            <ContactForm onSuccess={handleDismiss} />
          </SheetChrome>
        </ModalProvider>
      </div>
    </div>,
    document.body
  )
}
