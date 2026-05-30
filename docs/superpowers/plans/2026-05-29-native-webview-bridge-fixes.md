# Native WebView Bridge — Fix & Forward-Compat Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all known bridge gaps between the Next.js web app and the iOS/Android native WebViews before switching the native apps from the Astro URL to the Next.js URL.

**Architecture:** All changes are web/server-side only — no native app updates required. Six independent work items: audio stream proxy timeout fix, native detection middleware, BridgeInit gap fixes (loaded signal, showMediaBar routing, focus/blur keyboard hiding, streamUrl threading), postMessage protocol versioning, and a native-config API endpoint for future rebuilt apps.

**Tech Stack:** Next.js App Router, TypeScript strict, Vitest, React Testing Library, no existing tests to follow — establish patterns here.

---

## Background

Both native apps (iOS Swift/WKWebView, Android Kotlin/WebView) are hardcoded to the Astro URL (`reach-radio-web.pages.dev`). Next.js bridge layer is built but has gaps. Fix all gaps first, then switch URL.

Key constraint: iOS native audio is hardcoded to `reach-radio-web.pages.dev/api/audio-stream`. **Do not shut down Astro.** Keep it alive indefinitely.

## Project Ownership Map

| Issue | Fixable in | Repo |
|-------|-----------|------|
| Audio stream 10s timeout | **Web (server-side)** | `reach-radio-nextjs` |
| `{ loaded: true }` not sent | **Web (client-side)** | `reach-radio-nextjs` |
| `{ showMediaBar }` on route change | **Web (client-side)** | `reach-radio-nextjs` |
| Focus/blur → showMobileNav | **Web (client-side)** | `reach-radio-nextjs` |
| `streamUrl` not sent in bridge | **Web (client-side)** | `reach-radio-nextjs` |
| `protocolVersion` missing | **Web (client-side)** | `reach-radio-nextjs` |
| Native detection via cookie | **Web (server-side)** | `reach-radio-nextjs` |
| `/api/native-config` endpoint | **Web (server-side)** | `reach-radio-nextjs` |
| iOS hardcoded stream URL | **Native (iOS)** | `reach-radio-native-ios` — requires app update |
| iOS 2s timed splash | **Native (iOS)** | `reach-radio-native-ios` — requires app update |
| iOS `scheduleBufferingEnd()` guard bug | **Native (iOS)** | `reach-radio-native-ios` — requires app update |
| iOS `handleRefresh` retain cycle risk | **Native (iOS)** | `reach-radio-native-ios` — requires app update |
| Android `up.history.location` pre-hydration | **Native (Android)** | `reach-radio-native-android` — requires app update |
| Android `isBuffering=true` sets `isPlaying=false` | **Native (Android)** | `reach-radio-native-android` — requires app update |
| Android back button no-exit at SPA root | **Native (Android)** | `reach-radio-native-android` — requires app update |
| Android `goToPage('$path')` string interpolation | **Native (Android)** | `reach-radio-native-android` — requires app update |

---

## Known WebView Platform Issues Addressed

| Issue | Platform | Status | Task |
|-------|----------|--------|------|
| Android splash never dismisses without `{ loaded: true }` | Android | Not fixed | T3 |
| Native media bar stuck after route change | Both | Not fixed | T3 |
| Keyboard overlaps native nav when input focused | Both | Not fixed | T3 |
| Audio proxy kills stream after 10s (`AbortSignal.timeout`) | Both | **Active bug** | T1 |
| Native detection breaks on deep links / refresh | Both | Not fixed | T2 |
| Next.js serverless platforms cap response duration (30s–5min) | Both | Noted | T1 |
| iOS never calls `globalState.isPlaying.set()` — web play button desync | iOS | App-side fix needed (future) | N/A |
| iOS splash is 2s timer, not message-driven — can mis-time | iOS | App-side fix needed (future) | N/A |
| `up.history.location` returns null pre-hydration on Android | Android | Handled natively (null check) | N/A |

## File Map

| File | Action | Task |
|------|--------|------|
| `src/app/api/audio-stream/route.ts` | Modify — fix timeout bug | T1 |
| `src/middleware.ts` | Create — native detection cookie | T2 |
| `src/app/layout.tsx` | Modify — read cookie for detection | T2 |
| `src/components/bridge/BridgeInit.tsx` | Modify — 4 bridge gaps + streamUrl | T3 |
| `src/lib/bridge/post-message.ts` | Modify — add protocolVersion | T4 |
| `src/app/api/native-config/route.ts` | Create — config endpoint | T5 |
| `src/app/api/audio-stream/route.test.ts` | Create — timeout unit tests | T1 |
| `src/middleware.test.ts` | Create — cookie tests | T2 |
| `src/lib/bridge/post-message.test.ts` | Create — versioning tests | T4 |
| `src/app/api/native-config/route.test.ts` | Create — endpoint tests | T5 |

