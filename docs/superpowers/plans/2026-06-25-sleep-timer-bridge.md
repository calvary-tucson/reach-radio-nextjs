# Sleep Timer Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the web↔native bridge so native surfaces (CarPlay, Apple Watch, Live Activities) can start, pause, resume, cancel, and set the sleep timer, and receive structural state changes to display a countdown.

**Architecture:** Zustand `media-store` stays source of truth. Store gains `sleepTimerPaused` and `sleepTimerEndsAt` fields. `SleepTimerProvider` gains a pause-aware interval and a separate effect that pushes structural state to native (not every tick). `BridgeInit` handles 5 new `nativeCommand` types by calling store actions directly.

**Tech Stack:** React 19, Zustand, vitest + @testing-library/react, jsdom

## Global Constraints

- TypeScript strict mode — no `any` in public APIs
- Tests live in `tests/unit/`, run with `npx vitest run <path>`
- Conventional commits, scope `sleep-timer` for store/provider changes, `bridge` for BridgeInit
- `postMessageToNative` sends `{ protocolVersion: 1, ...payload }` — never call it directly with protocolVersion
- `SleepTimerProvider` must remain mounted in all contexts (native + web) — do NOT re-add `!isMobileApp` guard

---

## Task 1: Store — add pause/endsAt fields and new actions

**Files:**
- Modify: `src/lib/store/media-store.ts`
- Modify: `tests/unit/media-store.test.ts` (add new tests + fix beforeEach to reset new fields)

**Interfaces:**
- Produces:
  - `sleepTimerPaused: boolean` (default `false`)
  - `sleepTimerEndsAt: number | null` (default `null`) — Unix ms
  - `pauseSleepTimer: () => void`
  - `resumeSleepTimer: () => void`
  - `cancelSleepTimer: () => void` (already exists — updated to clear new fields)
  - `setSleepTimer: (seconds: number) => void` (new — replaces remaining + recalculates endsAt)
  - `startSleepTimer: (seconds: number) => void` (updated — now sets `sleepTimerPaused: false` and `sleepTimerEndsAt`)

- [ ] **Step 1: Write failing tests for new store actions**

Add these tests to `tests/unit/media-store.test.ts`. First update the `beforeEach` to reset the two new fields, then add the new describe block.

```ts
// In the existing beforeEach, add the two new fields:
beforeEach(() => {
  useMediaStore.setState({
    isPlaying: false,
    isBuffering: false,
    isMuted: false,
    volume: 100,
    title: 'Reach Radio',
    artist: '',
    image: 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg',
    showMediaBar: false,
    sleepTimerActive: false,
    sleepTimerPaused: false,
    sleepTimerEndsAt: null,
    remainingSleepSeconds: 0,
  })
})
```

Then add at the end of the file:

