function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded ${className}`} />
}

export function DonatePageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading donate page...">
      <Sk className="h-14 w-2/3 rounded-lg" />
      <div className="flex gap-2">
        <Sk className="h-7 w-24 rounded-full" />
        <Sk className="h-7 w-16 rounded-full" />
        <Sk className="h-7 w-24 rounded-full" />
      </div>
      <Sk className="h-[140px] rounded-[18px]" />
      <Sk className="h-[180px] rounded-[18px]" />
    </div>
  )
}
