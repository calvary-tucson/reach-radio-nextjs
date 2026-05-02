import { sanityFetch } from '@/lib/sanity/client'
import { teacherSlugsQuery } from '@/lib/sanity/queries'

const BASE_URL = 'https://reach-radio.com'

export async function GET(): Promise<Response> {
  const slugs = await sanityFetch<{ slug: string }[]>(
    teacherSlugsQuery,
    {},
    { tags: ['teachers'] }
  )

  const staticRoutes = ['', '/about', '/about/privacy-policy', '/donate', '/teachers', '/scheduled-list', '/sleep-timer']

  const teacherRoutes = slugs.map((t) => `/teachers/${t.slug}`)

  const allRoutes = [...staticRoutes, ...teacherRoutes]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes.map((route) => `  <url><loc>${BASE_URL}${route}</loc></url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
