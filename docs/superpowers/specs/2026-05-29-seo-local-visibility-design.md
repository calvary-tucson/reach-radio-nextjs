# SEO Local Visibility — Design Spec

**Date:** 2026-05-29
**Goal:** Strengthen local search visibility for Tucson Christian radio queries.  
**Context:** Previous SEO spec (2026-05-26) is fully implemented. This spec addresses remaining gaps found in a fresh audit.

---

## Audit Summary

Previous spec covered schema structure and OG images — both done. Remaining gaps:

| Severity | Gap |
|---|---|
| 🔴 | Sitemap `lastModified` = `new Date()` every request — misleads crawlers |
| 🔴 | `sitemap.ts` is `force-dynamic` — runs on every request unnecessarily |
| 🟡 | Home page title is "Listen" — no location or frequency signal |
| 🟡 | `Teachers` page description is weak ("many great bible teachers") |
| 🟡 | `BreadcrumbJsonLd` missing from `/scheduled-list` |
| 🟡 | `</script>` escaping missing in `BreadcrumbJsonLd` and `OrganizationSchema` |
| 🟡 | `EventSchema` uses `Event` type — wrong for recurring radio programs |
| 🟢 | `/sleep-timer` indexed — utility page wastes crawl budget |
| 🟢 | `RadioStationSchema` only on home page |

---

## Section 1 — Metadata: Titles & Descriptions

**Goal:** Every page title and description carries location + frequency keywords.

### 1a. Home page (`src/app/page.tsx`)

Current: `title: 'Listen'` → renders "Listen | Reach Radio"

Change to:
```typescript
title: 'Listen Live',
description: 'Stream Reach Radio live — Tucson\'s Christian radio station. Bible teachings and gospel music on 106.7FM and 690AM.',
```
Renders: "Listen Live | Reach Radio"

### 1b. Teachers page (`src/app/teachers/page.tsx`)

Current: `description: 'Listen to many great bible teachers on Reach Radio Tucson.'`

Change to:
```typescript
description: 'Hear nationally-known Bible teachers on Reach Radio — Tucson\'s Christian station at 106.7FM and 690AM.',
```

### 1c. Schedule page (`src/app/scheduled-list/page.tsx`)

Current: `description: 'Full programming schedule for Reach Radio 106.7FM / 690AM'`
Add canonical:
```typescript
alternates: { canonical: '/scheduled-list' },
```
Description is already adequate — no change needed.

### 1d. About page (`src/app/about/page.tsx`)

Current description is adequate. No change.

---

## Section 2 — Sitemap Accuracy

**File:** `src/app/sitemap.ts`

### 2a. Remove `force-dynamic`

Remove: `export const dynamic = 'force-dynamic'`

Add: `export const revalidate = 86400` (revalidate daily, matching teacher ISR schedule)

### 2b. Accurate `lastModified` for teacher routes

Add a new `teacherSlugsWithDatesQuery` in `src/lib/sanity/queries.ts` — do NOT modify `teacherSlugsQuery`, which is used by `generateStaticParams` in `teachers/[slug]/page.tsx` and `teachers/[slug]/opengraph-image.tsx`. Changing its shape would break those callers.

New query returns `{ slug: string; updatedAt: string }[]`:
```groq
*[_type == "teacher" && defined(slug.current)] | order(name asc) {
  "slug": slug.current,
  "updatedAt": _updatedAt
}
```

`sitemap.ts` uses `teacherSlugsWithDatesQuery` instead of `teacherSlugsQuery`. Other callers unchanged.

Sitemap teacher routes:
```typescript
const teacherRoutes: MetadataRoute.Sitemap = slugs.map((t) => ({
  url: `${BASE_URL}/teachers/${t.slug}`,
  changeFrequency: 'weekly' as const,
  priority: 0.8,
  lastModified: new Date(t.updatedAt),
}))
```

Static routes: omit `lastModified` entirely. An accurate "never" (omitted) is more trustworthy to crawlers than an inaccurate hardcoded date or a live timestamp that claims everything changed right now.

---

