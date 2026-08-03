'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'
import { isTeacherDetailPath } from '@/lib/routes'

// Hides the on-page media bar (and native bottom nav) for the lifetime of a
// standalone sheet, mirroring @modal/layout.tsx's isOpen effect. Sheets that
// don't participate in useModalStore (ContactSheet, SleepTimerSheet,
// ScheduleTabView's day picker) need this: the on-page MediaBar component
// reads useMediaStore.showMediaBar directly, so posting to native alone
// never hides it in plain-browser use.
export function useHideMediaBarWhileOpen(open: boolean) {
  const pathname = usePathname()
  // Read via ref in the cleanup rather than adding pathname to the effect's
  // deps — a route change while the sheet is still open (rare, but possible
  // for a globally-mounted sheet) should not re-fire the hide/show dance.
  const pathnameRef = useRef(pathname)
  // Deliberate render-time sync so the cleanup below always reads the pathname
  // current as of the commit it runs in; moving this into its own effect would
  // race the `open` effect's cleanup on a route-change-plus-close in the same
  // commit.
  // eslint-disable-next-line react-hooks/refs
  pathnameRef.current = pathname

  useEffect(() => {
    if (!open) return
    const prevShowMediaBar = useMediaStore.getState().showMediaBar
    useMediaStore.getState().incrementOpenStandaloneSheetCount()
    useMediaStore.getState().setShowMediaBar(false)
    postMessageToNative({ showMobileNav: false, showMediaBar: false })
    return () => {
      // showMediaBar restores the value captured when the sheet opened: pages
      // set the natively-correct value via <ShowMediaBar/> or their own
      // scroll/focus logic (RadioPlayer's scroll observer, the donate page's
      // form focus/blur), and that's the only thing that actually knows what
      // it should be — deriving it fresh from pathname alone ignores those
      // page-owned overrides and stomps them on every sheet close.
      // showMobileNav has no such page-owned source, so it's still safe (and
      // an improvement over the old hardcoded `true`) to derive it fresh from
      // the pathname current as of this close.
      const isDetail = isTeacherDetailPath(pathnameRef.current)
      useMediaStore.getState().decrementOpenStandaloneSheetCount()
      useMediaStore.getState().setShowMediaBar(prevShowMediaBar)
      postMessageToNative({ showMobileNav: !isDetail, showMediaBar: prevShowMediaBar })
    }
  }, [open])
}
