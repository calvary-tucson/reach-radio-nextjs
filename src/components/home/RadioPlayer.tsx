'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'
import { PlayPauseButton } from '@/components/media-bar/PlayPauseButton'
import { VolumeControl } from './VolumeControl'
import { SleepTimerButton } from './SleepTimerButton'
import { SleepTimerOverlay } from './SleepTimerOverlay'

export function RadioPlayer() {
  const image = useMediaStore((s) => s.image)
  const title = useMediaStore((s) => s.title)
  const artist = useMediaStore((s) => s.artist)
  const isPlaying = useMediaStore((s) => s.isPlaying)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)
  const setShowMediaBar = useMediaStore((s) => s.setShowMediaBar)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowMediaBar(false)
        } else if (window.scrollY > 100) {
          setShowMediaBar(true)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [setShowMediaBar])

  function togglePlay() {
    const next = !isPlaying
    setIsPlaying(next)
    postMessageToNative(JSON.stringify({ isPlaying: next }))
  }

  const altText = title ? `Now playing: ${title}${artist ? ` by ${artist}` : ''}` : 'Now playing album art'

  return (
    <div ref={containerRef} className="p-2 pb-5 md:p-5 bg-gray-700/50 rounded">
      <div className="relative flex items-center justify-center w-full">
        <SleepTimerOverlay />
        <Image
          src={image}
          alt={altText}
          width={256}
          height={256}
          className="max-w-[420px] max-h-64 rounded object-contain cursor-pointer hover:opacity-90 transition-opacity"
          onClick={togglePlay}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlay() } }}
          role="button"
          tabIndex={0}
          aria-label={isPlaying ? 'Pause radio' : 'Play radio'}
          priority
        />
      </div>
      <div className="flex flex-col items-center gap-4 mt-5">
        <div className="flex flex-col items-center gap-1 w-full px-2 text-center">
          <p className="text-white font-semibold text-lg leading-tight">{title}</p>
          {artist && <p className="text-white/70 text-sm">{artist}</p>}
        </div>
        <div className="flex gap-8 items-center justify-center">
          <PlayPauseButton />
          <SleepTimerButton />
          <VolumeControl />
        </div>
      </div>
    </div>
  )
}
