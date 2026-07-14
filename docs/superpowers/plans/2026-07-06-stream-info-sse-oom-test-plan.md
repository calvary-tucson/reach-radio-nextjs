# Stream-Info SSE OOM — Live Reproduction Test Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to run this plan task-by-task (NOT subagent-driven-development — see "Execution note" below). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirm which of the three remaining suspects actually causes `/api/stream-info-sse` connections (or Turbopack itself) to accumulate memory unboundedly during a real `dev:tunnel` session, by running instrumented live-reproduction tests against the *real* tunnel process rather than a throwaway local one.

**Architecture:** Temporarily instrument `route.ts` with a connection counter (already drafted and validated in `docs/bugs/stream-info-sse-oom.md`), then run three isolated scenarios against the actual `dev.calvarytucson.com` tunnel (port 3000) in sequence, each targeting one suspect. Sample RSS + counter state over time for each. Analyze, update the bug doc with a confirmed root cause, then decide the fix.

**Tech Stack:** Next.js 16 (Turbopack) dev server, `cloudflared` named tunnel, `curl -N` for scripted SSE clients, `claude-in-chrome` (Playwright-backed) for real-browser churn.

## Global Constraints

- Do not touch or kill any dev server / tunnel process you didn't start yourself without confirming with whoever owns it first (this repo's `dev:tunnel` is shared across sessions — confirmed twice already this session).
- All route.ts instrumentation in this plan is **temporary and diagnostic** — revert with `git checkout -- src/app/api/stream-info-sse/route.ts` before any real commit.
- `~/.cloudflared/config.yml` is a fixed named tunnel: `dev.calvarytucson.com → http://localhost:3000`, catch-all `http_status:404`. There is only one routable hostname — you cannot run a second parallel instrumented tunnel next to a live one. This plan's tests require **exclusive use of port 3000** for their duration.

## Background (read before starting)

- `docs/superpowers/plans/2026-06-16-oom-investigation.md` — prior investigation. Diagnosed "cancel() not called on hot reload" + "in-flight fetch outlives cancel()", fixed both with an `AbortController` + `cancelled` guard. **That fix is already live in `route.ts` today.** The crash recurred anyway on 2026-07-06, so that fix is confirmed insufficient on its own — this plan is about what's left.
- `docs/bugs/stream-info-sse-oom.md` — this investigation's running log (sessions 1–3). Session 3 already proved: a direct (non-tunneled) client disconnect, even a hard `SIGKILL`, is cleaned up correctly — `activeConnections` counter went 5→0 within ~1s every time. **App code's disconnect handling is cleared for the simple case.** What's untested is the tunnel hop itself (Cloudflare edge → cloudflared → origin) and Turbopack-only memory growth independent of the SSE route.
- Three suspects remain, ranked by plausibility given what's already ruled out:
  1. **Tunnel-hop disconnect propagation** — a proxied client disconnect (browser tab close via `dev.calvarytucson.com`) might not translate into the origin's `ReadableStream.cancel()` firing, unlike the direct case already confirmed working.
  2. **Turbopack dev-mode memory growth independent of app code** — file-watcher/HMR state retained across rebuilds, present even with zero SSE traffic.
  3. **Browser/native lifecycle gaps** — bfcache navigation, tab freezing, or (for native WebView wrappers) app backgrounding may never fire a `visibilitychange`/close signal at all, leaving a legitimately-open-but-abandoned connection that isn't a "bug" in the cleanup code, just an unbounded number of genuinely-still-open connections.

---

## Task 1: Instrument the real route and get exclusive access to port 3000

**Files:**
- Modify: `src/app/api/stream-info-sse/route.ts`
- Create (scratchpad, not committed): `/private/tmp/claude-501/-Users-danielmccauley-Documents-Development-reach-radio-nextjs/1ba2f9f0-c847-4a23-a647-759388bb7c8c/scratchpad/rss-sample.sh`

- [ ] **Step 1.1: Confirm nobody else needs port 3000 right now**

```bash
ps aux | grep -E "next dev|cloudflared" | grep -v grep
lsof -iTCP:3000 -sTCP:LISTEN -P
```

If a `next dev`/`cloudflared` pair is already running and it isn't yours, **stop and ask the user** before killing it — this repo's dev server has been found in active use by another session twice already today. Do not proceed to Step 1.2 without either an empty result or explicit confirmation it's safe to stop.

- [ ] **Step 1.2: Add the connection counter to `route.ts`**

Apply this exact diff (already validated working in session 3, with one addition — see note below).

