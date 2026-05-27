# Teachers Page Redesign — Spec

**Date:** 2026-05-27
**Status:** Approved

## Problem

The Teachers page had no highlighted editorial picks section, and its inline search/filter pattern created a layout and UX problem: adding a featured teachers section above the search would push the search bar below the fold. The home page's `FeaturedTeachers` carousel component was a home-page-specific widget (120px thumbnails, horizontal scroll) mismatched with the Teachers page browse grid.

## Goals

1. Show 5 editorially curated "Recommended" teachers at the top of the Teachers page using the same visual language as the full grid.
2. Move search/filter into an intercepting-route sheet (same pattern as calvarytucson-nextjs) so the page itself is a clean browse experience.
3. Build reusable modal sheet infrastructure that can serve future use cases.

## Architecture

### Page Layout (after)

```
teachers/page.tsx
├── <h1 className="sr-only">Teachers</h1>
├── ShowMediaBar
├── PassiveSearchBar → href="/teachers/search"
├── RecommendedTeachers (server component)
│   ├── h2 "Recommended" + subtitle "Our editorial picks"
│   └── Grid of 5 TeacherCards (2-col mobile, 3-col tablet, 4-col desktop)
└── TeachersClientView
    ├── h2 "All Teachers" (was h1 "Teachers") + count label
    ├── Tabs: teachers | schedule
    └── Teachers tab: full static grid (no inline search/filter)
```

### Modal Infrastructure (new, reusable)

Ported from calvarytucson-nextjs. Enables intercepting-route sheets app-wide.

**Data flow:**
1. User taps `PassiveSearchBar` (a `ModalLink` wrapping a styled div)
2. `ModalLink.onNavigate` fires → calls `useModalStore.openModal(title, originPath)` + clears navigation skeleton
3. Next.js intercepts `/teachers/search` → renders `@modal/(...)teachers/search/page.tsx` in the `@modal` slot
4. `ModalLayout` (client, in `@modal/layout.tsx`) reads store, wraps content in Radix Dialog + `ModalProvider`
5. `SheetChrome` renders: bottom sheet on mobile (slides up), centered dialog on sm+, drag-to-dismiss
6. On dismiss: `startClosing()` → exit animation plays → `router.back()` → store resets → `@modal` slot renders `default.tsx` (null)
7. Focus restores to trigger element

## Components

### New Infrastructure (copy/adapt from calvarytucson)

| File | Source | Change |
|------|--------|--------|
| `src/lib/stores/modal.ts` | Copy verbatim | — |
| `src/lib/stores/navigation-store.ts` | Copy verbatim | — |
| `src/lib/constants/modal.ts` | Copy verbatim | — |
| `src/components/modals/ModalContext.tsx` | Copy verbatim | — |
| `src/components/modals/ModalLink.tsx` | Copy verbatim | — |
| `src/app/@modal/default.tsx` | Copy verbatim | — |
| `src/app/@modal/[...catchAll]/page.tsx` | Copy verbatim | — |
| `src/app/@modal/layout.tsx` | Retheme | `purple-900/95` → `gray-800`, `purple-700` → `white/10` |
| `src/components/modals/chrome/SheetChrome.tsx` | Retheme | Same color changes; import `useSheetDrag` from `@/lib/hooks/useSheetDrag` (already exists) |
| `src/components/global/PassiveSearchBar.tsx` | Retheme | Adjust border/bg to match reach-radio dark theme |

**`globals.css` additions** — 4 keyframes calvarytucson defines in `animations.css`:
- `modal-slide-up` (enter: translateY(12px)→0, opacity 0→1)
- `modal-slide-down` (exit: translateY(0)→12px, opacity 1→0)
- `fade-in` (opacity 0→1)
- `fade-out` (opacity 1→0)

**`layout.tsx` change** — add `modal` parallel route slot:
```tsx
export default async function RootLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  // ...
  {modal ? <div key="modal">{modal}</div> : null}
```

### New — Teachers-specific

