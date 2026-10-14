# Audio Stream Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `reach-radio-audio-stream-worker`, a Cloudflare Worker serving the live Radiojar stream at `stream.reach.radio`, so no client depends on Vercel for audio.

**Architecture:** A new standalone repo holding one Worker (`src/index.ts`, ~30 lines). It fetches `http://stream.radiojar.com/g4d600bv6p5tv`, the exact URL the legacy Astro function uses and the 61-minute pages.dev hold verified on the same Cloudflare runtime (following any redirect) and returns `upstream.body` untouched. It runs in parallel with the legacy `pages.dev` Astro function (B redirect path) until the legacy apps are retired. Decision record: `reach-radio-nextjs/docs/superpowers/plans/2026-10-09-stream-hosting-decision.md` §4d. Roadmap rows 9–11: `2026-10-13-audio-stream-master-roadmap.md`.

**Tech Stack:** Cloudflare Workers, Wrangler, TypeScript (strict), Vitest.

## Global Constraints

- Repo path: `~/Documents/Development/reach-radio-audio-stream-worker` (new, sibling of the other repos; NOT inside `reach-radio-nextjs` or `reach-radio-web`).
- Pure passthrough of `upstream.body`. No `TransformStream`, no per-chunk work (free plan: 10 ms CPU per request).
- Never send `Icy-MetaData` upstream (Radiojar would interleave metadata bytes into the audio).
- The 10 s connect timeout must be cleared as soon as upstream headers arrive. The abort signal must not stay armed for the body.
- Response header `Cache-Control: no-store`. Use the same `http://` upstream URL as the legacy function (verified by the 61-minute hold) and follow redirects (default `fetch` behaviour). Switching to `https://` is a separate change that must be gated on a production soak; `wrangler dev --local` does not prove edge behaviour.
- Radiojar stream ID `g4d600bv6p5tv` appears in 3 places (this Worker, `reach-radio-web/src/pages/api/audio-stream.ts`, `RADIOJAR_URL`/`FALLBACK_STREAM_URL` in `reach-radio-nextjs/src/lib/constants.ts`). Keep the README note listing all three.
- TypeScript strict, no `any`. Conventional commits.
- No push, no deploy, no DNS, no Sanity change by an agent. Those steps are the user's, marked **USER**.
- Never add a Vercel fallback for audio.
- `reach.radio` stays on Cloudflare nameservers (Worker custom domain requirement).

## File Structure

- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`: tooling.
- `wrangler.toml`: Worker name, entry, compatibility date, custom domain route.
- `src/index.ts`: the Worker (`export default { fetch }`) plus the exported `handle` function used by tests.
- `src/index.test.ts`: unit tests with a stubbed `fetch`.
- `README.md`: purpose, deploy steps, the 3-places note.

---

### Task 1: Scaffold the repo and the passthrough handler (TDD)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `wrangler.toml`, `src/index.ts`, `src/index.test.ts`

**Interfaces:**
- Produces: `handle(request: Request, fetchFn?: typeof fetch): Promise<Response>` and `export default { fetch: (request: Request) => handle(request) }`.

- [ ] **Step 1: Create the repo and install tooling**

```bash
mkdir -p ~/Documents/Development/reach-radio-audio-stream-worker/src
cd ~/Documents/Development/reach-radio-audio-stream-worker
git init
npm init -y
npm install -D wrangler typescript vitest @cloudflare/workers-types
```

Sandbox note: `npm install` needs `registry.npmjs.org` in allowed domains.

Expected: `package.json` and `node_modules` exist, no errors.

- [ ] **Step 2: Write config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { environment: 'node' } })
```

`.gitignore`:
```
node_modules
.wrangler
.dev.vars
```

`wrangler.toml`:
```toml
name = "reach-radio-audio-stream-worker"
main = "src/index.ts"
# Use today's date, or the newest date the installed wrangler/workerd accepts.
compatibility_date = "2026-10-14"

routes = [
  { pattern = "stream.reach.radio", custom_domain = true }
]
```

