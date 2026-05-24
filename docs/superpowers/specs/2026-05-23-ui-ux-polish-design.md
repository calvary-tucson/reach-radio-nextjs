# UI/UX Polish, A11y, and Mobile App Shell — Design Spec

**Date:** 2026-05-23  
**Scope:** Full-app a11y fixes, mobile webview hardening, animation polish, Teachers live search overhaul, icon system

---

## 1. A11y Fixes

### 1.1 TeacherCard aria-label (Critical)

**Problem:** `aria-label={teacher.name}` omits the teacher's ministry/title. Screen reader users hear "Jack Hibbs, link" with no context distinguishing teachers.

**Fix:** `aria-label={`${teacher.name} — ${teacher.title}`}`

File: `src/components/teachers/TeacherCard.tsx`

### 1.2 Back navigation arrows

**Problem:** Back links use `<span aria-hidden="true">←</span>` — correct for screen readers but fails in forced-colors/high-contrast mode where unicode arrows can disappear.

**Fix:** Replace with `ArrowLeftIcon` SVG component (see Section 5).

Files: `src/app/teachers/[slug]/page.tsx`, `src/app/teachers/search/page.tsx`

### 1.3 Live search result count announcement

**Required for Section 4 (live search):** Add `aria-live="polite"` region showing count of filtered results. Pattern already exists in `/teachers/search/page.tsx` — copy to `TeachersClientView`.

---

## 2. Mobile App Shell Hardening

The layout correctly strips header/footer/nav when `isMobileApp=true` (via `mobile-app` request header). The following gaps remain.

### 2.1 Safe Area Insets

**Problem:** Zero `env(safe-area-inset-*)` usage. On iPhone 14+ the dynamic island and home indicator overlap content.

**Fix — viewport-fit=cover:** Add to `src/app/layout.tsx` metadata:
```ts
export const viewport: Viewport = {
  viewportFit: 'cover',
}
```

**Fix — CSS custom properties** in `src/app/globals.css`:
```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}
```

**Fix — app-mode main padding:** In layout, when `isMobileApp`, add `style={{ paddingBottom: 'var(--safe-bottom)' }}` to `<main>`.

### 2.2 MediaBar Bottom Offset in App Mode

**Problem:** `MediaBar` is positioned `bottom-[72px] md:bottom-0`. The `72px` clears the MobileNav on mobile. In app mode MobileNav is not rendered — MediaBar floats 72px from bottom for no reason.

**Fix:** Add `data-app="true"` attribute to `<body>` in `layout.tsx` when `isMobileApp`. Use CSS to conditionally position MediaBar:

```css
/* globals.css */
body[data-app] [data-media-bar] {
  bottom: var(--safe-bottom, 0px);
  padding-bottom: var(--safe-bottom, 0px);
}
```

Add `data-media-bar` attribute to the MediaBar root div. No JS changes needed in `MediaBar.tsx` beyond adding the data attribute.

### 2.3 Text Size Adjustment

**Problem:** iOS WebView can auto-inflate text on orientation change.

**Fix** in `globals.css`:
```css
body {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
```

### 2.4 Touch Action

**Problem:** 300ms tap delay on older iOS WebView for interactive elements.

**Fix** in `globals.css`:
```css
button, a, [role="button"], input, label {
  touch-action: manipulation;
}
```

### 2.5 Overscroll Behavior

**Problem:** Rubber-band scroll on web content can conflict with native app shell gesture handling.

**Fix** in `globals.css` (applied to `main`):
```css
main {
  overscroll-behavior-y: contain;
}
```

---

## 3. Animation Polish

### 3.1 TeacherCard Hover — Reduce Duration

**Problem:** `transition-all duration-500` on hover scale feels sluggish.

**Fix:** Change to `duration-200` on `TeacherCard`. Keep `motion-safe:hover:scale-[1.03]` (reduce from 1.05 — less dramatic, more premium).

### 3.2 MediaBar Slide-Up Entrance

**Problem:** MediaBar pops in/out instantly with `if (!showMediaBar) return null`.

**Fix:** Keep element in DOM, animate visibility:
- Hidden: `translate-y-full opacity-0`
- Visible: `translate-y-0 opacity-100`
- Transition: `transform 250ms ease-out, opacity 200ms ease-out`
- Use `aria-hidden={!showMediaBar}` instead of conditional render

