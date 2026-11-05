# Stream Worker Now-Playing SSE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Serve the now-playing SSE from the existing `reach-radio-audio-stream-worker` at `https://stream.reach.radio/api/stream-info-sse`, so the web client, iOS v4 and later the legacy apps can leave the legacy Astro app (`reach-radio-web.pages.dev`) before it is retired.

**Why:** The Vercel SSE route billed held-open function time (investigation: `docs/bugs/vercel-usage-spike-2026-11.md`). The interim fix points the web client at the legacy Astro SSE on `pages.dev`. Measured 2026-11-04: that Cloudflare stream stays open at least 25 min with no cut (75 events, 20 s apart), so Cloudflare does not bill or cut long streams. The Astro app is slated for retirement (roadmap row 12), so the endpoint needs a permanent home. The audio Worker is already live on `stream.reach.radio`.

**Architecture:** One new module `src/sse.ts` in the Worker repo holds `handleSse` and `parseNowPlaying`. `src/handler.ts` routes `GET /api/stream-info-sse` to it; every other path keeps the existing audio passthrough untouched. The wire format is identical to the Astro endpoint (named `time-update` events with `{title, artist}`, `id` counter, CORS `*`) so clients only change a URL. Hardening over the Astro source, carried over from the Next.js route: polls never overlap (chained `setTimeout`, not `setInterval`), a Radiojar timeout or error sends a `: heartbeat` comment and keeps the stream open (Astro closed the stream on a 5 s abort, which forces a reconnect storm), a client disconnect stops the timer.

**Tech Stack:** Cloudflare Workers, TypeScript (strict), Vitest (node environment, fake timers).

## Global Constraints

- Repo: `~/Documents/Development/reach-radio-audio-stream-worker`. Cross-repo doc edits only in the nextjs worktree `/Users/danielmccauley/orca/workspaces/reach-radio-nextjs/minnow` (absolute path; branch `calvary-tucson/investigate-vercel-usage-spike`). NEVER touch the main checkout `~/Documents/Development/reach-radio-nextjs` (stale, has unrelated staged changes).
- The audio path must not change: still a pure passthrough, no `TransformStream`, no per-chunk work, no `Icy-MetaData`, `Cache-Control: no-store`. The existing `src/handler.test.ts` tests must pass unmodified.
- `src/index.ts` exports only `default` (enforced by `src/index.test.ts`).
- SSE wire format must match `reach-radio-web/src/pages/api/stream-info-sse.ts` exactly: `event: time-update\nid: N\ndata: {"title":...,"artist":...}\n\n`, fallback title `Reach Radio FM`.
- No `any`. Conventional commits. Local commits only.
- No deploy, no push, no DNS, no Sanity change, no edit to `reach-radio-nextjs/src` or `next.config.ts` by an agent. Those are separate steps (Task 3), marked **USER** or ask-gated.
- Free plan: 100k requests/day account-wide, 10 ms CPU. The SSE handler does no per-chunk work; CPU is only the JSON parse every 20 s.

## File Structure

- Create `src/sse.ts`: `NOW_PLAYING_URL`, `POLL_INTERVAL_MS`, `FALLBACK_TITLE`, `parseNowPlaying`, `handleSse`.
- Create `src/sse.test.ts`: unit tests.
- Modify `src/handler.ts`: route `/api/stream-info-sse`.
- Modify `src/handler.test.ts`: add routing tests (append only).
- Modify `README.md`, `CLAUDE.md`, `docs/architecture-and-operations.md`: describe the SSE route, update the Radiojar-ID list (item 5 gains this repo).
- Modify (nextjs worktree, absolute path above) `docs/superpowers/plans/2026-10-13-audio-stream-master-roadmap.md`: add row 20.

---

### Task 1: SSE module (TDD)

**Files:** Create `src/sse.ts`, `src/sse.test.ts`.

