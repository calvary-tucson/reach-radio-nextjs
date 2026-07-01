# Store Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `teachersList` out of the media store into its own Zustand slice, and consolidate the `volume`/`isMuted` effects in `AudioProvider` into one.

**Architecture:** Two independent tasks — no ordering dependency. Task 1 is a cross-file refactor (new store file + 4 modified files). Task 2 is a single-file cleanup inside `AudioProvider.tsx`.

**Tech Stack:** Zustand, Vitest, React 19, Next.js

## Global Constraints

- TypeScript strict mode — no `any`
- Vitest for tests: `npm run test` (run) / `npm run test:watch` (watch)
- Commit scope for store changes: `player`
- No behaviour changes — pure refactor

---

### Task 1: Extract teachersList → `teachers-store.ts`

**Files:**
- Create: `src/lib/store/teachers-store.ts`
- Modify: `src/lib/store/media-store.ts` (remove `teachersList` slice)
- Modify: `src/hooks/useNowPlaying.ts` (import from `teachers-store`)
- Modify: `tests/unit/media-store.test.ts` (remove `setTeachersList` test)
- Create: `tests/unit/teachers-store.test.ts`
- Modify: `tests/unit/use-now-playing.test.ts` (reset `useTeachersStore` in `beforeEach`)

**Interfaces:**
- Produces: `useTeachersStore` — `{ teachersList: TeacherListEntry[], setTeachersList(list: TeacherListEntry[]): void }`
- Produces: `TeacherListEntry` — `{ name: string; photo: string }`
- Consumes: nothing from other tasks

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/teachers-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useTeachersStore } from '@/lib/store/teachers-store'

