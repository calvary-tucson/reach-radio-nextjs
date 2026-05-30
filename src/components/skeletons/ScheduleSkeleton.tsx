export function ScheduleSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" role="status" aria-busy="true" aria-label="Loading schedule...">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-gray-700/50 rounded">
          <div className="w-12 h-12 bg-gray-700 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 bg-gray-700 rounded" />
            <div className="h-3 w-1/3 bg-gray-700 rounded" />
          </div>
          <div className="h-3 w-24 bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  )
}
