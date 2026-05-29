'use client'

import { Volume, Volume1, Volume2, VolumeX } from 'lucide-react'
import { useMediaStore } from '@/lib/store/media-store'
import { Slider } from '@/components/ui/slider'

export function VolumeControl() {
  const volume = useMediaStore((s) => s.volume)
  const isMuted = useMediaStore((s) => s.isMuted)
  const setVolume = useMediaStore((s) => s.setVolume)
  const toggleMute = useMediaStore((s) => s.toggleMute)

  const effectiveVolume = isMuted ? 0 : volume

  return (
    <>
      {/* Mobile: mute button only */}
      <button
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        tabIndex={-1}
        className="hidden w-11 h-11 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-white rounded-full cursor-pointer"
      >
        <VolumeIcon volume={effectiveVolume} />
      </button>

      {/* Desktop: slider + mute button */}
      <div className="hidden md:flex items-center gap-2 w-28">
        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className="flex-shrink-0 focus-visible:ring-2 focus-visible:ring-white rounded cursor-pointer"
        >
          <VolumeIcon volume={effectiveVolume} />
        </button>
        <Slider
          min={0}
          max={100}
          value={[volume]}
          onValueChange={([v]) => setVolume(v)}
          aria-label="Volume"
          className="w-full"
        />
      </div>
    </>
  )
}

function VolumeIcon({ volume }: { volume: number }) {
  const props = { size: 18, className: 'text-white light:text-gray-900' } as const
  if (volume <= 0) return <VolumeX {...props} />
  if (volume <= 33) return <Volume {...props} />
  if (volume <= 66) return <Volume1 {...props} />
  return <Volume2 {...props} />
}
