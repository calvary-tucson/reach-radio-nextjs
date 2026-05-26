# SEO Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate SEO beyond the original Astro site via rich JSON-LD schemas, dynamic OG images per teacher, enhanced metadata, and sitemap improvements.

**Architecture:** Schema components are async Server Components that fetch Sanity data directly; JSON-LD is rendered as `<script type="application/ld+json">` tags server-side. Dynamic OG images use Next.js file-based `opengraph-image.tsx` route handlers. Root layout metadata converts from static `const` to `generateMetadata()` for Sanity-sourced favicons and keywords.

**Tech Stack:** Next.js App Router, `next/og` (ImageResponse), Sanity GROQ, TypeScript strict mode.

**Already built (no work needed):**
- `src/components/seo/BreadcrumbJsonLd.tsx` ✓
- `src/components/global/Breadcrumbs.tsx` ✓
- `src/components/global/BackButton.tsx` ✓
- `src/components/ui/breadcrumb.tsx` ✓
- `src/app/about/privacy-policy/page.tsx` already has `<Breadcrumbs>` ✓
- `src/app/teachers/[slug]/page.tsx` already imports and renders `<Breadcrumbs>` ✓

---

## Task 1: Fix wrong domain in schema URLs + sitemap

**Files:**
- Modify: `src/components/seo/RadioStationSchema.tsx`
- Modify: `src/components/seo/PersonSchema.tsx`
- Modify: `src/components/seo/EventSchema.tsx`
- Modify: `src/app/teachers/[slug]/page.tsx`
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Fix RadioStationSchema URL**

In `src/components/seo/RadioStationSchema.tsx`, change:
```tsx
url: 'https://reach-radio.com',
```
to:
```tsx
url: 'https://reach.radio',
```

- [ ] **Step 2: Fix PersonSchema URL**

In `src/components/seo/PersonSchema.tsx`, change:
```tsx
worksFor: {
  '@type': 'Organization',
  name: 'Reach Radio',
  url: 'https://reach-radio.com',
},
```
to:
```tsx
worksFor: {
  '@type': 'Organization',
  name: 'Reach Radio',
  url: 'https://reach.radio',
},
```

- [ ] **Step 3: Fix EventSchema URL**

In `src/components/seo/EventSchema.tsx`, change:
```tsx
organizer: {
  '@type': 'Organization',
  name: 'Reach Radio',
  url: 'https://reach-radio.com',
},
```
to:
```tsx
organizer: {
  '@type': 'Organization',
  name: 'Reach Radio',
  url: 'https://reach.radio',
},
```

- [ ] **Step 4: Fix PersonSchema url prop in teacher detail page**

In `src/app/teachers/[slug]/page.tsx`, change:
```tsx
url={`https://reach-radio.com/teachers/${teacher.slug}`}
```
to:
```tsx
url={`https://reach.radio/teachers/${teacher.slug}`}
```

- [ ] **Step 5: Fix sitemap BASE_URL**

In `src/app/sitemap.ts`, change:
```typescript
const BASE_URL = 'https://reach-radio.com'
```
to:
```typescript
const BASE_URL = 'https://reach.radio'
```

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/seo/RadioStationSchema.tsx src/components/seo/PersonSchema.tsx src/components/seo/EventSchema.tsx src/app/teachers/[slug]/page.tsx src/app/sitemap.ts
git commit -m "fix(seo): correct domain reach-radio.com → reach.radio in all schema components and sitemap"
```

---

## Task 2: Update Sanity queries

**Files:**
- Modify: `src/lib/sanity/queries.ts`

- [ ] **Step 1: Add siteIconURLDark and siteKeywords to siteSettingsQuery**

In `src/lib/sanity/queries.ts`, replace:
```typescript
export const siteSettingsQuery = `
  *[_type == "siteSettings"][0] {
    siteTitle,
    siteDescription,
    "siteIconURL": siteIconLight.asset->url,
    twitterHandle,
    facebookPage
  }
`
```
with:
```typescript
export const siteSettingsQuery = `
  *[_type == "siteSettings"][0] {
    siteTitle,
    siteDescription,
    siteKeywords,
    "siteIconURL": siteIconLight.asset->url,
    "siteIconURLDark": siteIconDark.asset->url,
    twitterHandle,
    facebookPage
  }
`
```

- [ ] **Step 2: Add appSettingsQuery and APP_SETTINGS_ID constant**

At the end of `src/lib/sanity/queries.ts`, add:
```typescript
export const APP_SETTINGS_ID = 'a2939b52-e844-45f4-ba97-c335991cea4b'

export const appSettingsQuery = `
  *[_type == "appSettings" && _id == $id][0] { radioAudioURL }
