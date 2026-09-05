# Media Bar Sleep Timer — Web Bridge Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the web side of the native→web "open sleep timer sheet" bridge contract, so a moon icon in the native iOS media bar can open the existing `SleepTimerSheet` on the web page.

**Architecture:** `useMediaStore` gains a single `sleepTimerSheetOpen` boolean plus `openSleepTimerSheet()`/`closeSleepTimerSheet()` actions, replacing the two independent local-`useState` sheet mounts in `SleepTimerIndicator` and `SleepTimerButton`. A new `GlobalSleepTimerSheet` component, mounted once in the root layout, is the single `<SleepTimerSheet>` instance — driven entirely by the store, reachable from any trigger including a new `openSleepTimerSheet` bridge command in `BridgeInit.tsx`. Separately, `useHideMediaBarWhileOpen` (shared by this sheet, `ContactSheet`, `ScheduleTabView`, and `ModalLayout`) is fixed to re-derive the correct `showMediaBar`/`showMobileNav` values from the current pathname on close, instead of trusting a captured value that can be stale on routes with no `<ShowMediaBar />` mount (e.g. `/teachers/search`).

**Tech Stack:** Next.js 16 / React 19, Zustand, Vitest + React Testing Library, Tailwind CSS.

**Context:** This is the `reach-radio-nextjs` half of a cross-repo feature. The native iOS half (icon in `MediaBarView`, `NativeBridgeHandler.openSleepTimerSheet`) is implemented separately in `reach-radio-native-ios`, per `docs/superpowers/specs/2026-07-31-media-bar-sleep-timer-sheet-design.md` in that repo. This plan implements exactly the "Web-side contract" section of that spec. Native dispatches `window.dispatchEvent(new CustomEvent('nativeCommand',{detail:{type:'openSleepTimerSheet'}}))` — the existing `dispatchNativeCommand` mechanism already used for every other sleep-timer command.

## Global Constraints

