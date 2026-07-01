# Search Teachers Sheet — UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Search Teachers bottom sheet: full-height on mobile, compact sort-inline-with-search-bar filter layout, and reliable autofocus via MutationObserver.

**Architecture:** Three independent tasks touching `SheetChrome`, `TeacherSearchClient`, and a new `TeacherSortControl` component. Sort logic is extracted from `TeacherSearchClient` into a standalone client component so it can be co-located with the search bar at the page level. `SheetChrome` replaces its fixed-delay autofocus timer with a `MutationObserver` that fires as soon as an input enters the DOM.

**Tech Stack:** Next.js, React 19, Tailwind CSS, Vitest + React Testing Library

## Global Constraints

- All interactive elements: `cursor-pointer`, `min-h-[44px]` touch target, `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`
- Tailwind design tokens only — no raw hex except established brand values (`oklch(24%_0.05_280)`, `rgba(132,184,79,…)`)
- Conventional commit format with scope from AGENTS.md
- Run `npm run build` and `npm test` before committing each task

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/modals/chrome/SheetChrome.tsx` | Modify | Height 100dvh, MutationObserver autofocus |
| `src/lib/teachers/filter.ts` | Modify | Export `SORT_OPTIONS` and `VALID_SORTS` as shared constants |
| `src/components/teachers/TeacherSortControl.tsx` | Create | Cycling sort toggle + "Clear all" button |
| `src/components/teachers/TeacherSearchClient.tsx` | Modify | Remove sort section; keep day chips + results; no section labels |
| `src/app/@modal/(...)teachers/search/page.tsx` | Modify | Flex row: search + sort; day chips + results below |
| `src/app/teachers/search/page.tsx` | Modify | Same flex row layout as modal page |
| `tests/unit/sheet-chrome.test.tsx` | Modify | Add sheet-chrome-dialog class test + autofocus test |
| `tests/unit/teacher-search-client.test.tsx` | Modify | Remove old sort-button tests; update for day-only UI |
| `tests/unit/teacher-sort-control.test.tsx` | Create | Sort toggle cycling and clear-all behavior |

---

## Task 1: SheetChrome — Height

**Note on safe-top:** `viewport-fit=cover` is set in `layout.tsx`, meaning `100dvh` extends behind the notch on both mobile web and native WebView. The existing `paddingTop: 'var(--safe-top)'` inline style is correct everywhere — do NOT remove it.

**Files:**
- Modify: `src/components/modals/chrome/SheetChrome.tsx`

**Interfaces:**
- Produces: `SheetChrome` dialog height is `100dvh` on mobile

- [ ] **Step 1: Update mobile height in SheetChrome**

In `src/components/modals/chrome/SheetChrome.tsx`, locate the `className={cn(...)}` on the inner dialog div (currently around line 60–65). Apply two changes:
1. Remove `max-h-[90dvh]` from the mobile class string (the `sm:max-h-[90dvh]` in the desktop string stays)
2. Change `h-[85dvh]` → `h-[100dvh]`

```tsx
className={cn(
  'w-full overflow-hidden flex flex-col border border-white/10 light:border-gray-200 bg-gray-800 light:bg-white p-0',
  'rounded-t-2xl rounded-b-none h-[100dvh] will-change-transform',
  isClosing ? MODAL_EXIT_ANIMATION : MODAL_ENTER_ANIMATION,
  'sm:inset-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:w-[95vw] sm:rounded-2xl',
  className
)}
```

- [ ] **Step 2: Type-check + build**

```bash
npm run build
```

Expected: No type errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/chrome/SheetChrome.tsx
git commit -m "fix(modal): full-height sheet on mobile

h-[85dvh] → h-[100dvh] so sheet reaches top; remove max-h-[90dvh]
from mobile classes (sm: constraint preserved)"
```

---

## Task 2: SheetChrome — Autofocus via MutationObserver

**Files:**
- Modify: `src/components/modals/chrome/SheetChrome.tsx`
- Modify: `tests/unit/sheet-chrome.test.tsx`

**Interfaces:**
- Consumes: `autoFocusInput` prop (existing), `contentRef` (existing)
- Produces: When `autoFocusInput` is true, the first `input` or `textarea` that appears inside `contentRef` receives `.focus()` — even if it arrives after initial render (e.g., inside a `Suspense` boundary)

- [ ] **Step 1: Write the failing autofocus tests**

