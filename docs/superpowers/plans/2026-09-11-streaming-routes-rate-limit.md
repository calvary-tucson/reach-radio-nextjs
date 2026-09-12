# Streaming Routes Rate Limiting & Duration Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the broken in-app rate limiter from three streaming API routes, replace it with Vercel Firewall rules, and give both long-lived streaming routes an explicit `maxDuration` so they stop silently inheriting Vercel's 300-second default.

**Architecture:** Delete `src/lib/rate-limit.ts` and its usage in `audio-stream`, `stream-info`, and `stream-info-sse` route handlers (code changes, Tasks 1-4). Rate limiting moves to Vercel Firewall custom rules configured directly in the dashboard (Task 5, manual — not committed to the repo). `audio-stream` and `stream-info-sse` each get `export const maxDuration = 780`; `stream-info-sse` additionally gets a jittered reconnect window instead of a fixed one.

**Tech Stack:** Next.js 16 App Router route handlers, Vitest, Vercel Firewall (WAF custom rules, dashboard-configured).

## Global Constraints

- No `any` in public APIs (TypeScript strict mode, user-level convention).
- Conventional commit format with scope `api` (per this repo's `AGENTS.md` — all `/app/api/*` routes use scope `api`).
- Every task's code changes must pass `npm run lint`, `npx tsc --noEmit -p .`, and `npm run test` before commit.
- Do not touch `reach-radio-web`, native app repos, or the contact-form rate limiter — out of scope per the spec's Non-goals.
- On Vercel Pro, Firewall rate-limit rules only support the **Fixed Window** algorithm, a counting window between 10 seconds and 10 minutes, and keys of IP Address or JA4 Digest (confirmed against current Vercel docs, 2026-09-11) — Task 5's rule configurations must stay within these bounds.

**Spec:** `docs/superpowers/specs/2026-09-11-streaming-routes-rate-limit-design.md`

---

### Task 1: Remove rate limiting from `/api/audio-stream`, add `maxDuration`

**Files:**
- Modify: `src/app/api/audio-stream/route.ts`
- Modify: `tests/unit/api-audio-stream.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `GET(): Promise<Response>` — the route's exported handler signature changes from `GET(request: Request)` to `GET()` (the `request` param was only ever used to read `x-forwarded-for` for the limiter, which no longer exists). Task 3 makes the identical signature change to `stream-info-sse`; keep the two consistent.

- [ ] **Step 1: Update the failing test file to match the target behavior**

Replace the full contents of `tests/unit/api-audio-stream.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('GET /api/audio-stream', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
  })

  it('returns 502 when upstream fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream down')))
    const { GET } = await import('@/app/api/audio-stream/route')
    const res = await GET()
    expect(res.status).toBe(502)
  })

  it('returns stream response with correct content-type on success', async () => {
    const mockBody = new ReadableStream()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
    }))
    const { GET } = await import('@/app/api/audio-stream/route')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('audio/mpeg')
  })

  it('clears the abort timeout after connection succeeds', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const mockBody = new ReadableStream()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
    }))
    const { GET } = await import('@/app/api/audio-stream/route')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
  })

  describe('connection timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('aborts and returns 502 if connection takes more than 10 seconds', async () => {
      let capturedSignal: AbortSignal | undefined
      vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
        capturedSignal = opts?.signal
        return new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
        })
      }))

      const { GET } = await import('@/app/api/audio-stream/route')
      const responsePromise = GET()

      await vi.advanceTimersByTimeAsync(11_000)

      const res = await responsePromise
      expect(res.status).toBe(502)
      expect(capturedSignal?.aborted).toBe(true)
    })
  })
})
```

This deletes two tests that no longer apply: `'returns 429 when rate limit
exceeded'` (the limiter it tested is being removed) and `'treats missing
x-forwarded-for as unknown IP bucket'` (tested IP-bucket fallback behavior
that no longer exists — `'returns stream response with correct
content-type on success'` already exercises a request with no
`x-forwarded-for` header, so no coverage is lost). The three remaining
tests are updated to call `GET()` with no argument.

- [ ] **Step 2: Run the test file to verify it fails**

Run: `npx vitest run tests/unit/api-audio-stream.test.ts`
Expected: FAIL — all 4 tests throw `TypeError: Cannot read properties of
undefined (reading 'headers')`. Vitest's default config (see
`vitest.config.ts`) doesn't type-check, only transpiles, so this fails at
runtime rather than at compile time: the test now calls `GET()` with no
arguments, but the route still declares `GET(request: Request)` and
immediately does `request.headers.get(...)`, so `request` is `undefined`.