**Note on the heartbeat interval:** a plain module-scope `setInterval` does not survive Turbopack HMR cleanly — if `route.ts` gets hot-reloaded during the test (including by an incidental edit to any file that causes a rebuild), the old module instance's interval keeps firing *and* the new instance registers a second one, so the heartbeat log doubles in frequency. Guard it on `globalThis` so it's only ever registered once, and treat **heartbeat frequency increasing without you having restarted the server** as a bonus, cheap confirmation of suspect #2 (Turbopack retaining old module instances across reloads) independent of the SSE route itself.

```typescript
// after: const limiter = createRateLimiter({ windowMs: 60_000, max: 10 })
// after: const MAX_POLL_BACKOFF_MS / MAX_CONNECTION_MS consts

// TEMP DEBUG INSTRUMENTATION — remove before commit (docs/bugs/stream-info-sse-oom.md)
declare global {
  // eslint-disable-next-line no-var
  var __sseDebugActive: number | undefined
  // eslint-disable-next-line no-var
  var __sseDebugHeartbeatStarted: boolean | undefined
}
globalThis.__sseDebugActive ??= 0
if (!globalThis.__sseDebugHeartbeatStarted) {
  globalThis.__sseDebugHeartbeatStarted = true
  setInterval(() => console.log(`[sse-debug] heartbeat active=${globalThis.__sseDebugActive}`), 10_000)
}
```

Replace every bare `activeConnections` reference below with `globalThis.__sseDebugActive` (increment/decrement it directly — no local `let activeConnections` needed).

**Constraint for Tasks 2–4: make no further edits to any file in this repo while the sampler is running.** Any edit triggers an HMR rebuild, which is itself a confound for suspect #2's baseline — see the note above.

Inside `GET`, after `let consecutiveFailures = 0`:

```typescript
  let counted = false // TEMP DEBUG guard against double-decrementing activeConnections
```

Inside the `connectionTimeout` callback, right before the closing `}, MAX_CONNECTION_MS)`:

```typescript
        if (counted) {
          counted = false
          globalThis.__sseDebugActive!--
          console.log(`[sse-debug] -1 connection (30min force-close), active=${globalThis.__sseDebugActive}`)
        }
```

Right before `await poll()` at the end of `start()`:

```typescript
      globalThis.__sseDebugActive!++
      counted = true
      console.log(`[sse-debug] +1 connection, active=${globalThis.__sseDebugActive}`)
```

Inside `cancel()`, after `abortController.abort()`:

```typescript
      if (counted) {
        counted = false
        globalThis.__sseDebugActive!--
        console.log(`[sse-debug] -1 connection (client cancel), active=${globalThis.__sseDebugActive}`)
      }
```

- [ ] **Step 1.3: Write the RSS sampler**

```bash
cat > /private/tmp/claude-501/-Users-danielmccauley-Documents-Development-reach-radio-nextjs/1ba2f9f0-c847-4a23-a647-759388bb7c8c/scratchpad/rss-sample.sh <<'EOF'
#!/bin/bash
# Usage: rss-sample.sh <next-server-pid> <output-csv>
PID=$1
OUT=$2
echo "epoch_s,rss_kb" > "$OUT"
while kill -0 "$PID" 2>/dev/null; do
  RSS=$(ps -o rss= -p "$PID" | tr -d ' ')
  echo "$(date +%s),$RSS" >> "$OUT"
  sleep 30
done
EOF
chmod +x /private/tmp/claude-501/-Users-danielmccauley-Documents-Development-reach-radio-nextjs/1ba2f9f0-c847-4a23-a647-759388bb7c8c/scratchpad/rss-sample.sh
```

- [ ] **Step 1.4: Start the real dev:tunnel and the RSS sampler**

```bash
npm run dev:tunnel > /tmp/reach-radio-dev-tunnel.log 2>&1 &
disown
sleep 5
NEXT_SERVER_PID=$(pgrep -f "next-server")
echo "next-server pid: $NEXT_SERVER_PID"
/private/tmp/claude-501/-Users-danielmccauley-Documents-Development-reach-radio-nextjs/1ba2f9f0-c847-4a23-a647-759388bb7c8c/scratchpad/rss-sample.sh "$NEXT_SERVER_PID" /private/tmp/claude-501/-Users-danielmccauley-Documents-Development-reach-radio-nextjs/1ba2f9f0-c847-4a23-a647-759388bb7c8c/scratchpad/rss-baseline.csv &
disown
```

**Expected:** `next-server pid` prints a real PID; `curl -s -o /dev/null -w "%{http_code}\n" https://dev.calvarytucson.com/` returns `200` within ~10s.

---

