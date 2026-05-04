import { ViewTransition } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherDetailQuery, teacherSlugsQuery } from '@/lib/sanity/queries'
import type { TeacherDetail } from '@/lib/sanity/types'
import { PersonSchema } from '@/components/seo/PersonSchema'

interface Props {
  params: Promise<{ slug: string }>
}

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
  const teacher = await sanityFetch<TeacherDetail | null>(
    teacherDetailQuery,
    { slug },
    { tags: ['teachers'] }
  )
  if (!teacher) return { title: 'Teacher Not Found' }
  return {
    title: teacher.name,
    description: `${teacher.title} on Reach Radio Tucson`,
    openGraph: {
      images: teacher.photo ? [{ url: teacher.photo }] : [],
    },
  }
}

export default async function TeacherDetailPage({ params }: Props) {
  const { slug } = await params
  const teacher = await sanityFetch<TeacherDetail | null>(
    teacherDetailQuery,
    { slug },
    { tags: ['teachers'] }
  )

  if (!teacher) notFound()

  const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const sortedSchedule = [...(teacher.schedule ?? [])].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/teachers" transitionTypes={['nav-back']} className="text-white/60 text-sm mb-6 block hover:text-white">
        ← Teachers
      </Link>

      <PersonSchema
        name={teacher.name}
        jobTitle={teacher.title}
        imageUrl={teacher.photo}
        url={`https://reach-radio.com/teachers/${teacher.slug}`}
      />

      {teacher.photo && (
        <ViewTransition name={`teacher-${teacher.slug}`}>
          <Image
            src={teacher.photo}
            alt={teacher.name}
            width={420}
            height={420}
            className="w-full max-w-sm mx-auto rounded object-cover mb-6"
            priority
          />
        </ViewTransition>
      )}

      <h1 className="text-white text-3xl font-bold">{teacher.name}</h1>
      <p className="text-white/70 mt-1">
        {teacher.title}{teacher.subtitle ? `: ${teacher.subtitle}` : ''}
      </p>

      {sortedSchedule.length > 0 && (
        <section className="mt-6">
          <h2 className="text-white font-semibold mb-3">Schedule</h2>
          <ul className="space-y-1">
            {sortedSchedule.map((day) =>
              day.times.map((t, i) => (
                <li key={`${day.day}-${i}`} className="text-white/70 text-sm">
                  <span className="font-medium text-white">{day.day}</span> — {t.startTime} – {t.endTime}
                </li>
              ))
            )}
          </ul>
        </section>
      )}

      {teacher.links && teacher.links.length > 0 && (
        <section className="mt-6">
          <h2 className="text-white font-semibold mb-3">Links</h2>
          <ul className="space-y-2">
            {teacher.links.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-brand-green)] hover:underline text-sm"
                >
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
