# `next dev` OOM crash — suspect: `/api/stream-info-sse`

**Status:** suspect #2 (Turbopack dev-mode memory growth, independent of app code) confirmed 2026-07-06 session 4. Suspects #1 and #3 still untested this session. Fix not yet attempted.

## Symptom

`npm run dev:tunnel` (`next dev` + `cloudflared tunnel run dev`, hostname `dev.calvarytucson.com`) died with:

```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
next dev exited with code 0
```

Heap was ~7.6GB at crash (`node --max-old-space-size` default ~8GB on this machine). Process ran ~50 min before crashing. `cloudflared` stayed up (it's a separate process under `concurrently`), so requests hit the tunnel fine but got **502 Bad Gateway** since nothing was listening on :3000 anymore.

## Evidence

From `/tmp/reach-radio-dev-tunnel.log`, request durations for the SSE endpoint climbed across the session:

```
GET /api/stream-info-sse 200 in 61s
GET /api/stream-info-sse 200 in 92s
GET /api/stream-info-sse 200 in 62s
GET /api/stream-info-sse 200 in 33.8s
GET /api/stream-info-sse 200 in 6.8min   <- last logged request before OOM
```

These durations are individually within design bounds (route has a hard 30-min `MAX_CONNECTION_MS` cutoff), so no single request is "hung" — but the correlation with the crash makes this endpoint the prime suspect.

## Code reviewed (looks correct on inspection, not yet disproven)

- `src/app/api/stream-info-sse/route.ts` — SSE producer. Polls `RADIOJAR_URL` every 30s, resolves artist via `resolveArtist()`, sends keepalive every 15s, hard-closes at 30 min. `cancel()` clears `pollTimer`/`connectionTimeout`/`keepaliveInterval` and aborts the fetch — looks like proper cleanup on client disconnect.
- `src/lib/teacherCache.ts` — `resolveArtist()`'s backing cache (`cachedTeachers`) is a small bounded array with a 1h TTL, dedup'd concurrent fetch via `pendingFetch`. Not a growth vector.
- `src/hooks/useNowPlaying.ts` — client `EventSource` consumer. Closes `es` on unmount, on `visibilitychange` (tab hidden), and in `onerror` before scheduling reconnect. Cleanup path also looks correct.

None of the three files show an obvious unbounded-growth bug on a read-through. The leak (if it's app code and not the dev server itself) is likely **connection accumulation** rather than per-connection growth — i.e. more SSE connections open concurrently over time than expected, each holding a `setInterval` + `setTimeout` chain + closures alive.

## Suspects to check next session

1. **Multiple concurrent Playwright/browser sessions during this session's testing** (screenshot/smoke scripts) may have opened `EventSource` connections that were never cleanly closed server-side if the browser process was killed rather than gracefully closed — TCP half-close detection by Node's `ReadableStream.cancel()` can be delayed. Check for a pile-up of concurrent `/api/stream-info-sse` connections (e.g. add a request-scoped counter/log of active connections) rather than assuming one-connection-at-a-time.
2. **Next.js 16 Turbopack dev-mode memory leak** — a known class of issue independent of app code (file-watcher/HMR state retained across rebuilds). Worth testing: run `next dev` (no tunnel, no app traffic) idle for an hour and watch RSS.
3. **React StrictMode double-invoke** in dev — `useNowPlaying`'s effect looks correctly scoped per-invocation (closure-local `es`/`retryTimer`/`destroyed`), so double-mount should self-clean, but worth confirming with a connection counter that it doesn't leave an orphan.

## Suggested repro/instrumentation

- Add a module-level counter in `route.ts` (increment in `start()`, decrement in `cancel()`) and log it periodically — confirms whether concurrent connection count grows unbounded over a long session.
- Run dev server with `node --inspect` or `--max-old-space-size=512` to force an earlier, faster-to-diagnose crash, then pull a heap snapshot.
- Leave a single tab open on `/` for 1+ hour with no manual navigation and watch `next dev` RSS via `ps` — isolates "one legit connection over time" from "connection accumulation from repeated navigation/testing."

## Session 2 findings (2026-07-06, continued)

- **Heap-limit discrepancy resolved.** Checking from a sandboxed shell (cmux harness) shows `NODE_OPTIONS` force-injects `--max-old-space-size=4096` there — unrelated to the user's real terminal, which runs `dev:tunnel` with no such cap. `v8.getHeapStatistics().heap_size_limit` in the sandbox reads 4144MB, which is why it doesn't match the doc's "~7.6GB at crash" note. The original ~8GB-default assumption stands for the actual crash environment (16GB system RAM, no `NODE_OPTIONS` override there). Not a contradiction — just don't reuse the sandbox's number when reasoning about the real crash.
- **Live server was already running (started same day, ~5.5 min uptime) but owned by another active session** — logs (`/tmp/reach-radio-dev-tunnel.log`) showed live `[modal-debug]` render traffic and `GET /teachers/api/stream-info-sse` hits seconds before it was SIGTERM'd (clean shutdown, `next dev exited with code 0` — not another OOM). Matches in-progress modal work (uncommitted `SheetChrome.tsx`, `PassiveSearchBar.tsx`, `layout.tsx`). Did not restart it or otherwise interfere — need to coordinate with whoever owns that session to get a live instrumented run.
- **One genuine `CLOSE_WAIT` socket observed on :3000** while probing (not from my own curls — those all failed to connect). CLOSE_WAIT means the remote already sent FIN but Node hadn't finalized its side — mechanically consistent with suspect #1 (client disconnects that `ReadableStream.cancel()` doesn't promptly observe, leaving the poll/keepalive timer chain alive). But a single transient CLOSE_WAIT in a few-minute-old process is normal and not proof of accumulation by itself — this needs the counter below, watched over a real multi-hour session, to actually confirm unbounded growth.
- Two direct `curl` requests to `/` (2s then 10s timeout) both failed to connect while the server was up. Inconclusive on its own — could be a cold Turbopack compile of a heavy root layout rather than an event-loop stall — but worth keeping an eye on if the counter run also shows request latency creeping up alongside connection count.

## Session 3 findings (2026-07-06, replication attempt)

Applied the counter instrumentation (below) to a throwaway `next dev -p 3010` instance (no tunnel — the real `dev:tunnel` on :3000 was owned by another active session, left untouched) and drove traffic directly:

- **Direct disconnect handling is confirmed correct, even under a hard kill.** Opened 5 concurrent `curl -N` SSE connections, `SIGKILL`'d all 5 mid-stream. Server log showed `activeConnections` climb 1→5 then promptly drop 5→0 as each `cancel()` fired (within ~1s of the kill). **This rules out "route.ts fails to detect disconnects" as the root cause in the simple case** — `ReadableStream.cancel()` is reliably invoked when the underlying TCP socket closes, even abruptly.
- **Could not test the actual proxy leg.** Tried to interpose a second, throwaway `cloudflared tunnel --url` (quick tunnel) in front of the :3010 instance to test whether the Cloudflare-edge → cloudflared → origin hop can decouple a client-side disconnect from the origin connection (the mechanism suspect #1 actually depends on — SIGKILL-ing a local curl isn't equivalent to that, since the OS still tears down the socket immediately either way). Blocked: `~/.cloudflared/config.yml` is a **named tunnel** with a fixed ingress rule (`dev.calvarytucson.com → http://localhost:3000` only, catch-all `http_status:404`), so any tunnel process on this machine — quick or named — resolves through that same config and only routes to :3000, which belongs to the other live session. Repointing it or taking :3000 to test this properly would disrupt their session, so this leg is still unverified.
- **Practical implication:** the leak, if real, is very likely specific to the tunnel/proxy hop (suspect #1's actual proxy mechanism, not the app-code mechanism — now ruled out) or to Turbopack dev-mode state (suspect #2), rather than anything fixable in `route.ts`/`teacherCache.ts`/`useNowPlaying.ts`. Those three files are now reasonably cleared by direct testing, not just read-through.

**To finish confirming suspect #1:** needs a run where the counter instrumentation is active on the *actual* `dev:tunnel` process (port 3000, the real named tunnel), watched over a normal multi-hour session including real browser tab churn (open/close many tabs, background/foreground, native WebView if testing bridge). Requires coordinating with whoever is running that session next — can't safely do it standalone without a second port/tunnel.

## Ready-to-apply instrumentation (not yet applied)

Drop into `src/app/api/stream-info-sse/route.ts` to confirm/refute suspect #1 (connection accumulation) over a normal dev session. Purely additive — no behavior change.

```ts
// module scope, alongside `limiter`
let activeConnections = 0

// inside start(), right after the function declarations, before `await poll()`:
activeConnections++
console.log(`[sse] +1 connection, active=${activeConnections}`)

// inside cancel(), as the first line:
activeConnections--
console.log(`[sse] -1 connection, active=${activeConnections}`)

// also inside the connectionTimeout callback, since it force-closes without going through cancel():
// (connectionTimeout already calls controller.close(), which should trigger cancel() via the stream's
//  own machinery — but log there too until confirmed, in case Next's Response body doesn't call cancel()
//  on a controller-initiated close)
```

Run `npm run dev:tunnel` with this in place for a normal working session (several hours, mixing manual navigation, Playwright/browser-driven testing, and idle time). If `active` climbs and never comes back down to the real number of open tabs, suspect #1 is confirmed — the fix is then to add a manual disconnect-detection fallback (e.g., poll `request.signal.aborted` or track socket close at the Node HTTP layer) rather than relying solely on `ReadableStream.cancel()`.

## Session 4 findings (2026-07-06, confirmed root cause: suspect #2)

Followed `docs/superpowers/plans/2026-07-06-stream-info-sse-oom-test-plan.md` Task 1 + Task 2. Prior session's `dev:tunnel` process had died between sessions; reused the *other* live dedicated dev-server session's `next dev` (owner confirmed OK, agreed to leave it idle/unedited for the test window) and pointed a standalone `cloudflared tunnel run dev` at its existing `:3000` rather than starting a second `next dev` — `dev:tunnel`'s script runs both together and would have double-bound the port.

Applied the connection-counter instrumentation (same as the "ready-to-apply" block above, plus a `globalThis`-guarded heartbeat log — see plan Step 1.2 for the exact diff) and left it running, but **the `/api/stream-info-sse` route was never hit** during this test — that's deliberate, since Task 2 isolates Turbopack/HMR growth from the app route entirely.

**Result — suspect #2 confirmed:**

| t (min) | RSS |
|---|---|
| 0 | 1.03 GB (baseline) |
| 22 | ~1.7–1.85 GB (noisy, net climbing) |
| 27 | 2.70 GB |
| 28 | 2.71 GB (peak, just before process died — see below) |

**163% growth in 28 minutes, zero SSE traffic, zero file edits, zero HMR triggers.** Plan's own threshold for confirming suspect #2 was >20% growth over the 45-min window; this blew past it in ~27 minutes, well before the window closed, so the wait was cut short rather than run to completion — a positive result doesn't need the full runway (only a flat/negative one does, to make "no growth yet" conclusive). This is a pure Turbopack/HMR dev-mode leak — no app code (`route.ts`, `teacherCache.ts`, `useNowPlaying.ts`) was ever invoked.

**Unresolved, suggestive-but-not-confirmed side observation:** right around the 28-minute mark (RSS 2.70→2.71GB), the *entire* process tree for that dev session — `next-server`, its parent `next dev`, and npm's own wrapper (PIDs 3461/3455/3365/3359) — disappeared and was replaced by a freshly-started `next dev`/`next-server` pair with new PIDs. No macOS jetsam/OOM log entry or `~/Library/Logs/DiagnosticReports` crash report was found for that timestamp (last node crash report on file predates this by ~2 hours), so this can't be attributed to an OS-level OOM kill with confidence — it may simply be the other session's owner restarting for unrelated reasons. But the timing (RSS growth curve terminating in a full process replacement) is consistent with the original crash's shape and is worth treating as a second, weaker data point alongside the confirmed RSS trend, not as independent proof.

**Not done this session:** Tasks 3 (tunnel-hop disconnect propagation, suspect #1) and 4 (real browser hard-close churn, suspect #1 variant / #3) from the plan were skipped once #2 was confirmed early — they test different mechanisms that could co-occur with #2, so they're still open, not ruled out. Instrumentation reverted (`git checkout -- src/app/api/stream-info-sse/route.ts`), no commit made.

## Not yet done

- No heap snapshot taken.
- No confirmation of concurrent connection count at time of crash (instrumentation above is unapplied to the actual crash path — only run against zero-traffic idle in session 4).
- Fix not attempted — this is diagnosis only. Suspect #2 (Turbopack dev-mode leak) is now the confirmed primary cause; a fix here is likely upstream (Next.js/Turbopack version bump, or restructuring dev workflow to restart periodically) rather than anything in this repo's app code.
- Suspects #1 (tunnel-hop disconnect propagation) and #3 (browser/native lifecycle gaps) still untested — Tasks 3–4 of the session-4 plan cover these next, if still worth pursuing given #2 is already confirmed as at least one real cause.
