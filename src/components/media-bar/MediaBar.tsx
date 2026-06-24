'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'
import { PlayPauseButton } from './PlayPauseButton'
import { NowPlayingInfo } from './NowPlayingInfo'
import { postMessageToNative } from '@/lib/bridge/post-message'

export function MediaBar() {
  const showMediaBar = useMediaStore((s) => s.showMediaBar)
  const isPlaying = useMediaStore((s) => s.isPlaying)
  const isBuffering = useMediaStore((s) => s.isBuffering)
  const title = useMediaStore((s) => s.title)
  const artist = useMediaStore((s) => s.artist)
  const image = useMediaStore((s) => s.image)

  useEffect(() => {
    postMessageToNative({ isPlaying, isBuffering, title, artist, image })
  }, [isPlaying, isBuffering, title, artist, image])

  return (
    <div
      role="region"
      aria-label="Media player"
      aria-hidden={!showMediaBar}
      inert={!showMediaBar}
      data-web-chrome=""
      data-media-bar=""
      data-hidden={!showMediaBar ? '' : undefined}
      className="fixed bottom-[72px] md:bottom-0 left-0 right-0 bg-[var(--color-brand-gray)] light:bg-gray-100 border-t border-white/10 light:border-gray-200 px-4 py-3 flex items-center gap-3 z-50"
    >
      <NowPlayingInfo />
      <PlayPauseButton />
    </div>
  )
}
