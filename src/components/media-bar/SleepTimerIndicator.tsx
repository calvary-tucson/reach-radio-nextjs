'use client'

import { MoonZzzIcon } from '@/components/icons/MoonZzzIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMediaStore } from '@/lib/store/media-store'

export function SleepTimerIndicator() {
  const sleepTimerActive = useMediaStore((s) => s.sleepTimerActive)
  const remainingSleepSeconds = useMediaStore((s) => s.remainingSleepSeconds)
  const sleepTimerSheetOpen = useMediaStore((s) => s.sleepTimerSheetOpen)
  const openSleepTimerSheet = useMediaStore((s) => s.openSleepTimerSheet)

  if (!sleepTimerActive) return null

  const minutes = Math.max(1, Math.ceil(remainingSleepSeconds / 60))

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={openSleepTimerSheet}
          aria-label={`Sleep timer active, ${minutes} minute${minutes !== 1 ? 's' : ''} remaining`}
          aria-haspopup="dialog"
          aria-expanded={sleepTimerSheetOpen}
          className="rounded-full w-11 h-11 flex items-center justify-center flex-shrink-0 cursor-pointer bg-amber-500 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <MoonZzzIcon className="w-5 h-5 text-white light:text-gray-900" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Sleep Timer (Active)</TooltipContent>
    </Tooltip>
  )
}
