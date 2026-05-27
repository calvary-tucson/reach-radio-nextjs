function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse rounded ${className}`} />
}

export function TeacherCardSkeleton() {
  return (
    <div className="bg-[#1c2128] rounded-[18px] overflow-hidden border border-white/5">
      <div className="aspect-square bg-[#252b32] animate-pulse" />
      <div className="px-[11px] pt-[9px] pb-[11px]">
        <Sk className="h-[11px] w-3/4 mb-[6px]" />
        <Sk className="h-[9px] w-1/2 mb-[6px]" />
        <Sk className="h-[16px] w-[45px] rounded-full" />
      </div>
    </div>
  )
}

export function TeacherGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[9px]">
      {Array.from({ length: 8 }).map((_, i) => (
        <TeacherCardSkeleton key={i} />
      ))}
    </div>
  )
}