```ts
describe('sleep timer pause/resume/set', () => {
  it('startSleepTimer clears paused and sets endsAt', () => {
    useMediaStore.getState().startSleepTimer(60)
    const { sleepTimerActive, sleepTimerPaused, sleepTimerEndsAt, remainingSleepSeconds } = useMediaStore.getState()
    expect(sleepTimerActive).toBe(true)
    expect(sleepTimerPaused).toBe(false)
    expect(remainingSleepSeconds).toBe(60)
    expect(sleepTimerEndsAt).toBeGreaterThan(Date.now() - 100)
    expect(sleepTimerEndsAt).toBeLessThanOrEqual(Date.now() + 60_000 + 100)
  })

  it('pauseSleepTimer sets paused=true and clears endsAt', () => {
    useMediaStore.getState().startSleepTimer(60)
    useMediaStore.getState().pauseSleepTimer()
    const { sleepTimerPaused, sleepTimerEndsAt } = useMediaStore.getState()
    expect(sleepTimerPaused).toBe(true)
    expect(sleepTimerEndsAt).toBeNull()
  })

  it('resumeSleepTimer clears paused and recalculates endsAt from remaining', () => {
    useMediaStore.setState({ sleepTimerActive: true, sleepTimerPaused: true, remainingSleepSeconds: 45, sleepTimerEndsAt: null })
    useMediaStore.getState().resumeSleepTimer()
    const { sleepTimerPaused, sleepTimerEndsAt } = useMediaStore.getState()
    expect(sleepTimerPaused).toBe(false)
    expect(sleepTimerEndsAt).toBeGreaterThan(Date.now() - 100)
    expect(sleepTimerEndsAt).toBeLessThanOrEqual(Date.now() + 45_000 + 100)
  })

  it('cancelSleepTimer clears all timer fields', () => {
    useMediaStore.getState().startSleepTimer(30)
    useMediaStore.getState().cancelSleepTimer()
    const { sleepTimerActive, sleepTimerPaused, sleepTimerEndsAt, remainingSleepSeconds } = useMediaStore.getState()
    expect(sleepTimerActive).toBe(false)
    expect(sleepTimerPaused).toBe(false)
    expect(sleepTimerEndsAt).toBeNull()
    expect(remainingSleepSeconds).toBe(0)
  })

  it('setSleepTimer updates remaining and recalculates endsAt when active and not paused', () => {
    useMediaStore.setState({ sleepTimerActive: true, sleepTimerPaused: false, remainingSleepSeconds: 30, sleepTimerEndsAt: Date.now() + 30_000 })
    useMediaStore.getState().setSleepTimer(120)
    const { remainingSleepSeconds, sleepTimerEndsAt } = useMediaStore.getState()
    expect(remainingSleepSeconds).toBe(120)
    expect(sleepTimerEndsAt).toBeGreaterThan(Date.now() - 100)
    expect(sleepTimerEndsAt).toBeLessThanOrEqual(Date.now() + 120_000 + 100)
  })

  it('setSleepTimer updates remaining but leaves endsAt null when paused', () => {
    useMediaStore.setState({ sleepTimerActive: true, sleepTimerPaused: true, remainingSleepSeconds: 30, sleepTimerEndsAt: null })
    useMediaStore.getState().setSleepTimer(90)
    const { remainingSleepSeconds, sleepTimerEndsAt } = useMediaStore.getState()
    expect(remainingSleepSeconds).toBe(90)
    expect(sleepTimerEndsAt).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/media-store.test.ts
```

Expected: multiple FAIL — `sleepTimerPaused` property does not exist, `pauseSleepTimer is not a function`, etc.

- [ ] **Step 3: Implement store changes**

Replace `src/lib/store/media-store.ts` entirely:

