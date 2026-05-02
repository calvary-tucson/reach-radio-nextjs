# Cache Components + View Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `sanityFetch` to Next.js 16 `use cache` + `cacheComponents`, and add view transitions (photo morph + directional slides) for teacher list↔detail navigation.

**Architecture:** Part 1 replaces `react.cache()` + `next: { tags }` with the `use cache` directive + `cacheLife`/`cacheTag` inside `sanityFetch` — a single-file change with no caller impact. Part 2 adds `<ViewTransition>` wrappers on teacher images in both grid and detail, `transitionTypes` on navigation links, a header anchor, and CSS keyframes in `globals.css`.

**Tech Stack:** Next.js 16.2.4, React 19, `next/cache` (`cacheTag`, `cacheLife`, `revalidateTag`), Vitest, Playwright, Tailwind CSS

---

## Part 1: Cache Components Migration

### Task 1: Enable `cacheComponents` and `viewTransition` in config

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add flags to next.config.ts**

Replace the existing config with:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    serverComponentsHmrCache: true,
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/speakers/:slug*', destination: '/teachers/:slug*', permanent: true },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: enable cacheComponents and viewTransition in next.config"
```

---

### Task 2: Migrate `sanityFetch` to `use cache`

**Files:**
- Modify: `src/lib/sanity/client.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sanity-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.mock('@sanity/client', () => ({
  createClient: vi.fn(() => ({ fetch: mockFetch })),
}))

const mockCacheTag = vi.fn()
const mockCacheLife = vi.fn()
vi.mock('next/cache', () => ({
  cacheTag: (...args: string[]) => mockCacheTag(...args),
  cacheLife: (profile: string) => mockCacheLife(profile),
  revalidateTag: vi.fn(),
}))

