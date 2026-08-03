import { Suspense } from 'react'
import type { Metadata } from 'next'
import { fetchAllTeacherData } from '@/lib/sanity/teachers'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { TeacherSearchBar } from '@/components/teachers/TeacherSearchBar'
import { TeacherSortControl } from '@/components/teachers/TeacherSortControl'
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'

export const metadata: Metadata = {
  title: 'Search Teachers',
  robots: { index: false },
}

async function SearchContent() {
  const { teachers, scheduleTeachers } = await fetchAllTeacherData()
  return <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
}

export default function TeachersSearchPage() {
  return (
    <div className="px-4 py-6 sm:px-6 space-y-4">
      <ShowMediaBar />
      {/* Row 1: search + sort */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Suspense fallback={null}>
            <TeacherSearchBar />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <TeacherSortControl />
        </Suspense>
      </div>
      {/* Day chips + results */}
      <Suspense fallback={<SearchResultsSkeleton />}>
        <SearchContent />
      </Suspense>
    </div>
  )
}