```ts
import { create } from 'zustand'

const DEFAULT_IMAGE = 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg'

interface MediaState {
  isPlaying: boolean
  isBuffering: boolean
  isMuted: boolean
  volume: number
  previousVolume: number
  title: string
  artist: string
  image: string
  showMediaBar: boolean
  sleepTimerActive: boolean
  sleepTimerPaused: boolean
  sleepTimerEndsAt: number | null
  remainingSleepSeconds: number
  setIsPlaying: (v: boolean) => void
  setIsBuffering: (v: boolean) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  setMuted: (v: boolean) => void
  setNowPlaying: (title: string, artist: string, image: string) => void
  setShowMediaBar: (v: boolean) => void
  setSleepTimerActive: (active: boolean) => void
  setRemainingSleepSeconds: (s: number) => void
  startSleepTimer: (seconds: number) => void
  pauseSleepTimer: () => void
  resumeSleepTimer: () => void
  cancelSleepTimer: () => void
  setSleepTimer: (seconds: number) => void
  teachersList: { name: string; photo: string }[]
  setTeachersList: (list: { name: string; photo: string }[]) => void
}

export const useMediaStore = create<MediaState>((set, get) => ({
  isPlaying: false,
  isBuffering: false,
  isMuted: false,
  volume: 100,
  previousVolume: 100,
  title: 'Reach Radio',
  artist: '',
  image: DEFAULT_IMAGE,
  showMediaBar: false,
  sleepTimerActive: false,
  sleepTimerPaused: false,
  sleepTimerEndsAt: null,
  remainingSleepSeconds: 0,
  setIsPlaying: (v) => set({ isPlaying: v }),
  setIsBuffering: (v) => set({ isBuffering: v }),
  setVolume: (v) => set({ volume: v, isMuted: v === 0 }),
  toggleMute: () => {
    const { isMuted, volume, previousVolume } = get()
    if (isMuted) {
      set({ isMuted: false, volume: previousVolume > 0 ? previousVolume : 100 })
    } else {
      set({ isMuted: true, previousVolume: volume, volume: 0 })
    }
  },
  setMuted: (v) => {
    const { isMuted, volume, previousVolume } = get()
    if (v && !isMuted) {
      set({ isMuted: true, previousVolume: volume, volume: 0 })
    } else if (!v && isMuted) {
      set({ isMuted: false, volume: previousVolume > 0 ? previousVolume : 100 })
    }
  },
  setNowPlaying: (title, artist, image) => set({ title, artist, image }),
  setShowMediaBar: (v) => set({ showMediaBar: v }),
  setSleepTimerActive: (active) => set({ sleepTimerActive: active }),
  setRemainingSleepSeconds: (s) => set({ remainingSleepSeconds: s }),
  startSleepTimer: (seconds) => set({
    remainingSleepSeconds: seconds,
    sleepTimerActive: true,
    sleepTimerPaused: false,
    sleepTimerEndsAt: Date.now() + seconds * 1000,
  }),
  pauseSleepTimer: () => set({ sleepTimerPaused: true, sleepTimerEndsAt: null }),
  resumeSleepTimer: () => {
    const { remainingSleepSeconds } = get()
    set({ sleepTimerPaused: false, sleepTimerEndsAt: Date.now() + remainingSleepSeconds * 1000 })
  },
  cancelSleepTimer: () => set({
    sleepTimerActive: false,
    sleepTimerPaused: false,
    remainingSleepSeconds: 0,
    sleepTimerEndsAt: null,
  }),
  setSleepTimer: (seconds) => {
    const { sleepTimerActive, sleepTimerPaused } = get()
    set({
      remainingSleepSeconds: seconds,
      sleepTimerEndsAt: sleepTimerActive && !sleepTimerPaused ? Date.now() + seconds * 1000 : null,
    })
  },
  teachersList: [],
  setTeachersList: (list) => set({ teachersList: list }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/media-store.test.ts
```

Expected: all PASS

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all PASS. If `sleep-timer-sheet.test.tsx` or `sleep-timer-provider.test.tsx` fail due to missing `sleepTimerPaused` in their `beforeEach` resets, add `sleepTimerPaused: false, sleepTimerEndsAt: null` to those `setState` calls.

- [ ] **Step 6: Commit**

```bash
git add src/lib/store/media-store.ts tests/unit/media-store.test.ts
git commit -m "feat(sleep-timer): add sleepTimerPaused, sleepTimerEndsAt and pause/resume/set actions"
```

---

## Task 2: SleepTimerProvider — pause-aware interval + native push effect

**Files:**
- Modify: `src/components/SleepTimerProvider.tsx`
- Modify: `tests/unit/sleep-timer-provider.test.tsx`

**Interfaces:**
- Consumes: `sleepTimerPaused: boolean`, `sleepTimerEndsAt: number | null` from `useMediaStore`
- Produces: `postMessageToNative({ sleepTimer: { active, paused, remainingSeconds, endsAt } })` on structural changes

- [ ] **Step 1: Write failing tests for pause and native push**

Add to `tests/unit/sleep-timer-provider.test.tsx`. First update `beforeEach` to reset new fields:

```tsx
beforeEach(() => {
  vi.useFakeTimers()
  useMediaStore.setState({
    isPlaying: true,
    sleepTimerActive: false,
    sleepTimerPaused: false,
    sleepTimerEndsAt: null,
    remainingSleepSeconds: 0,
  })
})
```

Then add at the end of the `describe` block:

