import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherWithSchedule } from '@/lib/sanity/types'
import { EventSchema } from '@/components/seo/EventSchema'
import Image from 'next/image'
import Link from 'next/link'
import Breadcrumbs from '@/components/global/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Full Schedule',
  description: 'Full programming schedule for Reach Radio 106.7FM / 690AM',
}

export const revalidate = 86400

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function ScheduledListPage() {
  const teachers = await sanityFetch<TeacherWithSchedule[]>(
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
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
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
    <div>
      <Breadcrumbs
        variant="standalone"
        items={[
          { name: 'Home', url: '/' },
          { name: 'Full Schedule', url: '/scheduled-list' },
        ]}
      />
      <EventSchema events={allEvents} />
      <div className="px-4 pb-6">
      <h1 className="text-[22px] md:text-4xl font-extrabold text-white tracking-tight mb-6">Full Schedule</h1>
      {byDay.length === 0 ? (
        <p className="text-sm text-white/45 py-12">No schedule available.</p>
      ) : (
        <div className="space-y-8">
          {byDay.map(({ day, slots }) => (
            <section key={day}>
              <h2 className="text-[10px] md:text-[12px] font-bold uppercase tracking-[0.08em] text-white/55 mb-3">{day}</h2>
              <ul className="space-y-2">
                {slots.map((slot) => (
                  <li key={`${slot.slug}-${slot.startTime}`}>
                    <Link
                      href={`/teachers/${slot.slug}`}
                      className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-colors cursor-pointer"
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
                        <p className="text-white text-sm font-medium truncate">{slot.name}</p>
                        <p className="text-white/80 text-xs truncate">{slot.title}</p>
                      </div>
                      <span className="text-white/50 text-xs flex-shrink-0">
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
    </div>
  )
}
