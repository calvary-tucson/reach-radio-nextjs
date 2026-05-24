import type { Metadata } from 'next'
import { Suspense } from 'react'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherSearchQuery } from '@/lib/sanity/queries'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { TeacherGridSkeleton } from '@/components/skeletons/TeacherCardSkeleton'
import { SearchBar } from '@/components/teachers/SearchBar'
import Link from 'next/link'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Teacher Search',
  description: 'Search for Bible teachers on Reach Radio Tucson.',
  robots: { index: false },
}

interface Props {
  searchParams: Promise<{ q?: string }>
}

async function SearchResults({ searchParams }: { searchParams: Props['searchParams'] }) {
  const { q = '' } = await searchParams
  const query = q.trim().slice(0, 100)

  const teachers = query.length > 0
    ? await sanityFetch<TeacherSummary[]>(teacherSearchQuery, { query: `*${query}*` })
    : []

  return (
    <>
      <div aria-live="polite" aria-atomic="true">
        {query && (
          <p className="text-white/60 text-sm mb-4">
            {teachers.length} result{teachers.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>
      {teachers.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {teachers.map((teacher) => (
            <TeacherCard key={teacher.slug} teacher={teacher} />
          ))}
        </div>
      ) : query ? (
        <p className="text-white/60">No teachers found.</p>
      ) : null}
    </>
  )
}

export default function TeacherSearchPage({ searchParams }: Props) {
  return (
    <div className="px-4 py-6">
      <ShowMediaBar />
<Link href="/teachers" aria-label="All Teachers" className="text-white/60 text-sm mb-4 block hover:text-white">
        <span aria-hidden="true">←</span> All Teachers
      </Link>
      <SearchBar />
      <Suspense fallback={<TeacherGridSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
