import { cache, ViewTransition } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { sanityFetch } from '@/lib/sanity/client'
import {
  teacherDetailQuery,
  teacherSlugsQuery,
  highlightedTeachersQuery,
} from '@/lib/sanity/queries'
import type { TeacherDetail, TeacherSummary } from '@/lib/sanity/types'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { PersonSchema } from '@/components/seo/PersonSchema'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherInfoChip } from '@/components/teachers/primitives/TeacherInfoChip'

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
    openGraph: { type: 'profile', title: teacher.name, description, url: `/teachers/${slug}` },
    twitter: { card: 'summary_large_image', title: teacher.name, description },
  }
}

const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function TeacherDetailPage({ params }: Props) {
  const { slug } = await params

  const [teacher, highlightedRaw] = await Promise.all([
    getTeacher(slug),
    sanityFetch<TeacherSummary[]>(
      highlightedTeachersQuery,
      { slugs: [...HIGHLIGHTED_TEACHER_SLUGS] },
      { tags: ['teachers'] }
    ),
  ])

  if (!teacher) notFound()

  const sortedSchedule = [...(teacher.schedule ?? [])].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  const weeklyMinutes = computeWeeklyMinutes(teacher.schedule ?? [])
  const hoursPerWeek = weeklyMinutes > 0 ? Math.round(weeklyMinutes / 60) : 0
  const daysOnAir = (teacher.schedule ?? []).length

  const relatedTeachers = sortByHighlightedOrder(highlightedRaw, HIGHLIGHTED_TEACHER_SLUGS)
    .filter((t) => t.slug !== slug)
    .slice(0, 8)

  const primaryLink = teacher.links?.[0]
  const otherLinks = teacher.links?.slice(1) ?? []

  return (
    <div className="text-white max-w-screen-xl mx-auto">
      <ShowMediaBar />

      <PersonSchema
        name={teacher.name}
        jobTitle={teacher.title}
        imageUrl={teacher.photo ?? undefined}
        url={`https://reach.radio/teachers/${teacher.slug}`}
        description={`Listen to ${teacher.name} on Reach Radio Tucson`}
        knowsAbout={['Bible Teaching', 'Christian Ministry', 'Gospel']}
        sameAs={teacher.links?.map((l) => l.url)}
      />

      {/* Back button */}
      <div className="px-4 md:px-8 pt-[14px]">
        <Link
          href="/teachers"
          className="flex items-center gap-[5px] text-[#84b84f] text-sm md:text-base font-medium w-fit cursor-pointer"
        >
          <span className="text-[17px] md:text-xl leading-none">&#8249;</span>
          <span>Teachers</span>
        </Link>
      </div>

      {/* Banner */}
      <div className="relative w-full h-[100px] md:h-[180px] mt-3 bg-gradient-to-br from-[#1e3a0a] to-[#0a1305] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(60deg, rgba(132,184,79,0.04) 0px, rgba(132,184,79,0.04) 2px, transparent 2px, transparent 14px)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 30% 50%, rgba(132,184,79,0.12) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Two-column layout at md */}
      <div className="md:flex md:gap-8 md:px-8 md:items-start">

        {/* LEFT SIDEBAR */}
        <div className="md:w-72 md:flex-shrink-0">
          {/* Avatar overlap row */}
          <div className="flex items-end justify-between px-4 md:px-0 mt-[-64px] md:mt-[-72px] mb-3">
            <ViewTransition name={`teacher-${teacher.slug}`}>
              <TeacherAvatar
                name={teacher.name}
                photo={teacher.photo}
                lqip={teacher.lqip}
                size="2xl"
                shape="circle"
                ring
                sizes="128px"
              />
            </ViewTransition>
            {primaryLink && (
              <a
                href={primaryLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="md:hidden bg-[#84b84f] rounded-full px-4 py-2 text-xs font-bold text-[#0a1305] cursor-pointer hover:bg-[#96cc5e] transition-colors"
              >
                {primaryLink.title} &#8599;
              </a>
            )}
          </div>

          {/* Name + title */}
          <div className="px-4 md:px-0 mb-[10px]">
            <h1 className="text-[19px] md:text-3xl font-extrabold tracking-tight">{teacher.name}</h1>
            {(teacher.title || teacher.subtitle) && (
              <p className="text-sm text-white/50 mt-[3px] font-medium">
                {teacher.title}{teacher.subtitle ? ` · ${teacher.subtitle}` : ''}
              </p>
            )}
          </div>

          {/* Info chips */}
          {(hoursPerWeek > 0 || daysOnAir > 0) && (
            <div className="flex flex-wrap gap-[7px] px-4 md:px-0 mb-3">
              {hoursPerWeek > 0 && (
                <TeacherInfoChip icon="📻" label={`${hoursPerWeek} hrs/wk`} variant="accent" />
              )}
              {daysOnAir > 0 && (
                <TeacherInfoChip label={`${daysOnAir} day${daysOnAir !== 1 ? 's' : ''}`} variant="accent" />
              )}
            </div>
          )}

          {/* Primary link — desktop only (mobile version is in avatar row above) */}
          {primaryLink && (
            <div className="hidden md:block px-0 mb-3">
              <a
                href={primaryLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-[#84b84f] rounded-full px-5 py-2 text-sm font-bold text-[#0a1305] cursor-pointer hover:bg-[#96cc5e] transition-colors"
              >
                {primaryLink.title} &#8599;
              </a>
            </div>
          )}

          {/* Other external links */}
          {otherLinks.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 md:px-0 mb-4">
              {otherLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/10 border border-white/20 rounded-full px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
                >
                  {link.title}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT MAIN */}
        <div className="md:flex-1 md:min-w-0 md:pt-4">
          {sortedSchedule.length > 0 && (
            <>
              <div className="h-px bg-white/6 mx-4 md:hidden mb-3" />
              <div className="px-4 md:px-0 mb-4">
                <p className="text-xs md:text-sm font-bold uppercase tracking-[0.1em] text-white/35 mb-[10px]">
                  On Air This Week
                </p>
                <div className="space-y-[8px] md:space-y-3">
                  {sortedSchedule.map((day) => (
                    <div key={day.day}>
                      <p className="text-sm font-bold text-white/60 mb-[5px]">{day.day}</p>
                      {day.times.map((t) => (
                        <div
                          key={`${t.startTime}-${t.endTime}`}
                          className="border-l-[3px] border-[#84b84f] bg-[rgba(132,184,79,0.08)] rounded-r-[8px] py-1.5 px-2.5 text-xs md:text-sm text-white/55 mb-[3px]"
                        >
                          {t.startTime} &ndash; {t.endTime}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Also on Reach Radio — full width, below columns */}
      {relatedTeachers.length > 0 && (
        <>
          <div className="h-px bg-white/6 mx-4 md:mx-8 mb-3" />
          <div className="pb-6 md:pb-10">
            <p className="text-xs md:text-sm font-bold uppercase tracking-[0.1em] text-white/35 px-4 md:px-8 mb-3">
              Also on Reach Radio
            </p>
            <div className="flex gap-[10px] md:gap-4 overflow-x-auto px-4 md:px-8 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {relatedTeachers.map((t) => (
                <Link
                  key={t.slug}
                  href={`/teachers/${t.slug}`}
                  className="flex flex-col items-center gap-[4px] md:gap-2 flex-shrink-0 w-[56px] md:w-[60px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded cursor-pointer"
                  aria-label={t.name}
                >
                  <TeacherAvatar
                    name={t.name}
                    photo={t.photo}
                    lqip={t.lqip}
                    size="sm"
                    shape="circle"
                    sizes="38px"
                  />
                  <span className="text-[10px] text-white/40 text-center line-clamp-2 leading-tight">
                    {t.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
