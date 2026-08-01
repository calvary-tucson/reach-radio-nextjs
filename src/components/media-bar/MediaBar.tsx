'use client'

import { usePathname } from 'next/navigation'
import { useMediaStore } from '@/lib/store/media-store'
import { PlayPauseButton } from './PlayPauseButton'
import { NowPlayingInfo } from './NowPlayingInfo'
import { SleepTimerIndicator } from './SleepTimerIndicator'
import { isTeacherDetailPath } from '@/lib/routes'

export function MediaBar() {
  const pathname = usePathname()
  const showMediaBar = useMediaStore((s) => s.showMediaBar)

  if (isTeacherDetailPath(pathname)) return null

  return (
    <div
      role="region"
      aria-label="Media player"
      inert={!showMediaBar}
      data-web-chrome=""
      data-media-bar=""
      data-hidden={!showMediaBar ? '' : undefined}
      className="fixed bottom-[72px] md:bottom-0 left-0 right-0 bg-[var(--color-brand-gray)] light:bg-gray-100 border-t border-white/10 light:border-gray-200 px-4 py-3 flex items-center gap-3 z-50"
    >
      <NowPlayingInfo />
      <PlayPauseButton />
      <SleepTimerIndicator />
    </div>
  )
}
