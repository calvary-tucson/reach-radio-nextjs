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

## 8. Execution (fresh session)

CLI: `cd ~/Documents/Development/reach-radio-nextjs && claude`
Prompt: `Read docs/superpowers/plans/2026-10-09-stream-hosting-decision.md. Run the read-only tests in section 5 (steps 1-4), report results, then recommend A or B. Do not change Sanity, DNS, or code without my approval.`
Vercel CLI needs `--scope calvary-tucson-s-team`; sandbox needs `allowed_domains` for `api.vercel.com`; login may require me to run `! vercel login`.
