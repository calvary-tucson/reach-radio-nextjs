import type { Metadata } from 'next'
import { Suspense } from 'react'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeachersClientView } from '@/components/teachers/TeachersClientView'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { PassiveSearchBar } from '@/components/global/PassiveSearchBar'
import { RecommendedTeachers } from '@/components/teachers/RecommendedTeachers'
import { RecommendedTeachersSkeleton } from '@/components/skeletons/RecommendedTeachersSkeleton'

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

export default async function TeachersPage() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[22px] font-extrabold text-white tracking-tight">Teachers</h1>
        <span className="text-[11px] text-white/35 font-medium">{teachers.length} teachers</span>
      </div>
      <ShowMediaBar />
      <PassiveSearchBar
        href="/teachers/search"
        placeholder="Search teachers..."
        modalTitle="Search Teachers"
        className="mb-4"
      />
      <Suspense fallback={<RecommendedTeachersSkeleton />}>
        <RecommendedTeachers />
      </Suspense>
      <TeachersClientView
        teachers={teachers}
        scheduleTeachers={scheduleTeachers}
      />
    </div>
  )
}
