# Teachers Mobile Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the teachers section (list, detail, schedule tab, search) with Material 3 Dark design language — shared primitives first, then rebuild all surfaces on top.

**Architecture:** Two primitives (`TeacherAvatar`, `TeacherInfoChip`) replace three duplicate `TeacherInitials` implementations and provide consistent metadata display. Skeletons mirror each component exactly for seamless Suspense swaps. `loading.tsx` route files provide instant skeleton paint before any data fetches.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4, `next/image`, `dayjs`, Sanity CMS

**Spec:** `docs/superpowers/specs/2026-05-27-teachers-mobile-redesign.md`

---

## File Map

### New files
```
src/lib/teachers/initials.ts                              — getInitials() pure util
src/components/teachers/primitives/TeacherAvatar.tsx      — unified avatar primitive
src/components/teachers/primitives/TeacherInfoChip.tsx    — metadata chip primitive
src/components/skeletons/RecommendedTeachersSkeleton.tsx  — rec strip skeleton
src/components/skeletons/ScheduleTabSkeleton.tsx          — schedule tab skeleton
src/components/skeletons/SearchResultsSkeleton.tsx        — search page skeleton
src/app/teachers/loading.tsx                              — list page route skeleton
src/app/teachers/[slug]/loading.tsx                       — detail page route skeleton
src/app/teachers/search/loading.tsx                       — search page route skeleton
```

### Modified files
```
src/components/teachers/TeacherCard.tsx                   — M3 surface, TeacherAvatar, InfoChip
src/components/teachers/RecommendedTeachers.tsx           — horizontal avatar strip
src/components/teachers/TeachersClientView.tsx            — pass weeklyMinutes per card
src/components/teachers/ScheduleTimeAxis.tsx              — M3 blocks, TeacherAvatar xs
src/components/teachers/ScheduleTabView.tsx               — M3 day pills, most-on-air banner
src/components/teachers/TeacherDetailSheet.tsx            — TeacherAvatar in bottom sheet
src/components/skeletons/TeacherCardSkeleton.tsx          — matches new card shape
src/components/skeletons/TeacherDetailSkeleton.tsx        — matches new detail layout
src/app/teachers/[slug]/page.tsx                          — banner, overlap, chips, Also strip
src/app/teachers/search/page.tsx                          — collapsed header
src/app/teachers/page.tsx                                 — visible h1, Suspense fallback
```

---

## Task 1: `getInitials` utility + `TeacherAvatar` primitive

**Files:**
- Create: `src/lib/teachers/initials.ts`
- Create: `src/components/teachers/primitives/TeacherAvatar.tsx`

- [ ] **Step 1: Create `src/lib/teachers/initials.ts`**

```ts
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
  }
  return (parts[0]?.[0] ?? '?').toUpperCase()
}
```

- [ ] **Step 2: Verify `getInitials` in terminal**

```bash
node -e "
const { getInitials } = require('./src/lib/teachers/initials.ts')
" 2>&1 | head -3
# Can't run TS directly — verify inline:
node -e "
function getInitials(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0]?.[0] ?? '?').toUpperCase()
}
console.assert(getInitials('John MacArthur') === 'JM', 'two words')
console.assert(getInitials('Alistair') === 'A', 'one word')
console.assert(getInitials('R.C. Sproul') === 'RS', 'initials name')
console.log('all pass')
"
```

Expected output: `all pass`

- [ ] **Step 3: Create `src/components/teachers/primitives/TeacherAvatar.tsx`**

