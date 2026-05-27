import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'

export const revalidate = 3600

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function TeachersSearchSheetPage({ searchParams }: Props) {
  const { q = '' } = await searchParams

  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <SheetChrome title="Search Teachers" padded={false}>
      <div className="px-4 pt-4 pb-16">
        <TeacherSearchClient
          teachers={teachers}
          scheduleTeachers={scheduleTeachers}
          initialQuery={q}
        />
      </div>
    </SheetChrome>
  )
}
