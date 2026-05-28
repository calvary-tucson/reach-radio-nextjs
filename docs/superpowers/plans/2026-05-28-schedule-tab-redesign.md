# Schedule Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pixel-per-minute schedule layout with a card-based list that is readable at all screen sizes.

**Architecture:** A new `buildDaySlots` utility produces a typed `ScheduleSlot[]` (show cards + music gap rows) for any given day. `ScheduleCardList` renders this list for mobile and narrow desktop. `ScheduleWeekCards` renders a 7-column grid of `ScheduleCardList` columns for wide desktop. `TeacherDetailPanel` is a new right-side overlay for desktop; the existing `TeacherDetailSheet` bottom sheet stays for mobile. `ScheduleTabView` orchestrates all three breakpoints.

**Tech Stack:** Next.js (React 19), TypeScript strict, Tailwind CSS, dayjs + timezone plugin, Vitest + Testing Library

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/lib/teachers/schedule.ts` | `ScheduleSlot` type + `buildDaySlots` utility |
| Create | `src/components/teachers/ScheduleCardList.tsx` | Renders sorted show cards + music gaps for one day |
| Create | `src/components/teachers/TeacherDetailPanel.tsx` | Right-side overlay panel for desktop (≥ md) |
| Create | `src/components/teachers/ScheduleWeekCards.tsx` | 7-column card grid for wide desktop (≥ lg) |
| Modify | `src/components/teachers/ScheduleTabView.tsx` | Orchestrates breakpoint layout, computes currentTime |
| Modify | `src/components/skeletons/ScheduleTabSkeleton.tsx` | Update to card-style skeletons |
| Delete | `src/components/teachers/ScheduleTimeAxis.tsx` | Replaced by ScheduleCardList |
| Delete | `src/components/teachers/ScheduleWeekView.tsx` | Replaced by ScheduleWeekCards |
| Create | `tests/unit/schedule-slots.test.ts` | Unit tests for buildDaySlots |
| Create | `tests/unit/schedule-card-list.test.tsx` | Unit tests for ScheduleCardList |
| Create | `tests/unit/teacher-detail-panel.test.tsx` | Unit tests for TeacherDetailPanel |
| Delete | `tests/unit/schedule-time-axis.test.tsx` | Tests for deleted component |

---

## Task 1: `ScheduleSlot` type + `buildDaySlots` utility

**Files:**
- Create: `src/lib/teachers/schedule.ts`
- Create: `tests/unit/schedule-slots.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/schedule-slots.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildDaySlots } from '@/lib/teachers/schedule'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

function makeTeacher(slug: string, name: string, day: string, times: { startTime: string; endTime: string }[]): TeacherWithSchedule {
  return { slug, name, title: null, photo: null, schedule: [{ day, times }] }
}

