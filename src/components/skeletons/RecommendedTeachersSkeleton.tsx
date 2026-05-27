function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse rounded ${className}`} />
}

export function RecommendedTeachersSkeleton() {
  return (
    <section className="mb-4">
      <Sk className="h-[9px] w-[80px] mx-4 mb-[10px]" />
      <div className="flex gap-3 px-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-[5px] flex-shrink-0 w-[54px]">
            <Sk className="w-[48px] h-[48px] rounded-full" />
            <Sk className="h-[7px] w-[38px]" />
          </div>
        ))}
      </div>
    </section>
  )
}
