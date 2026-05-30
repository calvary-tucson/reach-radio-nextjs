function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] motion-safe:animate-pulse rounded ${className}`} />
}

export function RecommendedTeachersSkeleton() {
  return (
    <section className="mb-4 md:mb-6" role="status" aria-busy="true" aria-label="Loading recommended teachers...">
      <Sk className="h-[9px] md:h-[14px] w-[80px] md:w-[110px] px-0 mb-[10px] md:mb-3" />
      <div className="flex gap-3 md:gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-[5px] md:gap-2 flex-shrink-0 w-[72px]">
            <Sk className="w-[72px] h-[72px] rounded-full" />
            <Sk className="h-[8px] md:h-[12px] w-[52px]" />
          </div>
        ))}
      </div>
    </section>
  )
}