Add to `tests/unit/sheet-chrome.test.tsx`. Two tests are required — one for the synchronous path (input already in DOM at mount), one for the MutationObserver path (input appears after mount, simulating Suspense delay). Both must pass to prove the fix works.

```tsx
import { useState, useEffect } from 'react'
import { waitFor } from '@testing-library/react'

// Wrapper with autoFocusInput and a synchronous input
function WrapperWithInput({ onDismiss = vi.fn() } = {}) {
  return (
    <ModalProvider onDismiss={onDismiss} onBack={vi.fn()} isClosing={false} stackDepth={0}>
      <SheetChrome title="Test Sheet" autoFocusInput>
        <input type="text" aria-label="Test input" />
      </SheetChrome>
    </ModalProvider>
  )
}

// Wrapper where input appears 50ms after mount (simulates Suspense resolving)
function WrapperWithDelayedInput({ onDismiss = vi.fn() } = {}) {
  function DelayedInput() {
    const [show, setShow] = useState(false)
    useEffect(() => {
      const id = setTimeout(() => setShow(true), 50)
      return () => clearTimeout(id)
    }, [])
    return show ? <input type="text" aria-label="Delayed input" /> : null
  }
  return (
    <ModalProvider onDismiss={onDismiss} onBack={vi.fn()} isClosing={false} stackDepth={0}>
      <SheetChrome title="Test Sheet" autoFocusInput>
        <DelayedInput />
      </SheetChrome>
    </ModalProvider>
  )
}

it('focuses first input when autoFocusInput is true (synchronous)', async () => {
  const { container } = render(<WrapperWithInput />)
  const input = container.querySelector('input')
  await waitFor(() => {
    expect(document.activeElement).toBe(input)
  })
})

it('focuses input that appears after mount (MutationObserver path)', async () => {
  const { container } = render(<WrapperWithDelayedInput />)
  await waitFor(
    () => expect(document.activeElement).toBe(container.querySelector('input')),
    { timeout: 500 }
  )
})
```

Run: `npm test -- sheet-chrome`
Expected: Both new tests FAIL (the current `setTimeout(250ms)` approach will not catch the delayed-input case).

- [ ] **Step 2: Replace fixed-delay focus with MutationObserver**

In `src/components/modals/chrome/SheetChrome.tsx`, find the `useEffect` that handles `autoFocusInput` (currently uses `setTimeout` with 250ms delay). Replace it entirely:

```tsx
useEffect(() => {
  if (!autoFocusInput) return

  let observer: MutationObserver | null = null
  let fallbackTimer: ReturnType<typeof setTimeout>

  function tryFocus() {
    const input = contentRef.current?.querySelector<HTMLElement>('input, textarea')
    if (input) {
      observer?.disconnect()
      clearTimeout(fallbackTimer)
      input.focus()
    }
  }

  // Input may already be in the DOM (e.g., no Suspense delay)
  const immediate = contentRef.current?.querySelector<HTMLElement>('input, textarea')
  if (immediate) {
    immediate.focus()
  } else {
    // Watch for input to be inserted by a Suspense boundary resolving
    observer = new MutationObserver(tryFocus)
    if (contentRef.current) {
      observer.observe(contentRef.current, { childList: true, subtree: true })
    }
    // Fallback: focus dialog container if no input appears within 2s
    fallbackTimer = setTimeout(() => {
      observer?.disconnect()
      contentRef.current?.focus()
    }, 2000)
  }

  return () => {
    observer?.disconnect()
    clearTimeout(fallbackTimer)
  }
}, [autoFocusInput])
```

Remove the old `setTimeout(250ms)` focus `useEffect` entirely.

- [ ] **Step 3: Run tests**

```bash
npm test -- sheet-chrome
```

Expected: All tests pass including the new autofocus test.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/chrome/SheetChrome.tsx tests/unit/sheet-chrome.test.tsx
git commit -m "fix(modal): autofocus input via MutationObserver instead of fixed delay