```tsx
it('pauses countdown when sleepTimerPaused becomes true', () => {
  useMediaStore.getState().startSleepTimer(30)
  render(<SleepTimerProvider />)

  act(() => { vi.advanceTimersByTime(1000) })
  expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)

  act(() => { useMediaStore.getState().pauseSleepTimer() })

  // No further decrements while paused
  act(() => { vi.advanceTimersByTime(5000) })
  expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)
})

it('resumes countdown after pause', () => {
  useMediaStore.getState().startSleepTimer(30)
  render(<SleepTimerProvider />)

  act(() => { vi.advanceTimersByTime(1000) })
  expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)

  act(() => { useMediaStore.getState().pauseSleepTimer() })
  act(() => { vi.advanceTimersByTime(5000) })
  expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)

  act(() => { useMediaStore.getState().resumeSleepTimer() })
  act(() => { vi.advanceTimersByTime(1000) })
  expect(useMediaStore.getState().remainingSleepSeconds).toBe(28)
})

it('pushes sleepTimer state to native on start', () => {
  const mockPostMessage = vi.fn()
  ;(window as any).Android = { postMessage: mockPostMessage }

  useMediaStore.getState().startSleepTimer(60)
  render(<SleepTimerProvider />)

  const calls = mockPostMessage.mock.calls.map((c: [string]) => JSON.parse(c[0]))
  const timerCall = calls.find((c: Record<string, unknown>) => 'sleepTimer' in c)
  expect(timerCall).toBeDefined()
  expect(timerCall.sleepTimer.active).toBe(true)
  expect(timerCall.sleepTimer.paused).toBe(false)
  expect(timerCall.sleepTimer.remainingSeconds).toBe(60)
  expect(timerCall.sleepTimer.endsAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

  delete (window as any).Android
})

it('pushes sleepTimer with endsAt null on pause', () => {
  const mockPostMessage = vi.fn()
  ;(window as any).Android = { postMessage: mockPostMessage }

  useMediaStore.setState({ sleepTimerActive: true, sleepTimerPaused: false, sleepTimerEndsAt: Date.now() + 30_000, remainingSleepSeconds: 30 })
  render(<SleepTimerProvider />)

  mockPostMessage.mockClear()
  act(() => { useMediaStore.getState().pauseSleepTimer() })

  const calls = mockPostMessage.mock.calls.map((c: [string]) => JSON.parse(c[0]))
  const timerCall = calls.find((c: Record<string, unknown>) => 'sleepTimer' in c)
  expect(timerCall.sleepTimer.paused).toBe(true)
  expect(timerCall.sleepTimer.endsAt).toBeNull()

  delete (window as any).Android
})

it('does not push sleepTimer to native on every tick', () => {
  const mockPostMessage = vi.fn()
  ;(window as any).Android = { postMessage: mockPostMessage }

  useMediaStore.getState().startSleepTimer(10)
  render(<SleepTimerProvider />)

  const callsBefore = mockPostMessage.mock.calls.length
  act(() => { vi.advanceTimersByTime(5000) })
  // 5 ticks but no new sleepTimer push (ticks don't change active/paused/endsAt)
  const callsAfter = mockPostMessage.mock.calls.length
  expect(callsAfter).toBe(callsBefore)

  delete (window as any).Android
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/sleep-timer-provider.test.tsx
```

Expected: new tests FAIL — `pauseSleepTimer` not recognized as changing interval, `sleepTimer` key absent from postMessage calls.

- [ ] **Step 3: Implement SleepTimerProvider changes**

Replace `src/components/SleepTimerProvider.tsx` entirely:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

