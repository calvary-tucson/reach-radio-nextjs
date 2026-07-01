# WCAG Light-Mode Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all WCAG 2.1 AA failures and light-mode visual breaks across every page of reach-radio-nextjs.

**Architecture:** The root cause is two systemic patterns — (1) `focus-visible:ring-white` used everywhere instead of a theme-aware token, and (2) `text-white` without `light:` guards on elements that render on white backgrounds in light mode. Fix the ring token first (one globals.css change unlocks all focus rings automatically), then sweep the remaining file-by-file issues in parallel clusters.

**Tech Stack:** Next.js 16 / React 19 / Tailwind 4 with `@custom-variant light/dark` — `light:` and `dark:` prefixes are project-custom and map to `.light`/`.dark` class on `<html>`. All theming via className; no CSS-in-JS.

## Global Constraints

- Never use raw hex/rgb — use design tokens (`var(--color-*)`, Tailwind color names, or the exact project hardcoded colors like `#0a1305`, `#84b84f`, `#a3d46a` that already exist)
- `light:` prefix is a custom Tailwind 4 variant — use it, not `dark:` inversion tricks
- `ring-ring` token = `var(--color-ring)` = after Task 1 = `green-700` (#4F712D) in light mode — use `ring-ring` for all focus indicators, never `ring-white`
- WCAG 2.1 AA: text contrast ≥ 4.5:1, non-text/focus contrast ≥ 3:1
- All buttons/clickables need `cursor-pointer` (already project rule — don't break)
- Touch target minimum: `h-11 w-11` (44px) for interactive controls
- `focus-visible:` not `focus:` for programmatic focus rings (per project pattern)
- Commit scope: use canonical scopes from AGENTS.md — `global`, `layout`, `player`, `teachers`, `about`, `modal`, `sleep-timer`

---

### Task 1: Light-Mode Ring Token

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `--color-ring` resolves to `#9CC671` (green-400) in dark mode and `#4F712D` (green-700, 6.6:1 on white) in light mode. All existing `focus-visible:ring-ring` consumers automatically get a WCAG-compliant ring in light mode.

This is the systemic root of all focus-indicator failures. Fixing it here means the remaining tasks only need to swap `ring-white` → `ring-ring`; no per-element `light:` overrides required.

- [ ] **Step 1: Add light-mode ring token override to globals.css**

Find the `:root` block (ends around line 34). Insert `.light` block immediately after it:

```css
:root {
  --color-brand-green: var(--color-green-500);
  --color-brand-purple: oklch(24% 0.05 280);
  --color-brand-gray: oklch(30% 0.02 280);
  --color-ring: var(--color-green-400);
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}

.light {
  --color-ring: var(--color-green-700);
}
```

- [ ] **Step 2: Lint + build**

```bash
npm run lint && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "fix(global): light-mode ring token — green-700 (#4F712D, 6.6:1 on white)"
```

---

### Task 2: Ring-White Sweep

Replace every `ring-white` (and `ring-white/50`, `ring-white/60`) with `ring-ring` across 10 files. Also add a missing focus ring to MobileHeader logo link, and fix TeacherCard's `light:focus-visible:ring-gray-400` (gray-400 = 2.6:1, below 3:1) to just `ring-ring`.

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/slider.tsx`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/MobileHeader.tsx`
- Modify: `src/components/global/PassiveSearchBar.tsx`
- Modify: `src/components/teachers/TeacherCard.tsx`
- Modify: `src/components/teachers/RecommendedTeachers.tsx`
- Modify: `src/components/teachers/TeacherDetailContent.tsx`
- Modify: `src/app/about/page.tsx`
- Modify: `src/app/donate/page.tsx`

**Interfaces:**
- Consumes: Task 1 (ring-ring token now high-contrast in light mode)

- [ ] **Step 1: button.tsx — swap base ring**

Line 9, change `focus-visible:ring-white` to `focus-visible:ring-ring`:

```
'inline-flex items-center justify-center rounded font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer disabled:pointer-events-none disabled:opacity-50',
```

- [ ] **Step 2: slider.tsx — swap thumb ring**

Line 19, change `focus-visible:ring-white` to `focus-visible:ring-ring`:

```tsx
<SliderPrimitive.Thumb className="block h-5 w-5 rounded-full bg-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
```

- [ ] **Step 3: Header.tsx — swap 3 ring-white instances**

Line 54 (logo link):
```
className="flex items-center w-[clamp(130px,16vw,186px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
```

Line 75 (nav link):
```
className="relative flex flex-col items-center justify-center h-16 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
```

Line 96 (Facebook icon link):
```
className="w-7 fill-slate-300 light:fill-gray-500 hover:fill-white light:hover:fill-gray-900 motion-safe:transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
```

- [ ] **Step 4: MobileHeader.tsx — add focus ring to logo link; swap Facebook ring**

Line 43 (logo Link — currently has NO focus ring):
```tsx
<Link href="/" aria-label="Reach Radio home" className="w-[clamp(180px,40vw,250px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded">
```

Line 58 (Facebook icon link):
```
className="w-8 fill-slate-300 light:fill-gray-500 hover:fill-white light:hover:fill-gray-900 motion-safe:transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
```

- [ ] **Step 5: PassiveSearchBar.tsx — swap ring + fix placeholder contrast**

Line 25, change `ring-white` to `ring-ring`:
```
'flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-white/10 light:border-gray-300 bg-white/5 light:bg-gray-50 px-4 py-3 motion-safe:transition-colors hover:bg-white/10 light:hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
```

Line 39 (search icon) and line 45 (placeholder span): gray-400 on gray-50 = 2.5:1, fails 4.5:1. Change `light:text-gray-400` to `light:text-gray-500` on both:
```tsx
className="text-white/40 light:text-gray-500 shrink-0"
```
```tsx
<span className="text-white/40 light:text-gray-500">{placeholder}</span>
```

- [ ] **Step 6: TeacherCard.tsx — replace ring-white + weak gray-400 ring with ring-ring**

Line 42, change `focus-visible:ring-white light:focus-visible:ring-gray-400` to just `focus-visible:ring-ring`:
```
className="teacher-card block rounded-[18px] overflow-hidden bg-[#1c2128] light:bg-white border border-white/5 light:border-gray-200 motion-safe:hover:scale-[1.03] motion-safe:transition-all duration-200 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
```

- [ ] **Step 7: RecommendedTeachers.tsx — swap ring**

Line 31, change `ring-white` to `ring-ring`:
```
className="flex flex-col items-center gap-[5px] md:gap-2 flex-shrink-0 w-[72px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
```

- [ ] **Step 8: TeacherDetailContent.tsx — swap ring on both elements**

Line 138, change `ring-white/60` to `ring-ring`:
```
className="bg-white/10 light:bg-gray-100 border border-white/20 light:border-gray-300 rounded-full px-4 py-2 text-sm font-semibold text-white/80 light:text-gray-700 hover:bg-white/15 light:hover:bg-gray-200 hover:text-white light:hover:text-gray-900 motion-safe:transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
```

Line 191, change `ring-white` to `ring-ring`:
```
className="flex flex-col items-center gap-[4px] md:gap-2 flex-shrink-0 w-[72px] md:w-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer"
```

- [ ] **Step 9: about/page.tsx — swap 2 instances of ring-white/50**

Lines 90 and 129 (app store badge links), change `ring-white/50` to `ring-ring`:
```
className="inline-block hover:opacity-80 motion-safe:transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
```

- [ ] **Step 10: donate/page.tsx — swap ring**

Line 136, change `ring-white` to `ring-ring`:
```tsx
className={`w-full min-h-[1300px] md:min-h-[1200px] border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${loaded ? 'block' : 'hidden'}`}
```

- [ ] **Step 11: Lint + build**

```bash
npm run lint && npm run build
```

Expected: no errors.

- [ ] **Step 12: Visual check — focus rings + ring cascade verification**

Start dev server (`npm run dev`), toggle to light mode. Tab through:
- Home page nav links (desktop)
- MobileHeader logo (mobile)
- Teachers search bar
- About page app store badges
- Donate page iframe

Focus ring should appear as dark green on all light surfaces.

**Ring cascade check (DevTools):** Focus any `ring-ring` element (e.g. a nav link). Open DevTools → Computed → search `--tw-ring-color`. In light mode it should resolve to `#4F712D` (green-700). In dark mode, `#9CC671` (green-400). If it doesn't change by mode, `ring-ring` is compiled as a static value rather than `var(--color-ring)`. Fix: move `--color-ring` out of `:root` and into `@theme` in globals.css so Tailwind emits `var(--color-ring)` in the utility:
```css
@theme {
  /* add after other @theme tokens */
  --color-ring: var(--color-green-400);
}
/* remove --color-ring from :root; keep .light override */
.light { --color-ring: var(--color-green-700); }
```

- [ ] **Step 13: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/slider.tsx \
  src/components/layout/Header.tsx src/components/layout/MobileHeader.tsx \
  src/components/global/PassiveSearchBar.tsx \
  src/components/teachers/TeacherCard.tsx \
  src/components/teachers/RecommendedTeachers.tsx \
  src/components/teachers/TeacherDetailContent.tsx \
  src/app/about/page.tsx src/app/donate/page.tsx
git commit -m "fix(global): replace ring-white with ring-ring across all components"
```

---

### Task 3: Privacy Policy + Error Pages

Fix the most user-visible WCAG 1.4.3 failures: privacy policy text invisible in light mode, and error page text invisible in light mode.

**Files:**
- Modify: `src/app/about/privacy-policy/page.tsx`
- Modify: `src/app/error.tsx`
- Modify: `src/app/about/error.tsx`
- Modify: `src/app/teachers/error.tsx`
- Modify: `src/app/teachers/search/error.tsx`
- Modify: `src/app/teachers/[slug]/error.tsx`

**Interfaces:**
- Produces: Privacy policy readable in both themes. Error pages readable in both themes.

- [ ] **Step 1: Privacy policy — conditional prose-invert**

`src/app/about/privacy-policy/page.tsx` line 28:

Change:
```tsx
<div className="prose prose-invert max-w-none">
```
To:
```tsx
<div className="prose dark:prose-invert max-w-none">
```

This is the user-reported critical issue. `prose-invert` forces white text unconditionally; `dark:prose-invert` applies it only when `.dark` is on `<html>`.

- [ ] **Step 2: Root error.tsx — add light variants**

`src/app/error.tsx` lines 17–18:

Change:
```tsx
<h1 className="text-2xl font-bold text-white">Something went wrong</h1>
<p className="text-white/60 max-w-sm">
```
To:
```tsx
<h1 className="text-2xl font-bold text-white light:text-gray-900">Something went wrong</h1>
<p className="text-white/60 light:text-gray-600 max-w-sm">
```

Note: The button on line 23 already uses `text-[#0a1305]` — correct, no change needed.

- [ ] **Step 3: about/error.tsx, teachers/error.tsx, teachers/search/error.tsx, teachers/[slug]/error.tsx — same pattern for all 4**

All four files share identical structure. Apply same changes to each:

Message paragraph (line 6 in each):
```tsx
<p className="text-white/80 light:text-gray-700 mb-3">...</p>
```

Retry button (line 10 in each):
```tsx
<button onClick={reset} className="text-sm text-white light:text-gray-900 underline cursor-pointer">
```

- [ ] **Step 4: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 5: Visual check**

In light mode:
- Navigate to `/about/privacy-policy` — policy text should be dark and readable
- Trigger an error state (can't be simulated without a real error; verify by reading the className in source — trust the fix)

- [ ] **Step 6: Commit**

```bash
git add src/app/about/privacy-policy/page.tsx \
  src/app/error.tsx \
  src/app/about/error.tsx \
  src/app/teachers/error.tsx \
  src/app/teachers/search/error.tsx \
  "src/app/teachers/[slug]/error.tsx"
git commit -m "fix(about): prose-invert conditional on dark theme; fix error page text in light mode"
```

---

### Task 4: Green Contrast Fixes

Three components use white text or white icons on brand-green (#84B84F), yielding 2.3:1 — fails WCAG 4.5:1 for text and 3:1 for non-text. The fix in all cases is `#0a1305` (very dark green, ~5:1 on brand-green, existing project pattern confirmed in About hero cards and root error.tsx button).

**Files:**
- Modify: `src/components/theme/ThemeToggle.tsx`
- Modify: `src/components/about/ContactForm.tsx`
- Modify: `src/components/media-bar/PlayPauseButton.tsx`

**Interfaces:**
- Produces: All elements using brand-green background render legible content in both themes.

- [ ] **Step 1: ThemeToggle.tsx — dark text on active green pill**

Line 29, change `text-white` to `text-[#0a1305]`:
```tsx
theme === value
  ? 'bg-[#84b84f] text-[#0a1305]'
  : 'text-white/60 hover:text-white/90 light:text-gray-500 light:hover:text-gray-900'
```

- [ ] **Step 2: ContactForm.tsx — dark text + touch target + focus ring on submit button**

Line 65–68, replace:
```tsx
<button
  type="submit" disabled={isPending}
  className="bg-[var(--color-brand-green)] text-white px-6 py-2 rounded font-medium text-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
>
```
With:
```tsx
<button
  type="submit" disabled={isPending}
  className="bg-[var(--color-brand-green)] text-[#0a1305] px-6 py-3 min-h-[44px] rounded font-medium text-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
>
```

Changes: `text-white` → `text-[#0a1305]`, `py-2` → `py-3 min-h-[44px]` (≥44px touch target), added `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`.

- [ ] **Step 2a: ContactForm.tsx — fix input focus rings (lines 40, 47, 54)**

All three inputs (`name`, `email`, `message`) use `focus:ring-1 focus:ring-white light:focus:ring-gray-400`. Two failures: `focus:` shows ring on mouse click (use `focus-visible:`), and `gray-400` on a white input = 2.6:1 (fails 3:1).

Replace `focus:ring-1 focus:ring-white light:focus:ring-gray-400` with `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` on the `name` input (line 40), `email` input (line 47), and `message` textarea (line 54). Also remove any standalone `outline-none` that may already be present (replace entire focus block).

Example for name input:
```tsx
<input
  id="name"
  name="name"
  type="text"
  required
  className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
/>
```
Apply same `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` substitution to email and message fields.

- [ ] **Step 3: PlayPauseButton.tsx — dark icon on green button**

**Note:** This changes the play/pause icon from white to dark-green in BOTH light and dark modes (button background is always brand-green). Dark-mode appearance changes from white-on-green to dark-green-on-green. Both pass WCAG at ~5:1 contrast. If you prefer to keep white icon in dark mode, alternative is to add `light:` prefix — but existing project pattern (`#0a1305` on green in About cards) doesn't distinguish by theme. Proceed with unified fix unless directed otherwise.

Lines 43, 47, 49 — change white elements to `#0a1305`:

```tsx
{isBuffering ? (
  <span
    role="status"
    aria-label="Buffering"
    className={`border-2 border-[#0a1305] border-t-transparent rounded-full motion-safe:animate-spin`}
    style={{ width: iconSize, height: iconSize }}
  />
) : isPlaying ? (
  <Pause size={iconSize} className="fill-[#0a1305]" strokeWidth={0} />
) : (
  <Play size={iconSize} className="fill-[#0a1305]" strokeWidth={0} />
)}
```

- [ ] **Step 4: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 5: Visual check**

In both light AND dark mode:
- Footer → ThemeToggle: active pill should show dark green text on light green bg
- About page → Contact form: Send Message button should show dark text on green
- Media bar: play/pause icon should be dark green on green button (both modes)

- [ ] **Step 6: Commit**

```bash
git add src/components/theme/ThemeToggle.tsx \
  src/components/about/ContactForm.tsx \
  src/components/media-bar/PlayPauseButton.tsx
git commit -m "fix(global): white-on-green contrast — switch to text-[#0a1305] on brand-green backgrounds"
```

---

### Task 5: button.tsx Ghost Variant + dialog.tsx + slider.tsx Light Variants

Three shared UI primitives have light-mode failures:
- `button.tsx` ghost variant: white text on white body in light mode → invisible
- `dialog.tsx`: hardcoded dark card that doesn't adapt to light mode (portaled to `<body>`)
- `slider.tsx`: white track/thumb on near-white light-mode surface → effectively invisible

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/slider.tsx`

**Interfaces:**
- Produces: Ghost buttons readable in light mode; dialog cards adapt to light bg; volume slider visible and operable in light mode.

- [ ] **Step 1: button.tsx — ghost variant light-mode text + hover**

Line 15:
```
ghost: 'text-white light:text-gray-900 hover:bg-white/10 light:hover:bg-black/5',
```

- [ ] **Step 2: dialog.tsx — DialogContent light bg + border**

Line 35, `bg-gray-800` → add light variants:
```
'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl bg-gray-800 light:bg-white light:border light:border-gray-200 p-6 shadow-lg motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=closed]:zoom-out-95 motion-safe:data-[state=open]:zoom-in-95',
```

- [ ] **Step 3: dialog.tsx — DialogTitle light text**

Line 57:
```tsx
className={cn('text-lg font-semibold text-white light:text-gray-900', className)}
```

- [ ] **Step 4: dialog.tsx — DialogDescription light text**

Line 69:
```tsx
className={cn('text-sm text-white/60 light:text-gray-500', className)}
```

- [ ] **Step 5: slider.tsx — track, range, and thumb light-mode colors**

The slider is used in `VolumeControl` which lives in the media player (dark bg). However, it must also not fail if ever rendered in light context. Apply `light:` variants:

```tsx
<SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-white/20 light:bg-gray-300">
  <SliderPrimitive.Range className="absolute h-full bg-white light:bg-gray-700" />
</SliderPrimitive.Track>
<SliderPrimitive.Thumb className="block h-5 w-5 rounded-full bg-white light:bg-gray-800 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
```

- [ ] **Step 6: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 7: Visual check**

In light mode:
- Toggle media bar volume slider — should have visible gray track and dark thumb
- Check any ghost buttons (if any render in light context)
- Note: Dialog is not used in any current page flow; verify by grepping for `<Dialog` in pages — if no light-mode page uses it, the fix is still correct for future use

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/dialog.tsx src/components/ui/slider.tsx
git commit -m "fix(global): light-mode variants for ghost button, dialog, and slider primitives"
```

---

### Task 6: Skeleton + Loading State Light Fixes

Three skeleton/loading files use `bg-[#252b32]` (dark charcoal) with no `light:` variant. In light mode these render as dark blocks on a white page, making the loading state look broken.

**Files:**
- Modify: `src/app/teachers/loading.tsx`
- Modify: `src/components/skeletons/ScheduleTabSkeleton.tsx`
- Modify: `src/components/skeletons/RecommendedTeachersSkeleton.tsx`

**Interfaces:**
- Produces: Skeletons render as gray blocks in light mode (matching `TeacherCardSkeleton` and `AboutPageSkeleton` which already implement this pattern correctly).

Reference pattern from `TeacherCardSkeleton.tsx` (already correct):
```tsx
<div className="bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded ..." />
```

- [ ] **Step 1: ScheduleTabSkeleton.tsx**

Line 2:
```tsx
return <div className={`bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded ${className}`} />
```

- [ ] **Step 2: RecommendedTeachersSkeleton.tsx**

Line 2:
```tsx
return <div className={`bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded ${className}`} />
```

- [ ] **Step 3: teachers/loading.tsx — add light variants to all 5 dark blocks**

Lines 5, 17, 18, 26 (SearchBarSkeleton + page header bars + "all teachers" label):
Add `light:bg-gray-200` to each `bg-[#252b32]`:
```tsx
function SearchBarSkeleton() {
  return <div className="h-[42px] bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded-[14px] mx-4 mb-3" />
}
```

Page header bars (lines 17, 18):
```tsx
<div className="h-[22px] md:h-8 w-[90px] md:w-36 bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded" />
<div className="h-[11px] md:h-4 w-[60px] bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded" />
```

All-teachers label (line 26):
```tsx
<div className="h-[9px] w-[90px] bg-[#252b32] light:bg-gray-200 motion-safe:animate-pulse rounded mb-[10px]" />
```

Line 9 (TabBarSkeleton) — also fix the border and bg:
```tsx
function TabBarSkeleton() {
  return <div className="h-[34px] bg-[#252b32]/30 light:bg-gray-200/50 motion-safe:animate-pulse border-b border-white/7 light:border-gray-200 mb-[10px]" />
}
```

- [ ] **Step 4: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 5: Visual check**

In light mode, navigate to `/teachers`. While the page loads (or using Suspense boundary — hard to observe in fast local dev; slow network throttle in DevTools helps), skeleton blocks should appear gray, not dark charcoal.

- [ ] **Step 6: Commit**

```bash
git add src/app/teachers/loading.tsx \
  src/components/skeletons/ScheduleTabSkeleton.tsx \
  src/components/skeletons/RecommendedTeachersSkeleton.tsx
git commit -m "fix(teachers): light-mode colors for skeleton/loading states"
```

---

### Task 7: Visual Chrome — TeacherCard + SleepTimerSheet + Header Contact + ChromeFallback

Four visual issues that cause broken affordance or flash in light mode.

**Files:**
- Modify: `src/components/teachers/TeacherCard.tsx`
- Modify: `src/components/home/SleepTimerSheet.tsx`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/MobileHeader.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: TeacherCard avatar well neutral in light mode; SleepTimer buttons have visible borders/bg in light mode; Contact button has border on white header; ChromeFallback doesn't flash dark purple in light mode.

- [ ] **Step 1: TeacherCard.tsx — avatar gradient + schedule-days text**

Line 23 (avatar well — dark gradient that bleeds through on missing/loading images):
```tsx
<div className="relative aspect-square bg-gradient-to-br from-[#253520] to-[#131b0d] light:from-gray-100 light:to-gray-200">
```

Lines 59–63 (schedule-days icon + text — `#a3d46a` = 1.9:1 on white card):
```tsx
<CalendarDays className="h-[13px] w-[13px] md:h-[13px] md:w-[13px] text-[#a3d46a] light:text-green-700 shrink-0" aria-hidden="true" />
<span className="text-[10px] md:text-[10px] text-[#a3d46a] light:text-green-700 font-medium leading-none uppercase tracking-wide">
```

`green-700` = `#4F712D` = 6.6:1 on white. On the dark card (#1c2128): `#a3d46a` stays (existing behavior, readable in dark).

- [ ] **Step 2: SleepTimerSheet.tsx — button affordance in light mode**

The timer option buttons and active-timer Pause/Cancel buttons have `bg-white/5 border-white/10` which is invisible in light mode (sheet is `light:bg-white`). Text already has `light:text-gray-900` so labels are visible, but button boundary is lost.

Line 85 (Pause/Resume button):
```
className="w-full bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 text-white light:text-gray-900 py-4 rounded-xl font-semibold text-lg hover:bg-white/10 light:hover:bg-gray-100 motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
```

Line 92 (Cancel Timer button):
```
className="w-full bg-white/5 light:bg-red-50 border border-red-500/30 text-red-400 light:text-red-600 py-4 rounded-xl font-semibold text-lg hover:bg-red-500/10 light:hover:bg-red-100 motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
```

Line 105 (timer option buttons):
```
className="bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 text-white light:text-gray-900 py-5 rounded-xl font-semibold text-lg hover:bg-white/10 light:hover:bg-gray-100 motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
```

- [ ] **Step 3: Header.tsx — Contact button visible on white header**

The Contact button (`bg-white text-black`) loses all shape on `light:bg-white` header. Add a border for light mode (line 103–108):
```tsx
<Link
  href="/about#aboutGotQuestions"
  className="flex items-center px-3 py-1.5 bg-white light:border light:border-gray-800 rounded text-black font-bold text-sm hover:bg-gray-100 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
>
  Contact
</Link>
```

- [ ] **Step 4: MobileHeader.tsx — Contact button visible on white header**

Same issue, same fix (line 65–70):
```tsx
<Link
  href="/about#aboutGotQuestions"
  className="flex items-center px-2 py-1 bg-white light:border light:border-gray-800 rounded text-black font-bold text-sm hover:bg-gray-100 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
>
  Contact
</Link>
```

- [ ] **Step 5: layout.tsx — ChromeFallback no purple flash in light mode**

`ChromeFallback` is the SSR suspense fallback for the header. It currently shows dark purple in light mode during the initial paint. Line 101:
```tsx
className="fixed top-0 left-0 right-0 h-16 bg-[var(--color-brand-purple)] light:bg-white border-b border-white/10 light:border-gray-200 z-40"
```

- [ ] **Step 6: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 7: Visual check**

In light mode:
- `/teachers` — TeacherCard avatar wells should be gray-gradient, schedule-days text should be dark green
- Home → open Sleep Timer (tap the moon icon in media bar) — sheet buttons should have visible gray borders
- Desktop header → Contact button should have a visible dark outline
- Hard-reload in light mode → no purple flash at top of page

- [ ] **Step 8: Commit**

```bash
git add src/components/teachers/TeacherCard.tsx \
  src/components/home/SleepTimerSheet.tsx \
  src/components/layout/Header.tsx \
  src/components/layout/MobileHeader.tsx \
  src/app/layout.tsx
git commit -m "fix(layout): light-mode visual chrome — Contact button border, ChromeFallback, TeacherCard, SleepTimerSheet buttons"
```

---

### Task 8: TodaySchedule Image URL Performance Fix

`TodaySchedule.tsx` manually appends `?w=420&fm=webp` to Sanity image URLs before passing to `next/image`. Next.js appends its own `&w=<n>&q=75`, creating conflicting double `w=` params and a redundant format hint. The manual override also defeats the responsive srcset.

**Files:**
- Modify: `src/components/home/TodaySchedule.tsx`

**Interfaces:**
- Produces: `next/image` owns all URL parameters for Sanity images; srcset generated correctly.

- [ ] **Step 1: Find the two occurrences**

```bash
grep -n "fm=webp\|w=420" src/components/home/TodaySchedule.tsx
```

Expected output: lines 80 and 121.

- [ ] **Step 2: Line 80 — empty state / music image**

Find:
```tsx
src={MUSIC_IMAGE + '?w=420&fm=webp'}
```

Change to:
```tsx
src={MUSIC_IMAGE}
```

- [ ] **Step 3: Line 121 — schedule item photo**

Find:
```tsx
const photoSrc = (item.photo || MUSIC_IMAGE) + '?w=420&fm=webp'
```

Change to:
```tsx
const photoSrc = item.photo || MUSIC_IMAGE
```

- [ ] **Step 4: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 5: Visual check**

Home page — schedule row images should still load (verify in browser Network tab that images load without `fm=webp` in the final URL, and next/image generates a proper srcset).

- [ ] **Step 6: Run unit tests**

```bash
npm run test
```

Expected: all pass (no tests directly test TodaySchedule image URLs, but confirms no regressions).

- [ ] **Step 7: Commit**

```bash
git add src/components/home/TodaySchedule.tsx
git commit -m "perf(layout): remove manual Sanity image params — let next/image own srcset generation"
```

---

## Final Verification

After all tasks are committed:

- [ ] **Full build**

```bash
npm run build
```

Expected: no errors, no TypeScript errors.

- [ ] **Unit tests**

```bash
npm run test
```

Expected: all pass.

- [ ] **Light-mode walkthrough** (go through each page with light mode active)

| Page | Check |
|------|-------|
| `/` | Media bar play button icon dark; schedule row images load; SleepTimer sheet buttons have borders |
| `/teachers` | TeacherCard schedule-days dark green; avatar wells gray; loading skeleton gray |
| `/teachers/[slug]` | External-link chips have focus ring; related-teacher links have ring |
| `/teachers/search` | Search bar focus ring visible |
| `/about` | Contact form Send button dark text; App Store badge focus ring; contact button on header has border |
| `/about/privacy-policy` | All text readable (dark on white) |
| `/donate` | Iframe focus ring visible |
| Footer | ThemeToggle active pill dark text on green |

- [ ] **Dark-mode regression check** — toggle back to dark and walk same pages

Verify nothing is broken. `light:` classes should have no effect in dark mode.
