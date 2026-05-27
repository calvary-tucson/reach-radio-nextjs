function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse ${className}`} />
}

export function TeacherDetailSkeleton() {
  return (
    <div>
      {/* Back bar */}
      <Sk className="h-[14px] w-[60px] rounded mx-4 mt-[14px] mb-0" />

      {/* Banner */}
      <Sk className="w-full h-[88px] mt-3" />

      {/* Avatar overlap row */}
      <div className="flex items-end justify-between px-4 mt-[-36px] mb-3">
        <Sk className="w-[72px] h-[72px] rounded-full" />
        <Sk className="h-[28px] w-[80px] rounded-full" />
      </div>

      {/* Name + title */}
      <Sk className="h-[18px] w-2/3 rounded mx-4 mb-[6px]" />
      <Sk className="h-[11px] w-1/2 rounded mx-4 mb-3" />

      {/* Chips */}
      <div className="flex gap-[7px] px-4 mb-[14px]">
        <Sk className="h-[22px] w-[70px] rounded-full" />
        <Sk className="h-[22px] w-[50px] rounded-full" />
        <Sk className="h-[22px] w-[45px] rounded-full" />
      </div>

      {/* Links */}
      <div className="flex gap-[6px] px-4 mb-[14px]">
        <Sk className="h-[26px] w-[75px] rounded-full" />
        <Sk className="h-[26px] w-[55px] rounded-full" />
      </div>

      <div className="h-px bg-white/5 mx-4 mb-3" />

      {/* Schedule label */}
      <Sk className="h-[9px] w-[80px] rounded mx-4 mb-[10px]" />

      {/* Schedule blocks */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="mx-4 mb-[8px]">
          <Sk className="h-[10px] w-[55px] rounded mb-[5px]" />
          <Sk className="h-[28px] rounded-r-[8px]" />
        </div>
      ))}
    </div>
  )
}
