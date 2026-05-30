function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse rounded ${className}`} />
}

export function SearchResultsSkeleton() {
  return (
    <div className="max-w-screen-xl mx-auto space-y-4" role="status" aria-busy="true" aria-label="Loading search results...">
      {/* Search input */}
      <div className="flex items-center gap-[10px]">
        <Sk className="h-5 w-4 rounded flex-shrink-0" />
        <Sk className="flex-1 h-[44px] rounded-xl" />
      </div>

      {/* Day filter chips */}
      <div>
        <Sk className="h-3 w-8 mb-1.5 rounded" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Sk key={i} className="h-[44px] w-[52px] rounded-full flex-shrink-0" />
          ))}
        </div>
      </div>

      {/* Sort chips */}
      <div>
        <Sk className="h-3 w-8 mb-1.5 rounded" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk key={i} className="h-[44px] w-[60px] rounded-full flex-shrink-0" />
          ))}
        </div>
      </div>

      {/* Results */}
      <div>
        <Sk className="h-4 w-[80px] mb-3 rounded" />
        <ul className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="h-[68px] rounded-xl bg-white/5 animate-pulse" />
          ))}
        </ul>
      </div>
    </div>
  )
}
