# UI/UX Polish, A11y, and Mobile App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the app for iOS/Android native webview, overhaul the Teachers page with live in-memory search, fix a11y issues, and add consistent animation polish across the app.

**Architecture:** Global CSS gains safe-area tokens, animation keyframes, and webview-specific resets. The Teachers page moves from a two-route search (form submit → `/teachers/search`) to a single-page client component (`TeachersClientView`) that filters an SSR-fetched array in memory using `useDebounce`. A pure `filterTeachers` function is extracted for testability.

**Tech Stack:** Next.js 15 App Router (RSC + Client Components), Tailwind CSS v4, Vitest + Testing Library, Playwright, Zustand (media-store), React `useDebounce` hook (already exists)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/globals.css` | Modify | Safe-area vars, webview resets, animation keyframes, MediaBar transition CSS |
| `src/app/layout.tsx` | Modify | `viewport` export with `viewportFit: 'cover'`; `data-app` on body; safe-bottom on main in app mode |
| `src/components/icons/ArrowLeftIcon.tsx` | **Create** | Reusable Material Symbols back-arrow SVG |
| `src/components/teachers/TeacherCard.tsx` | Modify | a11y aria-label fix, remove neon glow, faster hover, stagger animation class |
| `src/components/skeletons/TeacherCardSkeleton.tsx` | Modify | Match new card border style |
| `src/components/media-bar/MediaBar.tsx` | Modify | CSS-driven slide-up animation, `data-media-bar` + `data-hidden` attrs |
| `src/components/home/TodaySchedule.tsx` | Modify | Stagger animation on schedule rows |
| `src/lib/teachers/filter.ts` | **Create** | Pure `filterTeachers(teachers, query)` function |
| `src/components/teachers/TeachersClientView.tsx` | **Create** | Client component: live filter, SearchInput, count, URL sync |
| `src/components/teachers/SearchBar.tsx` | **Delete** | Replaced by SearchInput inside TeachersClientView |
| `src/app/teachers/page.tsx` | Modify | Fetch all teachers at page level, pass to TeachersClientView, accept searchParams |
| `src/app/teachers/search/page.tsx` | Modify | Redirect to `/teachers` (preserve `?q=`) |
| `next.config.ts` | Modify | Add `/teachers/search` → `/teachers` redirect |
| `src/app/teachers/[slug]/page.tsx` | Modify | Use ArrowLeftIcon for back link |
| `src/app/about/page.tsx` | Modify | Add `page-enter` class to root div |
| `src/app/donate/page.tsx` | Modify | Add `page-enter` class to root div |
| `tests/unit/teacher-card.test.tsx` | Modify | Update aria-label assertion to include title |
| `tests/unit/filter-teachers.test.ts` | **Create** | Unit tests for filterTeachers |
| `tests/unit/arrow-left-icon.test.tsx` | **Create** | Renders without errors |
| `tests/e2e/teachers.spec.ts` | Modify | Update for live search behavior (no URL nav on search) |

---

## Task 1: Foundation CSS — Globals, Webview Resets, Animation Keyframes

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add safe-area CSS custom properties, webview resets, and animation keyframes to globals.css**

Add the following block after the `@theme` section and before the `:root` block (or merge into `:root` if you prefer — just keep it after the `@theme` block):

```css
/* === Webview / Mobile Shell === */

:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}

