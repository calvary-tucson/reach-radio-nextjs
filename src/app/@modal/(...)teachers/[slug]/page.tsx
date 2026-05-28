import { notFound } from 'next/navigation'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherDetailQuery } from '@/lib/sanity/queries'
import type { TeacherDetail } from '@/lib/sanity/types'
import { TeacherPanelChrome } from '@/components/modals/chrome/TeacherPanelChrome'
import { TeacherModalContent } from '@/components/teachers/TeacherModalContent'

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

export default async function TeacherDetailModalPage({ params }: Props) {
  const { slug } = await params
  const teacher = await sanityFetch<TeacherDetail | null>(
    teacherDetailQuery,
    { slug },
    { tags: ['teachers'] }
  )

  if (!teacher) notFound()

  return (
    <TeacherPanelChrome>
      <TeacherModalContent teacher={teacher} />
    </TeacherPanelChrome>
  )
}
