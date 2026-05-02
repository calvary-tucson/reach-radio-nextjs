'use client'

import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

export function PlayPauseButton() {
  const isPlaying = useMediaStore((s) => s.isPlaying)
  const isBuffering = useMediaStore((s) => s.isBuffering)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)

  function toggle() {
    const next = !isPlaying
    setIsPlaying(next)
    postMessageToNative(JSON.stringify({ isPlaying: next }))
  }

  return (
    <button
      onClick={toggle}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      className="w-10 h-10 rounded-full bg-[var(--color-brand-green)] flex items-center justify-center flex-shrink-0"
    >
      {isBuffering ? (
        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : isPlaying ? (
        <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
          <polygon points="5,3 19,12 5,21" />
        </svg>
      )}
    </button>
  )
}
