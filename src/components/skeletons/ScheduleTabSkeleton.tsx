import { SkeletonBlock as Sk } from '@/components/skeletons/SkeletonBlock'

export function ScheduleTabSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading schedule...">
      {/* Most on air banner */}
      <Sk className="h-[44px] rounded-[12px] mb-3" />

      {/* Day pills */}
      <div className="flex gap-[5px] pb-[10px] mb-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <Sk key={i} className="h-[30px] w-[40px] rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Show cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 mb-2" style={{ opacity: 1 - i * 0.15 }}>
          <Sk className="h-[38px] w-[38px] rounded-full flex-shrink-0" />
          <div className="flex-1">
            <Sk className="h-[14px] w-2/3 mb-1.5 rounded" />
            <Sk className="h-[11px] w-1/3 rounded" />
          </div>
          <Sk className="h-[26px] w-[36px] rounded-md flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}