```css
/* globals.css */
[data-media-bar] {
  transition: transform 250ms ease-out, opacity 200ms ease-out;
}
[data-media-bar][data-hidden] {
  transform: translateY(100%);
  opacity: 0;
  pointer-events: none;
}
```

### 3.3 Teacher Grid Stagger Entrance

**Problem:** Grid pops in all at once when Suspense resolves.

**Fix:** CSS animation with nth-child stagger using inline `--i` CSS variable:

```css
/* globals.css */
@keyframes card-enter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.teacher-card {
  animation: card-enter 240ms ease-out backwards;
  animation-delay: calc(var(--stagger-i, 0) * 35ms);
}
```

In `TeacherCard`, add `className="teacher-card"` and `style={{ '--stagger-i': index } as React.CSSProperties}`. Pass `index` prop from the grid map.

Guarded by `@media (prefers-reduced-motion: no-preference)` — existing reduced-motion block in `globals.css` already overrides with `animation-duration: 0s`.

### 3.4 TodaySchedule Row Stagger

Same pattern as 3.3, applied to schedule rows. Stagger delay: 25ms per row. Apply `schedule-row` class + `--stagger-i` style.

### 3.5 Page Content Entrance

**Problem:** Pages without view transitions (about, donate) have no entrance.

**Fix:** Add `.page-enter` CSS class:
```css
@keyframes page-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.page-enter {
  animation: page-enter 280ms ease-out 50ms backwards;
}
```

Apply to the root `<div>` in `AboutPage` and `DonatePage`. Home and Teachers use Suspense/view transitions so this isn't needed there.

---

## 4. Teachers Overhaul — Live Search

### 4.1 Problem Statement

Current search flow requires a full page navigation to `/teachers/search?q=...` on form submit. This is a jarring UX, especially in a mobile webview. There is also an inconsistency: the global `SearchInput` component (with icon + clear button) exists but is NOT used in the Teachers search — it uses a custom `SearchBar` with a separate Submit button.

### 4.2 Architecture

**Data fetching stays server-side.** `TeachersPage` server component fetches all teachers (already cached, `revalidate=3600`, all teachers fit in memory — ~30-50 records).

**Filtering moves client-side.** New `TeachersClientView` client component receives the full teachers array as a prop and filters in memory.

```
TeachersPage (server) 
  → fetches all teachers
  → <TeachersClientView teachers={teachers} initialQuery={searchParams.q} />

TeachersClientView (client)
  → useState: query
  → useDebounce(query, 200) — hook already exists at src/hooks/useDebounce.ts
  → filtered = useMemo: teachers.filter(name.includes(debouncedQuery))
  → <SearchInput> wired to query state (component already exists at src/components/global/SearchInput.tsx)
  → result count aria-live region
  → teacher grid from filtered array
  → URL sync: router.replace(`/teachers${q ? `?q=${encodeURIComponent(q)}` : ''}`, { scroll: false })
```

### 4.3 SearchBar Deletion

`src/components/teachers/SearchBar.tsx` — delete. Replaced entirely by `SearchInput` wired inside `TeachersClientView`.

### 4.4 /teachers/search Route

`src/app/teachers/search/page.tsx` — redirect to `/teachers`. The route is `robots: noindex` so no SEO impact. Implement as a Next.js redirect in the page or in `next.config`.

Option A (page redirect):
```ts
import { redirect } from 'next/navigation'
export default function TeacherSearchPage({ searchParams }) {
  const q = searchParams?.q ?? ''
  redirect(q ? `/teachers?q=${encodeURIComponent(q)}` : '/teachers')
}
```

Option B (next.config redirect) — cleaner, preferred:
```js
redirects: async () => [
  { source: '/teachers/search', destination: '/teachers', permanent: false },
]
```

### 4.5 Layout Mockup

```
┌───────────────────────────────────┐
│ Teachers            23 teachers   │  ← count, white/50
├───────────────────────────────────┤
│ 🔍 Search teachers...         [×] │  ← SearchInput (existing component)
├───────────────────────────────────┤
│ [Card] [Card]                     │  ← 2col mobile
│ [Card] [Card]                     │
│ [Card] [Card]                     │
└───────────────────────────────────┘

With active query "jack":
┌───────────────────────────────────┐
│ Teachers          2 of 23 shown   │  ← aria-live region
├───────────────────────────────────┤
│ 🔍 jack                       [×] │
├───────────────────────────────────┤
│ [Jack Graham] [Jack Hibbs]        │
│                                   │
│   No other results                │
└───────────────────────────────────┘
```

