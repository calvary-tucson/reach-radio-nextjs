# Review Fixes — Design Spec
Date: 2026-05-15

## Overview

Fix all issues flagged in the full review (critical bugs, security, a11y, SEO, perf/warnings, types). Five parallel agents, each owning an independent concern group.

---

## Group 1 — Bugs + Security

### SSE interval leak (`src/app/api/stream-info-sse/route.ts`)
`ReadableStream.start()` return value is ignored; the cancel function is never wired up. Fix: move `interval` to outer scope and pass `cancel: () => clearInterval(interval)` as a named key in the `UnderlyingSource` object.

### SleepTimerProvider in app mode (`src/app/layout.tsx`)
`<SleepTimerProvider />` renders unconditionally; in mobile-app mode there is no `AudioProvider`, so the timer fires `setIsPlaying(false)` against nothing. Fix: wrap with `{!isMobileApp && <SleepTimerProvider />}`.

### Email validation (`src/actions/contact.ts`)
No format check on `email`. Fix: add RFC-5322-ish regex check (or simple `@` + domain presence check) after the typeof guard, before the network calls.

### BridgeInit origin (`src/components/bridge/BridgeInit.tsx`)
`handleMessage` sets `mobile-app=true` cookie for any `message` event regardless of origin. Fix: add `if (event.origin !== window.location.origin && event.origin !== '') return` guard, preserving WebView null-origin behaviour.

### JSON-LD `</script>` escape (`src/components/seo/*.tsx`)
`JSON.stringify` can emit `</script>` if CMS data contains it. Fix: add `safeJsonLd(obj)` helper that calls `JSON.stringify` then replaces all `</script>` with `<\/script>`. Apply to all three schema components.

---

## Group 2 — Accessibility

Six WCAG failures + focus-visible + touch targets.

- **Logo link names** (Header, MobileHeader): add `aria-label="Reach Radio home"` to logo `<Link>`.
- **Card link names** (TeacherCard): add `aria-label={teacher.name}` to card `<Link>`.
- **Heading hierarchy** (teachers/[slug]/page.tsx): second `<h2>` label ("Schedule") is fine; confirm no skipped levels. The `title/subtitle` h2 should remain.
- **MediaBar landmark**: add `role="region"` + `aria-label="Media player"` to the fixed `<div>`.
- **SearchBar label**: label already exists (`sr-only`); verify focus-visible ring on input is styled (currently `focus:ring-1 focus:ring-white/20` — upgrade to `focus-visible:ring-2 focus-visible:ring-white`).
- **Focus-visible**: add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white` to nav links (Header, MobileHeader, MobileNav, Footer) and teacher links.
- **Touch targets** (MobileNav items): ensure `min-h-[44px] min-w-[44px]` on each nav item. Search input already has `py-2` — add `min-h-[44px]`.

---

## Group 3 — SEO

### og-image.png
Generate a 1200×630 PNG: reach_radio_logo.svg centred on brand purple background (`#2D1B69`). Save to `public/og-image.png`. Use sharp or canvas in a one-shot Node script run locally.

### Canonical URLs
Add `alternates: { canonical: '/' }` (or full URL) to each page's `generateMetadata` or static `metadata` export. Pages: `/`, `/about`, `/donate`, `/teachers`, `/teachers/[slug]`, `/teachers/search`.

---

## Group 4 — Performance / Warnings

### Teacher revalidation
`/teachers/[slug]/page.tsx` uses `generateStaticParams` but has no `revalidate`. Add `export const revalidate = 3600` (1 hour) to both `teachers/page.tsx` and `teachers/[slug]/page.tsx`.

### Donate iframe sandbox
Add `sandbox="allow-scripts allow-forms allow-same-origin allow-popups"` to `<iframe>` in `donate/page.tsx`.

### Donate skeleton height CLS
Skeleton height is `h-[800px]`; iframe is `min-h-[1000px]`. Align skeleton to `h-[1000px]`.

---

## Group 5 — Types + Suggestions

### `TeacherSummary.photo` type
Change `photo: string` → `photo: string | null` in `src/lib/sanity/types.ts`. Update all callsites: `TeacherCard`, `teachers/[slug]/page.tsx` already guards with `teacher.photo &&` so they're safe.

### SSE retry jitter
In `useNowPlaying.ts`, add jitter: `const delay = Math.pow(2, retries) * 1000 + Math.random() * 500`.

### Default album art → local asset
`media-store.ts` has `DEFAULT_IMAGE` pointing to a Sanity CDN URL. This is a live production asset; replacing it requires downloading the image and committing it to `public/`. **Defer** — no local copy available, and the CDN URL is stable for now.

---

## What's excluded

Suggestions that are pure refactor with no bug/UX impact:
- Extract scroll-hide logic to shared hook (deferred; zero user impact)
- Happy-path test for contact action (no test infrastructure exists yet)
