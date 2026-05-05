# Full Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Critical, Warning, and Suggestion findings from the Full Review of Reach Radio Next.js across security, a11y, performance, and code quality dimensions.

**Architecture:** Tasks 1–4 have no shared file writes and can run in parallel via `superpowers:dispatching-parallel-agents`. Task 5 (blurDataURL) is sequential and must run after Task 4 is merged (requires the `lqip` type added in Task 4). Read the spec at `docs/superpowers/specs/2026-05-04-full-review-fixes-design.md` for full context.

**Tech Stack:** Next.js 15 App Router (`use cache` + `cacheTag`), React `cache()`, Zustand, Tailwind CSS, Vitest, `@testing-library/react`, Sanity GROQ

---

## Task 1: Infrastructure — CSP + Revalidate Route

**Parallel safe: YES (no shared files with Tasks 2–4)**

**Files:**
- Modify: `next.config.ts`
- Modify: `src/app/api/revalidate/route.ts`
- Modify: `tests/unit/api-revalidate.test.ts`

---

- [ ] **Step 1.1: Write failing tests for the two route fixes**

Open `tests/unit/api-revalidate.test.ts`. Replace the file content entirely:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    process.env.SANITY_WEBHOOK_SECRET = 'test-secret'
  })

  it('returns 401 when secret header is missing', async () => {
    const { POST } = await import('@/app/api/revalidate/route')
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      body: JSON.stringify({ _type: 'teacher' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when secret header is wrong', async () => {
    const { POST } = await import('@/app/api/revalidate/route')
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'wrong' },
      body: JSON.stringify({ _type: 'teacher' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('calls revalidateTag("teachers") for teacher documents (no second arg)', async () => {
    const { revalidateTag } = await import('next/cache')
    const { POST } = await import('@/app/api/revalidate/route')
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: JSON.stringify({ _type: 'teacher' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith('teachers')
  })

  it('calls revalidateTag("settings") for appSettings documents', async () => {
    const { revalidateTag } = await import('next/cache')
    const { POST } = await import('@/app/api/revalidate/route')
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: JSON.stringify({ _type: 'appSettings' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith('settings')
  })

  it('returns revalidated: false for unknown document type', async () => {
    const { POST } = await import('@/app/api/revalidate/route')
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: JSON.stringify({ _type: 'unknownType' }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body.revalidated).toBe(false)
  })
})
```

- [ ] **Step 1.2: Run tests to confirm failure**

```bash
npx vitest run tests/unit/api-revalidate.test.ts
```

Expected: 2 new tests fail — "no second arg" and "appSettings documents".

- [ ] **Step 1.3: Fix `src/app/api/revalidate/route.ts`**

Replace the entire file:

```ts
import { revalidateTag } from 'next/cache'

const TAG_MAP: Record<string, string> = {
  teacher: 'teachers',
  schedule: 'schedule',
  settings: 'settings',
  appSettings: 'settings',
}

export async function POST(req: Request): Promise<Response> {
  const secret = req.headers.get('x-webhook-secret')

  if (!secret || secret !== process.env.SANITY_WEBHOOK_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { _type?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tag = body._type ? TAG_MAP[body._type] : undefined

  if (tag) {
    revalidateTag(tag)
    return Response.json({ revalidated: true, tag })
  }

  return Response.json({ revalidated: false, reason: 'unknown document type' })
}
```

- [ ] **Step 1.4: Run tests to confirm pass**

```bash
npx vitest run tests/unit/api-revalidate.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 1.5: Fix CSP in `next.config.ts`**

Change only the `media-src` line (line 35 in the current file):

```ts
// Before:
"media-src 'self'",

// After:
"media-src 'self' https://*.radiojar.com",
```

- [ ] **Step 1.6: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 1.7: Commit**

```bash
git add next.config.ts src/app/api/revalidate/route.ts tests/unit/api-revalidate.test.ts
git commit -m "fix(security): add radiojar to media-src CSP; fix revalidate tag map and args"
```

---

## Task 2: SSE / Audio / Store

**Parallel safe: YES (no shared files with Tasks 1, 3, 4)**

**Files:**
- Modify: `src/app/api/stream-info-sse/route.ts`
- Modify: `src/hooks/useNowPlaying.ts`
- Modify: `src/components/AudioProvider.tsx`
- Modify: `src/components/media-bar/MediaBar.tsx`
- Modify: `src/lib/store/media-store.ts`
- Modify: `src/components/SleepTimerProvider.tsx`
- Modify: `src/app/sleep-timer/SleepTimerClient.tsx`
- Modify: `tests/unit/use-now-playing.test.ts`
- Modify: `tests/unit/media-store.test.ts`
- Modify: `tests/unit/api-stream-info-sse.test.ts`

---

- [ ] **Step 2.1: Write failing test for SSE retry behavior**

Open `tests/unit/use-now-playing.test.ts`. Replace entire content:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useMediaStore } from '@/lib/store/media-store'

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

  it('does not close permanently on first error — retries after delay', async () => {
    renderHook(() => useNowPlaying())

    act(() => {
      mockES.simulateError()
    })

    // After first error, close is NOT called immediately — retry is scheduled
    expect(mockES.close).not.toHaveBeenCalled()

    // Advance past the 1s retry delay — a new EventSource is created
    act(() => {
      vi.advanceTimersByTime(1100)
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

- [ ] **Step 2.2: Write failing test for startSleepTimer store action**

Open `tests/unit/media-store.test.ts`. Replace entire content:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useMediaStore } from '@/lib/store/media-store'

describe('useMediaStore', () => {
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
      remainingSleepSeconds: 0,
    })
  })

  it('setIsPlaying updates isPlaying', () => {
    useMediaStore.getState().setIsPlaying(true)
    expect(useMediaStore.getState().isPlaying).toBe(true)
  })

  it('setIsBuffering updates isBuffering', () => {
    useMediaStore.getState().setIsBuffering(true)
    expect(useMediaStore.getState().isBuffering).toBe(true)
  })

  it('setNowPlaying updates title, artist, image', () => {
    useMediaStore.getState().setNowPlaying('Test Title', 'Test Artist', 'https://example.com/img.jpg')
    const { title, artist, image } = useMediaStore.getState()
    expect(title).toBe('Test Title')
    expect(artist).toBe('Test Artist')
    expect(image).toBe('https://example.com/img.jpg')
  })

  it('setShowMediaBar updates showMediaBar', () => {
    useMediaStore.getState().setShowMediaBar(true)
    expect(useMediaStore.getState().showMediaBar).toBe(true)
  })

  it('startSleepTimer sets remainingSleepSeconds and sleepTimerActive atomically', () => {
    useMediaStore.getState().startSleepTimer(1800)
    const { remainingSleepSeconds, sleepTimerActive } = useMediaStore.getState()
    expect(remainingSleepSeconds).toBe(1800)
    expect(sleepTimerActive).toBe(true)
  })

  it('startSleepTimer(0) activates timer with 0 seconds', () => {
    useMediaStore.getState().startSleepTimer(0)
    expect(useMediaStore.getState().sleepTimerActive).toBe(true)
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(0)
  })
})
```

- [ ] **Step 2.3: Run tests to confirm failures**

```bash
npx vitest run tests/unit/use-now-playing.test.ts tests/unit/media-store.test.ts
```

Expected: retry tests fail (onerror immediately closes), startSleepTimer test fails (method doesn't exist).

- [ ] **Step 2.4: Update `src/app/api/stream-info-sse/route.ts`**

Change only the interval value:

```ts
// Before:
const interval = setInterval(poll, 10_000)

// After:
const interval = setInterval(poll, 30_000)
```

Run `tests/unit/api-stream-info-sse.test.ts` to confirm no regression:

```bash
npx vitest run tests/unit/api-stream-info-sse.test.ts
```

Expected: 1 test passes (content-type check — interval value is not tested).

- [ ] **Step 2.5: Rewrite `src/hooks/useNowPlaying.ts` with backoff retry**

Replace entire file:

```ts
'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

const MAX_RETRIES = 5

export function useNowPlaying(): void {
  const setNowPlaying = useMediaStore((s) => s.setNowPlaying)

  useEffect(() => {
    let retries = 0
    let es: EventSource
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      es = new EventSource('/api/stream-info-sse')

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { title?: string; artist?: string; image?: string }
          const { title, artist, image } = useMediaStore.getState()
          setNowPlaying(
            data.title ?? title,
            data.artist ?? artist,
            data.image ?? image
          )
          retries = 0
        } catch {
          // retain existing values on parse error
        }
      }

      es.onerror = () => {
        es.close()
        if (retries >= MAX_RETRIES) return
        const delay = Math.pow(2, retries) * 1000
        retries++
        retryTimer = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      es.close()
    }
  }, [setNowPlaying])
}
```

- [ ] **Step 2.6: Add `startSleepTimer` to `src/lib/store/media-store.ts`**

Add to the `MediaState` interface after `setRemainingSleepSeconds`:

```ts
startSleepTimer: (seconds: number) => void
```

Add the implementation inside `create<MediaState>((set) => ({...}))` after `setRemainingSleepSeconds`:

```ts
startSleepTimer: (seconds) => set({ remainingSleepSeconds: seconds, sleepTimerActive: true }),
```

Full final file content for reference:

```ts
import { create } from 'zustand'

const DEFAULT_IMAGE = 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg'

interface MediaState {
  isPlaying: boolean
  isBuffering: boolean
  isMuted: boolean
  volume: number
  title: string
  artist: string
  image: string
  showMediaBar: boolean
  sleepTimerActive: boolean
  remainingSleepSeconds: number
  setIsPlaying: (v: boolean) => void
  setIsBuffering: (v: boolean) => void
  setIsMuted: (v: boolean) => void
  setVolume: (v: number) => void
  setNowPlaying: (title: string, artist: string, image: string) => void
  setShowMediaBar: (v: boolean) => void
  setSleepTimerActive: (active: boolean) => void
  setRemainingSleepSeconds: (s: number) => void
  startSleepTimer: (seconds: number) => void
}

export const useMediaStore = create<MediaState>((set) => ({
  isPlaying: false,
  isBuffering: false,
  isMuted: false,
  volume: 100,
  title: 'Reach Radio',
  artist: '',
  image: DEFAULT_IMAGE,
  showMediaBar: false,
  sleepTimerActive: false,
  remainingSleepSeconds: 0,
  setIsPlaying: (v) => set({ isPlaying: v }),
  setIsBuffering: (v) => set({ isBuffering: v }),
  setIsMuted: (v) => set({ isMuted: v }),
  setVolume: (v) => set({ volume: v, isMuted: v === 0 }),
  setNowPlaying: (title, artist, image) => set({ title, artist, image }),
  setShowMediaBar: (v) => set({ showMediaBar: v }),
  setSleepTimerActive: (active) => set({ sleepTimerActive: active }),
  setRemainingSleepSeconds: (s) => set({ remainingSleepSeconds: s }),
  startSleepTimer: (seconds) => set({ remainingSleepSeconds: seconds, sleepTimerActive: true }),
}))
```

- [ ] **Step 2.7: Run failing tests again to confirm they pass**

```bash
npx vitest run tests/unit/use-now-playing.test.ts tests/unit/media-store.test.ts
```

Expected: all tests pass.

- [ ] **Step 2.8: Move `useNowPlaying()` from `MediaBar` to `AudioProvider`**

In `src/components/AudioProvider.tsx`, replace entire file:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { useMediaStore } from '@/lib/store/media-store'
import { useNowPlaying } from '@/hooks/useNowPlaying'

interface AudioProviderProps {
  streamUrl: string
}

export function AudioProvider({ streamUrl }: AudioProviderProps) {
  useNowPlaying()
  const audioRef = useRef<HTMLAudioElement>(null)
  const isPlaying = useMediaStore((s) => s.isPlaying)
  const volume = useMediaStore((s) => s.volume)
  const isMuted = useMediaStore((s) => s.isMuted)
  const setIsBuffering = useMediaStore((s) => s.setIsBuffering)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (isPlaying) {
      el.play().catch((err: unknown) => {
        console.error('[AudioProvider] play failed:', err)
        setIsPlaying(false)
      })
    } else {
      el.pause()
    }
  }, [isPlaying, setIsPlaying])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100
  }, [volume])

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted
  }, [isMuted])

  return (
    <audio
      ref={audioRef}
      src={streamUrl}
      preload="none"
      onLoadStart={() => setIsBuffering(true)}
      onWaiting={() => setIsBuffering(true)}
      onPlaying={() => setIsBuffering(false)}
      onPause={() => {
        setIsPlaying(false)
        setIsBuffering(false)
      }}
      onError={() => {
        setIsPlaying(false)
        setIsBuffering(false)
      }}
    />
  )
}
```

- [ ] **Step 2.9: Remove `useNowPlaying()` from `src/components/media-bar/MediaBar.tsx`**

Replace entire file:

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

  if (!showMediaBar) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[var(--color-brand-gray)] border-t border-white/10 px-4 py-2 flex items-center gap-3 z-50">
      <NowPlayingInfo />
      <PlayPauseButton />
    </div>
  )
}
```

- [ ] **Step 2.10: Fix `SleepTimerProvider.tsx` dep array**

In `src/components/SleepTimerProvider.tsx`, change only the `useEffect` dependency array:

```tsx
// Before:
  }, [sleepTimerActive, setIsPlaying, setSleepTimerActive, setRemainingSleepSeconds])

// After:
  }, [sleepTimerActive])
