# iOS WKWebView Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six iOS WKWebView issues — keyboard delay, pinch-zoom persistence, iOS auto-zoom on form inputs, gray tap-highlight flash, track metadata stuck on defaults in native app, and native app overscroll bounce.

**Architecture:** All fixes are in the web layer only (`reach-radio-nextjs`). No changes to the native iOS or Android projects. The metadata fix extracts `useNowPlaying()` from `AudioProvider` into its own always-rendered component so SSE polling runs regardless of whether native audio is active.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, TypeScript strict

## Global Constraints

- Do NOT touch `reach-radio-native-ios` or `reach-radio-native-android`
- TypeScript strict mode — no `any` on new code (existing `any` casts may stay)
- All commits use conventional commit format with canonical scope from AGENTS.md
- Run `npm run build` after all tasks to confirm no TypeScript errors

---

## Files Modified

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Add `initialScale: 1` and `width: 'device-width'` to viewport; add `<NowPlayingProvider />` unconditionally |
| `src/components/bridge/BridgeInit.tsx` | Add viewport zoom reset at top of pathname `useEffect` |
| `src/components/about/ContactForm.tsx` | Change `text-sm` → `text-base` on name input, email input, message textarea |
| `src/app/globals.css` | Add `-webkit-tap-highlight-color: transparent`; add `overscroll-behavior: none` for native app |
| `src/components/AudioProvider.tsx` | Remove `useNowPlaying()` call (moved to NowPlayingProvider) |
| `src/components/NowPlayingProvider.tsx` | **Create** — thin wrapper that calls `useNowPlaying()` unconditionally |
| `src/components/teachers/TeacherSearchBar.tsx` | **Create** — search input outside Suspense; autoFocus fires on sheet open |
| `src/components/teachers/TeacherSearchClient.tsx` | Remove input section; read query from URL directly |
| `src/app/@modal/(...)teachers/search/page.tsx` | Render `TeacherSearchBar` above Suspense |
| `src/app/teachers/search/page.tsx` | Same — render `TeacherSearchBar` above Suspense |
| `src/components/skeletons/SearchResultsSkeleton.tsx` | Remove input placeholder (always rendered now) |

---

### Task 1: Fix viewport meta — eliminate 300ms keyboard delay

**Problem:** `layout.tsx` exports `viewport` without `initialScale: 1` or `width: 'device-width'`. iOS WKWebView applies a 300ms double-tap-to-zoom detection delay before firing focus events. When a user taps an input on `/about`, nothing visually responds for ~300ms — keyboard is delayed and the native nav/media bar may briefly hide.

**Files:**
- Modify: `src/app/layout.tsx:22-24`

- [ ] **Step 1: Update the viewport export**

Replace lines 22–24 in `src/app/layout.tsx`:

```ts
export const viewport: Viewport = {
  viewportFit: 'cover',
  initialScale: 1,
  width: 'device-width',
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: build completes with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(bridge): add initialScale and width to viewport to remove iOS tap delay"
```

---

### Task 2: Reset pinch-zoom on route change

**Problem:** If a user pinch-zooms on `/about` and navigates away, the zoom level persists on the next page. There is no zoom reset on route change.

**Root cause:** The existing `pathname` `useEffect` in `BridgeInit.tsx` sends native messages but never resets the viewport `maximum-scale`. The standard fix is to momentarily set `maximum-scale=1` then restore it, forcing iOS to snap back to 1×.

**Files:**
- Modify: `src/components/bridge/BridgeInit.tsx:95-102`

**Context:** After Task 1, the viewport meta content rendered by Next.js will be:
`width=device-width, initial-scale=1, viewport-fit=cover`

The restored string in the timeout must match this exactly.

- [ ] **Step 1: Update the pathname useEffect**

Replace lines 94–102 in `src/components/bridge/BridgeInit.tsx`:

