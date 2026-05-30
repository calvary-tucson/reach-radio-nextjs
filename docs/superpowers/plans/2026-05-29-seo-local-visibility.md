# SEO Local Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen local search visibility for Tucson Christian radio queries by fixing metadata signals, schema accuracy, and sitemap quality.

**Architecture:** All changes are isolated to SEO-layer files (schema components, metadata exports, sitemap). No application logic or UI components are touched except moving `RadioStationSchema` from home page to root layout. Each task is independently committable.

**Tech Stack:** Next.js 15 App Router, TypeScript, Sanity CMS (`sanityFetch` with `'use cache'`), Vitest + Testing Library, JSON-LD schema.org

---

## File Map

| File | Change |
|---|---|
| `src/lib/sanity/queries.ts` | Add `teacherSlugsWithDatesQuery` |
| `src/app/sitemap.ts` | ISR, use new query, drop sleep-timer, omit static lastModified |
| `src/components/seo/BreadcrumbJsonLd.tsx` | Fix `</script>` escaping |
| `src/components/seo/OrganizationSchema.tsx` | Fix `</script>` escaping |
| `src/components/seo/EventSchema.tsx` | Change `Event` → `BroadcastEvent`, add `publishedOn` |
| `src/app/page.tsx` | Better title/description, remove `<RadioStationSchema />` |
| `src/app/teachers/page.tsx` | Stronger description |
| `src/app/scheduled-list/page.tsx` | Add canonical, add `<BreadcrumbJsonLd />` |
| `src/app/sleep-timer/page.tsx` | Add `robots: noindex` |
| `src/app/layout.tsx` | Add `<RadioStationSchema />` |
| `tests/unit/event-schema.test.tsx` | Update for BroadcastEvent type |

---

### Task 1: Add `teacherSlugsWithDatesQuery`

**Files:**
- Modify: `src/lib/sanity/queries.ts`

This new query is used only by `sitemap.ts`. The existing `teacherSlugsQuery` is left unchanged — it is used by `generateStaticParams` in `teachers/[slug]/page.tsx` and `teachers/[slug]/opengraph-image.tsx` and must not be modified.

- [ ] **Step 1: Add the query after `teacherSlugsQuery` in `src/lib/sanity/queries.ts`**

Open `src/lib/sanity/queries.ts`. After line 30 (after the closing backtick of `teacherSlugsQuery`), insert:

```typescript
export const teacherSlugsWithDatesQuery = `
  *[_type == "teacher"] { "slug": slug.current, "updatedAt": _updatedAt }
`
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sanity/queries.ts
git commit -m "feat(seo): add teacherSlugsWithDatesQuery for sitemap lastModified"
```

---

### Task 2: Fix sitemap — ISR, accurate dates, drop sleep-timer

**Files:**
- Modify: `src/app/sitemap.ts`

Changes:
- Remove `export const dynamic = 'force-dynamic'` — sitemap should use ISR like other pages
- Add `export const revalidate = 86400` — revalidate daily
- Use `teacherSlugsWithDatesQuery` so teacher `lastModified` reflects real Sanity `_updatedAt`
- Omit `lastModified` from static routes (more honest than a hardcoded or live timestamp)
- Remove `/sleep-timer` from the static routes array

- [ ] **Step 1: Rewrite `src/app/sitemap.ts`**

Replace the entire file contents with:

```typescript
import type { MetadataRoute } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherSlugsWithDatesQuery } from '@/lib/sanity/queries'

export const revalidate = 86400

const BASE_URL = 'https://reach.radio'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    lastModified: new Date(t.updatedAt),
  }))

  return [...staticRoutes, ...teacherRoutes]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "fix(seo): sitemap ISR, accurate lastModified, remove sleep-timer"
```

---

### Task 3: Fix `</script>` escaping in BreadcrumbJsonLd and OrganizationSchema

**Files:**
- Modify: `src/components/seo/BreadcrumbJsonLd.tsx`
- Modify: `src/components/seo/OrganizationSchema.tsx`

