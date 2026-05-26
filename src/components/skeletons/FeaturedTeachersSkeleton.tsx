export function FeaturedTeachersSkeleton() {
  return (
    <section>
      <div className="flex items-center justify-between px-3 mb-3">
        <div className="h-5 w-28 bg-gray-700/50 rounded animate-pulse" />
        <div className="h-4 w-14 bg-gray-700/50 rounded animate-pulse" />
      </div>
      <div className="flex gap-3 px-3 pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[120px] flex flex-col items-center gap-2 animate-pulse"
          >
            <div className="w-[120px] h-[120px] rounded-lg bg-gray-700/50" />
            <div className="h-3.5 w-20 bg-gray-700/50 rounded" />
            <div className="h-3 w-16 bg-gray-700/50 rounded" />
          </div>
        ))}
      </div>
    </section>
  )
}