- TypeScript strict mode — no `any` in the new store fields/actions.
- Tailwind for any styling; no new styling is introduced by this plan (no visual changes on the web side — same `SleepTimerSheet` UI, just a new way to open it).
- Test runner: `npx vitest run <path>` (from `package.json`'s `"test": "vitest run"`). Tests use Vitest + `@testing-library/react`, `jsdom` environment (see `vitest.config.ts`).
- Any component that (directly or via `useHideMediaBarWhileOpen`) calls `usePathname()` from `next/navigation` needs `vi.mock('next/navigation', () => ({ usePathname: () => '...' }))` in its test file — this repo's Vitest setup has no global mock for it, and real `next/navigation` throws outside an actual Next app-router tree (confirmed by the existing pattern in `tests/unit/media-bar.test.tsx`, `tests/unit/modal-layout.test.tsx`).
- Canonical commit scopes (see `AGENTS.md`): `sleep-timer` for store/sheet-mount work, `bridge` for `BridgeInit.tsx`, `global` for the shared `useHideMediaBarWhileOpen` hook fix.

---

## Task 1: Store — `sleepTimerSheetOpen` state and actions

**Files:**
- Modify: `src/lib/store/media-store.ts` (interface at lines 4-33, state/actions at lines 35-99)
- Test: `tests/unit/media-store.test.ts` (append after the existing sleep-timer tests, and add the new field to the `beforeEach` reset at lines 6-21)

**Interfaces:**
- Produces: `useMediaStore.getState().sleepTimerSheetOpen: boolean`, `.openSleepTimerSheet(): void`, `.closeSleepTimerSheet(): void` — consumed by Task 2 (`GlobalSleepTimerSheet`, `SleepTimerIndicator`, `SleepTimerButton`) and Task 3 (`BridgeInit`'s new command handler).

- [ ] **Step 1: Write the failing test**

In `tests/unit/media-store.test.ts`, add `sleepTimerSheetOpen: false` to the `beforeEach` reset object (line 6-21), so it reads:

```ts
  beforeEach(() => {
    useMediaStore.setState({
      isPlaying: false,
      isBuffering: false,
      isMuted: false,
      volume: 100,
      previousVolume: 100,
      title: 'Reach Radio',
      artist: '',
      resolvedArtist: null,
      image: 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg',
      showMediaBar: false,
      sleepTimerActive: false,
      sleepTimerPaused: false,
      remainingSleepSeconds: 0,
      sleepTimerEndsAt: null,
      sleepTimerSheetOpen: false,
    })
  })
```

Then append this new `describe` block at the end of the file, immediately before the final closing `})` of the outer `describe('useMediaStore', ...)` block (after the `setMuted is idempotent...` test, line 194-199):

```ts
  it('openSleepTimerSheet sets sleepTimerSheetOpen to true', () => {
    useMediaStore.getState().openSleepTimerSheet()
    expect(useMediaStore.getState().sleepTimerSheetOpen).toBe(true)
  })

  it('closeSleepTimerSheet sets sleepTimerSheetOpen to false', () => {
    useMediaStore.getState().openSleepTimerSheet()
    useMediaStore.getState().closeSleepTimerSheet()
    expect(useMediaStore.getState().sleepTimerSheetOpen).toBe(false)
  })

  it('openSleepTimerSheet does not change sleep timer active/remaining state', () => {
    useMediaStore.getState().startSleepTimer(300)
    useMediaStore.getState().openSleepTimerSheet()
    const { sleepTimerActive, remainingSleepSeconds } = useMediaStore.getState()
    expect(sleepTimerActive).toBe(true)
    expect(remainingSleepSeconds).toBe(300)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/media-store.test.ts`
Expected: FAIL with `useMediaStore.getState().openSleepTimerSheet is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/store/media-store.ts`, add to the `MediaState` interface (after line 32, `setSleepTimer: (seconds: number) => void`):

```ts
  sleepTimerSheetOpen: boolean
```

Add this to the interface's action list, after `setSleepTimer: (seconds: number) => void`:

```ts
  openSleepTimerSheet: () => void
  closeSleepTimerSheet: () => void
```

Add to the store body's initial state (after line 49, `remainingSleepSeconds: 0,`):

```ts
  sleepTimerSheetOpen: false,
```

Add to the store body's actions (after line 98, the `setSleepTimer` implementation, before the closing `}))`):

```ts
  openSleepTimerSheet: () => set({ sleepTimerSheetOpen: true }),
  closeSleepTimerSheet: () => set({ sleepTimerSheetOpen: false }),
```

The full interface and store body sections should now read:

```ts
interface MediaState {
  isPlaying: boolean
  isBuffering: boolean
  isMuted: boolean
  volume: number
  previousVolume: number
  title: string
  artist: string
  resolvedArtist: string | null
  image: string
  showMediaBar: boolean
  sleepTimerActive: boolean
  sleepTimerPaused: boolean
  sleepTimerEndsAt: number | null
  remainingSleepSeconds: number
  sleepTimerSheetOpen: boolean
  setIsPlaying: (v: boolean) => void
  setIsBuffering: (v: boolean) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  setMuted: (v: boolean) => void
  setNowPlaying: (title: string, artist: string, resolvedArtist: string | null, image: string) => void
  setShowMediaBar: (v: boolean) => void
  setSleepTimerActive: (active: boolean) => void
  setRemainingSleepSeconds: (s: number) => void
  startSleepTimer: (seconds: number) => void
  pauseSleepTimer: () => void
  resumeSleepTimer: () => void
  cancelSleepTimer: () => void
  setSleepTimer: (seconds: number) => void
  openSleepTimerSheet: () => void
  closeSleepTimerSheet: () => void
}
```

```ts
  setSleepTimer: (seconds) => {
    const { sleepTimerActive, sleepTimerPaused } = get()
    if (!sleepTimerActive) {
      // Auto-start when idle — safe default for callers (e.g. CarPlay) that skip startSleepTimer
      set({ remainingSleepSeconds: seconds, sleepTimerActive: true, sleepTimerPaused: false, sleepTimerEndsAt: Date.now() + seconds * 1000 })
    } else {
      set({ remainingSleepSeconds: seconds, sleepTimerEndsAt: !sleepTimerPaused ? Date.now() + seconds * 1000 : null })
    }
  },
  openSleepTimerSheet: () => set({ sleepTimerSheetOpen: true }),
  closeSleepTimerSheet: () => set({ sleepTimerSheetOpen: false }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/media-store.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store/media-store.ts tests/unit/media-store.test.ts
git commit -m "feat(sleep-timer): add sleepTimerSheetOpen state to media store"
```

---

## Task 2: Global sheet mount + refactor existing triggers

**Files:**
- Create: `src/components/media-bar/GlobalSleepTimerSheet.tsx`
- Modify: `src/app/layout.tsx:174` (mount site, next to `<MediaBar />`)
- Modify: `src/components/media-bar/SleepTimerIndicator.tsx` (full file, 40 lines)
- Modify: `src/components/home/SleepTimerButton.tsx` (full file, 33 lines)
- Test: `tests/unit/sleep-timer-indicator.test.tsx` (full file, 70 lines), `tests/unit/sleep-timer-button.test.tsx` (full file, 56 lines)

**Interfaces:**
- Consumes: `useMediaStore.getState().sleepTimerSheetOpen/openSleepTimerSheet/closeSleepTimerSheet` (Task 1); existing `SleepTimerSheet` (`src/components/home/SleepTimerSheet.tsx`, props `{ open: boolean; onClose: () => void }`, unchanged).
- Produces: `GlobalSleepTimerSheet` — a zero-prop component, the sole `<SleepTimerSheet>` mount point. `SleepTimerIndicator` and `SleepTimerButton` no longer accept or hold any sheet-open state themselves.

**Why this is one task:** Removing the two local `<SleepTimerSheet>` mounts and adding the one global mount must happen together — with only the removal done, nothing could open the sheet; with only the addition done, two sheets would exist simultaneously with disconnected state. They're one deliverable, matching how the native-ios plan treated its own breaking-change pair as a single task.

**Behavior change to be aware of:** `sleepTimerSheetOpen` is global store state with nothing resetting it on route change, and `GlobalSleepTimerSheet` is mounted unconditionally in the root layout — so it never unmounts on navigation the way `SleepTimerIndicator` (which lives inside `MediaBar`, hidden on teacher detail pages) or `SleepTimerButton` (only rendered on the home page) previously did. Before this task, navigating away from the page that opened the sheet would unmount the whole subtree and silently close it; after this task, the sheet survives that navigation and stays open. This is an intentional consequence of having one reachable-from-anywhere sheet (which is the point of the native contract), not a bug — the sheet's own close affordances (X button, backdrop, Escape) still work identically.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `tests/unit/sleep-timer-indicator.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SleepTimerIndicator } from '@/components/media-bar/SleepTimerIndicator'
import { GlobalSleepTimerSheet } from '@/components/media-bar/GlobalSleepTimerSheet'
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
      <GlobalSleepTimerSheet />
    </TooltipProvider>
  )
}

