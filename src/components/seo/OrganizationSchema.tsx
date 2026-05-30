import { safeJsonLd } from '@/lib/seo'

interface OrganizationSchemaProps {
  name: string
  alternateName?: string
  description?: string
  logoUrl?: string
  facebookUrl?: string
  twitterHandle?: string
}

export function OrganizationSchema({
  name,
  alternateName,
  description,
  logoUrl,
  facebookUrl,
  twitterHandle,
}: OrganizationSchemaProps) {
  const sameAs = [
    facebookUrl,
    twitterHandle ? `https://twitter.com/${twitterHandle}` : null,
  ].filter(Boolean)

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    ...(alternateName && { alternateName }),
    description: description ?? 'Christian radio station bringing the gospel to Tucson',
    url: 'https://reach.radio',
    ...(logoUrl && { logo: { '@type': 'ImageObject', url: logoUrl } }),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      url: 'https://reach.radio/about',
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Tucson',
      addressRegion: 'AZ',
      addressCountry: 'US',
    },
    foundingDate: '2016-02-01',
    ...(sameAs.length > 0 && { sameAs }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
}
