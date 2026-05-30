# PPR Phase 2 — cacheComponents + Suspense Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable `cacheComponents: true`, remove `experimental.useCache`, and add `<Suspense>` boundaries to all pages that call `sanityFetch` directly so PPR-eligible pages show `◐` in build output.

**Architecture:** Each page component becomes a synchronous static shell rendering structural chrome (breadcrumbs, headings, search bars). Data fetching moves into async server components inside `<Suspense>` boundaries. `sanityFetch` already has `'use cache'` — the change is moving call sites out of page function bodies into Suspense-wrapped children so Next.js can separate the static HTML shell from streamed content. `cacheComponents: true` is a top-level config option that subsumes `experimental.useCache`, `experimental.ppr`, and `experimental.dynamicIO` in a single flag.

**Tech Stack:** Next.js 16.2.6, React 19 Suspense, `cacheComponents: true`, existing skeleton components in `src/components/skeletons/`

---

## File Map

| File | Change |
|---|---|
| `next.config.ts` | Add `cacheComponents: true` (top-level), remove `experimental.useCache` |
| `src/app/api/stream-info-sse/route.ts` | Remove `export const dynamic = 'force-dynamic'` — not needed with cacheComponents |
| `src/app/teachers/[slug]/page.tsx` | Extract fetches into `TeacherContent` + `TeacherContentWrapper` inside Suspense |
| `src/app/teachers/page.tsx` | Extract grid fetch into `TeachersContent` async component inside Suspense |
| `src/app/teachers/search/page.tsx` | Extract fetches into `SearchContent` inside Suspense |
| `src/app/scheduled-list/page.tsx` | Extract fetch + rendering into `ScheduleContent` inside Suspense |
| `src/app/about/page.tsx` | Extract `headers()` + fetch into `AboutContent` inside Suspense |
| `src/app/sitemap.ts` | Add `'use cache'` + `cacheLife` + `cacheTag` |
| `src/app/@modal/(...)teachers/[slug]/page.tsx` | Extract fetches into `ModalTeacherContent` + wrapper inside Suspense |
| `src/app/@modal/(...)teachers/search/page.tsx` | Extract fetches into `ModalSearchContent` inside Suspense |
| `src/app/api/teachers-list/route.ts` | No changes — API route, not a component, sanityFetch already cached |

---

## Task 1: Enable cacheComponents in next.config.ts

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Replace experimental.useCache with top-level cacheComponents**

Replace the current `next.config.ts` contents with:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  experimental: {
    serverComponentsHmrCache: true,
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/js/iFrameResizer.contentWindow.min.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' cdn.sanity.io data: blob: https://www.google.com",
              "media-src 'self' https://*.radiojar.com https://reach.radio",
              "connect-src 'self' api.sanity.io cdn.sanity.io *.radiojar.com https://formspree.io https://www.google.com",
              "font-src 'self'",
              "object-src 'none'",
              "frame-src https://forms.ministryforms.net",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self' https://formspree.io",
            ].join('; '),
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/speakers/:slug*', destination: '/teachers/:slug*', permanent: true },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 2: Build to confirm cacheComponents is recognized**

```bash
npm run build 2>&1 | head -30
```

