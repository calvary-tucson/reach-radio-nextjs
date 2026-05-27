import type { Metadata } from 'next'
import Link from 'next/link'
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
    <div className="px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/teachers"
          className="text-white/60 hover:text-white transition-colors cursor-pointer text-sm"
        >
          ← Teachers
        </Link>
        <h1 className="text-white text-2xl font-bold">Search</h1>
      </div>
      <TeacherSearchClient
        teachers={teachers}
        scheduleTeachers={scheduleTeachers}
        initialQuery={q}
      />
    </div>
  )
}