**`src/components/teachers/RecommendedTeachers.tsx`** (server component)
- Fetches highlighted teachers via `highlightedTeachersQuery` + `sortByHighlightedOrder` (existing logic)
- Renders with `h2 "Recommended"` + `<p>Our editorial picks</p>` subtitle
- Grid: same Tailwind column classes as full teacher grid (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4`)
- Uses existing `TeacherCard` component — visual consistency with full grid
- Returns `null` if no teachers found

**`src/app/teachers/search/page.tsx`** (direct route — for cmd+click / direct navigation)
- Fetches `teacherListQuery` + `fullScheduleQuery` (same as teachers page, cached 1hr)
- Renders `TeacherSearchClient` as a full page with back link

**`src/app/@modal/(...)teachers/search/page.tsx`** (intercepting route)
- Same data fetch
- Wraps `TeacherSearchClient` in `SheetChrome title="Search Teachers"`
- `export const revalidate = 3600`

**`src/components/teachers/TeacherSearchClient.tsx`** (client component)

Props: `teachers: TeacherSummary[]`, `scheduleTeachers: TeacherWithSchedule[]`, `initialQuery?: string`

State: `query`, `sort: SortOption | undefined`, `activeDays: string[]`

Uses existing `filterTeachers` util and `computeWeeklyMinutes` — no API call, pure in-memory filtering.

UI structure:
```
[search input — auto-focused on mount]
[day filter pills: Mon Tue Wed Thu Fri Sat Sun]
[sort: A–Z | Z–A | Most on air]
[results count — "X teachers found"]
[result list — compact rows]
  Each row: 44×44 photo thumbnail (rounded-lg) | name (bold) | title (muted) | chevron
  Tap → navigate to /teachers/[slug]
[empty state: "No teachers found. Try a different search."]
```

No URL sync (search state lives only in the open sheet, resets on close).

### Modified

**`src/components/teachers/TeachersClientView.tsx`**
- Remove: `SearchInput`, `FilterSheet`, `useDebounce`, `query`/`debouncedQuery` state, URL sync `useEffect`, `activeFilterCount`, `isFiltered`, `countLabel` (search-aware), filter chip rendering
- Keep: tabs (teachers/schedule), full grid, `ScheduleTabView`
- Change: `h1 "Teachers"` → `h2 "All Teachers"` with static count (`${teachers.length} teachers`)
- Grid always renders `teachers` (full list, no filtering)

**`src/app/teachers/page.tsx`**
- Add `<h1 className="sr-only">Teachers</h1>`
- Add `<PassiveSearchBar href="/teachers/search" placeholder="Search teachers..." />`
- Replace `<FeaturedTeachers showSeeAll={false} />` with `<RecommendedTeachers />`
- Remove `FeaturedTeachers` and `FeaturedTeachersSkeleton` imports

### Deleted

- `src/components/home/FeaturedTeachers.tsx` — replaced by `RecommendedTeachers`
- `src/components/skeletons/FeaturedTeachersSkeleton.tsx` — no longer needed
- `src/components/teachers/FilterSheet.tsx` — absorbed into `TeacherSearchClient`

## Decisions & Trade-offs

- **URL search state dropped.** Search state (`?q=`, `?sort=`, `?days=`) no longer syncs to URL. State lives in the open sheet only, resets on close. Acceptable trade-off for the simpler UX.
- **No separate featured section skeleton.** `RecommendedTeachers` is a server component — data is fetched at page render time alongside teacher list. `Suspense` fallback at page level covers it.
- **5 cards in a 4-col desktop grid** leaves one card alone in the last row on large screens. Acceptable — the editorial section is short and the grid pattern is consistent with the rest of the page.
- **`useSheetDrag`** already exists at `src/lib/hooks/useSheetDrag.ts`. `SheetChrome` should import from that path rather than creating a duplicate.

## Files Summary

| Action | File |
|--------|------|
| New | `src/lib/stores/modal.ts` |
| New | `src/lib/stores/navigation-store.ts` |
| New | `src/lib/constants/modal.ts` |
| New | `src/components/modals/ModalContext.tsx` |
| New | `src/components/modals/ModalLink.tsx` |
| New | `src/components/modals/chrome/SheetChrome.tsx` |
| New | `src/components/global/PassiveSearchBar.tsx` |
| New | `src/app/@modal/default.tsx` |
| New | `src/app/@modal/[...catchAll]/page.tsx` |
| New | `src/app/@modal/layout.tsx` |
| New | `src/app/teachers/search/page.tsx` |
| New | `src/app/@modal/(...)teachers/search/page.tsx` |
| New | `src/components/teachers/TeacherSearchClient.tsx` |
| New | `src/components/teachers/RecommendedTeachers.tsx` |
| Modified | `src/app/layout.tsx` |
| Modified | `src/app/teachers/page.tsx` |
| Modified | `src/components/teachers/TeachersClientView.tsx` |
| Modified | `src/app/globals.css` |
| Deleted | `src/components/home/FeaturedTeachers.tsx` |
| Deleted | `src/components/skeletons/FeaturedTeachersSkeleton.tsx` |
| Deleted | `src/components/teachers/FilterSheet.tsx` |