```

- [ ] **Step 2.11: Update `SleepTimerClient.tsx` to use atomic action**

In `src/app/sleep-timer/SleepTimerClient.tsx`, replace the `start` function and store subscriptions:

```tsx
'use client'

import { useMediaStore } from '@/lib/store/media-store'

const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60]

export default function SleepTimerPage() {
  const active = useMediaStore((s) => s.sleepTimerActive)
  const remainingSeconds = useMediaStore((s) => s.remainingSleepSeconds)
  const startSleepTimer = useMediaStore((s) => s.startSleepTimer)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)

  function start(minutes: number) {
    startSleepTimer(minutes * 60)
  }

  function cancel() {
    setSleepTimerActive(false)
    setRemainingSleepSeconds(0)
  }

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60

  return (
    <div className="px-4 py-6 max-w-sm mx-auto text-center">
      <h1 className="text-white text-2xl font-bold mb-6">Sleep Timer</h1>

      {active ? (
        <div>
          <p
            className="text-white text-4xl font-mono mb-4"
            aria-live="polite"
            aria-atomic="true"
          >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
          <p className="text-white/60 text-sm mb-6">Radio will stop in {minutes}m {seconds}s</p>
          <button
            onClick={cancel}
            className="bg-red-600 text-white px-6 py-2 rounded font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            Cancel Timer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {TIMER_OPTIONS.map((mins) => (
            <button
              key={mins}
              onClick={() => start(mins)}
              className="bg-gray-700/50 text-white py-4 rounded font-medium hover:bg-gray-700/70 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              {mins}m
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2.12: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2.13: Commit**

```bash
git add src/app/api/stream-info-sse/route.ts src/hooks/useNowPlaying.ts src/components/AudioProvider.tsx src/components/media-bar/MediaBar.tsx src/lib/store/media-store.ts src/components/SleepTimerProvider.tsx src/app/sleep-timer/SleepTimerClient.tsx tests/unit/use-now-playing.test.ts tests/unit/media-store.test.ts
git commit -m "fix(sse): bounded retry backoff, 30s poll, move useNowPlaying to AudioProvider, atomic startSleepTimer"
```

---

## Task 3: UI Components

**Parallel safe: YES (no shared files with Tasks 1, 2, 4)**

**Files:**
- Modify: `src/components/home/RadioPlayer.tsx`
- Modify: `src/components/home/VolumeControl.tsx`
- Modify: `src/components/media-bar/PlayPauseButton.tsx`
- Modify: `src/components/home/SleepTimerOverlay.tsx`
- Modify: `src/components/teachers/TeacherCard.tsx`
- Modify: `src/components/teachers/SearchBar.tsx`

No new tests — all changes are CSS classes and semantic HTML structure. Existing `teacher-card.test.tsx` must still pass after TeacherCard edit.

---

- [ ] **Step 3.1: Fix `RadioPlayer.tsx` — image size, button semantics, observer cleanup**

Replace entire file:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'
import { PlayPauseButton } from '@/components/media-bar/PlayPauseButton'
import { VolumeControl } from './VolumeControl'
import { SleepTimerButton } from './SleepTimerButton'
import { SleepTimerOverlay } from './SleepTimerOverlay'

export function RadioPlayer() {
  const image = useMediaStore((s) => s.image)
  const title = useMediaStore((s) => s.title)
  const artist = useMediaStore((s) => s.artist)
  const isPlaying = useMediaStore((s) => s.isPlaying)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)
  const setShowMediaBar = useMediaStore((s) => s.setShowMediaBar)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowMediaBar(false)
        } else if (window.scrollY > 100) {
          setShowMediaBar(true)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      setShowMediaBar(false)
    }
  }, [setShowMediaBar])

  function togglePlay() {
    const next = !isPlaying
    setIsPlaying(next)
    postMessageToNative(JSON.stringify({ isPlaying: next }))
  }

  const altText = title ? `Now playing: ${title}${artist ? ` by ${artist}` : ''}` : 'Now playing album art'

  return (
    <div ref={containerRef} className="p-2 pb-5 md:p-5 bg-gray-700/50 rounded">
      <div className="relative flex items-center justify-center w-full">
        <SleepTimerOverlay />
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause radio' : 'Play radio'}
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded"
        >
          <Image
            src={image}
            alt={altText}
            width={420}
            height={420}
            className="max-w-[420px] max-h-64 rounded object-contain hover:opacity-90 transition-opacity"
            priority
          />
        </button>
      </div>
      <div className="flex flex-col items-center gap-4 mt-5">
        <div className="flex flex-col items-center gap-1 w-full px-2 text-center">
          <p className="text-white font-semibold text-lg leading-tight">{title}</p>
          {artist && <p className="text-white/70 text-sm">{artist}</p>}
        </div>
        <div className="flex gap-8 items-center justify-center">
          <PlayPauseButton />
          <SleepTimerButton />
          <VolumeControl />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.2: Fix `VolumeControl.tsx` — touch target + focus rings**

Replace entire file:

```tsx
'use client'

import { useMediaStore } from '@/lib/store/media-store'

export function VolumeControl() {
  const volume = useMediaStore((s) => s.volume)
  const isMuted = useMediaStore((s) => s.isMuted)
  const setVolume = useMediaStore((s) => s.setVolume)
  const setIsMuted = useMediaStore((s) => s.setIsMuted)

  function toggleMute() {
    setIsMuted(!isMuted)
  }

  return (
    <>
      {/* Mobile: mute button only */}
      <button
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        className="md:hidden w-11 h-11 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-white rounded-full"
      >
        <VolumeIcon muted={isMuted} volume={volume} />
      </button>

      {/* Desktop: full slider */}
      <div className="hidden md:flex items-center gap-2 w-28">
        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className="flex-shrink-0 focus-visible:ring-2 focus-visible:ring-white rounded"
        >
          <VolumeIcon muted={isMuted} volume={volume} />
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full accent-white focus-visible:ring-2 focus-visible:ring-white rounded"
          aria-label="Volume"
        />
      </div>
    </>
  )
}

function VolumeIcon({ muted, volume }: { muted: boolean; volume: number }) {
  if (muted || volume === 0) {
    return (
      <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      </svg>
    )
  }
  return (
    <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
    </svg>
  )
}
```

- [ ] **Step 3.3: Fix `PlayPauseButton.tsx` — touch target**

Change only the button class:

```tsx
// Before:
className="w-10 h-10 rounded-full bg-[var(--color-brand-green)] flex items-center justify-center flex-shrink-0"

// After:
className="w-11 h-11 rounded-full bg-[var(--color-brand-green)] flex items-center justify-center flex-shrink-0"
```

- [ ] **Step 3.4: Fix `SleepTimerOverlay.tsx` — role, label, cancel button style**

Replace entire file:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

export function SleepTimerOverlay() {
  const active = useMediaStore((s) => s.sleepTimerActive)
  const seconds = useMediaStore((s) => s.remainingSleepSeconds)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (active) cancelBtnRef.current?.focus()
  }, [active])

  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSleepTimerActive(false)
        setRemainingSleepSeconds(0)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, setSleepTimerActive, setRemainingSleepSeconds])

  if (!active) return null

  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60

  function cancel() {
    setSleepTimerActive(false)
    setRemainingSleepSeconds(0)
  }

  return (
    <div
      role="dialog"
      aria-label="Sleep timer active"
      className="absolute inset-0 z-10 bg-black/80 rounded flex flex-col items-center justify-center gap-4"
    >
      <p
        className="text-white text-4xl font-mono"
        aria-live="polite"
        aria-atomic="true"
      >
        {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </p>
      <button
        ref={cancelBtnRef}
        onClick={cancel}
        aria-label="Cancel sleep timer"
        className="bg-white/20 text-white px-4 py-2 rounded text-sm hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        Cancel
      </button>
    </div>
  )
}
```

- [ ] **Step 3.5: Fix `TeacherCard.tsx` — motion-safe guard**

Change only the Link className. Replace `hover:scale-105` with `motion-safe:hover:scale-105`:

```tsx
// Before:
className="block rounded overflow-hidden border border-green-700 [box-shadow:0_0_28px_-10px_#517987] hover:scale-105 transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"