---

## Task 1: Fix Audio Stream Proxy Timeout

**Why:** `AbortSignal.timeout(10_000)` cancels the entire fetch after 10s, including the open stream. A live radio stream never ends, so this kills audio every 10 seconds for any native user once we switch to the Next.js URL. Astro's proxy has no timeout and works fine.

**Constraint:** Serverless platforms (Cloudflare Pages, Vercel) impose their own response duration limits, typically 30s–5min. This fix resolves the 10s code bug; the platform limit is a separate concern and acceptable since native apps reconnect on stream drop.

**Files:**
- Modify: `src/app/api/audio-stream/route.ts`
- Create: `src/app/api/audio-stream/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/audio-stream/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('GET /api/audio-stream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('clears the abort timeout after connection succeeds', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const mockBody = new ReadableStream()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockBody,
      headers: { get: () => 'audio/mpeg' },
    })

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(200)
    // clearTimeout should be called once after connection succeeds
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
  })

  it('aborts and returns 502 if connection takes more than 10 seconds', async () => {
    let capturedSignal: AbortSignal | undefined
    mockFetch.mockImplementationOnce((_url: string, opts: { signal?: AbortSignal }) => {
      capturedSignal = opts?.signal
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })

    const { GET } = await import('./route')
    const responsePromise = GET()

    // Advance time past 10s to trigger the connection timeout
    vi.advanceTimersByTime(11_000)

    const response = await responsePromise
    expect(response.status).toBe(502)
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('returns 502 when upstream responds with non-ok status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, body: null, headers: { get: () => null } })

    const { GET } = await import('./route')
    const response = await GET()
    expect(response.status).toBe(502)
  })

  it('proxies audio/mpeg content-type from upstream', async () => {
    const mockBody = new ReadableStream()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockBody,
      headers: { get: (h: string) => h === 'content-type' ? 'audio/mpeg' : null },
    })

    const { GET } = await import('./route')
    const response = await GET()
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/app/api/audio-stream/route.test.ts
```

Expected: FAIL — `clearTimeout` not called (current code uses `AbortSignal.timeout` which doesn't call clearTimeout).

- [ ] **Step 3: Replace the proxy implementation**

Replace `src/app/api/audio-stream/route.ts` entirely:

```ts
const STREAM_URL = 'http://stream.radiojar.com/g4d600bv6p5tv'

export async function GET(): Promise<Response> {
  const controller = new AbortController()
  const connectTimeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const upstream = await fetch(STREAM_URL, { signal: controller.signal })
    clearTimeout(connectTimeout) // connected — don't abort the open stream

    if (!upstream.ok || !upstream.body) {
      return new Response('Upstream error', { status: 502 })
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return new Response('Stream unavailable', { status: 502 })
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/app/api/audio-stream/route.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/audio-stream/route.ts src/app/api/audio-stream/route.test.ts
git commit -m "fix(audio-stream): apply timeout to connection only, not stream duration"
```

---

## Task 2: Add Middleware for Robust Native Detection

**Why:** Current detection reads `mobile-app: true` header only at initial SSR in `layout.tsx`. Next.js App Router layouts re-render on full page loads but not on SPA navigation. If a user deep-links or the WebView somehow loses the header (e.g., redirect chain), `isMobileApp` flips to false and `AudioProvider`, `Header`, etc. get rendered — breaking the native experience. A server-set cookie persists across the session.

**Files:**
- Create: `src/middleware.ts`
- Modify: `src/app/layout.tsx` (lines 89–90)
- Create: `src/middleware.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/middleware.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

function makeRequest(path: string, headers: Record<string, string> = {}): NextRequest {
  const url = new URL(`http://localhost${path}`)
  return new NextRequest(url, { headers })
}

