# Schedule Visualization & Teachers Page Enhancement

**Date:** 2026-05-26  
**Status:** Draft — pending implementation plan  
**Scope:** Four features: schedule visualization on teachers page, featured teachers on home page, enhanced search with filter bottom sheet, shared BottomSheet primitive

---

## Background

Current state:
- `/teachers` — grid of all teachers, text search only (name/title)
- `/scheduled-list` — plain text list grouped by day
- `/` (home) — RadioPlayer + Today's schedule (upcoming shows for today)
- Teacher detail page shows schedule as a text list

Gap: no visual representation of the week's broadcast schedule; no way to filter teachers by day; no featured teacher curation on home.

---

## Feature 1 — Schedule tab on Teachers page

### Overview

Teachers page gains a tab switcher: **Teachers | Schedule**. The Schedule tab shows a visual time-axis for the selected day. Tap any slot for a bottom sheet with full teacher detail. "Most on air" stat computed from schedule data.

### Tab switcher

`TeachersClientView` becomes a tab host. Two tab states: `'teachers'` (default) and `'schedule'`. Tab state lives in `useState` — not a URL param (schedule tab is a view, not a navigable destination). Tab row renders below the "Teachers" heading, above search.

When "Schedule" tab is active, search + filter controls hide. Day chips and time axis render instead.

### Day chips

Horizontal scrollable row of 7 chips: Sun Mon Tue Wed Thu Fri Sat. Today's day pre-selected on mount (computed client-side via `dayjs().tz('America/Phoenix').format('dddd')`). Selected chip highlighted with `bg-[var(--color-brand-green)]`. Chips not present in URL — ephemeral UI state.

If selected day has no scheduled teachers, show "No shows scheduled" message with the music fallback image.

### Time axis

Fixed range: **5:00 AM – 11:00 PM** (covers all realistic broadcast slots; confirmed by looking at schedule data format). 1-hour tick marks on left column. Teacher slots render as positioned divs overlaid on the grid.

**Slot positioning formula:**
```
const AXIS_START = 5 * 60  // 5:00 AM in minutes
const AXIS_END   = 23 * 60 // 11:00 PM in minutes
const AXIS_RANGE = AXIS_END - AXIS_START

topPercent    = (slotStartMinutes - AXIS_START) / AXIS_RANGE * 100
heightPercent = (slotEndMinutes - slotStartMinutes) / AXIS_RANGE * 100
```

Each slot bar: teacher photo (32×32 circle) + name + show title. Minimum bar height enforced (32px) to keep short slots tappable. On tap, `selectedSlot` state set — triggers bottom sheet.

**Overlap handling:** Multiple teachers in the same time window render side-by-side (split width). Overlap detection at render time by checking sorted slot intervals.

**Music gaps:** Gaps ≥ 5 min between teacher slots rendered as faint gray "Music" bars (non-tappable).

### "Most on air" stat

Computed from full-week schedule data (not just selected day). For each teacher: sum all slot durations (endMinutes − startMinutes) across all days. Display in a compact row above the day chips:

```
Most on air: [Teacher Name]  ·  X hrs / wk
```

If tied, show first alphabetically. Hidden if no teachers have schedule data.

### Teacher detail bottom sheet

Tapping a slot opens `TeacherDetailSheet`. Uses the shared `BottomSheet` primitive (see Feature 4). Content:

- Drag handle
- Teacher photo (80×80, rounded-full)
- Name (text-xl font-bold) + show title (text-sm text-white/70)
- "This week" schedule: compact list of each day + times
- Links (same green pill buttons as teacher detail page)
- Full-width "View full profile →" button → navigates to `/teachers/[slug]`

Sheet closes on: drag dismiss, backdrop tap, Escape key, "View profile" navigation.

### Data flow

`teachers/page.tsx` (server component) fetches **both** `teacherListQuery` and `fullScheduleQuery` in parallel. Both results passed to `TeachersClientView` as props. `TeacherWithSchedule[]` is already defined in `types.ts` and covers both needs.

```tsx
const [teachers, scheduleTeachers] = await Promise.all([
  sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
  sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['schedule'] }),
])
```

---

## Feature 2 — Featured teachers on home page

### Overview

