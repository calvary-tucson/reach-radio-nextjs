import { Suspense } from 'react'
import { fetchAllTeacherData } from '@/lib/sanity/teachers'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { TeacherSearchBar } from '@/components/teachers/TeacherSearchBar'
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
      <div className="px-4 pt-4 pb-3">
        <TeacherSearchBar />
      </div>
      <Suspense fallback={<SearchResultsSkeleton />}>
        <ModalSearchContent />
      </Suspense>
    </SheetChrome>
  )
}