describe('sanityFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls cacheLife with "days"', async () => {
    mockFetch.mockResolvedValue([])
    const { sanityFetch } = await import('@/lib/sanity/client')
    await sanityFetch('*[_type == "teacher"]')
    expect(mockCacheLife).toHaveBeenCalledWith('days')
  })

  it('calls cacheTag with provided tags', async () => {
    mockFetch.mockResolvedValue([])
    const { sanityFetch } = await import('@/lib/sanity/client')
    await sanityFetch('*[_type == "teacher"]', {}, { tags: ['teachers'] })
    expect(mockCacheTag).toHaveBeenCalledWith('teachers')
  })

  it('does not call cacheTag when no tags provided', async () => {
    mockFetch.mockResolvedValue([])
    const { sanityFetch } = await import('@/lib/sanity/client')
    await sanityFetch('*[_type == "teacher"]')
    expect(mockCacheTag).not.toHaveBeenCalled()
  })

  it('returns data from Sanity client', async () => {
    mockFetch.mockResolvedValue([{ name: 'John' }])
    const { sanityFetch } = await import('@/lib/sanity/client')
    const result = await sanityFetch('*[_type == "teacher"]')
    expect(result).toEqual([{ name: 'John' }])
  })

  it('passes query params to Sanity client', async () => {
    mockFetch.mockResolvedValue(null)
    const { sanityFetch } = await import('@/lib/sanity/client')
    await sanityFetch('*[slug.current == $slug]', { slug: 'john' })
    expect(mockFetch).toHaveBeenCalledWith(
      '*[slug.current == $slug]',
      { slug: 'john' }
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/sanity-client.test.ts
```

Expected: FAIL — `sanityFetch` currently uses `react.cache` and `next.tags`, not `cacheTag`/`cacheLife`

- [ ] **Step 3: Replace `src/lib/sanity/client.ts`**

```ts
import { createClient } from '@sanity/client'
import { cacheTag, cacheLife } from 'next/cache'

function getClient() {
  return createClient({
    projectId: process.env.SANITY_PROJECT_ID ?? 'bk05c6rl',
    dataset: process.env.SANITY_DATASET ?? 'production',
    apiVersion: '2024-02-22',
    perspective: 'published',
    useCdn: true,
  })
}

export async function sanityFetch<T>(
  query: string,
  params: Record<string, unknown> = {},
  options: { tags?: string[] } = {}
): Promise<T> {
  'use cache'
  const { tags } = options
  cacheLife('days')
  if (tags?.length) {
    cacheTag(...tags)
  }
  return getClient().fetch<T>(query, params)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/sanity-client.test.ts
```

Expected: PASS — all 5 tests green

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npm test
```

Expected: all unit tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/sanity/client.ts tests/unit/sanity-client.test.ts
git commit -m "feat: migrate sanityFetch to use cache directive with cacheLife and cacheTag"
```

---

## Part 2: View Transitions

### Task 3: Add `<ViewTransition>` to `TeacherCard`

**Files:**
- Modify: `src/components/teachers/TeacherCard.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/teacher-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import type { TeacherSummary } from '@/lib/sanity/types'

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const teacher: TeacherSummary = {
  name: 'John MacArthur',
  slug: 'john-macarthur',
  title: 'Grace to You',
  photo: 'https://cdn.sanity.io/images/test/production/photo.jpg',
}

describe('TeacherCard', () => {
  it('renders teacher name', () => {
    render(<TeacherCard teacher={teacher} />)
    expect(screen.getByText('John MacArthur')).toBeInTheDocument()
  })

  it('renders image with correct alt when photo exists', () => {
    render(<TeacherCard teacher={teacher} />)
    expect(screen.getByAltText('John MacArthur')).toBeInTheDocument()
  })

  it('renders no image when photo is absent', () => {
    render(<TeacherCard teacher={{ ...teacher, photo: '' }} />)
    expect(screen.queryByAltText('John MacArthur')).not.toBeInTheDocument()
  })

  it('links to teacher detail page', () => {
    render(<TeacherCard teacher={teacher} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/teachers/john-macarthur')
  })
})
```

- [ ] **Step 2: Run tests to verify they pass as-is (baseline)**

```bash
npm test -- tests/unit/teacher-card.test.tsx
```

Expected: PASS — these test existing behavior before modification

- [ ] **Step 3: Update `TeacherCard` to add `<ViewTransition>` and `transitionTypes`**

```tsx
import { ViewTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { TeacherSummary } from '@/lib/sanity/types'

export function TeacherCard({ teacher }: { teacher: TeacherSummary }) {
  return (
    <Link
      href={`/teachers/${teacher.slug}`}
      transitionTypes={['nav-forward']}
      className="block bg-gray-700/30 rounded overflow-hidden hover:bg-gray-700/50 transition-colors"
    >
      {teacher.photo && (
        <ViewTransition name={`teacher-${teacher.slug}`}>
          <Image
            src={teacher.photo}
            alt={teacher.name}
            width={300}
            height={300}
            className="w-full aspect-square object-cover"
          />
        </ViewTransition>
      )}
      <div className="p-3">
        <p className="text-white font-semibold text-sm">{teacher.name}</p>
        <p className="text-white/60 text-xs mt-1">{teacher.title}</p>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Run tests to verify they still pass**

```bash
npm test -- tests/unit/teacher-card.test.tsx
```

Expected: PASS — behavior unchanged, `ViewTransition` wraps image transparently in jsdom

- [ ] **Step 5: Commit**

```bash
git add src/components/teachers/TeacherCard.tsx tests/unit/teacher-card.test.tsx
git commit -m "feat: add ViewTransition morph and nav-forward transitionTypes to TeacherCard"
```

---

### Task 4: Add `<ViewTransition>` and `transitionTypes` to teacher detail page

**Files:**
- Modify: `src/app/teachers/[slug]/page.tsx`

- [ ] **Step 1: Update the hero image block and back link**

In `src/app/teachers/[slug]/page.tsx`, make the following two changes:

1. Add import at top of file:
```tsx
import { ViewTransition } from 'react'
```

2. Replace the photo block (currently lines 62–70):
```tsx
      {teacher.photo && (
        <ViewTransition name={`teacher-${teacher.slug}`}>
          <Image
            src={teacher.photo}
            alt={teacher.name}
            width={420}
            height={420}
            className="w-full max-w-sm mx-auto rounded object-cover mb-6"
            priority
          />
        </ViewTransition>
      )}
```

3. Replace the back link (currently line 53):
```tsx
      <Link href="/teachers" transitionTypes={['nav-back']} className="text-white/60 text-sm mb-6 block hover:text-white">
        ← Teachers
      </Link>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/teachers/[slug]/page.tsx"
git commit -m "feat: add ViewTransition morph and nav-back transitionTypes to teacher detail page"
```

---

### Task 5: Anchor the header during transitions

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add `viewTransitionName` to the header element**

Replace the existing `Header` component:

```tsx
import Link from 'next/link'

export function Header() {
  return (
    <header
      style={{ viewTransitionName: 'site-header' }}
      className="bg-[var(--color-brand-gray)] px-4 py-3 flex items-center justify-between"
    >
      <Link href="/" className="text-white font-bold text-lg">
        Reach Radio
      </Link>
      <nav className="hidden md:flex gap-6">
        <Link href="/" className="text-white/80 hover:text-white text-sm">Listen</Link>
        <Link href="/teachers" className="text-white/80 hover:text-white text-sm">Teachers</Link>
        <Link href="/about" className="text-white/80 hover:text-white text-sm">About</Link>
        <Link href="/donate" className="text-white/80 hover:text-white text-sm">Donate</Link>
      </nav>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: anchor header with viewTransitionName to prevent sliding during page transitions"
```

---

### Task 6: Add view transition CSS

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Append view transition rules to `globals.css`**

Append to the end of `src/app/globals.css`:

```css
/* View Transitions */

/* Directional slide — forward (left) */
::view-transition-old(.nav-forward) {
  --slide-offset: -60px;
  animation:
    150ms ease-in both vt-fade reverse,
    400ms ease-in-out both vt-slide reverse;
}
::view-transition-new(.nav-forward) {
  --slide-offset: 60px;
  animation:
    210ms ease-out 150ms both vt-fade,
    400ms ease-in-out both vt-slide;
}

/* Directional slide — back (right) */
::view-transition-old(.nav-back) {
  --slide-offset: 60px;
  animation:
    150ms ease-in both vt-fade reverse,
    400ms ease-in-out both vt-slide reverse;
}
::view-transition-new(.nav-back) {
  --slide-offset: -60px;
  animation:
    210ms ease-out 150ms both vt-fade,
    400ms ease-in-out both vt-slide;
}

@keyframes vt-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes vt-slide {
  from {
    translate: var(--slide-offset);
  }
  to {
    translate: 0;
  }
}

/* Header anchor — stays fixed, does not slide */
::view-transition-group(site-header) {
  animation: none;
  z-index: 100;
}
::view-transition-old(site-header) {
  display: none;
}
::view-transition-new(site-header) {
  animation: none;
}

/* Reduced motion — instant swap, no positional animation */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*),
  ::view-transition-group(*) {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
  }
}
```

- [ ] **Step 2: Run the dev server and verify manually**

```bash
npm run dev
```

Open `http://localhost:3000/teachers`. Click a teacher with a photo. Verify:
- Photo morphs from grid thumbnail into hero image
- Page content slides left (forward)
- Header stays fixed
- Click `← Teachers` — content slides right (back), photo morphs back into grid

- [ ] **Step 3: Run E2E tests to check for regressions**

```bash
npm run test:e2e -- tests/e2e/teachers.spec.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add view transition CSS for nav-forward/nav-back slides and header anchor"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full unit test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 2: Run full E2E suite**

```bash
npm run test:e2e
```

Expected: all tests pass

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: build succeeds with no errors or warnings about `use cache` or view transitions
