# Sleep Timer Active-State UI Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sleep timer's active state clearer and more polished — a labeled, fading-in countdown overlay on the Listen page, and a persistent indicator in the bottom media bar so users still see it's running once they scroll away or navigate to another page.

**Architecture:** Two independent, additive UI changes to existing sleep-timer surfaces. Task 1 enhances `SleepTimerOverlay` (already rendered on the Listen page inside `RadioPlayer`) with a visual label and an entrance fade-in, using the `tw-animate-css` utility classes already used by `TooltipContent`. Task 2 adds a new `SleepTimerIndicator` component to `MediaBar` that renders only while `sleepTimerActive` is true and opens the existing `SleepTimerSheet` on tap — mirroring `SleepTimerButton`'s pattern but conditionally rendered and sized for the compact bar.

**Tech Stack:** Next.js 16 / React 19, Zustand (`useMediaStore`), Tailwind CSS v4 + `tw-animate-css`, Radix `Tooltip`, Vitest + React Testing Library, Playwright (existing e2e coverage untouched).

## Prerequisite

✅ Done. The `z-10`→`z-20` stacking fix for the countdown-overlay-hidden-behind-album-art regression and its e2e regression test were committed separately, before this plan, as `ce3d8f8 fix(player): fix sleep timer countdown overlay hidden behind album art`. Task 1's replacement block below applies against that fixed `z-20` version.

## Global Constraints

- TypeScript strict mode; no `any` (per `~/.claude/rules/typescript.md`).
- Icon-only buttons require `aria-label` (AGENTS.md a11y rules).
- Mobile interactive elements need a minimum `h-11 w-11` (44px) touch target (AGENTS.md).
- All animations must be wrapped in the `motion-safe:` variant (AGENTS.md) — never animate unconditionally.
- All clickable elements need `cursor-pointer`; disabled ones need `cursor-not-allowed` (AGENTS.md).
- Focus-visible elements need `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` (AGENTS.md).
- Commit scope for both tasks is `player` per AGENTS.md's canonical scope table ("RadioPlayer, AudioProvider, MediaBar, volume, sleep timer UI").
- Use the `@/` path alias for all imports.
- TDD: write the failing test before the implementation for every step below.
- After each task, run `npm test`, `npx tsc --noEmit`, and `npm run lint` — all three must be clean before committing.

---

## File Structure

- `src/components/home/SleepTimerOverlay.tsx` — **modify**. Add a decorative "Sleep Timer" label above the countdown and an entrance fade-in animation on the dialog container.
- `tests/unit/sleep-timer-overlay.test.tsx` — **create**. First unit test coverage for this component (none exists today); covers the new label/animation plus baseline show/hide behavior.
- `src/components/media-bar/SleepTimerIndicator.tsx` — **create**. Icon-only button, visible only when `sleepTimerActive`, opens `SleepTimerSheet` on tap. Mirrors `SleepTimerButton.tsx`'s Tooltip + sheet-toggle pattern but conditionally rendered and without the persistent "inactive" state (the bar should show nothing at all when no timer is running, to avoid clutter).
- `tests/unit/sleep-timer-indicator.test.tsx` — **create**. Covers hidden-when-inactive, visible-with-correct-label-when-active, and opens-sheet-on-click.
- `src/components/media-bar/MediaBar.tsx` — **modify**. Render `SleepTimerIndicator` after `PlayPauseButton`, matching the order used in `RadioPlayer.tsx` (`PlayPauseButton` then `SleepTimerButton`).
- `tests/unit/media-bar.test.tsx` — **create**. First direct unit test for `MediaBar` (none exists today); confirms the indicator only appears when a timer is active.

---

### Task 1: Label and fade-in for the Listen-page countdown overlay

**Files:**
- Modify: `src/components/home/SleepTimerOverlay.tsx:49-73`
- Test: `tests/unit/sleep-timer-overlay.test.tsx` (create)

