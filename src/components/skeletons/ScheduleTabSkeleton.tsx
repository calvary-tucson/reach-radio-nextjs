function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse rounded ${className}`} />
}

export function ScheduleTabSkeleton() {
  return (
    <div>
      {/* Most on air banner */}
      <Sk className="h-[44px] rounded-[12px] mx-[14px] mt-[10px] mb-[10px]" />

      {/* Day pills */}
      <div className="flex gap-[5px] px-3 pb-[10px]">
        {Array.from({ length: 7 }).map((_, i) => (
          <Sk key={i} className="h-[30px] w-[36px] rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Axis rows */}
      <div className="px-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-2 mb-[6px]" style={{ opacity: 1 - i * 0.08 }}>
            <Sk className="h-[9px] w-[28px] mt-1 flex-shrink-0" />
            <Sk className="flex-1 h-[34px] rounded-[8px]" />
          </div>
        ))}
      </div>
    </div>
  )
}
