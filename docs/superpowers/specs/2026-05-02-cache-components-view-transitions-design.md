# Cache Components + View Transitions — Design Spec

**Date:** 2026-05-02
**Status:** Approved

## Overview

Two Next.js 16 feature adoptions:

1. **Cache Components migration** — replace `react.cache()` + `next: { tags }` fetch options with `cacheComponents: true` + `use cache` directive + `cacheLife`/`cacheTag`.
2. **View Transitions** — photo morph on teacher list→detail navigation, directional slides for forward/back, header anchoring.

---

## Part 1: Cache Components Migration

### Config

Enable in `next.config.ts`:

```ts
cacheComponents: true
```

### `src/lib/sanity/client.ts`

Replace current implementation:

- Remove `import 'server-only'` (unnecessary — `use cache` functions are server-only by nature)
- Remove `react.cache()` wrapper
- Remove `next: { tags, revalidate }` from fetch options
- Add `'use cache'` directive inside `sanityFetch`
- Import `cacheLife`, `cacheTag` from `'next/cache'`
- Add `cacheLife('days')` for time-based fallback expiry
- Add `cacheTag(...tags)` when tags are provided
- Drop `revalidate` from the options type signature

Callers (`teachers/page.tsx`, `teachers/[slug]/page.tsx`, `home/RadioPlayer.tsx`, `home/TodaySchedule.tsx`) remain unchanged. Only the `revalidate` option is removed from the type — no callers currently use it.

### `src/app/api/revalidate/route.ts`

Verify `revalidateTag` is the revalidation primitive (not `revalidatePath`). No change expected — already uses tag-based revalidation.

### Cache lifetime rationale

- `cacheLife('days')`: content (teacher bios, schedule) changes infrequently. Day-level expiry is a safe fallback if the Sanity webhook misses.
- `revalidateTag` via webhook remains the primary invalidation path for on-demand freshness.

---

## Part 2: View Transitions

### Config

Enable in `next.config.ts`:

```ts
experimental: {
  viewTransition: true,
  serverComponentsHmrCache: true, // already present
}
```

### Photo morph — teacher grid → detail

**`src/components/teachers/TeacherCard.tsx`**

- Import `ViewTransition` from `'react'`
- Wrap `<Image>` in `<ViewTransition name={`teacher-${teacher.slug}`}>` — inside the existing `{teacher.photo && (...)}` conditional
- Add `transitionTypes={['nav-forward']}` to the wrapping `<Link>`

**`src/app/teachers/[slug]/page.tsx`**

- Import `ViewTransition` from `'react'`
- Wrap hero `<Image>` in `<ViewTransition name={`teacher-${slug}`}>` — inside the existing `{teacher.photo && (...)}` conditional
- Add `transitionTypes={['nav-back']}` to the `← Teachers` link

Matching `name` props on both pages cause the browser to morph the thumbnail into the hero image on forward navigation, and reverse on back.

### Directional slides

CSS in `src/app/globals.css`:

- `nav-forward`: old content slides left (150ms), new content slides in from right (210ms, 150ms delay)
- `nav-back`: reverse — old content slides right, new content slides in from left
- Slide offset: `60px` — enough to read direction without tracking a fast element
- Asymmetric timing: fast exit so old content doesn't compete; slower enter so user can register new content

### Header anchor

**`src/components/layout/Header.tsx`**

- Add `style={{ viewTransitionName: 'site-header' }}` to `<header>`

CSS in `globals.css`:

- `::view-transition-group(site-header)` — `animation: none`, `z-index: 100`
- `::view-transition-old(site-header)` — `display: none` (prevents double-header flash)
- `::view-transition-new(site-header)` — `animation: none`

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*),
  ::view-transition-group(*) {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
  }
}
```

Instant swap — browser default behavior. No positional movement for motion-sensitive users.

### Scope

View transitions apply only to teacher list↔detail navigation. Top-level nav (Home, About, Donate, etc.) is not annotated and produces no transition animation.

---

## Files Changed

| File | Change |
|------|--------|
| `next.config.ts` | Add `cacheComponents: true`, `experimental.viewTransition: true` |
| `src/lib/sanity/client.ts` | Replace `react.cache` + fetch options with `use cache` + `cacheLife` + `cacheTag` |
| `src/app/api/revalidate/route.ts` | Verify `revalidateTag` usage (likely no change) |
| `src/components/teachers/TeacherCard.tsx` | Add `<ViewTransition>` on image, `transitionTypes` on link |
| `src/app/teachers/[slug]/page.tsx` | Add `<ViewTransition>` on hero image, `transitionTypes` on back link |
| `src/components/layout/Header.tsx` | Add `viewTransitionName` style |
| `src/app/globals.css` | Add view transition keyframes and rules |

---

## Out of Scope

- View transitions on top-level navigation
- Crossfade on teacher search results
- Any other pages or routes
