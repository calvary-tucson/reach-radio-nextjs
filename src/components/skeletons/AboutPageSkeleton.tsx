function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded ${className}`} />
}

export function AboutPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading about page...">
      {/* Frequency hero */}
      <Sk className="h-[140px] rounded-[18px]" />
      {/* App download */}
      <Sk className="h-[96px] rounded-[18px]" />
      {/* Contact form */}
      <Sk className="h-[180px] rounded-[18px]" />
      {/* Privacy link */}
      <Sk className="h-[68px] rounded-xl" />
    </div>
  )
}
