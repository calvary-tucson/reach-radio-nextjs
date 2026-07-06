'use client'

import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 640

/**
 * iOS Safari anchors `position: fixed` elements to the layout viewport
 * instead of the visual viewport during the first compound viewport
 * transition on a page (address-bar collapse + keyboard rise animating
 * together on cold open). That desyncs full-screen fixed overlays/sheets
 * from what's actually visible on screen -- confirmed on-device: DOM
 * geometry (getBoundingClientRect) reports full coverage while the
 * rendered paint does not. A second focus (address bar already settled,
 * simple one-axis keyboard resize) renders correctly with no fix needed.
 * Tracking `visualViewport.offsetTop` and applying it as an inline `top`
 * keeps fixed layers glued to the visible screen through that transition.
 * Height is intentionally left to `h-[100dvh]` (full, unshrunk layout
 * viewport) so the sheet/overlay stay full-device-height with the keyboard
 * simply overlaying their lower portion, rather than the container
 * resizing down to just the space above the keyboard.
 * Returns null above the mobile breakpoint so desktop's auto-height
 * dialog layout is untouched.
 */
export function useVisualViewportOffset(): number | null {
  const [offsetTop, setOffsetTop] = useState<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function update() {
      setOffsetTop(vv!.width >= MOBILE_BREAKPOINT ? null : vv!.offsetTop)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return offsetTop
}
