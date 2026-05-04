'use client'

import { useMediaStore } from '@/lib/store/media-store'

export function VolumeControl() {
  const volume = useMediaStore((s) => s.volume)
  const setVolume = useMediaStore((s) => s.setVolume)

  return (
    <div className="hidden md:flex items-center gap-2 w-28">
      <svg className="w-5 h-5 text-white fill-current flex-shrink-0" viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
      </svg>
      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="w-full accent-white"
        aria-label="Volume"
      />
    </div>
  )
}
