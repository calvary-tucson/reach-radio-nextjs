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

  useEffect(() => {
    let cancelled = false
    fetch('/api/teachers/search-data')
      .then((res) => res.json())
      .then((json: SearchData) => { if (!cancelled) setData(json) })
    return () => { cancelled = true }
  }, [])

  return (
    <SheetChrome title="Search Teachers" padded={false} autoFocusInput>
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className="flex-1">
          <TeacherSearchBar />
        </div>
        <TeacherSortControl />
      </div>
      <div className="px-4 pb-16">
        {data ? (
          <TeacherSearchClient teachers={data.teachers} scheduleTeachers={data.scheduleTeachers} />
        ) : (
          <SearchResultsSkeleton />
        )}
      </div>
    </SheetChrome>
  )
}