## Task 2: Baseline — Turbopack alone, zero SSE traffic (tests suspect #2)

**Files:** None — observation only.

- [ ] **Step 2.1: Let it idle for 45 minutes with no requests at all**

Do not open any browser tab or hit any route, including `/` — and per the Step 1.2 constraint, make no file edits either (that would itself trigger an HMR rebuild and confound this baseline). Match the original crash's ~50-minute runway so a flat result is actually conclusive rather than just "no growth yet."

```bash
sleep 2700
```

- [ ] **Step 2.2: Inspect the RSS trend**

```bash
cat /private/tmp/claude-501/-Users-danielmccauley-Documents-Development-reach-radio-nextjs/1ba2f9f0-c847-4a23-a647-759388bb7c8c/scratchpad/rss-baseline.csv
tail -n 20 /tmp/reach-radio-dev-tunnel.log  # check heartbeat cadence stayed at one log line per 10s — see Step 1.2 note
```

**Confirms suspect #2** if RSS climbs steadily (>~20% growth) over the 45 min with zero requests served — Turbopack/HMR/file-watcher state is leaking independent of any app code, and no fix in `route.ts` will help. Heartbeat frequency doubling (without a restart) is bonus confirmation on its own.

**Reduces but does not fully clear suspect #2** if RSS is flat — 45 min at zero traffic makes a pure-Turbopack leak much less likely, but doesn't rule out a leak whose rate depends on request volume (which would then implicate the interaction between Turbopack and the SSE route, not either alone). Move on to Task 3 with #2 deprioritized, not eliminated.

---

## Task 3: Tunnel-hop disconnect propagation (tests suspect #1, the leg session 3 couldn't reach)

**Files:** None — observation only, via `curl` through the real hostname.

- [ ] **Step 3.1: Open 5 concurrent SSE connections through the real tunnel**

```bash
for i in 1 2 3 4 5; do
  curl -s -N https://dev.calvarytucson.com/api/stream-info-sse > /tmp/sse-real-tunnel-$i.txt &
  echo "started $i pid $!"
done
sleep 5
tail -n 20 /tmp/reach-radio-dev-tunnel.log
```

**Expected:** 5 lines of `[sse-debug] +1 connection`, ending `active=5`.

- [ ] **Step 3.2: Kill all 5 client-side, abruptly, through the tunnel**

```bash
pkill -9 -f "curl -s -N https://dev.calvarytucson.com/api/stream-info-sse"
sleep 5
tail -n 20 /tmp/reach-radio-dev-tunnel.log
```

**Confirms suspect #1** if `active` does NOT return to 0 within ~10s (some connections stay counted despite the client being dead) — the tunnel hop is masking the disconnect from the origin, unlike the direct case.

**Refutes suspect #1** if `active` returns to 0 promptly, same as the direct test in session 3 — the tunnel propagates disconnects fine too, and this mechanism is cleared.

- [ ] **Step 3.3: Repeat Step 3.1–3.2 three more times back to back (no delay between rounds)**

Run the same open-then-kill cycle 3 more times in immediate succession. This checks for a *slower* leak — e.g., disconnects that eventually get cleaned up but only after some delay, which would look fine on one round but accumulate under repeated rapid churn.

```bash
grep -c "+1 connection" /tmp/reach-radio-dev-tunnel.log
grep -c "connection (client cancel)\|connection (30min" /tmp/reach-radio-dev-tunnel.log
```

**Confirms accumulation-under-churn** if the two counts diverge (more `+1`s than `-1`s across all 4 rounds combined) — i.e., `active` net-increases round over round even though each individual round eventually looked clean.

---

## Task 4: Real browser churn — graceful close vs. process-killed (tests suspect #1's Playwright-session theory + suspect #3)

**Files:** None — observation only.