`
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sanity/queries.ts
git commit -m "feat(sanity): add siteKeywords, siteIconURLDark to siteSettingsQuery; add appSettingsQuery"
```

---

## Task 3: Enhance root layout metadata (dynamic Sanity-sourced)

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace static metadata with generateMetadata**

In `src/app/layout.tsx`, add the `siteSettingsQuery` import alongside the existing sanity import:
```typescript
import { siteSettingsQuery } from '@/lib/sanity/queries'
```

Then replace the entire `export const metadata: Metadata = { ... }` block with:
```typescript
const FALLBACK_DESCRIPTION = "Listen to Reach Radio, Tucson's Christian radio station featuring Bible teachings and gospel music on 106.7FM and 690AM."
const FALLBACK_KEYWORDS = 'Christian radio, Tucson, Bible teaching, gospel music, Reach Radio, 106.7FM, 690AM'
const FALLBACK_OG_IMAGE = 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg'

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await sanityFetch<{
    siteTitle: string
    siteDescription?: string
    siteKeywords?: string[]
    siteIconURL?: string
    siteIconURLDark?: string
    twitterHandle?: string
  }>(siteSettingsQuery, {}, { tags: ['siteSettings'] }).catch(() => null)

  const siteTitle = siteSettings?.siteTitle ?? 'Reach Radio'
  const description = siteSettings?.siteDescription ?? FALLBACK_DESCRIPTION
  const keywords = siteSettings?.siteKeywords?.join(', ') ?? FALLBACK_KEYWORDS
  const lightIconURL = siteSettings?.siteIconURL
  const darkIconURL = siteSettings?.siteIconURLDark
  const twitterHandle = siteSettings?.twitterHandle

  const icons: Metadata['icons'] = lightIconURL || darkIconURL
    ? {
        icon: [
          ...(lightIconURL ? [{ url: lightIconURL, media: '(prefers-color-scheme: light)' }] : []),
          ...(darkIconURL ? [{ url: darkIconURL, media: '(prefers-color-scheme: dark)' }] : []),
        ],
        apple: lightIconURL
          ? [{ url: `${lightIconURL}?w=180&h=180&fit=crop&auto=format`, sizes: '180x180' }]
          : undefined,
      }
    : undefined

  return {
    title: { default: siteTitle, template: `%s | ${siteTitle}` },
    description,
    keywords,
    metadataBase: new URL('https://reach.radio'),
    alternates: { canonical: '/' },
    robots: { index: true, follow: true },
    icons,
    openGraph: {
      type: 'website',
      siteName: siteTitle,
      title: siteTitle,
      description,
      url: 'https://reach.radio',
      locale: 'en_US',
      images: [{ url: FALLBACK_OG_IMAGE, width: 1024, height: 1024, alt: siteTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: siteTitle,
      description,
      ...(twitterHandle ? { site: twitterHandle, creator: twitterHandle } : {}),
    },
  }
}
```

- [ ] **Step 2: Add preconnect hints to layout JSX**

In the layout's returned JSX, add a `<head>` block immediately after `<html lang="en">`:
```tsx
<html lang="en">
  <head>
    <link rel="preconnect" href="https://cdn.sanity.io" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="dns-prefetch" href="https://formspree.io" />
  </head>
  <body ...>
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(seo): convert root layout to dynamic generateMetadata with Sanity-sourced favicons, keywords, twitter handle"
```

---

## Task 4: Enhance RadioStationSchema (async, Sanity-sourced, ListenAction)

**Files:**
- Modify: `src/components/seo/RadioStationSchema.tsx`

- [ ] **Step 1: Rewrite RadioStationSchema as async Server Component**

Replace the entire contents of `src/components/seo/RadioStationSchema.tsx` with:
```tsx
import { sanityFetch } from '@/lib/sanity/client'
import { siteSettingsQuery, appSettingsQuery, APP_SETTINGS_ID } from '@/lib/sanity/queries'

function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/<\/script>/gi, '<\\/script>')
}

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
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/seo/RadioStationSchema.tsx
git commit -m "feat(seo): RadioStationSchema — dynamic Sanity data, ListenAction, genre, structured broadcastFrequency"
```

---

## Task 5: Enhance PersonSchema + wire teacher links as sameAs

**Files:**
- Modify: `src/components/seo/PersonSchema.tsx`
- Modify: `src/app/teachers/[slug]/page.tsx`

- [ ] **Step 1: Add description, knowsAbout, sameAs props to PersonSchema**

Replace the entire contents of `src/components/seo/PersonSchema.tsx` with:
```tsx
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/<\/script>/gi, '<\\/script>') }}
    />
  )
}
```

- [ ] **Step 2: Update PersonSchema call in teacher detail page**

