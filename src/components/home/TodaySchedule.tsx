import { sanityFetch } from '@/lib/sanity/client'
import { scheduleQuery } from '@/lib/sanity/queries'
import type { ScheduleTeacher } from '@/lib/sanity/types'
import Image from 'next/image'
import Link from 'next/link'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

interface Props {
  timezone?: string
}

export async function TodaySchedule({ timezone: tz = 'America/Phoenix' }: Props) {
  const day = dayjs().tz(tz).format('dddd')

  const raw = await sanityFetch<{
    name: string
    slug: string
    title: string
    photo: string
    schedule: { day: string; times: { startTime: string; endTime: string }[] }[]
  }[]>(scheduleQuery, { day }, { tags: ['schedule'] })

  const teachers: ScheduleTeacher[] = raw
    .filter((t) => t.schedule?.[0]?.times?.[0])
    .map((t) => ({
      name: t.name,
      slug: t.slug,
      title: t.title,
      photo: t.photo,
      time: `${t.schedule[0].times[0].startTime} - ${t.schedule[0].times[0].endTime}`,
      startTime: t.schedule[0].times[0].startTime,
      endTime: t.schedule[0].times[0].endTime,
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  if (teachers.length === 0) {
    return <p className="text-white/60 text-sm">No scheduled programs today.</p>
  }

  return (
    <ul className="space-y-2">
      {teachers.map((teacher) => (
        <li key={`${teacher.slug}-${teacher.startTime}`}>
          <Link
            href={`/teachers/${teacher.slug}`}
            className="flex items-center gap-3 p-3 bg-gray-700/30 rounded hover:bg-gray-700/50 transition-colors"
          >
            {teacher.photo && (
              <Image
                src={teacher.photo}
                alt={teacher.name}
                width={48}
                height={48}
                className="rounded-full object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{teacher.name}</p>
              <p className="text-white/60 text-xs truncate">{teacher.title}</p>
            </div>
            <span className="text-white/50 text-xs flex-shrink-0">{teacher.time}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
