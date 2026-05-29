import { safeJsonLd } from '@/lib/seo'

interface EventItem {
  name: string
  startTime: string
  endTime: string
  day: string
}

interface Props {
  events: EventItem[]
}

const SCHEMA_DAY: Record<string, string | string[]> = {
  Sunday:    'https://schema.org/Sunday',
  Monday:    'https://schema.org/Monday',
  Tuesday:   'https://schema.org/Tuesday',
  Wednesday: 'https://schema.org/Wednesday',
  Thursday:  'https://schema.org/Thursday',
  Friday:    'https://schema.org/Friday',
  Saturday:  'https://schema.org/Saturday',
  'Mon-Fri': [
    'https://schema.org/Monday',
    'https://schema.org/Tuesday',
    'https://schema.org/Wednesday',
    'https://schema.org/Thursday',
    'https://schema.org/Friday',
  ],
  'Mon-Sun': [
    'https://schema.org/Monday',
    'https://schema.org/Tuesday',
    'https://schema.org/Wednesday',
    'https://schema.org/Thursday',
    'https://schema.org/Friday',
    'https://schema.org/Saturday',
    'https://schema.org/Sunday',
  ],
}

function toISOTime(t: string): string {
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return t
  let h = parseInt(m[1])
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

export function EventSchema({ events }: Props) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.map((event, index) => {
      const byDay = SCHEMA_DAY[event.day]
      return {
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'BroadcastEvent',
          name: event.name,
          description: `${event.day} ${event.startTime}–${event.endTime}`,
          eventSchedule: {
            '@type': 'Schedule',
            ...(byDay ? { byDay } : {}),
            startTime: toISOTime(event.startTime),
            endTime: toISOTime(event.endTime),
          },
          publishedOn: {
            '@type': 'BroadcastService',
            name: 'Reach Radio',
            url: 'https://reach.radio',
          },
          broadcaster: {
            '@type': 'Organization',
            name: 'Reach Radio',
            url: 'https://reach.radio',
          },
        },
      }
    }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
}
