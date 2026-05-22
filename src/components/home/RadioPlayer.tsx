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
    return () => {
      observer.disconnect()
      setShowMediaBar(false)
    }
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
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause radio' : 'Play radio'}
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded"
        >
          <Image
            src={image}
            alt={altText}
            width={420}
            height={420}
            className="max-w-[420px] max-h-64 rounded object-contain hover:opacity-90 transition-opacity"
            priority
          />
        </button>
      </div>
      <div className="flex md:flex-row flex-col items-center justify-between md:gap-0 gap-8 mt-5">
        <div className="flex flex-col md:items-start items-center md:gap-3 gap-1 w-full md:w-[calc(100%_-_276px)] px-2">
          <p className="md:text-4xl text-2xl font-normal leading-tight text-white truncate w-full md:text-left text-center">
            {title}
          </p>
          {artist && (
            <p className="md:font-bold font-medium md:text-lg uppercase text-white/80 truncate w-full md:text-left text-center">
              {artist}
            </p>
          )}
        </div>
        <div className="flex gap-11">
          <div className="flex gap-5 md:items-center items-end md:ml-0 ml-14">
            <PlayPauseButton />
            <SleepTimerButton />
          </div>
          <VolumeControl />
        </div>
      </div>
    </div>
  )
}
