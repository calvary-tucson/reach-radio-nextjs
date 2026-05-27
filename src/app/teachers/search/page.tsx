import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Search Teachers',
  robots: { index: false },
}

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function TeachersSearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams

  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <TeacherSearchClient
      teachers={teachers}
      scheduleTeachers={scheduleTeachers}
      initialQuery={q}
    />
  )
}