beforeEach(() => {
  useMediaStore.setState({
    sleepTimerActive: false,
    sleepTimerPaused: false,
    remainingSleepSeconds: 0,
    sleepTimerEndsAt: null,
    sleepTimerSheetOpen: false,
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

  it('keeps the sheet mounted when the timer becomes inactive while open (cancel/expiry mid-close)', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 60 })
    renderWithProvider()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Simulate cancelSleepTimer() flipping the store flag before the sheet's
    // own 280ms close animation/timer has completed.
    act(() => {
      useMediaStore.setState({ sleepTimerActive: false })
    })

    // The trigger button should disappear immediately...
    expect(screen.queryByRole('button', { name: /sleep timer active/i })).not.toBeInTheDocument()
    // ...but the sheet must still be mounted so it can finish its close
    // animation and restore focus. GlobalSleepTimerSheet's mount depends
    // only on sleepTimerSheetOpen, never on sleepTimerActive, so this holds
    // structurally regardless of which trigger opened it.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
```

Replace the full contents of `tests/unit/sleep-timer-button.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SleepTimerButton } from '@/components/home/SleepTimerButton'
import { GlobalSleepTimerSheet } from '@/components/media-bar/GlobalSleepTimerSheet'
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
      <SleepTimerButton />
      <GlobalSleepTimerSheet />
    </TooltipProvider>
  )
}

beforeEach(() => {
  useMediaStore.setState({
    sleepTimerActive: false,
    sleepTimerPaused: false,
    remainingSleepSeconds: 0,
    sleepTimerEndsAt: null,
    sleepTimerSheetOpen: false,
  })
})

