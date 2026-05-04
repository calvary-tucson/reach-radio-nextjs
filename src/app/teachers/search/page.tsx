import type { Metadata } from 'next'
import { Suspense } from 'react'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherSearchQuery } from '@/lib/sanity/queries'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { SearchBar } from '@/components/teachers/SearchBar'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Teacher Search' }

interface Props {
  searchParams: Promise<{ q?: string }>
}

async function SearchResults({ searchParams }: { searchParams: Props['searchParams'] }) {
  const { q = '' } = await searchParams
  const query = q.trim()

  const teachers = query.length > 0
    ? await sanityFetch<TeacherSummary[]>(teacherSearchQuery, { query: `*${query}*` })
    : []

  return (
    <>
      {query && (
        <p className="text-white/60 text-sm mb-4">
          {teachers.length} result{teachers.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
        </p>
      )}
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
      <Link href="/teachers" className="text-white/60 text-sm mb-4 block hover:text-white">
        ← All Teachers
      </Link>
      <Suspense>
        <SearchBar />
      </Suspense>
      <Suspense>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
