# Schedule Visualization & Teachers Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual schedule tab to the Teachers page, featured teachers strip on the home page, an enhanced filter bottom sheet for teacher search, and extract a shared BottomSheet primitive used by all three sheets.

**Architecture:** Build the shared BottomSheet primitive and time utilities first (they are prerequisites). Feature 2 (highlighted teachers + home page) is independent and can be done in parallel with Features 1/3. Features 1 and 3 share the `scheduleTeachers` data prop added to `TeachersClientView` in the final wiring tasks. SleepTimerSheet refactor is last — purely internal cleanup.

**Tech Stack:** Next.js 16 / React 19, TypeScript strict, Tailwind CSS v4, dayjs + `America/Phoenix` timezone, Sanity GROQ, Vitest + React Testing Library (jsdom), no Radix/shadcn in this repo

---

## File Map

**New files:**
- `src/components/global/BottomSheet.tsx` — shared sheet primitive (portal + backdrop + drag + animation)
- `src/lib/utils/time.ts` — `to24h`, `toMinutes`, `timeStringToMinutes`, `computeWeeklyMinutes`
- `src/lib/teachers/highlighted.ts` — `HIGHLIGHTED_TEACHER_SLUGS` constant + `sortByHighlightedOrder`
- `src/components/home/FeaturedTeachers.tsx` — server component, horizontal scroll strip
- `src/components/skeletons/FeaturedTeachersSkeleton.tsx` — loading skeleton
- `src/components/teachers/ScheduleTimeAxis.tsx` — time grid + positioned teacher slot bars
- `src/components/teachers/TeacherDetailSheet.tsx` — teacher detail bottom sheet
- `src/components/teachers/ScheduleTabView.tsx` — day chips + most-on-air stat + time axis
- `src/components/teachers/FilterSheet.tsx` — sort + day filter bottom sheet
- `tests/unit/bottom-sheet.test.tsx`
- `tests/unit/time-utils.test.ts`
- `tests/unit/highlighted-teachers.test.ts`
- `tests/unit/schedule-time-axis.test.tsx`
- `tests/unit/teacher-detail-sheet.test.tsx`
- `tests/unit/filter-sheet.test.tsx`

**Modified files:**
- `src/lib/teachers/filter.ts` — add `SortOption`, `FilterOptions`, extend `filterTeachers`
- `src/lib/sanity/queries.ts` — add `highlightedTeachersQuery`
- `src/components/home/TodaySchedule.tsx` — import `to24h`/`toMinutes` from `lib/utils/time`
- `src/components/home/SleepTimerSheet.tsx` — refactor to use `BottomSheet` primitive (Task 13)
- `src/components/teachers/TeachersClientView.tsx` — tabs, filter state, `scheduleTeachers` prop
- `src/app/teachers/page.tsx` — dual fetch + read sort/days from searchParams
- `src/app/page.tsx` — add FeaturedTeachers section
- `tests/unit/filter-teachers.test.ts` — add sort + day filter test cases
- `tests/unit/sleep-timer-sheet.test.tsx` — update backdrop testid after refactor

---

## Task 1: BottomSheet primitive

**Files:**
- Create: `src/components/global/BottomSheet.tsx`
- Test: `tests/unit/bottom-sheet.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/bottom-sheet.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomSheet } from '@/components/global/BottomSheet'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))

describe('BottomSheet', () => {
  it('renders nothing when closed', () => {
    render(
      <BottomSheet open={false} onClose={vi.fn()} ariaLabel="Test sheet">
        <p>Content</p>
      </BottomSheet>
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders children when open', () => {
    render(
      <BottomSheet open={true} onClose={vi.fn()} ariaLabel="Test sheet">
        <p>Content</p>
      </BottomSheet>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('calls onClose when backdrop clicked', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(
      <BottomSheet open={true} onClose={onClose} ariaLabel="Test sheet">
        <p>Content</p>
      </BottomSheet>
    )
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'))
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('calls onClose when Escape pressed', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(
      <BottomSheet open={true} onClose={onClose} ariaLabel="Test sheet">
        <p>Content</p>
      </BottomSheet>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('has aria-modal and aria-label', () => {
    render(
      <BottomSheet open={true} onClose={vi.fn()} ariaLabel="Sleep timer">
        <p>Content</p>
      </BottomSheet>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Sleep timer')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/unit/bottom-sheet.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/global/BottomSheet'`

- [ ] **Step 3: Implement BottomSheet**

```tsx
// src/components/global/BottomSheet.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  ariaLabel: string
  className?: string
}

export function BottomSheet({ open, onClose, children, ariaLabel, className }: BottomSheetProps) {
  const [visible, setVisible] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClose = useCallback(() => {
    setVisible(false)
    closeTimerRef.current = setTimeout(onClose, 280)
  }, [onClose])

  const drag = useSheetDrag({ onDismiss: handleClose, contentRef: sheetRef })

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, handleClose])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <>
      <div
        data-testid="bottom-sheet-backdrop"
        className={`fixed inset-0 z-[70] bg-black/60 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div role="dialog" aria-modal="true" aria-label={ariaLabel}>
        <div
          ref={sheetRef}
          className={`fixed inset-x-0 bottom-0 z-[70] bg-gray-800 rounded-t-2xl transition-transform duration-[280ms] ease-out ${
            visible ? 'translate-y-0' : 'translate-y-full'
          } ${className ?? ''}`}
        >
          <div
            className="touch-none cursor-grab active:cursor-grabbing"
            onTouchStart={drag.onTouchStart}
            onTouchMove={drag.onTouchMove}
            onTouchEnd={drag.onTouchEnd}
            onMouseDown={drag.onMouseDown}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="h-1 w-10 rounded-full bg-white/30" />
            </div>
          </div>
          {children}
        </div>
      </div>
    </>,
    document.body
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- tests/unit/bottom-sheet.test.tsx
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/global/BottomSheet.tsx tests/unit/bottom-sheet.test.tsx
git commit -m "feat: add shared BottomSheet primitive"
```

---

## Task 2: Time utilities

**Files:**
- Create: `src/lib/utils/time.ts`
- Modify: `src/components/home/TodaySchedule.tsx`
- Test: `tests/unit/time-utils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/time-utils.test.ts
import { describe, it, expect } from 'vitest'
import { to24h, toMinutes, timeStringToMinutes, computeWeeklyMinutes } from '@/lib/utils/time'

describe('to24h', () => {
  it('converts AM times', () => {
    expect(to24h('9:00 AM')).toBe('09:00')
    expect(to24h('12:00 AM')).toBe('00:00')
    expect(to24h('11:30 AM')).toBe('11:30')
  })
  it('converts PM times', () => {
    expect(to24h('12:00 PM')).toBe('12:00')
    expect(to24h('1:00 PM')).toBe('13:00')
    expect(to24h('6:30 PM')).toBe('18:30')
  })
  it('returns 00:00 for invalid input', () => {
    expect(to24h('invalid')).toBe('00:00')
  })
})

describe('toMinutes', () => {
  it('converts 24h time to total minutes', () => {
    expect(toMinutes('09:00')).toBe(540)
    expect(toMinutes('18:30')).toBe(1110)
    expect(toMinutes('00:00')).toBe(0)
  })
})

describe('timeStringToMinutes', () => {
  it('converts time strings to total minutes', () => {
    expect(timeStringToMinutes('9:00 AM')).toBe(540)
    expect(timeStringToMinutes('6:30 PM')).toBe(1110)
  })
})

