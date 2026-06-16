# OOM & Dev Server Errors — Investigation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diagnose and fix the Node.js heap OOM killing the dev server, resolve the middleware deprecation warning, and confirm the hydration warning is non-actionable.

**Architecture:** Three independent root causes. OOM is the highest priority — the SSE endpoint likely leaks `setInterval` handles across hot reloads and multiple client connections. Middleware rename is a mechanical fix. Hydration mismatch is a browser extension writing to the DOM (`cz-shortcut-listen`) — not our code.

**Tech Stack:** Next.js 16 (Turbopack), React 19 SSR, ReadableStream / SSE, Sanity CMS

---

## Error Summary

From the dev server logs:

| Error | Severity | Likely cause |
|---|---|---|
| `FATAL ERROR: … heap out of memory` | Critical | SSE intervals accumulating — not cleaned up on hot reload |
| `middleware file convention is deprecated` | Warning | `src/middleware.ts` should be `src/proxy.ts` in Next.js 16 |
| `A tree hydrated but some attributes … didn't match` | Info | Browser extension adds `cz-shortcut-listen="true"` to `<body>` — not our code |
| `/teachers` slow (2.2s–7.1s application time) | Perf | Sanity fetch latency; worsens under GC pressure from OOM |

---

## Files

| File | Action | Reason |
|---|---|---|
| `src/app/api/stream-info-sse/route.ts` | Modify | Add AbortController cleanup; fix cancel race |
| `src/middleware.ts` | Rename → `src/proxy.ts` | Next.js 16 deprecates `middleware` filename |
| `src/app/api/teachers-list/route.ts` | Read-only audit | Confirm Sanity fetch is the bottleneck, not a leak |

---

## Task 1: Verify SSE Leak Is Root Cause of OOM

**Files:**
- Read: `src/app/api/stream-info-sse/route.ts`

The SSE route creates a `setInterval` per connection in `start()` and clears it in `cancel()`. Two leak vectors exist:

**Vector A — cancel() not called on hot reload.** When Next.js dev hot-reloads, active SSE connections may not trigger `cancel()` on the old `ReadableStream` before a new one is created. Old intervals keep firing.

**Vector B — in-flight fetch outlives cancel().** `cancel()` clears the interval but doesn't abort the currently running `fetch()` inside `poll()`. If a 5s fetch is mid-flight when cancel fires, it can still enqueue to a cancelled controller, which throws — silently caught by the empty `catch {}`. This isn't a leak by itself, but confirms cleanup isn't atomic.

- [ ] **Step 1.1: Add interval counter logging to SSE route**

Edit `src/app/api/stream-info-sse/route.ts` temporarily:

