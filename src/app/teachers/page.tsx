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

const OG_IMAGE = 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg'

export const metadata: Metadata = {
  title: 'Teachers',
  description: "Hear nationally-known Bible teachers on Reach Radio — Tucson's Christian station at 106.7FM and 690AM.",
  alternates: { canonical: '/teachers' },
  openGraph: {
    title: 'Teachers | Reach Radio',
    description: "Hear nationally-known Bible teachers on Reach Radio — Tucson's Christian station at 106.7FM and 690AM.",
    url: '/teachers',
    images: [{ url: OG_IMAGE, width: 1024, height: 1024, alt: 'Reach Radio Teachers' }],
  },
  twitter: {
    title: 'Teachers | Reach Radio',
    description: "Hear nationally-known Bible teachers on Reach Radio — Tucson's Christian station at 106.7FM and 690AM.",
    images: [OG_IMAGE],
  },
}

export default async function TeachersPage() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <div className="px-4 md:px-8 py-6 max-w-screen-xl mx-auto">
      <h1 className="text-[22px] md:text-4xl font-extrabold text-white light:text-gray-900 tracking-tight mb-3">Teachers</h1>
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
