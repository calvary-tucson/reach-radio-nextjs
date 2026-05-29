import { sanityFetch } from '@/lib/sanity/client'
import { siteSettingsQuery } from '@/lib/sanity/queries'
import { safeJsonLd } from '@/lib/seo'

export async function WebSiteSchema() {
  const siteSettings = await sanityFetch<{
    siteTitle: string
    siteDescription?: string
  }>(siteSettingsQuery, {}, { tags: ['siteSettings'] }).catch(() => null)

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteSettings?.siteTitle ?? 'Reach Radio',
    url: 'https://reach.radio',
    description: siteSettings?.siteDescription ?? 'Christian radio station bringing the gospel to Tucson',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://reach.radio/teachers?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
}