// After:
className="block rounded overflow-hidden border border-green-700 [box-shadow:0_0_28px_-10px_#517987] motion-safe:hover:scale-105 transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
```

- [ ] **Step 3.6: Fix `SearchBar.tsx` — submit button touch target**

Change the submit button className to add `min-h-[44px]`:

```tsx
// Before:
className="bg-[var(--color-brand-green)] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"

// After:
className="bg-[var(--color-brand-green)] text-white px-4 py-2 min-h-[44px] rounded text-sm font-medium disabled:opacity-50"
```

- [ ] **Step 3.7: Run existing tests to confirm no regressions**

```bash
npx vitest run tests/unit/teacher-card.test.tsx
```

Expected: all 4 tests pass.

- [ ] **Step 3.8: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3.9: Commit**

```bash
git add src/components/home/RadioPlayer.tsx src/components/home/VolumeControl.tsx src/components/media-bar/PlayPauseButton.tsx src/components/home/SleepTimerOverlay.tsx src/components/teachers/TeacherCard.tsx src/components/teachers/SearchBar.tsx
git commit -m "fix(ui): 44px touch targets, motion-safe scale, a11y semantics on radio player controls"
```

---

## Task 4: Pages + Types + Queries + EventSchema

**Parallel safe: YES (no shared files with Tasks 1, 2, 3)**

**Files:**
- Modify: `src/lib/sanity/types.ts`
- Modify: `src/lib/sanity/queries.ts`
- Modify: `src/app/teachers/page.tsx`
- Modify: `src/app/teachers/search/page.tsx`
- Modify: `src/app/teachers/[slug]/page.tsx`
- Modify: `src/app/scheduled-list/page.tsx`
- Create: `src/components/seo/EventSchema.tsx`
- Modify: `tests/unit/sanity-queries.test.ts`

---

- [ ] **Step 4.1: Write failing test for EventSchema component**

Create `tests/unit/event-schema.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { EventSchema } from '@/components/seo/EventSchema'

