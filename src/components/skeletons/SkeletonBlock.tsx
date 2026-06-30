export function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded ${className}`} />
}
