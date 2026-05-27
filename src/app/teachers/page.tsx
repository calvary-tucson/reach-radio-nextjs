import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeachersClientView } from '@/components/teachers/TeachersClientView'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { FeaturedTeachers } from '@/components/home/FeaturedTeachers'
import type { SortOption } from '@/lib/teachers/filter'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Teachers',
  description: 'Listen to many great bible teachers on Reach Radio Tucson.',
  alternates: { canonical: '/teachers' },
  openGraph: {
    title: 'Teachers | Reach Radio',
    description: 'Listen to many great bible teachers on Reach Radio Tucson.',
    url: '/teachers',
  },
  twitter: {
    title: 'Teachers | Reach Radio',
    description: 'Listen to many great bible teachers on Reach Radio Tucson.',
  },
}

interface Props {
  searchParams: Promise<{ q?: string; sort?: string; days?: string }>
}

export default async function TeachersPage({ searchParams }: Props) {
  const { q = '', sort, days } = await searchParams

  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  const initialDays = days ? days.split(',').filter(Boolean) : []
  const validSortOptions: SortOption[] = ['name-asc', 'name-desc', 'most-on-air']
  const initialSort = validSortOptions.includes(sort as SortOption)
    ? (sort as SortOption)
    : undefined

  return (
    <div className="px-4 py-6">
      <ShowMediaBar />
      <FeaturedTeachers showSeeAll={false} />
      <TeachersClientView
        teachers={teachers}
        scheduleTeachers={scheduleTeachers}
        initialQuery={q}
        initialSort={initialSort}
        initialDays={initialDays}
      />
    </div>
  )
}
