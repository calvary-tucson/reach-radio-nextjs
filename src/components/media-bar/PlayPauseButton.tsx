'use client'

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
    postMessageToNative(JSON.stringify({ isPlaying: next }))
  }

  const btnSize = size === 'lg' ? 'md:w-16 md:h-16 w-14 h-14' : 'w-11 h-11'
  const iconSize = size === 'lg' ? 'w-7' : 'w-5'
  const spinnerSize = size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'

  return (
    <button
      onClick={toggle}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      className={`${btnSize} rounded-full bg-[var(--color-brand-green)] flex items-center justify-center flex-shrink-0 cursor-pointer`}
    >
      {isBuffering ? (
        <span className={`${spinnerSize} border-2 border-white border-t-transparent rounded-full motion-safe:animate-spin`} />
      ) : isPlaying ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 34" className={`${iconSize} fill-white`}>
          <path d="M2920,7929a2,2,0,0,1-2-2v-30a2,2,0,0,1,2-2h8a2,2,0,0,1,2,2v30a2,2,0,0,1-2,2Zm-18,0a2,2,0,0,1-2-2v-30a2,2,0,0,1,2-2h8a2,2,0,0,1,2,2v30a2,2,0,0,1-2,2Z" transform="translate(-2900 -7895)" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 40" className={`${iconSize} fill-white`} role="img">
          <path d="M29.6 17.414a3 3 0 010 5.172L4.521 37.341A3 3 0 010 34.755V5.245a3 3 0 014.521-2.586z" />
        </svg>
      )}
    </button>
  )
}
