# Teacher Detail Route-Intercepted Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace custom `TeacherDetailPanel` / `TeacherDetailSheet` with Next.js route interception so clicking a teacher card navigates to `/teachers/[slug]`, which is intercepted and displayed in a responsive overlay (right panel on desktop, bottom sheet on mobile) showing the actual teacher detail content.

**Architecture:** Teacher cards call `handleSelect(teacher)` which calls `openModal(teacher.name)` then `router.push('/teachers/${slug}')`. Next.js intercepts via `@modal/(...)teachers/[slug]/page.tsx`, which fetches full teacher data via `teacherDetailQuery` and renders it in `TeacherPanelChrome`. The chrome is a bottom sheet on mobile and a fixed right-side panel on desktop — both using `useModal()` from the existing `ModalContext`. Direct navigation to `/teachers/[slug]` bypasses interception and shows the full page as-is.

**Tech Stack:** Next.js App Router (parallel routes, route interception), React 19 server components, Zustand (`useModalStore`), Tailwind CSS, Radix Dialog (existing `@modal/layout.tsx`), `useSheetDrag` hook.

---

## File Map

**New files:**
- `src/app/@modal/(...)teachers/[slug]/page.tsx` — intercepted route; fetches `TeacherDetail`, renders in `TeacherPanelChrome`
- `src/components/modals/chrome/TeacherPanelChrome.tsx` — responsive chrome: bottom sheet (< md) / right panel (≥ md)
- `src/components/teachers/TeacherModalContent.tsx` — server component; single-column teacher detail content

**Modified files:**
- `src/app/globals.css` — add `panel-slide-in` / `panel-slide-out` keyframes
- `src/components/teachers/ScheduleTabView.tsx` — remove `selectedTeacher` state, `TeacherDetailPanel`, `TeacherDetailSheet`, `isMinMd`; add router navigation + `openModal`
- `src/lib/sanity/types.ts` — revert `TeacherWithSchedule` links field (added in previous session)
- `src/lib/sanity/queries.ts` — revert `fullScheduleQuery` links field (added in previous session)

**Deleted files:**
- `src/components/teachers/TeacherDetailPanel.tsx`
- `src/components/teachers/TeacherDetailSheet.tsx`

---

## Task 1: Revert previous session's incomplete changes

**Files:**
- Modify: `src/lib/sanity/types.ts`
- Modify: `src/lib/sanity/queries.ts`

- [ ] **Step 1: Revert `TeacherWithSchedule` in `types.ts`** — remove the `links?` field added in the previous session:

```ts
export type TeacherWithSchedule = TeacherSummary & { schedule: ScheduleDay[] }
```

- [ ] **Step 2: Revert `fullScheduleQuery` in `queries.ts`** — remove the `links[] { title, url }` line:

```ts
export const fullScheduleQuery = `
  *[_type == "teacher" && count(schedule) > 0] | order(name.last asc) {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    "photo": photo.asset->url,
    schedule[] {
      day,
      times[] { startTime, endTime }
    }
  }
`
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/sanity/types.ts src/lib/sanity/queries.ts
git commit -m "revert: remove links from TeacherWithSchedule and fullScheduleQuery"
```

---

## Task 2: Add panel CSS animation keyframes

**Files:**
- Modify: `src/app/globals.css` (after the existing `modal-slide-down` block at ~line 201)

- [ ] **Step 1: Add keyframes for right-panel slide** — insert after the `modal-slide-down` block:

```css
@keyframes panel-slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes panel-slide-out {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add panel-slide-in/out keyframes for teacher detail panel"
```

---

## Task 3: Create `TeacherPanelChrome`

**Files:**
- Create: `src/components/modals/chrome/TeacherPanelChrome.tsx`

`TeacherPanelChrome` is a `'use client'` component. It uses `useModal()` from `ModalContext` (which is always available inside `@modal/layout.tsx`'s `ModalProvider`) and `useSheetDrag` for mobile drag-to-dismiss. Positioning: on mobile `items-end` (sheet slides up), on desktop `md:items-stretch md:justify-end` (panel anchors to right edge, full height).

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useRef } from 'react'
import { X } from 'lucide-react'
import { useModal } from '@/components/modals/ModalContext'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
import { cn } from '@/lib/utils'

interface TeacherPanelChromeProps {
  children: React.ReactNode
}

