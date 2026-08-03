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
  // commit, reintroducing a narrower version of the stale-restore bug this
  // hook exists to fix.
  // eslint-disable-next-line react-hooks/refs
  pathnameRef.current = pathname

  useEffect(() => {
    if (!open) return
    useMediaStore.getState().setShowMediaBar(false)
    postMessageToNative({ showMobileNav: false, showMediaBar: false })
    return () => {
      // Re-derive the natively-correct value the same way BridgeInit's own
      // pathname effect does, instead of trusting a captured "previous"
      // store value — that value is stale on any route with no <ShowMediaBar />
      // mount (e.g. /teachers/search), which would otherwise leave native's
      // media bar hidden until the next route change.
      const isDetail = isTeacherDetailPath(pathnameRef.current)
      const restored = pathnameRef.current !== '/' && !isDetail
      useMediaStore.getState().setShowMediaBar(restored)
      postMessageToNative({ showMobileNav: !isDetail, showMediaBar: restored })
    }
  }, [open])
}
