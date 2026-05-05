# Full Review Fixes — Design Spec
Date: 2026-05-04

Addresses all Critical, Warning, and Suggestion findings from the Full Review of Reach Radio Next.js (22 files, last 5 commits + uncommitted changes).

---

## Scope

All three tiers from the review:
- 7 Critical fixes
- 8 Warning fixes
- 7 Suggestion fixes

---

## Execution Strategy

4 parallel subagents with no file overlap. Each agent commits its own changes.

---

## Agent 1 — Infrastructure

**Files:** `next.config.ts`, `src/app/api/revalidate/route.ts`

### Changes

**`next.config.ts`**
- `media-src` directive: add `*.radiojar.com` so the RadioJar fallback stream URL is not blocked by CSP in production.
- `connect-src` already includes `*.radiojar.com` — no change needed there.

**`src/app/api/revalidate/route.ts`**
- Add `appSettings: 'settings'` to `TAG_MAP` so Sanity webhook for `_type: "appSettings"` correctly revalidates the stream URL cache.
- `revalidateTag(tag, 'days')` → `revalidateTag(tag)` — second argument is not a valid parameter; remove it.

---

## Agent 2 — SSE / Audio / Store

**Files:** `src/app/api/stream-info-sse/route.ts`, `src/hooks/useNowPlaying.ts`, `src/components/AudioProvider.tsx`, `src/components/media-bar/MediaBar.tsx`, `src/lib/store/media-store.ts`, `src/components/SleepTimerProvider.tsx`

### Changes

**`src/app/api/stream-info-sse/route.ts`**
- `setInterval(poll, 10_000)` → `setInterval(poll, 30_000)` — radio track changes are infrequent; 30s cuts server-side RadioJar requests by 2/3.

**`src/hooks/useNowPlaying.ts`**
- Replace `es.onerror = () => es.close()` with bounded exponential backoff retry.
- Max 5 retries; delays: 1s → 2s → 4s → 8s → 16s.
- After exhausting retries, close permanently (same end state as current, but tolerates transient blips).
- Keep cleanup `return () => es.close()`.

**`src/components/AudioProvider.tsx`**
- Call `useNowPlaying()` here. AudioProvider is always mounted when a stream URL is available, making it the correct home for SSE management.
- `play().catch(err)`: add `console.error('[AudioProvider] play failed:', err)` before `setIsPlaying(false)` — surfaces autoplay policy rejections for debugging.

**`src/components/media-bar/MediaBar.tsx`**
- Remove `useNowPlaying()` call — now owned by AudioProvider.
- No other changes.

**`src/lib/store/media-store.ts`**
- Add `startSleepTimer(seconds: number)` action: sets `remainingSleepSeconds: seconds` and `sleepTimerActive: true` atomically. Callers no longer need two sequential mutations.
- Update `MediaState` interface accordingly.

**`src/providers/SleepTimerProvider.tsx`**
- Fix `useEffect` dependency array to `[sleepTimerActive]` only. Zustand setters are referentially stable; including them causes unnecessary effect re-runs.

---

## Agent 3 — UI Components

**Files:** `src/components/home/RadioPlayer.tsx`, `src/components/home/VolumeControl.tsx`, `src/components/media-bar/PlayPauseButton.tsx`, `src/components/home/SleepTimerOverlay.tsx`, `src/components/teachers/TeacherCard.tsx`, `src/components/teachers/SearchBar.tsx`

### Changes

**`src/components/home/RadioPlayer.tsx`**
- Image `width={256} height={256}` → `width={420} height={420}` — matches the CSS `max-w-[420px]` slot; eliminates upscaling.
- Replace `<Image role="button" tabIndex={0} onClick={...}>` with `<button onClick={...} aria-label={...}><Image .../></button>`. The `aria-label`, `onKeyDown`, `tabIndex`, and `role` move to or are removed from the button. This satisfies WCAG 4.1.2.
- `IntersectionObserver` cleanup: call `setShowMediaBar(false)` in the cleanup function so stale `showMediaBar: true` state doesn't persist after component unmount.

**`src/components/home/VolumeControl.tsx`**
- Mobile mute button: `w-9 h-9` → `w-11 h-11` (36px → 44px, WCAG 2.5.5 minimum).
- Replace `focus-visible:outline focus-visible:outline-2 focus-visible:outline-white` with `focus-visible:ring-2 focus-visible:ring-white` on both mute buttons and add `focus-visible:ring-2 focus-visible:ring-white rounded` to the range slider wrapper for consistent focus visibility.

**`src/components/media-bar/PlayPauseButton.tsx`**
- `w-10 h-10` → `w-11 h-11` (40px → 44px) — standardizes all radio player touch targets to 44px.

**`src/components/home/SleepTimerOverlay.tsx`**
- Add `role="dialog"` and `aria-label="Sleep timer active"` to the overlay container (WCAG 1.3.1).
- Cancel button: replace `text-sm text-white/70 underline` with `bg-white/20 text-white px-4 py-2 rounded text-sm hover:bg-white/30` — more discoverable, maintains existing `focus-visible` ring.