export function TeacherPanelChrome({ children }: TeacherPanelChromeProps) {
  const { onDismiss, isClosing } = useModal()
  const contentRef = useRef<HTMLDivElement>(null)
  const drag = useSheetDrag({ onDismiss, contentRef })

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 flex items-end md:items-stretch md:justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        ref={contentRef}
        className={cn(
          'w-full flex flex-col bg-[#0f1a0a] border-white/[0.08] overflow-hidden',
          // Mobile: bottom sheet
          'max-h-[92dvh] rounded-t-2xl border',
          isClosing
            ? 'motion-safe:animate-[modal-slide-down_0.15s_ease-in_forwards]'
            : 'motion-safe:animate-[modal-slide-up_0.2s_cubic-bezier(0.32,0.72,0,1)]',
          // Desktop: right panel
          'md:max-h-none md:h-full md:w-[480px] md:rounded-none md:rounded-l-2xl md:border-y-0 md:border-r-0 md:border-l',
          isClosing
            ? 'md:motion-safe:animate-[panel-slide-out_0.15s_ease-in_forwards]'
            : 'md:motion-safe:animate-[panel-slide-in_0.25s_cubic-bezier(0.32,0.72,0,1)]',
        )}
      >
        {/* Drag handle — mobile only */}
        <div
          aria-hidden="true"
          className="flex justify-center pt-3 pb-2 md:hidden cursor-grab active:cursor-grabbing touch-none shrink-0"
          onTouchStart={drag.onTouchStart}
          onTouchMove={drag.onTouchMove}
          onTouchEnd={drag.onTouchEnd}
        >
          <div className="h-1 w-10 rounded-full bg-white/30" />
        </div>

        {/* Close button — desktop only */}
        <div className="hidden md:flex justify-end px-4 pt-4 pb-0 shrink-0">
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/chrome/TeacherPanelChrome.tsx
git commit -m "feat: add TeacherPanelChrome — bottom sheet mobile, right panel desktop"
```

---

## Task 4: Create `TeacherModalContent`

**Files:**
- Create: `src/components/teachers/TeacherModalContent.tsx`

This is a **server component** (no `'use client'`). It renders the teacher detail in single-column layout — no `md:` responsive two-column, because the panel is always a narrow container. It mirrors the mobile layout of `src/app/teachers/[slug]/page.tsx`. Uses `TeacherDetail` (the full type with `links` and `subtitle`), NOT `TeacherWithSchedule`.

- [ ] **Step 1: Create the file**

```tsx
import Link from 'next/link'
import type { TeacherDetail } from '@/lib/sanity/types'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherInfoChip } from '@/components/teachers/primitives/TeacherInfoChip'

const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props {
  teacher: TeacherDetail
}