- [ ] **Step 3: Update the route implementation**

Replace the full contents of `src/app/api/audio-stream/route.ts` with:

```ts
import { FALLBACK_STREAM_URL } from '@/lib/constants'

export const maxDuration = 780

export async function GET(): Promise<Response> {
  const controller = new AbortController()
  const connectTimeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const upstream = await fetch(FALLBACK_STREAM_URL, { signal: controller.signal })
    clearTimeout(connectTimeout)

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

This removes the `createRateLimiter` import and the 429 branch, drops the
now-unused `request` parameter, and adds `export const maxDuration = 780`
(13 minutes — see spec section 2 for why 780 rather than the 30-minute
Beta tier).

- [ ] **Step 4: Run the test file to verify it passes**

Run: `npx vitest run tests/unit/api-audio-stream.test.ts`
Expected: `Test Files  1 passed (1)` / `Tests  4 passed (4)`

- [ ] **Step 5: Lint and type-check**

Run: `npx eslint src/app/api/audio-stream/route.ts tests/unit/api-audio-stream.test.ts`
Expected: no output (clean)

Run: `npx tsc --noEmit -p .`
Expected: no output (clean) — this still imports `src/lib/rate-limit.ts` from the other two routes at this point in the plan, which is fine; it isn't deleted until Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/audio-stream/route.ts tests/unit/api-audio-stream.test.ts
git commit -m "fix(api): remove in-app rate limit, add maxDuration to audio-stream

Vercel Firewall replaces per-instance rate limiting (see Task 5).
maxDuration=780 replaces an unset, unintentional 300s platform default."
```

---

### Task 2: Remove rate limiting from `/api/stream-info`

**Files:**
- Modify: `src/app/api/stream-info/route.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `GET(): Promise<Response>` — same signature simplification as Task 1, for the same reason (`request` was only used for the limiter's IP key).

No test file changes: `tests/unit/api-stream-info-jsonp.test.ts` tests a
locally-defined `stripJsonp` helper directly and never imports or calls
this route's `GET`, so it needs no update. There is no other test file
for this route.

- [ ] **Step 1: Update the route implementation**

Replace the full contents of `src/app/api/stream-info/route.ts` with:

```ts
import { RADIOJAR_URL } from '@/lib/constants'
import { resolveArtist } from '@/lib/teacherCache'

export async function GET(): Promise<Response> {
  try {
    const res = await fetch(RADIOJAR_URL, {
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 0 },
    })
    const text = await res.text()
    // Robust JSONP strip — handles named callback and whitespace variations
    const stripped = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '')
    const json = JSON.parse(stripped) as { title?: string; artist?: string }

    const title = json.title || 'Reach Radio'
    const artist = json.artist || ''
    const { imageUrl, resolvedArtist } = await resolveArtist(artist)

    return Response.json({ title, artist, streamTitle: title, streamArtist: artist, imageUrl, resolvedArtist })
  } catch {
    return Response.json(
      { title: 'Reach Radio', artist: '', streamTitle: 'Reach Radio', streamArtist: '', imageUrl: null, resolvedArtist: null },
      { status: 200 }
    )
  }
}
```

This removes the `createRateLimiter` import, the module-level `limiter`,
the `ip` extraction, and the 429 branch. No `maxDuration` is added — this
route makes one short upstream fetch and returns, it is not a long-lived
stream (per spec section 2).

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

Run: `npx vitest run tests/unit/api-stream-info-jsonp.test.ts`
Expected: `Test Files  1 passed (1)` / `Tests  4 passed (4)`

- [ ] **Step 3: Lint and type-check**

Run: `npx eslint src/app/api/stream-info/route.ts`
Expected: no output (clean)

Run: `npx tsc --noEmit -p .`
Expected: no output (clean)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stream-info/route.ts
git commit -m "fix(api): remove in-app rate limit from stream-info

Vercel Firewall replaces per-instance rate limiting (see Task 5)."
```

---

### Task 3: Remove rate limiting from `/api/stream-info-sse`, add `maxDuration` and reconnect jitter

