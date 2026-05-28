# Teachers Search + Typography Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix sub-12px typography in RecommendedTeachers and ScheduleTabView, and redesign TeacherSearchClient to use a single-column layout with URL-driven filter state, calvarytucson-style input, chip touch targets, and card-style results.

**Architecture:** All work is in the worktree at `.worktrees/feat-teachers-mobile-redesign/`. Typography fixes are isolated one-liners. TeacherSearchClient is a full rewrite: `useSearchParams` + `router.replace` + `useTransition` replaces local state, removing the sidebar layout in favour of a stacked single-column pattern matching `calvarytucson-nextjs/SearchPageClient`. No API changes, no route structure changes.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS, Lucide React, `useSearchParams`, `useTransition`, `useRouter`, `usePathname`

---

## Task 1: Typography fixes — RecommendedTeachers + ScheduleTabView

**Files:**
- Modify: `src/components/teachers/RecommendedTeachers.tsx`
- Modify: `src/components/teachers/ScheduleTabView.tsx`

All paths are relative to `.worktrees/feat-teachers-mobile-redesign/`.

- [ ] **Step 1: Fix RecommendedTeachers teacher name font size**

In `src/components/teachers/RecommendedTeachers.tsx`, find the `<span>` that renders the teacher name (line ~43). Change:

```tsx
// Before
<span className="text-[8px] md:text-xs text-white/55 text-center leading-tight line-clamp-2">

// After
<span className="text-xs md:text-[13px] text-white/55 text-center leading-tight line-clamp-2">
```

- [ ] **Step 2: Fix ScheduleTabView "Most on air" text size**

In `src/components/teachers/ScheduleTabView.tsx`, find the `<span>` with `text-[10px]` (line ~57). Change:

```tsx
// Before
<span className="text-[10px] text-white/55">

// After
<span className="text-xs text-white/55">
```

- [ ] **Step 3: Fix ScheduleTabView day picker button text size**

In the same file, find the day picker `<button>` with `text-[11px]` (line ~74). Change:

