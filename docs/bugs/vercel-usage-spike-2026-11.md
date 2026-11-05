# Vercel usage spike (Nov 2026): now-playing SSE billed as held-open function time

Status: fix committed on branch `calvary-tucson/investigate-vercel-usage-spike`, **not pushed or deployed** at the time of writing. See "Open items".

Evidence labels used below: **Verified** = read in code, a CLI output, or a live request. **Inferred** = reasoned from billing totals and code, not measured per route.

## 1. Trigger

- Vercel emailed that $15 of the $20 monthly credit was used (Pro plan, resets Nov 24). That was not normal.
- Reach Radio had recently moved from Cloudflare (Astro, `reach-radio-web`) to Vercel (Next.js, this repo).

## 2. Investigation (Vercel CLI, read-only)

Tools: `vercel logs`, `vercel usage`, project and function inspection. Quirks hit along the way:

- `vercel logs` caps at about 50 lines.
- `vercel metrics` needs Observability Plus, so per-route cost could not be measured.
- `vercel usage -F json` produced empty files; the table output works.
- zsh does not word-split variables: use literal flags or arrays.
- `vercel` needs `--scope` before its value.

Findings:

| Item | Evidence |
|---|---|
| Fluid Provisioned Memory was the dominant line: **$9.54 of $15.7** (Oct 24 to Nov 5) | Verified (`vercel usage`) |
| Fluid compute bills provisioned memory ($0.0106/GB-hr in iad1) from the first byte until the last in-flight request finishes | Verified (Vercel docs) |
| Active CPU is billed separately ($0.128/CPU-hr); invocations $0.60/M on demand | Verified (Vercel docs) |
| `src/app/api/stream-info-sse/route.ts` holds each request open for 10 to 12 minutes (`maxDuration = 780`, 30s RadioJar poll, 15s keepalive, jittered forced close) | Verified (code) |
| Therefore each open Reach Radio tab keeps a function instance billed for the whole connection | Inferred: this is the cost driver, strong match to the totals, not measured per route |
| Audio stream is **not** the cause: `/api/audio-stream` redirects to `reach-radio-web.pages.dev/api/audio-stream`, served by Cloudflare | Verified (`next.config.ts`) |
| Pro includes 1M CDN requests per month (an early claim of 10M was wrong and corrected). The docs do not say whether cache hits count | Verified (docs) |

## 3. Options considered

1. **Poll a CDN-cached endpoint** (`72dc52f`): replace SSE with short polling of `/api/stream-info`. Implemented, then reverted (`13710d8`) when the Cloudflare option turned out feasible. Polling still bills invocations and a CDN request per poll, and the docs were unclear on cache-hit accounting.
2. **Serve the SSE from Cloudflare** (chosen): Cloudflare Workers/Pages Functions do not bill wall-clock duration for streaming responses. The legacy Astro app already exposes the endpoint and the audio redirect already crosses to the same host.
3. Standalone Worker `reach-radio-audio-stream-worker` (`stream.reach.radio`): planned in `docs/superpowers/plans/2026-10-09-stream-hosting-decision.md`, not built yet.

Chosen: option 2, with the standalone Worker as the later home. Decided by the owner: keep `pages.dev` for now; switching to a reach.radio subdomain later is a one-line change to `NOW_PLAYING_SSE_URL`.

## 4. What changed

Commit `a374daf` (`perf(api)`):

- `src/lib/constants.ts`: `NOW_PLAYING_SSE_URL = 'https://reach-radio-web.pages.dev/api/stream-info-sse'`.
- `src/hooks/useNowPlaying.ts`: `EventSource(NOW_PLAYING_SSE_URL)`. The Cloudflare endpoint emits **named** `time-update` events, and `onmessage` fires only for unnamed events, so a `time-update` listener was added. The unnamed path is kept.
- `next.config.ts`: CSP `connect-src` gained `https://reach-radio-web.pages.dev`.
- `tests/unit/use-now-playing.test.ts`: tests for the URL and the named-event path.

Kept in place on purpose: the Vercel route `src/app/api/stream-info-sse/route.ts` (still used by stale open tabs and any future iOS v4 build).

## 5. Verification

