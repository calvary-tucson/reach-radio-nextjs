import type { MetadataRoute } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherSlugsQuery } from '@/lib/sanity/queries'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://reach-radio.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await sanityFetch<{ slug: string }[]>(
    teacherSlugsQuery,
    {},
    { tags: ['teachers'] }
  )

  const staticRoutes: MetadataRoute.Sitemap = [
    '', '/about', '/about/privacy-policy', '/donate', '/teachers', '/scheduled-list', '/sleep-timer',
  ].map((route) => ({ url: `${BASE_URL}${route}` }))

  const teacherRoutes: MetadataRoute.Sitemap = slugs.map((t) => ({
    url: `${BASE_URL}/teachers/${t.slug}`,
  }))

  return [...staticRoutes, ...teacherRoutes]
}