Home page gets a new "Our Teachers" section below "Playing Next". A hardcoded list of highlighted teachers renders as a horizontal scroll strip of cards. No Sanity schema change required. A "See all teachers →" link follows the strip.

### Highlighted teacher list

Hardcoded in `lib/teachers/highlighted.ts` as a constant array of slugs:

```ts
export const HIGHLIGHTED_TEACHER_SLUGS = [
  'robert-furrow',
  'david-guzik',
  'ed-taylor',
  'gary-hamrick',
  'scott-richards',
] as const
```

Slugs derived from the Sanity schema's `slugify` function (`name.first + " " + name.last`, lowercase, strict). If a slug is not found in Sanity, it is silently omitted from the strip.

### GROQ query

```groq
*[_type == "teacher" && slug.current in $slugs] | order(name.last asc) {
  "name": name.first + " " + name.last,
  "slug": slug.current,
  title,
  "photo": photo.asset->url,
  "lqip": photo.asset->metadata.lqip
}
```

Add as `highlightedTeachersQuery` in `queries.ts`. Param `$slugs` passed from `HIGHLIGHTED_TEACHER_SLUGS`. Return type: `TeacherSummary[]` (already defined).

Display order follows the `| order(name.last asc)` sort, not the array order.

### Home page section

New server component `FeaturedTeachers` (`components/home/FeaturedTeachers.tsx`). Wrapped in `Suspense` on home page (same pattern as `TodaySchedule`). A new skeleton `FeaturedTeachersSkeleton` added.

Layout: horizontal scroll row (`flex gap-3 overflow-x-auto`). Each card: 120×120 photo (rounded-lg), name (text-sm font-medium), show title (text-xs text-white/60). Cards are `Link` to `/teachers/[slug]`. Card width fixed at 120px to allow scroll.

**Graceful fallback:** if no featured teachers, component returns `null` (section hidden entirely).

**Home page structure after:**

```
RadioPlayer
"Playing Next" → TodaySchedule
"Our Teachers" → FeaturedTeachers (Suspense)
```

---

## Feature 3 — Enhanced search with filter bottom sheet

### Overview

Teacher search gains a filter button (funnel icon) beside the search input. Tapping opens a bottom sheet with sort and day-filter options. Active filters shown as dismissible chips below the search bar. Filter state in URL params for shareability.

### Filter options

| Filter | Values |
|--------|--------|
| Sort | `name-asc` (default), `name-desc`, `most-on-air` |
| Days | Multi-select: Mon Tue Wed Thu Fri Sat Sun (OR logic — show teacher if they air on ANY selected day) |

"Most on air" sort requires schedule data. `TeachersClientView` already receives `scheduleTeachers` from Feature 1 — reuse that prop.

### URL params

| Param | Example |
|-------|---------|
| `q` | `?q=charles` |
| `sort` | `?sort=most-on-air` |
| `days` | `?days=mon,fri` |

`teachers/page.tsx` reads all three from `searchParams` and passes as `initialQuery`, `initialSort`, `initialDays` props. Hydration uses these to initialize `useState`, preventing flash.

### Filter sheet UI

Uses shared `BottomSheet` primitive. Content:

- Header: "Filter & Sort" + close ×
- **Sort** section: three radio-style buttons (A–Z, Z–A, Most on air)
- **Days** section: 7 chips in a flex-wrap row, multi-selectable, brand-green when active
- **Apply** button (closes sheet, applies state to URL) + **Clear all** text button
- Applied filter count badge on the filter button in the search bar row

### `filterTeachers` extension

Current signature: `filterTeachers(teachers, query)`.  
New signature: `filterTeachers(teachers, query, options?)` where `options: { sort?: SortOption; days?: string[]; scheduleMap?: Map<string, ScheduleDay[]> }`.

`scheduleMap` is a `Map<slug, ScheduleDay[]>` built once from `scheduleTeachers` prop. Day filter: teacher passes if `scheduleMap.get(slug)` has at least one entry matching any selected day (case-insensitive abbreviated day → full day name mapping needed: `mon → Monday`, etc.). Sort by `most-on-air` uses precomputed hours map.

---

## Feature 4 — Shared `BottomSheet` primitive

### Motivation

Three sheets in the codebase after this work: `SleepTimerSheet`, `TeacherDetailSheet`, `FilterSheet`. All share: portal mounting, backdrop, slide-up animation, drag-to-dismiss, Escape key, focus management. Extract once to avoid divergence.

