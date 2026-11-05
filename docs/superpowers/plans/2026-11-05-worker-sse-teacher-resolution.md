# Worker SSE teacher resolution Implementation Plan

> **For agentic workers:** execute via `superpowers:subagent-driven-development` in a child sub session (sonnet coordinator, haiku implementers). Checkbox steps. Tests, deploy and push are each owner-approved; nothing here deploys or pushes.

**Goal:** `https://stream.reach.radio/api/stream-info-sse` emits `imageUrl` and `resolvedArtist` like the Vercel route, so iOS v4 can repoint now-playing to the Worker and the Vercel SSE route can retire (bug doc `docs/bugs/vercel-usage-spike-2026-11.md` §8f, option (a), owner choice 2026-11-05).

**Offload check:** rung = Cloudflare Worker (already in use); req/day added to the Worker = none; Sanity `apicdn` gets about 1 request per isolate per hour (public read, no token, free); account = Cloudflare free plan, Sanity project `bk05c6rl`.

**Repo:** `~/Documents/Development/reach-radio-audio-stream-worker` (work in a worktree off `main`). This plan file lives in reach-radio-nextjs (decision records live here).

**Parity facts (verified 2026-11-05):**
- Vercel route (`src/app/api/stream-info-sse/route.ts`) sends `{ title, artist, imageUrl, resolvedArtist }` with explicit `null`s (not omitted), data-only events.
- Worker sends named events `event: time-update\nid: N\ndata: {...}`. Keep that; just add the two keys after `title`, `artist`.
- Web consumer `src/hooks/useNowPlaying.ts:120-136` uses server fields only when both are strings and `imageUrl` starts with `https://cdn.sanity.io/`, else falls back to its client-side match. So adding the fields is safe for web, and both paths give the same teacher.
- Matching copied from `reach-radio-nextjs/src/lib/teacherCache.ts` (`matches`, `resolveArtist`): bidirectional case-insensitive substring; photo gets `?w=420&fm=jpg` (`&` if a `?` exists).
- Sanity query, project `bk05c6rl`, dataset `production`, apiVersion `2024-02-22`, perspective `published`, public read: `https://bk05c6rl.apicdn.sanity.io/v2024-02-22/data/query/production?perspective=published&query=...` returned 200 with `{result:[{name,photo}]}` (checked with curl).

**Worker rules (its CLAUDE.md):** SSE is not the audio path; `src/index.ts` exports only `default`; strict TS, no `any`; free plan 10 ms CPU; never touch audio path files.

## Files (allowed list; needing any other file = stop, `WAITING ON orchestrator`)
- Create `src/teachers.ts`, `src/teachers.test.ts`
- Modify `src/sse.ts`, `src/sse.test.ts`
- Modify `README.md`, `CLAUDE.md`, `docs/architecture-and-operations.md`

## Design decisions (from advisor review)
- No in-flight promise dedupe (`pending`): on workerd one request's promise must not be awaited by another. Duplicate cold-isolate fetches are cheap.
- Failure backoff: after a failed or empty Sanity fetch, do not retry for 5 min (`RETRY_AFTER_FAILURE_MS`), so an outage does not add a 5 s fetch to every 20 s poll.
- Stale cache is served when a refresh fails. Empty cache + failure = `[]` = both fields `null`; the event is still sent (never a heartbeat just because Sanity is down).
- `handleSse(request, fetchFn = fetch, loadTeachers = () => getTeachers(fetchFn))`: injectable loader so existing SSE tests keep their exact `fetchFn` call counts.

---

## Task 1: `src/teachers.ts` (TDD)