**Interfaces:**
- Consumes: `useMediaStore` selectors `sleepTimerActive`, `remainingSleepSeconds`, `cancelSleepTimer` (all already defined in `src/lib/store/media-store.ts` — unchanged by this task).
- Produces: nothing new consumed by later tasks — this task is self-contained.

**Design decision (entrance-only animation):** This app has no unmount-presence library (no Framer Motion, no Radix `Presence`/`forceMount` wiring on this element). Animating the *exit* would require keeping the node mounted during fade-out, which means introducing a delayed-unmount state machine — out of scope for a polish pass. `tw-animate-css`'s `animate-in` utility (already used in `TooltipContent`, see `src/components/ui/tooltip.tsx:20`) fires automatically on mount with no extra state, so this task adds an entrance fade only. The overlay still disappears instantly on cancel/expiry, which is fine — that's a deliberate user action, not something that benefits from a fade.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sleep-timer-overlay.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SleepTimerOverlay } from '@/components/home/SleepTimerOverlay'
import { useMediaStore } from '@/lib/store/media-store'

beforeEach(() => {
  useMediaStore.setState({
    sleepTimerActive: false,
    sleepTimerPaused: false,
    remainingSleepSeconds: 0,
    sleepTimerEndsAt: null,
  })
})

describe('SleepTimerOverlay', () => {
  it('renders nothing when the timer is not active', () => {
    render(<SleepTimerOverlay />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the formatted countdown when active', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 125 })
    render(<SleepTimerOverlay />)
    expect(screen.getByText('02:05')).toBeInTheDocument()
  })

  it('shows a "Sleep Timer" label when active', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 125 })
    render(<SleepTimerOverlay />)
    expect(screen.getByText('Sleep Timer')).toBeInTheDocument()
  })

  it('applies an entrance fade-in animation to the dialog', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 125 })
    render(<SleepTimerOverlay />)
    expect(screen.getByRole('dialog')).toHaveClass('motion-safe:animate-in', 'motion-safe:fade-in-0')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/sleep-timer-overlay.test.tsx`
Expected: FAIL — `getByText('Sleep Timer')` finds nothing and `toHaveClass('motion-safe:animate-in', ...)` fails, since neither exists yet on the current component.

- [ ] **Step 3: Implement the label and fade-in**

Replace the `return` block in `src/components/home/SleepTimerOverlay.tsx` (currently lines 49-73) with:

```tsx
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sleep timer active"
      className="absolute inset-0 z-20 bg-black/80 rounded flex flex-col items-center justify-center gap-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
    >
      <div className="flex flex-col items-center gap-1">
        <p aria-hidden="true" className="text-amber-400 text-xs font-semibold uppercase tracking-wide">
          Sleep Timer
        </p>
        <p
          className="text-white text-4xl font-mono"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`${minutes} minute${minutes !== 1 ? 's' : ''} ${secs} seconds remaining`}
        >
          {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </p>
      </div>
      <button
        ref={cancelBtnRef}
        onClick={cancel}
        aria-label="Cancel sleep timer"
        className="bg-white/20 text-white px-4 py-3 min-h-[44px] min-w-[88px] rounded text-sm hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 cursor-pointer"
      >
        Cancel
      </button>
    </div>
  )
