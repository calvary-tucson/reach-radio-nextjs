'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { useMediaStore } from '@/lib/store/media-store'
import { PlayPauseButton } from '@/components/media-bar/PlayPauseButton'
import { VolumeControl } from './VolumeControl'

export function RadioPlayer() {
  const image = useMediaStore((s) => s.image)
  const title = useMediaStore((s) => s.title)
  const artist = useMediaStore((s) => s.artist)
  const setShowMediaBar = useMediaStore((s) => s.setShowMediaBar)

  useEffect(() => {
    setShowMediaBar(true)
  }, [setShowMediaBar])

  return (
    <div className="p-2 pb-5 md:p-5 bg-gray-700/50 rounded">
      <div className="relative flex items-center justify-center w-full">
        <Image
          src={image}
          alt="Now playing album art"
          width={420}
          height={420}
          className="max-w-[420px] max-h-64 rounded object-contain"
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
          <VolumeControl />
        </div>
      </div>
    </div>
  )
}
