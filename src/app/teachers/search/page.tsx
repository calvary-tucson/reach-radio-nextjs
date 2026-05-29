import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'

export const metadata: Metadata = {
  title: 'Search Teachers',
  robots: { index: false },
}

export default async function TeachersSearchPage() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <div className="px-4 py-6 sm:px-6">
      <TeacherSearchClient
        teachers={teachers}
        scheduleTeachers={scheduleTeachers}
      />
    </div>
  )
}