```

The "Sleep Timer" label is `aria-hidden="true"` because the dialog's `aria-label="Sleep timer active"` and the countdown's own `aria-label` already give screen reader users the full picture — this label is a purely visual cue for sighted users glancing at the overlay without context.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/sleep-timer-overlay.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full unit suite and typecheck**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass, no new failures (331+4 unit tests, clean typecheck, clean lint)

- [ ] **Step 6: Commit**

```bash
git add src/components/home/SleepTimerOverlay.tsx tests/unit/sleep-timer-overlay.test.tsx
git commit -m "feat(player): label and fade in the sleep timer countdown overlay"
```

---

### Task 2: Sleep timer indicator in the bottom media bar

**Files:**
- Create: `src/components/media-bar/SleepTimerIndicator.tsx`
- Test: `tests/unit/sleep-timer-indicator.test.tsx` (create)
- Modify: `src/components/media-bar/MediaBar.tsx:1-29`
- Test: `tests/unit/media-bar.test.tsx` (create)

**Interfaces:**
- Consumes: `useMediaStore` selectors `sleepTimerActive`, `remainingSleepSeconds` (existing, unchanged); `SleepTimerSheet` from `@/components/home/SleepTimerSheet` with props `{ open: boolean, onClose: () => void }` (existing, unchanged, see `src/components/home/SleepTimerSheet.tsx:12-17`); `MoonZzzIcon` from `@/components/icons/MoonZzzIcon` (existing); `Tooltip`/`TooltipTrigger`/`TooltipContent` from `@/components/ui/tooltip` (existing, already available app-wide via the root `TooltipProvider` in `src/app/layout.tsx:158`).
- Produces: `SleepTimerIndicator` — a zero-prop component, default export not used (named export, matching every other component in this codebase). Renders `null` when `sleepTimerActive` is `false`.

**Design decision (icon-only, no visible countdown number):** The bar's job is a lightweight "something's about to happen" signal, not a second live-updating countdown next to the one already on the Listen page overlay — two independently-ticking timers on screen at once would be visual noise and a maintenance headache to keep in sync. The button's `aria-label` includes the rounded-up remaining minutes for screen reader users and the tooltip text; sighted users get the same info by tapping through to the sheet, which already shows the full countdown.

**Verified non-issue (sheet nesting under `inert`):** `SleepTimerIndicator` renders `<SleepTimerSheet>` as a React child, and `MediaBar`'s root `<div>` carries `inert={!showMediaBar}` / `data-hidden` (`MediaBar.tsx:19,22`) — opening the sheet calls `useHideMediaBarWhileOpen` which sets `showMediaBar: false`, so at first glance the sheet looks like it'd go inert along with the bar that spawned it. It doesn't: `BottomSheet` renders via `createPortal(..., document.body)` (`src/components/global/BottomSheet.tsx:104`), so in the actual DOM the sheet is a sibling of `<body>`'s other children, not a descendant of the MediaBar div — `inert` never reaches it. This is invisible to jsdom-based unit tests (jsdom doesn't enforce `inert` or compute `data-hidden` CSS either way), which is exactly the kind of gap that let the original overlay z-index regression through — see Step 10 below and the e2e addition in Step 9.

- [ ] **Step 1: Write the failing test for `SleepTimerIndicator`**

Create `tests/unit/sleep-timer-indicator.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SleepTimerIndicator } from '@/components/media-bar/SleepTimerIndicator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  }),
}))

function renderWithProvider() {
  return render(
    <TooltipProvider>
      <SleepTimerIndicator />
    </TooltipProvider>
  )
}

beforeEach(() => {
  useMediaStore.setState({
    sleepTimerActive: false,
    sleepTimerPaused: false,
    remainingSleepSeconds: 0,
    sleepTimerEndsAt: null,
  })
})

