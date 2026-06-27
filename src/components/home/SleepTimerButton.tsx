'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMediaStore } from '@/lib/store/media-store'
import { SleepTimerSheet } from './SleepTimerSheet'

export function SleepTimerButton() {
  const [open, setOpen] = useState(false)
  const sleepTimerActive = useMediaStore((s) => s.sleepTimerActive)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={sleepTimerActive ? 'Sleep timer active' : 'Sleep timer'}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={`rounded-full p-1 w-11 h-11 flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:transition-colors ${sleepTimerActive ? 'bg-amber-500' : 'bg-gray-500 light:bg-gray-300'}`}
          >
            <Clock className="w-5 h-5 text-white light:text-gray-900" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{sleepTimerActive ? 'Sleep Timer (Active)' : 'Sleep Timer'}</TooltipContent>
      </Tooltip>
      <SleepTimerSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
