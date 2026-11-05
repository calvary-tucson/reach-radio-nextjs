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

## 9. Recipes and gotchas worth keeping

- Dev server in an Orca worktree: `doppler run --project reach-radio-nextjs --config dev -- npx next dev -p 3100` (plain `npm run dev` fails because Doppler is not linked there; plain `next dev` returns 500 with no Sanity env). Stop only your own server by PID (`lsof -tiTCP:3100 -sTCP:LISTEN -P -n`), never `pkill -f next-server`.
- `EventSource` `onmessage` fires only for unnamed events; named events need `addEventListener`.
- Vercel bills provisioned memory for the whole life of an open request; Cloudflare does not bill wall-clock duration for streaming responses.
- Run repo tests through the resource guard: `rg-run --class light --label <name> -- npm test`.
