function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] light:bg-gray-200 animate-pulse ${className}`} />
}

export function TeacherDetailSkeleton() {
  return (
    <div className="max-w-screen-xl mx-auto" role="status" aria-busy="true" aria-label="Loading teacher...">
      {/* Back */}
      <Sk className="h-[14px] md:h-5 w-[60px] md:w-24 rounded mx-4 md:mx-8 mt-[14px] mb-0" />

      {/* Banner */}
      <Sk className="w-full h-[88px] md:h-[160px] mt-3" />

      {/* Two-column at md */}
      <div className="md:flex md:gap-8 md:px-8 md:items-start">

        {/* Left sidebar */}
        <div className="md:w-72 md:flex-shrink-0">
          <div className="flex items-end justify-between px-4 md:px-0 mt-[-36px] md:mt-[-50px] mb-3">
            <Sk className="w-[72px] md:w-[80px] h-[72px] md:h-[80px] rounded-full" />
            <Sk className="h-[28px] w-[80px] rounded-full md:hidden" />
          </div>
          <Sk className="h-[18px] md:h-8 w-2/3 rounded mx-4 md:mx-0 mb-[6px]" />
          <Sk className="h-[11px] md:h-4 w-1/2 rounded mx-4 md:mx-0 mb-3" />
          <div className="flex gap-[7px] px-4 md:px-0 mb-3">
            <Sk className="h-[22px] md:h-7 w-[70px] rounded-full" />
            <Sk className="h-[22px] md:h-7 w-[50px] rounded-full" />
            <Sk className="h-[22px] md:h-7 w-[45px] rounded-full" />
          </div>
          <div className="hidden md:flex gap-[6px] mb-3">
            <Sk className="h-[26px] w-[75px] rounded-full" />
            <Sk className="h-[26px] w-[55px] rounded-full" />
          </div>
        </div>

        {/* Right main */}
        <div className="md:flex-1 md:pt-4">
          <Sk className="h-[9px] md:h-4 w-[80px] rounded mx-4 md:mx-0 mb-[10px]" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="mx-4 md:mx-0 mb-[8px] md:mb-3">
              <Sk className="h-[10px] md:h-[14px] w-[55px] md:w-20 rounded mb-[5px]" />
              <Sk className="h-[28px] md:h-9 rounded-r-[8px]" />
            </div>
          ))}
        </div>
      </div>

      {/* Also strip */}
      <div className="h-px bg-white/5 light:bg-gray-200 mx-4 md:mx-8 mb-3" />
      <Sk className="h-[9px] md:h-4 w-[80px] md:w-36 rounded mx-4 md:mx-8 mb-3" />
      <div className="flex gap-[10px] md:gap-4 px-4 md:px-8 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-[4px] md:gap-2 flex-shrink-0 w-[46px] md:w-[60px]">
            <Sk className="w-[38px] h-[38px] rounded-full" />
            <Sk className="h-[7px] md:h-[10px] w-[35px] md:w-[45px]" />
          </div>
        ))}
      </div>
    </div>
  )
}
