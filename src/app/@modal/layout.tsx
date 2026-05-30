'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef } from 'react'
import { ModalProvider } from '@/components/modals/ModalContext'
import { Skeleton } from '@/components/ui/skeleton'
import { EXIT_DURATION, MODAL_ENTER_ANIMATION, MODAL_EXIT_ANIMATION } from '@/lib/constants/modal'
import { useModalStore } from '@/lib/stores/modal'
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
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        className={cn(
          'w-full max-h-[90dvh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/10 light:border-gray-200 bg-gray-800 light:bg-white p-0 h-[85dvh] sm:h-auto sm:max-w-2xl sm:w-[95vw]',
          isClosing ? MODAL_EXIT_ANIMATION : MODAL_ENTER_ANIMATION
        )}
      >
        <div className="flex justify-center pt-3 pb-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-white/30 light:bg-gray-300" />
        </div>
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
  const isOpen = useModalStore((s) => s.isOpen)
  const isClosing = useModalStore((s) => s.isClosing)
  const title = useModalStore((s) => s.title)
  const close = useModalStore((s) => s.close)
  const startClosing = useModalStore((s) => s.startClosing)
  const expectingRoute = useModalStore((s) => s.expectingRoute)
  const expectingBack = useModalStore((s) => s.expectingBack)
  const routeArrived = useModalStore((s) => s.routeArrived)
  const clearBack = useModalStore((s) => s.clearBack)
  const dismissGuardRef = useRef(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current) }
  }, [])

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

  const handleDismiss = useCallback(() => {
    if (dismissGuardRef.current) return
    dismissGuardRef.current = true
    startClosing()
    dismissTimer.current = setTimeout(() => {
      const state = useModalStore.getState()
      const triggerEl = state.triggerRef
      if (state.stackDepth > 0) {
        // Stacked modal — back to parent sheet without fully closing
        state.prepareBack()
        router.back()
      } else {
        state.close()
        router.back()
      }
      dismissGuardRef.current = false
      triggerEl?.focus()
    }, EXIT_DURATION)
  }, [startClosing, router])

  const handleBack = useCallback(() => { router.back() }, [router])

  if (!isOpen) return null

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) handleDismiss() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={
            isClosing
              ? 'fixed inset-0 z-50 bg-black/80 motion-safe:animate-[fade-out_0.15s_ease-in_forwards]'
              : 'fixed inset-0 z-50 bg-black/80 motion-safe:animate-[fade-in_0.2s_ease-out_both]'
          }
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 outline-none"
          onEscapeKeyDown={(e) => {
            const active = document.activeElement as HTMLInputElement | null
            if (active?.tagName === 'INPUT' && active.value.length > 0) {
              e.preventDefault()
              return
            }
            handleDismiss()
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {title ?? 'Modal'}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Press Escape to close.
          </DialogPrimitive.Description>
          <ModalProvider onDismiss={handleDismiss} onBack={handleBack} isClosing={isClosing}>
            <Suspense
              fallback={
                <ModalSkeleton title={title} onDismiss={handleDismiss} isClosing={isClosing} />
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
