'use client'

import { useMediaStore } from '@/lib/store/media-store'

export function VolumeControl() {
  const volume = useMediaStore((s) => s.volume)
  const isMuted = useMediaStore((s) => s.isMuted)
  const setVolume = useMediaStore((s) => s.setVolume)
  const setIsMuted = useMediaStore((s) => s.setIsMuted)

  function toggleMute() {
    setIsMuted(!isMuted)
  }

  return (
    <>
      {/* Mobile: mute button only */}
      <button
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        className="md:hidden w-11 h-11 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-white rounded-full"
      >
        <VolumeIcon muted={isMuted} volume={volume} />
      </button>

      {/* Desktop: full slider */}
      <div className="hidden md:flex items-center gap-2 w-28">
        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className="flex-shrink-0 focus-visible:ring-2 focus-visible:ring-white rounded"
        >
          <VolumeIcon muted={isMuted} volume={volume} />
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full accent-white focus-visible:ring-2 focus-visible:ring-white rounded"
          aria-label="Volume"
        />
      </div>
    </>
  )
}

function VolumeIcon({ muted, volume }: { muted: boolean; volume: number }) {
  const effectiveVolume = muted ? 0 : volume

  if (effectiveVolume <= 0) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18.136" height="15.1" viewBox="0 0 18.136 15.1">
        <path d="M10.593,3.584a.839.839,0,0,1,.475.755V17.763a.839.839,0,0,1-1.363.654L5.74,15.246h-3.9A.839.839,0,0,1,1,14.407V7.695a.839.839,0,0,1,.839-.839h3.9L9.706,3.684a.839.839,0,0,1,.888-.1Z" transform="translate(-1 -3.501)" fill="#fff" fillRule="evenodd" />
        <path d="M15057.342-1093.973l-2.045-2.043-2.043,2.043a.621.621,0,0,1-.879,0,.62.62,0,0,1,0-.88l2.043-2.043-2.043-2.042a.61.61,0,0,1-.182-.44.611.611,0,0,1,.182-.44.609.609,0,0,1,.438-.182.618.618,0,0,1,.441.182l2.041,2.043,2.045-2.043a.613.613,0,0,1,.438-.182.628.628,0,0,1,.441.182.619.619,0,0,1,.182.44.618.618,0,0,1-.182.44l-2.043,2.043,2.043,2.042a.623.623,0,0,1,0,.88.625.625,0,0,1-.441.182A.615.615,0,0,1,15057.342-1093.973Z" transform="translate(-15040.265 1104.999)" fill="#fff" />
      </svg>
    )
  }
  if (effectiveVolume <= 33) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="15.144" height="15.1" viewBox="0 0 15.144 15.1">
        <g transform="translate(0 -2.535)">
          <path d="M9.186,15.5a7.551,7.551,0,0,0,0-10.679L8,6a5.874,5.874,0,0,1,0,8.306Z" transform="translate(3.746 -0.073)" fill="#fff" />
          <path d="M10.593,3.584a.839.839,0,0,1,.475.755V17.763a.839.839,0,0,1-1.363.654L5.74,15.246h-3.9A.839.839,0,0,1,1,14.407V7.695a.839.839,0,0,1,.839-.839h3.9L9.706,3.684a.839.839,0,0,1,.888-.1Z" transform="translate(-1 -0.966)" fill="#fff" fillRule="evenodd" />
        </g>
      </svg>
    )
  }
  if (effectiveVolume <= 66) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18.5" height="15.425" viewBox="0 0 18.5 15.425">
        <g transform="translate(0 -2.373)">
          <path d="M10.6,18.829A10.906,10.906,0,0,0,10.6,3.4L9.414,4.59a9.233,9.233,0,0,1,0,13.053Z" transform="translate(4.705 -1.031)" fill="#fff" />
          <path d="M9.186,15.5a7.551,7.551,0,0,0,0-10.679L8,6a5.874,5.874,0,0,1,0,8.306Z" transform="translate(3.746 -0.073)" fill="#fff" />
          <path d="M10.593,3.584a.839.839,0,0,1,.475.755V17.763a.839.839,0,0,1-1.363.654L5.74,15.246h-3.9A.839.839,0,0,1,1,14.407V7.695a.839.839,0,0,1,.839-.839h3.9L9.706,3.684a.839.839,0,0,1,.888-.1Z" transform="translate(-1 -0.966)" fill="#fff" fillRule="evenodd" />
        </g>
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="21.858" height="20.17" viewBox="0 0 21.858 20.17">
      <path d="M12.016,22.16a14.26,14.26,0,0,0,0-20.17L10.828,3.176a12.583,12.583,0,0,1,0,17.8l1.188,1.186Z" transform="translate(5.664 -1.99)" fill="#fff" />
      <path d="M10.6,18.829A10.906,10.906,0,0,0,10.6,3.4L9.414,4.59a9.233,9.233,0,0,1,0,13.053Z" transform="translate(4.705 -1.031)" fill="#fff" />
      <path d="M9.186,15.5a7.551,7.551,0,0,0,0-10.679L8,6a5.874,5.874,0,0,1,0,8.306Z" transform="translate(3.746 -0.073)" fill="#fff" />
      <path d="M10.593,3.584a.839.839,0,0,1,.475.755V17.763a.839.839,0,0,1-1.363.654L5.74,15.246h-3.9A.839.839,0,0,1,1,14.407V7.695a.839.839,0,0,1,.839-.839h3.9L9.706,3.684a.839.839,0,0,1,.888-.1Z" transform="translate(-1 -0.966)" fill="#fff" fillRule="evenodd" />
    </svg>
  )
}
