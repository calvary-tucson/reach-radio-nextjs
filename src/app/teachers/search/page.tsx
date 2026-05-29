import { Suspense } from 'react'
import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'

export const metadata: Metadata = {
  title: 'Search Teachers',
  robots: { index: false },
}

async function SearchContent() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])
  return (
    <TeacherSearchClient
      teachers={teachers}
      scheduleTeachers={scheduleTeachers}
    />
  )
}

export default function TeachersSearchPage() {
  return (
    <div className="px-4 py-6 sm:px-6">
      <Suspense fallback={<SearchResultsSkeleton />}>
        <SearchContent />
      </Suspense>
    </div>
  )
}