- [ ] **Step 1: write failing tests.** Create `src/teachers.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CACHE_TTL_MS,
  RETRY_AFTER_FAILURE_MS,
  SANITY_TEACHERS_URL,
  getTeachers,
  matches,
  resetTeacherCache,
  resolveArtist,
  type Teacher,
} from './teachers'

const teachers: Teacher[] = [
  { name: 'John MacArthur', photo: 'https://cdn.sanity.io/images/bk05c6rl/production/a-100x100.jpg' },
  { name: 'Greg Laurie', photo: null },
  { name: 'Chuck Swindoll', photo: 'https://cdn.sanity.io/images/bk05c6rl/production/b.jpg?rect=1,2,3,4' },
]

const sanity = (result: unknown, status = 200) =>
  new Response(JSON.stringify({ result }), { status })

describe('matches', () => {
  it('matches when the artist contains the teacher name', () => {
    expect(matches('Dr. John MacArthur', 'John MacArthur')).toBe(true)
  })
  it('matches when the teacher name contains the artist', () => {
    expect(matches('MacArthur', 'John MacArthur')).toBe(true)
  })
  it('is case-insensitive', () => {
    expect(matches('GREG LAURIE', 'greg laurie')).toBe(true)
  })
  it('does not match unrelated names', () => {
    expect(matches('Rend Collective', 'John MacArthur')).toBe(false)
  })
})

describe('resolveArtist', () => {
  it('returns nulls for an empty artist', () => {
    expect(resolveArtist('', teachers)).toEqual({ imageUrl: null, resolvedArtist: null })
  })
  it('returns nulls when no teacher matches', () => {
    expect(resolveArtist('Rend Collective', teachers)).toEqual({ imageUrl: null, resolvedArtist: null })
  })
  it('returns the canonical name and null image when the teacher has no photo', () => {
    expect(resolveArtist('Greg Laurie', teachers)).toEqual({ imageUrl: null, resolvedArtist: 'Greg Laurie' })
  })
  it('appends width and format to the photo url', () => {
    expect(resolveArtist('Dr. John MacArthur', teachers)).toEqual({
      imageUrl: 'https://cdn.sanity.io/images/bk05c6rl/production/a-100x100.jpg?w=420&fm=jpg',
      resolvedArtist: 'John MacArthur',
    })
  })
  it('uses & when the photo url already has a query string', () => {
    expect(resolveArtist('Chuck Swindoll', teachers).imageUrl).toBe(
      'https://cdn.sanity.io/images/bk05c6rl/production/b.jpg?rect=1,2,3,4&w=420&fm=jpg',
    )
  })
  it('returns nulls when the teacher list is empty', () => {
    expect(resolveArtist('Greg Laurie', [])).toEqual({ imageUrl: null, resolvedArtist: null })
  })
})

describe('getTeachers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetTeacherCache()
  })
  afterEach(() => vi.useRealTimers())

  it('fetches the Sanity teacher query and returns the list', async () => {
    const fetchFn = vi.fn().mockResolvedValue(sanity(teachers))
    expect(await getTeachers(fetchFn)).toEqual(teachers)
    expect(fetchFn.mock.calls[0][0]).toBe(SANITY_TEACHERS_URL)
    expect(SANITY_TEACHERS_URL).toContain('bk05c6rl.apicdn.sanity.io')
  })

  it('serves from cache inside the TTL', async () => {
    const fetchFn = vi.fn().mockResolvedValue(sanity(teachers))
    await getTeachers(fetchFn)
    await getTeachers(fetchFn)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('refetches after the TTL', async () => {
    const fetchFn = vi.fn().mockResolvedValue(sanity(teachers))
    await getTeachers(fetchFn)
    vi.advanceTimersByTime(CACHE_TTL_MS + 1)
    await getTeachers(fetchFn)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('returns [] when the first fetch fails', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('boom'))
    expect(await getTeachers(fetchFn)).toEqual([])
  })

  it('returns [] on a non-ok response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(sanity([], 503))
    expect(await getTeachers(fetchFn)).toEqual([])
  })

  it('keeps the stale list when a refresh fails', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(sanity(teachers))
      .mockRejectedValue(new Error('boom'))
    await getTeachers(fetchFn)
    vi.advanceTimersByTime(CACHE_TTL_MS + 1)
    expect(await getTeachers(fetchFn)).toEqual(teachers)
  })

  it('ignores an empty result and keeps the previous list', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(sanity(teachers)).mockResolvedValue(sanity([]))
    await getTeachers(fetchFn)
    vi.advanceTimersByTime(CACHE_TTL_MS + 1)
    expect(await getTeachers(fetchFn)).toEqual(teachers)
  })

  it('drops malformed entries', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(sanity([teachers[0], { name: 5 }, null, { name: 'No Photo Key' }]))
    expect(await getTeachers(fetchFn)).toEqual([teachers[0]])
  })

  it('does not retry for 5 minutes after a failure, then retries', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('boom'))
    await getTeachers(fetchFn)
    await getTeachers(fetchFn)
    vi.advanceTimersByTime(RETRY_AFTER_FAILURE_MS - 1000)
    await getTeachers(fetchFn)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    await getTeachers(fetchFn)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2:** run `npm test -- src/teachers.test.ts`; expect FAIL (module missing).

- [ ] **Step 3: implement.** Create `src/teachers.ts`:

```ts
// Teacher name/photo resolution for now-playing events. Parity with
// reach-radio-nextjs/src/lib/teacherCache.ts (matches + resolveArtist).
export const SANITY_TEACHERS_URL =
  'https://bk05c6rl.apicdn.sanity.io/v2024-02-22/data/query/production?perspective=published&query=' +
  encodeURIComponent('*[_type == "teacher"] { "name": name.first + " " + name.last, "photo": photo.asset->url }')

