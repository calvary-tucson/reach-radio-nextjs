import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery } from '@/lib/sanity/queries'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeachersClientView } from '@/components/teachers/TeachersClientView'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'

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
  searchParams: Promise<{ q?: string }>
}

export default async function TeachersPage({ searchParams }: Props) {
  const { q = '' } = await searchParams

  const teachers = await sanityFetch<TeacherSummary[]>(
    teacherListQuery,
    {},
    { tags: ['teachers'] }
  )

  return (
    <div className="px-4 py-6">
      <ShowMediaBar />
      <TeachersClientView teachers={teachers} initialQuery={q} />
    </div>
  )
}
