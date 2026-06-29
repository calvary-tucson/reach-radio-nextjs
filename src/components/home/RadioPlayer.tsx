'use client'

import { useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '@/lib/store/media-store'
import { FALLBACK_OG_IMAGE } from '@/lib/constants'
import { postMessageToNative } from '@/lib/bridge/post-message'
import { PlayPauseButton } from '@/components/media-bar/PlayPauseButton'
import { VolumeControl } from './VolumeControl'
import { SleepTimerButton } from './SleepTimerButton'
import { SleepTimerOverlay } from './SleepTimerOverlay'

export function RadioPlayer() {
  const { image, title, artist, isPlaying, setIsPlaying, setIsBuffering, setShowMediaBar } = useMediaStore(
    useShallow((s) => ({
      image: s.image,
      title: s.title,
      artist: s.artist,
      isPlaying: s.isPlaying,
      setIsPlaying: s.setIsPlaying,
      setIsBuffering: s.setIsBuffering,
      setShowMediaBar: s.setShowMediaBar,
    }))
  )
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setShowMediaBar(false)
  }, [setShowMediaBar])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowMediaBar(false)
          postMessageToNative({ showMediaBar: false })
        } else if (entry.boundingClientRect.top < 0) {
          setShowMediaBar(true)
          postMessageToNative({ showMediaBar: true })
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
    }
  }, [setShowMediaBar])

  const togglePlay = useCallback(() => {
    const next = !isPlaying
    setIsPlaying(next)
    if (next) setIsBuffering(true)
    postMessageToNative({ isPlaying: next })
  }, [isPlaying, setIsPlaying, setIsBuffering])

  return (
    <div ref={containerRef} role="region" aria-label="Radio player" className="p-2 pb-5 md:p-5 bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px]">
      <div className="relative flex items-center justify-center w-full">
        <SleepTimerOverlay />
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause radio' : 'Play radio'}
          className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded cursor-pointer"
        >
          <Image
            src={image || FALLBACK_OG_IMAGE}
            alt=""
            width={420}
            height={256}
            sizes="(max-width: 640px) 100vw, 420px"
            className="w-full max-w-[420px] max-h-64 rounded-xl object-contain hover:opacity-90 motion-safe:transition-opacity"
            style={{ height: 'auto' }}
            priority
          />
        </button>
      </div>
      <div className="flex md:flex-row flex-col items-center justify-between md:gap-0 gap-8 mt-5">
        <div className="flex flex-col md:items-start items-center md:gap-3 gap-1 w-full flex-1 px-2">
          <h2 className="md:text-4xl text-2xl font-normal leading-tight text-white light:text-gray-900 truncate w-full md:text-left text-center">
            {title || 'Now Playing'}
          </h2>
          {artist && (
            <p className="md:font-bold font-medium md:text-lg uppercase text-white/90 light:text-gray-700 truncate w-full md:text-left text-center">
              {artist}
            </p>
          )}
        </div>
        <div className="flex gap-11">
          <div className="flex gap-5 md:items-center items-end md:ml-0 ml-14">
            <PlayPauseButton size="lg" />
            <SleepTimerButton />
          </div>
          <VolumeControl />
        </div>
      </div>
    </div>
  )
}
