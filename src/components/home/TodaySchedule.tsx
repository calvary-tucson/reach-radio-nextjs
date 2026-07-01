import { connection } from 'next/server'
import { sanityFetch } from '@/lib/sanity/client'
import { scheduleQuery } from '@/lib/sanity/queries'
import { to24h, toMinutes } from '@/lib/utils/time'
import Image from 'next/image'
import { ScheduleItemLink } from '@/components/home/ScheduleItemLink'
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
  photo: string | null
  time: string
  startTime: string
  endTime: string
  isMusic?: boolean
}

function isInFuture(endTime: string): boolean {
  const now = dayjs().tz(TZ)
  const [h, m] = to24h(endTime).split(':').map(Number)
  const nowMinutes = now.hour() * 60 + now.minute()
  return h * 60 + m > nowMinutes
}

export async function TodaySchedule() {
  await connection()
  const day = dayjs().tz(TZ).format('dddd')

  const raw = await sanityFetch<{
    name: string
    slug: string
    title: string
    photo: string | null
    schedule: { day: string; times: { startTime: string; endTime: string }[] }[]
  }[]>(scheduleQuery, { day }, { tags: ['schedule'] })

  const rawSlots: SlotItem[] = []
  for (const t of raw) {
    if (!t.schedule?.[0]?.times) continue
    for (const time of t.schedule[0].times) {
      rawSlots.push({
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

  rawSlots.sort((a, b) => toMinutes(to24h(a.startTime)) - toMinutes(to24h(b.startTime)))

  const seen = new Set<string>()
  const slots = rawSlots
    .filter((s) => {
      const key = `${s.startTime}|${s.endTime}|${s.slug}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .filter((s) => isInFuture(s.endTime))

  if (slots.length === 0) {
    return (
      <div className="flex items-center gap-5 bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-xl p-2 text-white light:text-gray-900">
        <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg flex-shrink-0 overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 scale-110 blur-md"
            style={{ backgroundImage: `url(${MUSIC_IMAGE})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
          <Image
            src={MUSIC_IMAGE}
            alt="Music"
            fill
            className="object-contain z-10"
            sizes="(max-width: 768px) 64px, 80px"
          />
        </div>
        <div>
          <div className="font-bold text-base">Music</div>
          <div className="uppercase text-sm text-white/70 light:text-gray-500">Reach Radio</div>
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
    <div className="flex flex-col gap-y-2 text-white light:text-gray-900">
      {withBreaks.map((item, idx) => {
        const photoSrc = item.photo || MUSIC_IMAGE
        const content = (
          <>
            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg flex-shrink-0 overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 scale-110 blur-md"
                style={{ backgroundImage: `url(${photoSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              />
              <Image
                src={photoSrc}
                alt={item.isMusic ? 'Music' : item.name}
                fill
                className="object-contain z-10"
                sizes="(max-width: 768px) 64px, 80px"
              />
            </div>
            <div>
              <div className="font-bold text-base">{item.title}</div>
              <div className="uppercase text-sm text-white/70 light:text-gray-500">{item.name}</div>
              <div className="text-sm text-white/60 light:text-gray-500">{item.time}</div>
            </div>
          </>
        )

        if (item.isMusic || !item.slug) {
          return (
            <div
              key={`music-${item.startTime}-${item.endTime}`}
              className="schedule-row flex gap-5 bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-xl p-2"
              style={{ '--stagger-i': idx } as React.CSSProperties}
            >
              {content}
            </div>
          )
        }

        return (
          <ScheduleItemLink
            key={`${item.slug}-${item.startTime}`}
            slug={item.slug}
            name={item.name}
            idx={idx}
          >
            {content}
          </ScheduleItemLink>
        )
      })}
    </div>
  )
}
