import { notFound } from 'next/navigation'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherDetailQuery, highlightedTeachersQuery } from '@/lib/sanity/queries'
import type { TeacherDetail, TeacherSummary } from '@/lib/sanity/types'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import { TeacherPanelChrome } from '@/components/modals/chrome/TeacherPanelChrome'
import { TeacherDetailContent } from '@/components/teachers/TeacherDetailContent'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function TeacherDetailModalPage({ params }: Props) {
  const { slug } = await params

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
    <TeacherPanelChrome>
      <TeacherDetailContent teacher={teacher} relatedTeachers={relatedTeachers} headingLevel="h2" />
    </TeacherPanelChrome>
  )
}