describe('buildDaySlots', () => {
  it('returns empty array when no teachers have shows on the given day', () => {
    const teachers = [makeTeacher('a', 'A', 'Monday', [{ startTime: '9:00 AM', endTime: '10:00 AM' }])]
    expect(buildDaySlots(teachers, 'Tuesday')).toEqual([])
  })

  it('returns show slots sorted by startMinutes', () => {
    const teachers = [
      makeTeacher('b', 'B', 'Monday', [{ startTime: '10:00 AM', endTime: '11:00 AM' }]),
      makeTeacher('a', 'A', 'Monday', [{ startTime: '8:00 AM', endTime: '9:00 AM' }]),
    ]
    const slots = buildDaySlots(teachers, 'Monday')
    expect(slots[0]).toMatchObject({ type: 'show', teacher: expect.objectContaining({ slug: 'a' }) })
    expect(slots[1]).toMatchObject({ type: 'show', teacher: expect.objectContaining({ slug: 'b' }) })
  })

  it('inserts a music gap between shows with a gap >= 5 minutes', () => {
    const teachers = [
      makeTeacher('a', 'A', 'Monday', [{ startTime: '9:00 AM', endTime: '10:00 AM' }]),
      makeTeacher('b', 'B', 'Monday', [{ startTime: '10:30 AM', endTime: '11:30 AM' }]),
    ]
    const slots = buildDaySlots(teachers, 'Monday')
    expect(slots).toHaveLength(3)
    expect(slots[1]).toMatchObject({ type: 'music', startMinutes: 600, endMinutes: 630 })
  })

  it('does not insert a music gap when shows are adjacent (< 5 min gap)', () => {
    const teachers = [
      makeTeacher('a', 'A', 'Monday', [{ startTime: '9:00 AM', endTime: '10:00 AM' }]),
      makeTeacher('b', 'B', 'Monday', [{ startTime: '10:03 AM', endTime: '11:00 AM' }]),
    ]
    const slots = buildDaySlots(teachers, 'Monday')
    expect(slots).toHaveLength(2)
    expect(slots.every((s) => s.type === 'show')).toBe(true)
  })

  it('filters out slots where endMinutes <= startMinutes', () => {
    const teachers = [makeTeacher('a', 'A', 'Monday', [{ startTime: '10:00 AM', endTime: '9:00 AM' }])]
    expect(buildDaySlots(teachers, 'Monday')).toEqual([])
  })

  it('collects slots from multiple teachers on the same day', () => {
    const teachers = [
      makeTeacher('a', 'A', 'Monday', [{ startTime: '6:00 AM', endTime: '8:00 AM' }]),
      makeTeacher('b', 'B', 'Monday', [{ startTime: '8:00 AM', endTime: '10:00 AM' }]),
    ]
    const slots = buildDaySlots(teachers, 'Monday')
    const showSlots = slots.filter((s) => s.type === 'show')
    expect(showSlots).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/schedule-slots.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/teachers/schedule'`

- [ ] **Step 3: Create `src/lib/teachers/schedule.ts`**

```ts
import { timeStringToMinutes } from '@/lib/utils/time'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

export type ScheduleSlot =
  | { type: 'show'; teacher: TeacherWithSchedule; startMinutes: number; endMinutes: number }
  | { type: 'music'; startMinutes: number; endMinutes: number }

export function buildDaySlots(teachers: TeacherWithSchedule[], day: string): ScheduleSlot[] {
  const showSlots: Extract<ScheduleSlot, { type: 'show' }>[] = teachers
    .flatMap((t) =>
      (t.schedule ?? [])
        .filter((s) => s.day === day)
        .flatMap((s) =>
          s.times.map((time) => ({
            type: 'show' as const,
            teacher: t,
            startMinutes: timeStringToMinutes(time.startTime),
            endMinutes: timeStringToMinutes(time.endTime),
          }))
        )
    )
    .filter((s) => s.endMinutes > s.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)

  const result: ScheduleSlot[] = []
  for (let i = 0; i < showSlots.length; i++) {
    const current = showSlots[i]!
    result.push(current)
    const next = showSlots[i + 1]
    if (next && next.startMinutes - current.endMinutes >= 5) {
      result.push({ type: 'music', startMinutes: current.endMinutes, endMinutes: next.startMinutes })
    }
  }
  return result
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/schedule-slots.test.ts
```

Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/teachers/schedule.ts tests/unit/schedule-slots.test.ts
git commit -m "feat(schedule): add ScheduleSlot type and buildDaySlots utility"
```

---

## Task 2: `ScheduleCardList` component

**Files:**
- Create: `src/components/teachers/ScheduleCardList.tsx`
- Create: `tests/unit/schedule-card-list.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/schedule-card-list.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScheduleCardList } from '@/components/teachers/ScheduleCardList'
import type { ScheduleSlot } from '@/lib/teachers/schedule'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

function makeTeacher(slug: string, name: string): TeacherWithSchedule {
  return { slug, name, title: null, photo: null, schedule: [] }
}

function makeShowSlot(teacher: TeacherWithSchedule, startMinutes: number, endMinutes: number): ScheduleSlot {
  return { type: 'show', teacher, startMinutes, endMinutes }
}

function makeMusicSlot(startMinutes: number, endMinutes: number): ScheduleSlot {
  return { type: 'music', startMinutes, endMinutes }
}

describe('ScheduleCardList', () => {
  it('renders "No shows" when slots is empty', () => {
    render(<ScheduleCardList slots={[]} currentTime={0} onSelect={vi.fn()} />)
    expect(screen.getByText(/no shows/i)).toBeInTheDocument()
  })

  it('renders a button for each show slot', () => {
    const slots: ScheduleSlot[] = [
      makeShowSlot(makeTeacher('a', 'Alice'), 540, 600),
      makeShowSlot(makeTeacher('b', 'Bob'), 600, 660),
    ]
    render(<ScheduleCardList slots={slots} currentTime={0} onSelect={vi.fn()} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('calls onSelect with the teacher when a show card is clicked', async () => {
    const onSelect = vi.fn()
    const teacher = makeTeacher('a', 'Alice')
    const slots: ScheduleSlot[] = [makeShowSlot(teacher, 540, 600)]
    render(<ScheduleCardList slots={slots} currentTime={0} onSelect={onSelect} />)
    await userEvent.click(screen.getByText('Alice'))
    expect(onSelect).toHaveBeenCalledWith(teacher)
  })

  it('renders a music gap row with data-testid="music-gap"', () => {
    const slots: ScheduleSlot[] = [makeMusicSlot(600, 660)]
    render(<ScheduleCardList slots={slots} currentTime={0} onSelect={vi.fn()} />)
    expect(screen.getByTestId('music-gap')).toBeInTheDocument()
  })

  it('highlights the active show when currentTime is within its range', () => {
    const slots: ScheduleSlot[] = [
      makeShowSlot(makeTeacher('a', 'Alice'), 540, 600), // 9:00–10:00 AM
      makeShowSlot(makeTeacher('b', 'Bob'), 600, 660),   // 10:00–11:00 AM
    ]
    render(<ScheduleCardList slots={slots} currentTime={570} onSelect={vi.fn()} />)
    // Alice's card should have active styling
    const aliceBtn = screen.getByRole('button', { name: /alice/i })
    expect(aliceBtn.className).toContain('border')
  })

  it('does not highlight any show when currentTime is -1', () => {
    const slots: ScheduleSlot[] = [makeShowSlot(makeTeacher('a', 'Alice'), 540, 600)]
    render(<ScheduleCardList slots={slots} currentTime={-1} onSelect={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /alice/i })
    expect(btn.className).not.toContain('border-[rgba(132,184,79')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/schedule-card-list.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/teachers/ScheduleCardList'`

- [ ] **Step 3: Create `src/components/teachers/ScheduleCardList.tsx`**

```tsx
'use client'

import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import type { TeacherWithSchedule } from '@/lib/sanity/types'
import type { ScheduleSlot } from '@/lib/teachers/schedule'

function formatTimeMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h < 12 ? 'AM' : 'PM'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`
}

function formatDuration(startMinutes: number, endMinutes: number): string {
  const mins = endMinutes - startMinutes
  if (mins < 60) return `${mins}m`
  const h = mins / 60
  return h === Math.floor(h) ? `${h}h` : `${h.toFixed(1)}h`
}

interface Props {
  slots: ScheduleSlot[]
  /** Minutes since midnight in Phoenix TZ. Pass -1 to disable "on air now" highlighting. */
  currentTime: number
  onSelect: (teacher: TeacherWithSchedule) => void
  /** Compact mode for narrow desktop columns: smaller avatar, tighter text. */
  compact?: boolean
}

export function ScheduleCardList({ slots, currentTime, onSelect, compact = false }: Props) {
  if (slots.length === 0) {
    return (
      <p className="text-white/50 text-sm text-center py-8">No shows scheduled for this day.</p>
    )
  }

  const activeSlot = currentTime >= 0
    ? slots.find(
        (s): s is Extract<ScheduleSlot, { type: 'show' }> =>
          s.type === 'show' && s.startMinutes <= currentTime && currentTime < s.endMinutes
      )
    : undefined

  return (
    <div className="flex flex-col gap-2">
      {slots.map((slot, i) => {
        if (slot.type === 'music') {
          return (
            <div
              key={`music-${i}`}
              data-testid="music-gap"
              className="bg-white/[0.025] rounded-lg px-4 py-3 flex items-center gap-2"
            >
              <span className="text-white/25 text-xs italic">♪ Music</span>
              <span className="text-white/20 text-xs">
                {formatTimeMinutes(slot.startMinutes)} – {formatTimeMinutes(slot.endMinutes)}
              </span>
            </div>
          )
        }

        const isActive = slot === activeSlot
        const avatarSize = compact ? 'xs' : 'sm'
        const avatarPx = compact ? '24px' : '38px'

        return (
          <button
            key={`${slot.teacher.slug}-${slot.startMinutes}`}
            type="button"
            onClick={() => onSelect(slot.teacher)}
            aria-label={`${slot.teacher.name} ${formatTimeMinutes(slot.startMinutes)} to ${formatTimeMinutes(slot.endMinutes)}`}
            className={`rounded-xl text-left transition-colors cursor-pointer w-full ${
              compact ? 'px-2 py-2' : 'px-4 py-3'
            } ${
              isActive
                ? 'bg-[rgba(132,184,79,0.10)] border border-[rgba(132,184,79,0.25)] hover:bg-[rgba(132,184,79,0.14)]'
                : 'bg-white/[0.04] hover:bg-white/[0.07]'
            }`}
          >
            <div className="flex items-center gap-3">
              <TeacherAvatar
                name={slot.teacher.name}
                photo={slot.teacher.photo}
                lqip={slot.teacher.lqip ?? null}
                size={avatarSize}
                shape="circle"
                sizes={avatarPx}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-white font-semibold truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                  {slot.teacher.name}
                </p>
                <p className={`${compact ? 'text-[10px]' : 'text-xs'} ${isActive ? 'text-[#84b84f]' : 'text-white/55'}`}>
                  {formatTimeMinutes(slot.startMinutes)} – {formatTimeMinutes(slot.endMinutes)}
                </p>
              </div>
              {!compact && (
                <span className={`text-xs font-medium px-2 py-1 rounded-md flex-shrink-0 ${
                  isActive
                    ? 'text-[#84b84f] bg-[rgba(132,184,79,0.15)]'
                    : 'text-white/30 bg-white/[0.06]'
                }`}>
                  {formatDuration(slot.startMinutes, slot.endMinutes)}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/schedule-card-list.test.tsx
```

Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/teachers/ScheduleCardList.tsx tests/unit/schedule-card-list.test.tsx
git commit -m "feat(schedule): add ScheduleCardList card-based day view"
```

---

## Task 3: `TeacherDetailPanel` component

**Files:**
- Create: `src/components/teachers/TeacherDetailPanel.tsx`
- Create: `tests/unit/teacher-detail-panel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/teacher-detail-panel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherDetailPanel } from '@/components/teachers/TeacherDetailPanel'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

const teacher: TeacherWithSchedule = {
  slug: 'mike-robinson',
  name: 'Mike Robinson',
  title: 'Morning Show Host',
  photo: null,
  schedule: [{ day: 'Monday', times: [{ startTime: '6:00 AM', endTime: '8:00 AM' }] }],
}

describe('TeacherDetailPanel', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <TeacherDetailPanel teacher={teacher} open={false} onClose={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when teacher is null', () => {
    const { container } = render(
      <TeacherDetailPanel teacher={null} open={true} onClose={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders teacher name and title when open', () => {
    render(<TeacherDetailPanel teacher={teacher} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Mike Robinson')).toBeInTheDocument()
    expect(screen.getByText('Morning Show Host')).toBeInTheDocument()
  })

  it('renders weekly schedule', () => {
    render(<TeacherDetailPanel teacher={teacher} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText(/6:00 AM/)).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<TeacherDetailPanel teacher={teacher} open={true} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(<TeacherDetailPanel teacher={teacher} open={true} onClose={onClose} />)
    await userEvent.click(screen.getByTestId('teacher-detail-panel-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('has a "View full profile" link pointing to the teacher slug', () => {
    render(<TeacherDetailPanel teacher={teacher} open={true} onClose={vi.fn()} />)
    const link = screen.getByRole('link', { name: /view full profile/i })
    expect(link).toHaveAttribute('href', '/teachers/mike-robinson')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/teacher-detail-panel.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/teachers/TeacherDetailPanel'`

- [ ] **Step 3: Create `src/components/teachers/TeacherDetailPanel.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props {
  teacher: TeacherWithSchedule | null
  open: boolean
  onClose: () => void
}

export function TeacherDetailPanel({ teacher, open, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setVisible(false)
    closeTimerRef.current = setTimeout(onClose, 250)
  }, [onClose])

  useEffect(() => setMounted(true), [])

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    },
    []
  )

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

  if (!open || !mounted || !teacher) return null

  const sortedSchedule = [...(teacher.schedule ?? [])].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  return createPortal(
    <>
      <div
        data-testid="teacher-detail-panel-backdrop"
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-[250ms] ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${teacher.name} details`}
        className={`fixed right-0 top-0 bottom-0 z-[60] w-80 bg-[#0f1a0a] border-l border-white/[0.08] flex flex-col transition-transform duration-[250ms] ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <h2 className="text-white text-xl font-bold">{teacher.name}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="flex items-center gap-4">
            <TeacherAvatar
              name={teacher.name}
              photo={teacher.photo}
              lqip={teacher.lqip ?? null}
              size="xl"
              shape="circle"
              sizes="80px"
            />
            {teacher.title && (
              <p className="text-white/70 text-sm">{teacher.title}</p>
            )}
          </div>

          {sortedSchedule.length > 0 && (
            <div>
              <h3 className="text-[10px] uppercase font-bold tracking-[0.1em] text-white/35 mb-3">
                This Week
              </h3>
              <ul className="space-y-2">
                {sortedSchedule.map((day) => (
                  <li key={day.day} className="flex gap-3">
                    <span className="text-white text-sm font-medium w-24 shrink-0">{day.day}</span>
                    <span className="text-white/55 text-sm">
                      {day.times.map((t) => `${t.startTime} – ${t.endTime}`).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href={`/teachers/${teacher.slug}`}
            onClick={handleClose}
            className="flex items-center justify-center w-full bg-[#1d2228] hover:bg-[#262d34] text-white rounded-xl py-4 text-sm font-semibold transition-colors cursor-pointer"
            aria-label={`View full profile for ${teacher.name}`}
          >
            View full profile →
          </Link>
        </div>
      </div>
    </>,
    document.body
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/teacher-detail-panel.test.tsx
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/teachers/TeacherDetailPanel.tsx tests/unit/teacher-detail-panel.test.tsx
git commit -m "feat(schedule): add TeacherDetailPanel right-side overlay for desktop"
```

---

## Task 4: `ScheduleWeekCards` component

**Files:**
- Create: `src/components/teachers/ScheduleWeekCards.tsx`

No separate unit test file — `ScheduleWeekCards` is a thin orchestrator over `buildDaySlots` (already tested) and `ScheduleCardList` (already tested). Integration is covered by the manual verify step.

- [ ] **Step 1: Create `src/components/teachers/ScheduleWeekCards.tsx`**

```tsx
'use client'

import { useMemo } from 'react'
import { buildDaySlots } from '@/lib/teachers/schedule'
import { ScheduleCardList } from './ScheduleCardList'
import type { TeacherWithSchedule } from '@/lib/sanity/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const DAY_LABELS: Record<string, string> = {
  Sunday: 'SUN', Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED',
  Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT',
}

interface Props {
  scheduleTeachers: TeacherWithSchedule[]
  /** Minutes since midnight in Phoenix TZ. -1 disables "on air now". */
  currentTime: number
  /** Full day name for today, e.g. "Monday". */
  today: string
  onSelect: (teacher: TeacherWithSchedule) => void
}

export function ScheduleWeekCards({ scheduleTeachers, currentTime, today, onSelect }: Props) {
  const slotsByDay = useMemo(
    () => Object.fromEntries(DAYS.map((day) => [day, buildDaySlots(scheduleTeachers, day)])),
    [scheduleTeachers]
  )

  return (
    <div className="grid grid-cols-7 gap-2">
      {DAYS.map((day) => {
        const isToday = day === today
        return (
          <div key={day} className="min-w-0">
            <div
              className={`text-center text-[11px] font-bold pb-2 mb-2 border-b ${
                isToday
                  ? 'text-[#84b84f] border-[rgba(132,184,79,0.25)]'
                  : 'text-white/40 border-white/[0.06]'
              }`}
            >
              {DAY_LABELS[day]}
              {isToday && <span className="ml-1 text-[8px]">●</span>}
            </div>
            <ScheduleCardList
              slots={slotsByDay[day] ?? []}
              currentTime={isToday ? currentTime : -1}
              onSelect={onSelect}
              compact
            />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Confirm TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/ScheduleWeekCards.tsx
git commit -m "feat(schedule): add ScheduleWeekCards 7-column desktop grid"
```

---

## Task 5: Wire up `ScheduleTabView`, update skeleton, delete old files

**Files:**
- Modify: `src/components/teachers/ScheduleTabView.tsx`
- Modify: `src/components/skeletons/ScheduleTabSkeleton.tsx`
- Delete: `src/components/teachers/ScheduleTimeAxis.tsx`
- Delete: `src/components/teachers/ScheduleWeekView.tsx`
- Delete: `tests/unit/schedule-time-axis.test.tsx`

- [ ] **Step 1: Replace `src/components/teachers/ScheduleTabView.tsx`**

Full replacement — do not preserve any of the old content:

```tsx
'use client'

import { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { TeacherDetailSheet } from './TeacherDetailSheet'
import { TeacherDetailPanel } from './TeacherDetailPanel'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { buildDaySlots } from '@/lib/teachers/schedule'
import { ScheduleCardList } from './ScheduleCardList'
import { ScheduleWeekCards } from './ScheduleWeekCards'
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

  const [selectedDay, setSelectedDay] = useState(today)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithSchedule | null>(null)

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
          onSelect={setSelectedTeacher}
        />

        {/* < md: bottom sheet */}
        <div className="md:hidden">
          <TeacherDetailSheet
            teacher={selectedTeacher}
            open={selectedTeacher !== null}
            onClose={() => setSelectedTeacher(null)}
          />
        </div>

        {/* md–lg: right overlay panel */}
        <div className="hidden md:block">
          <TeacherDetailPanel
            teacher={selectedTeacher}
            open={selectedTeacher !== null}
            onClose={() => setSelectedTeacher(null)}
          />
        </div>
      </div>

      {/* Wide desktop (≥ lg): 7-col week grid */}
      <div className="hidden lg:block">
        <ScheduleWeekCards
          scheduleTeachers={scheduleTeachers}
          currentTime={currentTime}
          today={today}
          onSelect={setSelectedTeacher}
        />
        <TeacherDetailPanel
          teacher={selectedTeacher}
          open={selectedTeacher !== null}
          onClose={() => setSelectedTeacher(null)}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Update `src/components/skeletons/ScheduleTabSkeleton.tsx`**

Replace file content with card-style skeletons:

```tsx
function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse rounded ${className}`} />
}

export function ScheduleTabSkeleton() {
  return (
    <div>
      {/* Most on air banner */}
      <Sk className="h-[44px] rounded-[12px] mb-3" />

      {/* Day pills */}
      <div className="flex gap-[5px] pb-[10px] mb-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <Sk key={i} className="h-[30px] w-[40px] rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Show cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 mb-2" style={{ opacity: 1 - i * 0.15 }}>
          <Sk className="h-[38px] w-[38px] rounded-full flex-shrink-0" />
          <div className="flex-1">
            <Sk className="h-[14px] w-2/3 mb-1.5 rounded" />
            <Sk className="h-[11px] w-1/3 rounded" />
          </div>
          <Sk className="h-[26px] w-[36px] rounded-md flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Delete old files**

```bash
rm src/components/teachers/ScheduleTimeAxis.tsx
rm src/components/teachers/ScheduleWeekView.tsx
rm tests/unit/schedule-time-axis.test.tsx
```

- [ ] **Step 4: Confirm no broken imports**

```bash
npx tsc --noEmit
```

Expected: No errors. If any file still imports `ScheduleTimeAxis` or `ScheduleWeekView`, fix those imports now.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass. The deleted `schedule-time-axis.test.tsx` is gone so those tests no longer run.

- [ ] **Step 6: Commit**

```bash
git add src/components/teachers/ScheduleTabView.tsx \
        src/components/skeletons/ScheduleTabSkeleton.tsx
git rm src/components/teachers/ScheduleTimeAxis.tsx \
       src/components/teachers/ScheduleWeekView.tsx \
       tests/unit/schedule-time-axis.test.tsx
git commit -m "feat(schedule): wire ScheduleTabView to card layout, delete pixel timeline components"
```

---

## Task 6: Manual verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Visit teachers schedule tab**

Open `http://localhost:3000/teachers` and click the Schedule tab.

- [ ] **Step 3: Verify mobile layout (< 768px)**

Resize browser to 375px wide. Confirm:
- Day tabs scroll horizontally
- Show cards display full teacher name, readable time, duration chip
- Music gap rows appear between non-consecutive shows
- Today's tab is highlighted green
- Tapping a card opens the bottom sheet
- Bottom sheet shows teacher name, title, schedule, profile link

- [ ] **Step 4: Verify narrow desktop layout (768–1023px)**

Resize to 900px wide. Confirm:
- Same day tabs + card list layout as mobile
- Clicking a card opens the right-side panel overlay (NOT bottom sheet)
- Panel slides in from right, backdrop darkens left side
- Clicking backdrop or × closes the panel

- [ ] **Step 5: Verify wide desktop layout (≥ 1024px)**

Resize to 1280px wide. Confirm:
- All 7 day columns visible
- Today's column has green header + dot
- Cards in each column show teacher name (truncated if needed) and time
- Music gaps appear as subtle rows
- Clicking a card opens the right-side panel overlay
- "No shows scheduled" appears in empty columns

- [ ] **Step 6: Verify "on air now" highlight**

On a day that has a currently-active show (check the schedule data), confirm:
- The active show card has green border + green time text
- Inactive shows have normal styling
- If today has no active show, no cards are highlighted (green)

- [ ] **Step 7: Final commit if any tweaks were needed**

```bash
git add -p
git commit -m "fix(schedule): adjust card layout after manual verification"
```
