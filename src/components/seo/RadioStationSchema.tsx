function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/<\/script>/gi, '<\\/script>')
}

export function RadioStationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'RadioStation',
    name: 'Reach Radio',
    url: 'https://reach.radio',
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