Expected: build runs (may fail with Suspense errors — that's the next tasks). No "unrecognized key" or config errors.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: enable cacheComponents (subsumes useCache + enables PPR)"
```

---

## Task 2: Remove force-dynamic from SSE route

Per the cacheComponents migration guide: `dynamic = 'force-dynamic'` is "Not needed. All pages are dynamic by default."

**Files:**
- Modify: `src/app/api/stream-info-sse/route.ts`

- [ ] **Step 1: Remove the export**

Delete this line from `src/app/api/stream-info-sse/route.ts`:

```ts
export const dynamic = 'force-dynamic'
```

The file should now start directly with:

```ts
const RADIOJAR_URL = 'https://proxy.radiojar.com/api/stations/g4d600bv6p5tv/now_playing/?callback='
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/stream-info-sse/route.ts
git commit -m "fix: remove force-dynamic from SSE route (not needed with cacheComponents)"
```

---

## Task 3: Split teachers/[slug]/page.tsx

The `params` Promise is per-request (dynamic). Awaiting it at page top level outside Suspense triggers "Uncached data was accessed outside of <Suspense>." Fix: make the page synchronous shell; move params resolution + data fetching into Suspense-wrapped async child components.

**Files:**
- Modify: `src/app/teachers/[slug]/page.tsx`

- [ ] **Step 1: Rewrite the file**

Replace `src/app/teachers/[slug]/page.tsx` with:

```tsx
import { cache } from 'react'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { sanityFetch } from '@/lib/sanity/client'
import {
  teacherDetailQuery,
  teacherSlugsQuery,
  highlightedTeachersQuery,
} from '@/lib/sanity/queries'
import type { TeacherDetail, TeacherSummary } from '@/lib/sanity/types'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import { PersonSchema } from '@/components/seo/PersonSchema'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import Breadcrumbs from '@/components/global/Breadcrumbs'
import { TeacherDetailContent } from '@/components/teachers/TeacherDetailContent'
import { TeacherDetailSkeleton } from '@/components/skeletons/TeacherDetailSkeleton'

interface Props {
  params: Promise<{ slug: string }>
}

const getTeacher = cache(async (slug: string): Promise<TeacherDetail | null> => {
  return sanityFetch<TeacherDetail | null>(
    teacherDetailQuery,
    { slug },
    { tags: ['teachers'] }
  )
})

export async function generateStaticParams() {
  try {
    const slugs = await sanityFetch<{ slug: string }[]>(
      teacherSlugsQuery,
      {},
      { tags: ['teachers'] }
    )
    return slugs.map((t) => ({ slug: t.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const teacher = await getTeacher(slug)
  if (!teacher) return { title: 'Teacher Not Found' }
  const description = `Listen to ${teacher.name}${teacher.title ? ` — ${teacher.title}` : ''} on Reach Radio Tucson 106.7FM / 690AM`
  return {
    title: teacher.name,
    description,
    alternates: { canonical: `/teachers/${slug}` },
    openGraph: { type: 'profile', title: teacher.name, description, url: `/teachers/${slug}` },
    twitter: { card: 'summary_large_image', title: teacher.name, description },
  }
}

async function TeacherContent({ slug }: { slug: string }) {
  const [teacher, highlightedRaw] = await Promise.all([
    getTeacher(slug),
    sanityFetch<TeacherSummary[]>(
      highlightedTeachersQuery,
      { slugs: [...HIGHLIGHTED_TEACHER_SLUGS] },
      { tags: ['teachers'] }
    ),
  ])

  if (!teacher) notFound()

  const relatedTeachers = sortByHighlightedOrder(highlightedRaw, HIGHLIGHTED_TEACHER_SLUGS)
    .filter((t) => t.slug !== slug)
    .slice(0, 8)

  return (
    <>
      <BreadcrumbJsonLd items={[
        { name: 'Home', url: '/' },
        { name: 'Teachers', url: '/teachers' },
        { name: teacher.name, url: `/teachers/${teacher.slug}` },
      ]} />
      <PersonSchema
        name={teacher.name}
        jobTitle={teacher.title}
        imageUrl={teacher.photo ?? undefined}
        url={`https://reach.radio/teachers/${teacher.slug}`}
        description={`Listen to ${teacher.name} on Reach Radio Tucson`}
        knowsAbout={['Bible Teaching', 'Christian Ministry', 'Gospel']}
        sameAs={teacher.links?.map((l) => l.url)}
      />
      <Breadcrumbs
        variant="standalone"
        items={[
          { name: 'Teachers', url: '/teachers' },
          { name: teacher.name, url: `/teachers/${teacher.slug}` },
        ]}
      />
      <TeacherDetailContent teacher={teacher} relatedTeachers={relatedTeachers} />
    </>
  )
}

async function TeacherContentWrapper({ params }: Props) {
  const { slug } = await params
  return <TeacherContent slug={slug} />
}

export default function TeacherDetailPage({ params }: Props) {
  return (
    <div className="text-white light:text-gray-900 max-w-screen-xl mx-auto">
      <ShowMediaBar />
      <Suspense fallback={<TeacherDetailSkeleton />}>
        <TeacherContentWrapper params={params} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "teachers/\[slug\]"
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add "src/app/teachers/[slug]/page.tsx"
git commit -m "fix: split teachers/[slug] into static shell + Suspense (PPR)"
```

---

## Task 4: Split teachers/page.tsx

The page calls two `sanityFetch` in `Promise.all` at the top level. Extract into `TeachersContent` async component inside a second Suspense boundary. The `RecommendedTeachers` Suspense already exists — keep it.

**Files:**
- Modify: `src/app/teachers/page.tsx`

- [ ] **Step 1: Rewrite the file**

Replace `src/app/teachers/page.tsx` with:

```tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeachersClientView } from '@/components/teachers/TeachersClientView'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { PassiveSearchBar } from '@/components/global/PassiveSearchBar'
import { RecommendedTeachers } from '@/components/teachers/RecommendedTeachers'
import { RecommendedTeachersSkeleton } from '@/components/skeletons/RecommendedTeachersSkeleton'
import { TeacherGridSkeleton } from '@/components/skeletons/TeacherCardSkeleton'

const OG_IMAGE = 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg'

export const metadata: Metadata = {
  title: 'Teachers',
  description: "Hear nationally-known Bible teachers on Reach Radio — Tucson's Christian station at 106.7FM and 690AM.",
  alternates: { canonical: '/teachers' },
  openGraph: {
    title: 'Teachers | Reach Radio',
    description: "Hear nationally-known Bible teachers on Reach Radio — Tucson's Christian station at 106.7FM and 690AM.",
    url: '/teachers',
    images: [{ url: OG_IMAGE, width: 1024, height: 1024, alt: 'Reach Radio Teachers' }],
  },
  twitter: {
    title: 'Teachers | Reach Radio',
    description: "Hear nationally-known Bible teachers on Reach Radio — Tucson's Christian station at 106.7FM and 690AM.",
    images: [OG_IMAGE],
  },
}

async function TeachersContent() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])
  return (
    <TeachersClientView
      teachers={teachers}
      scheduleTeachers={scheduleTeachers}
    />
  )
}

export default function TeachersPage() {
  return (
    <div className="px-4 md:px-8 py-6 max-w-screen-xl mx-auto">
      <h1 className="text-[22px] md:text-4xl font-extrabold text-white light:text-gray-900 tracking-tight mb-3">Teachers</h1>
      <ShowMediaBar />
      <PassiveSearchBar
        href="/teachers/search"
        placeholder="Search teachers..."
        modalTitle="Search Teachers"
        className="mb-4"
      />
      <Suspense fallback={<RecommendedTeachersSkeleton />}>
        <RecommendedTeachers />
      </Suspense>
      <Suspense fallback={<TeacherGridSkeleton />}>
        <TeachersContent />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "teachers/page"
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/teachers/page.tsx
git commit -m "fix: split teachers page into static shell + Suspense (PPR)"
```

---

## Task 5: Split teachers/search/page.tsx

**Files:**
- Modify: `src/app/teachers/search/page.tsx`

- [ ] **Step 1: Rewrite the file**

Replace `src/app/teachers/search/page.tsx` with:

```tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'

export const metadata: Metadata = {
  title: 'Search Teachers',
  robots: { index: false },
}

async function SearchContent() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])
  return (
    <TeacherSearchClient
      teachers={teachers}
      scheduleTeachers={scheduleTeachers}
    />
  )
}

export default function TeachersSearchPage() {
  return (
    <div className="px-4 py-6 sm:px-6">
      <Suspense fallback={<SearchResultsSkeleton />}>
        <SearchContent />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "search/page"
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/teachers/search/page.tsx
git commit -m "fix: split teachers/search into static shell + Suspense (PPR)"
```

---

## Task 6: Split scheduled-list/page.tsx

The `BreadcrumbJsonLd` uses static `BREADCRUMB_ITEMS` — move to shell. `EventSchema` needs fetched data — keep in Suspense component.

**Files:**
- Modify: `src/app/scheduled-list/page.tsx`

- [ ] **Step 1: Rewrite the file**

Replace `src/app/scheduled-list/page.tsx` with:

```tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherWithSchedule } from '@/lib/sanity/types'
import { EventSchema } from '@/components/seo/EventSchema'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { FALLBACK_OG_IMAGE } from '@/lib/constants'
import Image from 'next/image'
import Link from 'next/link'
import Breadcrumbs from '@/components/global/Breadcrumbs'
import { ScheduleSkeleton } from '@/components/skeletons/ScheduleSkeleton'

export const metadata: Metadata = {
  title: 'Full Schedule',
  description: 'Full programming schedule for Reach Radio 106.7FM / 690AM',
  alternates: { canonical: '/scheduled-list' },
  openGraph: {
    title: 'Full Schedule — Reach Radio',
    description: 'Full programming schedule for Reach Radio 106.7FM / 690AM in Tucson, AZ',
    url: '/scheduled-list',
    images: [{ url: FALLBACK_OG_IMAGE, width: 1024, height: 1024, alt: 'Reach Radio Full Schedule' }],
  },
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const BREADCRUMB_ITEMS = [
  { name: 'Home', url: '/' },
  { name: 'Full Schedule', url: '/scheduled-list' },
]

function timeToMinutes(t: string): number {
  const [time, period] = t.split(' ')
  const [h, m] = time.split(':').map(Number)
  return (h % 12 + (period === 'PM' ? 12 : 0)) * 60 + m
}

async function ScheduleContent() {
  const teachers = await sanityFetch<TeacherWithSchedule[]>(
    fullScheduleQuery,
    {},
    { tags: ['schedule'] }
  )

  const byDay = DAYS.map((day) => ({
    day,
    slots: teachers
      .flatMap((t) =>
        (t.schedule ?? [])
          .filter((s) => s.day === day)
          .flatMap((s) =>
            s.times.map((time) => ({
              name: t.name,
              slug: t.slug,
              title: t.title,
              photo: t.photo,
              startTime: time.startTime,
              endTime: time.endTime,
            }))
          )
      )
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
  })).filter((d) => d.slots.length > 0)

  const allEvents = byDay.flatMap(({ day, slots }) =>
    slots.map((slot) => ({
      name: slot.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      day,
    }))
  )

  return (
    <>
      <EventSchema events={allEvents} />
      <div className="px-4 pt-6 pb-6">
        <h1 className="text-[22px] md:text-4xl font-extrabold text-white light:text-gray-900 tracking-tight mb-6">Full Schedule</h1>
        {byDay.length === 0 ? (
          <p className="text-sm text-white/45 light:text-gray-400 py-12">No schedule available.</p>
        ) : (
          <div className="space-y-8">
            {byDay.map(({ day, slots }) => (
              <section key={day}>
                <h2 className="text-[10px] md:text-[12px] font-bold uppercase tracking-[0.08em] text-white/80 light:text-gray-600 mb-3">{day}</h2>
                <ul className="space-y-2">
                  {slots.map((slot) => (
                    <li key={`${slot.slug}-${slot.startTime}`}>
                      <Link
                        href={`/teachers/${slot.slug}`}
                        className="flex items-center gap-3 p-3 bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-xl hover:bg-white/10 light:hover:bg-gray-100 hover:border-white/20 light:hover:border-gray-300 transition-colors cursor-pointer"
                      >
                        {slot.photo && (
                          <Image
                            src={slot.photo}
                            alt={slot.name}
                            width={40}
                            height={40}
                            style={{ width: 40, height: 40 }}
                            className="rounded-full object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white light:text-gray-900 text-sm font-medium truncate">{slot.name}</p>
                          {slot.title && <p className="text-white/80 light:text-gray-600 text-xs truncate">{slot.title}</p>}
                        </div>
                        <span className="text-white/50 light:text-gray-400 text-xs flex-shrink-0">
                          {slot.startTime} – {slot.endTime}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default function ScheduledListPage() {
  return (
    <div>
      <Breadcrumbs variant="standalone" items={BREADCRUMB_ITEMS} />
      <BreadcrumbJsonLd items={BREADCRUMB_ITEMS} />
      <Suspense fallback={<ScheduleSkeleton />}>
        <ScheduleContent />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "scheduled-list"
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/scheduled-list/page.tsx
git commit -m "fix: split scheduled-list into static shell + Suspense (PPR)"
```

---

## Task 7: Split about/page.tsx

`headers()` is per-request. Entire page content is dynamic. Extract into `AboutContent` async component inside Suspense; static shell is just the outer container div.

**Files:**
- Modify: `src/app/about/page.tsx`

- [ ] **Step 1: Rewrite the file**

Replace `src/app/about/page.tsx` with the entire file below. The `AboutContent` component contains the `headers()` call, the `sanityFetch`, and all JSX. The page export renders an empty shell div with `AboutContent` inside `Suspense`.

The full file (note: the SVG badge content is preserved exactly — abbreviating here for clarity but the implementation must include the full SVGs from the original file):

```tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ContactForm } from '@/components/about/ContactForm'
import { sanityFetch } from '@/lib/sanity/client'
import { siteSettingsQuery } from '@/lib/sanity/queries'
import { OrganizationSchema } from '@/components/seo/OrganizationSchema'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'

export const metadata: Metadata = {
  title: 'About',
  description: 'About Reach Radio — 106.7FM / 690AM in Tucson, AZ',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About Reach Radio',
    description: 'About Reach Radio — 106.7FM / 690AM in Tucson, AZ',
    url: '/about',
  },
  twitter: {
    title: 'About Reach Radio',
    description: 'About Reach Radio — 106.7FM / 690AM in Tucson, AZ',
  },
}

async function AboutContent() {
  const headersList = await headers()
  const isMobileApp = headersList.get('mobile-app') === 'true'

  const siteSettings = await sanityFetch<{
    siteTitle: string
    siteDescription?: string
    siteIconURL?: string
    twitterHandle?: string
    facebookPage?: string
  }>(siteSettingsQuery, {}, { tags: ['siteSettings'] }).catch(() => ({
    siteTitle: 'Reach Radio',
    siteDescription: undefined,
    siteIconURL: undefined,
    twitterHandle: undefined,
    facebookPage: undefined,
  }))

  return (
    <>
      <ShowMediaBar />
      <OrganizationSchema
        name={siteSettings.siteTitle}
        alternateName="Reach Radio Tucson"
        description={siteSettings.siteDescription}
        logoUrl={siteSettings.siteIconURL}
        facebookUrl={siteSettings.facebookPage}
        twitterHandle={siteSettings.twitterHandle}
      />
      <h1 className="sr-only">About Reach Radio</h1>
      {/* Frequency hero */}
      <div className="grid md:grid-cols-2 rounded-[18px] overflow-hidden border border-white/5 light:border-gray-200">
        <div className="text-center p-6 bg-[#84b84f] flex flex-col justify-center items-center">
          <div className="text-5xl text-[#0a1305] font-extrabold">690AM</div>
          <div className="text-5xl text-[#0a1305] font-extrabold">106.7FM</div>
          <div className="text-sm text-[#0a1305]/80 uppercase font-bold tracking-widest mt-2">On the air in Tucson, AZ</div>
        </div>
        <div className="p-6 bg-[#1c2128] light:bg-gray-50">
          <div className="border-l-4 pl-3 font-bold text-sm mb-3 border-l-[#84b84f] uppercase text-white light:text-gray-900 tracking-wide">
            Providing Solid Bible Teachings and Uplifting Worship 24/7
          </div>
          <p className="text-white/70 light:text-gray-600 text-sm leading-relaxed">
            Reach Radio first went online in February 2016, and on the air in February 2017.
            Our goal is simple, to bring the life-saving message and hope of the gospel to
            as many as can hear via the Tucson radio airwaves.
          </p>
        </div>
      </div>

      {/* App download links — hidden in mobile app */}
      {!isMobileApp && (
        <div className="bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/80 light:text-gray-600 mb-4">Download App</h2>
          <div className="flex gap-3 flex-wrap">
            {/* PRESERVE FULL SVG BADGES FROM ORIGINAL FILE VERBATIM */}
          </div>
        </div>
      )}

      {/* Contact form */}
      <div className="bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-5">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/80 light:text-gray-600 mb-2">Got Questions?</h2>
        <p className="text-white/60 light:text-gray-500 text-sm mb-4">Send us a message and we will get back to you as soon as possible.</p>
        <ContactForm />
      </div>

      {/* Privacy policy */}
      <Link
        href="/about/privacy-policy"
        className="block bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-xl p-5 hover:bg-white/10 light:hover:bg-gray-100 hover:border-white/20 light:hover:border-gray-300 transition-colors cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white light:text-gray-900 font-semibold text-sm">Privacy Policy</p>
            <p className="text-white/70 light:text-gray-500 text-xs mt-1">How we collect and protect your information</p>
          </div>
          <svg
            className="w-4 h-4 text-white/40 light:text-gray-400 group-hover:text-white/70 transition-colors flex-shrink-0 ml-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    </>
  )
}

export default function AboutPage() {
  return (
    <div className="page-enter px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-6">
      <Suspense fallback={null}>
        <AboutContent />
      </Suspense>
    </div>
  )
}
```

> **Implementation note:** The SVG badge content (Apple App Store + Google Play badges) is long and must be copied verbatim from the original file (`src/app/about/page.tsx` lines 87–175). Do not abbreviate or replace with comments — copy the exact SVG markup into the `AboutContent` component.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "about/page"
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/about/page.tsx
git commit -m "fix: split about page into static shell + Suspense (PPR)"
```

---

## Task 8: Split @modal/(...)teachers/[slug]/page.tsx

Same problem as the main teachers/[slug] — dynamic `params` accessed outside Suspense. Same fix pattern.

**Files:**
- Modify: `src/app/@modal/(...)teachers/[slug]/page.tsx`

- [ ] **Step 1: Rewrite the file**

Replace `src/app/@modal/(...)teachers/[slug]/page.tsx` with:

```tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherDetailQuery, highlightedTeachersQuery } from '@/lib/sanity/queries'
import type { TeacherDetail, TeacherSummary } from '@/lib/sanity/types'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import { TeacherPanelChrome } from '@/components/modals/chrome/TeacherPanelChrome'
import { TeacherDetailContent } from '@/components/teachers/TeacherDetailContent'
import { TeacherDetailSkeleton } from '@/components/skeletons/TeacherDetailSkeleton'

interface Props {
  params: Promise<{ slug: string }>
}

async function ModalTeacherContent({ slug }: { slug: string }) {
  const [teacher, highlightedRaw] = await Promise.all([
    sanityFetch<TeacherDetail | null>(teacherDetailQuery, { slug }, { tags: ['teachers'] }),
    sanityFetch<TeacherSummary[]>(
      highlightedTeachersQuery,
      { slugs: [...HIGHLIGHTED_TEACHER_SLUGS] },
      { tags: ['teachers'] }
    ),
  ])

  if (!teacher) notFound()

  const relatedTeachers = sortByHighlightedOrder(highlightedRaw, HIGHLIGHTED_TEACHER_SLUGS)
    .filter((t) => t.slug !== slug)
    .slice(0, 8)

  return (
    <TeacherDetailContent teacher={teacher} relatedTeachers={relatedTeachers} headingLevel="h2" />
  )
}

async function ModalTeacherContentWrapper({ params }: Props) {
  const { slug } = await params
  return <ModalTeacherContent slug={slug} />
}

export default function TeacherDetailModalPage({ params }: Props) {
  return (
    <TeacherPanelChrome>
      <Suspense fallback={<TeacherDetailSkeleton />}>
        <ModalTeacherContentWrapper params={params} />
      </Suspense>
    </TeacherPanelChrome>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "modal"
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add "src/app/@modal/(...)teachers/[slug]/page.tsx"
git commit -m "fix: split modal teacher detail into static shell + Suspense (PPR)"
```

---

## Task 9: Split @modal/(...)teachers/search/page.tsx

**Files:**
- Modify: `src/app/@modal/(...)teachers/search/page.tsx`

- [ ] **Step 1: Rewrite the file**

Replace `src/app/@modal/(...)teachers/search/page.tsx` with:

```tsx
import { Suspense } from 'react'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'

async function ModalSearchContent() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])
  return (
    <div className="px-4 pt-4 pb-16">
      <TeacherSearchClient
        teachers={teachers}
        scheduleTeachers={scheduleTeachers}
      />
    </div>
  )
}

export default function TeachersSearchSheetPage() {
  return (
    <SheetChrome title="Search Teachers" padded={false}>
      <Suspense fallback={<SearchResultsSkeleton />}>
        <ModalSearchContent />
      </Suspense>
    </SheetChrome>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "modal"
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add "src/app/@modal/(...)teachers/search/page.tsx"
git commit -m "fix: split modal teacher search into static shell + Suspense (PPR)"
```

---

## Task 10: Add use cache to sitemap.ts

The sitemap calls `sanityFetch` (already cached), but marking the sitemap function itself with `'use cache'` ensures Next.js can prerender it and invalidate via `revalidateTag('teachers')` when content changes.

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Add use cache directive**

Replace `src/app/sitemap.ts` with:

```ts
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "sitemap"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "fix: add use cache to sitemap function"
```

---

## Task 11: Full build verification

- [ ] **Step 1: Clean build**

```bash
rm -rf .next && npm run build 2>&1 | tee /tmp/ppr-build.log
```

- [ ] **Step 2: Check for PPR routes**

```bash
grep -E "◐|PPR" /tmp/ppr-build.log
```

Expected: routes show `◐` (PPR-enabled) in build output for teachers pages, scheduled-list, and about.

- [ ] **Step 3: Check for errors**

```bash
grep -iE "error|uncached data|outside.*suspense" /tmp/ppr-build.log
```

Expected: no "Uncached data was accessed outside of <Suspense>" errors. Build succeeds.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 6: Start dev server and verify teachers page**

```bash
npm run dev
```

Navigate to `http://localhost:3000/teachers`. Confirm:
- Page heading and search bar appear immediately (static shell)
- Teacher grid streams in with skeleton while loading
- No console errors or hydration warnings

- [ ] **Step 7: Verify teacher detail page**

Navigate to `http://localhost:3000/teachers/john-ankerberg` (or any valid slug from build output). Confirm:
- Media bar visible immediately
- `TeacherDetailSkeleton` shows briefly then content streams in
- No console errors

- [ ] **Step 8: Verify scheduled-list**

Navigate to `http://localhost:3000/scheduled-list`. Confirm:
- Breadcrumb shows immediately
- Schedule streams in with skeleton
- No console errors

- [ ] **Step 9: Verify about page**

Navigate to `http://localhost:3000/about`. Confirm:
- Content renders
- No console errors

- [ ] **Step 10: Verify SSE stream still works**

Navigate to `http://localhost:3000` and confirm the media bar shows current song title (relies on the SSE endpoint at `/api/stream-info-sse`).

- [ ] **Step 11: Commit if any lint/type fixes were needed**

```bash
git add -p
git commit -m "fix: lint and type cleanup after PPR refactor"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ `cacheComponents: true` — Task 1
- ✅ SSE `force-dynamic` removal — Task 2
- ✅ `teachers/[slug]/page.tsx` — Task 3
- ✅ `teachers/page.tsx` — Task 4
- ✅ `teachers/search/page.tsx` — Task 5
- ✅ `scheduled-list/page.tsx` — Task 6
- ✅ `about/page.tsx` — Task 7
- ✅ `sitemap.ts` — Task 10
- ✅ `api/teachers-list/route.ts` — explicitly excluded (no changes needed)
- ✅ `@modal/(...)teachers/[slug]/page.tsx` — Task 8
- ✅ `@modal/(...)teachers/search/page.tsx` — Task 9
- ✅ Build verification with `◐` check — Task 11

**Placeholders:** Task 7 contains an implementation note about SVG badges. This is intentional — the SVG content is ~90 lines of inline SVG that is identical to the original file. The plan directs the implementer to copy it verbatim rather than reproduce it in full here. The note is explicit and actionable.

**Type consistency:** All async component signatures (`{ slug: string }`, `Props`) are consistent across tasks. `TeacherContent` in Task 3 and `ModalTeacherContent` in Task 8 are separate functions in separate files — no naming collision.
