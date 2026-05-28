function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse rounded ${className}`} />
}

export function SearchResultsSkeleton() {
  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="md:flex md:gap-8 md:px-8 md:pt-6">

        {/* Left filters */}
        <div className="md:w-72 md:flex-shrink-0">
          <div className="flex items-center gap-[10px] px-4 md:px-0 pt-[14px] pb-[10px] md:pb-3">
            <Sk className="h-[20px] md:h-6 w-[12px] md:w-[16px]" />
            <Sk className="flex-1 h-[36px] md:h-[44px] rounded-[12px]" />
          </div>
          <div className="flex flex-wrap gap-[5px] px-4 md:px-0 pb-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Sk key={i} className="h-[26px] md:h-8 w-[38px] md:w-[42px] rounded-full flex-shrink-0" />
            ))}
          </div>
          <div className="flex gap-[5px] px-4 md:px-0 pb-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Sk key={i} className="h-[26px] md:h-8 w-[52px] md:w-[60px] rounded-full flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Right results */}
        <div className="md:flex-1">
          <Sk className="h-[10px] md:h-4 w-[80px] rounded mx-4 md:mx-0 mb-2 md:mb-3 md:mt-[14px]" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-[10px] md:gap-3 px-4 md:px-0 py-2 md:py-3 border-b border-white/4">
              <Sk className="w-[38px] h-[38px] rounded-[11px] flex-shrink-0" />
              <div className="flex-1">
                <Sk className="h-[12px] md:h-4 w-[70%] mb-[5px] md:mb-2" />
                <Sk className="h-[9px] md:h-3 w-[50%]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