## Section 3 — Schema Fixes

### 3a. `</script>` escaping — `BreadcrumbJsonLd` and `OrganizationSchema`

Both currently use unescaped `JSON.stringify`. Add `.replace(/<\/script>/gi, '<\\/script>')` consistently.

**`src/components/seo/BreadcrumbJsonLd.tsx`:**
```typescript
dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/<\/script>/gi, '<\\/script>') }}
```

**`src/components/seo/OrganizationSchema.tsx`:**
Current uses `.replace(/<\//g, '<\\/')` — too broad (replaces all closing tags). Replace with:
```typescript
dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/<\/script>/gi, '<\\/script>') }}
```

### 3b. `EventSchema` → `BroadcastEvent`

Current `EventSchema` uses `@type: 'Event'` which won't qualify for Google Event rich results without ISO `startDate`. Recurring radio programs are semantically `BroadcastEvent`.

Change the item type from `Event` to `BroadcastEvent` and add `publishedOn` linking back to the station:

```typescript
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
```

No `startDate` — recurring programs don't have a specific date. Note: `BroadcastEvent` extends `Event` in schema.org, so Google's Event rich result validator may still flag missing `startDate`. The change is semantically more accurate regardless — it correctly describes what the content is. Rich result eligibility for this page is not a realistic goal without real ISO dates.

### 3c. `BreadcrumbJsonLd` on `/scheduled-list`

`/scheduled-list/page.tsx` already renders the `<Breadcrumbs>` UI component but has no JSON-LD equivalent. Add:

```tsx
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'

// In the component return, before the Breadcrumbs UI:
<BreadcrumbJsonLd items={[
  { name: 'Home', url: '/' },
  { name: 'Full Schedule', url: '/scheduled-list' },
]} />
```

### 3d. `RadioStationSchema` in root layout

Move `<RadioStationSchema />` from `src/app/page.tsx` into the root `src/app/layout.tsx` so Google sees station identity on every page. Remove it from `page.tsx`.

`RadioStationSchema` is already an async Server Component that fetches from Sanity with `tags: ['siteSettings', 'appSettings']`. Both tags are already fetched in `layout.tsx` `generateMetadata`. Whether the fetches deduplicate depends on whether `sanityFetch` uses React `cache()` internally — verify in `src/lib/sanity/client.ts` before implementing. If it does not cache, this adds one Sanity round-trip per page render and may not be worth it; in that case keep `RadioStationSchema` on the home page only.

---

## Section 4 — Crawl Budget: noindex on `/sleep-timer`

`/sleep-timer` is a pure app utility (sets a countdown timer). Not a search-worthy page.

**`src/app/sleep-timer/page.tsx`:** Add to metadata:
```typescript
robots: { index: false, follow: false },
```

Also remove `/sleep-timer` from `src/app/sitemap.ts` static routes array.

---

## Files Touched

| File | Change |
|---|---|
| `src/app/page.tsx` | Update title/description, remove `<RadioStationSchema />` |
| `src/app/teachers/page.tsx` | Strengthen description |
| `src/app/scheduled-list/page.tsx` | Add canonical, add `<BreadcrumbJsonLd />` |
| `src/app/sleep-timer/page.tsx` | Add `robots: noindex` |
| `src/app/sitemap.ts` | Remove `force-dynamic`, add `revalidate`, accurate `lastModified`, remove sleep-timer |
| `src/lib/sanity/queries.ts` | Add new `teacherSlugsWithDatesQuery` (slug + updatedAt) — original query unchanged |
| `src/components/seo/BreadcrumbJsonLd.tsx` | Fix `</script>` escaping |
| `src/components/seo/OrganizationSchema.tsx` | Fix `</script>` escaping |
| `src/components/seo/EventSchema.tsx` | Change `Event` → `BroadcastEvent`, add `publishedOn` |
| `src/app/layout.tsx` | Add `<RadioStationSchema />` |

---

## Out of Scope

- Google Search Console setup / verification
- Google Business Profile
- Podcast / sermon archive schemas
- Web app manifest
- hreflang (English-only site)
