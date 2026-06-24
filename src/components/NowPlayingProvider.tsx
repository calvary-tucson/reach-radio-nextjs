'use client'

import { useNowPlaying } from '@/hooks/useNowPlaying'

export function NowPlayingProvider() {
  useNowPlaying()
  return null
}
