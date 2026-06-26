'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef } from 'react'
import { ModalProvider } from '@/components/modals/ModalContext'
import { Skeleton } from '@/components/ui/skeleton'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
import { DragHandle } from '@/components/global/DragHandle'
import { EXIT_DURATION, MODAL_ENTER_ANIMATION, MODAL_EXIT_ANIMATION } from '@/lib/constants/modal'
import { useShallow } from 'zustand/react/shallow'
import { useModalStore } from '@/lib/stores/modal'
import { postMessageToNative } from '@/lib/bridge/post-message'
import { cn } from '@/lib/utils'

function ModalSkeleton({
  title,
  onDismiss,
  isClosing,
}: {
  title?: string | null
  onDismiss: () => void
  isClosing?: boolean
}) {
  const skeletonRef = useRef<HTMLDivElement>(null)
  const drag = useSheetDrag({ onDismiss, contentRef: skeletonRef })

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        ref={skeletonRef}
        className={cn(
          'w-full max-h-[90dvh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/10 light:border-gray-200 bg-gray-800 light:bg-white p-0 h-[85dvh] sm:h-auto sm:max-w-2xl sm:w-[95vw]',
          isClosing ? MODAL_EXIT_ANIMATION : MODAL_ENTER_ANIMATION
        )}
      >
        <DragHandle drag={drag} onDismiss={onDismiss} className="w-full pt-3 pb-2 sm:hidden" />
        <div className="flex items-center justify-between border-b border-white/10 light:border-gray-200 bg-gray-800 light:bg-white px-6 py-4">
          {title ? (
            <h2 className="text-xl font-bold text-white light:text-gray-900">{title}</h2>
          ) : (
            <Skeleton className="h-6 w-1/3" />
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 light:text-gray-500 transition-colors hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="w-full h-12 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export default function ModalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const {
    isOpen,
    isClosing,
    title,
    stackDepth,
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

  useEffect(() => {
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current) }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    postMessageToNative({ showMobileNav: false })
    return () => { postMessageToNative({ showMobileNav: true }) }
  }, [isOpen])

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
              ? 'fixed inset-0 z-[70] bg-black/80 [will-change:opacity] motion-safe:animate-[fade-out_0.15s_ease-in_forwards]'
              : 'fixed inset-0 z-[70] bg-black/80 [will-change:opacity] motion-safe:animate-[fade-in_0.2s_ease-out_both]'
          }
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[70] outline-none"
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
            <Suspense
              fallback={
                <ModalSkeleton title={title} onDismiss={handleClose} isClosing={isClosing} />
              }
            >
              {children}
            </Suspense>
          </ModalProvider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