### 4.6 TeacherCard Redesign

**Visual changes:**

| Property | Before | After |
|---|---|---|
| Border | `border-green-700` + neon glow shadow | `border border-white/10` |
| Hover border | — | `hover:border-white/25` |
| Hover scale | `scale-105` | `scale-[1.03]` |
| Hover duration | `duration-500` | `duration-200` |
| Box shadow | `[box-shadow:0_0_28px_-10px_#517987]` | none |
| Inner padding | `p-3` | `px-3 pt-3 pb-4` |
| Name size | `text-sm font-semibold` | unchanged |
| Title color | `text-white/80` | `text-white/60` |
| aria-label | name only | name + title |
| Stagger class | none | `teacher-card` + `--stagger-i` style |

**Initials fallback:**

Current: flat `bg-gray-600/50`  
Proposed: `bg-gradient-to-br from-green-900/60 to-gray-700/60` — minimal improvement, less abandoned-looking

### 4.7 TeacherCardSkeleton Match

Update skeleton to remove glow border (`border border-white/5` instead of green border) to match new card design.

---

## 5. Icon System

### 5.1 Strategy

No icon library. Follow the existing pattern in `MobileNav.tsx` (Material Symbols SVG paths inlined as component data). Create `src/components/icons/` for shared icon components.

### 5.2 ArrowLeftIcon

New file: `src/components/icons/ArrowLeftIcon.tsx`

SVG path sourced from Material Symbols (same viewport as MobileNav icons: `viewBox="0 -960 960 960"`):

```tsx
export function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 -960 960 960" className={className} aria-hidden="true" fill="currentColor">
      <path d="M400-80 0-480l400-400 71 71-329 329 329 329-71 71Z" />
    </svg>
  )
}
```

**Usage — teacher detail back link:**
```tsx
<Link href="/teachers" className="text-white/60 text-sm hover:text-white inline-flex items-center gap-1.5">
  <ArrowLeftIcon className="w-4 h-4" />
  Teachers
</Link>
```

**Usage — search page back link:** same pattern.

### 5.3 No other new icons needed

`SearchInput` already has an inline search SVG. `PlayPauseButton` has inline play/pause SVGs. `VolumeControl` has inline volume SVGs. `SleepTimerButton` has inline clock SVG. MobileNav has all nav icons. No additional icons needed for this scope.

---

## 6. File Change Summary

| File | Action | Change |
|---|---|---|
| `src/app/layout.tsx` | Modify | Add `Viewport` export with `viewportFit: 'cover'`; add `data-app` to body in app mode; app-mode `main` safe-bottom padding |
| `src/app/globals.css` | Modify | Safe-area vars; text-size-adjust; touch-action; overscroll; MediaBar animation; card-enter keyframe; page-enter keyframe; schedule-row class |
| `src/app/teachers/page.tsx` | Modify | Remove `TeacherGrid` async component; pass teachers array to `TeachersClientView`; read `searchParams` for initial query |
| `src/app/teachers/search/page.tsx` | Replace | Redirect to `/teachers` (with `?q=` passthrough) |
| `src/components/teachers/TeachersClientView.tsx` | **New** | Client component: live filter, SearchInput, count, URL sync |
| `src/components/teachers/TeacherCard.tsx` | Modify | Remove glow, faster hover, aria-label fix, spacing, stagger class |
| `src/components/teachers/SearchBar.tsx` | **Delete** | Replaced by SearchInput in TeachersClientView |
| `src/components/media-bar/MediaBar.tsx` | Modify | Slide-up animation; app-mode bottom offset |
| `src/components/home/TodaySchedule.tsx` | Modify | Stagger animation on rows |
| `src/components/icons/ArrowLeftIcon.tsx` | **New** | Material Symbol arrow-left SVG |
| `src/app/teachers/[slug]/page.tsx` | Modify | Use ArrowLeftIcon for back link |
| `src/components/skeletons/TeacherCardSkeleton.tsx` | Modify | Match new card border style |
| `src/app/about/page.tsx` | Modify | Add `page-enter` class to root div |
| `src/app/donate/page.tsx` | Modify | Add `page-enter` class to root div |

---

## 7. Out of Scope

- RadioPlayer layout redesign (separate concern)
- Mini-player webview variant
- CSS animation design token system
- Full icon component library
- `/scheduled-list` page changes
- Sleep timer page changes