In `src/app/teachers/[slug]/page.tsx`, replace:
```tsx
<PersonSchema
  name={teacher.name}
  jobTitle={teacher.title}
  imageUrl={teacher.photo ?? undefined}
  url={`https://reach.radio/teachers/${teacher.slug}`}
/>
```
with:
```tsx
<PersonSchema
  name={teacher.name}
  jobTitle={teacher.title}
  imageUrl={teacher.photo ?? undefined}
  url={`https://reach.radio/teachers/${teacher.slug}`}
  description={`Listen to ${teacher.name} on Reach Radio Tucson`}
  knowsAbout={['Bible Teaching', 'Christian Ministry', 'Gospel']}
  sameAs={teacher.links?.map((l) => l.url)}
/>
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/seo/PersonSchema.tsx src/app/teachers/[slug]/page.tsx
git commit -m "feat(seo): PersonSchema — add description, knowsAbout, sameAs; wire teacher links"
```

---

## Task 6: WebSiteSchema — new component + add to root layout

**Files:**
- Create: `src/components/seo/WebSiteSchema.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create WebSiteSchema**

Create `src/components/seo/WebSiteSchema.tsx` with:
```tsx
import { sanityFetch } from '@/lib/sanity/client'
import { siteSettingsQuery } from '@/lib/sanity/queries'

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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/<\/script>/gi, '<\\/script>') }}
    />
  )
}
```

- [ ] **Step 2: Add WebSiteSchema to root layout**

In `src/app/layout.tsx`, add the import:
```typescript
import { WebSiteSchema } from '@/components/seo/WebSiteSchema'
```

Then inside `<body>`, as the first child (before `<BridgeInit />`):
```tsx
<body ...>
  <TooltipProvider delayDuration={500}>
    <WebSiteSchema />
    <a href="#main-content" ...>
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/seo/WebSiteSchema.tsx src/app/layout.tsx
git commit -m "feat(seo): add WebSiteSchema with SearchAction pointing to /teachers?q= search"
```

---

## Task 7: Add Breadcrumbs to About and Donate pages

**Files:**
- Modify: `src/app/about/page.tsx`
- Modify: `src/app/donate/layout.tsx`

- [ ] **Step 1: Add Breadcrumbs to about/page.tsx**

In `src/app/about/page.tsx`, add the import (it may already exist — check first):
```typescript
import Breadcrumbs from '@/components/global/Breadcrumbs'
```

Inside the returned JSX, after `<ShowMediaBar />`, add:
```tsx
<Breadcrumbs
  variant="standalone"
  items={[
    { name: 'Home', url: '/' },
    { name: 'About', url: '/about' },
  ]}
/>
```

- [ ] **Step 2: Add Breadcrumbs to donate/layout.tsx**

The donate page (`donate/page.tsx`) is a `'use client'` component, so breadcrumbs go in the layout. Replace the contents of `src/app/donate/layout.tsx` with:
```tsx
import type { Metadata } from 'next'
import Breadcrumbs from '@/components/global/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Donate',
  description: 'Support Reach Radio — 106.7FM / 690AM in Tucson, AZ',
  alternates: { canonical: '/donate' },
}

export default function DonateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Breadcrumbs
        variant="standalone"
        items={[
          { name: 'Home', url: '/' },
          { name: 'Donate', url: '/donate' },
        ]}
      />
      {children}
    </>
  )
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/about/page.tsx src/app/donate/layout.tsx
git commit -m "feat(seo): add BreadcrumbList JSON-LD and nav breadcrumbs to about and donate pages"
```

---

## Task 8: Enrich teacher detail generateMetadata

**Files:**
- Modify: `src/app/teachers/[slug]/page.tsx`

- [ ] **Step 1: Replace generateMetadata in teacher detail page**

