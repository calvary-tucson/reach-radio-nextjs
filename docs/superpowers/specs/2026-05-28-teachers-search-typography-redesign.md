# Teachers Search + Typography Redesign

**Date:** 2026-05-28
**Branch:** feat/teachers-mobile-redesign
**Scope:** TeacherSearchClient (layout + URL state), RecommendedTeachers (text), ScheduleTabView (text)

---

## Problem

Three categories of visual issues found after mobile redesign:

1. **Sub-12px text** in RecommendedTeachers (8px names) and ScheduleTabView (10–11px labels)
2. **Search layout** — two-column sidebar+results on desktop is misaligned with calvarytucson-nextjs single-column pattern
3. **Search quality** — raw hex backgrounds, no search icon, no touch targets on chips, flat result rows instead of cards

---

## Architecture

`TeacherSearchClient` becomes URL-driven. Filters (query, days, sort) live in URL via `useSearchParams` + `router.replace` + `useTransition`. No API calls — all filtering stays client-side (data loaded at page render via `filterTeachers`).

**URL shape:**
```
/teachers/search?q=John&days=Monday,Wednesday&sort=most-on-air
```

- `q` — text query, trimmed
- `days` — comma-separated full day names (`Monday`, `Tuesday`, etc.) → split to `string[]`
- `sort` — validated against `SortOption` union, default `undefined`

`filterTeachers` lib function unchanged. Both route files (`teachers/search/page.tsx` and `@modal/(...)teachers/search/page.tsx`) keep rendering `TeacherSearchClient` — no route structure changes.

---

## Component Design

### TeacherSearchClient — layout

**Drop** the `md:flex` two-column (sidebar + results) layout.

**Replace with** single-column `space-y-4`, `max-w-screen-xl mx-auto px-4 py-4`. Matches calvarytucson `SearchPageClient` pattern.

**Structure (top to bottom):**
1. Back arrow + search input (flex row)
2. Day filter chips row
3. Sort chips row + trailing "Clear all"
4. Results count (`aria-live`)
5. Results list or skeleton

---

### Input

```
bg-white/5 border-white/10 rounded-xl pl-10 pr-12 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20
```

- Lucide `Search` icon: `absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40`
- Lucide `X` clear button right: shown when query non-empty, `isPending` false
- Lucide `Loader2` replaces X when `isPending === true`: `animate-spin h-4 w-4 text-white/40`
- Back arrow: `Link href="/teachers"`, `text-[#84b84f] text-xl leading-none cursor-pointer flex-shrink-0`

---

### Filter chips

**Section label pattern** (both Day and Sort):
```
text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-1.5
```

**Day chips row:**
```
flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
```

**Sort chips row:**
```
flex items-center gap-2 flex-wrap
```

**Each chip:**
```
min-h-[44px] flex items-center shrink-0 rounded-full px-3 text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50
```

- Active: `bg-[rgba(132,184,79,0.15)] border-[rgba(132,184,79,0.3)] text-[#84b84f]`
- Inactive: `bg-white/5 border-white/10 text-white/60 can-hover:hover:border-white/20 can-hover:hover:text-white/80`

**"Clear all"** trailing the sort row: `text-xs text-white/45 can-hover:hover:text-white cursor-pointer` — shown only when any filter active.

---

### Results

**Count:**
```
text-sm text-white/60
```
With `aria-live="polite" aria-atomic="true"`.

**Skeleton** (when `isPending === true`):
- 5× `h-[68px] rounded-xl bg-white/5 animate-pulse`
- `space-y-2`
- Replaces result list entirely while pending

**Result cards:**
```
rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3 transition-colors cursor-pointer can-hover:hover:bg-white/10 can-hover:hover:border-white/20
```
- `space-y-2` between cards (no `border-b`)
- Teacher name: `text-sm font-semibold text-white`
- Teacher title: `text-xs text-white/60`
- `TeacherInfoChip` for hours — unchanged
- `ChevronRight` trailing icon — unchanged

**Empty state:**
```
text-sm text-white/45 text-center py-12
```
"No teachers found. Try a different search."

---

## Typography Fixes

### RecommendedTeachers

| Element | Before | After |
|---|---|---|
| Teacher name | `text-[8px] md:text-xs` | `text-xs md:text-[13px]` |

### ScheduleTabView

| Element | Before | After |
|---|---|---|
| "Most on air" text | `text-[10px]` | `text-xs` |
| Day picker buttons | `text-[11px]` | `text-xs` |

---

## State + Error Handling

No fetch errors (client-side filtering). States:

- **Idle:** full results list, sorted by current sort param (default: name-asc)
- **Filtering (`isPending`):** skeleton replaces results
- **No results:** empty state message
- **URL load:** `useSearchParams` reads `q`/`days`/`sort` on mount — no hydration flash

`days` parsing: `searchParams.get('days')?.split(',').filter(Boolean) ?? []`
`sort` validation: check against `SORT_OPTIONS` values before setting state

---

## Files Changed

| File | Change |
|---|---|
| `src/components/teachers/TeacherSearchClient.tsx` | Full rewrite: URL state, single-column layout, new input/chip/card styles |
| `src/components/teachers/RecommendedTeachers.tsx` | Text size fix: `text-[8px]` → `text-xs` |
| `src/components/teachers/ScheduleTabView.tsx` | Text size fixes: two class changes |

Route files (`teachers/search/page.tsx`, `@modal/(...)teachers/search/page.tsx`) — no changes needed.

---

## Test Matrix

| Scenario | Check |
|---|---|
| Mobile 375px | Input + chips + cards readable, chip row scrollable, touch targets ≥44px |
| Desktop 1280px | Single column, cards full-width up to max-w-screen-xl |
| URL deep-link | `/teachers/search?q=John&days=Monday,Wednesday&sort=most-on-air` → filters pre-filled |
| Sheet render | `TeacherSearchClient` inside `SheetChrome` — no overflow or layout issues |
| Back arrow | Navigates to `/teachers` |
| Clear all | Removes q + days + sort, updates URL |
| Empty state | Shows message when no teachers match |