describe('SleepTimerButton', () => {
  it('renders a button with sleep timer label', () => {
    renderWithProvider()
    expect(screen.getByRole('button', { name: /sleep timer/i })).toBeInTheDocument()
  })

  it('does not render a link', () => {
    renderWithProvider()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('sheet is not visible before button click', () => {
    renderWithProvider()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the sheet when clicked', () => {
    renderWithProvider()
    fireEvent.click(screen.getByRole('button', { name: /sleep timer/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows all timer options in the sheet after click', () => {
    renderWithProvider()
    fireEvent.click(screen.getByRole('button', { name: /sleep timer/i }))
    expect(screen.getByText('5m')).toBeInTheDocument()
    expect(screen.getByText('15m')).toBeInTheDocument()
    expect(screen.getByText('60m')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/sleep-timer-indicator.test.tsx tests/unit/sleep-timer-button.test.tsx`
Expected: FAIL — `Cannot find module '@/components/media-bar/GlobalSleepTimerSheet'`.

- [ ] **Step 3: Create `GlobalSleepTimerSheet`**

Create `src/components/media-bar/GlobalSleepTimerSheet.tsx`:

```tsx
'use client'

import { useMediaStore } from '@/lib/store/media-store'
import { SleepTimerSheet } from '@/components/home/SleepTimerSheet'

export function GlobalSleepTimerSheet() {
  const open = useMediaStore((s) => s.sleepTimerSheetOpen)
  const closeSleepTimerSheet = useMediaStore((s) => s.closeSleepTimerSheet)
  return <SleepTimerSheet open={open} onClose={closeSleepTimerSheet} />
}
```

- [ ] **Step 4: Refactor `SleepTimerIndicator` and `SleepTimerButton`**

Replace the full contents of `src/components/media-bar/SleepTimerIndicator.tsx` with:

```tsx
'use client'

import { MoonZzzIcon } from '@/components/icons/MoonZzzIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMediaStore } from '@/lib/store/media-store'

export function SleepTimerIndicator() {
  const sleepTimerActive = useMediaStore((s) => s.sleepTimerActive)
  const remainingSleepSeconds = useMediaStore((s) => s.remainingSleepSeconds)
  const sleepTimerSheetOpen = useMediaStore((s) => s.sleepTimerSheetOpen)
  const openSleepTimerSheet = useMediaStore((s) => s.openSleepTimerSheet)

  if (!sleepTimerActive) return null

  const minutes = Math.max(1, Math.ceil(remainingSleepSeconds / 60))

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={openSleepTimerSheet}
          aria-label={`Sleep timer active, ${minutes} minute${minutes !== 1 ? 's' : ''} remaining`}
          aria-haspopup="dialog"
          aria-expanded={sleepTimerSheetOpen}
          className="rounded-full w-11 h-11 flex items-center justify-center flex-shrink-0 cursor-pointer bg-amber-500 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <MoonZzzIcon className="w-5 h-5 text-white light:text-gray-900" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Sleep Timer (Active)</TooltipContent>
    </Tooltip>
  )
}
```

Replace the full contents of `src/components/home/SleepTimerButton.tsx` with:

```tsx
'use client'

import { MoonZzzIcon } from '@/components/icons/MoonZzzIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMediaStore } from '@/lib/store/media-store'

export function SleepTimerButton() {
  const sleepTimerActive = useMediaStore((s) => s.sleepTimerActive)
  const sleepTimerSheetOpen = useMediaStore((s) => s.sleepTimerSheetOpen)
  const openSleepTimerSheet = useMediaStore((s) => s.openSleepTimerSheet)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={openSleepTimerSheet}
          aria-label={sleepTimerActive ? 'Sleep timer active' : 'Sleep timer'}
          aria-expanded={sleepTimerSheetOpen}
          aria-haspopup="dialog"
          className={`rounded-full p-1 w-11 h-11 flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:transition-colors ${sleepTimerActive ? 'bg-amber-500' : 'bg-gray-500 light:bg-gray-300'}`}
        >
          <MoonZzzIcon className="w-5 h-5 text-white light:text-gray-900" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{sleepTimerActive ? 'Sleep Timer (Active)' : 'Sleep Timer'}</TooltipContent>
    </Tooltip>
  )
}
```

- [ ] **Step 5: Mount `GlobalSleepTimerSheet` in the root layout**

In `src/app/layout.tsx`, add the import after line 3 (`import { MediaBar } from '@/components/media-bar/MediaBar'`):

```tsx
import { GlobalSleepTimerSheet } from '@/components/media-bar/GlobalSleepTimerSheet'
```

Replace line 174 (`<MediaBar />`) with:

```tsx
            <MediaBar />
            <GlobalSleepTimerSheet />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/sleep-timer-indicator.test.tsx tests/unit/sleep-timer-button.test.tsx`
Expected: all tests PASS.

- [ ] **Step 7: Run the full unit suite to check for regressions**

Run: `npx vitest run`
Expected: all tests PASS (in particular `tests/unit/sleep-timer-sheet.test.tsx`, which renders `SleepTimerSheet` directly and is unaffected by this task).

- [ ] **Step 8: Commit**

```bash
git add src/components/media-bar/GlobalSleepTimerSheet.tsx src/app/layout.tsx src/components/media-bar/SleepTimerIndicator.tsx src/components/home/SleepTimerButton.tsx tests/unit/sleep-timer-indicator.test.tsx tests/unit/sleep-timer-button.test.tsx
git commit -m "refactor(sleep-timer): single global SleepTimerSheet mount driven by the store"
```

---

## Task 3: `openSleepTimerSheet` bridge command

**Files:**
- Modify: `src/components/bridge/BridgeInit.tsx:14-25` (`NativeCommand` union), `:74-104` (handler switch)
- Test: `tests/unit/bridge-sleep-timer.test.tsx` (append)

**Interfaces:**
- Consumes: `useMediaStore.getState().openSleepTimerSheet()` (Task 1).
- Produces: `{ type: 'openSleepTimerSheet' }` as a valid `NativeCommand`, dispatched today from `reach-radio-native-ios`'s `NativeBridgeHandler.openSleepTimerSheet(in:)` via `window.dispatchEvent(new CustomEvent('nativeCommand', { detail: { type: 'openSleepTimerSheet' } }))`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/bridge-sleep-timer.test.tsx`, inside the existing `beforeEach` (lines 28-36), add `sleepTimerSheetOpen: false` to the reset:

```ts
  beforeEach(() => {
    useMediaStore.setState({
      sleepTimerActive: false,
      sleepTimerPaused: false,
      remainingSleepSeconds: 0,
      sleepTimerEndsAt: null,
      sleepTimerSheetOpen: false,
    })
    render(<BridgeInit streamUrl="https://stream.example.com" />)
  })
```

Then append this test after the existing `setSleepTimer command updates remaining seconds` test (end of the `describe` block, before its closing `})`):

```ts
  it('openSleepTimerSheet command sets sleepTimerSheetOpen to true', () => {
    dispatchCommand({ type: 'openSleepTimerSheet' })
    expect(useMediaStore.getState().sleepTimerSheetOpen).toBe(true)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/bridge-sleep-timer.test.tsx`
Expected: FAIL — `sleepTimerSheetOpen` stays `false` (the command isn't in the `NativeCommand` union yet, so it falls into the handler's `default` no-op branch).

- [ ] **Step 3: Write minimal implementation**

In `src/components/bridge/BridgeInit.tsx`, add to the `NativeCommand` union (line 14-25), after `| { type: 'setSleepTimer'; seconds: number }` and before `| { type: 'setViewportInsets'; ... }`:

```ts
  | { type: 'openSleepTimerSheet' }
```

The full union should now read:

```ts
type NativeCommand =
  | { type: 'navigate'; path: string }
  | { type: 'refresh' }
  | { type: 'setPlayState'; playing: boolean }
  | { type: 'setBuffering'; buffering: boolean }
  | { type: 'prefetchRoutes'; paths: string[] }
  | { type: 'startSleepTimer'; seconds: number }
  | { type: 'pauseSleepTimer' }
  | { type: 'resumeSleepTimer' }
  | { type: 'cancelSleepTimer' }
  | { type: 'setSleepTimer'; seconds: number }
  | { type: 'openSleepTimerSheet' }
  | { type: 'setViewportInsets'; top: number; bottom: number }
```

Add a case to the handler switch (line 74-104), after `case 'setSleepTimer': ...` and before `case 'setViewportInsets':`:

```ts
        case 'openSleepTimerSheet': useMediaStore.getState().openSleepTimerSheet(); break
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/bridge-sleep-timer.test.tsx`
Expected: all tests PASS.

- [ ] **Step 5: Run the full unit suite to check for regressions**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 6: Add an e2e test for the native command path**

The unit test above dispatches the command with `window.inNativeApp` stubbed directly, which proves the store update but not that a real page reachably opens the sheet. `tests/e2e/bridge.spec.ts` already has the right harness for that (`mockNativeBridge` stubs `window.webkit.messageHandlers` before navigation, matching how a real iOS webview presents). Append this test to `tests/e2e/bridge.spec.ts`, inside the existing `test.describe('Native bridge', ...)` block, after the `refresh` test:

```ts
  test('nativeCommand openSleepTimerSheet opens the sleep timer sheet', async ({ page }) => {
    await mockNativeBridge(page)
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'openSleepTimerSheet' })
    await expect(page.getByRole('dialog', { name: 'Sleep timer' })).toBeVisible()
  })
```

Run: `npx playwright test tests/e2e/bridge.spec.ts`
Expected: all tests PASS, including the new one.

- [ ] **Step 7: Commit**

```bash
git add src/components/bridge/BridgeInit.tsx tests/unit/bridge-sleep-timer.test.tsx tests/e2e/bridge.spec.ts
git commit -m "feat(bridge): handle openSleepTimerSheet native command"
```

---

## Task 4: Fix `useHideMediaBarWhileOpen`'s stale-restore bug

**Files:**
- Modify: `src/lib/hooks/useHideMediaBarWhileOpen.ts` (full file, 24 lines)
- Test: create `tests/unit/use-hide-media-bar-while-open.test.ts`; modify `tests/unit/contact-sheet.test.tsx`, `tests/unit/sleep-timer-sheet.test.tsx`, `tests/unit/sleep-timer-button.test.tsx`, `tests/unit/sleep-timer-indicator.test.tsx` (add a `next/navigation` mock to each — none currently has one); modify `tests/unit/schedule-tab-view-media-bar.test.tsx` (extend its existing `next/navigation` mock)

**Interfaces:**
- Consumes: `isTeacherDetailPath` (`src/lib/routes.ts`, unchanged: `isTeacherDetailPath(pathname: string): boolean`).
- Produces: same public signature, `useHideMediaBarWhileOpen(open: boolean): void` — no caller (`ModalLayout`, `ContactSheet`, `ScheduleTabView`, `SleepTimerSheet`) needs to change how it invokes the hook.

**The bug:** the hook currently captures `prevShowMediaBar = useMediaStore.getState().showMediaBar` when a sheet opens and replays that exact value to native on close. That store field is kept correct only on routes that mount `<ShowMediaBar />` (`about`, `teachers`, `teachers/[slug]`, `about/privacy-policy`) — `/teachers/search` has no such mount, and `BridgeInit`'s own pathname effect (`src/components/bridge/BridgeInit.tsx:168-175`) computes the natively-correct value and posts it directly to native without ever writing it back into the store. So on `/teachers/search`, opening any standalone sheet captures a stale `false`, and closing it re-broadcasts `showMediaBar: false` to native even though native's own bar was visible there — the bar (and the new sleep-timer icon) stays hidden until the next route change.

**The fix:** on close, re-derive `showMediaBar`/`showMobileNav` from the current pathname the same way `BridgeInit`'s pathname effect does (`pathname !== '/' && !isTeacherDetailPath(pathname)`), instead of trusting the captured value.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/use-hide-media-bar-while-open.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useHideMediaBarWhileOpen } from '@/lib/hooks/useHideMediaBarWhileOpen'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

let mockPathname = '/teachers/search'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

vi.mock('@/lib/bridge/post-message', () => ({
  postMessageToNative: vi.fn(),
}))

describe('useHideMediaBarWhileOpen', () => {
  beforeEach(() => {
    useMediaStore.setState({ showMediaBar: false })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('re-derives showMediaBar=true on close for /teachers/search, not the stale captured false', () => {
    mockPathname = '/teachers/search'
    useMediaStore.setState({ showMediaBar: false })
    const { rerender } = renderHook(({ open }) => useHideMediaBarWhileOpen(open), {
      initialProps: { open: false },
    })
    rerender({ open: true })
    rerender({ open: false })

    expect(useMediaStore.getState().showMediaBar).toBe(true)
    const calls = vi.mocked(postMessageToNative).mock.calls
    expect(calls.at(-1)?.[0]).toEqual({ showMobileNav: true, showMediaBar: true })
  })

  it('re-derives showMediaBar=false on close for a teacher detail path', () => {
    mockPathname = '/teachers/john-macarthur'
    useMediaStore.setState({ showMediaBar: true })
    const { rerender } = renderHook(({ open }) => useHideMediaBarWhileOpen(open), {
      initialProps: { open: false },
    })
    rerender({ open: true })
    rerender({ open: false })

    expect(useMediaStore.getState().showMediaBar).toBe(false)
    const calls = vi.mocked(postMessageToNative).mock.calls
    expect(calls.at(-1)?.[0]).toEqual({ showMobileNav: false, showMediaBar: false })
  })

  it('re-derives showMediaBar=false on close for the home page', () => {
    mockPathname = '/'
    useMediaStore.setState({ showMediaBar: true })
    const { rerender } = renderHook(({ open }) => useHideMediaBarWhileOpen(open), {
      initialProps: { open: false },
    })
    rerender({ open: true })
    rerender({ open: false })

    expect(useMediaStore.getState().showMediaBar).toBe(false)
    const calls = vi.mocked(postMessageToNative).mock.calls
    expect(calls.at(-1)?.[0]).toEqual({ showMobileNav: true, showMediaBar: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/use-hide-media-bar-while-open.test.ts`
Expected: FAIL on the first test — `showMediaBar` stays `false` (the captured stale value), not `true`.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/lib/hooks/useHideMediaBarWhileOpen.ts` with:

```ts
'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'
import { isTeacherDetailPath } from '@/lib/routes'

// Hides the on-page media bar (and native bottom nav) for the lifetime of a
// standalone sheet, mirroring @modal/layout.tsx's isOpen effect. Sheets that
// don't participate in useModalStore (ContactSheet, SleepTimerSheet,
// ScheduleTabView's day picker) need this: the on-page MediaBar component
// reads useMediaStore.showMediaBar directly, so posting to native alone
// never hides it in plain-browser use.
export function useHideMediaBarWhileOpen(open: boolean) {
  const pathname = usePathname()
  // Read via ref in the cleanup rather than adding pathname to the effect's
  // deps — a route change while the sheet is still open (rare, but possible
  // for a globally-mounted sheet) should not re-fire the hide/show dance.
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  useEffect(() => {
    if (!open) return
    useMediaStore.getState().setShowMediaBar(false)
    postMessageToNative({ showMobileNav: false, showMediaBar: false })
    return () => {
      // Re-derive the natively-correct value the same way BridgeInit's own
      // pathname effect does, instead of trusting a captured "previous"
      // store value — that value is stale on any route with no <ShowMediaBar />
      // mount (e.g. /teachers/search), which would otherwise leave native's
      // media bar hidden until the next route change.
      const isDetail = isTeacherDetailPath(pathnameRef.current)
      const restored = pathnameRef.current !== '/' && !isDetail
      useMediaStore.getState().setShowMediaBar(restored)
      postMessageToNative({ showMobileNav: !isDetail, showMediaBar: restored })
    }
  }, [open])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/use-hide-media-bar-while-open.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Run the full unit suite to find ripple failures**

Run: `npx vitest run`
Expected: FAIL — `tests/unit/contact-sheet.test.tsx`, `tests/unit/sleep-timer-sheet.test.tsx`, `tests/unit/sleep-timer-button.test.tsx`, and `tests/unit/sleep-timer-indicator.test.tsx` all render a component that (transitively, via the hook) now calls `usePathname()` from real `next/navigation` with no mock in place, and `tests/unit/schedule-tab-view-media-bar.test.tsx`'s existing mock only exports `useRouter`, not `usePathname`.

- [ ] **Step 6: Fix the ripple in `contact-sheet.test.tsx`**

Add this mock to `tests/unit/contact-sheet.test.tsx`, after the existing imports (line 5), before the first `vi.mock` call:

```ts
vi.mock('next/navigation', () => ({
  usePathname: () => '/about',
}))
```

Replace the last test in the file (`restores the media bar to its pre-sheet store value on unmount`, lines 85-90) — its old assertion checked the stale captured-value behavior this task removes — with:

```ts
  it('restores the media bar to the natively-correct value for the current route on unmount', () => {
    // The fixed hook derives the restore value as `pathname !== '/' && !isTeacherDetailPath(pathname)`
    // (mocked pathname is '/about' — not '/', not a teacher detail path), so it's true
    // regardless of what showMediaBar happened to be set to before the sheet opened.
    useMediaStore.setState({ showMediaBar: false })
    const { unmount } = render(<ContactSheet open={true} onClose={vi.fn()} />)
    unmount()
    expect(postMessageToNative).toHaveBeenCalledWith({ showMobileNav: true, showMediaBar: true })
  })
```

- [ ] **Step 7: Fix the ripple in `sleep-timer-sheet.test.tsx`**

Add this mock to `tests/unit/sleep-timer-sheet.test.tsx`, after the existing imports (line 4), before the `useSheetDrag` mock:

```ts
vi.mock('next/navigation', () => ({
  usePathname: () => '/about',
}))
```

Replace the last test in the file (`hides the on-page media bar while open and restores it on unmount`, lines 87-93) with:

```ts
  it('hides the on-page media bar while open and restores it (derived from pathname) on unmount', () => {
    // Deliberately start from the wrong value — proves the restore is derived
    // from pathname, not replayed from whatever showMediaBar happened to be.
    useMediaStore.setState({ showMediaBar: false })
    const { unmount } = render(<SleepTimerSheet open={true} onClose={vi.fn()} />)
    expect(useMediaStore.getState().showMediaBar).toBe(false)
    unmount()
    // Mocked pathname is '/about' (not '/', not a teacher detail path), so the
    // derived value is true, regardless of the false it started from.
    expect(useMediaStore.getState().showMediaBar).toBe(true)
  })
```

- [ ] **Step 8: Fix the ripple in `sleep-timer-button.test.tsx` and `sleep-timer-indicator.test.tsx`**

Add this mock to both `tests/unit/sleep-timer-button.test.tsx` and `tests/unit/sleep-timer-indicator.test.tsx`, after the existing imports, before the `useSheetDrag` mock:

```ts
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))
```

- [ ] **Step 9: Fix the ripple in `schedule-tab-view-media-bar.test.tsx`**

In `tests/unit/schedule-tab-view-media-bar.test.tsx`, replace the existing mock (lines 6-8):

```ts
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))
```

with:

```ts
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/teachers',
}))
```

(`ScheduleTabView` lives on the `/teachers` page, where `isTeacherDetailPath('/teachers')` is `false`, so the derived `showMediaBar` is `true` — matching the test's existing `expect(useMediaStore.getState().showMediaBar).toBe(true)` assertion after close.)

- [ ] **Step 10: Run the full unit suite to verify everything passes**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 11: Commit**

```bash
git add src/lib/hooks/useHideMediaBarWhileOpen.ts tests/unit/use-hide-media-bar-while-open.test.ts tests/unit/contact-sheet.test.tsx tests/unit/sleep-timer-sheet.test.tsx tests/unit/sleep-timer-button.test.tsx tests/unit/sleep-timer-indicator.test.tsx tests/unit/schedule-tab-view-media-bar.test.tsx
git commit -m "fix(global): re-derive showMediaBar from pathname on sheet close instead of a stale captured value"
```

---

## Task 5: Manual verification

- [ ] **Step 1: Type-check and lint**

Run:
```bash
npx tsc --noEmit
npx eslint
```
Expected: no errors.

- [ ] **Step 2: Full unit suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 3: Manual browser verification**

Use the `run-reach-radio-nextjs` skill to start the dev server, then in a plain browser tab (no native bridge present — that path is covered by Task 3's Playwright test instead, since `BridgeInit`'s `nativeCommand` listener only attaches when `isNativeBridgePresent()` is true, and a plain browser tab can't fake that convincingly enough for `window.dispatchEvent` to reach it):
1. Start a sleep timer from the home page's `SleepTimerButton`, confirm the sheet still opens/works exactly as before.
2. Navigate to `/about` (or `/teachers`), confirm `SleepTimerIndicator`'s moon icon appears in the media bar and opens the same sheet.
3. Navigate to `/teachers/search` (open the search sheet from the header's search entry point) so the on-page media bar is visible there, then open the header's `ContactSheet` (the sheet actually reachable from this route — `SleepTimerSheet` isn't triggerable here without a sleep timer already running) and close it. Confirm the media bar reappears afterward instead of staying hidden. This is the exact `/teachers/search` stale-value bug the spec describes, reproduced directly: this route has no `<ShowMediaBar />` mount, so before Task 4's fix the store's captured "previous" value was stale `false` and the bar stayed hidden after closing any sheet here; after the fix it's correctly re-derived as `true`.

- [ ] **Step 4: Commit if any fixes were needed**

Only if Steps 1-3 surfaced an issue requiring a code change — commit that fix separately with an accurate message. If everything passed as implemented, there is nothing to commit here.
