function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/<\/script>/gi, '<\\/script>')
}

export function RadioStationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'RadioStation',
    name: 'Reach Radio',
    url: 'https://reach-radio.com',
    broadcastFrequency: [
      { '@type': 'BroadcastFrequencySpecification', broadcastFrequency: '106.7', broadcastSignalModulation: 'FM' },
      { '@type': 'BroadcastFrequencySpecification', broadcastFrequency: '690', broadcastSignalModulation: 'AM' },
    ],
    areaServed: {
      '@type': 'City',
      name: 'Tucson',
      containedInPlace: { '@type': 'State', name: 'Arizona' },
    },
    broadcaster: {
      '@type': 'Organization',
      name: 'Calvary Chapel of Tucson, Inc.',
      url: 'https://calvarytucson.com',
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
}

interface PersonSchemaProps {
  name: string
  jobTitle: string
  imageUrl?: string
  url: string
}

export function PersonSchema({ name, jobTitle, imageUrl, url }: PersonSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    jobTitle,
    ...(imageUrl ? { image: imageUrl } : {}),
    url,
    worksFor: {
      '@type': 'Organization',
      name: 'Reach Radio',
      url: 'https://reach-radio.com',
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
}

interface EventItem {
  name: string
  startTime: string
  endTime: string
  day: string
}

interface EventSchemaProps {
  events: EventItem[]
}

export function EventSchema({ events }: EventSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Event',
        name: event.name,
        description: `${event.day} ${event.startTime}–${event.endTime}`,
        organizer: {
          '@type': 'Organization',
          name: 'Reach Radio',
          url: 'https://reach-radio.com',
        },
      },
    })),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
}
