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
        {/* Decorative blurred background — aria-hidden, scale-110 hides blur edge softness.
            Uses a low-res variant (?w=48) to avoid a full-size duplicate network request. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-110 blur-md"
          style={{ backgroundImage: `url(${image.replace(/([?&])w=\d+/, '$1w=48')})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        {/* Sharp image centered, object-contain so faces are never cropped.
            `fill` injects position:absolute — `relative` would be redundant, omit it. */}
        <Image
          src={image}
          alt={artist ? `${title} — ${artist}` : (title ?? 'Album art')}
          fill
          sizes="48px"
          className="object-contain z-10"
        />
      </div>
      <div className="min-w-0">
        <p className="text-white light:text-gray-900 font-semibold text-sm truncate">{title}</p>
        {artist && (
          <p className="text-white/70 light:text-gray-500 text-xs truncate">{artist}</p>
        )}
      </div>
    </div>
  )
}