Fixed timer fires before Suspense resolves, focusing the dialog
container (white ring) instead of the search input. MutationObserver
waits for the input to appear in the DOM then focuses it immediately."
```

---

## Task 3: Filter Layout — Compact Sort Toggle + 2-Row Design

**Files:**
- Modify: `src/lib/teachers/filter.ts`
- Create: `src/components/teachers/TeacherSortControl.tsx`
- Modify: `src/components/teachers/TeacherSearchClient.tsx`
- Modify: `src/app/@modal/(...)teachers/search/page.tsx`
- Modify: `src/app/teachers/search/page.tsx`
- Modify: `tests/unit/teacher-search-client.test.tsx`
- Create: `tests/unit/teacher-sort-control.test.tsx`

**Interfaces:**
- `filter.ts` exports: `SORT_OPTIONS: { value: SortOption; label: string }[]`, `VALID_SORTS: Set<string>`
- `TeacherSortControl`: no props, reads URL params, renders sort toggle or "Clear all"
- `TeacherSearchClient`: same props as before; now renders day chips + results only (no sort section, no section labels)

- [ ] **Step 1: Export shared constants from filter.ts**

In `src/lib/teachers/filter.ts`, add these exports directly after the `SortOption` type definition:

```ts
export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'A–Z' },
  { value: 'name-desc', label: 'Z–A' },
  { value: 'most-on-air', label: 'Most on air' },
]

export const VALID_SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.value))
```

- [ ] **Step 2: Write failing tests for TeacherSortControl**

Create `tests/unit/teacher-sort-control.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherSortControl } from '@/components/teachers/TeacherSortControl'

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/teachers/search',
}))

describe('TeacherSortControl', () => {
  it('renders Sort button when no filters active', () => {
    render(<TeacherSortControl />)
    expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument()
  })

  it('clicking Sort calls router.replace with sort=name-asc', async () => {
    const user = userEvent.setup()
    render(<TeacherSortControl />)
    await user.click(screen.getByRole('button', { name: /sort/i }))
    expect(mockReplace).toHaveBeenCalledWith('/teachers/search?sort=name-asc')
  })
})
```

Run: `npm test -- teacher-sort-control`
Expected: FAIL (file does not exist yet).

- [ ] **Step 3: Create TeacherSortControl**

Create `src/components/teachers/TeacherSortControl.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'
import { SORT_OPTIONS, VALID_SORTS } from '@/lib/teachers/filter'
import type { SortOption } from '@/lib/teachers/filter'

export function TeacherSortControl() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const urlSort = searchParams.get('sort') ?? ''
  const urlQ = searchParams.get('q') ?? ''
  const urlDays = searchParams.get('days')?.split(',').filter(Boolean) ?? []
  const sort: SortOption | undefined = VALID_SORTS.has(urlSort) ? (urlSort as SortOption) : undefined

  const hasFilter = urlQ.trim().length > 0 || !!sort || urlDays.length > 0

  function clearAll() {
    startTransition(() => router.replace(pathname))
  }

  function cycleSort() {
    const params = new URLSearchParams(searchParams.toString())
    if (!sort) {
      params.set('sort', 'name-asc')
    } else {
      const idx = SORT_OPTIONS.findIndex((o) => o.value === sort)
      const next = SORT_OPTIONS[idx + 1]
      if (next) {
        params.set('sort', next.value)
      } else {
        params.delete('sort')
      }
    }
    const search = params.toString()
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname))
  }

  const sortLabel = sort ? (SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort') : 'Sort'

  const baseClass =
    'shrink-0 flex items-center min-h-[44px] px-3 text-xs font-medium rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors'

  if (hasFilter) {
    return (
      <button
        type="button"
        onClick={clearAll}
        className={`${baseClass} text-white/70 light:text-gray-400 can-hover:hover:text-white light:can-hover:hover:text-gray-900`}
        aria-label="Clear all filters"
      >
        Clear all
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={cycleSort}
      className={`${baseClass} gap-1.5 bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 text-white/70 light:text-gray-500 can-hover:hover:border-white/20 can-hover:hover:text-white/80 light:can-hover:hover:border-gray-300`}
      aria-label={sort ? `Sort: ${sortLabel}. Press to change.` : 'Sort'}
    >
      {!sort && <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />}
      {sortLabel}
    </button>
  )
}
```

- [ ] **Step 4: Run TeacherSortControl tests**

```bash
npm test -- teacher-sort-control
```

Expected: Both tests pass.

- [ ] **Step 5: Update TeacherSearchClient — remove sort section, update imports, simplify toggleDay**

Replace the full contents of `src/components/teachers/TeacherSearchClient.tsx`:

```tsx
'use client'

import { useMemo, useTransition } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { filterTeachers, VALID_SORTS } from '@/lib/teachers/filter'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherModalLink } from '@/components/teachers/TeacherModalLink'
import type { SortOption } from '@/lib/teachers/filter'
import type { TeacherSummary, TeacherWithSchedule, ScheduleDay } from '@/lib/sanity/types'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_LABELS: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}