export function SleepTimerProvider() {
  const sleepTimerActive = useMediaStore((s) => s.sleepTimerActive)
  const sleepTimerPaused = useMediaStore((s) => s.sleepTimerPaused)
  const sleepTimerEndsAt = useMediaStore((s) => s.sleepTimerEndsAt)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!sleepTimerActive || sleepTimerPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      const next = useMediaStore.getState().remainingSleepSeconds - 1
      if (next <= 0) {
        setRemainingSleepSeconds(0)
        setIsPlaying(false)
        setSleepTimerActive(false)
        postMessageToNative({ isPlaying: false })
      } else {
        setRemainingSleepSeconds(next)
      }
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sleepTimerActive, sleepTimerPaused])

  useEffect(() => {
    const { remainingSleepSeconds } = useMediaStore.getState()
    postMessageToNative({
      sleepTimer: {
        active: sleepTimerActive,
        paused: sleepTimerPaused,
        remainingSeconds: remainingSleepSeconds,
        endsAt: sleepTimerEndsAt ? new Date(sleepTimerEndsAt).toISOString() : null,
      },
    })
  }, [sleepTimerActive, sleepTimerPaused, sleepTimerEndsAt])

  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/sleep-timer-provider.test.tsx
```

Expected: all PASS

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/SleepTimerProvider.tsx tests/unit/sleep-timer-provider.test.tsx
git commit -m "feat(sleep-timer): pause-aware interval and native push on structural changes"
```

---

## Task 3: BridgeInit — 5 new sleep timer command handlers

**Files:**
- Modify: `src/components/bridge/BridgeInit.tsx`
- Create: `tests/unit/bridge-sleep-timer.test.tsx`

**Interfaces:**
- Consumes: `startSleepTimer`, `pauseSleepTimer`, `resumeSleepTimer`, `cancelSleepTimer`, `setSleepTimer` from `useMediaStore`
- Produces: handling for `nativeCommand` CustomEvent types `startSleepTimer`, `pauseSleepTimer`, `resumeSleepTimer`, `cancelSleepTimer`, `setSleepTimer`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/bridge-sleep-timer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { BridgeInit } from '@/components/bridge/BridgeInit'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
}))

function dispatchNativeCommand(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('nativeCommand', { detail }))
}

beforeEach(() => {
  ;(window as any).inNativeApp = true
  useMediaStore.setState({
    sleepTimerActive: false,
    sleepTimerPaused: false,
    sleepTimerEndsAt: null,
    remainingSleepSeconds: 0,
    isPlaying: true,
  })
})

afterEach(() => {
  delete (window as any).inNativeApp
  vi.restoreAllMocks()
})

