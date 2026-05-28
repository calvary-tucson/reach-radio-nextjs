# Schedule Tab Redesign

**Date:** 2026-05-28  
**Status:** Approved  

## Problem

Current schedule tab uses pixel-per-minute positioning. Results in 8–9px text, 24px avatars, and a 1080px tall mobile timeline crammed into a 500px container. Unreadable on all screen sizes.

## Solution

Replace pixel-timeline layout with a card-based list. Each show is a fixed-height card with a large avatar, full teacher name, and time range. Music gaps become filler rows. No pixel math.

## Breakpoint Behavior

| Viewport | Layout | Detail trigger |
|---|---|---|
| `< md` (< 768px) | Day tabs + `ScheduleCardList` | `TeacherDetailSheet` (bottom sheet) |
| `md` to `< lg` (768–1023px) | Day tabs + `ScheduleCardList` | `TeacherDetailPanel` (right overlay) |
| `≥ lg` (1024px+) | `ScheduleWeekCards` (7-col grid) | `TeacherDetailPanel` (right overlay) |

**No stacked fallback.** The mobile day-tab layout serves all viewports below `lg`. Every day always has content (M–F + weekend schedule), so day tabs are never dead. Empty days show a "No shows" state.

## Components

### `ScheduleCardList` (new)

Replaces `ScheduleTimeAxis`. Used for mobile and `md`-to-`lg` viewports.

**Props:**
```ts
interface Props {
  slots: ScheduleSlot[]        // pre-sorted, includes music gaps
  currentTime: number          // minutes since midnight, Phoenix TZ — for "on air now"
  onSelect: (teacher: TeacherWithSchedule) => void
}
```

**Renders:**
- "On air now" label + green border on the slot whose `startMinutes <= currentTime < endMinutes`
- Show card: 44px avatar, teacher full name (`text-sm font-semibold`), time range (`text-xs`), duration chip
- Music gap row: subtle `♪ Music · HH:MM – HH:MM` in muted italic
- "No shows scheduled" empty state when `slots.length === 0`

### `ScheduleWeekCards` (new)

Replaces `ScheduleWeekView`. Used at `≥ lg` only.

**Props:**
```ts
interface Props {
  scheduleTeachers: TeacherWithSchedule[]
  onSelect: (teacher: TeacherWithSchedule) => void
}
```

**Renders:**
- 7-column CSS grid, one column per day (Sun–Sat)
- Today's column: green header text + green underline border
- Each column: day label header + vertically stacked show cards + music gap rows
- Cards are narrower than mobile — 28px avatar, truncated first+last name, time below
- "No shows" placeholder in empty columns

### `TeacherDetailPanel` (new)

Desktop right-side overlay. Replaces the use of `TeacherDetailSheet` on `≥ md`.

**Props:**
```ts
interface Props {
  teacher: TeacherWithSchedule | null
  open: boolean
  onClose: () => void
}
```

**Renders:**
- Fixed right panel, `w-80` (320px), full viewport height, `z-50`
- Semi-transparent backdrop covers the rest of the screen, click-away closes
- Content mirrors `TeacherDetailSheet`: xl avatar, name, title, full weekly schedule, "View full profile →" link
- Close button (×) in top-right corner
- Slide-in from right animation (`translate-x` transition)

### `ScheduleTabView` (modified)

Orchestrates the three-breakpoint layout. Manages `selectedDay`, `selectedTeacher`, and `currentTime` state.

**Changes from current:**
- Removes direct render of `ScheduleTimeAxis` and `ScheduleWeekView`
- Adds `currentTime` computation (Phoenix TZ, refreshed on mount — no live polling needed)
- Mobile (`< md`): day tabs + `ScheduleCardList` + `TeacherDetailSheet`
- Narrow desktop (`md`–`lg`): day tabs + `ScheduleCardList` + `TeacherDetailPanel`
- Wide desktop (`≥ lg`): `ScheduleWeekCards` + `TeacherDetailPanel`
- Breakpoint split: `md:` for detail behavior, `lg:` for layout switch

## Data & Utilities

### `ScheduleSlot` type (new, in `src/lib/teachers/schedule.ts`)

```ts
export type ScheduleSlot =
  | { type: 'show'; teacher: TeacherWithSchedule; startMinutes: number; endMinutes: number }
  | { type: 'music'; startMinutes: number; endMinutes: number }
```

### `buildDaySlots(teachers, day)` utility (new, same file)

Extracted from `ScheduleTimeAxis`. Takes `TeacherWithSchedule[]` and a day name, returns `ScheduleSlot[]` sorted by `startMinutes` with music gaps inserted between shows.

Gap threshold: ≥ 5 minutes between consecutive shows.

## Files Changed

| Action | File |
|---|---|
| Delete | `src/components/teachers/ScheduleTimeAxis.tsx` |
| Delete | `src/components/teachers/ScheduleWeekView.tsx` |
| Create | `src/components/teachers/ScheduleCardList.tsx` |
| Create | `src/components/teachers/ScheduleWeekCards.tsx` |
| Create | `src/components/teachers/TeacherDetailPanel.tsx` |
| Create | `src/lib/teachers/schedule.ts` |
| Modify | `src/components/teachers/ScheduleTabView.tsx` |
| Keep | `src/components/teachers/TeacherDetailSheet.tsx` |
| Keep | `src/components/skeletons/ScheduleTabSkeleton.tsx` |

## Visual Spec

- Avatar sizes: mobile cards `44px`, desktop grid cards `28px`
- Card text: teacher name `text-sm font-semibold text-white`, time `text-xs text-white/55`, active time `text-xs text-[#84b84f]`
- Active card: `bg-[rgba(132,184,79,0.10)] border border-[rgba(132,184,79,0.25)]`
- Inactive card: `bg-white/[0.04]`
- Music gap row: `bg-white/[0.025]`, `text-white/25 text-xs italic`
- Today column header: `text-[#84b84f] font-bold`, bottom border `border-[rgba(132,184,79,0.25)]`
- TeacherDetailPanel backdrop: `bg-black/40`
- TeacherDetailPanel panel: `bg-[#0f1a0a]` (or existing dark surface token), `border-l border-white/[0.08]`

## Out of Scope

- Live "now playing" polling (current time computed once on mount)
- Timezone selection (Phoenix TZ hardcoded, same as current)
- Search or filter within schedule tab
- Changes to `TeacherDetailSheet` content
