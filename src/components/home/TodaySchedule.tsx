import { sanityFetch } from '@/lib/sanity/client'
import { scheduleQuery } from '@/lib/sanity/queries'
import Image from 'next/image'
import Link from 'next/link'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

const MUSIC_IMAGE = 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg'
const TZ = 'America/Phoenix'

interface SlotItem {
  name: string
  slug: string
  title: string
  photo: string
  time: string
  startTime: string
  endTime: string
  isMusic?: boolean
}

function to24h(time: string): string {
  const [timeStr, period] = time.split(' ')
  const [h, m] = timeStr.split(':')
  let hours = parseInt(h, 10)
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return `${hours.toString().padStart(2, '0')}:${m}`
}

function toMinutes(time24: string): number {
  const [h, m] = time24.split(':').map(Number)
  return h * 60 + m
}

function isInFuture(endTime: string): boolean {
  const now = dayjs().tz(TZ)
  const [h, m] = to24h(endTime).split(':').map(Number)
  const nowMinutes = now.hour() * 60 + now.minute()
  return h * 60 + m > nowMinutes
}

export async function TodaySchedule() {
  const day = dayjs().tz(TZ).format('dddd')

  const raw = await sanityFetch<{
    name: string
    slug: string
    title: string
    photo: string
    schedule: { day: string; times: { startTime: string; endTime: string }[] }[]
  }[]>(scheduleQuery, { day }, { tags: ['schedule'] })

  // Expand to individual time slots
  let slots: SlotItem[] = []
  for (const t of raw) {
    if (!t.schedule?.[0]?.times) continue
    for (const time of t.schedule[0].times) {
      slots.push({
        name: t.name,
        slug: t.slug,
        title: t.title || t.name,
        photo: t.photo,
        time: `${time.startTime} - ${time.endTime}`,
        startTime: time.startTime,
        endTime: time.endTime,
      })
    }
  }

  // Sort by start time
  slots.sort((a, b) => toMinutes(to24h(a.startTime)) - toMinutes(to24h(b.startTime)))

  // Deduplicate
  const seen = new Set<string>()
  slots = slots.filter((s) => {
    const key = `${s.startTime}|${s.endTime}|${s.slug}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Filter past shows (keep only those whose end time is still in the future)
  slots = slots.filter((s) => isInFuture(s.endTime))

  if (slots.length === 0) {
    return (
      <div className="flex items-center gap-5 bg-gray-700 p-2 rounded text-white">
        <div className="relative w-16 h-16 md:w-20 md:h-20 rounded flex-shrink-0 overflow-hidden">
          <Image
            src={MUSIC_IMAGE + '?w=420&fm=webp'}
            alt="Music"
            fill
            className="object-cover rounded"
            sizes="(max-width: 768px) 64px, 80px"
          />
        </div>
        <div>
          <div className="font-bold text-base">Music</div>
          <div className="uppercase text-sm text-white/70">Reach Radio</div>
        </div>
      </div>
    )
  }

  // Insert music break filler for gaps >= 5 min
  const withBreaks: SlotItem[] = []
  for (let i = 0; i < slots.length; i++) {
    withBreaks.push(slots[i])
    const next = slots[i + 1]
    if (next) {
      const gap =
        toMinutes(to24h(next.startTime)) - toMinutes(to24h(slots[i].endTime))
      if (gap >= 5) {
        withBreaks.push({
          name: 'Reach Radio',
          slug: '',
          title: 'Music',
          photo: MUSIC_IMAGE,
          time: `${slots[i].endTime} - ${next.startTime}`,
          startTime: slots[i].endTime,
          endTime: next.startTime,
          isMusic: true,
        })
      }
    }
  }

  return (
    <div className="flex flex-col gap-y-2 text-white">
      {withBreaks.map((item, idx) => {
        const content = (
          <>
            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded flex-shrink-0 overflow-hidden">
              <Image
                src={item.photo + '?w=420&fm=webp'}
                alt={item.isMusic ? 'Music' : item.name}
                fill
                className="object-cover rounded"
                sizes="(max-width: 768px) 64px, 80px"
              />
            </div>
            <div>
              <div className="font-bold text-base">{item.title}</div>
              <div className="uppercase text-sm text-white/70">{item.name}</div>
              <div className="text-sm text-white/60">{item.time}</div>
            </div>
          </>
        )

        if (item.isMusic || !item.slug) {
          return (
            <div
              key={`music-${item.startTime}-${item.endTime}`}
              className="flex gap-5 bg-gray-700 p-2 rounded"
            >
              {content}
            </div>
          )
        }

        return (
          <Link
            key={`${item.slug}-${item.startTime}`}
            href={`/teachers/${item.slug}`}
            className="flex items-center justify-between flex-wrap bg-gray-700 p-2 rounded hover:bg-gray-700/80 transition-colors"
          >
            <div className="flex gap-5">{content}</div>
          </Link>
        )
      })}
    </div>
  )
}
