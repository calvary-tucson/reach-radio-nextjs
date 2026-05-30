import { safeJsonLd } from '@/lib/seo'

interface Props {
  name: string
  jobTitle: string | null
  imageUrl?: string
  url: string
  description?: string
  knowsAbout?: string[]
  sameAs?: string[]
}

export function PersonSchema({ name, jobTitle, imageUrl, url, description, knowsAbout, sameAs }: Props) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    ...(jobTitle ? { jobTitle } : {}),
    ...(description ? { description } : {}),
    ...(imageUrl ? { image: imageUrl } : {}),
    url,
    worksFor: {
      '@type': 'Organization',
      name: 'Reach Radio',
      url: 'https://reach.radio',
    },
    ...(knowsAbout && knowsAbout.length > 0 ? { knowsAbout } : {}),
    ...(sameAs && sameAs.length > 0 ? { sameAs } : {}),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
}
