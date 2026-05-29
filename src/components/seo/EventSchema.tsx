interface EventItem {
  name: string
  startTime: string
  endTime: string
  day: string
}

interface Props {
  events: EventItem[]
}

export function EventSchema({ events }: Props) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'BroadcastEvent',
        name: event.name,
        description: `${event.day} ${event.startTime}–${event.endTime}`,
        publishedOn: {
          '@type': 'BroadcastService',
          name: 'Reach Radio',
          url: 'https://reach.radio',
        },
        organizer: {
          '@type': 'Organization',
          name: 'Reach Radio',
          url: 'https://reach.radio',
        },
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/<\/script>/gi, '<\\/script>') }}
    />
  )
}