Both currently pass raw `JSON.stringify` output to `dangerouslySetInnerHTML`. If any Sanity string contained `</script>`, it could break the page. The fix adds `.replace(/<\/script>/gi, '<\\/script>')` — the same pattern already used by `WebSiteSchema` and `RadioStationSchema`.

- [ ] **Step 1: Fix `src/components/seo/BreadcrumbJsonLd.tsx`**

Find line 14 (the `dangerouslySetInnerHTML` prop). Change:

```typescript
dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
```

To:

```typescript
dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/<\/script>/gi, '<\\/script>') }}
```

- [ ] **Step 2: Fix `src/components/seo/OrganizationSchema.tsx`**

Find line 48 (the `dangerouslySetInnerHTML` prop). Change the current overly-broad replace:

```typescript
dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/<\//g, '<\\/') }}
```

To the targeted replace:

```typescript
dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/<\/script>/gi, '<\\/script>') }}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/seo/BreadcrumbJsonLd.tsx src/components/seo/OrganizationSchema.tsx
git commit -m "fix(seo): consistent </script> escaping in BreadcrumbJsonLd and OrganizationSchema"
```

---

### Task 4: EventSchema — change Event to BroadcastEvent

**Files:**
- Modify: `src/components/seo/EventSchema.tsx`
- Modify: `tests/unit/event-schema.test.tsx`

`Event` without ISO `startDate` triggers Google validation warnings. `BroadcastEvent` with `publishedOn` is the semantically correct type for recurring radio programs.

- [ ] **Step 1: Update the failing test first**

In `tests/unit/event-schema.test.tsx`, find the test `'each ListItem has Event type with name and organizer'` (line 25). Update it to expect `BroadcastEvent` and `publishedOn`:

```typescript
it('each ListItem has BroadcastEvent type with name, organizer, and publishedOn', () => {
  const { container } = render(<EventSchema events={events} />)
  const script = container.querySelector('script[type="application/ld+json"]')!
  const json = JSON.parse(script.innerHTML)
  const first = json.itemListElement[0].item
  expect(first['@type']).toBe('BroadcastEvent')
  expect(first.name).toBe('Grace to You')
  expect(first.organizer.name).toBe('Reach Radio')
  expect(first.publishedOn['@type']).toBe('BroadcastService')
  expect(first.publishedOn.url).toBe('https://reach.radio')
})
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
npx vitest run tests/unit/event-schema.test.tsx
```

Expected: FAIL — `first['@type']` is `'Event'`, not `'BroadcastEvent'`.

- [ ] **Step 3: Update `src/components/seo/EventSchema.tsx`**

Replace the entire file:

```typescript
interface EventItem {
  name: string
  startTime: string
  endTime: string
  day: string
}

interface Props {
  events: EventItem[]
}

export function EventSchema({ events }: Props) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'BroadcastEvent',
        name: event.name,
        description: `${event.day} ${event.startTime}–${event.endTime}`,
        publishedOn: {
          '@type': 'BroadcastService',
          name: 'Reach Radio',
          url: 'https://reach.radio',
        },
        organizer: {
          '@type': 'Organization',
          name: 'Reach Radio',
          url: 'https://reach.radio',
        },
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/<\/script>/gi, '<\\/script>') }}
    />
  )
}
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
npx vitest run tests/unit/event-schema.test.tsx
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/seo/EventSchema.tsx tests/unit/event-schema.test.tsx
git commit -m "fix(seo): EventSchema uses BroadcastEvent type with publishedOn"
```

---