- 438 of 438 unit tests, tsc, eslint (run before and during the review).
- Live endpoint (curl): HTTP 200, `content-type: text/event-stream`, `access-control-allow-origin: *`, named `time-update` events with `{title, artist}`.
- Local dev server (`localhost:3100`, Orca browser): the request to `reach-radio-web.pages.dev/api/stream-info-sse` returned 200, no console or CSP errors, and the player title changed from "Thank You Jesus" to "O Love of God / LAURA STORY" between checks.
- After the review fixes (451 of 451 tests, tsc and eslint clean, re-run independently): live recheck in the Orca browser on `localhost:3100`. SSE request to pages.dev returned 200, no console errors, title matched the live feed. Dispatching `visibilitychange` while visible closed the old `EventSource` and opened one new one (constructed 2 to 3, closed 1 to 2), so the reconnect path works. The hidden path (close only) was not driven live (the `document.hidden` override could not be redefined); it is unchanged code and covered by unit tests. `orca network` did not list the teachers-list fetch, so the late-photo path was verified by unit test only, not live.
- Cloudflare stream lifetime, final result (2026-11-04, 20:54:50 to 21:19:50): one `curl -N` stream stayed open the full 1500 s cap (`time_total=1500.006`, HTTP 200), 75 `time-update` events 20 s apart, no cut or early close. Cloudflare does not cut or bill-by-duration this stream, so each tab costs about one request per visibility session. This settles the Workers Paid question for now: not needed at current traffic.
- Production check after deploy (`dpl_2SiuAW…`, created 21:07:30, reach.radio): CSP `connect-src` includes `reach-radio-web.pages.dev`; the page opened the pages.dev SSE and got events every 20 s; 0 requests to the Vercel SSE route from the new code; no console errors; player title matched the live feed. Vercel logs showed 2 hits on the old route in the first 5 minutes after deploy (2 min apart), probably stale tabs still on the old JavaScript. Orca's embedded browser fires a `visibilitychange` about every 20 s, which makes the hook reconnect each time; real browsers fire it only on a tab switch.
- Cross-domain is not a problem: CORS `*`, no credentials, no preflight, CSP allows the origin. A subdomain is only needed for decoupling, not for function.

## 6. Who uses which endpoint

| Client | Endpoint | Evidence |
|---|---|---|
| Next.js web (reach.radio) | Cloudflare `pages.dev` SSE (after this change) | Code |
| Android app (`main`, last commit 2026-09-04) | Loads the Astro site: `Config.kt:4` `WEB_DOMAIN = "reach-radio-web.pages.dev"`, so its own Astro `MediaBarContainer.astro` SSE client | Verified (code) |
| iOS v3 (live in the App Store, per owner; v4 is unreleased) | Astro site on Cloudflare | Owner statement, not code-verified |
| iOS v4 (unreleased) | Native `NowPlayingService.swift` calls the **Vercel** route, and the WebView loads `reach-radio-nextjs.vercel.app` / `reach.radio` | Verified (code) |
| Stale open tabs | Vercel route until reload | Inferred |

Earlier mistakes corrected in this work: native apps were first assumed to have no SSE client (iOS v4 does); the apps were first assumed to load this repo's site (Android loads the Astro site).

## 7. Full review findings (4 reviewers plus inline checks)

No critical findings. Warnings and suggestions, each handed to a fix child session:

1. **Teacher photo race.** The Cloudflare payload has no `imageUrl` or `resolvedArtist`, so the client match always runs and needs the teachers list. A first event arriving before `/api/teachers-list` left the fallback image and a null `resolvedArtist` (also sent to native) for up to 20s. Fix: re-resolve when the list loads.
2. **Unvalidated third-party payload.** Non-string `title` could crash a render, `imageUrl` was trusted, no length caps, and a null teacher `photo` threw and dropped the whole update. Fix: type checks, 200-char caps, `imageUrl` allowlist (`https://cdn.sanity.io/`), null guard.
3. **Stale docs and comments.** `docs/architecture.md`, `docs/native-webview-bridge.md`, `docs/sanity-schema-and-consumers.md`, the stream-hosting decision doc, `route.ts` and `constants.ts` comments.
4. **CSP test gap.** No test asserted the new `connect-src` origin.
5. Suggestions: reconnect floor and wider jitter (a clean close after one message reconnected every 1 to 1.5s forever because `retries` reset on every message), map the Cloudflare fallback title "Reach Radio FM" to the player default "Reach Radio", handler typing and comment, `preconnect` to pages.dev.

