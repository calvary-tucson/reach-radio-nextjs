import type { Metadata } from 'next'
import { Suspense } from 'react'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery } from '@/lib/sanity/queries'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { SearchBar } from '@/components/teachers/SearchBar'
import { TeacherGridSkeleton } from '@/components/skeletons/TeacherCardSkeleton'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Teachers',
  description: 'Listen to many great bible teachers on Reach Radio Tucson.',
  alternates: { canonical: '/teachers' },
}

async function TeacherGrid() {
  const teachers = await sanityFetch<TeacherSummary[]>(
    teacherListQuery,
    {},
    { tags: ['teachers'] }
  )

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {teachers.map((teacher) => (
        <TeacherCard key={teacher.slug} teacher={teacher} />
      ))}
    </div>
  )
}

export default function TeachersPage() {
  return (
    <div className="px-4 py-6">
      <ShowMediaBar />
      <h1 className="text-white text-2xl font-bold mb-6">Teachers</h1>
      <Suspense fallback={<div className="h-[52px] mb-6" />}>
        <SearchBar />
      </Suspense>
      <Suspense fallback={<TeacherGridSkeleton />}>
        <TeacherGrid />
      </Suspense>
    </div>
  )
}