- [ ] **Step 1: Write the failing tests.** Create `src/sse.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FALLBACK_TITLE,
  NOW_PLAYING_URL,
  POLL_INTERVAL_MS,
  handleSse,
  parseNowPlaying,
} from './sse'

const req = (method = 'GET') =>
  new Request('https://stream.reach.radio/api/stream-info-sse', { method })

const jsonp = (obj: object) => new Response(`(${JSON.stringify(obj)});`, { status: 200 })

async function readText(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { value } = await reader.read()
  return new TextDecoder().decode(value)
}

describe('parseNowPlaying', () => {
  it('strips the JSONP wrapper and returns title and artist', () => {
    expect(parseNowPlaying('({"title":"Joy","artist":"Rend"});')).toEqual({
      title: 'Joy',
      artist: 'Rend',
    })
  })

  it('falls back to the default title when title is empty or missing', () => {
    expect(parseNowPlaying('({"title":"","artist":"A"});').title).toBe(FALLBACK_TITLE)
    expect(parseNowPlaying('({"artist":"A"});').title).toBe(FALLBACK_TITLE)
  })

  it('defaults artist to an empty string', () => {
    expect(parseNowPlaying('({"title":"T"});').artist).toBe('')
  })

  it('throws on a payload that is not JSONP', () => {
    expect(() => parseNowPlaying('not jsonp')).toThrow()
    expect(() => parseNowPlaying('(null);')).toThrow()
  })
})

describe('handleSse', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns event-stream headers with CORS *', () => {
    const res = handleSse(req(), vi.fn().mockResolvedValue(jsonp({ title: 'T', artist: 'A' })))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('rejects non-GET methods with 405 and does not fetch', () => {
    const fetchFn = vi.fn()
    const res = handleSse(req('POST'), fetchFn)
    expect(res.status).toBe(405)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('sends a named time-update event immediately with id 1', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonp({ title: 'Joy', artist: 'Rend' }))
    const res = handleSse(req(), fetchFn)
    const text = await readText(res.body!.getReader())
    expect(text).toBe('event: time-update\nid: 1\ndata: {"title":"Joy","artist":"Rend"}\n\n')
    expect(fetchFn.mock.calls[0][0]).toBe(NOW_PLAYING_URL)
  })

  it('polls again after the interval with an incremented id', async () => {
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(jsonp({ title: 'T', artist: 'A' })))
    const reader = handleSse(req(), fetchFn).body!.getReader()
    await readText(reader)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(await readText(reader)).toContain('id: 2\n')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('never starts a second poll while one is in flight', async () => {
    let resolveFirst: (r: Response) => void = () => {}
    const fetchFn = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((r) => { resolveFirst = r }))
      .mockResolvedValue(jsonp({ title: 'T', artist: 'A' }))
    const body = handleSse(req(), fetchFn).body!
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    resolveFirst(jsonp({ title: 'T', artist: 'A' }))
    await body.cancel() // stops the timer the resumed poll would schedule
  })

  it('sends a heartbeat comment and stays open when the upstream fetch fails', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue(jsonp({ title: 'T', artist: 'A' }))
    const reader = handleSse(req(), fetchFn).body!.getReader()
    expect(await readText(reader)).toBe(': heartbeat\n\n')
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(await readText(reader)).toContain('event: time-update')
  })

  it('sends a heartbeat on a non-ok upstream status', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('err', { status: 503 }))
    const reader = handleSse(req(), fetchFn).body!.getReader()
    expect(await readText(reader)).toBe(': heartbeat\n\n')
  })

  it('closes the stream when upstream returns 404', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('nf', { status: 404 }))
    const reader = handleSse(req(), fetchFn).body!.getReader()
    const { done } = await reader.read()
    expect(done).toBe(true)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('stops polling after the client cancels', async () => {
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(jsonp({ title: 'T', artist: 'A' })))
    const reader = handleSse(req(), fetchFn).body!.getReader()
    await readText(reader)
    await reader.cancel()
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run to confirm failure.** `rg-run --class light --label sse-test -- npm test -- src/sse.test.ts`. Expected: FAIL, cannot resolve `./sse`.

- [ ] **Step 3: Implement.** Create `src/sse.ts`:

```ts
export const NOW_PLAYING_URL =
  'https://proxy.radiojar.com/api/stations/g4d600bv6p5tv/now_playing/?callback='
