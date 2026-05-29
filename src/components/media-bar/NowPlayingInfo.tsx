'use client'

import Image from 'next/image'
import { useMediaStore } from '@/lib/store/media-store'

export function NowPlayingInfo() {
  const title = useMediaStore((s) => s.title)
  const artist = useMediaStore((s) => s.artist)
  const image = useMediaStore((s) => s.image)

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="w-12 h-12 relative overflow-hidden rounded-md flex-shrink-0">
        <Image
          src={image}
          alt="Album art"
          fill
          className="object-cover"
        />
      </div>
      <div className="min-w-0">
        <p className="text-white font-semibold text-sm truncate">{title}</p>
        {artist && (
          <p className="text-white/70 text-xs truncate">{artist}</p>
        )}
      </div>
    </div>
  )
}
