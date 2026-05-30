import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherDetailQuery, highlightedTeachersQuery } from '@/lib/sanity/queries'
import type { TeacherDetail, TeacherSummary } from '@/lib/sanity/types'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import { TeacherPanelChrome } from '@/components/modals/chrome/TeacherPanelChrome'
import { TeacherDetailContent } from '@/components/teachers/TeacherDetailContent'
import { TeacherDetailSkeleton } from '@/components/skeletons/TeacherDetailSkeleton'

interface Props {
  params: Promise<{ slug: string }>
}

async function ModalTeacherContent({ slug }: { slug: string }) {
  const [teacher, highlightedRaw] = await Promise.all([
    sanityFetch<TeacherDetail | null>(teacherDetailQuery, { slug }, { tags: ['teachers'] }),
    sanityFetch<TeacherSummary[]>(
      highlightedTeachersQuery,
      { slugs: [...HIGHLIGHTED_TEACHER_SLUGS] },
      { tags: ['teachers'] }
    ),
  ])

  if (!teacher) notFound()

  const relatedTeachers = sortByHighlightedOrder(highlightedRaw, HIGHLIGHTED_TEACHER_SLUGS)
    .filter((t) => t.slug !== slug)
    .slice(0, 8)

  return (
    <TeacherDetailContent teacher={teacher} relatedTeachers={relatedTeachers} headingLevel="h2" isOverlay />
  )
}

async function ModalTeacherContentWrapper({ params }: Props) {
  const { slug } = await params
  return <ModalTeacherContent slug={slug} />
}

export default function TeacherDetailModalPage({ params }: Props) {
  return (
    <TeacherPanelChrome>
      <Suspense fallback={<TeacherDetailSkeleton />}>
        <ModalTeacherContentWrapper params={params} />
      </Suspense>
    </TeacherPanelChrome>
  )
}