export const POLL_INTERVAL_MS = 20_000
export const FALLBACK_TITLE = 'Reach Radio FM'
const FETCH_TIMEOUT_MS = 5_000

export interface NowPlaying {
  title: string
  artist: string
}

// Radiojar answers JSONP with an empty callback name: `({...});`
export function parseNowPlaying(text: string): NowPlaying {
  const start = text.indexOf('(')
  const end = text.lastIndexOf(')')
  if (start === -1 || end <= start) throw new Error('Unexpected now-playing format')
  const raw: unknown = JSON.parse(text.slice(start + 1, end))
  if (typeof raw !== 'object' || raw === null) throw new Error('Unexpected now-playing payload')
  const data = raw as Record<string, unknown>
  return {
    title: typeof data.title === 'string' && data.title ? data.title : FALLBACK_TITLE,
    artist: typeof data.artist === 'string' ? data.artist : '',
  }
}

export function handleSse(request: Request, fetchFn: typeof fetch = fetch): Response {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } })
  }

  const encoder = new TextEncoder()
  let id = 1
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const stop = () => {
    stopped = true
    if (timer) clearTimeout(timer)
    timer = null
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          stop() // controller closed: client is gone
        }
      }

      // Chained setTimeout (not setInterval) so polls never overlap.
      const poll = async () => {
        if (stopped) return
        try {
          const res = await fetchFn(NOW_PLAYING_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
          if (res.status === 404) {
            stop()
            try {
              controller.close()
            } catch {
              // already closed
            }
            return
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = parseNowPlaying(await res.text())
          send(`event: time-update\nid: ${id++}\ndata: ${JSON.stringify(data)}\n\n`)
        } catch {
          // Keep the connection open on upstream errors; the next poll retries.
          send(': heartbeat\n\n')
        }
        if (!stopped) timer = setTimeout(poll, POLL_INTERVAL_MS)
      }

      void poll()
    },
    cancel() {
      stop()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
```

- [ ] **Step 4: Run to confirm pass.** `rg-run --class light --label sse-test -- npm test -- src/sse.test.ts` and `rg-run --class light --label sse-tsc -- npm run typecheck`. Expected: all pass, no type errors.
- [ ] **Step 5: Commit.** `git add src/sse.ts src/sse.test.ts` then `git commit -m "feat(sse): add now-playing SSE handler" -- src/sse.ts src/sse.test.ts`.

---

### Task 2: Route it, document it

**Files:** Modify `src/handler.ts`, `src/handler.test.ts`, `README.md`, `CLAUDE.md`, `docs/architecture-and-operations.md`; (reach-radio-nextjs) the roadmap.

- [ ] **Step 1: Failing routing tests.** Append inside the `describe('handle', ...)` block of `src/handler.test.ts` (before its closing `})`):

```ts
  it('routes /api/stream-info-sse to the SSE handler, not the audio upstream', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response('({"title":"T","artist":"A"});', { status: 200 }))
    const res = await handle(
      new Request('https://stream.reach.radio/api/stream-info-sse'),
      fetchFn,
    )
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    await res.body?.cancel()
    expect(fetchFn.mock.calls[0][0]).not.toBe(UPSTREAM_URL)
  })

  it('still serves audio on every other path', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okUpstream())
    const res = await handle(new Request('https://stream.reach.radio/anything'), fetchFn)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(fetchFn.mock.calls[0][0]).toBe(UPSTREAM_URL)
  })
```

Run `rg-run --class light --label handler-test -- npm test -- src/handler.test.ts`; expect the first new test to FAIL.

- [ ] **Step 2: Implement routing.** In `src/handler.ts` add `import { handleSse } from './sse'` as the first line, add `export const SSE_PATH = '/api/stream-info-sse'` below `CONNECT_TIMEOUT_MS`, and insert as the first statement inside `handle`:

```ts
  if (new URL(request.url).pathname === SSE_PATH) return handleSse(request, fetchFn)
