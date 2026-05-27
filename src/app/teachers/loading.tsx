import { RecommendedTeachersSkeleton } from '@/components/skeletons/RecommendedTeachersSkeleton'
import { TeacherGridSkeleton } from '@/components/skeletons/TeacherCardSkeleton'

function SearchBarSkeleton() {
  return <div className="h-[42px] bg-[#252b32] animate-pulse rounded-[14px] mx-4 mb-3" />
}

function TabBarSkeleton() {
  return <div className="h-[34px] bg-[#252b32]/30 animate-pulse border-b border-white/7 mb-[10px]" />
}

export default function TeachersLoading() {
  return (
    <div className="px-4 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-3">
        <div className="h-[22px] w-[90px] bg-[#252b32] animate-pulse rounded" />
        <div className="h-[11px] w-[60px] bg-[#252b32] animate-pulse rounded" />
      </div>

      <SearchBarSkeleton />
      <RecommendedTeachersSkeleton />
      <TabBarSkeleton />

      {/* All teachers label */}
      <div className="h-[9px] w-[90px] bg-[#252b32] animate-pulse rounded mb-[10px]" />

      <TeacherGridSkeleton />
    </div>
  )
}