Review accuracy notes: the Cloudflare endpoint has **no connection time limit** in its source (my earlier "closes on a timeout" statement was wrong). It closes only on a RadioJar 404 or a 5-second RadioJar abort. Whether the Cloudflare platform cuts long streams is being measured (below).

Accessibility: no issues, no markup changed. Performance: no other long-lived Vercel use found in `src/`; no re-render churn.

## 8. Open items

- **Push and deploy:** the merge into `main` and `git push origin main` (deploys to production) need the owner's explicit approval. Options discussed: push everything once the post-fix live check passes, or push only through `a374daf` first. The `72dc52f` plus `13710d8` poll-then-revert pair adds noise; ask before dropping it.
- **Cloudflare stream lifetime: closed.** Held 25 min with no cut (section 5). Workers Paid ($5/month, 10M requests) is not needed unless traffic grows. The free plan is 100k requests/day account-wide, shared with the audio redirect target. Estimates from the perf review (assumptions, not measurements): if streams are never cut, about one request per tab per visibility session; if cut every 11 minutes, about 131 reconnects per always-visible tab per day (roughly 760 such tabs exhaust the cap); if cut every 30 seconds, about 35 tabs.
- **iOS v4:** before it ships, repoint `NowPlayingService.swift` to the Cloudflare endpoint, otherwise it keeps billing Vercel.
- **Retiring the Vercel SSE route:** only after stale tabs and iOS v4 are gone.
- **Retirement coupling:** `reach-radio-web.pages.dev` is the legacy Astro app. Android and iOS v3 depend on it too, so plan the move to the standalone Worker (`stream.reach.radio`) before that app is retired, and port the Next.js hardening (jitter, keepalive, abort on cancel, no overlapping polls) into the Worker rather than changing the live Astro endpoint.
- **Success metric:** check `vercel usage` for Fluid Provisioned Memory one to two days after the deploy; it should fall sharply.

## 8b. Worker cutover (2026-11-05)

- Stream Worker `reach-radio-audio-stream-worker` now serves `/api/stream-info-sse` (3 local commits `9114d27`, `f225ea4`, `2965db5`, not pushed to git). Deployed as version `02298be7`.
- Worker-host hold: 74 events over 1500 s, no cut.
- Web repointed in `c1aee86` (`NOW_PLAYING_SSE_URL`, CSP `connect-src`, preconnect, tests). Pushed to `main`.
- Prod check after push: CSP correct, one SSE connection to `stream.reach.radio`, no console errors, title matches feed, 0 hits on the Vercel route in 10 min.
- Orca's embedded browser fires `visibilitychange` about every 20 s, so it reconnects often; real browsers do not.
- Not live-tested: hide path, late teacher-photo path (unit tests only), native apps.

## 8c. Web audio on the Worker (2026-11-05)

- `46e0145`: the web player (`AudioProvider`) plays `https://stream.reach.radio/` directly via `WEB_AUDIO_STREAM_URL`. Web-only: `BridgeInit`, `/api/native-config` and Sanity `radioAudioURL` untouched, so the Phase F flip gate (iOS v4 released plus real-device tests) still stands.
- Local check (dev server, Orca): audio src correct, 30 s playback, no CSP errors. Prod check after deploy: 128 s playback, `readyState` 4, no error, no console CSP violations.
- Baseline for the success metric, Fluid Provisioned Memory per day from `vercel usage --breakdown daily`: Nov 1 $2.75, Nov 2 $0.91, Nov 3 $0.76, Nov 4 $0.78. SSE left Vercel on Nov 5; compare Nov 6 to Nov 12 against this. Owner is away Nov 6-13, so the cost check runs on Nov 13 (daily breakdown covers the whole week).
- Not tested: audio soak beyond minutes in a browser, lock screen, CarPlay, cellular.

## 8d. What else could move off Vercel (review 2026-11-05)

Survey of `src/app` routes plus an advisor review. Verdict: nothing else is worth moving; the one long-held request was the SSE route.

