'use client'

import { useState, useEffect } from 'react'
import { Volume, Volume1, Volume2, VolumeX } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '@/lib/store/media-store'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

export function VolumeControl() {
  const { volume, isMuted, setVolume, toggleMute } = useMediaStore(
    useShallow((s) => ({
      volume: s.volume,
      isMuted: s.isMuted,
      setVolume: s.setVolume,
      toggleMute: s.toggleMute,
    }))
  )
  const [isNative, setIsNative] = useState(false)

  useEffect(() => {
    setIsNative(document.documentElement.classList.contains('native-app'))
  }, [])

  const effectiveVolume = isMuted ? 0 : volume

  return (
    <div className={cn('hidden items-center gap-2 w-28', isNative ? 'lg:flex' : 'md:flex')}>
      <button
        type="button"
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        className="w-11 h-11 flex-shrink-0 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded cursor-pointer"
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
  )
}

function VolumeIcon({ volume }: { volume: number }) {
  const props = { size: 18, className: 'text-white light:text-gray-900' } as const
  if (volume <= 0) return <VolumeX {...props} />
  if (volume <= 33) return <Volume {...props} />
  if (volume <= 66) return <Volume1 {...props} />
  return <Volume2 {...props} />
}
