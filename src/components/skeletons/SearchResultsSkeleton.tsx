function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse rounded ${className}`} />
}

export function SearchResultsSkeleton() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-[10px] px-4 pt-[14px] pb-[10px]">
        <Sk className="h-[20px] w-[12px]" />
        <Sk className="flex-1 h-[36px] rounded-[12px]" />
      </div>

      {/* Filter chips */}
      <div className="flex gap-[5px] px-[14px] pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Sk key={i} className="h-[26px] w-[38px] rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Count */}
      <Sk className="h-[10px] w-[80px] rounded mx-[14px] mb-2" />

      {/* Result rows */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-[10px] px-[14px] py-2 border-b border-white/4">
          <Sk className="w-[38px] h-[38px] rounded-[11px] flex-shrink-0" />
          <div className="flex-1">
            <Sk className="h-[12px] w-[70%] mb-[5px]" />
            <Sk className="h-[9px] w-[50%]" />
          </div>
        </div>
      ))}
    </div>
  )
}