body {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

main {
  overscroll-behavior-y: contain;
}

button, a, [role="button"], input, label {
  touch-action: manipulation;
}

/* === MediaBar slide-up animation === */

[data-media-bar] {
  transition: transform 250ms ease-out, opacity 200ms ease-out;
}

[data-media-bar][data-hidden] {
  transform: translateY(100%);
  opacity: 0;
  pointer-events: none;
}

/* App mode: MediaBar sits at safe-bottom (no MobileNav) */
body[data-app] [data-media-bar] {
  bottom: var(--safe-bottom, 0px);
  padding-bottom: var(--safe-bottom, 0px);
}

/* === Card stagger entrance animation === */

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.teacher-card {
  animation: card-enter 240ms ease-out backwards;
  animation-delay: calc(var(--stagger-i, 0) * 35ms);
}

/* === Schedule row stagger entrance animation === */

@keyframes schedule-row-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.schedule-row {
  animation: schedule-row-enter 220ms ease-out backwards;
  animation-delay: calc(var(--stagger-i, 0) * 25ms);
}

/* === Page content entrance (about, donate) === */

@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-enter {
  animation: page-enter 280ms ease-out 50ms backwards;
}
```

The existing reduced-motion block at the bottom of `globals.css` already zeroes out `animation-duration` and `animation-delay` for `prefers-reduced-motion: reduce`, so all these animations are automatically guarded.

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs
npm run build 2>&1 | tail -20
```

Expected: build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: safe-area tokens, webview resets, animation keyframes"
```

---

## Task 2: Layout — Viewport Fit + App Shell Data Attribute

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Export Viewport config and add app-mode data attributes**

Open `src/app/layout.tsx`. Make these three changes:

**1a. Add `Viewport` to imports:**
```tsx
import type { Metadata, Viewport } from 'next'
```

**1b. Add `viewport` export after the `metadata` export:**
```tsx
export const viewport: Viewport = {
  viewportFit: 'cover',
}
```

**1c. Update `RootLayout` — add `data-app` on body, add safe-bottom padding on main in app mode:**

Replace the `<html>` / `<body>` / `<main>` block (lines 53–65 approx):
```tsx
return (
  <html lang="en">
    <body
      className="bg-[var(--color-brand-purple)] text-white min-h-screen"
      data-app={isMobileApp ? 'true' : undefined}
    >
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded">
        Skip to main content
      </a>
      <BridgeInit />
      {!isMobileApp && <AudioProvider streamUrl={streamUrl} />}
      {!isMobileApp && <SleepTimerProvider />}
      {!isMobileApp && <Header />}
      {!isMobileApp && <MobileHeader />}
      <main
        id="main-content"
        className={!isMobileApp ? 'pt-16 pb-36' : ''}
        style={isMobileApp ? { paddingBottom: 'var(--safe-bottom)' } : undefined}
      >
        {children}
      </main>
      {!isMobileApp && <Footer />}
      {!isMobileApp && <MobileNav />}
      <MediaBar />
    </body>
  </html>
)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(layout): viewport-fit cover, data-app for app shell, safe-bottom on main"
```

---

## Task 3: ArrowLeftIcon — New Icon Component

**Files:**
- Create: `src/components/icons/ArrowLeftIcon.tsx`
- Create: `tests/unit/arrow-left-icon.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/arrow-left-icon.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ArrowLeftIcon } from '@/components/icons/ArrowLeftIcon'

