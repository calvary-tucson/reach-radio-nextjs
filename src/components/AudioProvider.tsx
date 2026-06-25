'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

interface AudioProviderProps {
  streamUrl: string
}

const MAX_RECONNECT_DELAY_MS = 30_000

export function AudioProvider({ streamUrl }: AudioProviderProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = useRef(0)
  const isPlaying = useMediaStore((s) => s.isPlaying)
  const volume = useMediaStore((s) => s.volume)
  const isMuted = useMediaStore((s) => s.isMuted)
  const setIsBuffering = useMediaStore((s) => s.setIsBuffering)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)

  const clearReconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
  }, [])

  const scheduleReconnect = useCallback(() => {
    clearReconnect()
    const delay = Math.min(
      Math.pow(2, reconnectAttempts.current) * 1000 + Math.random() * 500,
      MAX_RECONNECT_DELAY_MS
    )
    reconnectAttempts.current++
    reconnectTimer.current = setTimeout(() => {
      const el = audioRef.current
      if (!el || !useMediaStore.getState().isPlaying) return
      // Reassign src to reset NETWORK_NO_SOURCE state before retrying play
      el.src = streamUrl
      el.load()
      el.play().catch(() => {
        setIsPlaying(false)
        setIsBuffering(false)
      })
    }, delay)
  }, [clearReconnect, streamUrl, setIsPlaying, setIsBuffering])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (isPlaying) {
      clearReconnect()
      el.play().catch((err: unknown) => {
        console.error('[AudioProvider] play failed:', err)
        setIsPlaying(false)
      })
    } else {
      clearReconnect()
      reconnectAttempts.current = 0
      el.pause()
    }
  }, [isPlaying, setIsPlaying, clearReconnect])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100
  }, [volume])

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted
  }, [isMuted])

  // Cleanup reconnect timer on unmount
  useEffect(() => () => clearReconnect(), [clearReconnect])

  return (
    <audio
      ref={audioRef}
      src={streamUrl}
      preload="none"
      onLoadStart={() => setIsBuffering(true)}
      onWaiting={() => setIsBuffering(true)}
      onPlaying={() => {
        setIsBuffering(false)
        reconnectAttempts.current = 0
      }}
      onPause={() => {
        setIsPlaying(false)
        setIsBuffering(false)
      }}
      onError={() => {
        setIsBuffering(false)
        // Only reconnect if the store says we should be playing
        if (useMediaStore.getState().isPlaying) {
          scheduleReconnect()
        } else {
          setIsPlaying(false)
        }
      }}
    />
  )
}
