import { sanityFetch } from '@/lib/sanity/client'
import { siteSettingsQuery, appSettingsQuery, APP_SETTINGS_ID } from '@/lib/sanity/queries'
import { safeJsonLd } from '@/lib/seo'

export async function RadioStationSchema() {
  const [siteSettings, appSettings] = await Promise.all([
    sanityFetch<{
      siteTitle: string
      siteDescription?: string
      siteIconURL?: string
      twitterHandle?: string
      facebookPage?: string
    }>(siteSettingsQuery, {}, { tags: ['siteSettings'] }).catch(() => null),
    sanityFetch<{ radioAudioURL?: string }>(
      appSettingsQuery,
      { id: APP_SETTINGS_ID },
      { tags: ['appSettings'] }
    ).catch(() => null),
  ])

  const streamUrl = appSettings?.radioAudioURL ?? 'https://stream.radiojar.com/g4d600bv6p5tv'

  const sameAs = [
    siteSettings?.facebookPage ?? null,
    siteSettings?.twitterHandle ? `https://twitter.com/${siteSettings.twitterHandle}` : null,
  ].filter((v): v is string => v !== null)

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'RadioStation',
    name: siteSettings?.siteTitle ?? 'Reach Radio',
    description: siteSettings?.siteDescription ?? 'Christian radio station broadcasting Bible teachings and gospel music in Tucson, AZ',
    url: 'https://reach.radio',
    ...(siteSettings?.siteIconURL
      ? { logo: { '@type': 'ImageObject', url: siteSettings.siteIconURL } }
      : {}),
    broadcastDisplayName: siteSettings?.siteTitle ?? 'Reach Radio',
    broadcastFrequency: [
      { '@type': 'BroadcastFrequencySpecification', broadcastFrequency: '106.7', broadcastSignalModulation: 'FM' },
      { '@type': 'BroadcastFrequencySpecification', broadcastFrequency: '690', broadcastSignalModulation: 'AM' },
    ],
    genre: ['Christian', 'Gospel', 'Bible Teaching'],
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
    potentialAction: {
      '@type': 'ListenAction',
      target: streamUrl,
    },
    ...(sameAs.length > 0 ? { sameAs } : {}),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
}
