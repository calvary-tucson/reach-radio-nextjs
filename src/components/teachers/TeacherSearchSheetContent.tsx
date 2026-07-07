'use client'

import { useEffect, useState } from 'react'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
import { TeacherSearchBar } from '@/components/teachers/TeacherSearchBar'
import { TeacherSortControl } from '@/components/teachers/TeacherSortControl'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'

interface SearchData {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
}

// Rendered directly by ModalLayout (not gated behind the intercepted route's
// Suspense boundary) so the real search input exists synchronously at tap
// time -- see PassiveSearchBar's flushSync-driven open. Fetches its own
// results client-side instead of via a server-fetched page so nothing here
// blocks the input's own mount/focus.
export function TeacherSearchSheetContent() {
  const [data, setData] = useState<SearchData | null>(null)
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/teachers/search-data')
      .then((res) => {
        if (!res.ok) throw new Error(`search-data fetch failed: ${res.status}`)
        return res.json()
      })
      .then((json: SearchData) => {
        if (cancelled) return
        setData(json)
        setError(false)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => { cancelled = true }
  }, [retryCount])

  return (
    <SheetChrome title="Search Teachers" padded={false} autoFocusInput>
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className="flex-1">
          <TeacherSearchBar />
        </div>
        <TeacherSortControl />
      </div>
      <div className="px-4 pb-16">
        {error ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-white/90 light:text-gray-500">
              Couldn&apos;t load teachers.
            </p>
            <button
              type="button"
              onClick={() => {
                setError(false)
                setRetryCount((n) => n + 1)
              }}
              className="min-h-[44px] px-4 rounded-lg border border-white/10 light:border-gray-300 text-white/90 light:text-gray-700 text-sm cursor-pointer hover:bg-white/10 light:hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <TeacherSearchClient teachers={data.teachers} scheduleTeachers={data.scheduleTeachers} />
        ) : (
          <SearchResultsSkeleton />
        )}
      </div>
    </SheetChrome>
  )
}