```tsx
// Before
className={`flex-shrink-0 px-4 py-[5px] rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${

// After
className={`flex-shrink-0 px-4 py-[5px] rounded-full text-xs font-semibold transition-colors cursor-pointer ${
```

- [ ] **Step 4: Type-check**

Run from the worktree root:
```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs/.worktrees/feat-teachers-mobile-redesign
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/teachers/RecommendedTeachers.tsx src/components/teachers/ScheduleTabView.tsx
git commit -m "fix(teachers): bump sub-12px font sizes in RecommendedTeachers and ScheduleTabView"
```

---

## Task 2: TeacherSearchClient — full rewrite

**Files:**
- Modify: `src/components/teachers/TeacherSearchClient.tsx`

This replaces the entire file. The existing logic lives in the same location — read the current file before writing.

The key changes:
- Props: drop `initialQuery` (URL state reads from `useSearchParams` directly)
- State: `useSearchParams` + `router.replace` + `useTransition` + `usePathname` instead of isolated `useState`
- Layout: single-column `space-y-4`, no `md:flex` sidebar
- Input: `bg-white/5 border-white/10`, Lucide `Search` icon left, `Loader2` spinner when `isPending`
- Filter chips: "Day" + "Sort" section labels, `min-h-[44px]` touch targets, `text-xs`
- Results: card style (`rounded-xl border border-white/10 bg-white/5 p-3`), skeleton when `isPending`

- [ ] **Step 1: Replace TeacherSearchClient.tsx**

Write the following complete file to `src/components/teachers/TeacherSearchClient.tsx`:

```tsx
'use client'

import { useState, useMemo, useEffect, useRef, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X, Loader2, ChevronRight } from 'lucide-react'
import { filterTeachers } from '@/lib/teachers/filter'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherInfoChip } from '@/components/teachers/primitives/TeacherInfoChip'
import type { SortOption } from '@/lib/teachers/filter'
import type { TeacherSummary, TeacherWithSchedule, ScheduleDay } from '@/lib/sanity/types'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_LABELS: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'A–Z' },
  { value: 'name-desc', label: 'Z–A' },
  { value: 'most-on-air', label: 'Most on air' },
]
const VALID_SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.value))

interface TeacherSearchClientProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
}

export function TeacherSearchClient({
  teachers,
  scheduleTeachers,
}: TeacherSearchClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const urlQ = searchParams.get('q') ?? ''
  const urlDays = searchParams.get('days')?.split(',').filter(Boolean) ?? []
  const urlSort = searchParams.get('sort') ?? ''

  const [displayValue, setDisplayValue] = useState(urlQ)
  const [query, setQuery] = useState(urlQ)
  const [activeDays, setActiveDays] = useState<string[]>(urlDays)
  const [sort, setSort] = useState<SortOption | undefined>(
    VALID_SORTS.has(urlSort) ? (urlSort as SortOption) : undefined
  )

  useEffect(() => {
    inputRef.current?.focus()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

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
    () => filterTeachers(teachers, query, { sort, days: activeDays, scheduleMap, hoursMap }),
    [teachers, query, sort, activeDays, scheduleMap, hoursMap]
  )

  const hasFilter = displayValue.trim().length > 0 || !!sort || activeDays.length > 0

  function pushURL(nextQ: string, nextDays: string[], nextSort: SortOption | undefined) {
    const params = new URLSearchParams()
    if (nextQ.trim()) params.set('q', nextQ.trim())
    if (nextDays.length) params.set('days', nextDays.join(','))
    if (nextSort) params.set('sort', nextSort)
    const search = params.toString()
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    })
  }

  function handleQueryChange(value: string) {
    setDisplayValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setQuery(value)
      pushURL(value, activeDays, sort)
    }, 300)
  }

  function clearQuery() {
    setDisplayValue('')
    setQuery('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    pushURL('', activeDays, sort)
  }

  function toggleDay(day: string) {
    const next = activeDays.includes(day)
      ? activeDays.filter((d) => d !== day)
      : [...activeDays, day]
    setActiveDays(next)
    pushURL(displayValue, next, sort)
  }

  function setAndPushSort(next: SortOption | undefined) {
    setSort(next)
    pushURL(displayValue, activeDays, next)
  }

  function clearAll() {
    setDisplayValue('')
    setQuery('')
    setSort(undefined)
    setActiveDays([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    startTransition(() => {
      router.replace(pathname, { scroll: false })
    })
  }

  const chipBase =
    'min-h-[44px] flex items-center shrink-0 rounded-full px-3 text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
  const chipActive =
    'bg-[rgba(132,184,79,0.15)] border-[rgba(132,184,79,0.3)] text-[#84b84f]'
  const chipInactive =
    'bg-white/5 border-white/10 text-white/60 can-hover:hover:border-white/20 can-hover:hover:text-white/80'
  const sectionLabel =
    'text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-1.5'

  return (
    <div className="max-w-screen-xl mx-auto space-y-4">

      {/* Search input */}
      <div className="flex items-center gap-[10px]">
        <Link
          href="/teachers"
          className="text-[#84b84f] text-xl leading-none cursor-pointer flex-shrink-0"
          aria-label="Back to teachers"
        >
          ‹
        </Link>
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search teachers..."
            value={displayValue}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') clearQuery()
            }}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label="Search teachers"
          />
          {displayValue && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {isPending ? (
                <Loader2
                  className="h-4 w-4 text-white/40 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    clearQuery()
                    inputRef.current?.focus()
                  }}
                  className="flex h-8 w-8 items-center justify-center text-white/40 hover:text-white cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Day filter */}
      <div>
        <p className={sectionLabel}>Day</p>
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
      </div>

      {/* Sort filter */}
      <div>
        <p className={sectionLabel}>Sort</p>
        <div className="flex items-center flex-wrap gap-2">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={sort === option.value}
              onClick={() =>
                setAndPushSort(sort === option.value ? undefined : option.value)
              }
              className={`${chipBase} ${sort === option.value ? chipActive : chipInactive}`}
            >
              {option.label}
            </button>
          ))}
          {hasFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto text-xs text-white/45 can-hover:hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div>
        <p
          className="text-sm text-white/60 mb-3"
          aria-live="polite"
          aria-atomic="true"
        >
          {results.length} {results.length === 1 ? 'teacher' : 'teachers'} found
        </p>

        {isPending ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[68px] rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : results.length > 0 ? (
          <ul className="space-y-2">
            {results.map((teacher) => {
              const hrs = hoursMap.get(teacher.slug)
              const hoursPerWeek = hrs ? Math.round(hrs / 60) : 0
              return (
                <li key={teacher.slug}>
                  <Link
                    href={`/teachers/${teacher.slug}`}
                    className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3 transition-colors cursor-pointer can-hover:hover:bg-white/10 can-hover:hover:border-white/20"
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
                      <p className="text-sm font-semibold text-white truncate">
                        {teacher.name}
                      </p>
                      {teacher.title && (
                        <p className="text-xs text-white/60 truncate">{teacher.title}</p>
                      )}
                    </div>
                    {hoursPerWeek > 0 && (
                      <TeacherInfoChip label={`${hoursPerWeek}h`} variant="accent" />
                    )}
                    <ChevronRight
                      className="h-4 w-4 text-white/18 shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-white/45 text-center py-12">
            No teachers found. Try a different search.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs/.worktrees/feat-teachers-mobile-redesign
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/TeacherSearchClient.tsx
git commit -m "feat(teachers): redesign TeacherSearchClient — single-column layout, URL state, cards"
```

---

## Task 3: Drop initialQuery prop from page files

**Files:**
- Modify: `src/app/teachers/search/page.tsx`
- Modify: `src/app/@modal/(...)teachers/search/page.tsx`

The new `TeacherSearchClient` reads query from `useSearchParams` directly. Both page files previously passed `initialQuery={q}` — remove that prop and the `q` variable extraction.

- [ ] **Step 1: Update `src/app/teachers/search/page.tsx`**

Replace the existing `TeachersSearchPage` function body:

```tsx
// Before
export default async function TeachersSearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams

  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <TeacherSearchClient
      teachers={teachers}
      scheduleTeachers={scheduleTeachers}
      initialQuery={q}
    />
  )
}
```

```tsx
// After
export default async function TeachersSearchPage() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <TeacherSearchClient
      teachers={teachers}
      scheduleTeachers={scheduleTeachers}
    />
  )
}
```

Also remove the unused `Props` interface and `searchParams` import if present.

- [ ] **Step 2: Update `src/app/@modal/(...)teachers/search/page.tsx`**

Replace the existing `TeachersSearchSheetPage` function body:

```tsx
// Before
export default async function TeachersSearchSheetPage({ searchParams }: Props) {
  const { q = '' } = await searchParams

  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <SheetChrome title="Search Teachers" padded={false}>
      <div className="px-4 pt-4 pb-16">
        <TeacherSearchClient
          teachers={teachers}
          scheduleTeachers={scheduleTeachers}
          initialQuery={q}
        />
      </div>
    </SheetChrome>
  )
}
```

```tsx
// After
export default async function TeachersSearchSheetPage() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <SheetChrome title="Search Teachers" padded={false}>
      <div className="px-4 pt-4 pb-16">
        <TeacherSearchClient
          teachers={teachers}
          scheduleTeachers={scheduleTeachers}
        />
      </div>
    </SheetChrome>
  )
}
```

Also remove the unused `Props` interface.

- [ ] **Step 3: Type-check**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs/.worktrees/feat-teachers-mobile-redesign
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/teachers/search/page.tsx "src/app/@modal/(...)teachers/search/page.tsx"
git commit -m "refactor(teachers): drop initialQuery prop — TeacherSearchClient reads URL directly"
```

---

## Task 4: Build verification

- [ ] **Step 1: Run full build**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs/.worktrees/feat-teachers-mobile-redesign
npm run build
```
Expected: build completes with no errors. Warnings about non-critical items (e.g. image optimisation) are acceptable. Any TypeScript or module-not-found error is a blocker.

- [ ] **Step 2: Start dev server and manual verify**

```bash
npm run dev
```

Open browser and verify:

| URL | Check |
|---|---|
| `http://localhost:3000/teachers` | RecommendedTeachers names readable (≥12px). ScheduleTabView day buttons and "Most on air" text readable (≥12px). |
| `http://localhost:3000/teachers/search` | Single-column layout. Input has search icon. Day chips scrollable. Sort chips visible. Result cards have border + bg. |
| `http://localhost:3000/teachers/search?q=John&days=Monday,Wednesday&sort=most-on-air` | Filters pre-filled from URL. Back arrow navigates to `/teachers`. |
| Mobile (375px DevTools) | Chip row scrolls horizontally. Cards readable. No text below 12px visible. |
| Desktop (1280px) | Single column centered, max-w-screen-xl. No sidebar. |

- [ ] **Step 3: Verify sheet modal**

Navigate to `/teachers`, tap/click the search icon (whatever triggers the sheet). Verify `SheetChrome` renders with `TeacherSearchClient` — filters and results display correctly inside the sheet.

- [ ] **Step 4: Test "Clear all" and URL sync**

1. Type a query → URL updates to include `?q=...`
2. Select a day chip → URL updates to include `days=...`
3. Select a sort → URL updates to include `sort=...`
4. Press "Clear all" → URL returns to bare `/teachers/search`
5. Reload at step 3's URL → filters re-hydrate correctly from URL params

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| `RecommendedTeachers` name `text-[8px]` → `text-xs md:text-[13px]` | Task 1 Step 1 |
| `ScheduleTabView` "Most on air" `text-[10px]` → `text-xs` | Task 1 Step 2 |
| `ScheduleTabView` day buttons `text-[11px]` → `text-xs` | Task 1 Step 3 |
| URL state: `q`, `days`, `sort` in URL | Task 2 |
| Single-column layout, drop `md:flex` sidebar | Task 2 |
| Input: `bg-white/5`, search icon, spinner when `isPending` | Task 2 |
| Day chips: `min-h-[44px]`, section label, horizontal scroll | Task 2 |
| Sort chips: `min-h-[44px]`, section label | Task 2 |
| Result cards: `rounded-xl border border-white/10 bg-white/5` | Task 2 |
| Name `text-sm`, title `text-xs`, count `text-sm` | Task 2 |
| Skeleton on `isPending` | Task 2 |
| Drop `initialQuery` prop, update page files | Task 3 |
| Build + manual test matrix | Task 4 |
