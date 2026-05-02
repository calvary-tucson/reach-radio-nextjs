'use client'

import Image from 'next/image'
import { useMediaStore } from '@/lib/store/media-store'

export function NowPlayingInfo() {
  const title = useMediaStore((s) => s.title)
  const artist = useMediaStore((s) => s.artist)
  const image = useMediaStore((s) => s.image)

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <Image
        src={image}
        alt="Album art"
        width={48}
        height={48}
        className="rounded-md flex-shrink-0 object-cover"
      />
      <div className="min-w-0">
        <p className="text-white font-semibold text-sm truncate">{title}</p>
        {artist && (
          <p className="text-white/70 text-xs truncate">{artist}</p>
        )}
      </div>
    </div>
  )
}
