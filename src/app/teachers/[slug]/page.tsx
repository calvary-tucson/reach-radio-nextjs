import { cache } from 'react'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { sanityFetch } from '@/lib/sanity/client'
import {
  teacherDetailQuery,
  teacherSlugsQuery,
  highlightedTeachersQuery,
} from '@/lib/sanity/queries'
import type { TeacherDetail, TeacherSummary } from '@/lib/sanity/types'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import { PersonSchema } from '@/components/seo/PersonSchema'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import Breadcrumbs from '@/components/global/Breadcrumbs'
import { TeacherDetailContent } from '@/components/teachers/TeacherDetailContent'
import { TeacherDetailSkeleton } from '@/components/skeletons/TeacherDetailSkeleton'

interface Props {
  params: Promise<{ slug: string }>
}

const getTeacher = cache(async (slug: string): Promise<TeacherDetail | null> => {
  return sanityFetch<TeacherDetail | null>(
    teacherDetailQuery,
    { slug },
    { tags: ['teachers'] }
  )
})

export async function generateStaticParams() {
  try {
    const slugs = await sanityFetch<{ slug: string }[]>(
      teacherSlugsQuery,
      {},
      { tags: ['teachers'] }
    )
    return slugs.map((t) => ({ slug: t.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const teacher = await getTeacher(slug)
  if (!teacher) return { title: 'Teacher Not Found' }
  const description = `Listen to ${teacher.name}${teacher.title ? ` — ${teacher.title}` : ''} on Reach Radio Tucson 106.7FM / 690AM`
  return {
    title: teacher.name,
    description,
    alternates: { canonical: `/teachers/${slug}` },
    openGraph: { type: 'profile', title: teacher.name, description, url: `/teachers/${slug}` },
    twitter: { card: 'summary_large_image', title: teacher.name, description },
  }
}

async function TeacherContent({ slug }: { slug: string }) {
  const [teacher, highlightedRaw] = await Promise.all([
    getTeacher(slug),
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
    <>
      <BreadcrumbJsonLd items={[
        { name: 'Home', url: '/' },
        { name: 'Teachers', url: '/teachers' },
        { name: teacher.name, url: `/teachers/${teacher.slug}` },
      ]} />
      <PersonSchema
        name={teacher.name}
        jobTitle={teacher.title}
        imageUrl={teacher.photo ?? undefined}
        url={`https://reach.radio/teachers/${teacher.slug}`}
        description={`Listen to ${teacher.name} on Reach Radio Tucson`}
        knowsAbout={['Bible Teaching', 'Christian Ministry', 'Gospel']}
        sameAs={teacher.links?.map((l) => l.url)}
      />
      <Breadcrumbs
        variant="standalone"
        items={[
          { name: 'Teachers', url: '/teachers' },
          { name: teacher.name, url: `/teachers/${teacher.slug}` },
        ]}
      />
      <TeacherDetailContent teacher={teacher} relatedTeachers={relatedTeachers} />
    </>
  )
}

async function TeacherContentWrapper({ params }: Props) {
  const { slug } = await params
  return <TeacherContent slug={slug} />
}

export default function TeacherDetailPage({ params }: Props) {
  return (
    <div className="text-white max-w-screen-xl mx-auto">
      <ShowMediaBar />
      <Suspense fallback={<TeacherDetailSkeleton />}>
        <TeacherContentWrapper params={params} />
      </Suspense>
    </div>
  )
}