### Task 5: Fix page metadata — titles, descriptions, canonical, noindex

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/teachers/page.tsx`
- Modify: `src/app/scheduled-list/page.tsx`
- Modify: `src/app/sleep-timer/page.tsx`

- [ ] **Step 1: Home page — update title and description in `src/app/page.tsx`**

Find the `metadata` export (lines 9-13). Change:

```typescript
export const metadata: Metadata = {
  title: 'Listen',
  description: 'Reach Radio features Bible teachings and Christian music. Listen online or on the air in Tucson at 106.7FM and 690AM.',
  alternates: { canonical: '/' },
}
```

To:

```typescript
export const metadata: Metadata = {
  title: 'Listen Live',
  description: "Stream Reach Radio live — Tucson's Christian radio station. Bible teachings and gospel music on 106.7FM and 690AM.",
  alternates: { canonical: '/' },
}
```

- [ ] **Step 2: Teachers page — strengthen description in `src/app/teachers/page.tsx`**

Find the `metadata` export (lines 16-31). Change only the `description` field in all three places it appears (metadata, openGraph, twitter):

```typescript
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
```

- [ ] **Step 3: Schedule page — add canonical + BreadcrumbJsonLd in `src/app/scheduled-list/page.tsx`**

3a. In the `metadata` export (lines 10-13), add `alternates`:

```typescript
export const metadata: Metadata = {
  title: 'Full Schedule',
  description: 'Full programming schedule for Reach Radio 106.7FM / 690AM',
  alternates: { canonical: '/scheduled-list' },
}
```

3b. Add the import at the top of the file (after existing imports):

```typescript
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
```

3c. In the JSX return, add `<BreadcrumbJsonLd />` immediately after `<EventSchema events={allEvents} />` (around line 64):

```tsx
<EventSchema events={allEvents} />
<BreadcrumbJsonLd items={[
  { name: 'Home', url: '/' },
  { name: 'Full Schedule', url: '/scheduled-list' },
]} />
```

- [ ] **Step 4: Sleep timer — add noindex in `src/app/sleep-timer/page.tsx`**

Find the `metadata` export (lines 5-7). Change:

```typescript
export const metadata: Metadata = {
  title: 'Sleep Timer',
}
```

To:

```typescript
export const metadata: Metadata = {
  title: 'Sleep Timer',
  robots: { index: false, follow: false },
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/teachers/page.tsx src/app/scheduled-list/page.tsx src/app/sleep-timer/page.tsx
git commit -m "fix(seo): improve metadata titles and descriptions for local visibility"
```

---

### Task 6: Move RadioStationSchema to root layout

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

`sanityFetch` uses `'use cache'` — calls with the same query + params deduplicate across the same render. Both `layout.tsx` `generateMetadata` and `RadioStationSchema` call `siteSettingsQuery` and `appSettingsQuery`, so no extra Sanity round-trips occur.

- [ ] **Step 1: Remove `RadioStationSchema` from `src/app/page.tsx`**

1a. Remove the import line:
```typescript
import { RadioStationSchema } from '@/components/seo/RadioStationSchema'
```

1b. Remove the JSX usage:
```tsx
<RadioStationSchema />
```

The home page JSX return should go from:
```tsx
<div className="px-4 md:px-8 pt-4 space-y-6 pb-32">
  <h1 className="sr-only">Reach Radio</h1>
  <RadioStationSchema />
  ...
```

To:
```tsx
<div className="px-4 md:px-8 pt-4 space-y-6 pb-32">
  <h1 className="sr-only">Reach Radio</h1>
  ...
```

- [ ] **Step 2: Add `RadioStationSchema` to `src/app/layout.tsx`**

2a. Add import at the top with other SEO imports:
```typescript
import { RadioStationSchema } from '@/components/seo/RadioStationSchema'
```

2b. In the JSX, add `<RadioStationSchema />` directly after `<WebSiteSchema />` (around line 112):

```tsx
<WebSiteSchema />
<RadioStationSchema />
<a href="#main-content" ...>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat(seo): move RadioStationSchema to root layout for site-wide entity signal"
```

---

## Verification

After all tasks, run a build to confirm no regressions:

```bash
npm run build
```

Expected: build succeeds, no TypeScript or lint errors. Check for any `Dynamic server usage` warnings — there should be none in `sitemap.ts` now that `force-dynamic` is removed.

To verify the JSON-LD on the live site after deploy, use [Google's Rich Results Test](https://search.google.com/test/rich-results) on `https://reach.radio` and `https://reach.radio/scheduled-list`.