- Only `stream-info-sse` used `maxDuration`, `ReadableStream` or `setInterval`. Fluid compute is expensive only for long-held requests.
- Keep on Vercel: `native-config`, `teachers-list`, `teachers/search-data`, `theme` (short request/response, helped by ISR and CDN), `revalidate` (calls `revalidateTag`), `proxy.ts` (brief, needed for native detection), image optimization and the `/api/audio-stream` redirect (negligible, handled at the routing layer).
- Do not orange-cloud reach.radio through Cloudflare in front of Vercel: two CDNs stacked break Vercel caching and ISR.
- `vercel usage` Nov 1-5 month to date: Fluid Provisioned Memory $5.20, ISR Writes $0.46 (second largest), Fluid Active CPU $0.45. The $5.20 is almost all pre-fix. ISR Writes are a Vercel caching question (`cacheLife`, revalidate frequency), not a Cloudflare one.
- Decision (owner, 2026-11-05): wait for the Nov 13 cost check (owner returns) before disabling the old Vercel SSE route. When disabling, return 204 or set a tiny `maxDuration`; never redirect (old tabs' CSP `connect-src` lacks `stream.reach.radio`).
- Open: check `vercel logs` for callers of `/api/stream-info` before proposing anything; it is short-lived, not a cost driver.
- **Comparison soak (2026-11-05, 18:07-19:07 UTC, parallel):** Worker `stream.reach.radio/` held the full 3600 s (57,680,039 bytes, about 128 kbps, curl exit 28 = hit the `-m` cap, no cut). Legacy `pages.dev/api/audio-stream` closed cleanly at 1463 s (about 24 min, exit 0, 23.4 MB). So the Worker is not worse than the legacy path; the earlier 28 min close on the Worker was not reproduced and is unexplained (likely upstream Radiojar or one-off). Cuts still happen, so the `onEnded` reconnect fix (8e) stays worthwhile.
- First audio soak result (2026-11-05): `curl -sN -o /dev/null -m 3600 https://stream.reach.radio/` ended at 1685.9 s (about 28 min), well before the 3600 s cap, with 27,047,810 bytes (about 128 kbps, so audio flowed normally until the end) and HTTP 200. Conclusion: the stream was closed after about 28 min by something other than the curl cap. Not yet known whether the Worker, Cloudflare or the Radiojar upstream closed it, and no exit code was captured. CORRECTION (same day): `AudioProvider` reconnects only from `onError`. A clean server close ends the media element, which (per the HTML spec, inferred, not yet reproduced live) fires `pause` then `ended`; `onPause` sets `isPlaying` false and there is no `onEnded` handler, so the listener likely hears silence and the UI flips to Play until they press it. The earlier claim of a short gap was wrong. The legacy `pages.dev` path closed cleanly at about 24 min (exit 0), so this predates the Worker. Follow-up: repeat with `-w '%{exitcode}'` and compare against the legacy `pages.dev/api/audio-stream` path (what web played before `46e0145`) to see if the cut is new.

## 8e. Reconnect fix for clean stream close (2026-11-05)

- Problem: a clean server close fires `pause` then `ended`; `AudioProvider` only reconnected on `error`, so playback stopped and the button flipped to Play. Live repro (local dev, Orca): swapping the audio src to a 2 s WAV that ends cleanly left the button on "Play radio" for 15 s with no recovery.
- Fix: `onEnded` reconnects (reuses `scheduleReconnect` backoff) when the store still says playing; `onPause` ignores the pause the browser fires at end of media (`e.currentTarget.ended`). Tests in `tests/unit/audio-provider.test.tsx` (3 new, red first).
- Live result with fix: same swap recovered within 4 s to `https://stream.reach.radio/`, `Pause radio` showing, time advancing; manual Pause still sticks. Full suite 455/455, tsc and eslint clean.
- Test recipe: put a short WAV in `public/`, play, then in the page set `audio.src = '/<file>.wav'; audio.play()` to force a clean end (media-src allows `'self'`, blob: does not). Delete the WAV after.

## 8f. iOS v4 repoint is not a one-line change (checked 2026-11-05)

- Native repo `~/Documents/Development/reach-radio-native-ios`, `main` at `0daf905` (also `stream-url-worker`, `test/stream-override`). No edit made.
- `NowPlayingService.swift:71` builds the SSE URL as `baseURL.appendingPathComponent("api/stream-info-sse")`. `baseURL` defaults to `AppConfig.fallbackWebURL` (`https://reach-radio-nextjs.vercel.app/`) and is updated from the web host by `updateBaseURL`. So iOS v4 now-playing hits the Vercel SSE route, not the Astro app.
- Consequence: do not disable the Vercel SSE route until v4 is repointed or retired from testing. Repointing needs a separate `AppConfig` now-playing URL (not derived from the web host) and a change to `updateBaseURL`; that is a small design change, not a string swap. Not done; owner decision plus a v4 test pass.
- **Blocker found while preparing the repoint:** the Vercel route resolves the teacher server-side (`resolveArtist` in `src/app/api/stream-info-sse/route.ts`) and sends `imageUrl` and `resolvedArtist`. The Worker (Astro wire format) sends only `title` and `artist`. `AudioStreamingManager.swift:225-236` uses `resolvedArtist`/`imageUrl` for lock screen and CarPlay metadata when the web bridge is not ready (standalone launch, CarPlay). Repointing iOS to the Worker as-is would lose teacher names and photos there. Web is unaffected (it resolves client-side since `2b384e2`). No iOS edit made.
- Options: (a) leave iOS v4 on the Vercel route for now and keep it alive; (b) add teacher resolution to the Worker (Sanity read, new feature); (c) resolve client-side in iOS. Owner decision pending.
- Android and iOS v3 were not re-checked; v3 and Android are believed to use the legacy `pages.dev` endpoint.

## 8g. Worker teacher resolution (option b) built and deployed (2026-11-05)

- Plan: `docs/superpowers/plans/2026-11-05-worker-sse-teacher-resolution.md`. Worker repo branch `worker-sse-teacher-resolution`: `e07d235` (teachers.ts), `406821d` (SSE fields), `240ab5a` (docs). Fast-forwarded into Worker `main` and pushed (`2965db5..240ab5a`, owner Yes).
- Verified before deploy: 48 tests pass (re-run by orchestrator sandbox-off), typecheck clean, local smoke returned a live teacher match.
- Deployed (owner Yes) as version `108a9a36` (previous `02298be7`, rollback target).
- Post-deploy checks: audio `HTTP/2 200 audio/mpeg no-store`; SSE returns `imageUrl` and `resolvedArtist` for the on-air teacher (Chuck Smith), identical to `reach-radio-nextjs.vercel.app/api/stream-info`; two concurrent SSE clients both got events (ids 1 and 2).
- 25 min soak (one SSE connection held open) and CPU/subrequest limit check: result line to be added when it lands. "Soak" = timed connection test; "deploy freeze" = the Vercel freeze in memory, a different thing.
- Cost check run 2026-11-05 (owner Yes): `vercel usage` had no Nov 5 row yet (billing lag). Daily team totals: Nov 1 $3.94, Nov 2 $1.92, Nov 3 $2.09, Nov 4 $2.19 (Fluid provisioned memory $2.75, $0.91, $0.76, $0.78 of those). Real test: Nov 6-12 provisioned memory well below about $0.78/day, checked on Nov 13.
- Still open: iOS repoint. Named events are safe for iOS: `NowPlayingService.swift:83` reads only lines starting `data: ` and skips `event:` and `id:` lines.
- Vercel SSE route stays until iOS v4 is repointed.

## 9. Recipes and gotchas worth keeping

- Dev server in an Orca worktree: `doppler run --project reach-radio-nextjs --config dev -- npx next dev -p 3100` (plain `npm run dev` fails because Doppler is not linked there; plain `next dev` returns 500 with no Sanity env). Stop only your own server by PID (`lsof -tiTCP:3100 -sTCP:LISTEN -P -n`), never `pkill -f next-server`.
- `EventSource` `onmessage` fires only for unnamed events; named events need `addEventListener`.
- Vercel bills provisioned memory for the whole life of an open request; Cloudflare does not bill wall-clock duration for streaming responses.
- Run repo tests through the resource guard: `rg-run --class light --label <name> -- npm test`.