describe('middleware', () => {
  it('sets mobile-app cookie when mobile-app header is present', async () => {
    const req = makeRequest('/about', { 'mobile-app': 'true' })
    const res = await middleware(req)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('mobile-app=true')
    expect(setCookie).toContain('Max-Age=31536000')
    expect(setCookie).toContain('HttpOnly')
  })

  it('does not set mobile-app cookie when header is absent', async () => {
    const req = makeRequest('/about')
    const res = await middleware(req)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeNull()
  })

  it('passes through requests without modification when no mobile-app header', async () => {
    const req = makeRequest('/teachers')
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/middleware.test.ts
```

Expected: FAIL — `src/middleware.ts` does not exist.

- [ ] **Step 3: Create the middleware**

Create `src/middleware.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next()

  if (request.headers.get('mobile-app') === 'true') {
    response.cookies.set('mobile-app', 'true', {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/middleware.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Update layout.tsx to check cookie alongside header**

In `src/app/layout.tsx`, replace line 90:

```ts
// Before
const isMobileApp = headersList.get('mobile-app') === 'true'
```

```ts
// After
const cookieHeader = headersList.get('cookie') ?? ''
const isMobileApp =
  headersList.get('mobile-app') === 'true' ||
  cookieHeader.split(';').some(c => c.trim() === 'mobile-app=true')
```

- [ ] **Step 6: Run full test suite to check no regressions**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/middleware.ts src/middleware.test.ts src/app/layout.tsx
git commit -m "feat(bridge): add middleware to persist native app detection via cookie"
```

---

## Task 3: Fix BridgeInit — Four Bridge Gaps + streamUrl

**Why:** Four messages that native apps need are missing from `BridgeInit.tsx`:
- `{ loaded: true }` — Android splash screen never dismisses without this (Gap 1, critical)
- `{ showMediaBar: bool }` on route change — native media bar stays stuck in last state (Gap 3)
- focusin/focusout → `{ showMobileNav, showMediaBar }` — keyboard overlaps native nav (Gap 4)
- `streamUrl` — zero-cost forward compat; current apps ignore it, rebuilt apps will use it (T2)

**Files:**
- Modify: `src/components/bridge/BridgeInit.tsx`
- Modify: `src/app/layout.tsx` (pass `streamUrl` prop to `BridgeInit`)

- [ ] **Step 1: Update BridgeInit component signature and add all four fixes**

Replace `src/components/bridge/BridgeInit.tsx` entirely:

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { initBridgeProxy } from '@/lib/bridge/proxy'
import { initUnpolyShim } from '@/lib/bridge/compat'
import { postMessageToNative } from '@/lib/bridge/post-message'

interface BridgeInitProps {
  streamUrl?: string
}

export function BridgeInit({ streamUrl }: BridgeInitProps) {
  const router = useRouter()
  const pathname = usePathname()

  // On mount: init bridge, send loaded + streamUrl, wire online/offline
  useEffect(() => {
    initUnpolyShim()
    initBridgeProxy(router)

    postMessageToNative(JSON.stringify({
      loaded: true,
      ...(streamUrl ? { streamUrl } : {}),
    }))

    const handleOnline = () => postMessageToNative(JSON.stringify({ offline: false }))
    const handleOffline = () => postMessageToNative(JSON.stringify({ offline: true }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [router, streamUrl])

  // On route change: send location + showMediaBar state
  useEffect(() => {
    postMessageToNative(JSON.stringify({ location: pathname }))
    postMessageToNative(JSON.stringify({ showMediaBar: pathname !== '/' }))
  }, [pathname])

  // Input focus/blur: hide native nav when keyboard appears, restore after
  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return
      postMessageToNative(JSON.stringify({ showMobileNav: false, showMediaBar: false }))
    }
    function onFocusOut(e: FocusEvent) {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return
      postMessageToNative(JSON.stringify({ showMobileNav: true, showMediaBar: pathname !== '/' }))
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [pathname])

  // Native app detection fallback: set cookie when any native message arrives
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.origin !== '' && e.origin !== window.location.origin) return
      if (!document.cookie.includes('mobile-app=true')) {
        document.cookie = 'mobile-app=true; path=/; max-age=315360000'
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return null
}
```

- [ ] **Step 2: Thread streamUrl from layout to BridgeInit**

In `src/app/layout.tsx`, find the `<BridgeInit />` line and pass the prop:

```tsx
// Before
<BridgeInit />

// After
<BridgeInit streamUrl={streamUrl} />
```

(`streamUrl` is already computed at line 101 of `layout.tsx` — no other layout changes needed.)

- [ ] **Step 3: Run type check to confirm no TS errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Start dev server and manually verify messages fire**

```bash
npm run dev
```

Open browser DevTools console on `http://localhost:3000`. Add a temporary spy:

```js
// paste in console
const orig = window.Android;
window.Android = { postMessage: (msg) => { console.log('[bridge]', JSON.parse(msg)); orig?.postMessage(msg); } };
```

Navigate between pages — expect to see `{ location, showMediaBar }` messages in console.
Focus a search input — expect `{ showMobileNav: false, showMediaBar: false }`.
Blur it — expect `{ showMobileNav: true, showMediaBar: ... }`.

- [ ] **Step 5: Commit**

```bash
git add src/components/bridge/BridgeInit.tsx src/app/layout.tsx
git commit -m "fix(bridge): send loaded, showMediaBar, focus/blur messages; thread streamUrl"
```

---

## Task 4: Add protocolVersion to All Outgoing Bridge Messages

**Why:** Current native apps ignore unknown JSON fields — adding `protocolVersion: 1` is backward-compatible. Future rebuilt apps can read this and show a "please update" prompt if the protocol version exceeds what they support. Zero risk, high future value.

**Files:**
- Modify: `src/lib/bridge/post-message.ts`
- Create: `src/lib/bridge/post-message.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/bridge/post-message.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('postMessageToNative', () => {
  let androidPostMessage: ReturnType<typeof vi.fn>
  let webkitPostMessage: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    androidPostMessage = vi.fn()
    webkitPostMessage = vi.fn()
    vi.stubGlobal('window', {
      Android: { postMessage: androidPostMessage },
    })
  })

  it('wraps messages with protocolVersion: 1', async () => {
    const { postMessageToNative } = await import('./post-message')
    postMessageToNative(JSON.stringify({ loaded: true }))
    const sent = JSON.parse(androidPostMessage.mock.calls[0][0])
    expect(sent.protocolVersion).toBe(1)
    expect(sent.loaded).toBe(true)
  })

  it('preserves all original fields', async () => {
    const { postMessageToNative } = await import('./post-message')
    postMessageToNative(JSON.stringify({ isPlaying: true, title: 'Song', artist: 'Artist' }))
    const sent = JSON.parse(androidPostMessage.mock.calls[0][0])
    expect(sent.isPlaying).toBe(true)
    expect(sent.title).toBe('Song')
    expect(sent.artist).toBe('Artist')
  })

  it('uses webkit when Android is not present', async () => {
    vi.stubGlobal('window', {
      webkit: { messageHandlers: { messageHandler: { postMessage: webkitPostMessage } } },
    })
    const { postMessageToNative } = await import('./post-message')
    postMessageToNative(JSON.stringify({ location: '/teachers' }))
    expect(webkitPostMessage).toHaveBeenCalledTimes(1)
    const sent = JSON.parse(webkitPostMessage.mock.calls[0][0])
    expect(sent.protocolVersion).toBe(1)
  })

  it('falls back to original message string if input is not valid JSON', async () => {
    const { postMessageToNative } = await import('./post-message')
    // Should not throw
    expect(() => postMessageToNative('not-json')).not.toThrow()
    // Falls back to sending original string
    expect(androidPostMessage).toHaveBeenCalledWith('not-json')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/lib/bridge/post-message.test.ts
```

Expected: FAIL — `protocolVersion` not in sent messages.

- [ ] **Step 3: Update post-message.ts to wrap with protocolVersion**

Replace `src/lib/bridge/post-message.ts` entirely:

```ts
declare global {
  interface Window {
    Android?: { postMessage: (msg: string) => void }
    webkit?: {
      messageHandlers: {
        messageHandler: { postMessage: (msg: string) => void }
      }
    }
    ReactNativeWebView?: boolean
    inNativeApp?: boolean
  }
}

export function postMessageToNative(message: string): void {
  if (typeof window === 'undefined') return

  let payload: string
  try {
    const parsed = JSON.parse(message)
    payload = JSON.stringify({ protocolVersion: 1, ...parsed })
  } catch {
    payload = message // not valid JSON — send as-is
  }

  if (window.Android?.postMessage) {
    window.Android.postMessage(payload)
  } else if (window.webkit?.messageHandlers?.messageHandler?.postMessage) {
    window.webkit.messageHandlers.messageHandler.postMessage(payload)
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/lib/bridge/post-message.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bridge/post-message.ts src/lib/bridge/post-message.test.ts
git commit -m "feat(bridge): add protocolVersion: 1 to all outgoing native messages"
```

---

## Task 5: Add /api/native-config Endpoint

**Why:** Current native apps can't call this without an app update. Build it now so rebuilt apps have a stable, documented endpoint. Returns live config from Sanity with a 5-minute cache — rebuilt apps hit this once at launch to get the stream URL and min-app-version without relying on the bridge.

**Files:**
- Create: `src/app/api/native-config/route.ts`
- Create: `src/app/api/native-config/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/native-config/route.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/sanity/client', () => ({
  sanityFetch: vi.fn(),
}))

import { sanityFetch } from '@/lib/sanity/client'

describe('GET /api/native-config', () => {
  it('returns streamUrl from Sanity when available', async () => {
    vi.mocked(sanityFetch).mockResolvedValueOnce({ radioAudioURL: 'https://example.com/stream' })
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()
    expect(body.streamUrl).toBe('https://example.com/stream')
    expect(body.protocolVersion).toBe(1)
    expect(res.headers.get('Cache-Control')).toContain('max-age=300')
  })

  it('falls back to radiojar URL when Sanity fails', async () => {
    vi.mocked(sanityFetch).mockRejectedValueOnce(new Error('Sanity down'))
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()
    expect(body.streamUrl).toBe('https://stream.radiojar.com/g4d600bv6p5tv')
    expect(res.status).toBe(200)
  })

  it('returns minAppVersion and webUrl fields', async () => {
    vi.mocked(sanityFetch).mockResolvedValueOnce({ radioAudioURL: 'https://example.com/stream' })
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()
    expect(body.minAppVersion).toMatchObject({ ios: expect.any(String), android: expect.any(String) })
    expect(body.webUrl).toMatch(/^https?:\/\//)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/app/api/native-config/route.test.ts
```

Expected: FAIL — `route.ts` does not exist.

- [ ] **Step 3: Create the endpoint**

Create `src/app/api/native-config/route.ts`:

```ts
import { sanityFetch } from '@/lib/sanity/client'
import { appSettingsQuery, APP_SETTINGS_ID } from '@/lib/sanity/queries'

const FALLBACK_STREAM_URL = 'https://stream.radiojar.com/g4d600bv6p5tv'

export async function GET(): Promise<Response> {
  const settings = await sanityFetch<{ radioAudioURL: string }>(
    appSettingsQuery,
    { id: APP_SETTINGS_ID },
    { tags: ['appSettings'] }
  ).catch(() => null)

  return Response.json(
    {
      protocolVersion: 1,
      streamUrl: settings?.radioAudioURL ?? FALLBACK_STREAM_URL,
      webUrl: 'https://reach-radio-web.pages.dev',
      minAppVersion: { ios: '1.0.0', android: '1.0.0' },
    },
    {
      headers: { 'Cache-Control': 'public, max-age=300' },
    }
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/app/api/native-config/route.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/native-config/route.ts src/app/api/native-config/route.test.ts
git commit -m "feat(bridge): add /api/native-config endpoint for rebuilt native apps"
```

---

## Task 6: Manual Verification in Native Apps (Pre-URL-Switch Checklist)

**Why:** No automated tests can substitute for running the native app against the Next.js server. Run through this checklist before switching `reach-radio-web.pages.dev` to point at Next.js.

**Setup:**
- Android: enable Chrome DevTools via `chrome://inspect` on desktop Chrome
- iOS: enable Safari DevTools via `webView.isInspectable = true` (already set in iOS debug builds)
- Point the dev WebView at your local dev server or a staging deploy of Next.js

- [ ] **Android: Splash dismisses on load**
Load the app. Splash screen should dismiss when page finishes hydrating (triggered by `{ loaded: true }` message). Should not hang forever.

- [ ] **Android: Skeleton hides after load**
Full-page reload (pull down to refresh). Skeleton should disappear after load, not stay forever.

- [ ] **Pull-to-refresh works**
Pull down on the WebView. Page should reload. After reload, splash dismisses again (BridgeInit remounts, sends `loaded: true`).

- [ ] **Android hardware back button**
Press Android back button. Should navigate back in web history. If at root, app should go to home or exit — not crash.

- [ ] **Native bottom nav tabs navigate correctly**
Tap Listen / About / Donate / Teachers tabs in native nav. Each should navigate to correct web route and web content updates.

- [ ] **Native media bar shows/hides on route change**
Navigate to `/about` — native media bar should appear. Navigate to `/` (home) — native media bar should disappear.

- [ ] **Play/pause from native media bar updates web UI**
Press play on native media bar. Web `isPlaying` state should update (RadioPlayer button reflects play state).

- [ ] **Play/pause from web updates native media bar**
Press play on web. Native media bar play/pause button should update.

- [ ] **Track metadata updates in native**
When track/artist/image changes on web, native media bar and notification should update.

- [ ] **Input focus hides native nav**
Tap a search input (e.g. `/teachers` search). Native bottom nav and media bar should hide. Blur the input — they should reappear.

- [ ] **External links open in browser**
Tap a link to `forms.ministryforms.net` or `login.ministryid.com`. Should open in system browser, not in WebView.

- [ ] **iOS lock screen / Now Playing correct metadata**
Play audio. Lock screen Now Playing should show correct title/artist/image.

- [ ] **iOS native audio stream still works**
With Astro domain still live, iOS native audio should stream correctly (hardcoded to `reach-radio-web.pages.dev/api/audio-stream`). Verify this does NOT break after switching webview URL to Next.js — audio and webview are independent.

- [ ] **Android notification play/pause works**
With audio playing, open notification shade. Play/pause button should work. Metadata should match.

- [ ] **No 10-second audio drops**
Play audio for >10 seconds. Stream should not drop. (This was the T1 bug — confirm it's fixed.)

---

## Additional Research Findings (2024–2026 WebView Issues)

Cross-referenced against the project. Items marked ✓ are already handled; items marked ⚠ need monitoring or future work.

### iOS WKWebView

| Issue | Status | Notes |
|-------|--------|-------|
| Background audio stops when app backgrounded | ✓ Handled | Native layer (AVPlayer) owns audio — not a web concern |
| Soft keyboard does NOT resize `window.innerHeight` | ✓ Handled | Focus/blur bridge messages (Task 3) hide native nav instead of relying on viewport height |
| `env(safe-area-inset-*)` zero on first paint — needs `viewport-fit=cover` | ✓ Handled | `viewport: { viewportFit: 'cover' }` set in `layout.tsx` + vars in `globals.css` |
| `position: fixed` flicker during inertial scroll | ⚠ Monitor | `MediaBar` uses `bottom: var(--safe-bottom)` with fixed position. Apply `transform: translateZ(0)` if flicker is observed |
| Service Workers disabled by default | ✓ N/A | Project doesn't use service workers |
| Cross-origin cookies blocked (ITP) | ✓ N/A | Auth is same-domain (Descope uses redirects, not cross-origin frames) |
| WebKit CVEs (CVE-2025-14174, CVE-2025-43529) | ✓ N/A | Bridge only loads owned content — no untrusted URLs in the same webview |
| Silent mode blocks WKWebView HTML audio | ✓ N/A | Native handles audio via AVAudioSession — web audio is only for browser users |
| iOS never calls `globalState.isPlaying.set()` — web play button out of sync | ⚠ App update needed | iOS does not push play state back to web from lock screen controls. Not fixable web-side. Track for future iOS app update. |

### Android WebView

| Issue | Status | Notes |
|-------|--------|-------|
| JS execution paused in background — HTML audio stops | ✓ N/A | ExoPlayer handles audio natively |
| M139+ visual viewport resizes when keyboard shows | ✓ Handled | Our focus/blur handlers don't call `blur()` on `resize` events — no infinite loop risk. But if layout issues occur, switch to `visualViewport` API as an alternative keyboard height signal |
| Android 15+ edge-to-edge mandatory (API 35+) | ✓ Handled | `env(safe-area-inset-*)` CSS vars + `viewport-fit=cover` already implemented. Native app needs `WindowInsetsCompat` — web-side is ready. |
| Oversized cookie → silent 400 | ✓ N/A | Our `mobile-app=true` cookie is tiny. Not a concern unless adding JWT cookies in future. |
| `@JavascriptInterface` methods on background thread | ✓ N/A | Native app concern — web can't fix this |
| Android predictive back gesture (API 33+) | ⚠ App update needed | The native app must opt in to `OnBackPressedCallback` for Android 14+ and enable `android:enableOnBackInvokedCallback` for Android 15+. Not web-fixable. |
| Back button exits app instead of navigating SPA | ✓ Handled | Native app calls `webView.canGoBack()` → `webView.goBack()`, plus `window.globalActions.goBack()` as fallback |
| `100vh` breaks on keyboard open | ✓ OK | Only `min-h-screen` on body — allows growth, won't clip. No `h-screen` or `100vh` in native-mode components. |

### Items Requiring Native App Updates (Future, Not Blocking URL Switch)

These are documented for when native apps are rebuilt:

1. **iOS: call `globalState.mediaBarState.isPlaying.set()` from lock screen controls** — web play button stays in sync when user plays from lock screen
2. **iOS: replace 2s timed splash with `loaded: true` message-driven dismiss** — more accurate on fast and slow connections  
3. **Android: predictive back gesture opt-in** (`android:enableOnBackInvokedCallback="true"`)
4. **Android: confirm M139+ visual viewport keyboard behavior** works with the focus/blur bridge messages, or add `visualViewport` resize listener as redundant signal

---

---

## Native App Issues (Require App Store / Play Store Updates)

These cannot be fixed web-side. Document here so they can be batched into a single app update.

---

### iOS — `reach-radio-native-ios`

**Files:** `Reach Radio Native/ContentView.swift`, `Reach Radio Native/AudioPlayer.swift`

#### ✅ Doc Correction: iOS DOES push state to web

The doc stated "iOS never calls `globalState.*`" — **this is wrong**. `AudioStreamingManager.updateWebViewState()` calls `window.globalState.mediaBarState.isPlaying.set()` and `isBuffering.set()` via `evaluateJavaScript`. This is called from:
- `play()` / `stop()`
- KVO observers on `timeControlStatus` (paused, playing, waitingToPlayAtSpecifiedRate)
- Lock screen remote transport controls (`playCommand` / `pauseCommand`)

Web play button DOES sync when user plays from lock screen. No native fix needed here.

---

#### iOS-1: `scheduleBufferingEnd()` guard exits too early

**File:** `AudioPlayer.swift:115`

```swift
private func scheduleBufferingEnd() {
    guard isBuffering, bufferingEndWorkItem == nil else { return }
    // ...
}
```

Called from `.readyToPlay` and `.playing` states. If the player goes directly to `.readyToPlay` without first passing through `.unknown` (which sets `isBuffering = true`), `isBuffering` is false and the guard returns immediately — the delayed clear is never scheduled. On a fast connection, this is the common path, so `isBuffering` may stay `false` throughout and never show a buffering indicator. Functionally OK but buffering state could be stale in edge cases.

**Fix:** Separate "clear buffering" from "schedule with guard":
```swift
private func scheduleBufferingEnd() {
    bufferingEndWorkItem?.cancel()
    bufferingEndWorkItem = nil
    guard isBuffering else { return } // Only delay-clear if actually buffering

    let workItem = DispatchWorkItem { [weak self] in
        guard let self else { return }
        self.isBuffering = false
        self.bufferingEndWorkItem = nil
        self.updateWebViewState()
    }
    bufferingEndWorkItem = workItem
    DispatchQueue.main.asyncAfter(deadline: .now() + minimumBufferingDisplayTime, execute: workItem)
}
```

---

#### iOS-2: `handleRefresh` missing `[weak self]`

**File:** `ContentView.swift:89`

```swift
@objc func handleRefresh() {
    let script = "..."
    parent.webViewStore.webView?.evaluateJavaScript(script) { (result, error) in
        // 'self' captured strongly here — retain cycle if Coordinator holds parent
        self.parent.webViewStore.webView?.scrollView.refreshControl?.endRefreshing()
    }
}
```

The closure captures `self` (the Coordinator) strongly. If the WKWebView lives longer than expected, this creates a retain cycle. Low risk in practice but should be `[weak self]`:

```swift
parent.webViewStore.webView?.evaluateJavaScript(script) { [weak self] (result, error) in
    self?.parent.webViewStore.webView?.scrollView.refreshControl?.endRefreshing()
}
```

---

#### iOS-3: Splash timer too short on slow connections

**File:** `ContentView.swift:529`

```swift
DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
    withAnimation(.easeOut(duration: 0.3)) {
        isShowingSplash = false
    }
}
```

2 seconds may not be enough on slow cellular. Android uses the `{ loaded: true }` bridge message (accurate). After the Next.js bridge is fixed to send `loaded: true`, iOS should switch to the same pattern:

```swift
// Remove the timer entirely
// In onMessageReceived, add:
if let loaded = jsonDict["loaded"] as? Bool, loaded {
    withAnimation(.easeOut(duration: 0.3)) {
        isShowingSplash = false
    }
}
```

Set the timer as a fallback only:
```swift
// Fallback: dismiss after 5s even if loaded message never arrives
DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
    if isShowingSplash {
        withAnimation(.easeOut(duration: 0.3)) { isShowingSplash = false }
    }
}
```

---

#### iOS-4: Hardcoded stream URL and web URL

**File:** `ContentView.swift:219, 226`

```swift
static let initialURL = URL(string: "https://reach-radio-web.pages.dev/")!
private let streamURL = "https://reach-radio-web.pages.dev/api/audio-stream"
```

Both hardcoded. Will be fixable via `streamUrl` bridge message (Task 3, T2) once Next.js sends it — but requires iOS to read and cache the value. Future app update needed to consume it.

---

### Android — `reach-radio-native-android`

**Files:** `MainActivity.kt`, `MainScreen.kt`, `viewmodel/MainViewModel.kt`

---

#### Android-1: `up.history.location` called without undefined guard

**File:** `MainActivity.kt:385`

```kotlin
view?.evaluateJavascript("up.history.location") { result ->
    val path = result?.removeSurrounding("\"") ?: "/"
```

iOS uses an IIFE guard: `"(function() { return (typeof up !== 'undefined' && up.history) ? up.history.location : null; })()"`. Android calls `up.history.location` bare. If the compat shim hasn't initialized yet (pre-hydration), `up` is `undefined`, JS throws a `ReferenceError`, and `result` is `"null"` (string, not Java null). The `?.removeSurrounding("\"") ?: "/"` fallback only triggers for Java null — not for the `"null"` string. So `path = "null"` and the ViewModel receives `{"location":"null"}` which corrupts `currentPath`.

**Fix:**
```kotlin
view?.evaluateJavascript(
    "(function() { return (typeof up !== 'undefined' && up.history) ? up.history.location : null; })()"
) { result ->
    val path = when {
        result == null || result == "null" -> "/"
        else -> result.removeSurrounding("\"")
    }
```

---

#### Android-2: `isBuffering=true` aggressively sets `isPlaying=false`

**File:** `MainViewModel.kt:148-154`

```kotlin
if (jsonObject.has("isBuffering")) {
    val buffering = jsonObject.getBoolean("isBuffering")
    updatedState = updatedState.copy(isBuffering = buffering)
    if (buffering && updatedState.isPlaying) {
        updatedState = updatedState.copy(isPlaying = false)
    }
}
```

Buffering ≠ stopped. Setting `isPlaying = false` when buffering starts causes the native play button to show "play" while audio is actually buffering/reconnecting. When the stream resumes, the web may not send `isPlaying=true` again (since it was never paused — just buffering). The native play button stays showing "play" while audio plays.

**Fix:** Don't set `isPlaying = false` from the web `isBuffering` message. Let `isPlaying` only change from explicit `isPlaying` messages:
```kotlin
if (jsonObject.has("isBuffering")) {
    val buffering = jsonObject.getBoolean("isBuffering")
    updatedState = updatedState.copy(isBuffering = buffering)
    // Don't touch isPlaying — buffering and playing are independent states
}
```

---

#### Android-3: Back button never exits app at SPA root

**File:** `MainActivity.kt:326-350`

```kotlin
val onBackPressedCallback = object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
        if (webView?.canGoBack() == true) {
            webView?.goBack()
        } else {
            val script = "window.globalActions.goBack()"
            webView?.evaluateJavascript(script) { ... }
            // Callback stays enabled — never exits app
        }
    }
}
```

At the SPA root (no native history, no SPA history), this fires `window.globalActions.goBack()` every back press but never closes the app. Users are trapped.

**Fix — double-back-to-exit pattern:**
```kotlin
private var backPressedTime = 0L

val onBackPressedCallback = object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
        if (webView?.canGoBack() == true) {
            webView?.goBack()
            return
        }
        val now = System.currentTimeMillis()
        if (now - backPressedTime < 2000) {
            // Second press within 2s → exit
            isEnabled = false
            onBackPressedDispatcher.onBackPressed()
        } else {
            backPressedTime = now
            Toast.makeText(this@MainActivity, "Press back again to exit", Toast.LENGTH_SHORT).show()
            webView?.evaluateJavascript("window.globalActions.goBack()") { }
        }
    }
}
```

---

#### Android-4: JS path injection in `onNavigate`

**File:** `MainActivity.kt:475`

```kotlin
val script = "window.globalActions.goToPage(\'$path\')"
```

`path` is string-interpolated. Current callers pass hardcoded paths (`/`, `/about`, `/donate`, `/teachers`) from `AppNavigationBar` — low risk. But if this grows to accept user-controlled input, single quotes or backticks in `path` would break or inject. Should use JSON encoding:

```kotlin
val escapedPath = org.json.JSONObject.quote(path)
val script = "window.globalActions.goToPage($escapedPath)"
```

---

#### Android-5: `onResume` restarts observers — potential duplicate events

**File:** `MainActivity.kt:600-605`

```kotlin
override fun onResume() {
    super.onResume()
    startStateObserver()       // cancels old job, starts new one
    startControllerStateObserver()
}
```

`startStateObserver()` cancels the previous job and starts a new one — safe. But `startControllerStateObserver()` guards on `::playbackController.isInitialized`, which may be false if `onResume` fires before permissions are granted (first launch). In that case it logs a warning and returns — fine.

**No fix required**, but if audio glitches are observed after backgrounding/foregrounding, this is the first place to look.

---

## Summary: What Needs to Change, Where

### `reach-radio-nextjs` — All blocking (must fix before URL switch)

| Task | File(s) | Priority |
|------|---------|----------|
| T1: Fix audio stream 10s timeout | `src/app/api/audio-stream/route.ts` | Critical (active bug) |
| T2: Add middleware for native detection | `src/middleware.ts`, `src/app/layout.tsx` | High |
| T3: Fix BridgeInit gaps | `src/components/bridge/BridgeInit.tsx`, `src/app/layout.tsx` | Critical (Android splash) |
| T4: protocolVersion in postMessage | `src/lib/bridge/post-message.ts` | Low (forward compat) |
| T5: /api/native-config endpoint | `src/app/api/native-config/route.ts` | Low (future apps) |

### `reach-radio-native-ios` — Non-blocking, batch into next app update

| Issue | File | Severity |
|-------|------|----------|
| iOS-1: scheduleBufferingEnd() guard | `AudioPlayer.swift:115` | Medium — edge-case buffering indicator |
| iOS-2: handleRefresh retain cycle | `ContentView.swift:89` | Low — unlikely to manifest |
| iOS-3: Replace 2s splash timer with `loaded` message | `ContentView.swift:529` | Medium — UX accuracy |
| iOS-4: Consume `streamUrl` bridge message | `ContentView.swift` | Low — forward compat |

### `reach-radio-native-android` — Non-blocking, batch into next app update

| Issue | File | Severity |
|-------|------|----------|
| Android-1: IIFE guard on `up.history.location` | `MainActivity.kt:385` | High — sends `location=null` to ViewModel |
| Android-2: Remove `isPlaying=false` from `isBuffering` handler | `MainViewModel.kt:148` | High — play button desync |
| Android-3: Back button exit at SPA root | `MainActivity.kt:326` | Medium — UX, users can't exit |
| Android-4: JSON-encode path in goToPage script | `MainActivity.kt:475` | Low — defensive hygiene |

---

## URL Switch — When Ready

After all six tasks are complete and manual checklist passes:

**Recommended path (Option C):** Deploy Next.js to `reach-radio-web.pages.dev` via Cloudflare Pages. Native apps load Next.js without any redirect.

**Do NOT shut down Astro** — iOS audio is hardcoded to the Astro stream proxy URL. Keep Astro alive indefinitely on free-tier Cloudflare Pages.

If Option C isn't feasible immediately, Option A (Cloudflare redirect from Astro domain to Next.js domain) works but adds a redirect hop for native WebView loads.
