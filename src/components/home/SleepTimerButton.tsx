'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SleepTimerSheet } from './SleepTimerSheet'

export function SleepTimerButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Sleep Timer"
            aria-expanded={open}
            aria-haspopup="dialog"
            className="bg-gray-500 light:bg-gray-300 rounded-full p-1 w-9 h-9 flex items-center justify-center cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <Clock className="w-5 h-5 text-white light:text-gray-900" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Sleep Timer</TooltipContent>
      </Tooltip>
      <SleepTimerSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