**Files:**
- Modify: `src/app/api/stream-info-sse/route.ts`
- Modify: `tests/unit/api-stream-info-sse.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `GET(): Promise<Response>` — same signature simplification as Tasks 1-2.

- [ ] **Step 1: Update the failing test file to match the target behavior**

Replace the full contents of `tests/unit/api-stream-info-sse.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/teacherCache', () => ({
  resolveArtist: vi.fn().mockResolvedValue({ imageUrl: null, resolvedArtist: null }),
}))

describe('GET /api/stream-info-sse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns text/event-stream content type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '({"title":"Test Show","artist":"John Doe"});',
    }))
    const { GET } = await import('@/app/api/stream-info-sse/route')
    const res = await GET()
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('emits parsed title and artist in SSE data event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '({"title":"Morning Devotions","artist":"Chuck Smith"});',
    }))
    const { GET } = await import('@/app/api/stream-info-sse/route')
    const res = await GET()
    expect(res.status).toBe(200)

    const reader = res.body?.getReader()
    if (!reader) throw new Error('no body')
    const { value } = await reader.read()
    reader.cancel()
    const text = new TextDecoder().decode(value)
    expect(text).toContain('"title":"Morning Devotions"')
    expect(text).toContain('"artist":"Chuck Smith"')
    expect(text).toContain('"imageUrl":null')
    expect(text).toContain('"resolvedArtist":null')
  })

  it('falls back to Reach Radio on upstream fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream down')))
    const { GET } = await import('@/app/api/stream-info-sse/route')
    // Polling failure should not throw — stream stays open
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })
})
```

This deletes the `'returns 429 when rate limit exceeded'` test (the
limiter it tested is being removed) and updates the three remaining tests
to call `GET()` with no argument.

- [ ] **Step 2: Run the test file to verify it fails**

Run: `npx vitest run tests/unit/api-stream-info-sse.test.ts`
Expected: FAIL — all 3 tests throw `TypeError: Cannot read properties of
undefined (reading 'headers')`. Vitest's default config doesn't
type-check, only transpiles, so this fails at runtime rather than at
compile time: the test now calls `GET()` with no arguments, but the route
still declares `GET(request: Request)` and immediately does
`request.headers.get(...)`, so `request` is `undefined`.

- [ ] **Step 3: Update the route implementation**

Replace the full contents of `src/app/api/stream-info-sse/route.ts` with:

```ts
import { RADIOJAR_URL } from '@/lib/constants'
import { resolveArtist } from '@/lib/teacherCache'

export const maxDuration = 780

const MAX_POLL_BACKOFF_MS = 5 * 60_000
const MIN_CONNECTION_MS = 10 * 60_000
const CONNECTION_JITTER_MS = 2 * 60_000

