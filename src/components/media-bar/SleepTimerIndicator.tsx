'use client'

import { useState } from 'react'
import { MoonZzzIcon } from '@/components/icons/MoonZzzIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMediaStore } from '@/lib/store/media-store'
import { SleepTimerSheet } from '@/components/home/SleepTimerSheet'

export function SleepTimerIndicator() {
  const [open, setOpen] = useState(false)
  const sleepTimerActive = useMediaStore((s) => s.sleepTimerActive)
  const remainingSleepSeconds = useMediaStore((s) => s.remainingSleepSeconds)

  if (!sleepTimerActive && !open) return null

  const minutes = Math.max(1, Math.ceil(remainingSleepSeconds / 60))

  return (
    <>
      {sleepTimerActive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Sleep timer active, ${minutes} minute${minutes !== 1 ? 's' : ''} remaining`}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="rounded-full w-11 h-11 flex items-center justify-center flex-shrink-0 cursor-pointer bg-amber-500 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <MoonZzzIcon className="w-5 h-5 text-white light:text-gray-900" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Sleep Timer (Active)</TooltipContent>
        </Tooltip>
      )}
      <SleepTimerSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
