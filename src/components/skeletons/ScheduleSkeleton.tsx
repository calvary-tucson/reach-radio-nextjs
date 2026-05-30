export function ScheduleSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" role="status" aria-busy="true" aria-label="Loading schedule...">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white/5 light:bg-gray-50 rounded">
          <div className="w-12 h-12 bg-white/10 light:bg-gray-200 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 bg-white/10 light:bg-gray-200 rounded" />
            <div className="h-3 w-1/3 bg-white/10 light:bg-gray-200 rounded" />
          </div>
          <div className="h-3 w-24 bg-white/10 light:bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  )
}
