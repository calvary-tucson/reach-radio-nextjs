'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react'
import {
  PANEL_NAV_TIMEOUT,
  PANEL_PAGE_DIM,
  PANEL_PAGE_DRIFT,
  PANEL_PAGE_DURATION,
  PANEL_PAGE_EASE,
} from '@/lib/constants/modal'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(cb: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mq = window.matchMedia(REDUCED_MOTION_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function getReducedMotion() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)
}

export type PanelNavDirection = 'push' | 'pop'

interface PanelContentStageProps {
  /** One-shot signal from the modal store: which way the nav just moved. */
  direction: PanelNavDirection | null
  reducedMotion: boolean
  /** Changes when the routed content swaps (the pathname). The animation runs on this change. */
  contentKey: string
  /** Called once the signal is consumed so the store can reset it. */
  onConsume: () => void
  /** Called when a signalled navigation has finished (or been skipped). */
  onSettled: () => void
  children: React.ReactNode
}

interface Pending {
  direction: PanelNavDirection
  ghost: HTMLElement
}

// Clone of the outgoing content. Made inert (no focus, no a11y tree), ids are
// stripped so the clone never duplicates anchors/labels, and the scroll
// position (which cloneNode drops) is copied across.
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
 * pages cannot replay it. The outgoing content is snapshotted into a DOM ghost
 * when the signal arrives (before the swap commits), then both layers animate.
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
  const animsRef = useRef<Animation[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(false)
  const committedKeyRef = useRef(contentKey)
  const settledRef = useRef(onSettled)
  const consumeRef = useRef(onConsume)
  useEffect(() => {
    settledRef.current = onSettled
    consumeRef.current = onConsume
  })

  // Tear down any in-flight animation/ghost immediately (used on a new signal,
  // on completion and on unmount).
  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    animsRef.current.forEach((a) => a.cancel())
    animsRef.current = []
    pendingRef.current?.ghost.remove()
    pendingRef.current = null
    viewportRef.current?.querySelectorAll('[data-panel-ghost]').forEach((g) => g.remove())
    if (liveRef.current) liveRef.current.style.zIndex = ''
  }, [])

  // Arm: the signal (store update on click) renders BEFORE the routed swap
  // commits, so the DOM still holds the outgoing content here. Snapshot it
  // now; it is attached and animated when the swap lands (effect below).
  // (useInsertionEffect is too late: React mutates descendants first.)
  useLayoutEffect(() => {
    if (!direction) return
    if (!mountedRef.current) {
      // Stale signal at mount (shell mounted by a push over the search
      // sheet): never animate.
      consumeRef.current()
      return
    }
    cleanup()
    const live = liveRef.current
    if (reducedMotion || !live || committedKeyRef.current !== contentKey) {
      // Swap already committed (or no motion): nothing to ghost.
      consumeRef.current()
      settledRef.current()
      return
    }
    const ghost = createGhost(live)
    ghost.dataset.scrollTop = String(live.scrollTop)
    pendingRef.current = { direction, ghost }
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
    if (!direction) return
    consumeRef.current()
    const pending = pendingRef.current
    const viewport = viewportRef.current
    const live = liveRef.current
    if (reducedMotion || !pending || !viewport || !live) {
      cleanup()
      settledRef.current()
      return
    }
    const { ghost } = pending
    viewport.appendChild(ghost)
    ghost.scrollTop = Number(ghost.dataset.scrollTop ?? 0)
    delete ghost.dataset.scrollTop

    const dim = `brightness(${PANEL_PAGE_DIM})`
    const opts: KeyframeAnimationOptions = {
      duration: PANEL_PAGE_DURATION,
      easing: PANEL_PAGE_EASE,
      fill: 'forwards',
    }
    const drift = `translateX(-${PANEL_PAGE_DRIFT}%)`
    let ghostAnim: Animation
    let liveAnim: Animation
    if (pending.direction === 'push') {
      // New content slides in over the old, which drifts left and dims.
      ghost.style.zIndex = '0'
      live.style.zIndex = '1'
      ghostAnim = ghost.animate(
        [{ transform: 'translateX(0)', filter: 'brightness(1)' }, { transform: drift, filter: dim }],
        opts,
      )
      liveAnim = live.animate(
        [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }],
        { ...opts, fill: 'none' },
      )
    } else {
      // Leaving content slides right; the revealed content drifts back in.
      ghost.style.zIndex = '2'
      ghostAnim = ghost.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }],
        opts,
      )
      liveAnim = live.animate(
        [{ transform: drift, filter: dim }, { transform: 'translateX(0)', filter: 'brightness(1)' }],
        { ...opts, fill: 'none' },
      )
    }
    animsRef.current = [ghostAnim, liveAnim]
    timerRef.current = setTimeout(() => {
      cleanup()
      settledRef.current()
    }, PANEL_PAGE_DURATION + PANEL_NAV_TIMEOUT)
    Promise.all([ghostAnim.finished, liveAnim.finished])
      .then(() => {
        if (pendingRef.current !== pending) return
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
