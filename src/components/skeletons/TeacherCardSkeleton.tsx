export function TeacherCardSkeleton() {
  return (
    <div className="bg-gray-700/50 rounded p-4 animate-pulse">
      <div className="w-full aspect-square bg-gray-700 rounded mb-3" />
      <div className="h-4 w-3/4 bg-gray-700 rounded mb-2" />
      <div className="h-3 w-1/2 bg-gray-700 rounded" />
    </div>
  )
}

export function TeacherGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <TeacherCardSkeleton key={i} />
      ))}
    </div>
  )
}