describe('SleepTimerIndicator', () => {
  it('renders nothing when no sleep timer is active', () => {
    renderWithProvider()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a button labeled with the remaining minutes when active', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 305 })
    renderWithProvider()
    expect(screen.getByRole('button', { name: /sleep timer active, 6 minutes remaining/i })).toBeInTheDocument()
  })

  it('opens the sleep timer sheet when clicked', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 60 })
    renderWithProvider()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/sleep-timer-indicator.test.tsx`
Expected: FAIL — module `@/components/media-bar/SleepTimerIndicator` does not exist yet.

- [ ] **Step 3: Implement `SleepTimerIndicator`**

Create `src/components/media-bar/SleepTimerIndicator.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { MoonZzzIcon } from '@/components/icons/MoonZzzIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMediaStore } from '@/lib/store/media-store'
import { SleepTimerSheet } from '@/components/home/SleepTimerSheet'

export function SleepTimerIndicator() {
  const [open, setOpen] = useState(false)
  const sleepTimerActive = useMediaStore((s) => s.sleepTimerActive)
  const remainingSleepSeconds = useMediaStore((s) => s.remainingSleepSeconds)

  if (!sleepTimerActive) return null

  const minutes = Math.max(1, Math.ceil(remainingSleepSeconds / 60))

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Sleep timer active, ${minutes} minute${minutes !== 1 ? 's' : ''} remaining`}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="rounded-full w-11 h-11 flex items-center justify-center flex-shrink-0 cursor-pointer bg-amber-500 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <MoonZzzIcon className="w-5 h-5 text-white" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Sleep Timer (Active)</TooltipContent>
      </Tooltip>
      <SleepTimerSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/sleep-timer-indicator.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for `MediaBar` wiring**

Create `tests/unit/media-bar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MediaBar } from '@/components/media-bar/MediaBar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  }),
}))

function renderWithProvider() {
  return render(
    <TooltipProvider>
      <MediaBar />
    </TooltipProvider>
  )
}

beforeEach(() => {
  useMediaStore.setState({
    showMediaBar: true,
    sleepTimerActive: false,
    sleepTimerPaused: false,
    remainingSleepSeconds: 0,
    sleepTimerEndsAt: null,
  })
})