**`src/components/teachers/TeacherCard.tsx`**
- `hover:scale-105` → `motion-safe:hover:scale-105` (WCAG 2.3.3, respects `prefers-reduced-motion`).
- Add `blurDataURL={teacher.lqip}` and `placeholder={teacher.lqip ? "blur" : "empty"}` props once Agent 4 adds `lqip?: string` to `TeacherSummary`. Agent 3 owns all TeacherCard file changes.

**`src/components/teachers/SearchBar.tsx`**
- Submit button: add `min-h-[44px]` to ensure 44px touch target on mobile.

---

## Agent 4 — Pages

**Files:** `src/app/teachers/page.tsx`, `src/app/teachers/search/page.tsx`, `src/app/teachers/[slug]/page.tsx`, `src/app/scheduled-list/page.tsx`, `src/lib/sanity/types.ts`, `src/lib/sanity/queries.ts`

**New files:** `src/components/seo/EventSchema.tsx`

**Note on TeacherCard:** Agent 4 updates `types.ts` and `queries.ts` to add `lqip`. Agent 3 owns `TeacherCard.tsx` and adds the `blurDataURL` prop there. These files do not overlap — no conflict.

### Changes

**`src/app/teachers/[slug]/page.tsx`**
- Wrap `sanityFetch(teacherDetailQuery, { slug }, { tags: ['teachers'] })` in React `cache()` — creates a shared deduplication boundary so `generateMetadata` and the page body share one round-trip.
- Extract as `getTeacher(slug: string)` in the same file or a co-located loader.

**`src/app/teachers/search/page.tsx`**
- `<Suspense>` around `<SearchResults>`: add `fallback={<TeacherGridSkeleton />}`.
- Wrap result count `<p>` in `<div aria-live="polite" aria-atomic="true">` — screen readers announce count changes (WCAG 4.1.3).
- Add `robots: { index: false }` to page metadata — thin content (no query param state = no useful index target).

**`src/app/teachers/page.tsx`**
- `<Suspense>` around `<SearchBar>`: add `fallback={<div className="h-[52px] mb-6" />}` — preserves layout height during hydration, prevents CLS.

**`src/app/scheduled-list/page.tsx`**
- Remove local `RawTeacher` interface.
- Add `TeacherWithSchedule` to `src/lib/sanity/types.ts`: `export type TeacherWithSchedule = TeacherSummary & { schedule: ScheduleDay[] }`.
- Import and use `TeacherWithSchedule` in `scheduled-list/page.tsx`.
- Avatar `<Image>`: add `style={{ width: 40, height: 40 }}` to fix aspect ratio warning (explicit CSS dimensions match intrinsic dimensions).
- Add empty state: if `byDay.length === 0`, render `<p className="text-white/60">No schedule available.</p>`.

**`src/components/seo/EventSchema.tsx`** (new)
- JSON-LD `Event` schema for each schedule slot.
- Props: `events: Array<{ name: string; startTime: string; endTime: string; day: string }>`.
- Renders `<script type="application/ld+json">` with `@context: "https://schema.org"`, `@type: "Event"`, `name`, `startDate` (constructed from day + time strings), `organizer`.
- Used in `scheduled-list/page.tsx`.

**`placeholder="blur"` for teacher photos and album art**
- Update `teacherListQuery` and `teacherDetailQuery` in `src/lib/sanity/queries.ts` to include `"lqip": photo.asset->metadata.lqip`.
- Update `TeacherSummary` in `types.ts`: add `lqip?: string`.
- Update `TeacherCard.tsx` (Agent 3 already touches this) and `TeacherDetailPage` to pass `placeholder="blur"` + `blurDataURL={teacher.lqip}` when `lqip` is present.
- Agent 4 owns query/type changes only. Agent 3 owns all `TeacherCard.tsx` changes including the `blurDataURL` prop. No file overlap between agents.

---

## Commit Strategy

Each agent commits its own group with conventional commit format:
- Agent 1: `fix(security): add radiojar to media-src CSP; fix revalidate tag map and args`
- Agent 2: `fix(sse): bounded retry backoff, 30s poll, move useNowPlaying to AudioProvider, atomic startSleepTimer`
- Agent 3: `fix(ui): 44px touch targets, motion-safe scale, a11y semantics on radio player controls`
- Agent 4: `fix(pages): dedupe teacher fetch, Suspense fallbacks, aria-live, EventSchema, placeholder blur`

---

## Out of Scope

- `noindex` on teacher search is added but canonical URLs on other pages are deferred.
- JSON-LD for teachers (`Person` schema) is already implemented via `PersonSchema` component in teacher detail — no change needed.
- Color contrast on `text-white/60` and `placeholder:text-white/40` — flagged but not changed (design token decision, affects brand identity; should be a separate design review).
- `startSleepTimer` atomic action added to store but callers (`SleepTimerButton`/page) updated to use it.