export function TeacherModalContent({ teacher }: Props) {
  const sortedSchedule = [...(teacher.schedule ?? [])].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  const weeklyMinutes = computeWeeklyMinutes(teacher.schedule ?? [])
  const hoursPerWeek = weeklyMinutes > 0 ? Math.round(weeklyMinutes / 60) : 0
  const daysOnAir = (teacher.schedule ?? []).length

  const primaryLink = teacher.links?.[0]
  const otherLinks = teacher.links?.slice(1) ?? []

  return (
    <div className="text-white">
      {/* Banner */}
      <div className="relative w-full h-[72px] bg-gradient-to-br from-[#1e3a0a] to-[#0a1305] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(60deg, rgba(132,184,79,0.04) 0px, rgba(132,184,79,0.04) 2px, transparent 2px, transparent 14px)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 30% 50%, rgba(132,184,79,0.12) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Avatar + primary link */}
      <div className="flex items-end justify-between px-4 mt-[-36px] mb-[10px]">
        <TeacherAvatar
          name={teacher.name}
          photo={teacher.photo}
          lqip={teacher.lqip}
          size="xl"
          shape="circle"
          ring
          sizes="80px"
        />
        {primaryLink && (
          <a
            href={primaryLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[rgba(132,184,79,0.1)] border border-[rgba(132,184,79,0.3)] rounded-full px-3 py-[6px] text-[10px] font-semibold text-[#84b84f] cursor-pointer hover:bg-[rgba(132,184,79,0.18)] transition-colors"
          >
            {primaryLink.title} &#8599;
          </a>
        )}
      </div>

      {/* Name + title */}
      <div className="px-4 mb-[10px]">
        <h2 className="text-[19px] font-extrabold tracking-tight">{teacher.name}</h2>
        {(teacher.title || teacher.subtitle) && (
          <p className="text-[11px] text-white/50 mt-[3px] font-medium">
            {teacher.title}{teacher.subtitle ? ` · ${teacher.subtitle}` : ''}
          </p>
        )}
      </div>

      {/* Info chips */}
      {(hoursPerWeek > 0 || daysOnAir > 0) && (
        <div className="flex flex-wrap gap-[7px] px-4 mb-3">
          {hoursPerWeek > 0 && (
            <TeacherInfoChip icon="📻" label={`${hoursPerWeek} hrs/wk`} variant="accent" />
          )}
          {daysOnAir > 0 && (
            <TeacherInfoChip label={`${daysOnAir} day${daysOnAir !== 1 ? 's' : ''}`} variant="accent" />
          )}
        </div>
      )}

      {/* Other links */}
      {otherLinks.length > 0 && (
        <div className="flex flex-wrap gap-[6px] px-4 mb-4">
          {otherLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/6 border border-white/10 rounded-full px-3 py-[5px] text-[10px] font-semibold text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
            >
              {link.title}
            </a>
          ))}
        </div>
      )}

      {/* Schedule */}
      {sortedSchedule.length > 0 && (
        <>
          <div className="h-px bg-white/6 mx-4 mb-3" />
          <div className="px-4 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/35 mb-[10px]">
              On Air This Week
            </p>
            <div className="space-y-[8px]">
              {sortedSchedule.map((day) => (
                <div key={day.day}>
                  <p className="text-[11px] font-bold text-white/60 mb-[5px]">{day.day}</p>
                  {day.times.map((t) => (
                    <div
                      key={`${t.startTime}-${t.endTime}`}
                      className="border-l-[3px] border-[#84b84f] bg-[rgba(132,184,79,0.08)] rounded-r-[8px] py-1.5 px-2.5 text-[10px] text-white/55 mb-[3px]"
                    >
                      {t.startTime} &ndash; {t.endTime}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* View full profile */}
      <div className="px-4 pb-6">
        <Link
          href={`/teachers/${teacher.slug}`}
          className="flex items-center justify-center w-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-white/70 rounded-xl py-3 text-sm font-semibold transition-colors cursor-pointer"
        >
          View full profile →
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/TeacherModalContent.tsx
git commit -m "feat: add TeacherModalContent server component for modal use"
```

---

## Task 5: Create the intercepted route

**Files:**
- Create: `src/app/@modal/(...)teachers/[slug]/page.tsx`

The directory `(...)teachers` already exists (it has `search/`). Just add the `[slug]/` subdirectory with `page.tsx`. The `(...)` prefix means the interception fires regardless of which page the user navigates from.

- [ ] **Step 1: Create the file**

```tsx
import { notFound } from 'next/navigation'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherDetailQuery } from '@/lib/sanity/queries'
import type { TeacherDetail } from '@/lib/sanity/types'
import { TeacherPanelChrome } from '@/components/modals/chrome/TeacherPanelChrome'
import { TeacherModalContent } from '@/components/teachers/TeacherModalContent'

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

export default async function TeacherDetailModalPage({ params }: Props) {
  const { slug } = await params
  const teacher = await sanityFetch<TeacherDetail | null>(
    teacherDetailQuery,
    { slug },
    { tags: ['teachers'] }
  )

  if (!teacher) notFound()

  return (
    <TeacherPanelChrome>
      <TeacherModalContent teacher={teacher} />
    </TeacherPanelChrome>
  )
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/@modal/(...)teachers/[slug]/page.tsx"
git commit -m "feat: intercept /teachers/[slug] into TeacherPanelChrome modal"
```

---

## Task 6: Update `ScheduleTabView` to use router navigation

**Files:**
- Modify: `src/components/teachers/ScheduleTabView.tsx`

Remove: `selectedTeacher` state, `isMinMd` hook, `TeacherDetailPanel` import, `TeacherDetailSheet` import, all `<TeacherDetailPanel>` and `<TeacherDetailSheet>` JSX.
Add: `useRouter`, `useModalStore`, `handleSelect` callback that calls `openModal(teacher.name)` + `router.push`.

- [ ] **Step 1: Rewrite the file**

```tsx
'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { buildDaySlots } from '@/lib/teachers/schedule'
import { ScheduleCardList } from './ScheduleCardList'
import { ScheduleWeekCards } from './ScheduleWeekCards'
import { useModalStore } from '@/lib/stores/modal'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

dayjs.extend(utc)
dayjs.extend(timezone)

const TZ = 'America/Phoenix'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_LABELS: Record<string, string> = {
  Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat',
}

interface Props {
  scheduleTeachers: TeacherWithSchedule[]
}

export function ScheduleTabView({ scheduleTeachers }: Props) {
  const now = dayjs().tz(TZ)
  const today = now.format('dddd')
  const currentTime = now.hour() * 60 + now.minute()

  const router = useRouter()
  const openModal = useModalStore((s) => s.openModal)
  const [selectedDay, setSelectedDay] = useState(today)

  const mostOnAir = useMemo(() => {
    if (scheduleTeachers.length === 0) return null
    let best: { teacher: TeacherWithSchedule; minutes: number } | null = null
    for (const t of scheduleTeachers) {
      const mins = computeWeeklyMinutes(t.schedule)
      if (!best || mins > best.minutes || (mins === best.minutes && t.name < best.teacher.name)) {
        best = { teacher: t, minutes: mins }
      }
    }
    return best && best.minutes > 0 ? best : null
  }, [scheduleTeachers])

  const daySlots = useMemo(
    () => buildDaySlots(scheduleTeachers, selectedDay),
    [scheduleTeachers, selectedDay]
  )

  const handleSelect = useCallback(
    (teacher: TeacherWithSchedule) => {
      openModal(teacher.name)
      router.push(`/teachers/${teacher.slug}`)
    },
    [openModal, router]
  )

  return (
    <>
      {mostOnAir && (
        <div className="flex items-center gap-2 mb-3 bg-[rgba(132,184,79,0.08)] border border-[rgba(132,184,79,0.18)] rounded-[12px] px-3 py-2">
          <TeacherAvatar
            name={mostOnAir.teacher.name}
            photo={mostOnAir.teacher.photo}
            lqip={mostOnAir.teacher.lqip ?? null}
            size="xs"
            shape="circle"
            sizes="24px"
          />
          <span className="text-xs text-white/55">
            Most on air:{' '}
            <span className="text-white font-semibold">{mostOnAir.teacher.name}</span>
            {' · '}
            <span>{Math.round(mostOnAir.minutes / 60)} hrs / wk</span>
          </span>
        </div>
      )}

      {/* Mobile + narrow desktop (< lg): day tabs + card list */}
      <div className="lg:hidden">
        <div className="flex gap-[5px] overflow-x-auto pb-1 mb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`flex-shrink-0 px-4 py-[5px] rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                selectedDay === day
                  ? 'bg-[#84b84f] text-[#0a1505]'
                  : 'bg-[#1e2328] text-white/50 hover:bg-[#262d34] hover:text-white/70'
              }`}
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>

        <ScheduleCardList
          slots={daySlots}
          currentTime={selectedDay === today ? currentTime : -1}
          onSelect={handleSelect}
        />
      </div>

      {/* Wide desktop (≥ lg): 7-col week grid */}
      <div className="hidden lg:block">
        <ScheduleWeekCards
          scheduleTeachers={scheduleTeachers}
          currentTime={currentTime}
          today={today}
          onSelect={handleSelect}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/ScheduleTabView.tsx
git commit -m "feat: ScheduleTabView navigates to /teachers/[slug] via modal route interception"
```

---

## Task 7: Delete unused panel and sheet components

**Files:**
- Delete: `src/components/teachers/TeacherDetailPanel.tsx`
- Delete: `src/components/teachers/TeacherDetailSheet.tsx`

- [ ] **Step 1: Delete files**

```bash
rm src/components/teachers/TeacherDetailPanel.tsx
rm src/components/teachers/TeacherDetailSheet.tsx
```

- [ ] **Step 2: Type check** — nothing should import these anymore

Run: `npx tsc --noEmit`
Expected: no errors (if any import errors appear, find and remove the stale import)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete TeacherDetailPanel and TeacherDetailSheet"
```

---

## Task 8: Build verification and manual test

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: exits 0, no type errors, no missing module errors

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

- [ ] **Step 3: Test — schedule page teacher card click**

Navigate to the schedule page. Click any teacher card.
Expected:
- URL changes to `/teachers/[slug]`
- Overlay appears: right panel on desktop (≥ md viewport), bottom sheet on mobile/narrow
- Content shows: banner, avatar, name, title, info chips, links, schedule, "View full profile" button
- Desktop: X close button visible top-right of panel
- Mobile: drag handle visible at top of sheet

- [ ] **Step 4: Test — dismiss behaviors**

- Press Escape → panel dismisses, URL reverts
- Click backdrop (left of panel on desktop, above sheet on mobile) → panel dismisses, URL reverts
- Mobile: drag down past threshold → sheet dismisses

- [ ] **Step 5: Test — "View full profile" link**

Click "View full profile →" inside the panel.
Expected: navigates to `/teachers/[slug]` as a full page (modal dismisses, full page loads)

- [ ] **Step 6: Test — direct navigation**

Open `/teachers/some-slug` in a new tab (no prior navigation context).
Expected: full teacher detail page renders, no modal overlay

- [ ] **Step 7: Final commit**

```bash
git commit --allow-empty -m "chore: verify teacher modal route interception complete"
```