describe('MediaBar — sleep timer indicator', () => {
  it('does not show a sleep timer indicator when no timer is active', () => {
    renderWithProvider()
    expect(screen.queryByRole('button', { name: /sleep timer/i })).not.toBeInTheDocument()
  })

  it('shows a sleep timer indicator when a timer is active', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 120 })
    renderWithProvider()
    expect(screen.getByRole('button', { name: /sleep timer active/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run tests/unit/media-bar.test.tsx`
Expected: FAIL — the second test can't find a "sleep timer" button since `MediaBar` doesn't render `SleepTimerIndicator` yet.

- [ ] **Step 7: Wire `SleepTimerIndicator` into `MediaBar`**

In `src/components/media-bar/MediaBar.tsx`, add the import and render it after `PlayPauseButton` (matching `RadioPlayer.tsx`'s `PlayPauseButton` → `SleepTimerButton` order):

```tsx
'use client'

import { usePathname } from 'next/navigation'
import { useMediaStore } from '@/lib/store/media-store'
import { PlayPauseButton } from './PlayPauseButton'
import { NowPlayingInfo } from './NowPlayingInfo'
import { SleepTimerIndicator } from './SleepTimerIndicator'
import { isTeacherDetailPath } from '@/lib/routes'

export function MediaBar() {
  const pathname = usePathname()
  const showMediaBar = useMediaStore((s) => s.showMediaBar)

  if (isTeacherDetailPath(pathname)) return null

  return (
    <div
      role="region"
      aria-label="Media player"
      inert={!showMediaBar}
      data-web-chrome=""
      data-media-bar=""
      data-hidden={!showMediaBar ? '' : undefined}
      className="fixed bottom-[72px] md:bottom-0 left-0 right-0 bg-[var(--color-brand-gray)] light:bg-gray-100 border-t border-white/10 light:border-gray-200 px-4 py-3 flex items-center gap-3 z-50"
    >
      <NowPlayingInfo />
      <PlayPauseButton />
      <SleepTimerIndicator />
    </div>
  )
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run tests/unit/media-bar.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 9: Extend the e2e sleep timer spec to cover the real-DOM path unit tests can't**

The `inert`/portal interaction from the "Verified non-issue" note above, and whether the indicator is actually paintable (not just present in the accessibility tree — the same class of bug fixed in `tests/e2e/sleep-timer.spec.ts`), can only be verified with real layout and a real DOM. Append this test to `tests/e2e/sleep-timer.spec.ts`:

```ts
test('media bar shows a sleep timer indicator once the player scrolls out of view', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Sleep timer', exact: true }).click()
  await page.getByRole('button', { name: '5m', exact: true }).click()

  // Scroll the on-page player out of view so RadioPlayer's IntersectionObserver
  // flips showMediaBar to true and the bottom MediaBar takes over.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

  const indicator = page.getByRole('region', { name: 'Media player' }).getByRole('button', { name: /sleep timer active/i })
  await expect(indicator).toBeVisible()

  await indicator.click()
  const sheet = page.getByRole('dialog', { name: 'Sleep timer' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('button', { name: /pause/i })).toBeVisible()
})
```

Note: once this indicator exists, two buttons on the Listen page have names starting with "Sleep timer" while a timer is active — the player's own button (`aria-label="Sleep timer active"`, no minute count) and this test's indicator (`aria-label="Sleep timer active, N minutes remaining"`). The first test in this file locates the player button with `getByRole('button', { name: 'Sleep timer', exact: true })`, which only matches the *inactive* label and stops matching once the timer starts — so it isn't ambiguous in practice, but don't relax that `exact: true` to a substring match later without re-checking this file.

- [ ] **Step 10: Run the extended e2e spec**

Run: `npx playwright test tests/e2e/sleep-timer.spec.ts --project=chromium`
Expected: 2 passed (the original cancel-flow test plus the new media-bar indicator test)

- [ ] **Step 11: Run the full unit suite, typecheck, and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass, no new failures

- [ ] **Step 12: Manual verification on the running app**

Run: `npm run dev` (or use the `run-reach-radio-nextjs` skill), then in a browser:
1. Go to `/`, start a 5-minute sleep timer, scroll down until the on-page player scrolls out of view and the bottom `MediaBar` takes over (per the `IntersectionObserver` in `RadioPlayer.tsx:37-56`) — confirm the amber moon indicator appears next to the play/pause button.
2. Navigate to `/about` or `/teachers` — confirm the indicator persists in the bottom bar.
3. Tap the indicator — confirm `SleepTimerSheet` opens with Pause/Cancel options.
4. Cancel the timer from the sheet — confirm the indicator disappears from the bar.

- [ ] **Step 13: Commit**

```bash
git add src/components/media-bar/SleepTimerIndicator.tsx src/components/media-bar/MediaBar.tsx tests/unit/sleep-timer-indicator.test.tsx tests/unit/media-bar.test.tsx tests/e2e/sleep-timer.spec.ts
git commit -m "feat(player): show a sleep timer indicator in the bottom media bar"
```

---

## Self-Review

**Spec coverage:**
- "Should the overlay's Cancel button open the sheet or cancel directly" — already resolved in conversation (keep direct cancel); no plan task needed, nothing to build.
- "SleepTimerOverlay UI enhancements" — Task 1 (label + fade-in). Covered.
- "Should the bottom media bar reflect the active sleep timer state" — Task 2 (indicator + tap-through to sheet, plus real-DOM e2e coverage for the portal/inert interaction unit tests can't see). Covered.

**Placeholder scan:** No TBD/TODO markers; every step has complete code and exact commands.

**Type consistency:** `SleepTimerIndicator` reads `sleepTimerActive` and `remainingSleepSeconds` — both match the exact field names in `src/lib/store/media-store.ts:15,18`. `SleepTimerSheet`'s prop names (`open`, `onClose`) match `src/components/home/SleepTimerSheet.tsx:12-15` exactly, same as `SleepTimerButton.tsx:30`'s existing usage.

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-31-sleep-timer-active-state-ui.md`. Start a new session and paste this to execute it:**

```
Execute docs/superpowers/plans/2026-07-31-sleep-timer-active-state-ui.md using superpowers:subagent-driven-development.
```
