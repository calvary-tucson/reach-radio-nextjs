'use client'

import { Pause, Play } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '@/lib/store/media-store'
import { useTogglePlay } from '@/lib/hooks/use-toggle-play'

interface PlayPauseButtonProps {
  size?: 'sm' | 'lg'
}

export function PlayPauseButton({ size = 'sm' }: PlayPauseButtonProps) {
  const { isPlaying, isBuffering } = useMediaStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      isBuffering: s.isBuffering,
    }))
  )
  const toggle = useTogglePlay()

  const btnSize = size === 'lg' ? 'md:w-16 md:h-16 w-14 h-14' : 'w-11 h-11'
  const iconSize = size === 'lg' ? 28 : 20

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      className={`${btnSize} rounded-full bg-[var(--color-brand-green)] flex items-center justify-center flex-shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
    >
      {isBuffering ? (
        <span
          role="status"
          aria-label="Buffering"
          className={`border-2 border-[#0a1305] border-t-transparent rounded-full motion-safe:animate-spin`}
          style={{ width: iconSize, height: iconSize }}
        />
      ) : isPlaying ? (
        <Pause size={iconSize} className="fill-[#0a1305]" strokeWidth={0} />
      ) : (
        <Play size={iconSize} className="fill-[#0a1305]" strokeWidth={0} />
      )}
    </button>
  )
}
