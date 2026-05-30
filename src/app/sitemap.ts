import { cacheLife, cacheTag } from 'next/cache'
import type { MetadataRoute } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherSlugsWithDatesQuery } from '@/lib/sanity/queries'

const BASE_URL = 'https://reach.radio'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  'use cache'
  cacheLife('days')
  cacheTag('teachers')

  const slugs = await sanityFetch<{ slug: string; updatedAt: string }[]>(
    teacherSlugsWithDatesQuery,
    {},
    { tags: ['teachers'] }
  ).catch(() => [] as { slug: string; updatedAt: string }[])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}`,                      changeFrequency: 'hourly'  as const, priority: 1.0 },
    { url: `${BASE_URL}/teachers`,             changeFrequency: 'daily'   as const, priority: 0.9 },
    { url: `${BASE_URL}/scheduled-list`,       changeFrequency: 'daily'   as const, priority: 0.7 },
    { url: `${BASE_URL}/about`,                changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${BASE_URL}/donate`,               changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${BASE_URL}/about/privacy-policy`, changeFrequency: 'monthly' as const, priority: 0.3 },
  ]

  const teacherRoutes: MetadataRoute.Sitemap = slugs.map((t) => ({
    url: `${BASE_URL}/teachers/${t.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
    lastModified: t.updatedAt ? new Date(t.updatedAt) : undefined,
  }))

  return [...staticRoutes, ...teacherRoutes]
}
