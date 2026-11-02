'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { usePathname, useRouter } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef } from 'react'
import { ModalProvider } from '@/components/modals/ModalContext'
import { useVisualViewportOffset } from '@/lib/hooks/useVisualViewportOffset'
import { SectionErrorBoundary } from '@/components/global/SectionErrorBoundary'
import { TeacherSearchSheetContent } from '@/components/teachers/TeacherSearchSheetContent'
import { EXIT_DURATION } from '@/lib/constants/modal'
import { useShallow } from 'zustand/react/shallow'
import { useModalStore } from '@/lib/stores/modal'
import { useHideMediaBarWhileOpen } from '@/lib/hooks/useHideMediaBarWhileOpen'
import { TeacherPanelShell } from '@/components/modals/chrome/TeacherPanelShell'
import { TeacherDetailSkeleton } from '@/components/skeletons/TeacherDetailSkeleton'

export default function ModalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const {
    isOpen,
    isClosing,
    title,
    stackDepth,
    rootSheet,
    close,
    startClosing,
    expectingRoute,
    expectingBack,
    routeArrived,
    clearBack,
  } = useModalStore(
    useShallow((s) => ({
      isOpen: s.isOpen,
      isClosing: s.isClosing,
      title: s.title,
      stackDepth: s.stackDepth,
      rootSheet: s.rootSheet,
      close: s.close,
      startClosing: s.startClosing,
      expectingRoute: s.expectingRoute,
      expectingBack: s.expectingBack,
      routeArrived: s.routeArrived,
      clearBack: s.clearBack,
    }))
  )
  const dismissGuardRef = useRef(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const overlayOffsetTop = useVisualViewportOffset()

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [])

  useHideMediaBarWhileOpen(isOpen)

  const pathname = usePathname()

  useEffect(() => {
    if (!isOpen) return
    if (expectingRoute) { routeArrived(); return }
    if (expectingBack) { clearBack(); return }
    if (isOpen && !isClosing) {
      close()
      dismissGuardRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Force-close: always dismisses the entire panel regardless of stack depth.
  // Pops all stacked history entries (depth + 1) in one go via window.history.go
  // so the user lands on the page they had before the modal was opened.
  const handleClose = useCallback(() => {
    if (dismissGuardRef.current) return
    dismissGuardRef.current = true
    startClosing()
    dismissTimer.current = setTimeout(() => {
      const state = useModalStore.getState()
      const triggerEl = state.triggerRef
      const depth = state.stackDepth
      state.close()
      window.history.go(-(depth + 1))
      dismissGuardRef.current = false
      triggerEl?.focus()
    }, EXIT_DURATION)
  }, [startClosing])

  // Back: pop one step in the stack, keep panel open showing the previous teacher.
  // prepareBack() signals the pathname effect to treat the upcoming pop as an
  // in-panel navigation (not a full close).
  const handleBack = useCallback(() => {
    const state = useModalStore.getState()
    state.prepareBack()
    router.back()
  }, [router])

  if (!isOpen) return null

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={
            isClosing
              ? 'fixed inset-x-0 top-0 h-[100dvh] z-[70] bg-black/80 [will-change:opacity] motion-safe:animate-[fade-out_0.15s_ease-in_forwards]'
              : 'fixed inset-x-0 top-0 h-[100dvh] z-[70] bg-black/80 [will-change:opacity] motion-safe:animate-[fade-in_0.2s_ease-out_both]'
          }
          style={overlayOffsetTop !== null ? { top: overlayOffsetTop } : undefined}
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[70] outline-none"
          onOpenAutoFocus={(e) => { e.preventDefault() }}
          // Radix's own restore-on-unmount never captured our real focus
          // target (we focus the sheet's input synchronously via flushSync,
          // before Radix's focusin listener attaches), so its default
          // behavior resets focus to <body> here, clobbering handleClose's
          // triggerEl.focus(). We own focus restoration ourselves.
          onCloseAutoFocus={(e) => { e.preventDefault() }}
          onEscapeKeyDown={(e) => {
            const active = document.activeElement as HTMLInputElement | null
            if (active?.tagName === 'INPUT' && active.value.length > 0) {
              e.preventDefault()
              return
            }
            handleClose()
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {title ?? 'Modal'}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Press Escape to close.
          </DialogPrimitive.Description>
          <ModalProvider
            onDismiss={handleClose}
            onBack={handleBack}
            isClosing={isClosing}
            stackDepth={stackDepth}
          >
            {rootSheet === 'search' && stackDepth === 0 ? (
              <SectionErrorBoundary
                fallback={(retry) => (
                  <div className="p-6 text-center space-y-3">
                    <p className="text-white/90 light:text-gray-700 text-sm">
                      Something went wrong. Please try again.
                    </p>
                    <button
                      type="button"
                      onClick={retry}
                      className="min-h-[44px] px-4 rounded-lg border border-white/10 light:border-gray-300 text-white/90 light:text-gray-700 text-sm cursor-pointer hover:bg-white/10 light:hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      Retry
                    </button>
                  </div>
                )}
              >
                <TeacherSearchSheetContent />
              </SectionErrorBoundary>
            ) : (
              <TeacherPanelShell>
                <Suspense fallback={<TeacherDetailSkeleton />}>{children}</Suspense>
              </TeacherPanelShell>
            )}
          </ModalProvider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
