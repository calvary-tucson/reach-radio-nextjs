export function TeacherDetailSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 animate-pulse">
      <div className="w-full max-w-sm mx-auto aspect-square bg-gray-700 rounded mb-6" />
      <div className="h-8 w-2/3 bg-gray-700 rounded mb-2" />
      <div className="h-5 w-1/2 bg-gray-700 rounded mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-700 rounded" />
        ))}
      </div>
    </div>
  )
}