### Interface

```tsx
interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  ariaLabel: string
  className?: string
}
```

Located at `components/global/BottomSheet.tsx`. Internally uses `useSheetDrag` (already at `lib/hooks/useSheetDrag.ts`). Renders via `createPortal` to `document.body`. Exposes a drag handle div at top.

`SleepTimerSheet` refactored to use `BottomSheet`. The unique timer content stays in `SleepTimerSheet` itself — only the chrome (backdrop, animation, drag) moves to the primitive.

### Accessibility

- `role="dialog"` + `aria-modal="true"` on sheet container
- `aria-labelledby` linked to sheet heading
- Focus trapped inside while open (first interactive element focused on open)
- Scroll locked on body while open (`overflow: hidden` on `document.body`)
- Escape closes

---

## Component map

| New component | Location | Purpose |
|---|---|---|
| `BottomSheet` | `components/global/BottomSheet.tsx` | Shared sheet primitive |
| `ScheduleTabView` | `components/teachers/ScheduleTabView.tsx` | Day chips + time axis container |
| `ScheduleTimeAxis` | `components/teachers/ScheduleTimeAxis.tsx` | Time grid + positioned teacher bars |
| `TeacherDetailSheet` | `components/teachers/TeacherDetailSheet.tsx` | Teacher detail bottom sheet |
| `FilterSheet` | `components/teachers/FilterSheet.tsx` | Sort + day filter bottom sheet |
| `FeaturedTeachers` | `components/home/FeaturedTeachers.tsx` | Featured teacher scroll strip |
| `FeaturedTeachersSkeleton` | `components/skeletons/FeaturedTeachersSkeleton.tsx` | Loading state |

| Changed file | Change |
|---|---|
| `components/teachers/TeachersClientView.tsx` | Tab switcher, filter integration, receives scheduleTeachers prop |
| `components/teachers/filter.ts` | Extended with sort + day options |
| `components/home/SleepTimerSheet.tsx` | Refactored to use BottomSheet primitive |
| `app/teachers/page.tsx` | Dual fetch, pass scheduleTeachers + initial filter params |
| `app/page.tsx` | Add FeaturedTeachers section |
| `lib/sanity/queries.ts` | Add highlightedTeachersQuery |
| `lib/sanity/types.ts` | No changes needed (TeacherSummary covers highlighted query) |
| `lib/teachers/highlighted.ts` | New — hardcoded highlighted teacher slugs constant |

---

## Edge cases & constraints

- **Teachers with no schedule** appear in Teachers tab, not in Schedule tab. No error.
- **Slots spanning midnight** (e.g., 11 PM – 1 AM): out of scope. Not present in current data. If added later, clamp at 11 PM axis end.
- **Overlapping slots same teacher**: rare but possible (double-booked). Render both bars side-by-side.
- **Short slots (< 15 min)**: enforce minimum 32px bar height so the slot is tappable. Text truncated.
- **Highlighted query returns empty** (all slugs invalid or Sanity outage): `FeaturedTeachers` returns `null`, section not rendered. No layout shift.
- **`most-on-air` sort with teacher having no schedule**: treat as 0 hours (sort to bottom).
- **Day filter with no results**: show "No teachers found for selected day(s)" with a Clear button.
- **`days` URL param parsing**: split on comma, lowercase, validate against known abbreviations: `mon→Monday, tue→Tuesday, wed→Wednesday, thu→Thursday, fri→Friday, sat→Saturday, sun→Sunday`. Invalid values silently ignored.
- **Time parse errors** (malformed Sanity data): `to24h()` receives unexpected string. Wrap in try/catch, exclude slot from rendering, log warning.
- **Revalidation**: teachers page `revalidate = 3600`, schedule data `revalidate = 86400`. New dual-fetch respects existing tag-based revalidation (`['teachers']` and `['schedule']`).

---

## Out of scope

- Editing schedule data from the app (Sanity Studio only)
- Push notifications for upcoming shows
- Search on the schedule tab (not needed — day chips + visual scan is sufficient)
- Replacing `/scheduled-list` route (keep as-is for now; may deprecate later)
- Timezone selection (app is Tucson-only, `America/Phoenix` fixed)
