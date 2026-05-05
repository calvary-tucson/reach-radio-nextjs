'use client'

import { useEffect, useRef } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

interface AudioProviderProps {
  streamUrl: string
}

export function AudioProvider({ streamUrl }: AudioProviderProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const isPlaying = useMediaStore((s) => s.isPlaying)
  const volume = useMediaStore((s) => s.volume)
  const isMuted = useMediaStore((s) => s.isMuted)
  const setIsBuffering = useMediaStore((s) => s.setIsBuffering)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (isPlaying) {
      el.load()
    } else {
      el.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100
  }, [volume])

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted
  }, [isMuted])

  return (
    <audio
      ref={audioRef}
      src={streamUrl}
      onLoadStart={() => setIsBuffering(true)}
      onWaiting={() => setIsBuffering(true)}
      onPlaying={() => setIsBuffering(false)}
      onCanPlay={(e) => {
        if (isPlaying) e.currentTarget.play()
      }}
      onPause={() => {
        setIsPlaying(false)
        setIsBuffering(false)
      }}
    />
  )
}
