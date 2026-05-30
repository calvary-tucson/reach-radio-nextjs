function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded ${className}`} />
}

export function TeacherCardSkeleton() {
  return (
    <div className="bg-[#1c2128] light:bg-white rounded-[18px] overflow-hidden border border-white/5 light:border-gray-200">
      <div className="aspect-square bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse" />
      <div className="px-[11px] md:px-3 pt-[9px] md:pt-3 pb-[11px] md:pb-3">
        <Sk className="h-[11px] md:h-[14px] w-3/4 mb-[6px]" />
        <Sk className="h-[9px] md:h-[12px] w-1/2 mb-[6px]" />
        <Sk className="h-[16px] w-[45px] md:w-[55px] rounded-full" />
      </div>
    </div>
  )
}

export function TeacherGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[9px] md:gap-3" role="status" aria-busy="true" aria-label="Loading teachers...">
      {Array.from({ length: 8 }).map((_, i) => (
        <TeacherCardSkeleton key={i} />
      ))}
    </div>
  )
}
