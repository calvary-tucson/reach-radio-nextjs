export function RadioPlayerSkeleton() {
  return (
    <div className="p-2 pb-5 md:p-5 bg-white/5 rounded animate-pulse">
      <div className="relative flex items-center justify-center w-full">
        <div className="max-w-[420px] h-64 w-full bg-white/10 rounded" />
      </div>
      <div className="flex flex-col items-center gap-8 mt-5">
        <div className="flex flex-col items-center gap-1 w-full px-2">
          <div className="h-5 w-3/4 bg-white/10 rounded" />
          <div className="h-4 w-1/2 bg-white/10 rounded" />
        </div>
        <div className="flex gap-11 items-center justify-center">
          <div className="w-14 h-14 bg-white/10 rounded-full" />
          <div className="w-9 h-9 bg-white/10 rounded-full" />
          <div className="w-24 h-8 bg-white/10 rounded" />
        </div>
      </div>
    </div>
  )
}
