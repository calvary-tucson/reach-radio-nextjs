import type { MetadataRoute } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherSlugsQuery } from '@/lib/sanity/queries'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://reach.radio'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await sanityFetch<{ slug: string }[]>(
    teacherSlugsQuery,
    {},
    { tags: ['teachers'] }
  ).catch(() => [] as { slug: string }[])

  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}`,                      changeFrequency: 'hourly'  as const, priority: 1.0, lastModified: now },
    { url: `${BASE_URL}/teachers`,             changeFrequency: 'daily'   as const, priority: 0.9, lastModified: now },
    { url: `${BASE_URL}/scheduled-list`,       changeFrequency: 'daily'   as const, priority: 0.7, lastModified: now },
    { url: `${BASE_URL}/about`,                changeFrequency: 'monthly' as const, priority: 0.6, lastModified: now },
    { url: `${BASE_URL}/donate`,               changeFrequency: 'monthly' as const, priority: 0.6, lastModified: now },
    { url: `${BASE_URL}/sleep-timer`,          changeFrequency: 'monthly' as const, priority: 0.3, lastModified: now },
    { url: `${BASE_URL}/about/privacy-policy`, changeFrequency: 'monthly' as const, priority: 0.3, lastModified: now },
  ]

  const teacherRoutes: MetadataRoute.Sitemap = slugs.map((t) => ({
    url: `${BASE_URL}/teachers/${t.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
    lastModified: now,
  }))

  return [...staticRoutes, ...teacherRoutes]
}