Add to `package.json` scripts: `"test": "vitest run"`, `"typecheck": "tsc"`, `"dev": "wrangler dev"`, `"deploy": "wrangler deploy"`.

- [ ] **Step 3: Write the failing tests**

`src/index.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { handle, UPSTREAM_URL } from './index'

const req = (method = 'GET') => new Request('https://stream.reach.radio/', { method })

const okUpstream = () =>
  new Response('audio-bytes', { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })

describe('handle', () => {
  it('passes the upstream body through with audio/mpeg and no-store', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okUpstream())
    const res = await handle(req(), fetchFn)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.text()).toBe('audio-bytes')
  })

  it('fetches the Radiojar URL without an Icy-MetaData header', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okUpstream())
    await handle(req(), fetchFn)
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe(UPSTREAM_URL)
    expect(new Headers(init?.headers).has('Icy-MetaData')).toBe(false)
    expect(init?.redirect ?? 'follow').toBe('follow')
  })

  it('defaults Content-Type to audio/mpeg when upstream sends none', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('x', { status: 200 }))
    const res = await handle(req(), fetchFn)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
  })

  it('returns 502 when upstream is not ok', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('no', { status: 503 }))
    const res = await handle(req(), fetchFn)
    expect(res.status).toBe(502)
  })

  it('returns 502 when upstream fetch throws', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('boom'))
    const res = await handle(req(), fetchFn)
    expect(res.status).toBe(502)
  })

  it('rejects non-GET/HEAD methods with 405', async () => {
    const fetchFn = vi.fn()
    const res = await handle(req('POST'), fetchFn)
    expect(res.status).toBe(405)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('does not abort the body after headers arrive', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const fetchFn = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      return Promise.resolve(okUpstream())
    })
    await handle(req(), fetchFn)
    vi.advanceTimersByTime(11_000)
    expect(signal?.aborted).toBe(false)
    vi.useRealTimers()
  })

  it('aborts and returns 502 when upstream never responds within 10 s', async () => {
    vi.useFakeTimers()
    const fetchFn = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )
    const pending = handle(req(), fetchFn)
    await vi.advanceTimersByTimeAsync(10_001)
    const res = await pending
    expect(res.status).toBe(502)
    vi.useRealTimers()
  })

  it('HEAD returns headers, no body, and cancels the upstream body', async () => {
    const upstream = okUpstream()
    const cancelSpy = vi.spyOn(upstream.body as ReadableStream, 'cancel')
    const fetchFn = vi.fn().mockResolvedValue(upstream)
    const res = await handle(req('HEAD'), fetchFn)
    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
    expect(cancelSpy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, `./index` has no exports.

- [ ] **Step 5: Write the implementation**

`src/index.ts`:
```ts
export const UPSTREAM_URL = 'http://stream.radiojar.com/g4d600bv6p5tv'
const CONNECT_TIMEOUT_MS = 10_000

export async function handle(
  request: Request,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS)

  let upstream: Response
  try {
    upstream = await fetchFn(UPSTREAM_URL, { signal: controller.signal })
  } catch {
    clearTimeout(timer)
    return new Response('Bad Gateway', { status: 502 })
  }
  // Headers arrived: disarm the timeout so it cannot kill the body mid-stream.
  clearTimeout(timer)

  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel()
    return new Response('Bad Gateway', { status: 502 })
  }

  if (request.method === 'HEAD') {
    // Do not leave the Radiojar connection streaming with no reader.
    await upstream.body.cancel()
  }

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}

export default {
  fetch: (request: Request): Promise<Response> => handle(request),
}
```

Note: the abort signal stays attached to the fetch, but once `clearTimeout` runs nothing ever calls `abort()`, so the body is not cut.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: 9 tests pass, tsc exits 0.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add passthrough audio stream worker"
```

---

### Task 2: README and local smoke test

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`** with exactly this content:

````markdown
# reach-radio-audio-stream-worker

Cloudflare Worker serving the Reach Radio live stream at `https://stream.reach.radio/`.
Pure passthrough of `http://stream.radiojar.com/g4d600bv6p5tv`; no Vercel involvement.