In `src/app/teachers/[slug]/page.tsx`, replace the `generateMetadata` function:
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const teacher = await getTeacher(slug)
  if (!teacher) return { title: 'Teacher Not Found' }
  const description = `Listen to ${teacher.name}${teacher.title ? ` — ${teacher.title}` : ''} on Reach Radio Tucson 106.7FM / 690AM`
  return {
    title: teacher.name,
    description,
    alternates: { canonical: `/teachers/${slug}` },
    openGraph: {
      type: 'profile',
      title: teacher.name,
      description,
      url: `/teachers/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: teacher.name,
      description,
    },
  }
}
```

Note: no `openGraph.images` field — `opengraph-image.tsx` (Task 9) handles that automatically via file-based metadata.

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/teachers/[slug]/page.tsx
git commit -m "feat(seo): enrich teacher detail generateMetadata — richer description, OG profile type, twitter card"
```

---

## Task 9: Dynamic OG image per teacher

**Files:**
- Create: `src/app/teachers/[slug]/opengraph-image.tsx`

- [ ] **Step 1: Create teacher opengraph-image route handler**

Create `src/app/teachers/[slug]/opengraph-image.tsx` with:
```tsx
import { ImageResponse } from 'next/og'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherDetailQuery, teacherSlugsQuery } from '@/lib/sanity/queries'

export const alt = 'Teacher on Reach Radio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

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

const BG = 'linear-gradient(135deg, #1e1040 0%, #2D1B69 50%, #1a1040 100%)'
const GREEN = '#22C55E'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const teacher = await sanityFetch<{
    name: string
    title: string | null
    photo: string | null
  } | null>(teacherDetailQuery, { slug }, { tags: ['teachers'] }).catch(() => null)

  if (!teacher) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%', height: '100%', display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: BG, fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ color: 'white', fontSize: 72, fontWeight: 800, letterSpacing: '-2px' }}>
            Reach Radio
          </div>
          <div style={{ color: GREEN, fontSize: 32, fontWeight: 600, marginTop: 16, letterSpacing: '2px' }}>
            TEACHER
          </div>
        </div>
      ),
      { ...size }
    )
  }

  const photoUrl = teacher.photo
    ? `${teacher.photo}?w=630&h=630&fit=crop&auto=format`
    : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex',
          background: BG, fontFamily: 'system-ui, sans-serif',
        }}
      >
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            style={{ width: 630, height: 630, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', padding: '40px 48px',
            position: 'relative',
          }}
        >
          <div style={{ color: 'white', fontSize: 52, fontWeight: 800, lineHeight: 1.1 }}>
            {teacher.name}
          </div>
          {teacher.title && (
            <div
              style={{
                color: GREEN, fontSize: 24, fontWeight: 600,
                marginTop: 20, textTransform: 'uppercase', letterSpacing: '2px',
              }}
            >
              {teacher.title}
            </div>
          )}
          <div
            style={{
              position: 'absolute', bottom: 40, right: 48,
              color: 'rgba(255,255,255,0.45)', fontSize: 20,
            }}
          >
            Reach Radio
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Verify OG image renders locally**

Start the dev server (`npm run dev`) and navigate to:
`http://localhost:3000/teachers/[any-valid-slug]/opengraph-image`

Expected: 1200×630 image with teacher photo on left half, name + title on right, "Reach Radio" wordmark bottom-right, purple gradient background.

Test fallback: navigate to `http://localhost:3000/teachers/nonexistent/opengraph-image`
Expected: centered "Reach Radio" + "TEACHER" on purple gradient.

- [ ] **Step 4: Commit**

```bash
git add src/app/teachers/[slug]/opengraph-image.tsx
git commit -m "feat(seo): dynamic per-teacher OG image with photo, name, title on branded background"
```

---

## Task 10: Enhance sitemap with lastModified, changeFrequency, priority

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Rewrite sitemap with full metadata**

Replace the entire contents of `src/app/sitemap.ts` with:
```typescript
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
    { url: `${BASE_URL}`,                      changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${BASE_URL}/teachers`,             changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/scheduled-list`,       changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE_URL}/about`,                changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/donate`,               changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/sleep-timer`,          changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/about/privacy-policy`, changeFrequency: 'monthly', priority: 0.3 },
  ].map((route) => ({ ...route, lastModified: now }))

  const teacherRoutes: MetadataRoute.Sitemap = slugs.map((t) => ({
    url: `${BASE_URL}/teachers/${t.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
    lastModified: now,
  }))

  return [...staticRoutes, ...teacherRoutes]
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Verify sitemap locally**

```bash
curl http://localhost:3000/sitemap.xml | head -50
```
Expected: valid XML with `<changefreq>`, `<priority>`, `<lastmod>` elements and `https://reach.radio` URLs throughout.

- [ ] **Step 4: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): sitemap — add lastModified, changeFrequency, priority per route type"
```

---

## Final Verification

- [ ] **Run full type check**
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Verify JSON-LD on home page**

Start dev server. In browser devtools, check the page source for:
- `RadioStation` schema with `potentialAction.@type: "ListenAction"`
- `WebSite` schema with `potentialAction.@type: "SearchAction"`
- Both using `https://reach.radio` URLs

- [ ] **Verify JSON-LD on a teacher detail page**

Check source for:
- `Person` schema with `sameAs` array, `knowsAbout`, `description`
- `BreadcrumbList` with Home → Teachers → [name]
- No `reach-radio.com` anywhere in the page source

- [ ] **Validate with Google's Rich Results Test**

Navigate to https://search.google.com/test/rich-results and test:
- `https://reach.radio` — should show RadioStation + WebSite
- `https://reach.radio/teachers/[slug]` — should show Person + BreadcrumbList

- [ ] **Check OG image in social debugger**

Use https://www.opengraph.xyz and test a teacher URL. Expected: teacher photo with name + title on branded background.
