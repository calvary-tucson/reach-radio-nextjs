'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

// Hides the on-page media bar (and native bottom nav) for the lifetime of a
// standalone sheet, mirroring @modal/layout.tsx's isOpen effect. Sheets that
// don't participate in useModalStore (ContactSheet, SleepTimerSheet,
// ScheduleTabView's day picker) need this: the on-page MediaBar component
// reads useMediaStore.showMediaBar directly, so posting to native alone
// never hides it in plain-browser use.
export function useHideMediaBarWhileOpen(open: boolean) {
  useEffect(() => {
    if (!open) return
    const prevShowMediaBar = useMediaStore.getState().showMediaBar
    useMediaStore.getState().setShowMediaBar(false)
    postMessageToNative({ showMobileNav: false, showMediaBar: false })
    return () => {
      useMediaStore.getState().setShowMediaBar(prevShowMediaBar)
      postMessageToNative({ showMobileNav: true, showMediaBar: prevShowMediaBar })
    }
  }, [open])
}
