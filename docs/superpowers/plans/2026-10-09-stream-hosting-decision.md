# Stream Hosting Decision & Verified Infrastructure State

**Date:** 2026-10-09 · **Status:** Decision pending (options untested) · **Mode:** audit, nothing changed
**Companion docs:** `2026-10-09-web-cutover-findings-and-checklist.md`, `GO-TO-PRODUCTION.md`, `docs/sanity-schema-and-consumers.md`

**Legend:** VERIFIED = seen in code/CLI/live response/docs fetched. INFERRED = reasoned. UNKNOWN = not checked.

---

## 1. Problem

After `reach.radio` moves to Vercel, `https://reach.radio/api/audio-stream` is the Next.js proxy (`src/app/api/audio-stream/route.ts`, `maxDuration = 780`). The old Astro stream (Cloudflare) had no duration cap, so this is a **regression**: every listener is disconnected every ~13 min.

Who is affected (VERIFIED unless noted):

| Audience | Stream URL source | Affected after cutover |
|---|---|---|
| Browser visitors (Next.js site) | Sanity `appSettings.radioAudioURL` = `https://reach.radio/api/audio-stream` | Yes |
| Browser visitors on Astro (pages.dev, until retired) | same Sanity field | Yes, once `reach.radio` points to Vercel |
| iOS v4 (unreleased) | `/api/native-config.streamUrl` (same field); fallback `https://reach.radio/api/audio-stream` (`AppConfig.swift:10`) | Yes |
| iOS Watch app | hardcoded `https://reach.radio/api/audio-stream` (`WatchAudioPlayer.swift:10`) | Yes |
| iOS v3.2 (live) | hardcoded `reach-radio-web.pages.dev/api/audio-stream` | No |
| Android 3.0/40 (live) | hardcoded pages.dev (`Config.kt:4-6`, `PlaybackService.kt:63,133`) | No |

Whether the iOS/Android players reconnect automatically after a cut is **UNKNOWN** (player code not yet read for retry/reconnect).

## 2. Verified limits

