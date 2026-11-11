'use client'

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import {
  PANEL_NAV_TIMEOUT,
  PANEL_PAGE_DIM,
  PANEL_PAGE_DRIFT,
  PANEL_PAGE_DURATION,
  PANEL_PAGE_EASE,
} from '@/lib/constants/modal'

export type PanelNavDirection = 'push' | 'pop'

interface PanelContentStageProps {
  /** One-shot signal from the modal store: which way the nav just moved. */
  direction: PanelNavDirection | null
  reducedMotion: boolean
  /** Changes when the routed content swaps (the pathname). The animation runs on this change. */
  contentKey: string
  /** Called as soon as a signal is armed so the store resets it (a repeat signal must re-fire). */
  onConsume: () => void
  /** Called when a signalled navigation has finished, been skipped, or never got a route. */
  onSettled: () => void
  children: React.ReactNode
}

interface Pending {
  direction: PanelNavDirection
  /** Clone of the outgoing content; null when the swap committed with the signal (live-only motion). */
  ghost: HTMLElement | null
  /** Outgoing scroll offset, applied to the ghost. */
  scrollTop: number
}

// Clone of the outgoing content. Made inert (no focus, no a11y tree) and ids
// are stripped so the clone never duplicates anchors/labels. The scroll
// position (which cloneNode drops) is re-applied by the caller.
function createGhost(live: HTMLElement): HTMLElement {
  const ghost = live.cloneNode(true) as HTMLElement
  ghost.removeAttribute('id')
  ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
  ghost.setAttribute('inert', '')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.setAttribute('data-panel-ghost', '')
  ghost.removeAttribute('data-panel-content')
  // The live layer is in flow (it sizes the mobile sheet to its content); the
  // ghost overlays it exactly.
  ghost.style.position = 'absolute'
  ghost.style.inset = '0'
  ghost.style.zIndex = '2'
  ghost.style.pointerEvents = 'none'
  return ghost
}

/**
 * Viewport for the routed teacher content. Push/pop is a one-shot Web
 * Animations API run (never CSS classes), so Next hiding or un-hiding cached
 * pages cannot replay it. The signal is armed when it arrives (the outgoing
 * content is still on screen, so it is snapshotted into a DOM ghost) and the
 * animation runs when the routed swap commits. If no swap arrives the armed
 * state is dropped after PANEL_NAV_TIMEOUT.
 */
export function PanelContentStage({
  direction,
  reducedMotion,
  contentKey,
  onConsume,
  onSettled,
  children,
}: PanelContentStageProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<Pending | null>(null)
  const activeRef = useRef<Pending | null>(null)
  const animsRef = useRef<Animation[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollsRef = useRef(new Map<string, number>())
  const mountedRef = useRef(false)
  const committedKeyRef = useRef(contentKey)
  const settledRef = useRef(onSettled)
  const consumeRef = useRef(onConsume)
  useEffect(() => {
    settledRef.current = onSettled
    consumeRef.current = onConsume
  })

  // Tear down any armed state / in-flight animation / ghost immediately.
  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    animsRef.current.forEach((a) => a.cancel())
    animsRef.current = []
    pendingRef.current = null
    activeRef.current = null
    viewportRef.current?.querySelectorAll('[data-panel-ghost]').forEach((g) => g.remove())
    if (liveRef.current) liveRef.current.style.zIndex = ''
  }, [])

  // Arm: the signal (store update on click) normally renders BEFORE the routed
  // swap commits, so the DOM still holds the outgoing content. Snapshot it now
  // and consume the signal so a repeat of the same direction fires again.
  // (useInsertionEffect is too late: React mutates descendants first.)
  useLayoutEffect(() => {
    if (!direction) return
    consumeRef.current()
    if (!mountedRef.current) return // stale signal at mount: never animate
    cleanup()
    const live = liveRef.current
    if (!live) return
    const swapped = committedKeyRef.current !== contentKey
    if (!swapped) scrollsRef.current.set(committedKeyRef.current, live.scrollTop)
    pendingRef.current = {
      direction,
      // Signal and swap in one commit: the old DOM is gone, so live-only motion.
      ghost: swapped || reducedMotion ? null : createGhost(live),
      scrollTop: live.scrollTop,
    }
    // No route arrived: drop the armed state and release the Back lock.
    timerRef.current = setTimeout(() => {
      cleanup()
      settledRef.current()
    }, PANEL_NAV_TIMEOUT)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction])

  // Run: the routed content just swapped.
  useLayoutEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      committedKeyRef.current = contentKey
      return
    }
    if (committedKeyRef.current === contentKey) return
    committedKeyRef.current = contentKey
    const pending = pendingRef.current
    const viewport = viewportRef.current
    const live = liveRef.current
    if (!live) return
    // The live layer's scroll belongs to the old page: push starts at the top,
    // pop restores the revealed page's own offset (0 if unknown).
    live.scrollTop = pending?.direction === 'pop' ? (scrollsRef.current.get(contentKey) ?? 0) : 0
    if (!pending) return
    if (reducedMotion || !viewport) {
      cleanup()
      settledRef.current()
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    pendingRef.current = null
    activeRef.current = pending

    const { ghost } = pending
    if (ghost) {
      viewport.appendChild(ghost)
      ghost.scrollTop = pending.scrollTop
    }

    const dim = `brightness(${PANEL_PAGE_DIM})`
    const opts: KeyframeAnimationOptions = {
      duration: PANEL_PAGE_DURATION,
      easing: PANEL_PAGE_EASE,
      fill: 'forwards',
    }
    const drift = `translateX(-${PANEL_PAGE_DRIFT}%)`
    const anims: Animation[] = []
    if (pending.direction === 'push') {
      // New content slides in over the old, which drifts left and dims.
      if (ghost) {
        ghost.style.zIndex = '0'
        anims.push(
          ghost.animate(
            [{ transform: 'translateX(0)', filter: 'brightness(1)' }, { transform: drift, filter: dim }],
            opts,
          ),
        )
      }
      live.style.zIndex = '1'
      anims.push(
        live.animate(
          [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }],
          { ...opts, fill: 'none' },
        ),
      )
    } else {
      // Leaving content slides right; the revealed content drifts back in.
      if (ghost) {
        ghost.style.zIndex = '2'
        anims.push(
          ghost.animate(
            [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }],
            opts,
          ),
        )
      }
      anims.push(
        live.animate(
          [{ transform: drift, filter: dim }, { transform: 'translateX(0)', filter: 'brightness(1)' }],
          { ...opts, fill: 'none' },
        ),
      )
    }
    animsRef.current = anims
    timerRef.current = setTimeout(() => {
      cleanup()
      settledRef.current()
    }, PANEL_PAGE_DURATION + PANEL_NAV_TIMEOUT)
    Promise.all(anims.map((a) => a.finished))
      .then(() => {
        if (activeRef.current !== pending) return
        cleanup()
        settledRef.current()
      })
      .catch(() => {
        // cancelled by a newer signal or unmount: its owner handles cleanup
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey])

  useEffect(() => cleanup, [cleanup])

  return (
    <div ref={viewportRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={liveRef}
        data-panel-content
        className="relative min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0 bg-[#0f1a0a] light:bg-white"
      >
        {children}
      </div>
    </div>
  )
}