describe('useTeachersStore', () => {
  beforeEach(() => {
    useTeachersStore.setState({ teachersList: [] })
  })

  it('setTeachersList updates teachersList', () => {
    const list = [
      { name: 'Alice', photo: 'https://example.com/alice.jpg' },
      { name: 'Bob', photo: 'https://example.com/bob.jpg' },
    ]
    useTeachersStore.getState().setTeachersList(list)
    expect(useTeachersStore.getState().teachersList).toEqual(list)
  })

  it('teachersList defaults to empty array', () => {
    useTeachersStore.setState({ teachersList: [] })
    expect(useTeachersStore.getState().teachersList).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm run test -- tests/unit/teachers-store.test.ts
```

Expected: `Error: Cannot find module '@/lib/store/teachers-store'`

- [ ] **Step 3: Create `src/lib/store/teachers-store.ts`**

```typescript
import { create } from 'zustand'

export interface TeacherListEntry {
  name: string
  photo: string
}

interface TeachersState {
  teachersList: TeacherListEntry[]
  setTeachersList: (list: TeacherListEntry[]) => void
}

export const useTeachersStore = create<TeachersState>((set) => ({
  teachersList: [],
  setTeachersList: (list) => set({ teachersList: list }),
}))
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm run test -- tests/unit/teachers-store.test.ts
```

Expected: 2 tests pass

- [ ] **Step 5: Remove `teachersList` from `src/lib/store/media-store.ts`**

Remove from the `MediaState` interface (lines 37–38):
```typescript
// DELETE these two lines:
teachersList: TeacherListEntry[]
setTeachersList: (list: TeacherListEntry[]) => void
```

Remove from the implementation (lines 104–105):
```typescript
// DELETE these two lines:
teachersList: [],
setTeachersList: (list) => set({ teachersList: list }),
```

Also remove the now-unused `TeacherListEntry` interface (lines 4–7):
```typescript
// DELETE:
interface TeacherListEntry {
  name: string
  photo: string
}
```

Final `src/lib/store/media-store.ts`:
```typescript
import { create } from 'zustand'
import { FALLBACK_OG_IMAGE } from '@/lib/constants'

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
}

export const useMediaStore = create<MediaState>((set, get) => ({
  isPlaying: false,
  isBuffering: false,
  isMuted: false,
  volume: 100,
  previousVolume: 100,
  title: 'Reach Radio',
  artist: '',
  image: FALLBACK_OG_IMAGE,
  showMediaBar: false,
  sleepTimerActive: false,
  sleepTimerPaused: false,
  sleepTimerEndsAt: null,
  remainingSleepSeconds: 0,
  setIsPlaying: (v) => set({ isPlaying: v }),
  setIsBuffering: (v) => set({ isBuffering: v }),
  setVolume: (v) => set((s) => ({ volume: v, isMuted: v === 0, previousVolume: v === 0 ? s.volume : s.previousVolume })),
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
  pauseSleepTimer: () => {
    const { sleepTimerActive, sleepTimerPaused } = get()
    if (!sleepTimerActive || sleepTimerPaused) return
    set({ sleepTimerPaused: true, sleepTimerEndsAt: null })
  },
  resumeSleepTimer: () => {
    const { sleepTimerActive, sleepTimerPaused, remainingSleepSeconds } = get()
    if (!sleepTimerActive || !sleepTimerPaused) return
    set({ sleepTimerPaused: false, sleepTimerEndsAt: Date.now() + remainingSleepSeconds * 1000 })
  },
  cancelSleepTimer: () => set({ sleepTimerActive: false, sleepTimerPaused: false, remainingSleepSeconds: 0, sleepTimerEndsAt: null }),
  setSleepTimer: (seconds) => {
    const { sleepTimerActive, sleepTimerPaused } = get()
    if (!sleepTimerActive) {
      // Auto-start when idle — safe default for callers (e.g. CarPlay) that skip startSleepTimer
      set({ remainingSleepSeconds: seconds, sleepTimerActive: true, sleepTimerPaused: false, sleepTimerEndsAt: Date.now() + seconds * 1000 })
    } else {
      set({ remainingSleepSeconds: seconds, sleepTimerEndsAt: !sleepTimerPaused ? Date.now() + seconds * 1000 : null })
    }
  },
}))
```

- [ ] **Step 6: Update `src/hooks/useNowPlaying.ts`**

Replace the import and all `teachersList`/`setTeachersList` references to use `useTeachersStore`:

```typescript
'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'
import { useTeachersStore } from '@/lib/store/teachers-store'
import { FALLBACK_OG_IMAGE } from '@/lib/constants'

const MAX_BACKOFF_MS = 60_000

export function useNowPlaying(): void {
  const setNowPlaying = useMediaStore((s) => s.setNowPlaying)
  const setTeachersList = useTeachersStore((s) => s.setTeachersList)

  // Fetch teacher list once — used to resolve artist → photo
  useEffect(() => {
    fetch('/api/teachers-list')
      .then((r) => r.json())
      .then((data: { name: string; photo: string }[]) => {
        setTeachersList(data)
      })
      .catch(() => {
        // non-critical, best-effort
      })
  }, [setTeachersList])

  useEffect(() => {
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let retries = 0
    let destroyed = false

    function connect() {
      if (destroyed) return
      if (es) es.close()
      es = new EventSource('/api/stream-info-sse')

      es.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data)
          if (typeof raw !== 'object' || raw === null) return
          const data = raw as { title?: string; artist?: string }

          const { teachersList } = useTeachersStore.getState()

          let image = FALLBACK_OG_IMAGE
          let resolvedArtist = data.artist ?? useMediaStore.getState().artist

          if (resolvedArtist && teachersList.length > 0) {
            const match = teachersList.find((t) =>
              t.name.toLowerCase().includes(resolvedArtist.toLowerCase()) ||
              resolvedArtist.toLowerCase().includes(t.name.toLowerCase())
            )
            if (match) {
              image = match.photo.includes('?')
                ? `${match.photo}&w=420&fm=jpg`
                : `${match.photo}?w=420&fm=jpg`
              resolvedArtist = match.name
            }
          }

          setNowPlaying(
            data.title ?? useMediaStore.getState().title,
            resolvedArtist,
            image
          )
          retries = 0
        } catch {
          // retain existing values on parse error
        }
      }

      es.onerror = () => {
        es?.close()
        if (destroyed) return
        // Exponential backoff capped at 60s — no hard stop
        const delay = Math.min(Math.pow(2, retries) * 1000 + Math.random() * 500, MAX_BACKOFF_MS)
        retries++
        retryTimer = setTimeout(connect, delay)
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        // Disconnect when tab is hidden — saves server slots
        if (retryTimer) clearTimeout(retryTimer)
        if (es) { es.close(); es = null }
      } else {
        // Reconnect when tab becomes visible
        retries = 0
        connect()
      }
    }

    connect()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      destroyed = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (retryTimer) clearTimeout(retryTimer)
      if (es) es.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setNowPlaying/setTeachersList are stable Zustand actions; SSE connects once on mount
  }, [])
}
```

- [ ] **Step 7: Update `tests/unit/media-store.test.ts`**

Remove the `setTeachersList` test (currently lines 128–135) and remove `teachersList`-related fields from `beforeEach` setState (there are none — the beforeEach doesn't set `teachersList`). Just delete the test:

```typescript
// DELETE this test block:
it('setTeachersList updates teachersList', () => {
  const list = [
    { name: 'Alice', photo: 'https://example.com/alice.jpg' },
    { name: 'Bob', photo: 'https://example.com/bob.jpg' },
  ]
  useMediaStore.getState().setTeachersList(list)
  expect(useMediaStore.getState().teachersList).toEqual(list)
})
```

- [ ] **Step 8: Update `tests/unit/use-now-playing.test.ts`**

Add `useTeachersStore` import and reset it in `beforeEach`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useMediaStore } from '@/lib/store/media-store'
import { useTeachersStore } from '@/lib/store/teachers-store'

class MockEventSource {
  static OPEN = 1
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()
  constructor(public url: string) {}
  simulateMessage(data: string) {
    this.onmessage?.({ data })
  }
  simulateError() {
    this.onerror?.()
  }
}

let mockES: MockEventSource

vi.stubGlobal('EventSource', vi.fn(function (url: string) {
  mockES = new MockEventSource(url)
  return mockES
}))

describe('useNowPlaying', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useMediaStore.setState({
      title: 'Reach Radio',
      artist: '',
      image: 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg',
    })
    useTeachersStore.setState({ teachersList: [] })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('updates store when SSE message arrives', () => {
    renderHook(() => useNowPlaying())

    act(() => {
      mockES.simulateMessage(JSON.stringify({ title: 'Test Show', artist: 'John Doe', image: 'https://cdn.sanity.io/img.jpg' }))
    })

    const { title, artist } = useMediaStore.getState()
    expect(title).toBe('Test Show')
    expect(artist).toBe('John Doe')
  })

  it('retains existing values on malformed SSE message', () => {
    renderHook(() => useNowPlaying())

    act(() => {
      mockES.simulateMessage('not-json')
    })

    expect(useMediaStore.getState().title).toBe('Reach Radio')
  })

  it('closes connection on error then retries after delay', async () => {
    renderHook(() => useNowPlaying())

    act(() => {
      mockES.simulateError()
    })

    // Error handler closes the current connection immediately before scheduling retry
    expect(mockES.close).toHaveBeenCalledTimes(1)

    // Advance past the 1s + up to 500ms jitter retry delay — a new EventSource is created
    act(() => {
      vi.advanceTimersByTime(1600)
    })

    expect(EventSource).toHaveBeenCalledTimes(2)
  })

  it('closes permanently after max retries exhausted', async () => {
    renderHook(() => useNowPlaying())
    const EventSourceSpy = vi.mocked(EventSource)

    // Exhaust 5 retries (delays: 1s, 2s, 4s, 8s, 16s = 31s total)
    for (let i = 0; i < 5; i++) {
      act(() => { mockES.simulateError() })
      act(() => { vi.advanceTimersByTime(32_000) })
    }

    const callsAfterExhaustion = EventSourceSpy.mock.calls.length

    // One more error after exhaustion should not create new EventSource
    act(() => { mockES.simulateError() })
    act(() => { vi.advanceTimersByTime(32_000) })

    expect(EventSourceSpy.mock.calls.length).toBe(callsAfterExhaustion)
  })
})
```