describe('BridgeInit sleep timer commands', () => {
  it('startSleepTimer command starts timer in store', () => {
    render(<BridgeInit />)
    act(() => { dispatchNativeCommand({ type: 'startSleepTimer', seconds: 300 }) })
    const { sleepTimerActive, remainingSleepSeconds, sleepTimerPaused } = useMediaStore.getState()
    expect(sleepTimerActive).toBe(true)
    expect(remainingSleepSeconds).toBe(300)
    expect(sleepTimerPaused).toBe(false)
  })

  it('pauseSleepTimer command pauses timer in store', () => {
    useMediaStore.setState({ sleepTimerActive: true, sleepTimerPaused: false, remainingSleepSeconds: 60, sleepTimerEndsAt: Date.now() + 60_000 })
    render(<BridgeInit />)
    act(() => { dispatchNativeCommand({ type: 'pauseSleepTimer' }) })
    expect(useMediaStore.getState().sleepTimerPaused).toBe(true)
    expect(useMediaStore.getState().sleepTimerEndsAt).toBeNull()
  })

  it('resumeSleepTimer command resumes timer in store', () => {
    useMediaStore.setState({ sleepTimerActive: true, sleepTimerPaused: true, remainingSleepSeconds: 45, sleepTimerEndsAt: null })
    render(<BridgeInit />)
    act(() => { dispatchNativeCommand({ type: 'resumeSleepTimer' }) })
    expect(useMediaStore.getState().sleepTimerPaused).toBe(false)
    expect(useMediaStore.getState().sleepTimerEndsAt).not.toBeNull()
  })

  it('cancelSleepTimer command clears timer in store', () => {
    useMediaStore.setState({ sleepTimerActive: true, sleepTimerPaused: false, remainingSleepSeconds: 60, sleepTimerEndsAt: Date.now() + 60_000 })
    render(<BridgeInit />)
    act(() => { dispatchNativeCommand({ type: 'cancelSleepTimer' }) })
    const { sleepTimerActive, sleepTimerPaused, remainingSleepSeconds, sleepTimerEndsAt } = useMediaStore.getState()
    expect(sleepTimerActive).toBe(false)
    expect(sleepTimerPaused).toBe(false)
    expect(remainingSleepSeconds).toBe(0)
    expect(sleepTimerEndsAt).toBeNull()
  })

  it('setSleepTimer command overrides remaining seconds and recalculates endsAt', () => {
    useMediaStore.setState({ sleepTimerActive: true, sleepTimerPaused: false, remainingSleepSeconds: 30, sleepTimerEndsAt: Date.now() + 30_000 })
    render(<BridgeInit />)
    act(() => { dispatchNativeCommand({ type: 'setSleepTimer', seconds: 600 }) })
    const { remainingSleepSeconds, sleepTimerEndsAt } = useMediaStore.getState()
    expect(remainingSleepSeconds).toBe(600)
    expect(sleepTimerEndsAt).toBeGreaterThan(Date.now() - 100)
    expect(sleepTimerEndsAt).toBeLessThanOrEqual(Date.now() + 600_000 + 100)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/bridge-sleep-timer.test.tsx
```

Expected: all 5 FAIL — `startSleepTimer` command not handled (sleepTimerActive stays false, etc.)

- [ ] **Step 3: Implement BridgeInit changes**

In `src/components/bridge/BridgeInit.tsx`, make two edits:

**Edit 1** — extend the `NativeCommand` union type (add 5 new variants at end of the union):

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
```

**Edit 2** — add 5 cases to the switch in the `handler` function (after the existing `prefetchRoutes` case):

```ts
case 'startSleepTimer': useMediaStore.getState().startSleepTimer(cmd.seconds); break
case 'pauseSleepTimer': useMediaStore.getState().pauseSleepTimer(); break
case 'resumeSleepTimer': useMediaStore.getState().resumeSleepTimer(); break
case 'cancelSleepTimer': useMediaStore.getState().cancelSleepTimer(); break
case 'setSleepTimer': useMediaStore.getState().setSleepTimer(cmd.seconds); break
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/bridge-sleep-timer.test.tsx
```

Expected: all 5 PASS

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/bridge/BridgeInit.tsx tests/unit/bridge-sleep-timer.test.tsx
git commit -m "feat(bridge): add sleep timer start/pause/resume/cancel/set commands"
```

---

## Task 4: Update bridge contract memory

**Files:**
- Modify: `/Users/danielmccauley/.claude/projects/-Users-danielmccauley-Documents-Development-reach-radio-nextjs/memory/reference-bridge-contract.md`

- [ ] **Step 1: Update memory file**

Add to the **Web → Native** table:

| Field | Type | Purpose |
|---|---|---|
| `sleepTimer.active` | `boolean` | Timer running or paused (not cancelled) |
| `sleepTimer.paused` | `boolean` | Countdown frozen; endsAt will be null |
| `sleepTimer.remainingSeconds` | `number` | Seconds remaining at time of push |
| `sleepTimer.endsAt` | `string \| null` | ISO 8601 timestamp. Null when paused/inactive. Use for ActivityKit timer style. |

Sent on structural changes only: start, pause, resume, cancel, setSleepTimer. Not sent on every tick.

Add to the **Native → Web** table:

| `type` | Payload | Purpose |
|---|---|---|
| `startSleepTimer` | `{ seconds: number }` | Start timer (CarPlay / Watch preset) |
| `pauseSleepTimer` | — | Freeze countdown |
| `resumeSleepTimer` | — | Resume from frozen state |
| `cancelSleepTimer` | — | Cancel and clear timer |
| `setSleepTimer` | `{ seconds: number }` | Override remaining time (Watch scrubber / Live Activity update) |

- [ ] **Step 2: Commit**

```bash
git add /Users/danielmccauley/.claude/projects/-Users-danielmccauley-Documents-Development-reach-radio-nextjs/memory/reference-bridge-contract.md
git commit -m "docs(bridge): update bridge contract with sleep timer messages"
```
