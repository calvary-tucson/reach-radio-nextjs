import { Suspense } from 'react'
import type { Metadata } from 'next'
import { sanityFetchHourly } from '@/lib/sanity/client'
import { fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherWithSchedule } from '@/lib/sanity/types'
import { EventSchema } from '@/components/seo/EventSchema'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { FALLBACK_OG_IMAGE } from '@/lib/constants'
import Image from 'next/image'
import Link from 'next/link'
import Breadcrumbs from '@/components/global/Breadcrumbs'
import { ScheduleSkeleton } from '@/components/skeletons/ScheduleSkeleton'


export const metadata: Metadata = {
  title: 'Full Schedule',
  description: 'Full programming schedule for Reach Radio 106.7FM / 690AM',
  alternates: { canonical: '/scheduled-list' },
  openGraph: {
    title: 'Full Schedule — Reach Radio',
    description: 'Full programming schedule for Reach Radio 106.7FM / 690AM in Tucson, AZ',
    url: '/scheduled-list',
    images: [{ url: FALLBACK_OG_IMAGE, width: 1024, height: 1024, alt: 'Reach Radio Full Schedule' }],
  },
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const BREADCRUMB_ITEMS = [
  { name: 'Home', url: '/' },
  { name: 'Full Schedule', url: '/scheduled-list' },
]

function timeToMinutes(t: string): number {
  const [time, period] = t.split(' ')
  const [h, m] = time.split(':').map(Number)
  return (h % 12 + (period === 'PM' ? 12 : 0)) * 60 + m
}

async function ScheduleContent() {
  const teachers = await sanityFetchHourly<TeacherWithSchedule[]>(
    fullScheduleQuery,
    {},
    { tags: ['schedule'] }
  )

  const byDay = DAYS.map((day) => ({
    day,
    slots: teachers
      .flatMap((t) =>
        (t.schedule ?? [])
          .filter((s) => s.day === day)
          .flatMap((s) =>
            s.times.map((time) => ({
              name: t.name,
              slug: t.slug,
              title: t.title,
              photo: t.photo,
              startTime: time.startTime,
              endTime: time.endTime,
            }))
          )
      )
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
  })).filter((d) => d.slots.length > 0)

  const allEvents = byDay.flatMap(({ day, slots }) =>
    slots.map((slot) => ({
      name: slot.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      day,
    }))
  )

  return (
    <>
      <EventSchema events={allEvents} />
      <div className="px-4 pt-6 pb-6">
      <h1 className="text-[22px] md:text-4xl font-extrabold text-white light:text-gray-900 tracking-tight mb-6">Full Schedule</h1>
      {byDay.length === 0 ? (
        <p className="text-sm text-white/45 light:text-gray-400 py-12">No schedule available.</p>
      ) : (
        <div className="space-y-8">
          {byDay.map(({ day, slots }) => (
            <section key={day}>
              <h2 className="text-[10px] md:text-[12px] font-bold uppercase tracking-[0.08em] text-white/80 light:text-gray-600 mb-3">{day}</h2>
              <ul className="space-y-2">
                {slots.map((slot) => (
                  <li key={`${slot.slug}-${slot.startTime}`}>
                    <Link
                      href={`/teachers/${slot.slug}`}
                      className="flex items-center gap-3 p-3 bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-xl hover:bg-white/10 light:hover:bg-gray-100 hover:border-white/20 light:hover:border-gray-300 transition-colors cursor-pointer"
                    >
                      {slot.photo && (
                        <Image
                          src={slot.photo}
                          alt={slot.name}
                          width={40}
                          height={40}
                          style={{ width: 40, height: 40 }}
                          className="rounded-full object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white light:text-gray-900 text-sm font-medium truncate">{slot.name}</p>
                        {slot.title && <p className="text-white/80 light:text-gray-600 text-xs truncate">{slot.title}</p>}
                      </div>
                      <span className="text-white/50 light:text-gray-400 text-xs flex-shrink-0">
                        {slot.startTime} – {slot.endTime}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      </div>
    </>
  )
}

export default function ScheduledListPage() {
  return (
    <div>
      <Breadcrumbs variant="standalone" items={BREADCRUMB_ITEMS} />
      <BreadcrumbJsonLd items={BREADCRUMB_ITEMS} />
      <Suspense fallback={<ScheduleSkeleton />}>
        <ScheduleContent />
      </Suspense>
    </div>
  )
}
