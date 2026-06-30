import { RecommendedTeachersSkeleton } from '@/components/skeletons/RecommendedTeachersSkeleton'
import { TeacherGridSkeleton } from '@/components/skeletons/TeacherCardSkeleton'

function SearchBarSkeleton() {
  return <div className="h-[42px] bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded-[14px] mx-4 mb-3" />
}

function TabBarSkeleton() {
  return <div className="h-[34px] bg-[#252b32]/30 light:bg-gray-200/50 motion-safe:animate-pulse border-b border-white/7 light:border-gray-200 mb-[10px]" />
}

export default function TeachersLoading() {
  return (
    <div className="px-4 md:px-8 py-6 max-w-screen-xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-3">
        <div className="h-[22px] md:h-8 w-[90px] md:w-36 bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded" />
        <div className="h-[11px] md:h-4 w-[60px] bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded" />
      </div>

      <SearchBarSkeleton />
      <RecommendedTeachersSkeleton />
      <TabBarSkeleton />

      {/* All teachers label */}
      <div className="h-[9px] w-[90px] bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded mb-[10px]" />

      <TeacherGridSkeleton />
    </div>
  )
}
