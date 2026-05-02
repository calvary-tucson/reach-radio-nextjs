'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { PlayPauseButton } from './PlayPauseButton'
import { NowPlayingInfo } from './NowPlayingInfo'
import { postMessageToNative } from '@/lib/bridge/post-message'

export function MediaBar() {
  useNowPlaying()
  const showMediaBar = useMediaStore((s) => s.showMediaBar)
  const isPlaying = useMediaStore((s) => s.isPlaying)
  const title = useMediaStore((s) => s.title)
  const artist = useMediaStore((s) => s.artist)
  const image = useMediaStore((s) => s.image)

  useEffect(() => {
    postMessageToNative(JSON.stringify({ isPlaying, title, artist, image }))
  }, [isPlaying, title, artist, image])

  if (!showMediaBar) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[var(--color-brand-gray)] border-t border-white/10 px-4 py-2 flex items-center gap-3 z-50">
      <NowPlayingInfo />
      <PlayPauseButton />
    </div>
  )
}