const events = [
  { name: 'Grace to You', startTime: '9:00 AM', endTime: '10:00 AM', day: 'Sunday' },
  { name: 'Through the Bible', startTime: '7:00 AM', endTime: '7:30 AM', day: 'Monday' },
]

describe('EventSchema', () => {
  it('renders a script tag with type application/ld+json', () => {
    const { container } = render(<EventSchema events={events} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeTruthy()
  })

  it('renders an ItemList with correct number of ListItems', () => {
    const { container } = render(<EventSchema events={events} />)
    const script = container.querySelector('script[type="application/ld+json"]')!
    const json = JSON.parse(script.innerHTML)
    expect(json['@type']).toBe('ItemList')
    expect(json.itemListElement).toHaveLength(2)
  })

  it('each ListItem has Event type with name and organizer', () => {
    const { container } = render(<EventSchema events={events} />)
    const script = container.querySelector('script[type="application/ld+json"]')!
    const json = JSON.parse(script.innerHTML)
    const first = json.itemListElement[0].item
    expect(first['@type']).toBe('Event')
    expect(first.name).toBe('Grace to You')
    expect(first.organizer.name).toBe('Reach Radio')
  })
})
```

- [ ] **Step 4.2: Write failing test for lqip in queries**

Open `tests/unit/sanity-queries.test.ts`. Replace entire content:

```ts
import { describe, it, expect } from 'vitest'
import { teacherListQuery, teacherDetailQuery, scheduleQuery, teacherSearchQuery, fullScheduleQuery } from '@/lib/sanity/queries'

describe('GROQ queries', () => {
  it('teacherListQuery is a non-empty string', () => {
    expect(typeof teacherListQuery).toBe('string')
    expect(teacherListQuery.length).toBeGreaterThan(0)
    expect(teacherListQuery).toContain('_type == "teacher"')
  })

  it('teacherDetailQuery includes slug param', () => {
    expect(teacherDetailQuery).toContain('$slug')
  })

  it('scheduleQuery includes day param', () => {
    expect(scheduleQuery).toContain('$day')
  })

  it('teacherListQuery includes lqip projection', () => {
    expect(teacherListQuery).toContain('lqip')
  })

  it('teacherDetailQuery includes lqip projection', () => {
    expect(teacherDetailQuery).toContain('lqip')
  })

  it('teacherSearchQuery includes lqip projection', () => {
    expect(teacherSearchQuery).toContain('lqip')
  })
})
```

- [ ] **Step 4.3: Run tests to confirm failures**

```bash
npx vitest run tests/unit/event-schema.test.tsx tests/unit/sanity-queries.test.ts
```

Expected: EventSchema fails (file not found), lqip tests fail.

- [ ] **Step 4.4: Update `src/lib/sanity/types.ts`**

Replace entire file:

```ts
export interface TeacherSummary {
  name: string
  slug: string
  title: string
  photo: string
  lqip?: string
}

export interface ScheduleTime {
  startTime: string
  endTime: string
}

export interface ScheduleDay {
  day: string
  times: ScheduleTime[]
}

export interface TeacherDetail extends TeacherSummary {
  subtitle: string | null
  links: { title: string; url: string }[]
  schedule: ScheduleDay[]
}

export interface ScheduleTeacher {
  name: string
  slug: string
  title: string
  photo: string
  time: string
  startTime: string
  endTime: string
}

export type TeacherWithSchedule = TeacherSummary & { schedule: ScheduleDay[] }

export interface NowPlaying {
  title: string
  artist: string
}
```

- [ ] **Step 4.5: Update `src/lib/sanity/queries.ts` — add lqip projections**

Replace entire file:

```ts
export const teacherListQuery = `
  *[_type == "teacher"] | order(name.last asc) {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    "photo": photo.asset->url,
    "lqip": photo.asset->metadata.lqip
  }
`

export const teacherSearchQuery = `
  *[_type == "teacher" && (
    name.first match $query ||
    name.last match $query ||
    title match $query
  )] | order(name.last asc) {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    "photo": photo.asset->url,
    "lqip": photo.asset->metadata.lqip
  }
`

export const teacherDetailQuery = `
  *[_type == "teacher" && slug.current == $slug][0] {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    subtitle,
    "photo": photo.asset->url,
    "lqip": photo.asset->metadata.lqip,
    links[] { title, url },
    schedule[] {
      day,
      times[] { startTime, endTime }
    }
  }
`

export const teacherSlugsQuery = `
  *[_type == "teacher"] { "slug": slug.current }
`

export const scheduleQuery = `
  *[_type == "teacher" && count(schedule[day == $day]) > 0] {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    "photo": photo.asset->url,
    "schedule": schedule[day == $day] {
      day,
      times[] { startTime, endTime }
    }
  }
`

export const fullScheduleQuery = `
  *[_type == "teacher" && count(schedule) > 0] | order(name.last asc) {
    "name": name.first + " " + name.last,
    "slug": slug.current,
    title,
    "photo": photo.asset->url,
    schedule[] {
      day,
      times[] { startTime, endTime }
    }
  }
`
```

- [ ] **Step 4.6: Create `src/components/seo/EventSchema.tsx`**

```tsx
interface EventItem {
  name: string
  startTime: string
  endTime: string
  day: string
}

interface Props {
  events: EventItem[]
}

export function EventSchema({ events }: Props) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Event',
        name: event.name,
        description: `${event.day} ${event.startTime}–${event.endTime}`,
        organizer: {
          '@type': 'Organization',
          name: 'Reach Radio',
          url: 'https://reach-radio.com',
        },
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

- [ ] **Step 4.7: Fix `src/app/teachers/[slug]/page.tsx` — deduplicate fetch with React cache**

Replace entire file:

```tsx
import { cache, ViewTransition } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherDetailQuery, teacherSlugsQuery } from '@/lib/sanity/queries'
import type { TeacherDetail } from '@/lib/sanity/types'
import { PersonSchema } from '@/components/seo/PersonSchema'

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
  return {
    title: teacher.name,
    description: `${teacher.title} on Reach Radio Tucson`,
    openGraph: {
      images: teacher.photo ? [{ url: teacher.photo }] : [],
    },
  }
}

export default async function TeacherDetailPage({ params }: Props) {
  const { slug } = await params
  const teacher = await getTeacher(slug)

  if (!teacher) notFound()

  const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const sortedSchedule = [...(teacher.schedule ?? [])].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
  )

  return (
    <div>
      <div className="px-4 py-4">
        <Link
          href="/teachers"
          transitionTypes={['nav-back']}
          className="text-white/60 text-sm hover:text-white inline-flex items-center gap-1"
        >
          <span aria-hidden="true">←</span> Teachers
        </Link>
      </div>

      <PersonSchema
        name={teacher.name}
        jobTitle={teacher.title}
        imageUrl={teacher.photo}
        url={`https://reach-radio.com/teachers/${teacher.slug}`}
      />

      <div className="grid md:grid-cols-2 grid-cols-1 gap-x-16 gap-y-5 text-white">
        {teacher.photo && (
          <ViewTransition name={`teacher-${teacher.slug}`}>
            <Image
              src={teacher.photo}
              alt={teacher.name}
              width={600}
              height={600}
              className="w-full md:rounded-br-3xl aspect-square object-cover"
              placeholder={teacher.lqip ? 'blur' : 'empty'}
              blurDataURL={teacher.lqip}
              priority
            />
          </ViewTransition>
        )}

        <div className="md:mt-5 md:px-0 md:pr-3 px-3">
          <h1 className="text-4xl">{teacher.name}</h1>
          {teacher.title && (
            <h2 className="uppercase font-bold mt-1 text-white/80">
              {teacher.title}{teacher.subtitle ? `: ${teacher.subtitle}` : ''}
            </h2>
          )}

          {teacher.links && teacher.links.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {teacher.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[var(--color-brand-green)] text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {link.title}
                </a>
              ))}
            </div>
          )}

          {sortedSchedule.length > 0 && (
            <div className="mt-6">
              <h2 className="text-2xl mb-3">Schedule</h2>
              {sortedSchedule.map((day) => (
                <div key={day.day} className="mb-5">
                  <h3 className="font-bold text-lg mb-2">{day.day}</h3>
                  <div className="flex flex-col gap-2">
                    {day.times.map((t, i) => (
                      <div key={i} className="bg-gray-700 p-3 rounded text-sm">
                        {t.startTime} – {t.endTime}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4.8: Fix `src/app/teachers/search/page.tsx` — Suspense fallback, aria-live, robots**

Replace entire file:

```tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherSearchQuery } from '@/lib/sanity/queries'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { TeacherGridSkeleton } from '@/components/skeletons/TeacherCardSkeleton'
import { SearchBar } from '@/components/teachers/SearchBar'
import Link from 'next/link'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Teacher Search',
  description: 'Search for Bible teachers on Reach Radio Tucson.',
  robots: { index: false },
}

interface Props {
  searchParams: Promise<{ q?: string }>
}

async function SearchResults({ searchParams }: { searchParams: Props['searchParams'] }) {
  const { q = '' } = await searchParams
  const query = q.trim().slice(0, 100)

  const teachers = query.length > 0
    ? await sanityFetch<TeacherSummary[]>(teacherSearchQuery, { query: `*${query}*` })
    : []

  return (
    <>
      <div aria-live="polite" aria-atomic="true">
        {query && (
          <p className="text-white/60 text-sm mb-4">
            {teachers.length} result{teachers.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>
      {teachers.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {teachers.map((teacher) => (
            <TeacherCard key={teacher.slug} teacher={teacher} />
          ))}
        </div>
      ) : query ? (
        <p className="text-white/60">No teachers found.</p>
      ) : null}
    </>
  )
}

export default function TeacherSearchPage({ searchParams }: Props) {
  return (
    <div className="px-4 py-6">
      <Link href="/teachers" aria-label="All Teachers" className="text-white/60 text-sm mb-4 block hover:text-white">
        <span aria-hidden="true">←</span> All Teachers
      </Link>
      <SearchBar />
      <Suspense fallback={<TeacherGridSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 4.9: Fix `src/app/teachers/page.tsx` — SearchBar Suspense fallback**

Change only the first `<Suspense>` to add a fallback:

```tsx
// Before:
      <Suspense>
        <SearchBar />
      </Suspense>

// After:
      <Suspense fallback={<div className="h-[52px] mb-6" />}>
        <SearchBar />
      </Suspense>
```

- [ ] **Step 4.10: Fix `src/app/scheduled-list/page.tsx` — remove RawTeacher, fix image, add empty state, add EventSchema**

Replace entire file:

```tsx
import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherWithSchedule } from '@/lib/sanity/types'
import { EventSchema } from '@/components/seo/EventSchema'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Full Schedule',
  description: 'Full programming schedule for Reach Radio 106.7FM / 690AM',
}

export const revalidate = 86400

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function ScheduledListPage() {
  const teachers = await sanityFetch<TeacherWithSchedule[]>(
    fullScheduleQuery,
    {},
    { tags: ['schedule'] }
  )

  const byDay = DAYS.map((day) => ({
    day,
    slots: teachers
      .flatMap((t) =>
        (t.schedule ?? [])
          .filter((s) => s.day === day)
          .flatMap((s) =>
            s.times.map((time) => ({
              name: t.name,
              slug: t.slug,
              title: t.title,
              photo: t.photo,
              startTime: time.startTime,
              endTime: time.endTime,
            }))
          )
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  })).filter((d) => d.slots.length > 0)

  const allEvents = byDay.flatMap(({ day, slots }) =>
    slots.map((slot) => ({
      name: slot.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      day,
    }))
  )

  return (
    <div className="px-4 py-6">
      <EventSchema events={allEvents} />
      <h1 className="text-white text-2xl font-bold mb-6">Full Schedule</h1>
      {byDay.length === 0 ? (
        <p className="text-white/60">No schedule available.</p>
      ) : (
        <div className="space-y-8">
          {byDay.map(({ day, slots }) => (
            <section key={day}>
              <h2 className="text-white font-semibold text-lg mb-3">{day}</h2>
              <ul className="space-y-2">
                {slots.map((slot) => (
                  <li key={`${slot.slug}-${slot.startTime}`}>
                    <Link
                      href={`/teachers/${slot.slug}`}
                      className="flex items-center gap-3 p-3 bg-gray-700/30 rounded hover:bg-gray-700/50 transition-colors"
                    >
                      {slot.photo && (
                        <Image
                          src={slot.photo}
                          alt={slot.name}
                          width={40}
                          height={40}
                          style={{ width: 40, height: 40 }}
                          className="rounded-full object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{slot.name}</p>
                        <p className="text-white/80 text-xs truncate">{slot.title}</p>
                      </div>
                      <span className="text-white/50 text-xs flex-shrink-0">
                        {slot.startTime} – {slot.endTime}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4.11: Run failing tests to confirm they now pass**

```bash
npx vitest run tests/unit/event-schema.test.tsx tests/unit/sanity-queries.test.ts
```

Expected: all tests pass.

- [ ] **Step 4.12: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4.13: Commit**

```bash
git add src/lib/sanity/types.ts src/lib/sanity/queries.ts src/app/teachers/page.tsx src/app/teachers/search/page.tsx "src/app/teachers/[slug]/page.tsx" src/app/scheduled-list/page.tsx src/components/seo/EventSchema.tsx tests/unit/event-schema.test.tsx tests/unit/sanity-queries.test.ts
git commit -m "fix(pages): dedupe teacher fetch, Suspense fallbacks, aria-live, EventSchema, noindex search"
```

---

## Task 5: TeacherCard placeholder blur (sequential — run after Task 4 is merged)

**Sequential: YES — requires `lqip?: string` on `TeacherSummary` from Task 4**

**Files:**
- Modify: `src/components/teachers/TeacherCard.tsx`

---

- [ ] **Step 5.1: Verify Task 4 is merged**

```bash
git log --oneline -5
```

Confirm `fix(pages): dedupe teacher fetch...` commit is present.

- [ ] **Step 5.2: Add blurDataURL to `TeacherCard.tsx`**

In the `<Image>` inside the `<ViewTransition>`, add two new props after `height={300}`:

```tsx
// Before:
          <Image
            src={teacher.photo}
            alt={teacher.name}
            width={300}
            height={300}
            className="w-full aspect-square object-cover"
          />

// After:
          <Image
            src={teacher.photo}
            alt={teacher.name}
            width={300}
            height={300}
            className="w-full aspect-square object-cover"
            placeholder={teacher.lqip ? 'blur' : 'empty'}
            blurDataURL={teacher.lqip}
          />
```

- [ ] **Step 5.3: Run teacher-card tests**

```bash
npx vitest run tests/unit/teacher-card.test.tsx
```

Expected: all 4 existing tests pass (lqip is optional, test fixture doesn't include it).

- [ ] **Step 5.4: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add src/components/teachers/TeacherCard.tsx
git commit -m "fix(ui): add placeholder blur to teacher cards using Sanity lqip"
```

---

## Verification

After all tasks are complete and merged:

```bash
npx vitest run
npx tsc --noEmit
```

Expected: zero test failures, zero TypeScript errors.