```typescript
const RADIOJAR_URL = 'https://proxy.radiojar.com/api/stations/g4d600bv6p5tv/now_playing/?callback='

let _activeStreams = 0  // dev-mode leak counter

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder()
  let interval: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    async start(controller) {
      _activeStreams++
      console.log(`[SSE] stream opened — active: ${_activeStreams}`)

      async function poll() {
        try {
          const res = await fetch(RADIOJAR_URL, {
            signal: AbortSignal.timeout(5_000),
          })
          const text = await res.text()
          const json = JSON.parse(text.substring(1, text.length - 2)) as {
            title?: string
            artist?: string
          }
          const title = json.title || 'Reach Radio'
          const artist = json.artist || ''
          const data = JSON.stringify({ title, artist })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch {
          // retain previous state
        }
      }

      await poll()
      interval = setInterval(poll, 30_000)
    },
    cancel() {
      _activeStreams--
      console.log(`[SSE] stream cancelled — active: ${_activeStreams}`)
      clearInterval(interval)
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

- [ ] **Step 1.2: Start dev server and navigate around**

```bash
npm run dev
```

Open the app in a browser. Navigate between pages (listen, teachers, etc.). Every time a client connects to the SSE stream, `_activeStreams` increments. When Next.js hot-reloads or you navigate away, it should decrement.

**Expected (no leak):** active count stays at 1 while one tab is open; drops to 0 on close.
**Leak confirmed:** count climbs past 1 with a single tab, never decrements on hot reload.

- [ ] **Step 1.3: Trigger a hot reload and watch the counter**

Edit any source file to trigger Turbopack hot reload while a tab is open. Watch the terminal:

- If you see `stream opened` without a matching `stream cancelled` before it — leak confirmed.
- If active count climbs: the `cancel()` hook is not called on dev HMR.

---

## Task 2: Fix SSE Cleanup (AbortController + cancel guard)

**Files:**
- Modify: `src/app/api/stream-info-sse/route.ts`

The fix has two parts:
1. Add an `AbortController` so in-flight `fetch()` calls are aborted when the stream is cancelled.
2. Guard `controller.enqueue()` with a cancelled flag so stale poll callbacks don't throw after cancel.

- [ ] **Step 2.1: Write the fixed SSE route**

Replace the full contents of `src/app/api/stream-info-sse/route.ts`:

```typescript
const RADIOJAR_URL = 'https://proxy.radiojar.com/api/stations/g4d600bv6p5tv/now_playing/?callback='

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder()
  let interval: ReturnType<typeof setInterval> | undefined
  const abortController = new AbortController()
  let cancelled = false

  const stream = new ReadableStream({
    async start(controller) {
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
          const json = JSON.parse(text.substring(1, text.length - 2)) as {
            title?: string
            artist?: string
          }
          const title = json.title || 'Reach Radio'
          const artist = json.artist || ''
          const data = JSON.stringify({ title, artist })
          if (!cancelled) {
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
        } catch {
          // retain previous state on error or abort
        }
      }

      await poll()
      interval = setInterval(poll, 30_000)
    },
    cancel() {
      cancelled = true
      clearInterval(interval)
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

> **Note on `AbortSignal.any`:** Available in Node.js 20+. The project uses Node 22 (confirmed in OOM stack trace path `.nvm/versions/node/v22.18.0`). Safe to use.

- [ ] **Step 2.2: Remove the debug counter (if added in Task 1)**

The `_activeStreams` counter was for diagnosis only. If you added it in Task 1, revert those lines — they're not in the fixed version above.

- [ ] **Step 2.3: Start dev server and validate**

```bash
npm run dev
```

Open the app, trigger several hot reloads, navigate between pages. Monitor memory in a separate terminal:

```bash
# watch Node.js RSS every 5 seconds
while true; do ps aux | grep 'next dev' | grep -v grep | awk '{print $6 " KB RSS"}'; sleep 5; done
```

**Expected:** RSS stays roughly stable (may grow slowly due to module cache, not exponentially). No `FATAL ERROR` after sustained use.

- [ ] **Step 2.4: Commit**

```bash
git add src/app/api/stream-info-sse/route.ts
git commit -m "fix(api): abort in-flight SSE fetch and guard enqueue on cancel"
```

---

## Task 3: Rename middleware → proxy

**Files:**
- Rename: `src/middleware.ts` → `src/proxy.ts`

Next.js 16 deprecated the `middleware` filename convention in favor of `proxy`. The warning appears on every startup. The file content and exports stay the same — only the filename changes.

- [ ] **Step 3.1: Rename the file**

```bash
mv src/middleware.ts src/proxy.ts
```

- [ ] **Step 3.2: Verify the warning is gone**

```bash
npm run dev
```

Confirm the startup output no longer contains:
```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

- [ ] **Step 3.3: Commit**

```bash
git add src/proxy.ts src/middleware.ts
git commit -m "fix(bridge): rename middleware.ts to proxy.ts per Next.js 16 convention"
```

---

## Task 4: Audit Teachers Route for Secondary Slowness

**Files:**
- Read: `src/app/api/teachers-list/route.ts`
- Read: `src/lib/sanity/client.ts` (or wherever `sanityFetch` is defined)

The `/teachers` page takes 2.2s–7.1s of application code. The `teachers-list` API shows 460ms application time. Under normal memory conditions (no GC pressure), this is likely just Sanity CDN latency. Under heap pressure, GC pauses inflate it to 7s+.

This task confirms whether there's a secondary bug or just latency.

- [ ] **Step 4.1: Check sanityFetch for missing cache config**

Read `src/lib/sanity/client.ts`. Look for:
- Whether `sanityFetch` uses the Sanity CDN (`useCdn: true`) or goes to the API directly
- Whether there's a `next: { revalidate }` or `cache` option being passed
- Whether the `tags: ['teachers']` cache tag is configured

- [ ] **Step 4.2: Check if teachers-list is cached**

```bash
curl -w "\ntime_total: %{time_total}s\n" http://localhost:3000/api/teachers-list
# repeat 3 times — a cached response should be fast on subsequent calls
```

**Expected (cached):** First call slow (Sanity round trip), subsequent calls <50ms.
**Not cached:** All calls ~460ms — means `sanityFetch` doesn't cache, every page render hits Sanity.

- [ ] **Step 4.3: Record findings**

If all calls are slow (no caching): the `sanityFetch` wrapper likely needs a `cache: 'force-cache'` or `next: { revalidate: 60 }` option. This would be a separate task/plan.

If first call slow, subsequent fast: no bug — just Sanity CDN cold start. Slowness on `/teachers` page is from GC pressure (fixed by Task 2).

No commit needed for this task — it's diagnostic only.

---

## Task 5: Confirm Hydration Warning Is Non-Actionable

**Files:** None — read-only investigation.

The hydration diff shows:
```
- cz-shortcut-listen="true"
```
This attribute is added to `<body>` by a browser extension (likely a keyboard shortcut manager). The server renders `<body>` without it; the extension injects it client-side before React hydrates.

- [ ] **Step 5.1: Reproduce without extension**

Open the app in an incognito/private window (extensions disabled) or a different browser profile.

**Expected:** Hydration warning disappears. Confirms it's the extension, not our code.

- [ ] **Step 5.2: Confirm `suppressHydrationWarning` is on `<html>`**

Read `src/app/layout.tsx`. Confirm `<html lang="en" suppressHydrationWarning>` is present. This suppresses the expected class-name mismatch from next-themes. It does NOT suppress mismatches on `<body>` — but that's fine since `<body>` mismatch is from the extension, not us.

No fix needed. No commit. Document in this plan as known/wontfix.

---

## Investigation Checklist

- [ ] Task 1: Confirm SSE leak via active stream counter
- [ ] Task 2: Fix SSE cleanup with AbortController
- [ ] Task 3: Rename middleware → proxy
- [ ] Task 4: Audit teachers route caching
- [ ] Task 5: Confirm hydration warning is browser extension

---

## Expected Outcome

After Tasks 2 and 3:
- Dev server memory stays stable across hot reloads
- No more `FATAL ERROR: … heap out of memory`
- No more `middleware deprecated` warning
- Hydration warning may persist (extension-controlled) — acceptable
