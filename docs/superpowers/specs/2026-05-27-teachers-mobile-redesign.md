# Teachers Section — Mobile App Redesign

**Date:** 2026-05-27  
**Status:** Approved for implementation  
**Design language:** Material 3 Dark

---

## Overview

Redesign the teachers section (list, detail, schedule tab, search) to feel like a polished mobile app — borrowing from Material 3 / Android conventions. The app is already dark-themed; this redesign deepens the visual hierarchy, unifies component surfaces, and adds skeleton screens that match each component's exact shape.

**Approach:** Design system first — build two shared primitives (`TeacherAvatar`, `TeacherInfoChip`), then rebuild all teacher components on top of them. This eliminates 3 separate `TeacherInitials` implementations and provides consistent metadata display across all surfaces.

---

## Primitives

### `TeacherAvatar`
**File:** `src/components/teachers/primitives/TeacherAvatar.tsx`

Replaces inline `TeacherInitials` in `TeacherCard`, `TeacherSearchClient`, and `TeacherDetailSheet`.

```ts
interface TeacherAvatarProps {
  name: string
  photo?: string | null
  lqip?: string | null
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  shape: 'circle' | 'rounded'   // circle = profile views, rounded = grid cards
  ring?: boolean                 // green border ring, used on detail page overlap
  sizes?: string                 // next/image sizes hint, defaults per size
}
```

Size map (width × height):

| size | px  | font |
|------|-----|------|
| xs   | 24  | 8px  |
| sm   | 38  | 11px |
| md   | 48  | 14px |
| lg   | 72  | 22px |
| xl   | 80  | 26px |

Fallback initials: first letter of first word + first letter of last word (already in codebase, extract as util).

Ring: `border-2 border-[rgba(132,184,79,0.35)]` outer ring + `border-[3px] border-[#111318]` inner separator (prevents banner bleed).

---

### `TeacherInfoChip`
**File:** `src/components/teachers/primitives/TeacherInfoChip.tsx`

```ts
interface TeacherInfoChipProps {
  icon?: ReactNode
  label: string
  variant: 'accent' | 'dim'
  // accent = green tint bg + green text
  // dim    = white/5 bg + white/50 text
}
```

Used on: detail page chip row, list card on-air badge, schedule "most on air" banner, search result rows.

---

## Teachers List Page (`/teachers`)

### Layout changes

**Page header** — adds visible `<h1>` with "Teachers" + teacher count. Currently `sr-only`.

**Search bar** — `bg-[#1e2328] border border-white/7 rounded-[14px] py-2.5` with larger touch target. Was `bg-white/5 rounded-xl`.

**Recommended section** — horizontal-scroll strip of circular `TeacherAvatar md circle` + two-line name below. Currently renders identical 2-col card grid. Becomes a distinct visual treatment that differentiates "editorial picks" from the full grid.

**Tab bar** — keep existing underline indicator, update inactive color to `text-white/35` (was `text-white/70`).

**All Teachers header** — `text-[11px] font-bold uppercase tracking-[0.08em] text-white/35` label + count. Was `text-2xl font-bold`.

**Card grid** — `grid-cols-2 gap-[9px]`. Cards: `bg-[#1c2128] rounded-[18px] border border-white/5 overflow-hidden`. Was `rounded border border-white/10`.

**Card image area** — keep `aspect-square`, initials use `TeacherAvatar` lg rounded (centered in square).

**Card body** — name `text-[11px] font-bold`, title `text-[9px] text-white/45`. Adds `TeacherInfoChip accent` for on-air hours/wk when schedule data exists (passed as optional prop from parent).

**Stagger animation** — keep existing `card-enter` on grid cards. Add same stagger to recommended strip items via `--stagger-i`.

### Component changes

| Component | Change |
|---|---|
| `TeachersClientView` | Pass `scheduleMap` (hrs/wk keyed by slug) down to `TeacherCard` |
| `TeacherCard` | Accept optional `weeklyMinutes?: number`, render `TeacherInfoChip` if > 0. Use `TeacherAvatar`. Update surface classes. |
| `RecommendedTeachers` | Render horizontal strip instead of card grid. Each item: `TeacherAvatar md circle` + name. |

---

## Teacher Detail Page (`/teachers/[slug]`)

### Layout changes

**Back button** — `text-[#84b84f] font-medium text-[13px]` with `‹` chevron. Was breadcrumb component.

**Banner** — full-width `h-[88px]` green gradient (`from-[#1e3a0a] to-[#0a1305]`) + diagonal stripe pattern overlay. New element.

**Avatar overlap row** — `TeacherAvatar xl circle ring` peeks up `mt-[-36px]` from banner. Primary external link (first `teacher.links[0]`) floats right as ghost pill button (`bg-[rgba(132,184,79,0.1)] border border-[rgba(132,184,79,0.3)]`). Was: no banner, square photo in 2-col grid.

**Name block** — `text-[19px] font-extrabold tracking-tight` name, `text-[11px] text-white/50` title + subtitle.

**Info chips row** — `TeacherInfoChip` row: hrs/wk (accent), days on air (accent), link count (dim). Derived from `teacher.schedule` at render time. New section.

**External links** — ghost pill buttons `bg-white/6 border border-white/10 rounded-full text-[10px] font-semibold`. Replaces solid `bg-brand-green` buttons. Shows all links (primary already shown in avatar row as the main CTA).

**Schedule section** — header `text-[10px] uppercase tracking-[0.1em] text-white/35`. Per day: day label `text-[11px] font-bold text-white/60`, each time slot as left-border accent bar `border-l-[3px] border-[#84b84f] bg-[rgba(132,184,79,0.08)] rounded-r-[8px] py-1.5 px-2.5`. Was `bg-gray-700 p-3 rounded`.