```

- [ ] **Step 3: Verify.** `rg-run --class light --label worker-test -- npm test` and `rg-run --class light --label worker-tsc -- npm run typecheck` (all existing handler and index tests plus new ones pass).
- [ ] **Step 4: Docs.** `README.md`: add a "Routes" list (`/api/stream-info-sse` now-playing SSE, `/` and everything else audio passthrough); change Radiojar-ID item 5 to also list `src/sse.ts` in this repo. `CLAUDE.md` Hard rules: add "The no-TransformStream / no-per-chunk rule applies to the audio path only; `src/sse.ts` is not a passthrough, keep its wire format identical to `reach-radio-web/src/pages/api/stream-info-sse.ts`." `docs/architecture-and-operations.md`: add an "SSE route" section (wire format, 20 s poll, heartbeat-on-error, no overlap, cancel stops, measured 25 min hold on the Cloudflare runtime, not yet deployed or soaked, free-plan request budget) and extend the Radiojar-ID line at line 73.
- [ ] **Step 5: Roadmap row.** In `/Users/danielmccauley/orca/workspaces/reach-radio-nextjs/minnow/docs/superpowers/plans/2026-10-13-audio-stream-master-roadmap.md` append row 20: `| 20 | Now-playing SSE on the stream Worker (`stream.reach.radio/api/stream-info-sse`), then repoint web, iOS v4 and Android before the Astro app retires | usage-spike doc | 9 | Code done locally, not deployed (Task 2); deploy, soak and repoint pending (Task 3) | `2026-11-05-stream-worker-now-playing-sse.md` |` (match the table's column order; read it first).
- [ ] **Step 6: Commit** the worker repo changes (`feat(sse): route /api/stream-info-sse in the worker handler` for `src/handler.ts src/handler.test.ts`; `docs: document the SSE route` for the three docs) and, with `git -C /Users/danielmccauley/orca/workspaces/reach-radio-nextjs/minnow`, `docs: add stream worker SSE roadmap row` for the roadmap file only (the plan file is already committed by the orchestrator). Local only.

---

### Task 3: Deploy and cut over (separate, each step ask-gated; NOT part of the agent run)

- [x] **Step 1 (USER or Yes/No):** `npm run deploy` in the worker repo (needs `wrangler login`). Rollback: `npx wrangler rollback`. **DONE:** done 2026-11-05, worker version 02298be7.
- [x] **Step 2:** verify the deployed host: `curl -sN -m 60 -H "Origin: https://reach.radio" https://stream.reach.radio/api/stream-info-sse` shows `Content-Type: text/event-stream`, `access-control-allow-origin: *`, 3 `time-update` events 20 s apart. Check `curl -sI https://stream.reach.radio/` still returns audio/mpeg. **DONE:** verified 2026-11-05.
- [x] **Step 3:** 25-minute hold on the new host (same method as the 2026-11-04 `pages.dev` measurement). Pass: `curl -sN -m 1500` runs to the cap (exit 28 or time_total 1500) with events every 20 s and no early close. Free-plan CPU is cumulative per invocation, so the new host must prove it, not just pages.dev. **DONE:** 74 events over 1500 s, no cut.
- [x] **Step 4 (nextjs repo, own push Yes/No):** `NOW_PLAYING_SSE_URL` to `https://stream.reach.radio/api/stream-info-sse`, add `https://stream.reach.radio` to CSP `connect-src` (already in `media-src`), update the preconnect link and the config test, re-run the live Orca check, keep `pages.dev` in `connect-src` until stale tabs are gone. **DONE:** `c1aee86`, prod check passed; `pages.dev` removed from `connect-src` (kept in `media-src`).
- [ ] **Step 5:** iOS v4 `NowPlayingService.swift` repoint before it ships (native repo, owner decision).

## Self-Review

- Spec coverage: same wire format (T1 tests), no overlap (T1), survive upstream errors (T1), 404 close (T1), cancel (T1), routing with audio untouched (T2), docs and roadmap (T2), deploy and cutover (T3, gated).
- Types: `handleSse(request, fetchFn)` and `handle(request, fetchFn)` share the `fetchFn: typeof fetch` signature; constants exported from `src/sse.ts` are the ones tests import.