```ts
// On route change: send location + showMediaBar + nav visibility + reset zoom
useEffect(() => {
  // Reset any pinch-zoom carried over from the previous page
  const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
  let t: ReturnType<typeof setTimeout> | undefined
  if (meta) {
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
    t = setTimeout(() => {
      meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover'
    }, 50)
  }

  const segments = pathname.split('/').filter(Boolean)
  const isTeacherDetail =
    segments[0] === 'teachers' && segments.length === 2 && segments[1] !== 'search'
  postMessageToNative({ location: pathname })
  postMessageToNative({ showMediaBar: pathname !== '/' && !isTeacherDetail })
  postMessageToNative({ showMobileNav: !isTeacherDetail })

  return () => clearTimeout(t)
}, [pathname])
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors. `ReturnType<typeof setTimeout>` is the correct type for `t` — no `any` needed.

- [ ] **Step 3: Commit**

```bash
git add src/components/bridge/BridgeInit.tsx
git commit -m "fix(bridge): reset pinch-zoom on route change via viewport maximum-scale trick"
```

---

### Task 3: Fix ContactForm inputs triggering iOS auto-zoom

**Problem:** iOS WKWebView auto-zooms when a focused input has `font-size < 16px`. All three user-facing inputs in `ContactForm.tsx` use `text-sm` (14px), triggering unwanted zoom on tap.

**Files:**
- Modify: `src/components/about/ContactForm.tsx:40,47,54`

- [ ] **Step 1: Update input and textarea classNames**

In `src/components/about/ContactForm.tsx`, change `text-sm` to `text-base` on the three user-facing fields (not the honeypot hidden inputs, not the label or button):

Line 40 — name input:
```tsx
className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus:ring-1 focus:ring-white light:focus:ring-gray-400"
```

Line 47 — email input:
```tsx
className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus:ring-1 focus:ring-white light:focus:ring-gray-400"
```

Line 54 — message textarea:
```tsx
className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus:ring-1 focus:ring-white light:focus:ring-gray-400 resize-none"
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/about/ContactForm.tsx
git commit -m "fix(about): use text-base on inputs to prevent iOS auto-zoom on focus"
```

---

### Task 4: Remove gray tap-highlight flash on interactive elements

**Problem:** iOS WKWebView renders a gray highlight flash on all interactive elements on tap. There is no `-webkit-tap-highlight-color` reset in `globals.css`. The existing `touch-action: manipulation` rule at line 64 is the right place to add it.

**Files:**
- Modify: `src/app/globals.css:64-66`

- [ ] **Step 1: Add tap-highlight reset to existing touch rule**

Replace lines 64–66 in `src/app/globals.css`:

```css
button, a, [role="button"], input, label {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "fix(global): remove iOS tap highlight flash via -webkit-tap-highlight-color"
```

---

### Task 5: Fix track metadata stuck on "Reach Radio" in native app

**Problem:** In native iOS/Android, `layout.tsx` conditionally renders `AudioProvider` only when `!isMobileApp`. `AudioProvider` contains both the `<audio>` element AND `useNowPlaying()` (the SSE hook that polls `/api/stream-info-sse`). When native audio is active, both are skipped — the audio skip is correct, but the metadata polling also stops. The media store's `title` stays `"Reach Radio"` and `artist` stays `""` forever. `BridgeInit.tsx` fires once on mount with stale defaults, so the native MediaBarView and web `RadioPlayer.tsx` both show "Reach Radio" permanently.

**Fix:** Extract `useNowPlaying()` out of `AudioProvider` into a new always-rendered `NowPlayingProvider` component. Render it unconditionally in `layout.tsx` alongside the conditional `AudioProvider`.

**Files:**
- Create: `src/components/NowPlayingProvider.tsx`
- Modify: `src/components/AudioProvider.tsx:5,12` (remove `useNowPlaying` import and call)
- Modify: `src/app/layout.tsx` (add `<NowPlayingProvider />` unconditionally, import it)

**No changes needed to:** `useNowPlaying`, `BridgeInit`, `media-store`, or any native code.

- [ ] **Step 1: Create NowPlayingProvider.tsx**

Create `src/components/NowPlayingProvider.tsx`:

```tsx
'use client'

import { useNowPlaying } from '@/hooks/useNowPlaying'

export function NowPlayingProvider() {
  useNowPlaying()
  return null
}
```

- [ ] **Step 2: Remove useNowPlaying from AudioProvider**

In `src/components/AudioProvider.tsx`, remove line 5 (the import) and line 12 (the call):

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

interface AudioProviderProps {
  streamUrl: string
}

export function AudioProvider({ streamUrl }: AudioProviderProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const isPlaying = useMediaStore((s) => s.isPlaying)
  // ... rest of file unchanged
```

- [ ] **Step 3: Add NowPlayingProvider to layout.tsx**

In `src/app/layout.tsx`, add the import alongside the existing `AudioProvider` import:

```tsx
import { AudioProvider } from '@/components/AudioProvider'
import { NowPlayingProvider } from '@/components/NowPlayingProvider'
```

Find the conditional `AudioProvider` render (currently `{!isMobileApp && <AudioProvider streamUrl={streamUrl} />}`) and add `NowPlayingProvider` unconditionally above it:

```tsx
<NowPlayingProvider />
{!isMobileApp && <AudioProvider streamUrl={streamUrl} />}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors, no unused import warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/NowPlayingProvider.tsx src/components/AudioProvider.tsx src/app/layout.tsx
git commit -m "fix(player): extract useNowPlaying into NowPlayingProvider so metadata SSE runs in native app"
```

---

### Task 6: Suppress overscroll bounce in native app (web layer)

**Problem:** In the native iOS/Android app, the WKWebView's scroll view can still show a rubber-band bounce at the top and bottom of pages, even though this is a single-page app with custom navigation. This looks non-native and jarring. The web-side fix is `overscroll-behavior: none` scoped to the `.native-app` class (set by `BridgeInit` when the bridge is detected).

**Context:** `globals.css` already has `overscroll-behavior-x: none` on `html.native-app body` (line 50) and `overscroll-behavior-y: contain` on `main` (line 61). The native app needs `overscroll-behavior: none` on body to suppress Y-axis bounce too.

**Files:**
- Modify: `src/app/globals.css:47-51`

- [ ] **Step 1: Add overscroll-behavior: none to native app body rule**

The current `html.native-app body` block (lines 47–51) looks like:

```css
html.native-app body {
  padding-bottom: 0;
  overflow-x: hidden;
  overscroll-behavior-x: none;
}
```

Replace it with:

```css
html.native-app body {
  padding-bottom: 0;
  overflow-x: hidden;
  overscroll-behavior: none;
}
```

(`overscroll-behavior: none` is shorthand that covers both axes — replaces the existing `-x: none` and adds `-y: none`.)

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "fix(global): suppress overscroll bounce in native app via overscroll-behavior none"
```

---

### Task 8: Fix teacher search keyboard — render input outside Suspense

**Problem:** `autoFocus` on the search input is inside a `Suspense` boundary in the modal page. During load, only `SearchResultsSkeleton` renders — no input exists. `autoFocus` fires only after Sanity data loads (potentially 500ms+ after the sheet opens). On iOS, that gap breaks keyboard auto-show.

**Root cause:** `@modal/(...)teachers/search/page.tsx` wraps the entire `TeacherSearchClient` (including the input) in `Suspense`. The input must mount immediately when the sheet opens — before data loads.

**Fix:** Extract the text input into a new `TeacherSearchBar` client component. Render it outside Suspense in the modal page. Keep only the filters + results inside `TeacherSearchClient` (rendered inside Suspense). Both components share state via URL params — `TeacherSearchBar` writes `?q=`, `TeacherSearchClient` reads it.

**Files:**
- Create: `src/components/teachers/TeacherSearchBar.tsx`
- Modify: `src/components/teachers/TeacherSearchClient.tsx` (remove input section + `displayValue`/`debounceRef` state)
- Modify: `src/app/@modal/(...)teachers/search/page.tsx` (render `TeacherSearchBar` above Suspense)
- Modify: `src/app/teachers/search/page.tsx` (same fix for direct route)
- Modify: `src/components/skeletons/SearchResultsSkeleton.tsx` (remove input placeholder — it's always rendered now)

- [ ] **Step 1: Create TeacherSearchBar.tsx**

Create `src/components/teachers/TeacherSearchBar.tsx`:

```tsx
'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'

export function TeacherSearchBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const [displayValue, setDisplayValue] = useState(searchParams.get('q') ?? '')

  function pushQuery(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value.trim()) {
      params.set('q', value.trim())
    } else {
      params.delete('q')
    }
    const search = params.toString()
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    })
  }

  function handleChange(value: string) {
    setDisplayValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => pushQuery(value), 300)
  }

  function clear() {
    setDisplayValue('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    pushQuery('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex items-center gap-[10px]">
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 light:text-gray-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          autoFocus
          placeholder="Search teachers..."
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') clear() }}
          className="w-full bg-white/5 light:bg-white border border-white/10 light:border-gray-300 rounded-xl pl-10 pr-12 py-2.5 text-base sm:text-sm text-white light:text-gray-900 placeholder:text-white/40 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20"
          aria-label="Search teachers"
        />
        {displayValue && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {isPending ? (
              <Loader2 className="h-4 w-4 text-white/40 light:text-gray-400 animate-spin" aria-hidden="true" />
            ) : (
              <button
                type="button"
                onClick={clear}
                className="flex h-8 w-8 items-center justify-center text-white/40 light:text-gray-400 hover:text-white light:hover:text-gray-900 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Remove input from TeacherSearchClient**

In `src/components/teachers/TeacherSearchClient.tsx`:

Remove imports: `useRef` (if only used for input/debounce), `Search`, `X`, `Loader2` from lucide-react.

Remove state: `displayValue` (`useState`), `debounceRef` (`useRef`).

Remove functions: `handleQueryChange`, `clearQuery` (or keep `clearAll` — it only clears day/sort/query via URL).

Change `query` derivation — instead of a local debounced state, read from URL directly:
```tsx
const urlQ = searchParams.get('q') ?? ''
```

Change `results` memo — use `urlQ` instead of `query`:
```tsx
const results = useMemo(
  () => filterTeachers(teachers, urlQ, { sort, days: activeDays, scheduleMap, hoursMap }),
  [teachers, urlQ, sort, activeDays, scheduleMap, hoursMap]
)
```

Change `hasFilter`:
```tsx
const hasFilter = urlQ.trim().length > 0 || !!sort || activeDays.length > 0
```

Remove `clearAll` URL reset of `q` param — keep: `setDisplayValue('')` → just remove that line since `displayValue` is gone. `clearAll` should reset URL to `pathname` which already clears `q`.

Remove the input JSX block entirely (the `{/* Search input */}` div with `<div className="flex items-center gap-[10px]">`).

Remove `isPending`/`startTransition` only if no longer used (they may still be used for day/sort URL pushes — check `pushURL`).

- [ ] **Step 3: Update modal page**

Replace `src/app/@modal/(...)teachers/search/page.tsx`:

```tsx
import { Suspense } from 'react'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { TeacherSearchBar } from '@/components/teachers/TeacherSearchBar'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'

async function ModalSearchContent() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])
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
    <SheetChrome title="Search Teachers" padded={false}>
      <div className="px-4 pt-4 pb-3">
        <TeacherSearchBar />
      </div>
      <Suspense fallback={<SearchResultsSkeleton />}>
        <ModalSearchContent />
      </Suspense>
    </SheetChrome>
  )
}
```

- [ ] **Step 4: Update direct route page**

Replace `src/app/teachers/search/page.tsx` similarly — render `TeacherSearchBar` outside Suspense, `TeacherSearchClient` inside:

```tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { TeacherSearchBar } from '@/components/teachers/TeacherSearchBar'
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'

export const metadata: Metadata = {
  title: 'Search Teachers',
  robots: { index: false },
}

async function SearchContent() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])
  return <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
}

export default function TeachersSearchPage() {
  return (
    <div className="px-4 py-6 sm:px-6 space-y-4">
      <TeacherSearchBar />
      <Suspense fallback={<SearchResultsSkeleton />}>
        <SearchContent />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 5: Update SearchResultsSkeleton**

Remove the `{/* Search input */}` block from `src/components/skeletons/SearchResultsSkeleton.tsx` — it's now always rendered outside Suspense:

```tsx
export function SearchResultsSkeleton() {
  return (
    <div className="max-w-screen-xl mx-auto space-y-4" role="status" aria-busy="true" aria-label="Loading search results...">
      {/* Day filter chips */}
      <div>
        <Sk className="h-3 w-8 mb-1.5 rounded" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Sk key={i} className="h-[44px] w-[52px] rounded-full flex-shrink-0" />
          ))}
        </div>
      </div>

      {/* Sort chips */}
      <div>
        <Sk className="h-3 w-8 mb-1.5 rounded" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk key={i} className="h-[44px] w-[60px] rounded-full flex-shrink-0" />
          ))}
        </div>
      </div>

      {/* Results */}
      <div>
        <Sk className="h-4 w-[80px] mb-3 rounded" />
        <ul className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="h-[68px] rounded-xl bg-white/5 light:bg-gray-100 motion-safe:animate-pulse" />
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors, no unused import warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components/teachers/TeacherSearchBar.tsx src/components/teachers/TeacherSearchClient.tsx src/app/@modal/\(...\)teachers/search/page.tsx src/app/teachers/search/page.tsx src/components/skeletons/SearchResultsSkeleton.tsx
git commit -m "fix(teachers): render search input outside Suspense so keyboard shows on sheet open"
```

---

### Task 7: Final build verification

- [ ] **Step 1: Clean build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors, no lint warnings on changed files.

- [ ] **Step 2: Manual smoke test checklist (iOS WKWebView or Safari)**

- `/about` contact form: tap name field → keyboard appears immediately, no 300ms delay, no zoom
- `/about` contact form: tap email field → no auto-zoom
- Pinch-zoom on any page → navigate to another page → zoom resets to 1×
- Tap any button or link → no gray flash
- Bottom sheet drag handle → no white box
- Native app: play radio → track title and artist update from "Reach Radio" / "" to live metadata
- Native app: scroll to top or bottom of page → no rubber-band bounce
- Tap "Search" on teachers page → sheet opens → keyboard appears immediately without tapping input