## Commands
- `npm test` — unit tests
- `npm run typecheck` — tsc
- `npm run dev` — local Worker on http://localhost:8787
- `npm run deploy` — deploy (needs `wrangler login`; deploys are manual)

## Rules
- Never send `Icy-MetaData` upstream.
- Never add a TransformStream or per-chunk work (free plan: 10 ms CPU).
- Never fall back to Vercel for audio.

## Radiojar stream ID lives in 3 places
1. `src/index.ts` (`UPSTREAM_URL`) in this repo
2. `reach-radio-web/src/pages/api/audio-stream.ts` (legacy Astro function)
3. `reach-radio-nextjs/src/lib/constants.ts` (`RADIOJAR_URL` and `FALLBACK_STREAM_URL`)

Update all three if Radiojar changes the ID.

## Limits
Cloudflare free plan: 100k requests/day shared across the account (Pages Functions + Workers), 10 ms CPU per request. Workers Paid is $5/month.

## Parallel hosts
Runs alongside the legacy `reach-radio-web.pages.dev/api/audio-stream` until the published Android/iOS 3.2 apps are retired.
````

- [ ] **Step 2: Local smoke test (**USER** runs, needs network outside the sandbox)**

```
! cd ~/Documents/Development/reach-radio-audio-stream-worker && npx wrangler dev --local
```
In a second terminal:
```
! curl -s -D - -o /dev/null -m 10 http://localhost:8787/
```
Expected: `HTTP/1.1 200`, `content-type: audio/mpeg`, `cache-control: no-store`. Curl exits 28 at the 10 s limit (stream is endless); bytes flowing is the pass.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

### Task 3: Deploy and soak (USER-run)

- [ ] **Step 1 (USER):** `npx wrangler login` then `npx wrangler deploy`. Confirm the `stream.reach.radio` custom domain attaches (requires `reach.radio` on Cloudflare nameservers, which it is).
- [ ] **Step 2 (USER):** `curl -sI https://stream.reach.radio/` returns 200, `audio/mpeg`, `no-store`.
- [ ] **Step 3 (USER):** multi-hour hold: `caffeinate -i curl -s -o /dev/null -m 14400 -w '%{time_total} %{size_download}\n' https://stream.reach.radio/`. Pass: runs to the limit (exit 28) with ~16 KB/s average.
- [ ] **Step 4 (USER):** during the hold run one `npx wrangler deploy`; note whether the stream is cut and how long clients take to reconnect (iOS v4 retry path, T0: ~13 s).
- [ ] **Step 5:** record results in `reach-radio-nextjs` decision doc §4c (docs-only local commit).

---

### Task 4: Flip clients to the Worker (USER edits Sanity; agent edits nextjs repo)

Depends on Task 3 passing and B landed on `main`.

**Files (reach-radio-nextjs):**
- Modify: `next.config.ts` (redirect destination → `https://stream.reach.radio/`, CSP `media-src` add `https://stream.reach.radio`)

- [ ] **Step 1:** edit `next.config.ts` redirect and CSP; keep `https://reach-radio-web.pages.dev` in `media-src` while legacy apps exist.
- [ ] **Step 2:** `npm run build` and curl the local 307 `Location`.
- [ ] **Step 3 (USER):** in Sanity `appSettings.radioAudioURL` set `https://stream.reach.radio/` and publish. Confirm web player and iOS v4 play.
- [ ] **Step 4:** update roadmap rows 9–11 to Done; record in decision doc.
- [ ] **Step 5:** commit (`feat(player): point stream redirect at stream.reach.radio`).

Rollback: set Sanity back to `https://reach.radio/api/audio-stream`. Never restore the Vercel proxy.

## Self-Review

- Spec coverage vs §4d Worker requirements: passthrough (T1), no Icy-MetaData (T1 test), timeout cleared (T1 test), no-store (T1 test), 302 follow (T1), DNS/nameserver (Global Constraints, T3), 3-places note (T2), soak with mid-stream deploy (T3), Sanity flip + redirect + CSP (T4).
- Types: `handle` and `UPSTREAM_URL` names consistent across tasks.
