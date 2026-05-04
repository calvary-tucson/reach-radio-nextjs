import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { fullScheduleQuery } from '@/lib/sanity/queries'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Full Schedule',
  description: 'Full programming schedule for Reach Radio 106.7FM / 690AM',
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface RawTeacher {
  name: string
  slug: string
  title: string
  photo: string
  schedule: { day: string; times: { startTime: string; endTime: string }[] }[]
}

export default async function ScheduledListPage() {
  const teachers = await sanityFetch<RawTeacher[]>(
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

  return (
    <div className="px-4 py-6">
      <h1 className="text-white text-2xl font-bold mb-6">Full Schedule</h1>
      <div className="space-y-8">
        {byDay.map(({ day, slots }) => (
          <section key={day}>
            <h2 className="text-white font-semibold text-lg mb-3">{day}</h2>
            <ul className="space-y-2">
              {slots.map((slot, i) => (
                <li key={i}>
                  <Link
                    href={`/teachers/${slot.slug}`}
                    className="flex items-center gap-3 p-3 bg-gray-700/30 rounded hover:bg-gray-700/50 transition-colors"
                  >
                    {slot.photo && (
                      <Image
                        src={slot.photo}
                        alt={slot.name}
                        width={40}
                        height={40}
                        className="rounded-full object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{slot.name}</p>
                      <p className="text-white/60 text-xs truncate">{slot.title}</p>
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
    </div>
  )
}