interface TeacherSearchClientProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
}

export function TeacherSearchClient({
  teachers,
  scheduleTeachers,
}: TeacherSearchClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const urlQ = searchParams.get('q') ?? ''
  const urlDays = searchParams.get('days')?.split(',').filter(Boolean) ?? []
  const urlSort = searchParams.get('sort') ?? ''
  const activeDays = urlDays
  const sort: SortOption | undefined = VALID_SORTS.has(urlSort) ? (urlSort as SortOption) : undefined

  const scheduleMap = useMemo(
    () => new Map<string, ScheduleDay[]>(scheduleTeachers.map((t) => [t.slug, t.schedule])),
    [scheduleTeachers]
  )
  const hoursMap = useMemo(
    () =>
      new Map<string, number>(
        scheduleTeachers.map((t) => [t.slug, computeWeeklyMinutes(t.schedule)])
      ),
    [scheduleTeachers]
  )

  const results = useMemo(
    () => filterTeachers(teachers, urlQ, { sort, days: activeDays, scheduleMap, hoursMap }),
    [teachers, urlQ, sort, activeDays, scheduleMap, hoursMap]
  )

  function toggleDay(day: string) {
    const next = activeDays.includes(day)
      ? activeDays.filter((d) => d !== day)
      : [...activeDays, day]
    const params = new URLSearchParams()
    if (urlQ.trim()) params.set('q', urlQ.trim())
    if (next.length) params.set('days', next.join(','))
    if (sort) params.set('sort', sort)
    const search = params.toString()
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname))
  }

  const chipBase =
    'min-h-[44px] flex items-center shrink-0 rounded-full px-3 text-xs font-medium border motion-safe:transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
  const chipActive =
    'bg-[rgba(132,184,79,0.15)] border-[rgba(132,184,79,0.3)] text-[#84b84f]'
  const chipInactive =
    'bg-white/5 light:bg-gray-50 border-white/10 light:border-gray-200 text-white/60 light:text-gray-500 can-hover:hover:border-white/20 can-hover:hover:text-white/80 light:can-hover:hover:border-gray-300'

  return (
    <div className="max-w-screen-xl mx-auto space-y-3">

      {/* Day filter — full-width scrollable row, no label */}
      <div className="relative">
        <div
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filter by day"
        >
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={activeDays.includes(day)}
              onClick={() => toggleDay(day)}
              className={`${chipBase} ${activeDays.includes(day) ? chipActive : chipInactive}`}
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[oklch(24%_0.05_280)] to-transparent md:hidden" />
      </div>

      {/* Results */}
      <div>
        <p
          className="text-sm text-white/60 light:text-gray-500 mb-3"
          aria-live="polite"
          aria-atomic="true"
        >
          {isPending ? 'Loading…' : `${results.length} ${results.length === 1 ? 'teacher' : 'teachers'} found`}
        </p>

        {isPending ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[68px] rounded-xl bg-white/5 light:bg-gray-50 motion-safe:animate-pulse" />
            ))}
          </div>
        ) : results.length > 0 ? (
          <ul className="space-y-2">
            {results.map((teacher) => (
              <li key={teacher.slug}>
                <TeacherModalLink
                  slug={teacher.slug}
                  name={teacher.name}
                  className="w-full rounded-xl border border-white/10 light:border-gray-200 bg-white/5 light:bg-gray-50 p-3 flex items-center gap-3 text-left motion-safe:transition-colors cursor-pointer can-hover:hover:bg-white/10 light:can-hover:hover:bg-gray-100 can-hover:hover:border-white/20 light:can-hover:hover:border-gray-300"
                >
                  <TeacherAvatar
                    name={teacher.name}
                    photo={teacher.photo}
                    lqip={teacher.lqip}
                    size="sm"
                    shape="rounded"
                    sizes="38px"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white light:text-gray-900 truncate">
                      {teacher.name}
                    </p>
                    {teacher.title && (
                      <p className="text-xs text-white/60 light:text-gray-500 truncate">{teacher.title}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/18 shrink-0" aria-hidden="true" />
                </TeacherModalLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/70 light:text-gray-400 py-12">
            No teachers found. Try a different search.
          </p>
        )}
      </div>
    </div>
  )
}
```

(`SORT_OPTIONS` is not needed in `TeacherSearchClient` since sort management moved to `TeacherSortControl`. Only `VALID_SORTS` is imported for deriving the active sort from URL params.)

- [ ] **Step 6: Update teacher-search-client tests**

In `tests/unit/teacher-search-client.test.tsx`, remove the tests that reference individual sort buttons, and update to reflect the new day-only chip UI:

Remove these tests entirely (sort is now `TeacherSortControl`'s concern):
- `'renders sort options'`
- `'sorts teachers A–Z when A–Z selected'`

Keep and verify these tests still pass without modification:
- `'renders search input'`
- `'shows all teachers initially'`
- `'filters teachers by name as user types'`
- `'shows empty state when no results'`
- `'renders day filter chips'`
- `'shows results count'`
- `'clear search button removes query'`

Run: `npm test -- teacher-search-client`
Expected: All remaining tests pass.

- [ ] **Step 7: Update modal search page**

Replace `src/app/@modal/(...)teachers/search/page.tsx`:

```tsx
import { Suspense } from 'react'
import { fetchAllTeacherData } from '@/lib/sanity/teachers'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { TeacherSearchBar } from '@/components/teachers/TeacherSearchBar'
import { TeacherSortControl } from '@/components/teachers/TeacherSortControl'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'

async function ModalSearchContent() {
  const { teachers, scheduleTeachers } = await fetchAllTeacherData()
  return (
    <div className="px-4 pb-16">
      <TeacherSearchClient
        teachers={teachers}
        scheduleTeachers={scheduleTeachers}
      />
    </div>
  )
}

export default function TeachersSearchSheetPage() {
  return (
    <SheetChrome title="Search Teachers" padded={false} autoFocusInput>
      {/* Row 1: search input + sort/clear */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className="flex-1">
          <Suspense fallback={null}>
            <TeacherSearchBar />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <TeacherSortControl />
        </Suspense>
      </div>
      {/* Row 2+: day chips + results */}
      <Suspense fallback={<SearchResultsSkeleton />}>
        <ModalSearchContent />
      </Suspense>
    </SheetChrome>
  )
}
```

- [ ] **Step 8: Update non-modal search page**

Replace `src/app/teachers/search/page.tsx`:

```tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { fetchAllTeacherData } from '@/lib/sanity/teachers'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { TeacherSearchBar } from '@/components/teachers/TeacherSearchBar'
import { TeacherSortControl } from '@/components/teachers/TeacherSortControl'
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'

export const metadata: Metadata = {
  title: 'Search Teachers',
  robots: { index: false },
}

async function SearchContent() {
  const { teachers, scheduleTeachers } = await fetchAllTeacherData()
  return <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
}

export default function TeachersSearchPage() {
  return (
    <div className="px-4 py-6 sm:px-6 space-y-4">
      {/* Row 1: search + sort */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Suspense fallback={null}>
            <TeacherSearchBar />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <TeacherSortControl />
        </Suspense>
      </div>
      {/* Day chips + results */}
      <Suspense fallback={<SearchResultsSkeleton />}>
        <SearchContent />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 9: Run all tests**

```bash
npm test
```

Expected: All tests pass. Check `teacher-sort-control` and `teacher-search-client` specifically.

- [ ] **Step 10: Build**

```bash
npm run build
```

Expected: Clean build, no type errors.

- [ ] **Step 11: Commit**

```bash
git add \
  src/lib/teachers/filter.ts \
  src/components/teachers/TeacherSortControl.tsx \
  src/components/teachers/TeacherSearchClient.tsx \
  src/app/@modal/\(...\)teachers/search/page.tsx \
  src/app/teachers/search/page.tsx \
  tests/unit/teacher-search-client.test.tsx \
  tests/unit/teacher-sort-control.test.tsx
git commit -m "feat(teachers): compact filter layout — sort inline with search bar

- Extract TeacherSortControl: cycling sort toggle (Sort→A–Z→Z–A→Most
  on air→none) + Clear all when any filter active
- Export SORT_OPTIONS and VALID_SORTS from filter.ts as shared constants
- Remove sort section and section labels from TeacherSearchClient;
  day chips row is full-width with right fade scrim
- Both modal and non-modal search pages: search + sort in one flex row,
  day chips + results below"
```