- **Vercel Pro:** default 300s, **max 800s**, beta up to 1800s per function (docs, 2026-10). Streaming time counts; on timeout the response is cut (504 if before first byte). Hobby max 300s. Edge runtime: first byte within 25s, stream up to 300s (worse). Concurrency auto-scales to 30,000.
- **Vercel billing:** Fluid compute bills active CPU + provisioned memory; I/O wait does not count as active CPU. **Data transfer pricing and included allowance: UNKNOWN** (pricing page not read). Likely the dominant cost; one listener at 128 kbps ≈ 58 MB/h (stream bitrate UNKNOWN).
- **Cloudflare Workers:** no hard duration limit for HTTP-triggered Workers; streaming stays open while the client is connected; CPU time limit does not count network wait. Pages Functions limits: INFERRED equal (Pages limits page 404'd).
- **Cloudflare Worker routes** require the hostname's DNS record to be **proxied (orange cloud)**.
- **Vercel + Cloudflare proxy:** Vercel's guide ("Should I use Cloudflare in front of Vercel?") does **not recommend** a reverse proxy in front of Vercel: less firewall visibility, added latency, cache complexity, bot-protection accuracy drops. Community reports of "Invalid Configuration" warnings and intermittent 524/526 with proxy on. (From search summary; full page not read.)
- **Radiojar:** `https://stream.radiojar.com/g4d600bv6p5tv` redirects (302) to a tokenized **plain-http** node (observed earlier). A pure redirect to it is INFERRED to fail on iOS (ATS; no `NSAppTransportSecurity` exception found) and Android (`usesCleartextTraffic="false"`, `AndroidManifest.xml:21`). **Untested on device.** HTTPS-only mount availability: UNKNOWN.

## 3. Verified Vercel / DNS state (2026-10-09, read-only)

- **Team/plan:** `calvary-tucson-s-team`, **Pro**, billing active. The CLI's default scope is a *different* team (`calvary-tucsons-projects`); always pass `--scope calvary-tucson-s-team` (else "no project for reach-radio-nextjs").
- **Project** `prj_WDyZFddcaawGJGS3B1eyJkcz1hcr`: Next.js, Node 24.x, Fluid compute on, region `iad1`, GitHub-linked, prod branch `main`, SSO protection `all_except_custom_domains`, no password/IP restriction. Latest Production deploy 2026-09-14 (same day as `723018b`).
- **Domains:** project has only `reach-radio-nextjs.vercel.app`. Account has **0 domains**; `reach.radio` and `reachradiotucson.com` are not in Vercel.
- **Production env var names** (values encrypted, not read): `RECAPTCHA_SCORE_THRESHOLD`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `DOPPLER_PROJECT`, `DOPPLER_ENVIRONMENT`, `DOPPLER_CONFIG`, `SANITY_DATASET`, `SANITY_PROJECT_ID`, `SANITY_WEBHOOK_SECRET`, `FORMSPREE_ENDPOINT`, `RECAPTCHA_SECRET_KEY`. `RECAPTCHA_SCORE_THRESHOLD_APP` unset (code falls back to the base threshold). Whether Doppler syncs into Vercel: UNKNOWN.
- **DNS (user's `dig`):** both domains on Cloudflare NS `tara`/`james`; apex A records are Cloudflare proxy IPs (proxied); `www` = same IPs as apex; **no MX/DMARC/mail/smtp/autodiscover**; TXT only `google-site-verification`. Email breakage risk from the DNS change is therefore low (INFERRED: nothing visible depends on these zones for mail).
- **Vercel domain setup docs:** apex A `76.76.21.21` (or the value shown in the project's Domains page), subdomain CNAME; add apex and `www` with redirect.

## 4. Options

| # | Option | Cap | Pros | Cons / unknowns |
|---|---|---|---|---|
| A | **Stream subdomain** (e.g. `stream.reach.radio`) served by a Cloudflare Worker or the existing Astro/Pages function; only that record proxied; apex stays DNS-only to Vercel | none | Site stays unproxied (follows Vercel advice). Switch via Sanity `radioAudioURL` for web + v4 + Astro | Watch app and v4 `fallbackStreamURL` hardcode `reach.radio/api/audio-stream`; CSP `media-src` needs the host; new Worker to maintain |
| B | **Redirect** `reach.radio/api/audio-stream` → `https://reach-radio-web.pages.dev/api/audio-stream` (`redirects()` in `next.config.ts`) | none | One config entry; no DNS change; HTTPS-to-HTTPS so ATS/cleartext not hit; fixes Watch + hardcoded URLs | Permanent pages.dev dependency; needs CORS if web player uses `fetch`/Web Audio (plain `<audio>` fine); player redirect handling untested |
| C | Vercel rewrite to the Astro stream | ? | Single URL | Whether external rewrites have their own duration limit: UNKNOWN; bandwidth still via Vercel |
| D | Ask radiojar for a stable HTTPS mount; point `radioAudioURL` at it | none | No proxy at all | Availability UNKNOWN (support email / header check) |
| E | Client auto-reconnect (v4 + web player) | n/a | Makes cap near-invisible with any option | Live apps need a store release (but they don't use this URL) |
| F | Vercel 1800s beta | 30 min | Config only | Only halves the problem; beta; account access UNKNOWN |
| G | Worker route on the apex (orange-cloud `reach.radio`) | none | Single hostname | Contradicts the DNS-only step in `GO-TO-PRODUCTION.md`; Vercel does not recommend; must be a deliberate choice |
| X | **Point `radioAudioURL` straight at radiojar** (earlier recommendation) | none | Simple | **Likely breaks iOS/Android** (http redirect). Do not apply untested. Also hits Astro desktop + v4 at once |

**Working recommendation (not decided):** test B first (cheapest), fall back to A. Add E for v4/web. Send D as a long-term cleanup. Keep live apps on pages.dev/Astro (already the plan).

### 4b. Option B detail (read-only checks run 2026-10-09)

VERIFIED:
- `GET https://reach-radio-web.pages.dev/api/audio-stream` → `HTTP/2 200`, `content-type: audio/mpeg`, `server: cloudflare`, **no `access-control-allow-origin`**. `reach.radio/api/audio-stream` (current Astro) returns the same shape. Vercel's own route returns 200 with `access-control-allow-origin: *`, `cache-control: no-cache, no-store`.
- Web player uses a plain `<audio src>` (`src/components/AudioProvider.tsx:50,87-89`); no `crossOrigin`, no Web Audio/`createMediaElementSource` in `src` → **CORS not needed** for a redirect target.
- **CSP blocks the redirect hop:** `next.config.ts:37` `media-src 'self' https://*.radiojar.com https://reach.radio`. CSP is enforced on each redirect hop, so `https://reach-radio-web.pages.dev` must be added to `media-src` (INFERRED from CSP spec behavior; test in a browser).
- Radiojar: `https://stream.radiojar.com/g4d600bv6p5tv` → `302` to `http://nNN.radiojar.com/g4d600bv6p5tv?rj-ttl=5&rj-tok=…` (plain http, tokenized). Confirms option X risk.
- Reconnect behavior on stream end:
  - **iOS v4:** `AVPlayerItemFailedToPlayToEndTime` → retry up to `maxRetries = 5`, backoff `min(3·2^n, 30)s` (`AudioStreamingManager.swift:80,1157-1213`) plus an 8s stall watchdog (`:83`). Watch app recreates the player on each play (`WatchAudioPlayer.swift:59`); its end-of-stream handling not read.
  - **Web:** `onError` → backoff reconnect, max 10 attempts (`AudioProvider.tsx:25-58,98-103`). **No `onEnded`/`onStalled` handler** → if the browser reports a clean server close as `ended`, playback stops silently (INFERRED, untested).
  - **Android:** `onPlayerError` → `recoverFromPlaybackError()` re-prepares and resumes (`PlaybackService.kt:183-215`); `STATE_ENDED` only logs. Not affected by B today (pages.dev).

INFERRED / UNKNOWN:
- Next.js `redirects()` in `next.config.ts` run before filesystem routes and are handled at the routing layer (no function, no stream bandwidth through Vercel). Verify on a preview deploy.
- Pages/Workers has no wall-clock cap (docs) but the pages.dev stream's real max session length is untested.
- AVPlayer/ExoPlayer/`<audio>` follow a 307 on a live stream: standard, untested here.
- Cloudflare Pages auto-deploy of the Astro repo `master`: UNKNOWN.

Sketch (not applied): `next.config.ts` `redirects()` entry `{ source: '/api/audio-stream', destination: 'https://reach-radio-web.pages.dev/api/audio-stream', permanent: false }` (307, so nothing caches it) + add the pages.dev host to CSP `media-src`. Keep `route.ts` for one-commit rollback. Later, swap the destination to a custom hostname (e.g. `stream.reach.radio` on the Pages project) with no client change.

### 4d. Findings and decisions recorded 2026-10-13

(§4c is reserved for the iOS v4 test results, plan Task 8.) Legend as above. Nothing in Sanity, DNS or Vercel was changed to produce this.

**Which URL the clients actually play (VERIFIED)**
- Live Sanity `appSettings.radioAudioURL` = `https://reach.radio/api/audio-stream` (public CDN GET, project `bk05c6rl`, dataset `production`, 2026-10-13). `hostURL` is still the stale workers.dev value.
- Web player (`layout.tsx:108-117` → `<AudioProvider streamUrl>` → `<audio src>`), iOS v4 (bridge `loaded` handshake `BridgeInit.tsx:114` and `/api/native-config`), and the legacy Astro player all read that one Sanity value. `FALLBACK_STREAM_URL` (direct Radiojar HTTPS, `constants.ts:3`) is used only if the field is empty or the fetch fails.
- Published Android and iOS 3.2 hardcode `reach-radio-web.pages.dev`. The iOS Watch app hardcodes `reach.radio/api/audio-stream`.
- The Studio schema (`sanity-cms-administration/studios/reach-radio/schemas/appSettings`) types `radioAudioURL` as a bare `string`: no https validation, no description, no singleton enforcement.
- **Cutover risk:** today `reach.radio/api/audio-stream` resolves to the legacy Astro function on Cloudflare. After `reach.radio` DNS moves to Vercel it resolves to the Vercel proxy (`route.ts`, `maxDuration = 780`), silently moving web, iOS v4 and the Watch app onto the route that is cut every ~13 min. B (or A) must be in place before the DNS move.
- Radiojar direct is not a drop-in: the 302 to a tokenized plain-`http` node is VERIFIED in §4b; that this breaks iOS ATS / Android cleartext is INFERRED, untested.

**T0 control (iOS v4 simulator, Vercel proxy via `-streamURLOverride`) — VERIFIED, one run**
- Cut at 13m06s (play 18:45:01, paused 18:58:07). No failed/end event logged. The 8 s stall watchdog fired at 18:58:15, retry 1/5 after 3 s, playback resumed at 18:58:20.66. Silence ≈ 13.3 s; UI label stayed "Pause radio" throughout.
- Not shown: whether the retry counter resets after a successful recovery, behaviour on cellular, or CarPlay/lock screen during the gap. Candidate iOS ticket: no `DidPlayToEnd` handler; no visible stalled state during the gap.

**Cost and limits (from vendor docs read 2026-10-12; usage figures are estimates)**
- Vercel Pro: Fast Data Transfer $0.15–$0.35/GB, 1 TB included via Flat Rate CDN, whose terms exclude bulk media delivery as the majority of bandwidth (Vercel may move the project to Flex CDN, require another plan, or limit service). Fluid compute: Provisioned Memory $0.0106/GB-hr (bills during I/O wait), Active CPU $0.128/hr (pauses on I/O), invocations $0.60/M. Pro max duration 800 s.
- Cloudflare free plan (Workers and Pages Functions share it): 100k requests/day (reset 00:00 UTC; Error 1027 over), 10 ms CPU/request excluding I/O wait (Error 1102), no hard wall-clock while the client stays connected, 50 subrequests, static assets free. "No egress charge" is from memory, NOT verified in the docs fetched. Workers Paid $5/month, 10M requests included.
- Observed on the `reach.radio` zone, `/api/audio-stream`, last 3 days (GraphQL analytics, read-only token): 2,432 requests (~810/day, ~1% of the cap), 8.875 GB (~3 GB/day, ~90 GB/month ≈ 1,500 listener-hours/month at 128 kbps). Roughly 1,040 of the 2,432 requests (12% of bytes) are bots/relays from hosting IPs (radiotune-proxy on GTHost, ORB HisBot on Hetzner, other Hetzner/OVH/Contabo/AWS/GCP). Decision: do nothing (a WAF rule only covers the reach.radio hostname; pages.dev direct bypasses it).
- At today's volume Vercel stays inside Pro's included transfer, so cost is not the driver. Growth is: 1000 listeners × 8 h ≈ 150× today.

**Decision recorded (user, 2026-10-13): both stream hosts run in parallel until the legacy mobile apps are retired**

```text
 B now:   client -> reach.radio/api/audio-stream (Vercel)
                      | 307
                      v
                 pages.dev/api/audio-stream (legacy Astro, Cloudflare) -> Radiojar

 A later: client -> stream.reach.radio (new Worker, Cloudflare) -> Radiojar
          (Sanity radioAudioURL flipped; no app release)
```

1. **B first:** the redirect on the new site (branch `test/stream-redirect-b`, commit 369b14a: 307 + `media-src` + pages.dev). No DNS or Sanity change. `route.ts` is left for rollback; `redirects()` run before filesystem routes, so it is dead code while the redirect is live (INFERRED, verify locally). Delete `route.ts` once B is proven.
2. **Build the Worker in parallel** (A): new repo `reach-radio-audio-stream-worker`, not inside this repo (Vercel would rebuild on every Worker change; tsc/eslint/vitest would pick it up; different deploy flow) and not in the legacy repo (being retired). Contents: `wrangler.toml`, `src/index.ts` (~15 lines), small test, README noting the Radiojar stream ID.
3. **Then** flip Sanity `radioAudioURL` to `https://stream.reach.radio/...` (user's edit), re-point the Vercel redirect to the Worker so the Watch app's hardcoded URL keeps working, and add `stream.reach.radio` to CSP `media-src`.
4. **Retire the legacy project** only when published Android and iOS 3.2 are gone and the Watch app no longer needs the old path. Record the date when decided.

**Worker requirements**
- Pure passthrough of `upstream.body`: no TransformStream or per-chunk work (10 ms CPU budget).
- Do NOT send `Icy-MetaData: 1` upstream; Radiojar would interleave metadata bytes into the audio. The existing proxies do not send it.
- Clear the 10 s connect timeout as soon as headers arrive; the abort signal stays bound to the body and would kill the stream mid-play.
- `Cache-Control: no-store`; follow Radiojar's 302 to the tokenized http node (server-side fetch, so ATS does not apply).
- `reach.radio` must stay on Cloudflare nameservers for a Worker custom domain: at cutover point the apex at Vercel with a DNS-only record; do not move nameservers.
- The Radiojar stream ID `g4d600bv6p5tv` lives in three places (Astro function, Worker, and `RADIOJAR_URL`/`FALLBACK_STREAM_URL` in this repo). Update all if Radiojar changes it.
- The 100k/day cap is account-wide: every Astro page view and bot request counts until the site leaves Cloudflare. Over the cap the stream is down until midnight UTC. Workers Paid ($5/month) is optional insurance (user's call).
- Soak: several hours against the deployed Worker, with one `wrangler deploy` mid-stream to watch clients reconnect. The 60-minute `pages.dev` curl (Task 1 step 3) is still unrun.

**Now-playing metadata (VERIFIED in code)**
- Metadata does not travel in the audio stream. It comes from Radiojar's separate API (`RADIOJAR_URL`, `constants.ts:10`), polled by the Vercel routes `/api/stream-info-sse` (web `useNowPlaying.ts:39`, iOS v4 `NowPlayingService.swift:71`, legacy Astro `MediaBarContainer.astro:126`) and `/api/stream-info`. The Worker needs nothing for metadata.
- `stream-info-sse` stays on Vercel: tiny payloads, closes itself after a jittered 10–12 min (under `maxDuration = 780`), client reconnects. Estimated ~44k reconnects/day at 1000 listeners × 8 h ≈ $0.03/day in invocations; memory is the larger but still small part (estimate, check the Vercel usage page). Scaling risk is upstream: each connection polls Radiojar every 30 s with no shared cache (~33 req/s at 1000 listeners).
- `/api/stream-info` has no callers in the Next.js source, iOS repo (Watch included), Android repo or Astro source. Candidate for deletion (`chore(api)`) after checking Vercel request logs for external hits (not yet checked).

**Not verified / open**
- 60-minute (and multi-hour) hold on Cloudflare; the 307 being free of function and bandwidth billing on Vercel; AVPlayer, ExoPlayer and `<audio>` following the 307 on a live stream (T1); web player on silent stall (no `onEnded`/`onStalled`); CarPlay/lock-screen behaviour through the redirect.
- Whether a Sanity field description/https validation should be added to `radioAudioURL` (not requested).
- The running plan `2026-10-09-ios-v4-stream-redirect-test.md` tests B only; it needs a Worker-oriented follow-up before A.

## 5. Tests that decide it (read-only first)

1. `curl -sI https://reach-radio-web.pages.dev/api/audio-stream` — status, content-type, CORS, redirect chain (B/A viability).
2. `curl -sI https://stream.radiojar.com/g4d600bv6p5tv` — confirm 302 target scheme (X risk) and any HTTPS-only mount (D).
3. Read how the web player loads the stream (`src/components/**` `AudioProvider`): `<audio src>` vs `fetch` (B needs CORS if fetch).
4. Read iOS (`AudioStreamingManager.swift`, `WatchAudioPlayer.swift`) and Android (`PlaybackService.kt`) for reconnect/retry on stream end (E need).
5. **On device (needs user):** play the chosen URL on a real iPhone and an Android device across a forced disconnect; confirm redirect following.

## 6. Cutover-order dependencies (Sanity/env)

These must change together with the DNS switch (details: `docs/sanity-schema-and-consumers.md`):
- `NEXT_PUBLIC_SITE_URL=https://reach.radio` in Vercel Production (build-time; **redeploy required**). Else `/api/native-config.webUrl` keeps sending iOS v4 to vercel.app. Current value unread (INFERRED vercel.app).
- Sanity `appSettings.hostURL` is stale (`reach-radio.webapp-0a8.workers.dev`): set to the production URL.
- Sanity `appSettings.radioAudioURL` is the single switch for Next.js player, Astro desktop player and v4; edit only after §5 tests.
- Sanity webhook target → `https://reach.radio/api/revalidate` with payload including `_type` and `_updatedAt` (current config UNKNOWN).
- Do **not** retire pages.dev/Astro: live iOS v3.2 and Android depend on it.

## 7. Related bugs found (not yet fixed)

- `src/components/home/TodaySchedule.tsx:45` caches with tag `schedule`, which no webhook path revalidates (`api/revalidate/route.ts` `TAG_MAP` yields only `teachers`, `siteSettings`, `appSettings`). Schedule edits can show stale for up to the `days` cache life. Fix: use tag `teachers`.
- `siteSettingsQuery` reads `siteKeywords`, `twitterHandle`, `facebookPage`, which are not in the Sanity schema (null live).
- Soft 404 on the new site (see companion doc §3).
- iOS v4 has no `AVPlayerItemDidPlayToEndTime` handler (grep, case-insensitive, 2026-10-09). A clean end-of-stream at Vercel's 780s cut may stop playback silently with no retry. Unverified on device; test T0 in `2026-10-09-ios-v4-stream-redirect-test.md`.

## 7b. Decisions and constraints recorded 2026-10-09

- Target stack is the new Next.js site + iOS v4 (Android later).
- Vercel preview URLs are SSO-gated (302 to `vercel.com/sso-api`), so AVPlayer cannot use them as a test host. The iOS test uses a local dev server behind the dev tunnel plus a DEBUG-only stream override in the iOS app.
- User accepts leaving `reach-radio-web.pages.dev` running. If option B is chosen it needs a **long-term Cloudflare Pages ownership plan** (updates, maintenance, deploy trigger, monitoring, retirement path; consider moving only the stream endpoint to a standalone Worker). Not yet written.
- iOS test plan: `2026-10-09-ios-v4-stream-redirect-test.md`.

## 8. Execution (fresh session)

CLI: `cd ~/Documents/Development/reach-radio-nextjs && claude`
Prompt: `Read docs/superpowers/plans/2026-10-09-stream-hosting-decision.md. Run the read-only tests in section 5 (steps 1-4), report results, then recommend A or B. Do not change Sanity, DNS, or code without my approval.`
Vercel CLI needs `--scope calvary-tucson-s-team`; sandbox needs `allowed_domains` for `api.vercel.com`; login may require me to run `! vercel login`.
