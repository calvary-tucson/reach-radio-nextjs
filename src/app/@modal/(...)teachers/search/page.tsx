import { Suspense } from 'react'
import { fetchAllTeacherData } from '@/lib/sanity/teachers'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { TeacherSearchBar } from '@/components/teachers/TeacherSearchBar'
import { TeacherSortControl } from '@/components/teachers/TeacherSortControl'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'

async function ModalSearchContent() {
  const { teachers, scheduleTeachers } = await fetchAllTeacherData()
  return (
    <div className="px-4 pb-16">
      <TeacherSearchClient
        teachers={teachers}
        scheduleTeachers={scheduleTeachers}
      />
    </div>
  )
}

export default function TeachersSearchSheetPage() {
  return (
    <SheetChrome title="Search Teachers" padded={false} autoFocusInput>
      {/* Row 1: search input + sort/clear */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className="flex-1">
          <Suspense fallback={null}>
            <TeacherSearchBar />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <TeacherSortControl />
        </Suspense>
      </div>
      {/* Row 2+: day chips + results */}
      <Suspense fallback={<SearchResultsSkeleton />}>
        <ModalSearchContent />
      </Suspense>
    </SheetChrome>
  )
}
