'use client'

import { MoonZzzIcon } from '@/components/icons/MoonZzzIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMediaStore } from '@/lib/store/media-store'

export function SleepTimerButton() {
  const sleepTimerActive = useMediaStore((s) => s.sleepTimerActive)
  const sleepTimerSheetOpen = useMediaStore((s) => s.sleepTimerSheetOpen)
  const openSleepTimerSheet = useMediaStore((s) => s.openSleepTimerSheet)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={openSleepTimerSheet}
          aria-label={sleepTimerActive ? 'Sleep timer active' : 'Sleep timer'}
          aria-expanded={sleepTimerSheetOpen}
          aria-haspopup="dialog"
          className={`rounded-full p-1 w-11 h-11 flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:transition-colors ${sleepTimerActive ? 'bg-amber-500' : 'bg-gray-500 light:bg-gray-300'}`}
        >
          <MoonZzzIcon className="w-5 h-5 text-white light:text-gray-900" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{sleepTimerActive ? 'Sleep Timer (Active)' : 'Sleep Timer'}</TooltipContent>
    </Tooltip>
  )
}