```tsx
import Image from 'next/image'
import { getInitials } from '@/lib/teachers/initials'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type AvatarShape = 'circle' | 'rounded'

interface TeacherAvatarProps {
  name: string
  photo?: string | null
  lqip?: string | null
  /** Fixed pixel dimensions. Ignored when fill=true. */
  size: AvatarSize
  /** When true: positions absolute inset-0 to fill a relative parent. */
  fill?: boolean
  shape: AvatarShape
  /** Green ring + dark separator — used on detail page banner overlap. */
  ring?: boolean
  /** next/image sizes hint. Defaults to "{px}px". */
  sizes?: string
}

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 24, sm: 38, md: 48, lg: 72, xl: 80,
}

const FONT_CLASS: Record<AvatarSize, string> = {
  xs: 'text-[8px]', sm: 'text-[11px]', md: 'text-[14px]', lg: 'text-[22px]', xl: 'text-[26px]',
}

const CIRCLE_RADIUS = 'rounded-full'
const ROUNDED_RADIUS: Record<AvatarSize, string> = {
  xs: 'rounded-[4px]', sm: 'rounded-[11px]', md: 'rounded-[12px]', lg: 'rounded-[16px]', xl: 'rounded-[18px]',
}

export function TeacherAvatar({
  name, photo, lqip, size, fill = false, shape, ring = false, sizes,
}: TeacherAvatarProps) {
  const px = SIZE_PX[size]
  const radiusClass = shape === 'circle' ? CIRCLE_RADIUS : ROUNDED_RADIUS[size]
  const fontClass = fill ? 'text-3xl' : FONT_CLASS[size]
  const imgSizes = sizes ?? `${px}px`

  const content = photo ? (
    <Image
      src={photo}
      alt={name}
      fill
      className="object-cover"
      placeholder={lqip ? 'blur' : 'empty'}
      blurDataURL={lqip ?? undefined}
      sizes={imgSizes}
    />
  ) : (
    <span className={`absolute inset-0 flex items-center justify-center ${fontClass} font-bold text-[rgba(132,184,79,0.8)]`}>
      {getInitials(name)}
    </span>
  )

  const base = `bg-gradient-to-br from-[#2d4a1a] to-[#1a2d0f] ${radiusClass} overflow-hidden`

  if (fill) {
    return (
      <div className={`absolute inset-0 ${base}`}>
        {content}
      </div>
    )
  }

  if (ring) {
    return (
      <div
        className={`relative flex-shrink-0 ${base}`}
        style={{
          width: px,
          height: px,
          boxShadow: '0 0 0 3px #111318, 0 0 0 5px rgba(132,184,79,0.35)',
        }}
      >
        {content}
      </div>
    )
  }

  return (
    <div
      className={`relative flex-shrink-0 ${base}`}
      style={{ width: px, height: px }}
    >
      {content}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/teachers/initials.ts src/components/teachers/primitives/TeacherAvatar.tsx
git commit -m "feat(teachers): add getInitials util and TeacherAvatar primitive"
```

---

## Task 2: `TeacherInfoChip` primitive

**Files:**
- Create: `src/components/teachers/primitives/TeacherInfoChip.tsx`

- [ ] **Step 1: Create `src/components/teachers/primitives/TeacherInfoChip.tsx`**

```tsx
import type { ReactNode } from 'react'

interface TeacherInfoChipProps {
  icon?: ReactNode
  label: string
  /** accent = green tint + green text. dim = white/5 bg + white/50 text. */
  variant: 'accent' | 'dim'
}

const VARIANT_CLASS = {
  accent: 'bg-[rgba(132,184,79,0.1)] border border-[rgba(132,184,79,0.2)] text-[#84b84f]',
  dim: 'bg-white/5 border border-white/10 text-white/50',
}

export function TeacherInfoChip({ icon, label, variant }: TeacherInfoChipProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${VARIANT_CLASS[variant]}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/teachers/primitives/TeacherInfoChip.tsx
git commit -m "feat(teachers): add TeacherInfoChip primitive"
```

---

## Task 3: Rewrite existing skeleton files

**Files:**
- Modify: `src/components/skeletons/TeacherCardSkeleton.tsx`
- Modify: `src/components/skeletons/TeacherDetailSkeleton.tsx`

- [ ] **Step 1: Rewrite `src/components/skeletons/TeacherCardSkeleton.tsx`**

```tsx
function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse rounded ${className}`} />
}

export function TeacherCardSkeleton() {
  return (
    <div className="bg-[#1c2128] rounded-[18px] overflow-hidden border border-white/5">
      <div className="aspect-square bg-[#252b32] animate-pulse" />
      <div className="px-[11px] pt-[9px] pb-[11px]">
        <Sk className="h-[11px] w-3/4 mb-[6px]" />
        <Sk className="h-[9px] w-1/2 mb-[6px]" />
        <Sk className="h-[16px] w-[45px] rounded-full" />
      </div>
    </div>
  )
}

export function TeacherGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[9px]">
      {Array.from({ length: 8 }).map((_, i) => (
        <TeacherCardSkeleton key={i} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `src/components/skeletons/TeacherDetailSkeleton.tsx`**

```tsx
function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse ${className}`} />
}

export function TeacherDetailSkeleton() {
  return (
    <div>
      {/* Back bar */}
      <Sk className="h-[14px] w-[60px] rounded mx-4 mt-[14px] mb-0" />

      {/* Banner */}
      <Sk className="w-full h-[88px] mt-3" />

      {/* Avatar overlap row */}
      <div className="flex items-end justify-between px-4 mt-[-36px] mb-3">
        <Sk className="w-[72px] h-[72px] rounded-full" />
        <Sk className="h-[28px] w-[80px] rounded-full" />
      </div>

      {/* Name + title */}
      <Sk className="h-[18px] w-2/3 rounded mx-4 mb-[6px]" />
      <Sk className="h-[11px] w-1/2 rounded mx-4 mb-3" />

      {/* Chips */}
      <div className="flex gap-[7px] px-4 mb-[14px]">
        <Sk className="h-[22px] w-[70px] rounded-full" />
        <Sk className="h-[22px] w-[50px] rounded-full" />
        <Sk className="h-[22px] w-[45px] rounded-full" />
      </div>

      {/* Links */}
      <div className="flex gap-[6px] px-4 mb-[14px]">
        <Sk className="h-[26px] w-[75px] rounded-full" />
        <Sk className="h-[26px] w-[55px] rounded-full" />
      </div>

      <div className="h-px bg-white/5 mx-4 mb-3" />

      {/* Schedule label */}
      <Sk className="h-[9px] w-[80px] rounded mx-4 mb-[10px]" />

      {/* Schedule blocks */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="mx-4 mb-[8px]">
          <Sk className="h-[10px] w-[55px] rounded mb-[5px]" />
          <Sk className="h-[28px] rounded-r-[8px]" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/skeletons/TeacherCardSkeleton.tsx src/components/skeletons/TeacherDetailSkeleton.tsx
git commit -m "refactor(skeletons): match TeacherCardSkeleton and TeacherDetailSkeleton to new M3 layouts"
```

---

## Task 4: New skeleton files

**Files:**
- Create: `src/components/skeletons/RecommendedTeachersSkeleton.tsx`
- Create: `src/components/skeletons/ScheduleTabSkeleton.tsx`
- Create: `src/components/skeletons/SearchResultsSkeleton.tsx`

- [ ] **Step 1: Create `src/components/skeletons/RecommendedTeachersSkeleton.tsx`**

```tsx
function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse rounded ${className}`} />
}

export function RecommendedTeachersSkeleton() {
  return (
    <section className="mb-4">
      <Sk className="h-[9px] w-[80px] mx-4 mb-[10px]" />
      <div className="flex gap-3 px-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-[5px] flex-shrink-0 w-[54px]">
            <Sk className="w-[48px] h-[48px] rounded-full" />
            <Sk className="h-[7px] w-[38px]" />
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `src/components/skeletons/ScheduleTabSkeleton.tsx`**

```tsx
function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse rounded ${className}`} />
}

export function ScheduleTabSkeleton() {
  return (
    <div>
      {/* Most on air banner */}
      <Sk className="h-[44px] rounded-[12px] mx-[14px] mt-[10px] mb-[10px]" />

      {/* Day pills */}
      <div className="flex gap-[5px] px-3 pb-[10px]">
        {Array.from({ length: 7 }).map((_, i) => (
          <Sk key={i} className="h-[30px] w-[36px] rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Axis rows */}
      <div className="px-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-2 mb-[6px]" style={{ opacity: 1 - i * 0.08 }}>
            <Sk className="h-[9px] w-[28px] mt-1 flex-shrink-0" />
            <Sk className="flex-1 h-[34px] rounded-[8px]" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/skeletons/SearchResultsSkeleton.tsx`**

```tsx
function Sk({ className }: { className: string }) {
  return <div className={`bg-[#252b32] animate-pulse rounded ${className}`} />
}

export function SearchResultsSkeleton() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-[10px] px-4 pt-[14px] pb-[10px]">
        <Sk className="h-[20px] w-[12px]" />
        <Sk className="flex-1 h-[36px] rounded-[12px]" />
      </div>

      {/* Filter chips */}
      <div className="flex gap-[5px] px-[14px] pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Sk key={i} className="h-[26px] w-[38px] rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Count */}
      <Sk className="h-[10px] w-[80px] rounded mx-[14px] mb-2" />

      {/* Result rows */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-[10px] px-[14px] py-2 border-b border-white/4">
          <Sk className="w-[38px] h-[38px] rounded-[11px] flex-shrink-0" />
          <div className="flex-1">
            <Sk className="h-[12px] w-[70%] mb-[5px]" />
            <Sk className="h-[9px] w-[50%]" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add \
  src/components/skeletons/RecommendedTeachersSkeleton.tsx \
  src/components/skeletons/ScheduleTabSkeleton.tsx \
  src/components/skeletons/SearchResultsSkeleton.tsx
git commit -m "feat(skeletons): add RecommendedTeachersSkeleton, ScheduleTabSkeleton, SearchResultsSkeleton"
```

---

## Task 5: `loading.tsx` route files

**Files:**
- Create: `src/app/teachers/loading.tsx`
- Create: `src/app/teachers/[slug]/loading.tsx`
- Create: `src/app/teachers/search/loading.tsx`

> These must be pure server components with zero async calls — any `await` delays skeleton paint.

- [ ] **Step 1: Create `src/app/teachers/loading.tsx`**

```tsx
import { RecommendedTeachersSkeleton } from '@/components/skeletons/RecommendedTeachersSkeleton'
import { TeacherGridSkeleton } from '@/components/skeletons/TeacherCardSkeleton'

function SearchBarSkeleton() {
  return <div className="h-[42px] bg-[#252b32] animate-pulse rounded-[14px] mx-4 mb-3" />
}

function TabBarSkeleton() {
  return <div className="h-[34px] bg-[#252b32]/30 animate-pulse border-b border-white/7 mb-[10px]" />
}

export default function TeachersLoading() {
  return (
    <div className="px-4 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-3">
        <div className="h-[22px] w-[90px] bg-[#252b32] animate-pulse rounded" />
        <div className="h-[11px] w-[60px] bg-[#252b32] animate-pulse rounded" />
      </div>

      <SearchBarSkeleton />
      <RecommendedTeachersSkeleton />
      <TabBarSkeleton />

      {/* All teachers label */}
      <div className="h-[9px] w-[90px] bg-[#252b32] animate-pulse rounded mb-[10px]" />

      <TeacherGridSkeleton />
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/teachers/[slug]/loading.tsx`**

```tsx
import { TeacherDetailSkeleton } from '@/components/skeletons/TeacherDetailSkeleton'

export default function TeacherDetailLoading() {
  return <TeacherDetailSkeleton />
}
```

- [ ] **Step 3: Create `src/app/teachers/search/loading.tsx`**

```tsx
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'

export default function TeachersSearchLoading() {
  return <SearchResultsSkeleton />
}
```

- [ ] **Step 4: Commit**

```bash
git add \
  src/app/teachers/loading.tsx \
  src/app/teachers/[slug]/loading.tsx \
  src/app/teachers/search/loading.tsx
git commit -m "feat(teachers): add loading.tsx route skeletons for instant paint"
```

---

## Task 6: Update `TeacherCard`

**Files:**
- Modify: `src/components/teachers/TeacherCard.tsx`

- [ ] **Step 1: Rewrite `src/components/teachers/TeacherCard.tsx`**

```tsx
import { ViewTransition } from 'react'
import Link from 'next/link'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherInfoChip } from '@/components/teachers/primitives/TeacherInfoChip'

interface TeacherCardProps {
  teacher: TeacherSummary
  index?: number
  viewTransitionDisabled?: boolean
  weeklyMinutes?: number
}

export function TeacherCard({
  teacher,
  index = 0,
  viewTransitionDisabled = false,
  weeklyMinutes,
}: TeacherCardProps) {
  const avatarEl = (
    <div className="relative aspect-square bg-gradient-to-br from-[#253520] to-[#131b0d]">
      <TeacherAvatar
        name={teacher.name}
        photo={teacher.photo}
        lqip={teacher.lqip}
        size="lg"
        fill
        shape="rounded"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      />
    </div>
  )

  const hoursPerWeek = weeklyMinutes ? Math.round(weeklyMinutes / 60) : 0

  return (
    <Link
      href={`/teachers/${teacher.slug}`}
      aria-label={teacher.title ? `${teacher.name} — ${teacher.title}` : teacher.name}
      transitionTypes={['nav-forward']}
      className="teacher-card block rounded-[18px] overflow-hidden bg-[#1c2128] border border-white/5 motion-safe:hover:scale-[1.03] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
      style={{ '--stagger-i': index } as React.CSSProperties}
    >
      {teacher.photo && !viewTransitionDisabled ? (
        <ViewTransition name={`teacher-${teacher.slug}`}>{avatarEl}</ViewTransition>
      ) : avatarEl}
      <div className="px-[11px] pt-[9px] pb-[11px]">
        <p className="text-white font-bold text-[11px] leading-snug" aria-hidden="true">
          {teacher.name}
        </p>
        {teacher.title && (
          <p className="text-white/45 text-[9px] mt-[3px]" aria-hidden="true">
            {teacher.title}
          </p>
        )}
        {hoursPerWeek > 0 && (
          <div className="mt-[5px]">
            <TeacherInfoChip label={`${hoursPerWeek} hrs/wk`} variant="accent" />
          </div>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Start dev server and verify card renders correctly**

```bash
npm run dev
```

Open http://localhost:3000/teachers — verify:
- Cards have `rounded-[18px]` corners, darker `#1c2128` surface
- Photos fill aspect-square area
- Initials show `JM`-style text in green on dark green gradient
- On-air chip appears on cards where schedule data will come (once Task 8 passes weeklyMinutes)

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/TeacherCard.tsx
git commit -m "refactor(TeacherCard): M3 surface, TeacherAvatar primitive, on-air InfoChip"
```

---

## Task 7: Update `RecommendedTeachers`

**Files:**
- Modify: `src/components/teachers/RecommendedTeachers.tsx`

- [ ] **Step 1: Rewrite `src/components/teachers/RecommendedTeachers.tsx`**

```tsx
import Link from 'next/link'
import { sanityFetch } from '@/lib/sanity/client'
import { highlightedTeachersQuery } from '@/lib/sanity/queries'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'

export async function RecommendedTeachers() {
  const raw = await sanityFetch<TeacherSummary[]>(
    highlightedTeachersQuery,
    { slugs: [...HIGHLIGHTED_TEACHER_SLUGS] },
    { tags: ['teachers'] }
  )

  const teachers = sortByHighlightedOrder(raw, HIGHLIGHTED_TEACHER_SLUGS)

  if (teachers.length === 0) return null

  return (
    <section className="mb-4" aria-label="Recommended teachers">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/35 px-0 mb-[10px]">
        Recommended
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {teachers.map((teacher, index) => (
          <Link
            key={teacher.slug}
            href={`/teachers/${teacher.slug}`}
            className="flex flex-col items-center gap-[5px] flex-shrink-0 w-[54px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
            aria-label={teacher.name}
            style={{ '--stagger-i': index } as React.CSSProperties}
          >
            <div className="teacher-card">
              <TeacherAvatar
                name={teacher.name}
                photo={teacher.photo}
                lqip={teacher.lqip}
                size="md"
                shape="circle"
                sizes="48px"
              />
            </div>
            <span className="text-[8px] text-white/55 text-center leading-tight line-clamp-2">
              {teacher.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Update `src/app/teachers/page.tsx` — add visible h1, update Suspense fallback**

```tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeachersClientView } from '@/components/teachers/TeachersClientView'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { PassiveSearchBar } from '@/components/global/PassiveSearchBar'
import { RecommendedTeachers } from '@/components/teachers/RecommendedTeachers'
import { RecommendedTeachersSkeleton } from '@/components/skeletons/RecommendedTeachersSkeleton'

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

export default async function TeachersPage() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[22px] font-extrabold text-white tracking-tight">Teachers</h1>
        <span className="text-[11px] text-white/35 font-medium">{teachers.length} teachers</span>
      </div>
      <ShowMediaBar />
      <PassiveSearchBar
        href="/teachers/search"
        placeholder="Search teachers..."
        modalTitle="Search Teachers"
        className="mb-4"
      />
      <Suspense fallback={<RecommendedTeachersSkeleton />}>
        <RecommendedTeachers />
      </Suspense>
      <TeachersClientView
        teachers={teachers}
        scheduleTeachers={scheduleTeachers}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:3000/teachers — verify:
- "Recommended" label appears as uppercase muted text
- Circular avatars show in a horizontal scrollable row
- Each has teacher name in small text below
- Grid below is unchanged (TeachersClientView not yet updated)

- [ ] **Step 4: Commit**

```bash
git add src/components/teachers/RecommendedTeachers.tsx src/app/teachers/page.tsx
git commit -m "refactor(RecommendedTeachers): horizontal avatar strip, visible page h1, Suspense fallback"
```

---

## Task 8: Update `TeachersClientView` — pass `weeklyMinutes` to cards

**Files:**
- Modify: `src/components/teachers/TeachersClientView.tsx`

- [ ] **Step 1: Rewrite `src/components/teachers/TeachersClientView.tsx`**

```tsx
'use client'

import { useState, useMemo } from 'react'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { ScheduleTabView } from '@/components/teachers/ScheduleTabView'
import { ScheduleTabSkeleton } from '@/components/skeletons/ScheduleTabSkeleton'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'

interface TeachersClientViewProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
}

type Tab = 'teachers' | 'schedule'

export function TeachersClientView({ teachers, scheduleTeachers }: TeachersClientViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('teachers')

  const weeklyMinutesMap = useMemo(
    () =>
      new Map<string, number>(
        scheduleTeachers.map((t) => [t.slug, computeWeeklyMinutes(t.schedule)])
      ),
    [scheduleTeachers]
  )

  return (
    <>
      <div role="tablist" className="flex gap-1 mb-5 border-b border-white/7">
        {(['teachers', 'schedule'] as Tab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[12px] font-semibold capitalize transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-[#84b84f] border-[#84b84f]'
                : 'text-white/35 border-transparent hover:text-white/55'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'teachers' && (
        <>
          <div className="flex items-center justify-between mb-[10px]">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/35">
              All Teachers
            </p>
            <span className="text-[10px] text-white/25">{teachers.length}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[9px]">
            {teachers.map((teacher, index) => (
              <TeacherCard
                key={teacher.slug}
                teacher={teacher}
                index={index}
                weeklyMinutes={weeklyMinutesMap.get(teacher.slug)}
              />
            ))}
          </div>
        </>
      )}

      {activeTab === 'schedule' && <ScheduleTabView scheduleTeachers={scheduleTeachers} />}
    </>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000/teachers — verify:
- Tab bar renders with `text-[12px]` smaller text, green active state
- "All Teachers" label is small uppercase muted text with count
- Cards show on-air chip where teachers have schedule data

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/TeachersClientView.tsx
git commit -m "refactor(TeachersClientView): pass weeklyMinutes per card, M3 tab bar, section header"
```

---

## Task 9: Update `ScheduleTimeAxis`

**Files:**
- Modify: `src/components/teachers/ScheduleTimeAxis.tsx`

- [ ] **Step 1: Update time axis block styles in `src/components/teachers/ScheduleTimeAxis.tsx`**

Replace the `<button>` block inside the `columns.map()` (lines 130–149 in current file) with:

```tsx
return (
  <button
    key={`${slot.teacher.slug}-${slot.startMinutes}`}
    type="button"
    onClick={() => onSelect(slot.teacher)}
    className="absolute flex items-center gap-1.5 bg-[rgba(132,184,79,0.12)] border-l-[3px] border-[#84b84f] hover:bg-[rgba(132,184,79,0.2)] active:bg-[rgba(132,184,79,0.2)] rounded-[8px] px-1.5 overflow-hidden transition-colors cursor-pointer"
    style={{ top: topPx, height: heightPx, left: `${leftPct}%`, width: `${widthPct}%` }}
  >
    <TeacherAvatar
      name={slot.teacher.name}
      photo={slot.teacher.photo}
      lqip={slot.teacher.lqip ?? null}
      size="xs"
      shape="circle"
      sizes="24px"
    />
    <span className="text-white/80 text-xs font-medium truncate leading-tight">
      {slot.teacher.name}
    </span>
  </button>
)
```

Also update the music gap block (the `data-testid="music-gap"` div):
```tsx
<div
  key={i}
  data-testid="music-gap"
  className="absolute inset-x-0 bg-white/3 rounded-[6px] flex items-center px-2"
  style={{
    top: (gap.startMin - AXIS_START) * PX_PER_MIN,
    height: Math.max(MIN_HEIGHT_PX, (gap.endMin - gap.startMin) * PX_PER_MIN),
  }}
>
  <span className="text-white/25 text-xs italic">♪ Music</span>
</div>
```

Add the import at the top of the file:
```tsx
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000/teachers → Schedule tab → select any day with shows — verify:
- Time blocks are green-tinted with left green border
- Each block shows small circular avatar + teacher name
- Music gaps show italic ♪ Music label
- Clicking a block still opens the bottom sheet

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/ScheduleTimeAxis.tsx
git commit -m "refactor(ScheduleTimeAxis): M3 green-accent blocks, TeacherAvatar xs, music gap polish"
```

---

## Task 10: Update `ScheduleTabView`

**Files:**
- Modify: `src/components/teachers/ScheduleTabView.tsx`

- [ ] **Step 1: Rewrite `src/components/teachers/ScheduleTabView.tsx`**

```tsx
'use client'

import { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { ScheduleTimeAxis } from './ScheduleTimeAxis'
import { TeacherDetailSheet } from './TeacherDetailSheet'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
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
      if (!best || mins > best.minutes || (mins === best.minutes && t.name < best.teacher.name)) {
        best = { teacher: t, minutes: mins }
      }
    }
    return best && best.minutes > 0 ? best : null
  }, [scheduleTeachers])

  return (
    <>
      {mostOnAir && (
        <div className="flex items-center gap-2 mx-0 mb-3 bg-[rgba(132,184,79,0.08)] border border-[rgba(132,184,79,0.18)] rounded-[12px] px-3 py-2">
          <TeacherAvatar
            name={mostOnAir.teacher.name}
            photo={mostOnAir.teacher.photo}
            lqip={mostOnAir.teacher.lqip ?? null}
            size="xs"
            shape="circle"
            sizes="24px"
          />
          <span className="text-[10px] text-white/55">
            Most on air:{' '}
            <span className="text-white font-semibold">{mostOnAir.teacher.name}</span>
            {' · '}
            <span>{Math.round(mostOnAir.minutes / 60)} hrs / wk</span>
          </span>
        </div>
      )}

      <div className="flex gap-[5px] overflow-x-auto pb-1 mb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {DAYS.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => setSelectedDay(day)}
            className={`flex-shrink-0 px-4 py-[5px] rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
              selectedDay === day
                ? 'bg-[#84b84f] text-[#0a1505]'
                : 'bg-[#1e2328] text-white/50 hover:bg-[#262d34] hover:text-white/70'
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

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000/teachers → Schedule tab — verify:
- "Most on air" banner has green tinted container with small avatar + text
- Day pills are `bg-[#1e2328]` inactive and green active
- Today's day is pre-selected

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/ScheduleTabView.tsx
git commit -m "refactor(ScheduleTabView): M3 day pills, most-on-air chip banner with TeacherAvatar"
```

---

## Task 11: Update `TeacherDetailSheet`

**Files:**
- Modify: `src/components/teachers/TeacherDetailSheet.tsx`

- [ ] **Step 1: Rewrite `src/components/teachers/TeacherDetailSheet.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { BottomSheet } from '@/components/global/BottomSheet'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
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
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="px-6 pb-10 space-y-5 overflow-y-auto max-h-[60vh]">
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
          onClick={onClose}
          className="flex items-center justify-center w-full bg-[#1d2228] hover:bg-[#262d34] text-white rounded-xl py-4 text-sm font-semibold transition-colors cursor-pointer"
          aria-label={`View full profile for ${teacher.name}`}
        >
          View full profile →
        </Link>
      </div>
    </BottomSheet>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/teachers/TeacherDetailSheet.tsx
git commit -m "refactor(TeacherDetailSheet): use TeacherAvatar primitive, M3 schedule header"
```

---

## Task 12: Redesign teacher detail page

**Files:**
- Modify: `src/app/teachers/[slug]/page.tsx`

- [ ] **Step 1: Rewrite `src/app/teachers/[slug]/page.tsx`**

```tsx
import { cache, ViewTransition } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { sanityFetch } from '@/lib/sanity/client'
import {
  teacherDetailQuery,
  teacherSlugsQuery,
  highlightedTeachersQuery,
} from '@/lib/sanity/queries'
import type { TeacherDetail, TeacherSummary } from '@/lib/sanity/types'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import { PersonSchema } from '@/components/seo/PersonSchema'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'
import { TeacherInfoChip } from '@/components/teachers/primitives/TeacherInfoChip'

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

const getTeacher = cache(async (slug: string): Promise<TeacherDetail | null> => {
  return sanityFetch<TeacherDetail | null>(
    teacherDetailQuery,
    { slug },
    { tags: ['teachers'] }
  )
})

export async function generateStaticParams() {
  try {
    const slugs = await sanityFetch<{ slug: string }[]>(
      teacherSlugsQuery,
      {},
      { tags: ['teachers'] }
    )
    return slugs.map((t) => ({ slug: t.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const teacher = await getTeacher(slug)
  if (!teacher) return { title: 'Teacher Not Found' }
  const description = `Listen to ${teacher.name}${teacher.title ? ` — ${teacher.title}` : ''} on Reach Radio Tucson 106.7FM / 690AM`
  return {
    title: teacher.name,
    description,
    alternates: { canonical: `/teachers/${slug}` },
    openGraph: { type: 'profile', title: teacher.name, description, url: `/teachers/${slug}` },
    twitter: { card: 'summary_large_image', title: teacher.name, description },
  }
}

const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function TeacherDetailPage({ params }: Props) {
  const { slug } = await params

  const [teacher, highlightedRaw] = await Promise.all([
    getTeacher(slug),
    sanityFetch<TeacherSummary[]>(
      highlightedTeachersQuery,
      { slugs: [...HIGHLIGHTED_TEACHER_SLUGS] },
      { tags: ['teachers'] }
    ),
  ])

  if (!teacher) notFound()

  const sortedSchedule = [...(teacher.schedule ?? [])].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  const weeklyMinutes = computeWeeklyMinutes(teacher.schedule ?? [])
  const hoursPerWeek = weeklyMinutes > 0 ? Math.round(weeklyMinutes / 60) : 0
  const daysOnAir = (teacher.schedule ?? []).length

  const relatedTeachers = sortByHighlightedOrder(highlightedRaw, HIGHLIGHTED_TEACHER_SLUGS)
    .filter((t) => t.slug !== slug)
    .slice(0, 8)

  const primaryLink = teacher.links?.[0]
  const otherLinks = teacher.links?.slice(1) ?? []

  return (
    <div className="text-white">
      <ShowMediaBar />

      <PersonSchema
        name={teacher.name}
        jobTitle={teacher.title}
        imageUrl={teacher.photo ?? undefined}
        url={`https://reach.radio/teachers/${teacher.slug}`}
        description={`Listen to ${teacher.name} on Reach Radio Tucson`}
        knowsAbout={['Bible Teaching', 'Christian Ministry', 'Gospel']}
        sameAs={teacher.links?.map((l) => l.url)}
      />

      {/* Back button */}
      <div className="px-4 pt-[14px]">
        <Link
          href="/teachers"
          className="flex items-center gap-[5px] text-[#84b84f] text-[13px] font-medium w-fit cursor-pointer"
        >
          <span className="text-[17px] leading-none">‹</span>
          <span>Teachers</span>
        </Link>
      </div>

      {/* Banner */}
      <div className="relative w-full h-[88px] mt-3 bg-gradient-to-br from-[#1e3a0a] to-[#0a1305] overflow-hidden">
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

      {/* Avatar overlap row */}
      <div className="flex items-end justify-between px-4 mt-[-36px] mb-[10px]">
        <ViewTransition name={`teacher-${teacher.slug}`}>
          <TeacherAvatar
            name={teacher.name}
            photo={teacher.photo}
            lqip={teacher.lqip}
            size="xl"
            shape="circle"
            ring
            sizes="80px"
          />
        </ViewTransition>
        {primaryLink && (
          <a
            href={primaryLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[rgba(132,184,79,0.1)] border border-[rgba(132,184,79,0.3)] rounded-full px-3 py-[6px] text-[10px] font-semibold text-[#84b84f] cursor-pointer hover:bg-[rgba(132,184,79,0.18)] transition-colors"
          >
            {primaryLink.title} ↗
          </a>
        )}
      </div>

      {/* Name + title */}
      <div className="px-4 mb-[10px]">
        <h1 className="text-[19px] font-extrabold tracking-tight">{teacher.name}</h1>
        {(teacher.title || teacher.subtitle) && (
          <p className="text-[11px] text-white/50 mt-[3px] font-medium">
            {teacher.title}{teacher.subtitle ? ` · ${teacher.subtitle}` : ''}
          </p>
        )}
      </div>

      {/* Info chips */}
      {(hoursPerWeek > 0 || daysOnAir > 0 || (teacher.links?.length ?? 0) > 0) && (
        <div className="flex flex-wrap gap-[7px] px-4 mb-3">
          {hoursPerWeek > 0 && (
            <TeacherInfoChip icon="📻" label={`${hoursPerWeek} hrs/wk`} variant="accent" />
          )}
          {daysOnAir > 0 && (
            <TeacherInfoChip label={`${daysOnAir} day${daysOnAir !== 1 ? 's' : ''}`} variant="accent" />
          )}
          {(teacher.links?.length ?? 0) > 0 && (
            <TeacherInfoChip label={`${teacher.links!.length} link${teacher.links!.length !== 1 ? 's' : ''}`} variant="dim" />
          )}
        </div>
      )}

      {/* Other external links */}
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
                      {t.startTime} – {t.endTime}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Also on Reach Radio */}
      {relatedTeachers.length > 0 && (
        <>
          <div className="h-px bg-white/6 mx-4 mb-3" />
          <div className="pb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/35 px-4 mb-3">
              Also on Reach Radio
            </p>
            <div className="flex gap-[10px] overflow-x-auto px-4 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {relatedTeachers.map((t) => (
                <Link
                  key={t.slug}
                  href={`/teachers/${t.slug}`}
                  className="flex flex-col items-center gap-[4px] flex-shrink-0 w-[46px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
                  aria-label={t.name}
                >
                  <TeacherAvatar
                    name={t.name}
                    photo={t.photo}
                    lqip={t.lqip}
                    size="sm"
                    shape="circle"
                    sizes="38px"
                  />
                  <span className="text-[7px] text-white/40 text-center line-clamp-2 leading-tight">
                    {t.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Start dev server and verify detail page**

```bash
npm run dev
```

Open http://localhost:3000/teachers/[any-slug] — verify:
- Green back link at top
- Green gradient banner (~88px) with pattern
- Circular avatar with green ring peeks up from banner
- Primary external link floats right of avatar as ghost pill
- Name / title block below avatar
- Info chips row (hrs/wk, days, link count) in green accent style
- Other external links as ghost pills
- Schedule section with green left-border bars per time slot
- "Also on Reach Radio" horizontal avatar strip at bottom

- [ ] **Step 3: Commit**

```bash
git add src/app/teachers/[slug]/page.tsx
git commit -m "feat(TeacherDetail): banner+overlap redesign, info chips, M3 schedule, Also strip"
```

---

## Task 13: Update search page and `TeacherSearchClient`

**Files:**
- Modify: `src/app/teachers/search/page.tsx`
- Modify: `src/components/teachers/TeacherSearchClient.tsx`

- [ ] **Step 1: Update `src/app/teachers/search/page.tsx`**

Remove the old `flex items-center gap-3 mb-6` header block — `TeacherSearchClient` now owns the header row.

```tsx
import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Search Teachers',
  robots: { index: false },
}

interface Props {
  searchParams: Promise<{ q?: string }>
}

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

- [ ] **Step 2: Rewrite `src/components/teachers/TeacherSearchClient.tsx`**

```tsx
'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { X, ChevronRight } from 'lucide-react'
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

interface TeacherSearchClientProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
  initialQuery?: string
}

export function TeacherSearchClient({
  teachers,
  scheduleTeachers,
  initialQuery = '',
}: TeacherSearchClientProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const [displayValue, setDisplayValue] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [sort, setSort] = useState<SortOption | undefined>(undefined)
  const [activeDays, setActiveDays] = useState<string[]>([])

  useEffect(() => { inputRef.current?.focus() }, [])

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

  function handleQueryChange(value: string) {
    setDisplayValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setQuery(value), 300)
  }

  function clearQuery() {
    setDisplayValue('')
    setQuery('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  function toggleDay(day: string) {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function clearAll() {
    clearQuery()
    setSort(undefined)
    setActiveDays([])
  }

  const chipBase = 'flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors cursor-pointer border'
  const chipActive = 'bg-[rgba(132,184,79,0.15)] border-[rgba(132,184,79,0.3)] text-[#84b84f]'
  const chipInactive = 'bg-[#1e2328] border-white/7 text-white/45 hover:bg-[#262d34] hover:text-white/65'

  return (
    <div>
      {/* Header: back + inline search */}
      <div className="flex items-center gap-[10px] px-4 pt-[14px] pb-[10px]">
        <Link
          href="/teachers"
          className="text-[#84b84f] text-[17px] leading-none cursor-pointer flex-shrink-0"
          aria-label="Back to teachers"
        >
          ‹
        </Link>
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search teachers..."
            value={displayValue}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') clearQuery() }}
            className="w-full bg-[#1e2328] border border-white/7 rounded-[12px] pl-3 pr-9 py-2 text-white text-[13px] placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label="Search teachers"
          />
          {displayValue && (
            <button
              type="button"
              onClick={() => { clearQuery(); inputRef.current?.focus() }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center text-white/35 hover:text-white cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Day filter chips */}
      <div className="flex flex-wrap gap-[5px] px-4 pb-2">
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

      {/* Sort chips */}
      <div className="flex items-center flex-wrap gap-[5px] px-4 pb-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.07em] text-white/35 mr-1">
          Sort
        </span>
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={sort === option.value}
            onClick={() => setSort(sort === option.value ? undefined : option.value)}
            className={`${chipBase} ${sort === option.value ? chipActive : chipInactive}`}
          >
            {option.label}
          </button>
        ))}
        {hasFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-[10px] text-white/45 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
          >
            Clear all
          </button>
        )}
      </div>

      <p className="text-[10px] text-white/35 px-4 pb-2" aria-live="polite" aria-atomic="true">
        {results.length} {results.length === 1 ? 'teacher' : 'teachers'} found
      </p>

      {results.length > 0 ? (
        <ul>
          {results.map((teacher) => {
            const hrs = hoursMap.get(teacher.slug)
            const hoursPerWeek = hrs ? Math.round(hrs / 60) : 0
            return (
              <li key={teacher.slug}>
                <Link
                  href={`/teachers/${teacher.slug}`}
                  className="flex items-center gap-[10px] px-4 py-2 border-b border-white/4 hover:bg-white/4 transition-colors cursor-pointer"
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
                    <p className="text-white text-[13px] font-semibold truncate">{teacher.name}</p>
                    {teacher.title && (
                      <p className="text-white/45 text-[10px] truncate">{teacher.title}</p>
                    )}
                  </div>
                  {hoursPerWeek > 0 && (
                    <TeacherInfoChip label={`${hoursPerWeek}h`} variant="accent" />
                  )}
                  <ChevronRight className="h-4 w-4 text-white/18 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-white/35 text-center py-8 text-[13px]">
          No teachers found. Try a different search.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:3000/teachers/search — verify:
- Header is `‹` back chevron + inline search input (no separate h1)
- Day chips are outlined with green active state
- Sort chips match day chip style
- Result rows show `TeacherAvatar sm rounded` + on-air chip for teachers with schedule

- [ ] **Step 4: Commit**

```bash
git add src/app/teachers/search/page.tsx src/components/teachers/TeacherSearchClient.tsx
git commit -m "refactor(TeacherSearch): collapsed header, M3 chips, TeacherAvatar + InfoChip in results"
```

---

## Final verification

- [ ] **Run type check**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors. Fix any type mismatches before declaring done.

- [ ] **Run lint**

```bash
npm run lint 2>&1 | head -40
```

Expected: no errors.

- [ ] **Full visual walkthrough**

1. http://localhost:3000/teachers — list page with visible title, circular rec strip, M3 cards with on-air chips
2. http://localhost:3000/teachers → Schedule tab → select a day — green blocks, avatar in each slot
3. http://localhost:3000/teachers/[any-slug] — banner + avatar overlap + info chips + M3 schedule bars + Also strip
4. http://localhost:3000/teachers/search — collapsed header, outlined filter chips, avatar rows
5. Throttle network in DevTools → refresh /teachers — verify skeleton shows immediately, then real content swaps in
6. Check reduced-motion: `@media (prefers-reduced-motion: reduce)` — all animations suppressed

- [ ] **Final commit if any cleanup was needed**

```bash
git add -p  # stage only intentional cleanup
git commit -m "chore(teachers): post-redesign type and lint fixes"
```
