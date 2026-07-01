'use client'

import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

export function useTogglePlay() {
  const { isPlaying, setIsPlaying, setIsBuffering } = useMediaStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      setIsPlaying: s.setIsPlaying,
      setIsBuffering: s.setIsBuffering,
    }))
  )

  return useCallback(() => {
    const next = !isPlaying
    setIsPlaying(next)
    if (next) setIsBuffering(true)
    postMessageToNative({ isPlaying: next })
  }, [isPlaying, setIsPlaying, setIsBuffering])
}