**"Also on Reach Radio" strip** — new section at bottom. Horizontal scroll of `TeacherAvatar sm circle` + name. Populated by fetching `highlightedTeachersQuery` (same query used by `RecommendedTeachers`) inside `TeacherDetailPage` alongside `teacherDetailQuery`. Exclude current teacher's slug. Shows up to 8. Uses `Promise.all` with the existing `getTeacher` call — no extra waterfall.

**View Transitions** — `ViewTransition name="teacher-{slug}"` moves from wrapping the square photo to wrapping `TeacherAvatar xl`. Shape changes (square → circle) but transition still animates the correct element.

---

## Schedule Tab (`ScheduleTabView`)

### Changes

**"Most on air" banner** — `bg-[rgba(132,184,79,0.08)] border border-[rgba(132,184,79,0.18)] rounded-[12px]` container with `TeacherAvatar xs circle` + text. Was plain `text-white/60` inline text.

**Day pills** — `bg-[#1e2328] rounded-full` inactive, `bg-[#84b84f] text-[#0a1505]` active. Was `bg-gray-700` / `bg-brand-green`.

**Time axis blocks** — `bg-[rgba(132,184,79,0.15)] border-l-[3px] border-[#84b84f] rounded-[8px]` with `TeacherAvatar xs circle` inside each slot. Was `bg-gray-700 rounded`.

**Music gap blocks** — `bg-white/3 rounded-[6px]` + italic `♪ Music` label. Was `bg-white/5`.

No structural changes — `ScheduleTimeAxis` layout/logic unchanged.

---

## Search Page (`/teachers/search`)

### Changes

**Header** — `‹` back chevron (green) + inline search `<input>` in same row. Was separate `← Teachers` link + `<h1>` above input.

**Day filter chips** — `bg-[#1e2328] border border-white/7 rounded-full` inactive, `bg-[rgba(132,184,79,0.15)] border-[rgba(132,184,79,0.3)] text-[#84b84f]` active. Was `bg-white/10` / `bg-brand-green`.

**Sort chips** — same chip treatment as day filters for visual consistency.

**Result rows** — `TeacherAvatar sm rounded` + `TeacherInfoChip accent` showing hrs/wk when schedule data exists. Was inline `rounded-lg` image.

---

## Skeletons

All skeletons use `animate-pulse` via a single shared CSS keyframe. Each skeleton mirrors its component's exact shape so Suspense swap is visually seamless.

### Rewritten files

**`TeacherCardSkeleton`** — matches new `rounded-[18px]` card: square image area + body with name/title lines + optional chip slot row.

**`TeacherGridSkeleton`** — 2-col grid of 8 `TeacherCardSkeleton`.

**`TeacherDetailSkeleton`** — matches new detail page: back bar → banner bar → avatar overlap row (circle + ghost button) → name/title lines → chips row → links row → divider → 3 schedule day+bar groups.

### New files

**`RecommendedTeachersSkeleton`** — horizontal strip of 4 `TeacherAvatar`-shaped circles + name line below each.

**`ScheduleTabSkeleton`** — tab bar → most-on-air banner rect → 5 day pill rects → 5 axis row pairs (time label + block).

**`SearchResultsSkeleton`** — back+input header → 5 filter chip rects → count line → 4 result rows (rounded-square avatar + two text lines).

---

## Loading Architecture

```
app/teachers/loading.tsx
  └── <TeachersPageSkeleton />
        ├── SearchBarSkeleton (inline)
        ├── <RecommendedTeachersSkeleton />
        └── <TeacherGridSkeleton />

app/teachers/page.tsx (real)
  ├── <PassiveSearchBar />
  ├── <Suspense fallback={<RecommendedTeachersSkeleton />}>
  │     <RecommendedTeachers />          ← async RSC
  │   </Suspense>
  └── <TeachersClientView />             ← data passed as props

app/teachers/[slug]/loading.tsx
  └── <TeacherDetailSkeleton />

app/teachers/search/loading.tsx
  └── <SearchResultsSkeleton />
```

`loading.tsx` files must be pure server components with zero async calls — any `await` delays the skeleton paint.

---

## Animations

No new keyframes added. Existing animations reused:

| Animation | Used on |
|---|---|
| `card-enter` | Grid cards (existing), recommended strip items (new) |
| `schedule-row-enter` | Schedule axis blocks (new use) |

Stagger via `--stagger-i` CSS custom property. Reduced-motion media query already suppresses all animations globally.

---

## Files Created / Modified

### New files
```
src/components/teachers/primitives/TeacherAvatar.tsx
src/components/teachers/primitives/TeacherInfoChip.tsx
src/components/skeletons/RecommendedTeachersSkeleton.tsx
src/components/skeletons/ScheduleTabSkeleton.tsx
src/components/skeletons/SearchResultsSkeleton.tsx
src/app/teachers/loading.tsx
src/app/teachers/[slug]/loading.tsx
src/app/teachers/search/loading.tsx
```

### Modified files
```
src/components/teachers/TeacherCard.tsx
src/components/teachers/TeachersClientView.tsx
src/components/teachers/RecommendedTeachers.tsx
src/components/teachers/ScheduleTabView.tsx
src/components/teachers/ScheduleTimeAxis.tsx
src/components/teachers/TeacherDetailSheet.tsx
src/components/teachers/TeacherSearchClient.tsx
src/components/skeletons/TeacherCardSkeleton.tsx
src/components/skeletons/TeacherDetailSkeleton.tsx
src/app/teachers/page.tsx
src/app/teachers/[slug]/page.tsx
src/app/teachers/search/page.tsx
```

### Unchanged
```
src/lib/teachers/filter.ts
src/lib/teachers/highlighted.ts
src/lib/sanity/queries.ts
src/lib/sanity/types.ts
```