describe('computeWeeklyMinutes', () => {
  it('sums durations across all days', () => {
    const schedule = [
      { day: 'Monday', times: [{ startTime: '9:00 AM', endTime: '9:30 AM' }] },
      { day: 'Wednesday', times: [{ startTime: '6:00 PM', endTime: '6:30 PM' }] },
    ]
    expect(computeWeeklyMinutes(schedule)).toBe(60)
  })
  it('handles multiple slots in same day', () => {
    const schedule = [
      {
        day: 'Monday',
        times: [
          { startTime: '9:00 AM', endTime: '9:30 AM' },
          { startTime: '6:00 PM', endTime: '6:30 PM' },
        ],
      },
    ]
    expect(computeWeeklyMinutes(schedule)).toBe(60)
  })
  it('returns 0 for empty schedule', () => {
    expect(computeWeeklyMinutes([])).toBe(0)
  })
  it('returns 0 for slots with reversed times', () => {
    const schedule = [{ day: 'Monday', times: [{ startTime: '9:30 AM', endTime: '9:00 AM' }] }]
    expect(computeWeeklyMinutes(schedule)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/unit/time-utils.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/utils/time'`

- [ ] **Step 3: Implement `src/lib/utils/time.ts`**

```ts
// src/lib/utils/time.ts
import type { ScheduleDay } from '@/lib/sanity/types'

export function to24h(time: string): string {
  try {
    const [timeStr, period] = time.split(' ')
    const [h, m] = timeStr.split(':')
    let hours = parseInt(h, 10)
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    return `${hours.toString().padStart(2, '0')}:${m}`
  } catch {
    console.warn(`[time] Failed to parse: "${time}"`)
    return '00:00'
  }
}

export function toMinutes(time24: string): number {
  const [h, m] = time24.split(':').map(Number)
  return h * 60 + m
}

export function timeStringToMinutes(time: string): number {
  return toMinutes(to24h(time))
}

export function computeWeeklyMinutes(schedule: ScheduleDay[]): number {
  return schedule.reduce(
    (total, day) =>
      total +
      day.times.reduce((dayTotal, slot) => {
        const start = timeStringToMinutes(slot.startTime)
        const end = timeStringToMinutes(slot.endTime)
        return dayTotal + Math.max(0, end - start)
      }, 0),
    0
  )
}
```

- [ ] **Step 4: Update `TodaySchedule.tsx` to use the shared functions**

Remove the `to24h` and `toMinutes` local function definitions (lines 26–35 in current file) and add the import:

```tsx
// src/components/home/TodaySchedule.tsx  — top of file, after other imports
import { to24h, toMinutes } from '@/lib/utils/time'
```

The `isInFuture` function and all usages of `to24h`/`toMinutes` remain unchanged — they now reference the imported versions.

- [ ] **Step 5: Run tests to confirm pass**

```bash
npm test -- tests/unit/time-utils.test.ts
```

Expected: PASS — 8 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/time.ts tests/unit/time-utils.test.ts src/components/home/TodaySchedule.tsx
git commit -m "refactor: extract time utilities to lib/utils/time"
```

---

## Task 3: Extend `filterTeachers` with sort and day filter

**Files:**
- Modify: `src/lib/teachers/filter.ts`
- Modify: `tests/unit/filter-teachers.test.ts`

- [ ] **Step 1: Add new test cases to the existing test file**

Append these `describe` blocks after the existing ones in `tests/unit/filter-teachers.test.ts`:

```ts
// Add at top of file with existing imports:
import type { ScheduleDay } from '@/lib/sanity/types'
import type { SortOption } from '@/lib/teachers/filter'

// Add these describe blocks at the bottom of the file:

const scheduleMap = new Map<string, ScheduleDay[]>([
  ['jack-hibbs', [{ day: 'Monday', times: [{ startTime: '9:00 AM', endTime: '9:30 AM' }] }]],
  ['jack-graham', [{ day: 'Wednesday', times: [{ startTime: '6:00 PM', endTime: '6:30 PM' }] }]],
  ['alistair-begg', [{ day: 'Monday', times: [{ startTime: '10:00 AM', endTime: '10:30 AM' }] }]],
])

const hoursMap = new Map<string, number>([
  ['jack-hibbs', 60],
  ['jack-graham', 120],
  ['alistair-begg', 30],
  ['john-macarthur', 0],
])

describe('filterTeachers with sort', () => {
  it('sorts by name-asc', () => {
    const result = filterTeachers(teachers, '', { sort: 'name-asc' })
    expect(result.map((t) => t.slug)).toEqual([
      'alistair-begg',
      'jack-graham',
      'jack-hibbs',
      'john-macarthur',
    ])
  })

  it('sorts by name-desc', () => {
    const result = filterTeachers(teachers, '', { sort: 'name-desc' })
    expect(result.map((t) => t.slug)).toEqual([
      'john-macarthur',
      'jack-hibbs',
      'jack-graham',
      'alistair-begg',
    ])
  })

  it('sorts by most-on-air descending', () => {
    const result = filterTeachers(teachers, '', { sort: 'most-on-air', hoursMap })
    expect(result.map((t) => t.slug)).toEqual([
      'jack-graham',
      'jack-hibbs',
      'alistair-begg',
      'john-macarthur',
    ])
  })

  it('preserves server order when no sort specified', () => {
    const result = filterTeachers(teachers, '')
    expect(result.map((t) => t.slug)).toEqual([
      'jack-hibbs',
      'jack-graham',
      'alistair-begg',
      'john-macarthur',
    ])
  })
})

describe('filterTeachers with day filter', () => {
  it('shows teachers airing on selected day', () => {
    const result = filterTeachers(teachers, '', { days: ['Monday'], scheduleMap })
    expect(result.map((t) => t.slug)).toContain('jack-hibbs')
    expect(result.map((t) => t.slug)).toContain('alistair-begg')
    expect(result.map((t) => t.slug)).not.toContain('jack-graham')
  })

  it('uses OR logic for multiple days', () => {
    const result = filterTeachers(teachers, '', {
      days: ['Monday', 'Wednesday'],
      scheduleMap,
    })
    expect(result.map((t) => t.slug)).toContain('jack-hibbs')
    expect(result.map((t) => t.slug)).toContain('jack-graham')
    expect(result.map((t) => t.slug)).toContain('alistair-begg')
  })

  it('returns empty when no teachers match day filter', () => {
    const result = filterTeachers(teachers, '', { days: ['Sunday'], scheduleMap })
    expect(result).toHaveLength(0)
  })

  it('ignores day filter when scheduleMap is not provided', () => {
    const result = filterTeachers(teachers, '', { days: ['Monday'] })
    expect(result).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run tests to confirm the new ones fail**

```bash
npm test -- tests/unit/filter-teachers.test.ts
```

Expected: existing 8 tests PASS, new tests FAIL — `SortOption` not exported

- [ ] **Step 3: Replace `src/lib/teachers/filter.ts` with extended version**

```ts
// src/lib/teachers/filter.ts
import type { TeacherSummary, ScheduleDay } from '@/lib/sanity/types'

export type SortOption = 'name-asc' | 'name-desc' | 'most-on-air'

export interface FilterOptions {
  sort?: SortOption
  days?: string[]
  scheduleMap?: Map<string, ScheduleDay[]>
  hoursMap?: Map<string, number>
}

export function filterTeachers(
  teachers: TeacherSummary[],
  query: string,
  options: FilterOptions = {}
): TeacherSummary[] {
  const { sort, days = [], scheduleMap, hoursMap } = options

  const q = query.trim().toLowerCase()
  let result: TeacherSummary[] = q
    ? teachers.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.title?.toLowerCase().includes(q) ?? false)
      )
    : [...teachers]

  if (days.length > 0 && scheduleMap) {
    result = result.filter((t) => {
      const schedule = scheduleMap.get(t.slug) ?? []
      return schedule.some((s) => days.includes(s.day))
    })
  }

  if (sort === 'name-asc') {
    result.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sort === 'name-desc') {
    result.sort((a, b) => b.name.localeCompare(a.name))
  } else if (sort === 'most-on-air' && hoursMap) {
    result.sort((a, b) => (hoursMap.get(b.slug) ?? 0) - (hoursMap.get(a.slug) ?? 0))
  }

  return result
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- tests/unit/filter-teachers.test.ts
```

Expected: PASS — 16 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/teachers/filter.ts tests/unit/filter-teachers.test.ts
git commit -m "feat: extend filterTeachers with sort and day filter options"
```

---

## Task 4: Highlighted teachers constant, query, and sort helper

**Files:**
- Create: `src/lib/teachers/highlighted.ts`
- Modify: `src/lib/sanity/queries.ts`
- Test: `tests/unit/highlighted-teachers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/highlighted-teachers.test.ts
import { describe, it, expect } from 'vitest'
import {
  HIGHLIGHTED_TEACHER_SLUGS,
  sortByHighlightedOrder,
} from '@/lib/teachers/highlighted'
import { highlightedTeachersQuery } from '@/lib/sanity/queries'
import type { TeacherSummary } from '@/lib/sanity/types'

const mockTeachers: TeacherSummary[] = [
  { name: 'David Guzik', slug: 'david-guzik', title: 'Calvary Chapel', photo: null },
  { name: 'Robert Furrow', slug: 'robert-furrow', title: 'RRBS', photo: null },
  { name: 'Gary Hamrick', slug: 'gary-hamrick', title: 'Cornerstone', photo: null },
]

describe('HIGHLIGHTED_TEACHER_SLUGS', () => {
  it('has robert-furrow as first entry', () => {
    expect(HIGHLIGHTED_TEACHER_SLUGS[0]).toBe('robert-furrow')
  })

  it('contains all 5 expected slugs', () => {
    expect(HIGHLIGHTED_TEACHER_SLUGS).toContain('david-guzik')
    expect(HIGHLIGHTED_TEACHER_SLUGS).toContain('ed-taylor')
    expect(HIGHLIGHTED_TEACHER_SLUGS).toContain('gary-hamrick')
    expect(HIGHLIGHTED_TEACHER_SLUGS).toContain('scott-richards')
    expect(HIGHLIGHTED_TEACHER_SLUGS).toHaveLength(5)
  })
})

describe('sortByHighlightedOrder', () => {
  it('places robert-furrow first', () => {
    const result = sortByHighlightedOrder(mockTeachers, HIGHLIGHTED_TEACHER_SLUGS)
    expect(result[0].slug).toBe('robert-furrow')
  })

  it('follows array order for remaining teachers', () => {
    const result = sortByHighlightedOrder(mockTeachers, HIGHLIGHTED_TEACHER_SLUGS)
    expect(result.map((t) => t.slug)).toEqual(['robert-furrow', 'david-guzik', 'gary-hamrick'])
  })

  it('omits slugs not found in teachers array', () => {
    const result = sortByHighlightedOrder(mockTeachers, HIGHLIGHTED_TEACHER_SLUGS)
    expect(result.every((t) => mockTeachers.some((m) => m.slug === t.slug))).toBe(true)
  })
})

describe('highlightedTeachersQuery', () => {
  it('filters by slug list', () => {
    expect(highlightedTeachersQuery).toContain('slug.current in $slugs')
  })
  it('projects name, slug, title, photo, lqip', () => {
    expect(highlightedTeachersQuery).toContain('"name"')
    expect(highlightedTeachersQuery).toContain('"slug"')
    expect(highlightedTeachersQuery).toContain('"photo"')
    expect(highlightedTeachersQuery).toContain('"lqip"')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/unit/highlighted-teachers.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `src/lib/teachers/highlighted.ts`**

```ts
// src/lib/teachers/highlighted.ts
import type { TeacherSummary } from '@/lib/sanity/types'

export const HIGHLIGHTED_TEACHER_SLUGS = [
  'robert-furrow',
  'david-guzik',
  'ed-taylor',
  'gary-hamrick',
  'scott-richards',
] as const

export function sortByHighlightedOrder(
  teachers: TeacherSummary[],
  slugs: readonly string[]
): TeacherSummary[] {
  return slugs
    .map((slug) => teachers.find((t) => t.slug === slug))
    .filter((t): t is TeacherSummary => t !== undefined)
}
```

- [ ] **Step 4: Add `highlightedTeachersQuery` to `src/lib/sanity/queries.ts`**

Append after the last existing query:

```ts
export const highlightedTeachersQuery = `
  *[_type == "teacher" && slug.current in $slugs] {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    "photo": photo.asset->url,
    "lqip": photo.asset->metadata.lqip
  }
`
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/unit/highlighted-teachers.test.ts
```

Expected: PASS — 7 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/teachers/highlighted.ts src/lib/sanity/queries.ts tests/unit/highlighted-teachers.test.ts
git commit -m "feat: add highlighted teacher slugs, sort helper, and GROQ query"
```

---

## Task 5: FeaturedTeachers server component and skeleton

**Files:**
- Create: `src/components/home/FeaturedTeachers.tsx`
- Create: `src/components/skeletons/FeaturedTeachersSkeleton.tsx`

No unit test for server component (uses Sanity network fetch). The component is thin — its sort logic is already tested in Task 4.

- [ ] **Step 1: Create `src/components/home/FeaturedTeachers.tsx`**

```tsx
// src/components/home/FeaturedTeachers.tsx
import { sanityFetch } from '@/lib/sanity/client'
import { highlightedTeachersQuery } from '@/lib/sanity/queries'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import type { TeacherSummary } from '@/lib/sanity/types'
import Image from 'next/image'
import Link from 'next/link'

export async function FeaturedTeachers() {
  const raw = await sanityFetch<TeacherSummary[]>(
    highlightedTeachersQuery,
    { slugs: [...HIGHLIGHTED_TEACHER_SLUGS] },
    { tags: ['teachers'] }
  )

  const teachers = sortByHighlightedOrder(raw, HIGHLIGHTED_TEACHER_SLUGS)

  if (teachers.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between px-3 mb-3">
        <h2 className="text-white font-bold text-lg uppercase">Our Teachers</h2>
        <Link
          href="/teachers"
          className="text-white/60 text-sm hover:text-white transition-colors"
        >
          See all →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {teachers.map((teacher) => (
          <Link
            key={teacher.slug}
            href={`/teachers/${teacher.slug}`}
            className="flex-shrink-0 w-[120px] flex flex-col items-center gap-2 cursor-pointer"
          >
            <div className="relative w-[120px] h-[120px] rounded-lg overflow-hidden bg-gray-700">
              {teacher.photo && (
                <Image
                  src={teacher.photo}
                  alt={teacher.name}
                  fill
                  className="object-cover"
                  placeholder={teacher.lqip ? 'blur' : 'empty'}
                  blurDataURL={teacher.lqip ?? undefined}
                  sizes="120px"
                />
              )}
            </div>
            <div className="text-center">
              <p className="text-white text-sm font-medium leading-tight line-clamp-2">
                {teacher.name}
              </p>
              {teacher.title && (
                <p className="text-white/60 text-xs leading-tight line-clamp-1">{teacher.title}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `src/components/skeletons/FeaturedTeachersSkeleton.tsx`**

```tsx
// src/components/skeletons/FeaturedTeachersSkeleton.tsx
export function FeaturedTeachersSkeleton() {
  return (
    <section>
      <div className="flex items-center justify-between px-3 mb-3">
        <div className="h-5 w-28 bg-gray-700/50 rounded animate-pulse" />
        <div className="h-4 w-14 bg-gray-700/50 rounded animate-pulse" />
      </div>
      <div className="flex gap-3 px-3 pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[120px] flex flex-col items-center gap-2 animate-pulse"
          >
            <div className="w-[120px] h-[120px] rounded-lg bg-gray-700/50" />
            <div className="h-3.5 w-20 bg-gray-700/50 rounded" />
            <div className="h-3 w-16 bg-gray-700/50 rounded" />
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/home/FeaturedTeachers.tsx src/components/skeletons/FeaturedTeachersSkeleton.tsx
git commit -m "feat: add FeaturedTeachers server component and skeleton"
```

---

## Task 6: Wire FeaturedTeachers into home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update `src/app/page.tsx`**

```tsx
// src/app/page.tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { RadioPlayer } from '@/components/home/RadioPlayer'
import { TodaySchedule } from '@/components/home/TodaySchedule'
import { FeaturedTeachers } from '@/components/home/FeaturedTeachers'
import { RadioPlayerSkeleton } from '@/components/skeletons/RadioPlayerSkeleton'
import { ScheduleSkeleton } from '@/components/skeletons/ScheduleSkeleton'
import { FeaturedTeachersSkeleton } from '@/components/skeletons/FeaturedTeachersSkeleton'
import { RadioStationSchema } from '@/components/seo/RadioStationSchema'

export const metadata: Metadata = {
  title: 'Listen',
  description: 'Reach Radio features Bible teachings and Christian music. Listen online or on the air in Tucson at 106.7FM and 690AM.',
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <div className="px-3 pt-3 space-y-6 pb-32">
      <h1 className="sr-only">Reach Radio</h1>
      <RadioStationSchema />

      <Suspense fallback={<RadioPlayerSkeleton />}>
        <RadioPlayer />
      </Suspense>

      <section>
        <h2 className="text-white font-bold text-lg px-3 uppercase mb-3">Playing Next</h2>
        <Suspense fallback={<ScheduleSkeleton />}>
          <TodaySchedule />
        </Suspense>
      </section>

      <Suspense fallback={<FeaturedTeachersSkeleton />}>
        <FeaturedTeachers />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: No TypeScript or build errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add FeaturedTeachers section to home page"
```

---

## Task 7: ScheduleTimeAxis component

**Files:**
- Create: `src/components/teachers/ScheduleTimeAxis.tsx`
- Test: `tests/unit/schedule-time-axis.test.tsx`

Context: The time axis renders from 5 AM (300 min) to 11 PM (1380 min). The container is `1080px` tall (1px per minute). Each slot is absolutely positioned. Music-gap bars fill gaps ≥ 5 min. Overlapping slots split the column width using `groupIntoColumns`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/schedule-time-axis.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScheduleTimeAxis } from '@/components/teachers/ScheduleTimeAxis'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

const makeTeacher = (
  slug: string,
  name: string,
  startTime: string,
  endTime: string,
  day = 'Monday'
): TeacherWithSchedule => ({
  slug,
  name,
  title: 'Show Title',
  photo: null,
  lqip: null,
  schedule: [{ day, times: [{ startTime, endTime }] }],
})

describe('ScheduleTimeAxis', () => {
  it('renders a slot button for each scheduled teacher', () => {
    const teachers = [
      makeTeacher('teacher-a', 'Teacher A', '9:00 AM', '9:30 AM'),
      makeTeacher('teacher-b', 'Teacher B', '10:00 AM', '10:30 AM'),
    ]
    render(<ScheduleTimeAxis teachers={teachers} selectedDay="Monday" onSelect={vi.fn()} />)
    expect(screen.getByText('Teacher A')).toBeInTheDocument()
    expect(screen.getByText('Teacher B')).toBeInTheDocument()
  })

  it('calls onSelect with teacher data when slot clicked', async () => {
    const onSelect = vi.fn()
    const teacher = makeTeacher('teacher-a', 'Teacher A', '9:00 AM', '9:30 AM')
    render(<ScheduleTimeAxis teachers={[teacher]} selectedDay="Monday" onSelect={onSelect} />)
    await userEvent.click(screen.getByText('Teacher A'))
    expect(onSelect).toHaveBeenCalledWith(teacher)
  })

  it('shows empty message when no teachers on selected day', () => {
    const teacher = makeTeacher('teacher-a', 'Teacher A', '9:00 AM', '9:30 AM', 'Tuesday')
    render(<ScheduleTimeAxis teachers={[teacher]} selectedDay="Monday" onSelect={vi.fn()} />)
    expect(screen.getByText(/no shows/i)).toBeInTheDocument()
  })

  it('renders hour tick labels', () => {
    render(<ScheduleTimeAxis teachers={[]} selectedDay="Monday" onSelect={vi.fn()} />)
    expect(screen.getByText('5 AM')).toBeInTheDocument()
    expect(screen.getByText('12 PM')).toBeInTheDocument()
    expect(screen.getByText('11 PM')).toBeInTheDocument()
  })

  it('renders a music gap bar for gaps >= 5 min', () => {
    const teachers = [
      makeTeacher('teacher-a', 'Teacher A', '9:00 AM', '9:30 AM'),
      makeTeacher('teacher-b', 'Teacher B', '10:00 AM', '10:30 AM'),
    ]
    render(<ScheduleTimeAxis teachers={teachers} selectedDay="Monday" onSelect={vi.fn()} />)
    expect(screen.getByTestId('music-gap')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/unit/schedule-time-axis.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/components/teachers/ScheduleTimeAxis.tsx`**

```tsx
// src/components/teachers/ScheduleTimeAxis.tsx
'use client'

import Image from 'next/image'
import { timeStringToMinutes } from '@/lib/utils/time'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

interface ParsedSlot {
  teacher: TeacherWithSchedule
  startMinutes: number
  endMinutes: number
}

interface Props {
  teachers: TeacherWithSchedule[]
  selectedDay: string
  onSelect: (teacher: TeacherWithSchedule) => void
}

const AXIS_START = 5 * 60   // 5:00 AM = 300 min
const AXIS_END   = 23 * 60  // 11:00 PM = 1380 min
const PX_PER_MIN = 1        // 1px per minute → 1080px total height
const MIN_HEIGHT_PX = 32

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5) // 5..23

function formatHourLabel(hour: number): string {
  if (hour === 0)  return '12 AM'
  if (hour < 12)  return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

function groupIntoColumns(slots: ParsedSlot[]): ParsedSlot[][] {
  const columns: ParsedSlot[][] = []
  for (const slot of slots) {
    let placed = false
    for (const col of columns) {
      const last = col[col.length - 1]
      if (slot.startMinutes >= last.endMinutes) {
        col.push(slot)
        placed = true
        break
      }
    }
    if (!placed) columns.push([slot])
  }
  return columns
}

export function ScheduleTimeAxis({ teachers, selectedDay, onSelect }: Props) {
  const slots: ParsedSlot[] = teachers
    .flatMap((t) =>
      (t.schedule ?? [])
        .filter((s) => s.day === selectedDay)
        .flatMap((s) =>
          s.times.map((time) => ({
            teacher: t,
            startMinutes: timeStringToMinutes(time.startTime),
            endMinutes: timeStringToMinutes(time.endTime),
          }))
        )
    )
    .filter((s) => s.endMinutes > s.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)

  if (slots.length === 0) {
    return (
      <p className="text-white/50 text-sm text-center py-8">No shows scheduled for this day.</p>
    )
  }

  const columns = groupIntoColumns(slots)
  const numCols = columns.length
  const totalHeight = (AXIS_END - AXIS_START) * PX_PER_MIN

  // Build music gap bars
  const gapBars: { startMin: number; endMin: number }[] = []
  for (let i = 0; i < slots.length - 1; i++) {
    const gap = slots[i + 1].startMinutes - slots[i].endMinutes
    if (gap >= 5) {
      gapBars.push({ startMin: slots[i].endMinutes, endMin: slots[i + 1].startMinutes })
    }
  }

  return (
    <div className="overflow-y-auto max-h-[500px]">
      <div className="relative" style={{ height: totalHeight }}>
        {/* Hour tick labels */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute left-0 w-12 text-right pr-2 text-xs text-white/40 leading-none"
            style={{ top: (h * 60 - AXIS_START) * PX_PER_MIN - 6 }}
          >
            {formatHourLabel(h)}
          </div>
        ))}

        {/* Horizontal tick lines */}
        {HOURS.map((h) => (
          <div
            key={`line-${h}`}
            className="absolute left-12 right-0 border-t border-white/5"
            style={{ top: (h * 60 - AXIS_START) * PX_PER_MIN }}
          />
        ))}

        {/* Slots area */}
        <div className="absolute left-12 right-0 top-0 bottom-0">
          {/* Music gap bars */}
          {gapBars.map((gap, i) => (
            <div
              key={i}
              data-testid="music-gap"
              className="absolute inset-x-0 bg-white/5 rounded flex items-center px-2"
              style={{
                top: (gap.startMin - AXIS_START) * PX_PER_MIN,
                height: Math.max(MIN_HEIGHT_PX, (gap.endMin - gap.startMin) * PX_PER_MIN),
              }}
            >
              <span className="text-white/30 text-xs">Music</span>
            </div>
          ))}

          {/* Teacher slot bars */}
          {columns.map((col, colIdx) =>
            col.map((slot) => {
              const topPx = (slot.startMinutes - AXIS_START) * PX_PER_MIN
              const heightPx = Math.max(MIN_HEIGHT_PX, (slot.endMinutes - slot.startMinutes) * PX_PER_MIN)
              const leftPct = (colIdx / numCols) * 100
              const widthPct = (1 / numCols) * 100

              return (
                <button
                  key={`${slot.teacher.slug}-${slot.startMinutes}`}
                  type="button"
                  onClick={() => onSelect(slot.teacher)}
                  className="absolute flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 active:bg-gray-600 rounded px-1.5 overflow-hidden transition-colors cursor-pointer"
                  style={{ top: topPx, height: heightPx, left: `${leftPct}%`, width: `${widthPct}%` }}
                >
                  {slot.teacher.photo && (
                    <Image
                      src={slot.teacher.photo}
                      alt={slot.teacher.name}
                      width={24}
                      height={24}
                      className="rounded-full flex-shrink-0 object-cover w-6 h-6"
                    />
                  )}
                  <span className="text-white text-xs font-medium truncate leading-tight">
                    {slot.teacher.name}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/unit/schedule-time-axis.test.tsx
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/teachers/ScheduleTimeAxis.tsx tests/unit/schedule-time-axis.test.tsx
git commit -m "feat: add ScheduleTimeAxis component with overlap detection and music gaps"
```

---

## Task 8: TeacherDetailSheet component

**Files:**
- Create: `src/components/teachers/TeacherDetailSheet.tsx`
- Test: `tests/unit/teacher-detail-sheet.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/teacher-detail-sheet.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeacherDetailSheet } from '@/components/teachers/TeacherDetailSheet'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))

const mockTeacher: TeacherWithSchedule = {
  name: 'Robert Furrow',
  slug: 'robert-furrow',
  title: 'RRBS',
  photo: null,
  lqip: null,
  schedule: [
    { day: 'Monday', times: [{ startTime: '9:00 AM', endTime: '9:30 AM' }] },
    { day: 'Wednesday', times: [{ startTime: '6:00 PM', endTime: '6:30 PM' }] },
  ],
}

describe('TeacherDetailSheet', () => {
  it('renders nothing when teacher is null', () => {
    render(<TeacherDetailSheet teacher={null} open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders teacher name and title when open', () => {
    render(<TeacherDetailSheet teacher={mockTeacher} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Robert Furrow')).toBeInTheDocument()
    expect(screen.getByText('RRBS')).toBeInTheDocument()
  })

  it('renders schedule days', () => {
    render(<TeacherDetailSheet teacher={mockTeacher} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText('Wednesday')).toBeInTheDocument()
  })

  it('renders view profile link to correct href', () => {
    render(<TeacherDetailSheet teacher={mockTeacher} open={true} onClose={vi.fn()} />)
    const link = screen.getByRole('link', { name: /view full profile/i })
    expect(link).toHaveAttribute('href', '/teachers/robert-furrow')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/unit/teacher-detail-sheet.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/components/teachers/TeacherDetailSheet.tsx`**

```tsx
// src/components/teachers/TeacherDetailSheet.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { BottomSheet } from '@/components/global/BottomSheet'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

interface Props {
  teacher: TeacherWithSchedule | null
  open: boolean
  onClose: () => void
}

const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function TeacherDetailSheet({ teacher, open, onClose }: Props) {
  if (!teacher) return null

  const sortedSchedule = [...(teacher.schedule ?? [])].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={`${teacher.name} details`}>
      <div className="flex items-center justify-between px-6 pb-4">
        <h2 className="text-white text-xl font-bold">{teacher.name}</h2>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="px-6 pb-10 space-y-5 overflow-y-auto max-h-[60vh]">
        <div className="flex items-center gap-4">
          {teacher.photo ? (
            <div className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0">
              <Image
                src={teacher.photo}
                alt={teacher.name}
                fill
                className="object-cover"
                placeholder={teacher.lqip ? 'blur' : 'empty'}
                blurDataURL={teacher.lqip ?? undefined}
                sizes="80px"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-700 flex-shrink-0" />
          )}
          <div>
            <p className="text-white/70 text-sm">{teacher.title}</p>
          </div>
        </div>

        {sortedSchedule.length > 0 && (
          <div>
            <h3 className="text-white/50 text-xs uppercase font-semibold mb-2">This Week</h3>
            <ul className="space-y-1.5">
              {sortedSchedule.map((day) => (
                <li key={day.day} className="flex gap-3">
                  <span className="text-white text-sm font-medium w-24 shrink-0">{day.day}</span>
                  <span className="text-white/60 text-sm">
                    {day.times.map((t) => `${t.startTime} – ${t.endTime}`).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href={`/teachers/${teacher.slug}`}
          onClick={onClose}
          className="flex items-center justify-center w-full bg-gray-700 hover:bg-gray-600 text-white rounded-xl py-4 text-sm font-semibold transition-colors cursor-pointer"
          aria-label={`View full profile for ${teacher.name}`}
        >
          View full profile →
        </Link>
      </div>
    </BottomSheet>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/unit/teacher-detail-sheet.test.tsx
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/teachers/TeacherDetailSheet.tsx tests/unit/teacher-detail-sheet.test.tsx
git commit -m "feat: add TeacherDetailSheet component using BottomSheet primitive"
```

---

## Task 9: ScheduleTabView component

**Files:**
- Create: `src/components/teachers/ScheduleTabView.tsx`

No dedicated unit test — `ScheduleTimeAxis` is already tested; day chip interaction is integration-level behavior covered by the existing Playwright e2e suite. The most-on-air computation uses `computeWeeklyMinutes` which is unit-tested.

- [ ] **Step 1: Implement `src/components/teachers/ScheduleTabView.tsx`**

```tsx
// src/components/teachers/ScheduleTabView.tsx
'use client'

import { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { ScheduleTimeAxis } from './ScheduleTimeAxis'
import { TeacherDetailSheet } from './TeacherDetailSheet'
import { computeWeeklyMinutes } from '@/lib/utils/time'
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
  const today = dayjs().tz(TZ).format('dddd')
  const [selectedDay, setSelectedDay] = useState(today)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithSchedule | null>(null)

  const mostOnAir = useMemo(() => {
    if (scheduleTeachers.length === 0) return null
    let best: { teacher: TeacherWithSchedule; minutes: number } | null = null
    for (const t of scheduleTeachers) {
      const mins = computeWeeklyMinutes(t.schedule)
      if (
        !best ||
        mins > best.minutes ||
        (mins === best.minutes && t.name < best.teacher.name)
      ) {
        best = { teacher: t, minutes: mins }
      }
    }
    return best && best.minutes > 0 ? best : null
  }, [scheduleTeachers])

  return (
    <>
      {mostOnAir && (
        <div className="flex items-center gap-2 px-1 mb-3 text-sm text-white/60">
          <span>Most on air:</span>
          <span className="text-white font-medium">{mostOnAir.teacher.name}</span>
          <span>·</span>
          <span>{Math.round(mostOnAir.minutes / 60)} hrs / wk</span>
        </div>
      )}

      {/* Day chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {DAYS.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => setSelectedDay(day)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              selectedDay === day
                ? 'bg-[var(--color-brand-green)] text-white'
                : 'bg-gray-700 text-white/70 hover:bg-gray-600 hover:text-white'
            }`}
          >
            {DAY_LABELS[day]}
          </button>
        ))}
      </div>

      <ScheduleTimeAxis
        teachers={scheduleTeachers}
        selectedDay={selectedDay}
        onSelect={setSelectedTeacher}
      />

      <TeacherDetailSheet
        teacher={selectedTeacher}
        open={selectedTeacher !== null}
        onClose={() => setSelectedTeacher(null)}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/teachers/ScheduleTabView.tsx
git commit -m "feat: add ScheduleTabView with day chips, most-on-air stat, and teacher detail sheet"
```

---

## Task 10: FilterSheet component

**Files:**
- Create: `src/components/teachers/FilterSheet.tsx`
- Test: `tests/unit/filter-sheet.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/filter-sheet.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterSheet } from '@/components/teachers/FilterSheet'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))

describe('FilterSheet', () => {
  it('renders nothing when closed', () => {
    render(
      <FilterSheet
        open={false}
        onClose={vi.fn()}
        onApply={vi.fn()}
        initialSort={undefined}
        initialDays={[]}
      />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders sort options and day chips when open', () => {
    render(
      <FilterSheet
        open={true}
        onClose={vi.fn()}
        onApply={vi.fn()}
        initialSort={undefined}
        initialDays={[]}
      />
    )
    expect(screen.getByText('A – Z')).toBeInTheDocument()
    expect(screen.getByText('Z – A')).toBeInTheDocument()
    expect(screen.getByText('Most on air')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('calls onApply with selected sort and days when Apply clicked', async () => {
    const onApply = vi.fn()
    const onClose = vi.fn()
    render(
      <FilterSheet
        open={true}
        onClose={onClose}
        onApply={onApply}
        initialSort={undefined}
        initialDays={[]}
      />
    )
    await userEvent.click(screen.getByText('Most on air'))
    await userEvent.click(screen.getByText('Mon'))
    await userEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(onApply).toHaveBeenCalledWith({ sort: 'most-on-air', days: ['Monday'] })
    expect(onClose).toHaveBeenCalled()
  })

  it('resets pending state and calls onApply with empty when Clear all clicked', async () => {
    const onApply = vi.fn()
    render(
      <FilterSheet
        open={true}
        onClose={vi.fn()}
        onApply={onApply}
        initialSort="name-desc"
        initialDays={['Monday']}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(onApply).toHaveBeenCalledWith({ sort: undefined, days: [] })
  })

  it('toggles day chip off when clicked twice', async () => {
    const onApply = vi.fn()
    render(
      <FilterSheet
        open={true}
        onClose={vi.fn()}
        onApply={onApply}
        initialSort={undefined}
        initialDays={[]}
      />
    )
    await userEvent.click(screen.getByText('Mon'))
    await userEvent.click(screen.getByText('Mon'))
    await userEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(onApply).toHaveBeenCalledWith({ sort: undefined, days: [] })
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/unit/filter-sheet.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/components/teachers/FilterSheet.tsx`**

```tsx
// src/components/teachers/FilterSheet.tsx
'use client'

import { useState } from 'react'
import { BottomSheet } from '@/components/global/BottomSheet'
import type { SortOption } from '@/lib/teachers/filter'

interface ApplyPayload {
  sort: SortOption | undefined
  days: string[]
}

interface Props {
  open: boolean
  onClose: () => void
  onApply: (payload: ApplyPayload) => void
  initialSort: SortOption | undefined
  initialDays: string[]
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'A – Z' },
  { value: 'name-desc', label: 'Z – A' },
  { value: 'most-on-air', label: 'Most on air' },
]

const DAY_OPTIONS: { label: string; full: string }[] = [
  { label: 'Sun', full: 'Sunday' },
  { label: 'Mon', full: 'Monday' },
  { label: 'Tue', full: 'Tuesday' },
  { label: 'Wed', full: 'Wednesday' },
  { label: 'Thu', full: 'Thursday' },
  { label: 'Fri', full: 'Friday' },
  { label: 'Sat', full: 'Saturday' },
]

export function FilterSheet({ open, onClose, onApply, initialSort, initialDays }: Props) {
  const [pendingSort, setPendingSort] = useState<SortOption | undefined>(initialSort)
  const [pendingDays, setPendingDays] = useState<string[]>(initialDays)

  function toggleDay(fullName: string) {
    setPendingDays((prev) =>
      prev.includes(fullName) ? prev.filter((d) => d !== fullName) : [...prev, fullName]
    )
  }

  function handleApply() {
    onApply({ sort: pendingSort, days: pendingDays })
    onClose()
  }

  function handleClear() {
    setPendingSort(undefined)
    setPendingDays([])
    onApply({ sort: undefined, days: [] })
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Filter and sort teachers">
      <div className="flex items-center justify-between px-6 pb-4">
        <h2 className="text-white text-xl font-bold">Filter &amp; Sort</h2>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="px-6 pb-10 space-y-6">
        {/* Sort */}
        <div>
          <p className="text-white/50 text-xs uppercase font-semibold mb-3">Sort by</p>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPendingSort(pendingSort === value ? undefined : value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                  pendingSort === value
                    ? 'bg-[var(--color-brand-green)] text-white'
                    : 'bg-gray-700 text-white/70 hover:bg-gray-600 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Day filter */}
        <div>
          <p className="text-white/50 text-xs uppercase font-semibold mb-3">Airs on</p>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map(({ label, full }) => (
              <button
                key={full}
                type="button"
                onClick={() => toggleDay(full)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                  pendingDays.includes(full)
                    ? 'bg-[var(--color-brand-green)] text-white'
                    : 'bg-gray-700 text-white/70 hover:bg-gray-600 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 bg-[var(--color-brand-green)] text-white py-4 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 cursor-pointer"
            aria-label="Apply filters"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-6 py-4 rounded-xl text-white/60 text-sm font-medium hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Clear all filters"
          >
            Clear all
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/unit/filter-sheet.test.tsx
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/teachers/FilterSheet.tsx tests/unit/filter-sheet.test.tsx
git commit -m "feat: add FilterSheet component with sort and day filter options"
```

---

## Task 11: Extend TeachersClientView with tabs and filter integration

**Files:**
- Modify: `src/components/teachers/TeachersClientView.tsx`

- [ ] **Step 1: Replace `src/components/teachers/TeachersClientView.tsx`**

```tsx
// src/components/teachers/TeachersClientView.tsx
'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import { SearchInput } from '@/components/global/SearchInput'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { ScheduleTabView } from '@/components/teachers/ScheduleTabView'
import { FilterSheet } from '@/components/teachers/FilterSheet'
import { filterTeachers } from '@/lib/teachers/filter'
import type { SortOption } from '@/lib/teachers/filter'
import type { TeacherSummary, TeacherWithSchedule, ScheduleDay } from '@/lib/sanity/types'

const DAY_ABBREV_TO_FULL: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}
const DAY_FULL_TO_ABBREV: Record<string, string> = Object.fromEntries(
  Object.entries(DAY_ABBREV_TO_FULL).map(([k, v]) => [v, k])
)

interface TeachersClientViewProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
  initialQuery?: string
  initialSort?: SortOption
  initialDays?: string[]
}

type Tab = 'teachers' | 'schedule'

export function TeachersClientView({
  teachers,
  scheduleTeachers,
  initialQuery = '',
  initialSort,
  initialDays = [],
}: TeachersClientViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('teachers')
  const [query, setQuery] = useState(initialQuery)
  const [activeSort, setActiveSort] = useState<SortOption | undefined>(initialSort)
  const [activeDays, setActiveDays] = useState<string[]>(
    initialDays.map((a) => DAY_ABBREV_TO_FULL[a]).filter(Boolean)
  )
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 200)
  const hasMounted = useRef(false)

  const scheduleMap = useMemo(
    () => new Map<string, ScheduleDay[]>(scheduleTeachers.map((t) => [t.slug, t.schedule])),
    [scheduleTeachers]
  )

  const hoursMap = useMemo(
    () =>
      new Map<string, number>(
        scheduleTeachers.map((t) => [
          t.slug,
          t.schedule.reduce(
            (total, day) =>
              total +
              day.times.reduce((dt, slot) => {
                const [sh, sm] = slot.startTime.split(' ')[0].split(':').map(Number)
                const [eh, em] = slot.endTime.split(' ')[0].split(':').map(Number)
                const startMod = slot.startTime.includes('PM') && sh !== 12 ? sh + 12 : sh
                const endMod = slot.endTime.includes('PM') && eh !== 12 ? eh + 12 : eh
                return dt + Math.max(0, (endMod * 60 + em) - (startMod * 60 + sm))
              }, 0),
            0
          ),
        ])
      ),
    [scheduleTeachers]
  )

  const filtered = useMemo(
    () =>
      filterTeachers(teachers, debouncedQuery, {
        sort: activeSort,
        days: activeDays,
        scheduleMap,
        hoursMap,
      }),
    [teachers, debouncedQuery, activeSort, activeDays, scheduleMap, hoursMap]
  )

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    const params = new URLSearchParams()
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim())
    if (activeSort) params.set('sort', activeSort)
    if (activeDays.length) {
      params.set('days', activeDays.map((d) => DAY_FULL_TO_ABBREV[d]).filter(Boolean).join(','))
    }
    router.replace(params.toString() ? `/teachers?${params}` : '/teachers', { scroll: false })
  }, [debouncedQuery, activeSort, activeDays, router])

  const activeFilterCount = (activeSort ? 1 : 0) + (activeDays.length > 0 ? 1 : 0)
  const isFiltered = debouncedQuery.trim().length > 0 || activeFilterCount > 0
  const countLabel = isFiltered
    ? `${filtered.length} of ${teachers.length} shown`
    : `${teachers.length} teachers`

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-white text-2xl font-bold">Teachers</h1>
        {activeTab === 'teachers' && (
          <span className="text-white/50 text-sm" aria-live="polite" aria-atomic="true">
            {countLabel}
          </span>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 border-b border-white/10">
        {(['teachers', 'schedule'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-white border-[var(--color-brand-green)]'
                : 'text-white/50 border-transparent hover:text-white/80'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'teachers' && (
        <>
          {/* Search + filter row */}
          <div className="flex items-center gap-2 mb-4">
            <SearchInput
              value={query}
              onChange={setQuery}
              onClear={() => setQuery('')}
              placeholder="Search teachers..."
              aria-label="Search teachers"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              aria-label={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
              className="relative flex h-11 w-11 items-center justify-center rounded-lg bg-gray-700 text-white/70 hover:bg-gray-600 hover:text-white transition-colors cursor-pointer flex-shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="11" y1="18" x2="13" y2="18" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-brand-green)] text-white text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Active day filter chips */}
          {activeDays.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {activeDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setActiveDays((prev) => prev.filter((d) => d !== day))}
                  className="flex items-center gap-1 bg-[var(--color-brand-green)]/20 text-[var(--color-brand-green)] text-xs px-3 py-1.5 rounded-full hover:bg-[var(--color-brand-green)]/30 transition-colors cursor-pointer"
                >
                  {day}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              {activeSort && (
                <button
                  type="button"
                  onClick={() => setActiveSort(undefined)}
                  className="flex items-center gap-1 bg-[var(--color-brand-green)]/20 text-[var(--color-brand-green)] text-xs px-3 py-1.5 rounded-full hover:bg-[var(--color-brand-green)]/30 transition-colors cursor-pointer"
                >
                  {activeSort === 'name-asc' ? 'A–Z' : activeSort === 'name-desc' ? 'Z–A' : 'Most on air'}
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
          )}

          {/* Teacher grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((teacher, index) => (
                <TeacherCard key={teacher.slug} teacher={teacher} index={index} />
              ))}
            </div>
          ) : isFiltered ? (
            <div className="text-white/60 mt-4">
              <p>No teachers found.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setActiveSort(undefined)
                  setActiveDays([])
                }}
                className="mt-2 text-sm text-white/80 underline hover:text-white cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : null}

          <FilterSheet
            open={filterSheetOpen}
            onClose={() => setFilterSheetOpen(false)}
            onApply={({ sort, days }) => {
              setActiveSort(sort)
              setActiveDays(days)
            }}
            initialSort={activeSort}
            initialDays={activeDays}
          />
        </>
      )}

      {activeTab === 'schedule' && <ScheduleTabView scheduleTeachers={scheduleTeachers} />}
    </>
  )
}
```

**Note:** `hoursMap` above computes total minutes directly without importing `timeStringToMinutes` to avoid a circular dep risk. If you prefer DRY, import `computeWeeklyMinutes` from `@/lib/utils/time` and replace the inline `reduce` with: `` t.schedule.reduce(...) → computeWeeklyMinutes(t.schedule) ``.

Actually, replace the `hoursMap` useMemo with the cleaner version using `computeWeeklyMinutes`:

```tsx
// Replace the hoursMap useMemo in TeachersClientView.tsx with:
import { computeWeeklyMinutes } from '@/lib/utils/time'

const hoursMap = useMemo(
  () =>
    new Map<string, number>(
      scheduleTeachers.map((t) => [t.slug, computeWeeklyMinutes(t.schedule)])
    ),
  [scheduleTeachers]
)
```

Remove the inline computation. The final file should import `computeWeeklyMinutes` from `@/lib/utils/time`.

- [ ] **Step 2: Run all unit tests**

```bash
npm test
```

Expected: All tests PASS. Check specifically that `filter-teachers.test.ts` still passes (existing tests must not regress).

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/TeachersClientView.tsx
git commit -m "feat: add schedule tab and filter sheet to TeachersClientView"
```

---

## Task 12: Update teachers/page.tsx (dual fetch + search params)

**Files:**
- Modify: `src/app/teachers/page.tsx`

- [ ] **Step 1: Replace `src/app/teachers/page.tsx`**

```tsx
// src/app/teachers/page.tsx
import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import type { SortOption } from '@/lib/teachers/filter'
import { TeachersClientView } from '@/components/teachers/TeachersClientView'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Teachers',
  description: 'Listen to many great bible teachers on Reach Radio Tucson.',
  alternates: { canonical: '/teachers' },
  openGraph: {
    title: 'Teachers | Reach Radio',
    description: 'Listen to many great bible teachers on Reach Radio Tucson.',
    url: '/teachers',
  },
  twitter: {
    title: 'Teachers | Reach Radio',
    description: 'Listen to many great bible teachers on Reach Radio Tucson.',
  },
}

const VALID_SORTS = new Set<SortOption>(['name-asc', 'name-desc', 'most-on-air'])
const VALID_DAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])

interface Props {
  searchParams: Promise<{ q?: string; sort?: string; days?: string }>
}

export default async function TeachersPage({ searchParams }: Props) {
  const { q = '', sort = '', days = '' } = await searchParams

  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['schedule'] }),
  ])

  const initialSort = VALID_SORTS.has(sort as SortOption) ? (sort as SortOption) : undefined
  const initialDays = days
    ? days.split(',').map((d) => d.toLowerCase().trim()).filter((d) => VALID_DAYS.has(d))
    : []

  return (
    <div className="px-4 py-6">
      <ShowMediaBar />
      <TeachersClientView
        teachers={teachers}
        scheduleTeachers={scheduleTeachers}
        initialQuery={q}
        initialSort={initialSort}
        initialDays={initialDays}
      />
    </div>
  )
}
```

- [ ] **Step 2: Run build to verify no TypeScript errors**

```bash
npm run build 2>&1 | tail -30
```

Expected: Successful build with no type errors.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/teachers/page.tsx
git commit -m "feat: dual-fetch schedule data and wire filter URL params in teachers page"
```

---

## Task 13: Refactor SleepTimerSheet to use BottomSheet primitive

**Files:**
- Modify: `src/components/home/SleepTimerSheet.tsx`
- Modify: `tests/unit/sleep-timer-sheet.test.tsx`

- [ ] **Step 1: Update `sleep-timer-sheet.test.tsx` to use new backdrop testid**

Change the one reference to `sheet-backdrop` in `tests/unit/sleep-timer-sheet.test.tsx`:

```ts
// Find this line:
fireEvent.click(screen.getByTestId('sheet-backdrop'))
// Change to:
fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'))
```

- [ ] **Step 2: Run the sleep timer test to confirm the updated testid test now fails**

```bash
npm test -- tests/unit/sleep-timer-sheet.test.tsx
```

Expected: The backdrop test FAILS (old testid is still present in SleepTimerSheet). All other sleep timer tests pass.

- [ ] **Step 3: Refactor `src/components/home/SleepTimerSheet.tsx` to use BottomSheet**

```tsx
// src/components/home/SleepTimerSheet.tsx
'use client'

import { useCallback } from 'react'
import { BottomSheet } from '@/components/global/BottomSheet'
import { useMediaStore } from '@/lib/store/media-store'

const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60]

interface SleepTimerSheetProps {
  open: boolean
  onClose: () => void
}

export function SleepTimerSheet({ open, onClose }: SleepTimerSheetProps) {
  const active = useMediaStore((s) => s.sleepTimerActive)
  const remainingSeconds = useMediaStore((s) => s.remainingSleepSeconds)
  const startSleepTimer = useMediaStore((s) => s.startSleepTimer)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)

  function start(mins: number) {
    startSleepTimer(mins * 60)
    onClose()
  }

  function cancel() {
    setSleepTimerActive(false)
    setRemainingSleepSeconds(0)
    onClose()
  }

  const minutes = Math.floor(remainingSeconds / 60)
  const secs = remainingSeconds % 60

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Sleep timer">
      <div className="flex items-center justify-between px-6 pb-4">
        <h2 id="sleep-timer-heading" className="text-white text-xl font-bold select-none">
          Sleep Timer
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
          aria-label="Close sleep timer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="px-6 pb-10">
        {active ? (
          <div className="text-center">
            <p
              className="text-white text-5xl font-mono mb-2"
              aria-live="polite"
              aria-atomic="true"
            >
              {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </p>
            <p className="text-white/60 text-sm mb-8">
              Radio stops in {minutes}m {secs}s
            </p>
            <button
              type="button"
              onClick={cancel}
              className="w-full bg-red-600 text-white py-4 rounded-xl font-semibold text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
            >
              Cancel Timer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {TIMER_OPTIONS.map((mins) => (
              <button
                type="button"
                key={mins}
                onClick={() => start(mins)}
                className="bg-gray-700 text-white py-5 rounded-xl font-semibold text-lg hover:bg-gray-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
              >
                {mins}m
              </button>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
```

**Key difference from original:** Removed `createPortal`, `useRef(sheetRef)`, `useSheetDrag`, `useState(visible)`, `useEffect` for animation/keyboard — all moved into `BottomSheet`. The `firstBtnRef` focus-on-open is handled by `BottomSheet`'s `requestAnimationFrame` block which focuses the first interactive element. If you want to keep explicit first-button focus, add a `ref` to the first timer button and call `.focus()` in `BottomSheet`'s open effect — but the generic approach in BottomSheet handles it.

- [ ] **Step 4: Run sleep timer tests**

```bash
npm test -- tests/unit/sleep-timer-sheet.test.tsx
```

Expected: All 6 tests PASS including the backdrop test.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/SleepTimerSheet.tsx tests/unit/sleep-timer-sheet.test.tsx
git commit -m "refactor: migrate SleepTimerSheet to use shared BottomSheet primitive"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Feature 1 (schedule tab, day chips, time axis, most-on-air, teacher detail sheet): Tasks 2, 7, 8, 9, 11, 12
  - Feature 2 (highlighted teachers, home page section): Tasks 4, 5, 6
  - Feature 3 (filter bottom sheet, sort/day filter, URL params, active chips): Tasks 3, 10, 11, 12
  - Feature 4 (BottomSheet primitive, SleepTimerSheet refactor): Tasks 1, 13
  - All edge cases addressed: Task 7 handles empty days + music gaps; Task 12 validates URL params; Task 5 handles empty teachers array

- [x] **Placeholder scan:** No TBD/TODO. All code blocks are complete.

- [x] **Type consistency:**
  - `SortOption` defined in Task 3 (`filter.ts`), imported in Tasks 10, 11, 12
  - `TeacherWithSchedule` imported from `@/lib/sanity/types` in Tasks 7, 8, 9, 10, 11, 12
  - `BottomSheet` props interface (`open`, `onClose`, `ariaLabel`, `children`) consistent across Tasks 1, 8, 10, 13
  - `FilterSheet.onApply` payload `{ sort: SortOption | undefined, days: string[] }` consistent between Task 10 definition and Task 11 usage
  - `computeWeeklyMinutes` defined in Task 2, imported in Tasks 9 and 11
  - `sortByHighlightedOrder` defined in Task 4, used in Task 5

---

**Plan saved to `docs/superpowers/plans/2026-05-26-schedule-viz.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, isolated fast iteration

**2. Inline Execution** — execute tasks in this session using `executing-plans` skill, batch with checkpoints

Which approach?
