import { cache, ViewTransition } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherDetailQuery, teacherSlugsQuery } from '@/lib/sanity/queries'
import type { TeacherDetail } from '@/lib/sanity/types'
import { PersonSchema } from '@/components/seo/PersonSchema'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import Breadcrumbs from '@/components/global/Breadcrumbs'

export const revalidate = 3600

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
    openGraph: {
      type: 'profile',
      title: teacher.name,
      description,
      url: `/teachers/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: teacher.name,
      description,
    },
  }
}

export default async function TeacherDetailPage({ params }: Props) {
  const { slug } = await params
  const teacher = await getTeacher(slug)

  if (!teacher) notFound()

  const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const sortedSchedule = [...(teacher.schedule ?? [])].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  return (
    <div>
      <ShowMediaBar />
      <Breadcrumbs
        variant="standalone"
        items={[
          { name: 'Teachers', url: '/teachers' },
          { name: teacher.name, url: `/teachers/${teacher.slug}` },
        ]}
      />

      <PersonSchema
        name={teacher.name}
        jobTitle={teacher.title}
        imageUrl={teacher.photo ?? undefined}
        url={`https://reach.radio/teachers/${teacher.slug}`}
        description={`Listen to ${teacher.name} on Reach Radio Tucson`}
        knowsAbout={['Bible Teaching', 'Christian Ministry', 'Gospel']}
        sameAs={teacher.links?.map((l) => l.url)}
      />

      <div className="grid md:grid-cols-2 grid-cols-1 gap-x-16 gap-y-5 text-white">
        {teacher.photo && (
          <ViewTransition name={`teacher-${teacher.slug}`}>
            <div className="relative aspect-square md:rounded-br-3xl overflow-hidden">
              <Image
                src={teacher.photo}
                alt={teacher.name}
                fill
                className="object-cover"
                placeholder={teacher.lqip ? 'blur' : 'empty'}
                blurDataURL={teacher.lqip}
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            </div>
          </ViewTransition>
        )}

        <div className="md:mt-5 md:px-0 md:pr-3 px-3">
          <h1 className="text-4xl">{teacher.name}</h1>
          {teacher.title && (
            <p className="uppercase font-bold mt-1 text-white/80">
              {teacher.title}{teacher.subtitle ? `: ${teacher.subtitle}` : ''}
            </p>
          )}

          {teacher.links && teacher.links.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {teacher.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[var(--color-brand-green)] text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {link.title}
                </a>
              ))}
            </div>
          )}

          {sortedSchedule.length > 0 ? (
            <div className="mt-6">
              <h2 className="text-2xl mb-3">Schedule</h2>
              {sortedSchedule.map((day) => (
                <div key={day.day} className="mb-5">
                  <h3 className="font-bold text-lg mb-2">{day.day}</h3>
                  <ul className="flex flex-col gap-2">
                    {day.times.map((t) => (
                      <li key={`${t.startTime}-${t.endTime}`} className="bg-gray-700 p-3 rounded text-sm">
                        {t.startTime} – {t.endTime}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-white/50 text-sm">No schedule available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