describe('ArrowLeftIcon', () => {
  it('renders an svg element', () => {
    const { container } = render(<ArrowLeftIcon />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('svg is aria-hidden by default', () => {
    const { container } = render(<ArrowLeftIcon />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('accepts a className prop', () => {
    const { container } = render(<ArrowLeftIcon className="w-4 h-4" />)
    expect(container.querySelector('svg')).toHaveClass('w-4', 'h-4')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/arrow-left-icon.test.tsx 2>&1 | tail -15
```

Expected: FAIL — "Cannot find module '@/components/icons/ArrowLeftIcon'"

- [ ] **Step 3: Create the icon component**

Create `src/components/icons/ArrowLeftIcon.tsx`:
```tsx
interface ArrowLeftIconProps {
  className?: string
}

export function ArrowLeftIcon({ className }: ArrowLeftIconProps) {
  return (
    <svg
      viewBox="0 -960 960 960"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M400-80 0-480l400-400 71 71-329 329 329 329-71 71Z" />
    </svg>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/arrow-left-icon.test.tsx 2>&1 | tail -10
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/icons/ArrowLeftIcon.tsx tests/unit/arrow-left-icon.test.tsx
git commit -m "feat(icons): add ArrowLeftIcon component"
```

---

## Task 4: TeacherCard — A11y Fix + Visual Redesign (TDD)

**Files:**
- Modify: `src/components/teachers/TeacherCard.tsx`
- Modify: `tests/unit/teacher-card.test.tsx`

The existing test asserts `aria-label="John MacArthur"` — this will break when we update to include the title. Update the test first.

- [ ] **Step 1: Update the failing test**

Open `tests/unit/teacher-card.test.tsx`. The test data at the top is:
```ts
const teacher: TeacherSummary = {
  name: 'John MacArthur',
  slug: 'john-macarthur',
  title: 'Grace to You',
  photo: 'https://cdn.sanity.io/images/test/production/photo.jpg',
}
```

Replace the existing `'renders image with decorative alt and link aria-label when photo exists'` test (around line 41):
```tsx
it('renders link with aria-label containing name and title', () => {
  render(<TeacherCard teacher={teacher} />)
  expect(screen.getByRole('link', { name: 'John MacArthur — Grace to You' })).toBeInTheDocument()
})
```

Also add a test for the stagger index prop at the end of the describe block:
```tsx
it('accepts optional index prop without error', () => {
  expect(() => render(<TeacherCard teacher={teacher} index={3} />)).not.toThrow()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/teacher-card.test.tsx 2>&1 | tail -20
```

Expected: at least 1 FAIL — the aria-label test fails because the current component uses only the name.

- [ ] **Step 3: Update TeacherCard implementation**

Replace the full contents of `src/components/teachers/TeacherCard.tsx`:
```tsx
import { ViewTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { TeacherSummary } from '@/lib/sanity/types'

interface TeacherCardProps {
  teacher: TeacherSummary
  index?: number
}

function TeacherInitials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : parts[0]?.[0] ?? '?'
  return (
    <div className="w-full aspect-square bg-gradient-to-br from-green-900/60 to-gray-700/60 flex items-center justify-center">
      <span className="text-white/80 text-3xl font-bold uppercase">{initials}</span>
    </div>
  )
}

export function TeacherCard({ teacher, index = 0 }: TeacherCardProps) {
  return (
    <Link
      href={`/teachers/${teacher.slug}`}
      aria-label={`${teacher.name} — ${teacher.title}`}
      transitionTypes={['nav-forward']}
      className="teacher-card block rounded overflow-hidden border border-white/10 hover:border-white/25 motion-safe:hover:scale-[1.03] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={{ '--stagger-i': index } as React.CSSProperties}
    >
      {teacher.photo ? (
        <ViewTransition name={`teacher-${teacher.slug}`}>
          <div className="relative aspect-square">
            <Image
              src={teacher.photo}
              alt=""
              fill
              className="object-cover"
              placeholder={teacher.lqip ? 'blur' : 'empty'}
              blurDataURL={teacher.lqip}
              sizes="(max-width: 640px) 50vw, 25vw"
            />
          </div>
        </ViewTransition>
      ) : (
        <TeacherInitials name={teacher.name} />
      )}
      <div className="px-3 pt-3 pb-4">
        <p className="text-white font-semibold text-sm" aria-hidden="true">{teacher.name}</p>
        <p className="text-white/60 text-xs mt-1.5" aria-hidden="true">{teacher.title}</p>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/teacher-card.test.tsx 2>&1 | tail -15
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/teachers/TeacherCard.tsx tests/unit/teacher-card.test.tsx
git commit -m "fix(a11y): TeacherCard aria-label includes title; remove neon glow, stagger animation"
```

---

## Task 5: TeacherCardSkeleton — Match New Card Style

**Files:**
- Modify: `src/components/skeletons/TeacherCardSkeleton.tsx`

- [ ] **Step 1: Update skeleton to match new card border**

Replace the full contents of `src/components/skeletons/TeacherCardSkeleton.tsx`:
```tsx
export function TeacherCardSkeleton() {
  return (
    <div className="bg-gray-700/50 rounded overflow-hidden border border-white/5 animate-pulse">
      <div className="w-full aspect-square bg-gray-700" />
      <div className="px-3 pt-3 pb-4">
        <div className="h-4 w-3/4 bg-gray-700 rounded mb-2" />
        <div className="h-3 w-1/2 bg-gray-700 rounded" />
      </div>
    </div>
  )
}

export function TeacherGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <TeacherCardSkeleton key={i} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skeletons/TeacherCardSkeleton.tsx
git commit -m "style(skeleton): match new TeacherCard border and spacing"
```

---

## Task 6: MediaBar — Slide-Up Animation + App Mode Fix

**Files:**
- Modify: `src/components/media-bar/MediaBar.tsx`

The CSS added in Task 1 handles the animation (`[data-media-bar]` and `[data-media-bar][data-hidden]`) and the app-mode fix (`body[data-app] [data-media-bar]`). This task adds the data attributes to the DOM element and removes the early return.

- [ ] **Step 1: Update MediaBar component**

Replace the full contents of `src/components/media-bar/MediaBar.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'
import { PlayPauseButton } from './PlayPauseButton'
import { NowPlayingInfo } from './NowPlayingInfo'
import { postMessageToNative } from '@/lib/bridge/post-message'

export function MediaBar() {
  const showMediaBar = useMediaStore((s) => s.showMediaBar)
  const isPlaying = useMediaStore((s) => s.isPlaying)
  const title = useMediaStore((s) => s.title)
  const artist = useMediaStore((s) => s.artist)
  const image = useMediaStore((s) => s.image)

  useEffect(() => {
    postMessageToNative(JSON.stringify({ isPlaying, title, artist, image }))
  }, [isPlaying, title, artist, image])

  return (
    <div
      role="region"
      aria-label="Media player"
      aria-hidden={!showMediaBar}
      data-media-bar=""
      data-hidden={!showMediaBar ? '' : undefined}
      className="fixed bottom-[72px] md:bottom-0 left-0 right-0 bg-[var(--color-brand-gray)] border-t border-white/10 px-4 py-2 flex items-center gap-3 z-50"
    >
      <NowPlayingInfo />
      <PlayPauseButton />
    </div>
  )
}
```

Key changes from original:
- Removed `if (!showMediaBar) return null` — element stays in DOM for animation
- Added `aria-hidden={!showMediaBar}` — screen readers ignore it when hidden
- Added `data-media-bar=""` — CSS target for transition and app-mode bottom
- Added `data-hidden={!showMediaBar ? '' : undefined}` — CSS target for hidden state

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/media-bar/MediaBar.tsx
git commit -m "feat(media-bar): slide-up entrance animation, data-media-bar attrs for CSS targeting"
```

---

## Task 7: TodaySchedule — Row Stagger Animation

**Files:**
- Modify: `src/components/home/TodaySchedule.tsx`

- [ ] **Step 1: Add stagger class and index to schedule rows**

In `TodaySchedule.tsx`, the `withBreaks.map((item, idx) => ...)` loop renders either a `<div>` or a `<Link>`. Both need the `schedule-row` class and `--stagger-i` style prop.

Find the two rendered elements inside the map and add to each:

For the music `<div>` (around line 157):
```tsx
<div
  key={`music-${item.startTime}-${item.endTime}`}
  className="schedule-row flex gap-5 bg-gray-700 p-2 rounded"
  style={{ '--stagger-i': idx } as React.CSSProperties}
>
```

For the teacher `<Link>` (around line 167):
```tsx
<Link
  key={`${item.slug}-${item.startTime}`}
  href={`/teachers/${item.slug}`}
  className="schedule-row flex items-center justify-between flex-wrap bg-gray-700 p-2 rounded hover:bg-gray-700/80 transition-colors"
  style={{ '--stagger-i': idx } as React.CSSProperties}
>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/TodaySchedule.tsx
git commit -m "style(schedule): stagger entrance animation on schedule rows"
```

---

## Task 8: filterTeachers — Pure Function + Tests (TDD)

**Files:**
- Create: `src/lib/teachers/filter.ts`
- Create: `tests/unit/filter-teachers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/filter-teachers.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { filterTeachers } from '@/lib/teachers/filter'
import type { TeacherSummary } from '@/lib/sanity/types'

const teachers: TeacherSummary[] = [
  { name: 'Jack Hibbs', slug: 'jack-hibbs', title: 'Real Life Radio', photo: null },
  { name: 'Jack Graham', slug: 'jack-graham', title: 'Powerpoint', photo: null },
  { name: 'Alistair Begg', slug: 'alistair-begg', title: 'Truth For Life', photo: null },
  { name: 'John MacArthur', slug: 'john-macarthur', title: 'Grace to You', photo: null },
]

describe('filterTeachers', () => {
  it('returns all teachers when query is empty string', () => {
    expect(filterTeachers(teachers, '')).toHaveLength(4)
  })

  it('returns all teachers when query is whitespace only', () => {
    expect(filterTeachers(teachers, '   ')).toHaveLength(4)
  })

  it('filters by name, case-insensitive', () => {
    const result = filterTeachers(teachers, 'jack')
    expect(result).toHaveLength(2)
    expect(result.map((t) => t.slug)).toEqual(['jack-hibbs', 'jack-graham'])
  })

  it('filters by title, case-insensitive', () => {
    const result = filterTeachers(teachers, 'truth')
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('alistair-begg')
  })

  it('filters by partial match in title', () => {
    const result = filterTeachers(teachers, 'grace')
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('john-macarthur')
  })

  it('returns empty array when no match', () => {
    expect(filterTeachers(teachers, 'xyz999')).toHaveLength(0)
  })

  it('handles teachers with empty title', () => {
    const noTitle: TeacherSummary[] = [
      { name: 'Test Teacher', slug: 'test', title: '', photo: null },
    ]
    const result = filterTeachers(noTitle, 'test')
    expect(result).toHaveLength(1)
  })

  it('does not mutate the input array', () => {
    const copy = [...teachers]
    filterTeachers(teachers, 'jack')
    expect(teachers).toEqual(copy)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/filter-teachers.test.ts 2>&1 | tail -15
```

Expected: FAIL — "Cannot find module '@/lib/teachers/filter'"

- [ ] **Step 3: Create the filter function**

Create `src/lib/teachers/filter.ts`:
```ts
import type { TeacherSummary } from '@/lib/sanity/types'

export function filterTeachers(teachers: TeacherSummary[], query: string): TeacherSummary[] {
  const q = query.trim().toLowerCase()
  if (!q) return teachers
  return teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q)
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/filter-teachers.test.ts 2>&1 | tail -15
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/teachers/filter.ts tests/unit/filter-teachers.test.ts
git commit -m "feat(teachers): pure filterTeachers function with full test coverage"
```

---

## Task 9: TeachersClientView — Live Search Client Component

**Files:**
- Create: `src/components/teachers/TeachersClientView.tsx`

The `SearchInput` component at `src/components/global/SearchInput.tsx` already exists and accepts `value`, `onChange`, `onClear`, `placeholder`, `aria-label`, `className`. The `useDebounce` hook is at `src/hooks/useDebounce.ts`.

- [ ] **Step 1: Create TeachersClientView**

Create `src/components/teachers/TeachersClientView.tsx`:
```tsx
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import { SearchInput } from '@/components/global/SearchInput'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { filterTeachers } from '@/lib/teachers/filter'
import type { TeacherSummary } from '@/lib/sanity/types'

interface TeachersClientViewProps {
  teachers: TeacherSummary[]
  initialQuery?: string
}

export function TeachersClientView({ teachers, initialQuery = '' }: TeachersClientViewProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const debouncedQuery = useDebounce(query, 200)

  const filtered = useMemo(
    () => filterTeachers(teachers, debouncedQuery),
    [teachers, debouncedQuery]
  )

  function handleChange(value: string) {
    setQuery(value)
    const trimmed = value.trim()
    router.replace(
      trimmed ? `/teachers?q=${encodeURIComponent(trimmed)}` : '/teachers',
      { scroll: false }
    )
  }

  const isFiltered = debouncedQuery.trim().length > 0
  const countLabel = isFiltered
    ? `${filtered.length} of ${teachers.length} shown`
    : `${teachers.length} teachers`

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-white text-2xl font-bold">Teachers</h1>
        <span
          className="text-white/50 text-sm"
          aria-live="polite"
          aria-atomic="true"
        >
          {countLabel}
        </span>
      </div>

      <SearchInput
        value={query}
        onChange={handleChange}
        onClear={() => handleChange('')}
        placeholder="Search teachers..."
        aria-label="Search teachers"
        className="mb-6"
      />

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((teacher, index) => (
            <TeacherCard key={teacher.slug} teacher={teacher} index={index} />
          ))}
        </div>
      ) : isFiltered ? (
        <p className="text-white/60 mt-4">
          No teachers found for &ldquo;{debouncedQuery}&rdquo;.
        </p>
      ) : null}
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/TeachersClientView.tsx
git commit -m "feat(teachers): TeachersClientView with live in-memory search"
```

---

## Task 10: Wire Teachers Page + Redirect /teachers/search

**Files:**
- Modify: `src/app/teachers/page.tsx`
- Modify: `src/app/teachers/search/page.tsx`
- Modify: `next.config.ts`
- Delete: `src/components/teachers/SearchBar.tsx`

- [ ] **Step 1: Update teachers/page.tsx**

Replace the full contents of `src/app/teachers/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery } from '@/lib/sanity/queries'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeachersClientView } from '@/components/teachers/TeachersClientView'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Teachers',
  description: 'Listen to many great bible teachers on Reach Radio Tucson.',
  alternates: { canonical: '/teachers' },
}

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function TeachersPage({ searchParams }: Props) {
  const { q = '' } = await searchParams

  const teachers = await sanityFetch<TeacherSummary[]>(
    teacherListQuery,
    {},
    { tags: ['teachers'] }
  )

  return (
    <div className="px-4 py-6">
      <ShowMediaBar />
      <TeachersClientView teachers={teachers} initialQuery={q} />
    </div>
  )
}
```

- [ ] **Step 2: Update teachers/search/page.tsx to redirect**

Replace the full contents of `src/app/teachers/search/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function TeacherSearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams
  const trimmed = q.trim().slice(0, 100)
  redirect(trimmed ? `/teachers?q=${encodeURIComponent(trimmed)}` : '/teachers')
}
```

- [ ] **Step 3: Add redirect to next.config.ts**

Open `next.config.ts`. The `redirects` async function already has one entry for `/speakers/:slug*`. Add the `/teachers/search` entry:

```ts
async redirects() {
  return [
    { source: '/speakers/:slug*', destination: '/teachers/:slug*', permanent: true },
    { source: '/teachers/search', destination: '/teachers', permanent: false },
  ]
},
```

Note: Query strings are preserved automatically by Next.js redirects, so `/teachers/search?q=jack` will redirect to `/teachers?q=jack`.

- [ ] **Step 4: Delete SearchBar.tsx**

```bash
rm /Users/danielmccauley/Documents/Development/reach-radio-nextjs/src/components/teachers/SearchBar.tsx
```

- [ ] **Step 5: Verify TypeScript compiles and build passes**

```bash
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -20
```

Expected: no errors on either command.

- [ ] **Step 6: Run unit tests**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/teachers/page.tsx src/app/teachers/search/page.tsx next.config.ts
git rm src/components/teachers/SearchBar.tsx
git commit -m "feat(teachers): live search wired, SearchBar deleted, /teachers/search redirects"
```

---

## Task 11: Update E2E Tests for New Search Behavior

**Files:**
- Modify: `tests/e2e/teachers.spec.ts`

The current `'search returns results'` test navigates to `/teachers/search?q=John` — this no longer applies. The teacher detail back-link test asserts `hasText: '← Teachers'` — after Task 12 this text changes.

- [ ] **Step 1: Update teachers.spec.ts**

Replace the full contents of `tests/e2e/teachers.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test.describe('Teachers', () => {
  test('teachers page loads with grid', async ({ page }) => {
    await page.goto('/teachers')
    await expect(page.locator('h1', { hasText: 'Teachers' })).toBeVisible()
    await page.waitForSelector('a[href^="/teachers/"]', { timeout: 10000 })
    const cards = page.locator('a[href^="/teachers/"]')
    await expect(cards.first()).toBeVisible()
  })

  test('live search filters teachers without page navigation', async ({ page }) => {
    await page.goto('/teachers')
    await page.waitForSelector('a[href^="/teachers/"]', { timeout: 10000 })

    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeVisible()

    await searchInput.fill('Jack')
    // Wait for debounce (200ms) + buffer
    await page.waitForTimeout(400)

    // URL updates without navigation
    await expect(page).toHaveURL(/\/teachers\?q=Jack/)

    // Count label updates
    const countLabel = page.locator('[aria-live="polite"]')
    await expect(countLabel).toContainText('of')

    // Clearing search restores all teachers
    await searchInput.fill('')
    await page.waitForTimeout(400)
    await expect(page).toHaveURL('/teachers')
  })

  test('/teachers/search redirects to /teachers preserving query', async ({ page }) => {
    await page.goto('/teachers/search?q=john')
    await expect(page).toHaveURL(/\/teachers\?q=john/)
  })

  test('teacher detail page loads', async ({ page }) => {
    await page.goto('/teachers')
    await page.waitForSelector('a[href^="/teachers/"]', { timeout: 10000 })
    const firstCard = page.locator('a[href^="/teachers/"]').first()
    await firstCard.click()
    await expect(page.locator('h1')).toBeVisible()
    // Back link navigates to /teachers
    await expect(page.locator('a[href="/teachers"]').first()).toBeVisible()
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/teachers.spec.ts
git commit -m "test(e2e): update teachers spec for live search behavior"
```

---

## Task 12: Back Nav Icon — ArrowLeftIcon in Teacher Pages

**Files:**
- Modify: `src/app/teachers/[slug]/page.tsx`

The `/teachers/search` page is now a redirect (Task 10) so it doesn't need a back link update.

- [ ] **Step 1: Update teacher detail back link**

Open `src/app/teachers/[slug]/page.tsx`.

Add the import after the existing imports:
```tsx
import { ArrowLeftIcon } from '@/components/icons/ArrowLeftIcon'
```

Replace the back-link block (around line 69–75):
```tsx
<div className="px-4 py-4">
  <Link
    href="/teachers"
    transitionTypes={['nav-back']}
    className="text-white/60 text-sm hover:text-white inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded"
  >
    <ArrowLeftIcon className="w-4 h-4" />
    Teachers
  </Link>
</div>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/teachers/[slug]/page.tsx
git commit -m "feat(teachers): replace unicode arrow with ArrowLeftIcon in back navigation"
```

---

## Task 13: Page Entrance Animations — About + Donate

**Files:**
- Modify: `src/app/about/page.tsx`
- Modify: `src/app/donate/page.tsx`

- [ ] **Step 1: Add page-enter class to About page**

In `src/app/about/page.tsx`, find the outermost returned `<div>`:
```tsx
<div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
```

Add `page-enter` to its className:
```tsx
<div className="page-enter px-4 py-6 max-w-2xl mx-auto space-y-6">
```

- [ ] **Step 2: Add page-enter class to Donate page**

In `src/app/donate/page.tsx`, find the root returned div (line 62):
```tsx
<div className="px-4 py-6">
```

Change to:
```tsx
<div className="page-enter px-4 py-6">
```

- [ ] **Step 3: Commit**

```bash
git add src/app/about/page.tsx src/app/donate/page.tsx
git commit -m "style: page-enter fade-up animation on about and donate pages"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Run all unit tests**

```bash
npm test 2>&1 | tail -30
```

Expected: all tests PASS, no failures.

- [ ] **Step 2: Run full build**

```bash
npm run build 2>&1 | tail -30
```

Expected: build completes with no errors or TypeScript issues.

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (no errors).

- [ ] **Step 4: Verify donate page exists and has correct div structure**

```bash
grep -n "className" /Users/danielmccauley/Documents/Development/reach-radio-nextjs/src/app/donate/page.tsx | head -5
```

Confirm `page-enter` is present on the root div.

- [ ] **Step 5: Smoke check — confirm SearchBar.tsx is deleted**

```bash
ls /Users/danielmccauley/Documents/Development/reach-radio-nextjs/src/components/teachers/
```

Expected: `SearchBar.tsx` is NOT listed. `TeacherCard.tsx` and `TeachersClientView.tsx` are listed.

- [ ] **Step 6: If any fixes needed, commit them**

```bash
git add -p
git commit -m "fix: address issues from final verification"
```

---

## Summary

| Task | Files Changed | Tests |
|---|---|---|
| 1 — Foundation CSS | globals.css | build check |
| 2 — Layout viewport/app shell | layout.tsx | tsc check |
| 3 — ArrowLeftIcon | icons/ArrowLeftIcon.tsx | 3 unit tests |
| 4 — TeacherCard a11y + visual | TeacherCard.tsx, teacher-card.test.tsx | 5 unit tests |
| 5 — Skeleton update | TeacherCardSkeleton.tsx | — |
| 6 — MediaBar animation | MediaBar.tsx | tsc check |
| 7 — Schedule stagger | TodaySchedule.tsx | tsc check |
| 8 — filterTeachers function | lib/teachers/filter.ts | 8 unit tests |
| 9 — TeachersClientView | TeachersClientView.tsx | tsc check |
| 10 — Wire page + redirect | teachers/page.tsx, search/page.tsx, next.config.ts, delete SearchBar.tsx | build + unit tests |
| 11 — Update e2e tests | teachers.spec.ts | — |
| 12 — ArrowLeftIcon in back nav | teachers/[slug]/page.tsx | tsc check |
| 13 — Page entrance animations | about/page.tsx, donate/page.tsx | — |
| 14 — Final verification | — | all tests + build |
