import { Suspense } from 'react'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'

async function ModalSearchContent() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])
  return (
    <div className="px-4 pt-4 pb-16">
      <TeacherSearchClient
        teachers={teachers}
        scheduleTeachers={scheduleTeachers}
      />
    </div>
  )
}

export default function TeachersSearchSheetPage() {
  return (
    <SheetChrome title="Search Teachers" padded={false}>
      <Suspense fallback={<SearchResultsSkeleton />}>
        <ModalSearchContent />
      </Suspense>
    </SheetChrome>
  )
}
