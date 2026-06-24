'use client'

import { cn } from '@/lib/utils'
import type { useSheetDrag } from '@/lib/hooks/useSheetDrag'

interface DragHandleProps {
  drag: ReturnType<typeof useSheetDrag>
  onDismiss: () => void
  className?: string
}

export function DragHandle({ drag, onDismiss, className }: DragHandleProps) {
  return (
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      className={cn(
        'hidden touch:flex items-center justify-center min-h-11',
        'touch-none cursor-pointer bg-transparent border-0 appearance-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDismiss() }}
      onTouchStart={drag.onTouchStart}
      onTouchMove={drag.onTouchMove}
      onTouchEnd={drag.onTouchEnd}
      onMouseDown={drag.onMouseDown}
    >
      <div className="h-1 w-10 rounded-full bg-white/30 light:bg-gray-300" aria-hidden="true" />
    </button>
  )
}
