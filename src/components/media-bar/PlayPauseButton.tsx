'use client'

import { Pause, Play } from 'lucide-react'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

interface PlayPauseButtonProps {
  size?: 'sm' | 'lg'
}

export function PlayPauseButton({ size = 'sm' }: PlayPauseButtonProps) {
  const isPlaying = useMediaStore((s) => s.isPlaying)
  const isBuffering = useMediaStore((s) => s.isBuffering)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)

  function toggle() {
    const next = !isPlaying
    setIsPlaying(next)
    postMessageToNative({ isPlaying: next })
  }

  const btnSize = size === 'lg' ? 'md:w-16 md:h-16 w-14 h-14' : 'w-11 h-11'
  const iconSize = size === 'lg' ? 28 : 20

  return (
    <button
      onClick={toggle}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      className={`${btnSize} rounded-full bg-[var(--color-brand-green)] flex items-center justify-center flex-shrink-0 cursor-pointer`}
    >
      {isBuffering ? (
        <span
          role="status"
          aria-label="Buffering"
          className={`border-2 border-white border-t-transparent rounded-full motion-safe:animate-spin`}
          style={{ width: iconSize, height: iconSize }}
        />
      ) : isPlaying ? (
        <Pause size={iconSize} className="fill-white" strokeWidth={0} />
      ) : (
        <Play size={iconSize} className="fill-white" strokeWidth={0} />
      )}
    </button>
  )
}
