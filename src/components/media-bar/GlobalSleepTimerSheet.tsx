'use client'

import { useMediaStore } from '@/lib/store/media-store'
import { SleepTimerSheet } from '@/components/home/SleepTimerSheet'

export function GlobalSleepTimerSheet() {
  const open = useMediaStore((s) => s.sleepTimerSheetOpen)
  const closeSleepTimerSheet = useMediaStore((s) => s.closeSleepTimerSheet)
  return <SleepTimerSheet open={open} onClose={closeSleepTimerSheet} />
}