function getConnectionTimeoutMs(): number {
  return MIN_CONNECTION_MS + Math.random() * CONNECTION_JITTER_MS
}

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder()
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let keepaliveInterval: ReturnType<typeof setInterval> | undefined
  let connectionTimeout: ReturnType<typeof setTimeout> | undefined
  const abortController = new AbortController()
  let cancelled = false
  let consecutiveFailures = 0

  const stream = new ReadableStream({
    async start(controller) {
      function schedulePoll(delay: number) {
        if (cancelled) return
        pollTimer = setTimeout(() => void poll(), delay)
      }

      async function poll() {
        if (cancelled) return
        try {
          const res = await fetch(RADIOJAR_URL, {
            signal: AbortSignal.any([
              AbortSignal.timeout(5_000),
              abortController.signal,
            ]),
          })
          const text = await res.text()
          const stripped = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '')
          const json = JSON.parse(stripped) as { title?: string; artist?: string }
          const title = json.title || 'Reach Radio'
          const artist = json.artist || ''
          const { imageUrl, resolvedArtist } = await resolveArtist(artist)
          consecutiveFailures = 0
          if (!cancelled) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ title, artist, imageUrl, resolvedArtist })}\n\n`)
            )
          }
          schedulePoll(30_000)
        } catch {
          if (!cancelled) {
            consecutiveFailures++
            const delay = Math.min(30_000 * Math.pow(2, consecutiveFailures - 1), MAX_POLL_BACKOFF_MS)
            schedulePoll(delay)
          }
        }
      }

      // Keepalive comments every 15s prevent proxy/Vercel from closing idle connections
      keepaliveInterval = setInterval(() => {
        if (!cancelled) {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'))
          } catch {
            cancelled = true
          }
        }
      }, 15_000)

      // Forces a client reconnect after a jittered 10-12 minute window, so
      // connections opened around the same time (e.g. at broadcast start)
      // don't all reconnect in the same instant.
      connectionTimeout = setTimeout(() => {
        cancelled = true
        clearTimeout(pollTimer)
        clearInterval(keepaliveInterval)
        abortController.abort()
        try { controller.close() } catch { /* already closed */ }
      }, getConnectionTimeoutMs())

      await poll()
    },
    cancel() {
      cancelled = true
      clearTimeout(pollTimer)
      clearTimeout(connectionTimeout)
      clearInterval(keepaliveInterval)
      abortController.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
    },
  })
}
```

Changes from the current file: removed the `createRateLimiter` import, the
module-level `limiter`, the `ip` extraction, and the 429 branch; dropped
the now-unused `request` parameter; added `export const maxDuration = 780`;
replaced the fixed `MAX_CONNECTION_MS` constant with `MIN_CONNECTION_MS` +
`CONNECTION_JITTER_MS` and a `getConnectionTimeoutMs()` helper called at
the point `connectionTimeout` is scheduled, so each connection gets an
independently randomized 10–12 minute lifetime instead of a shared fixed
one.

- [ ] **Step 4: Run the test file to verify it passes**

Run: `npx vitest run tests/unit/api-stream-info-sse.test.ts`
Expected: `Test Files  1 passed (1)` / `Tests  3 passed (3)`

- [ ] **Step 5: Lint and type-check**

Run: `npx eslint src/app/api/stream-info-sse/route.ts tests/unit/api-stream-info-sse.test.ts`
Expected: no output (clean)

Run: `npx tsc --noEmit -p .`
Expected: no output (clean)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/stream-info-sse/route.ts tests/unit/api-stream-info-sse.test.ts
git commit -m "fix(api): remove in-app rate limit, add maxDuration and reconnect jitter to stream-info-sse

Vercel Firewall replaces per-instance rate limiting (see Task 5).
maxDuration=780 replaces an unset, unintentional 300s platform default
that silently overrode the route's own 30-minute connection assumption.
Reconnect timing is now jittered (10-12min) instead of fixed, so
connections opened together don't reconnect in lockstep."
```

---

### Task 4: Delete the now-unused rate-limit module

**Files:**
- Delete: `src/lib/rate-limit.ts`

**Interfaces:**
- Consumes: relies on Tasks 1-3 having already removed every `import { createRateLimiter } from '@/lib/rate-limit'` call site.
- Produces: nothing — this is a pure deletion with no remaining consumers.

- [ ] **Step 1: Verify no remaining references**

Run: `grep -rln "rate-limit\|createRateLimiter" src/ tests/`
Expected: no output. If anything is listed other than `src/lib/rate-limit.ts` itself, stop — Tasks 1-3 were not fully applied, and this file cannot be deleted yet.

- [ ] **Step 2: Delete the file**

```bash
rm src/lib/rate-limit.ts
```

- [ ] **Step 3: Run the full verification suite**

Run: `npm run lint`
Expected: no errors

Run: `npx tsc --noEmit -p .`
Expected: no output (clean)

Run: `npm run test`
Expected: all test files pass, none reference the deleted module

- [ ] **Step 4: Commit**

```bash
git add src/lib/rate-limit.ts
git commit -m "chore(api): delete unused in-app rate limiter

Superseded by Vercel Firewall custom rules (Task 5) — no code
consumers remain after the previous three tasks."
```

---

### Task 5: Configure Vercel Firewall rate-limit rules (manual, dashboard)

**Files:** none — this task is entirely Vercel dashboard configuration, not committed to the repo.

**Interfaces:**
- Consumes: Tasks 1-4 must be merged/deployed first, so the routes are already limiter-free before Firewall becomes the only enforcement.
- Produces: three live Firewall rules, verified against the reference values below. Nothing for later tasks to consume in code.

This task has no automated test — it's dashboard configuration. Follow
Vercel's own documented best practice: create each rule with a **Log**
action first, confirm it matches the intended traffic, then switch it to
**Deny**. Do this once per route.

- [ ] **Step 1: Open the Firewall configuration screen**

From the Vercel dashboard, select this project, open **Firewall** in the
sidebar, then select **⋯ → Configure** in the top right of the Firewall
overview page.

- [ ] **Step 2: Create the `/api/audio-stream` rule (Log first)**

Select **+ New Rule** and fill in:
- **Name:** `audio-stream rate limit`
- **If condition:** Path equals `/api/audio-stream`
- **Then:** `Rate Limit`
  - **Algorithm:** Fixed Window (the only option available on Pro)
  - **Time Window:** `60s`
  - **Request Limit:** `60`
  - **Key:** IP Address
  - **Then (exceeded):** `Log` (not Deny yet)

Select **Save Rule**, then **Review Changes → Publish**.

- [ ] **Step 3: Create the `/api/stream-info` rule (Log first)**

Same as Step 2, with:
- **Name:** `stream-info rate limit`
- **If condition:** Path equals `/api/stream-info`
- **Time Window:** `60s`
- **Request Limit:** `60`
- **Key:** IP Address
- **Then (exceeded):** `Log`

Select **Save Rule**, then **Review Changes → Publish**.

- [ ] **Step 4: Create the `/api/stream-info-sse` rule (Log first)**

Same as Step 2, with:
- **Name:** `stream-info-sse rate limit`
- **If condition:** Path equals `/api/stream-info-sse`
- **Time Window:** `5min` (Pro's window range is 10s-10min, so this fits)
- **Request Limit:** `30`
- **Key:** IP Address
- **Then (exceeded):** `Log`

Select **Save Rule**, then **Review Changes → Publish**.

- [ ] **Step 5: Observe live traffic for each rule**

On the Firewall overview page, select each Custom Rule from the traffic
grouping drop-down in turn and watch its matched traffic for at least the
10-minute live window Vercel provides. Confirm:
- Each rule is matching the path you expect and nothing unexpected.
- No unexpectedly large single-IP burst appears that would indicate the
  condition is misconfigured (e.g. matching every route instead of just
  the intended one).

If anything looks wrong, edit the rule's condition and repeat this step
before continuing — do not switch to Deny on a rule you haven't confirmed.

- [ ] **Step 6: Switch all three rules to Deny**

For each of the three rules: open **Configure**, select the rule, change
**Then (exceeded)** from `Log` to `Deny`, select **Save Rule**, then
**Review Changes → Publish**.

- [ ] **Step 7: Verify enforcement**

From a terminal, burst one of the routes past its limit and confirm a 429
comes back from the edge (check response headers for Vercel/Firewall
indicators, not an app-level `Retry-After` header — the app no longer sets
one):

```bash
for i in $(seq 1 65); do curl -s -o /dev/null -w "%{http_code}\n" https://reach-radio-nextjs.vercel.app/api/stream-info; done | sort | uniq -c
```

Expected: mostly `200`, with `429` appearing once the count exceeds 60
within the 60-second window. Adjust the loop count/target route to match
whichever rule you're verifying.

No commit for this task — nothing in the repo changed.

---

### Task 6: Manual post-deploy verification of `maxDuration` behavior

**Files:** none — manual verification only, run after Tasks 1-4 are deployed to production.

**Interfaces:**
- Consumes: the deployed `maxDuration = 780` change from Tasks 1 and 3.
- Produces: confirmation that both streaming routes survive past the old
  5-minute ceiling. No code or commit.

- [ ] **Step 1: Verify `stream-info-sse` survives past 5 minutes**

```bash
curl -N -m 900 https://reach-radio-nextjs.vercel.app/api/stream-info-sse
```

Expected: the connection stays open and keeps emitting `: keepalive`
comments and periodic `data:` events past the 5-minute mark (where it
would previously have been cut off), until it closes on its own somewhere
in the 10-12 minute jittered window (`-m 900` caps curl's own wait at 15
minutes so it doesn't hang forever if something is wrong).

- [ ] **Step 2: Verify `audio-stream` survives past 5 minutes**

Play the stream continuously in a browser tab (or `curl -N -m 900
https://reach-radio-nextjs.vercel.app/api/audio-stream --output /dev/null`
in a terminal, watching for it to keep receiving bytes) past the 5-minute
mark. Confirm there's no audible gap or dropped connection at that point.

- [ ] **Step 3: Record the outcome**

If either check fails (connection still cut at ~5 minutes), the
`maxDuration` export likely isn't taking effect in production — check the
Vercel deployment's function configuration in the dashboard (Project
Settings → Functions) before assuming the code change was wrong.