export const CACHE_TTL_MS = 60 * 60 * 1000
export const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000
const FETCH_TIMEOUT_MS = 5_000

export interface Teacher {
  name: string
  photo: string | null
}

export interface ArtistResolution {
  imageUrl: string | null
  resolvedArtist: string | null
}

let cached: Teacher[] = []
let nextAttemptAt = 0 // epoch ms; 0 = fetch now

// Tests only.
export function resetTeacherCache(): void {
  cached = []
  nextAttemptAt = 0
}

function isTeacher(value: unknown): value is Teacher {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return typeof t.name === 'string' && (typeof t.photo === 'string' || t.photo === null)
}

// Module cache per isolate. No shared in-flight promise: each SSE request is its
// own context on workerd, so a request must never await another request's promise.
export async function getTeachers(fetchFn: typeof fetch = fetch): Promise<Teacher[]> {
  const now = Date.now()
  if (now < nextAttemptAt) return cached
  try {
    const res = await fetchFn(SANITY_TEACHERS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body: unknown = await res.json()
    const result =
      typeof body === 'object' && body !== null ? (body as { result?: unknown }).result : undefined
    const list = Array.isArray(result) ? result.filter(isTeacher) : []
    if (list.length === 0) throw new Error('Empty teacher list')
    cached = list
    nextAttemptAt = now + CACHE_TTL_MS
  } catch {
    // Keep the stale list (or []) and back off; SSE must never break on Sanity.
    nextAttemptAt = now + RETRY_AFTER_FAILURE_MS
  }
  return cached
}

// Bidirectional substring match. "Dr. John MacArthur" matches teacher "John MacArthur".
export function matches(artist: string, teacherName: string): boolean {
  const a = artist.toLowerCase()
  const t = teacherName.toLowerCase()
  return t.includes(a) || a.includes(t)
}

export function resolveArtist(artist: string, teachers: Teacher[]): ArtistResolution {
  if (!artist) return { imageUrl: null, resolvedArtist: null }
  const match = teachers.find((t) => matches(artist, t.name))
  if (!match) return { imageUrl: null, resolvedArtist: null }
  if (!match.photo) return { imageUrl: null, resolvedArtist: match.name }
  const sep = match.photo.includes('?') ? '&' : '?'
  return { imageUrl: `${match.photo}${sep}w=420&fm=jpg`, resolvedArtist: match.name }
}
```

- [ ] **Step 4:** `npm test -- src/teachers.test.ts` and `npm run typecheck`; expect all PASS.
- [ ] **Step 5:** `git add src/teachers.ts src/teachers.test.ts` then `git commit -m "feat(sse): resolve teacher name and photo from Sanity" -- src/teachers.ts src/teachers.test.ts`

## Task 2: wire into `src/sse.ts` (TDD)

- [ ] **Step 1: update tests** in `src/sse.test.ts`:
  1. Add import `import type { Teacher } from './teachers'` and a helper after `readText`:
     ```ts
     const noTeachers = () => Promise.resolve<Teacher[]>([])
     ```
  2. Every existing `handleSse(req(...), fetchFn)` / `handleSse(req(), vi.fn()...)` call gets `, noTeachers` as the third argument, so Radiojar `fetchFn` call counts stay exact.
  3. Update the exact-string test to the new payload:
     ```ts
     expect(text).toBe(
       'event: time-update\nid: 1\ndata: {"title":"Joy","artist":"Rend","imageUrl":null,"resolvedArtist":null}\n\n',
     )
     ```
  4. Add inside `describe('handleSse')`:
     ```ts
     it('adds imageUrl and resolvedArtist for a teacher program', async () => {
       const fetchFn = vi.fn().mockResolvedValue(jsonp({ title: 'Verse by Verse', artist: 'Dr. John MacArthur' }))
       const loadTeachers = () =>
         Promise.resolve<Teacher[]>([{ name: 'John MacArthur', photo: 'https://cdn.sanity.io/images/bk05c6rl/production/a.jpg' }])
       const reader = handleSse(req(), fetchFn, loadTeachers).body!.getReader()
       const text = await readText(reader)
       expect(text).toContain('"resolvedArtist":"John MacArthur"')
       expect(text).toContain('"imageUrl":"https://cdn.sanity.io/images/bk05c6rl/production/a.jpg?w=420&fm=jpg"')
       await reader.cancel()
     })

     it('sends nulls for a non-teacher artist', async () => {
       const fetchFn = vi.fn().mockResolvedValue(jsonp({ title: 'Joy', artist: 'Rend Collective' }))
       const loadTeachers = () =>
         Promise.resolve<Teacher[]>([{ name: 'John MacArthur', photo: null }])
       const reader = handleSse(req(), fetchFn, loadTeachers).body!.getReader()
       expect(await readText(reader)).toContain('"imageUrl":null,"resolvedArtist":null')
       await reader.cancel()
     })

     it('still sends the event (not a heartbeat) when the teacher loader returns nothing', async () => {
       const fetchFn = vi.fn().mockResolvedValue(jsonp({ title: 'T', artist: 'A' }))
       const reader = handleSse(req(), fetchFn, noTeachers).body!.getReader()
       expect(await readText(reader)).toContain('event: time-update')
       await reader.cancel()
     })

     it('uses the injected fetch for Sanity by default', async () => {
       const fetchFn = vi.fn().mockImplementation((url: string) =>
         Promise.resolve(
           url.includes('apicdn.sanity.io')
             ? new Response(JSON.stringify({ result: [{ name: 'Greg Laurie', photo: null }] }))
             : jsonp({ title: 'T', artist: 'Greg Laurie' }),
         ),
       )
       resetTeacherCache()
       const reader = handleSse(req(), fetchFn).body!.getReader()
       expect(await readText(reader)).toContain('"resolvedArtist":"Greg Laurie"')
       await reader.cancel()
     })
     ```
     (import `resetTeacherCache` from `./teachers` too; call `resetTeacherCache()` in `beforeEach`.)
- [ ] **Step 2:** `npm test -- src/sse.test.ts`; expect the new and updated tests FAIL.
- [ ] **Step 3: implement.** In `src/sse.ts`:
  - add `import { getTeachers, resolveArtist, type Teacher } from './teachers'`
  - change signature to:
    ```ts
    export function handleSse(
      request: Request,
      fetchFn: typeof fetch = fetch,
      loadTeachers: () => Promise<Teacher[]> = () => getTeachers(fetchFn),
    ): Response {
    ```
  - replace the `send(...)` line in `poll` (after `const data = parseNowPlaying(...)`) with:
    ```ts
    const resolved = resolveArtist(data.artist, await loadTeachers())
    send(`event: time-update\nid: ${id++}\ndata: ${JSON.stringify({ ...data, ...resolved })}\n\n`)
    ```
    Leave 404, heartbeat and timer code untouched. `loadTeachers` never throws (`getTeachers` swallows), so an upstream parse error still heartbeats exactly as before.
- [ ] **Step 4:** `npm test` (all) and `npm run typecheck`; expect PASS.
- [ ] **Step 5:** `git add src/sse.ts src/sse.test.ts` then `git commit -m "feat(sse): add imageUrl and resolvedArtist to now-playing events" -- src/sse.ts src/sse.test.ts`
- [ ] **Step 6: local smoke** (needs the sandbox-off Yes/No, orchestrator asks): `npm run dev` then `curl -sN -m 25 http://localhost:8787/api/stream-info-sse`. Expect one `event: time-update` with both new keys. Kill by PID. Record output in the DONE report.

## Task 3: docs

- [ ] **Step 1:** In `CLAUDE.md` replace the SSE sentence in Hard rules with exactly:
  `- The no-TransformStream / no-per-chunk rule applies to the audio path only; `src/sse.ts` is not a passthrough. Its wire format is `event: time-update` with `{title, artist, imageUrl, resolvedArtist}` (the last two `string|null`, resolved from Sanity public read in `src/teachers.ts`, parity with `reach-radio-nextjs/src/lib/teacherCache.ts`). Old clients that read only `title` and `artist` keep working.`
- [ ] **Step 2:** `README.md` and `docs/architecture-and-operations.md`: update the `/api/stream-info-sse` line to say "adds `imageUrl` and `resolvedArtist`", note the Sanity dependency (project `bk05c6rl`, public read, 1 h cache, 5 min backoff on failure, falls back to nulls), and add `src/teachers.ts` plus the Sanity project id to the cross-repo coupling list.
- [ ] **Step 3:** `git add CLAUDE.md README.md docs/architecture-and-operations.md` then `git commit -m "docs: document SSE teacher resolution" -- CLAUDE.md README.md docs/architecture-and-operations.md`

## Gate A (owner Yes/No): deploy (`npm run deploy`, sandbox off)
After deploy, checks:
- `curl -sI https://stream.reach.radio/` still 200 audio; `curl -sN -m 45 https://stream.reach.radio/api/stream-info-sse` returns an event with both new keys (nulls are correct when a non-teacher program airs).
- Teacher proof: use the current program if it is a teacher program; otherwise rely on the Task 2 tests plus a one-off check that the Worker returns the same `resolvedArtist` as `https://reach-radio-nextjs.vercel.app/api/stream-info` while both report the same artist. Do not claim a live teacher match unless one was seen.
- Two concurrent SSE clients on the fresh deploy both receive events.
- 25 min SSE hold; Cloudflare dashboard (or `wrangler tail`) shows no CPU or subrequest limit errors.
- Record results in bug doc §8f.

## Gate B (owner Yes/No): push the Worker repo (`git push origin main`, list the commits).

## Not in this plan
iOS repoint (`NowPlayingService` URL, `AppConfig`), disabling the Vercel SSE route, Android, iOS v3. Each is separate and owner-gated; the Vercel route stays until iOS v4 is repointed.

## Risks
- R1 subrequest cap (free plan 50 per invocation): an SSE invocation already does one Radiojar fetch per 20 s and held 25 min earlier, so the cap is not biting as assumed; Sanity adds at most 1 per hour per isolate plus 1 retry per 5 min in an outage. The Gate A hold is the proof. Fallback if it fails: bake the teacher list at deploy time or use `cf.cacheTtl`.
- R2 isolate cache is not shared: each cold isolate fetches Sanity once; fine at current volume.
- R3 teacher list drift: 1 h TTL, same as the Vercel route's in-process layer.
- R4 `getTeachers` swallows errors, so a Sanity outage looks like "no teacher" silently. Accepted; the event keeps flowing.
