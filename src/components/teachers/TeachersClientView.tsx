'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import { SearchInput } from '@/components/global/SearchInput'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { filterTeachers } from '@/lib/teachers/filter'
import type { TeacherSummary } from '@/lib/sanity/types'

interface TeachersClientViewProps {
  teachers: TeacherSummary[]
  initialQuery?: string
}

export function TeachersClientView({ teachers, initialQuery = '' }: TeachersClientViewProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const debouncedQuery = useDebounce(query, 200)
  const hasMounted = useRef(false)

  const filtered = useMemo(
    () => filterTeachers(teachers, debouncedQuery),
    [teachers, debouncedQuery]
  )

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    const trimmed = debouncedQuery.trim()
    router.replace(
      trimmed ? `/teachers?q=${encodeURIComponent(trimmed)}` : '/teachers',
      { scroll: false }
    )
  }, [debouncedQuery, router])

  function handleChange(value: string) {
    setQuery(value)
  }

  const isFiltered = debouncedQuery.trim().length > 0
  const countLabel = isFiltered
    ? `${filtered.length} of ${teachers.length} shown`
    : `${teachers.length} teachers`

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-white text-2xl font-bold">Teachers</h1>
        <span
          className="text-white/50 text-sm"
          aria-live="polite"
          aria-atomic="true"
        >
          {countLabel}
        </span>
      </div>

      <SearchInput
        value={query}
        onChange={handleChange}
        onClear={() => handleChange('')}
        placeholder="Search teachers..."
        aria-label="Search teachers"
        className="mb-6"
      />

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((teacher, index) => (
            <TeacherCard key={teacher.slug} teacher={teacher} index={index} />
          ))}
        </div>
      ) : isFiltered ? (
        <div className="text-white/60 mt-4">
          <p>No teachers found for &ldquo;{debouncedQuery}&rdquo;.</p>
          <button
            type="button"
            onClick={() => handleChange('')}
            className="mt-2 text-sm text-white/80 underline hover:text-white"
          >
            Clear search
          </button>
        </div>
      ) : null}
    </>
  )
}
