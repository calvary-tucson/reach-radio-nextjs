# SEO Enhancement — Design Spec

**Date:** 2026-05-26
**Priority order:** C (teacher discoverability) → A (local search dominance) → B (social sharing)

## Goals

- Each teacher has a strong, independent presence in Google search results
- Reach Radio ranks for Tucson Christian radio / local queries via rich structured data
- Every page produces a polished social preview when shared

---

## Section 1 — Bug Fixes

Three schema components hardcode the wrong domain (`reach-radio.com` instead of `reach.radio`):

| File | Fields to fix |
|---|---|
| `src/components/seo/RadioStationSchema.tsx` | `url`, `broadcaster.url` |
| `src/components/seo/PersonSchema.tsx` | `worksFor.url` |
| `src/components/seo/EventSchema.tsx` | `organizer.url` |
| `src/app/teachers/[slug]/page.tsx` | `url` prop passed to `PersonSchema` |

All `reach-radio.com` → `reach.radio`.

---

## Section 2 — Schema Enrichment

### 2a. `RadioStationSchema` — dynamic, Sanity-sourced

Convert from static to async Server Component. Fetch `siteSettings` + `appSettings.radioAudioURL`.

New fields added:
- `name`, `description`, `logo` from Sanity `siteSettings`
- `sameAs` array from Sanity `twitterHandle` and `facebookPage`
- `genre: ['Christian', 'Gospel', 'Bible Teaching']`
- `broadcastFrequency`: structured `BroadcastFrequencySpecification` array:
  - `{ broadcastFrequency: '106.7', broadcastSignalModulation: 'FM' }`
  - `{ broadcastFrequency: '690', broadcastSignalModulation: 'AM' }`
- `potentialAction` → `ListenAction`:
  ```json
  {
    "@type": "ListenAction",
    "target": "<stream URL from appSettings.radioAudioURL>"
  }
  ```

### 2b. `PersonSchema` — enrich with teacher data

New props added to interface: `description?: string`, `knowsAbout?: string[]`, `sameAs?: string[]`

Fields added to schema output:
- `description`: `"Listen to ${name} on Reach Radio Tucson"`
- `knowsAbout: ['Bible Teaching', 'Christian Ministry', 'Gospel']`
- `sameAs`: teacher's `links[].url` array (external links already shown on page)
- `worksFor.url`: corrected to `https://reach.radio`

Caller (`teachers/[slug]/page.tsx`) passes `links` to `PersonSchema`.

### 2c. New: `BreadcrumbSchema` component

New file: `src/components/seo/BreadcrumbSchema.tsx`

Props: `items: Array<{ name: string; url: string }>`

Renders `BreadcrumbList` JSON-LD. Usage:

| Page | Breadcrumb |
|---|---|
| `/teachers/[slug]` | Home → Teachers → [Teacher Name] |
| `/about` | Home → About |
| `/donate` | Home → Donate |
| `/about/privacy-policy` | Home → About → Privacy Policy |

### 2d. New: `WebSiteSchema` component

New file: `src/components/seo/WebSiteSchema.tsx`

Async Server Component. Fetches `siteSettings` for `name` and `description`.

Schema:
```json
{
  "@type": "WebSite",
  "name": "<siteTitle>",
  "url": "https://reach.radio",
  "description": "<siteDescription>",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://reach.radio/teachers?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

Rendered in root `layout.tsx` as a direct child inside `<body>`, alongside `<BridgeInit />` and other layout-level components.

---

## Section 3 — Dynamic OG Images for Teacher Pages

### File: `src/app/teachers/[slug]/opengraph-image.tsx`

Next.js file-based OG image route handler. Statically generated at build via `generateStaticParams` (reuses the same teacher slugs).

**Image spec:** 1200×630px, `image/png`

**Layout with photo:**
- Full-bleed background: purple gradient (`#1e1040` → `#2D1B69`, 135deg)
- Left half: teacher photo (square crop, covers full height)
- Right half (flex column, centered vertically, padded):
  - Teacher name — white, 56px, weight 800
  - Teacher title — green (`#22C55E`), 28px, weight 600, uppercase, letter-spacing
  - Bottom-right corner: "Reach Radio" wordmark — white/50, 20px

**Layout without photo (fallback):**
- Same gradient background
- Centered column: name, title, "Reach Radio" wordmark

**Data fetching:** `teacherDetailQuery` (already has `name`, `title`, `photo`). Has its own `generateStaticParams` exporting teacher slugs (same pattern as `page.tsx`). Fetches independently — `opengraph-image.tsx` is a separate route context from `page.tsx` and cannot share `cache()`.

**Teacher detail `generateMetadata` change:** Remove explicit `openGraph.images` field — file-based OG takes precedence automatically, removing it avoids duplication.

---

## Section 4 — Sitemap + Per-Teacher Metadata

### Sitemap (`src/app/sitemap.ts`)

Add `lastModified`, `changeFrequency`, `priority` to all routes:

| Route | changeFrequency | priority |
|---|---|---|
| `/` | `hourly` | `1.0` |
| `/teachers` | `daily` | `0.9` |
| `/teachers/[slug]` | `weekly` | `0.8` |
| `/scheduled-list` | `daily` | `0.7` |
| `/about` | `monthly` | `0.6` |
| `/donate` | `monthly` | `0.6` |
| `/sleep-timer` | `monthly` | `0.3` |
| `/about/privacy-policy` | `monthly` | `0.3` |

### Teacher detail `generateMetadata`

Enrich beyond current minimal implementation:

```typescript
{
  title: teacher.name,
  description: `Listen to ${teacher.name} — ${teacher.title} on Reach Radio Tucson 106.7FM / 690AM`,
  alternates: { canonical: `/teachers/${slug}` },
  openGraph: {
    type: 'profile',
    title: teacher.name,
    description: `Listen to ${teacher.name} — ${teacher.title} on Reach Radio Tucson 106.7FM / 690AM`,
    url: `/teachers/${slug}`,
    // No images field — handled by opengraph-image.tsx
  },
  twitter: {
    card: 'summary_large_image',
    title: teacher.name,
    description: `Listen to ${teacher.name} — ${teacher.title} on Reach Radio Tucson 106.7FM / 690AM`,
  },
}
```

---

## Files Touched

| File | Change |
|---|---|
| `src/components/seo/RadioStationSchema.tsx` | Dynamic, Sanity-sourced, add ListenAction |
| `src/components/seo/PersonSchema.tsx` | Add description/knowsAbout/sameAs props + URL fix |
| `src/components/seo/EventSchema.tsx` | URL fix only |
| `src/components/seo/BreadcrumbSchema.tsx` | New component |
| `src/components/seo/WebSiteSchema.tsx` | New component |
| `src/app/layout.tsx` | Add `<WebSiteSchema />` |
| `src/app/teachers/[slug]/opengraph-image.tsx` | New dynamic OG image handler |
| `src/app/teachers/[slug]/page.tsx` | Pass links to PersonSchema, enrich generateMetadata, remove OG images field |
| `src/app/about/page.tsx` | Add BreadcrumbSchema |
| `src/app/donate/layout.tsx` | Add BreadcrumbSchema |
| `src/app/about/privacy-policy/page.tsx` | Add BreadcrumbSchema |
| `src/app/sitemap.ts` | Add lastModified/changeFrequency/priority |

---

## Out of Scope

- Audio recordings / sermon archives (teachers are bio+schedule+links only)
- Google Business Profile integration
- Web app manifest
- Per-page OG images beyond teacher pages