- [ ] **Step 9: Run all tests**

```bash
npm run test
```

Expected: all tests pass, no TypeScript errors

- [ ] **Step 10: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add src/lib/store/teachers-store.ts src/lib/store/media-store.ts src/hooks/useNowPlaying.ts tests/unit/teachers-store.test.ts tests/unit/media-store.test.ts tests/unit/use-now-playing.test.ts
git commit -m "refactor(player): extract teachersList into teachers-store"
```

---

### Task 2: AudioProvider — consolidate volume/isMuted effects

**Files:**
- Modify: `src/components/AudioProvider.tsx`

**Interfaces:**
- No API changes — internal-only refactor

The `volume` and `isMuted` effects both update `audioRef.current` properties on every change. Merging them into one effect eliminates a redundant DOM write on the tick where both change at once (e.g. `toggleMute` sets `isMuted=true` and `volume=0` atomically).

- [ ] **Step 1: Run existing tests first to establish baseline**

```bash
npm run test
```

Expected: all tests pass

- [ ] **Step 2: Consolidate effects in `src/components/AudioProvider.tsx`**

Replace the two single-property effects:

```typescript
// BEFORE — two effects:
useEffect(() => {
  if (audioRef.current) audioRef.current.volume = volume / 100
}, [volume])

useEffect(() => {
  if (audioRef.current) audioRef.current.muted = isMuted
}, [isMuted])
```

With one effect:

```typescript
// AFTER — one effect:
useEffect(() => {
  if (!audioRef.current) return
  audioRef.current.volume = volume / 100
  audioRef.current.muted = isMuted
}, [volume, isMuted])
```

- [ ] **Step 3: Run all tests**

```bash
npm run test
```

Expected: all tests pass

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/AudioProvider.tsx
git commit -m "refactor(player): consolidate volume and isMuted effects in AudioProvider"
```