`tabs_close_mcp` on a single `claude-in-chrome` tab fires `pagehide`/`visibilitychange` and normally runs the `useNowPlaying` cleanup — that is the *graceful* path, already close to what session 3 confirmed works. The original crash session's suspect wasn't a graceful tab close; it was the **browser process terminating mid-test** between automated screenshot steps (matching this repo's own screenshot artifacts from that session), which skips JS cleanup entirely. Test both, so a clean result on the graceful path doesn't get mistaken for clearing suspect #1.

- [ ] **Step 4.1: Load the browser tools**

Call `ToolSearch` with `query: "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp,mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_close"`.

- [ ] **Step 4.2 (graceful control): open and close 10 tabs via claude-in-chrome**

For `i` in 1..10: create a new tab navigated to `https://dev.calvarytucson.com/`, wait ~3s for the SSE connection to establish, then close it via `tabs_close_mcp`.

```bash
sleep 10
tail -n 30 /tmp/reach-radio-dev-tunnel.log
```

**Expected (graceful path):** `active` returns to 0 — this is the path session 3 already validated works even in the tunnel-adjacent case, so a clean result here is a sanity check, not new evidence.

- [ ] **Step 4.3 (process-killed): use the separate Playwright-controlled browser, then kill the whole browser process**

`plugin:playwright:playwright` drives its own independent browser instance (not the user's persistent Chrome that `claude-in-chrome` automates), so it's safe to terminate abruptly without affecting the user's browser.

1. `mcp__plugin_playwright_playwright__browser_navigate` to `https://dev.calvarytucson.com/` — let the SSE connection establish (~3s).
2. Find that browser's underlying process and send it `SIGKILL` directly (not `browser_close`, which performs an orderly shutdown handshake — the goal is to skip cleanup entirely, matching "process died mid-test"):

```bash
ps aux | grep -i "playwright\|chromium\|chrome" | grep -v grep
# identify the specific browser process spawned for this session, then:
kill -9 <that_pid>
```

3. Repeat for 5 separate navigate-then-kill cycles (open a fresh Playwright browser context each time, since the process is now dead).

- [ ] **Step 4.4: Check the counter after all 5 process-kills**

```bash
sleep 15
tail -n 30 /tmp/reach-radio-dev-tunnel.log
```

**Confirms suspect #1 (process-death variant)** if `active` does not return to 0 (or returns to 0 only after the unrelated 30-min `MAX_CONNECTION_MS` force-close, not via `cancel()`) — an abruptly-killed browser process doesn't reliably close the underlying TCP connection the way a graceful tab close or even a `SIGKILL`'d `curl` does (Task 3 already confirmed `curl` SIGKILL cleans up fine locally — if a real browser process kill behaves differently, that's the actual mechanism, likely because the browser holds a connection-reuse pool across tabs/requests that doesn't tear down each individual stream on process death the same way a single-purpose `curl` process does).

**Refutes suspect #1 (process-death variant)** if `active` returns to 0 promptly here too — narrows the remaining explanation toward suspect #3 (a connection that's still genuinely open because nothing ever signaled a close at all — e.g. a frozen/suspended tab or native WebView background state, not a cleanup bug) as the more likely explanation for the original crash, since app-level cleanup keeps checking out clean across every actively-tested failure mode.

---

## Task 5: Analyze and update the bug doc

**Files:**
- Modify: `docs/bugs/stream-info-sse-oom.md`

- [ ] **Step 5.1: Stop the dev:tunnel and RSS sampler you started in Task 1**

```bash
pkill -f "rss-sample.sh"
# stop dev:tunnel only if you started it fresh for this test and nobody else has since attached to it — confirm first
```

- [ ] **Step 5.2: Revert the instrumentation**

```bash
git diff --stat src/app/api/stream-info-sse/route.ts
git checkout -- src/app/api/stream-info-sse/route.ts
```

- [ ] **Step 5.3: Write up findings in `docs/bugs/stream-info-sse-oom.md`**

Add a "Session 4 — confirmed root cause" section stating which of the 3 suspects (Task 2 result, Task 3 result, Task 4 result) actually reproduced, with the exact log/CSV evidence. If more than one reproduced, rank by which showed the fastest/largest growth.

No commit for this task if the outcome is still "confirmed cause, no fix yet" — commit only once a fix is chosen and implemented (separate follow-up plan).

---

## Execution note

Do **not** use `superpowers:subagent-driven-development` for this plan. Every task after Task 1 depends on the same single live `dev:tunnel` process and must run in strict sequence with real wall-clock waits (20 min idle, multi-round churn) — there's no independent parallelizable unit here, and a fresh subagent per task would lose the live PID/log-tail context between tasks. Run inline via `superpowers:executing-plans`, or just work through it directly in this session.

Total wall-clock for this plan is dominated by Task 2's 45-minute idle window plus setup/teardown — budget roughly 1.5–2 hours end to end, not something to run between other work.

## Investigation Checklist

- [ ] Task 1: Instrument route.ts, confirm exclusive access to :3000, start sampler
- [ ] Task 2: Idle-Turbopack baseline (suspect #2)
- [ ] Task 3: Tunnel-hop disconnect propagation, single + repeated churn (suspect #1)
- [ ] Task 4: Real browser hard-close churn via claude-in-chrome (suspect #1 variant / #3)
- [ ] Task 5: Revert instrumentation, write up confirmed root cause in bug doc
