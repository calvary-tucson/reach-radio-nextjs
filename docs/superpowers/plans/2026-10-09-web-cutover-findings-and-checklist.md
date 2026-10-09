# Web Cutover — Findings & Checklist (reach.radio → Vercel)

Date: 2026-10-09. Scope: move `reach.radio` and `reachradiotucson.com` from the old Astro site (Cloudflare Pages) to this Next.js site (Vercel) without disrupting existing app users.

Tags: **VERIFIED** = seen in code, git history or a live response this session. **INFERRED** = reasoned, not directly seen. **UNKNOWN** = needs a dashboard or device.

Supplements `GO-TO-PRODUCTION.md` (not edited; it has uncommitted edits from another session).

---

## 1. Bottom line

- The DNS switch does **not** affect the live iOS (v3.2) or Android apps. VERIFIED.
- Real exposure is browser visitors and the unreleased iOS v4.
- The one coupling that matters is Sanity `appSettings.radioAudioURL`. It is currently `https://reach.radio/api/audio-stream`, which becomes the Vercel proxy (`maxDuration = 780`) after cutover.
- Fix audio in Sanity first, then cut over.

## 2. Exposure table

| Audience | Affected by DNS switch? | Evidence |
|---|---|---|
| iOS v3.2 (live) | No | VERIFIED. WebView `ContentView.swift:219` = `reach-radio-web.pages.dev`; native stream `ContentView.swift:226` = `pages.dev/api/audio-stream` (commit `fa2a274`) |
| Android (live) | No | VERIFIED. `MainActivity.kt:79,463`, `AudioManager.kt:17`, `PlaybackService.kt:55` all `pages.dev` (commit `470ba2f`) |
| Live apps' web player | Not rendered | VERIFIED. `MediaBarContainer.astro:25-43` omits `<audio>` and the media bar when `mobile-app` header/cookie is set. Header reaching Astro on every request: UNKNOWN (device check) |
| Browser visitors | Yes | VERIFIED. Astro reads Sanity `radioAudioURL` (`MediaBarContainer.astro:36`); live value is `https://reach.radio/api/audio-stream` (Sanity query) |
| iOS v4 (unreleased) | Yes | VERIFIED. `streamUrl` comes from `/api/native-config` (`route.ts:15`) = same Sanity field; `webUrl` preferred over `hostURL` (`Reach_Radio_NativeApp.swift:66-71`) |

## 3. Findings

- **Audio proxy cap.** `src/app/api/audio-stream/route.ts` sets `maxDuration = 780`, fetches the radiojar stream. VERIFIED. Plan requirement (Pro) and bandwidth cost: UNKNOWN.
- **Soft 404.** `curl https://reach-radio-nextjs.vercel.app/not-a-page` → **200**. `reach.radio/not-a-page` → 404. VERIFIED. Cause: INFERRED — `src/app/@modal/[...catchAll]/page.tsx` returns `null`, so unknown paths match the modal slot. Do not just delete it; it likely supports modal close. Fix and verify on a preview.
- **Sanity `hostURL` is stale** (`https://reach-radio.webapp-0a8.workers.dev/`). VERIFIED. Impact low: iOS v4 uses it only if `webUrl` is missing, and `native-config` always sends `webUrl` (`route.ts:17`). Android: grep for `hostURL` in `*.kt` returned no matches. VERIFIED.
- **`NEXT_PUBLIC_SITE_URL` defaults to the vercel.app host** (`src/lib/constants.ts:1`), so `webUrl`, canonicals, OG and JSON-LD would be wrong in production until set. VERIFIED.
- **Route parity.** Old sitemap (26 paths) vs new sitemap (27): same teacher slugs; only difference is `/about/privacy-policy` listed on the new site and `/` vs `` formatting. VERIFIED. **No redirects needed** beyond the existing `/speakers/*` one.
- **Old-only routes** `/scheduled-list`, `/sleep-timer/sleep-timer-layer` are Unpoly fragments (`index.astro:119,232-234`), not indexed pages. `/about/contact-form-response` is a form POST endpoint (`about/index.astro:80`); the new site uses a server action. No equivalents needed. VERIFIED.
- **Old site state.** `reach-radio-web` master is 0 ahead of `origin/master`; `origin/web-fixes-recovered` adds 0 commits. VERIFIED.
- **Cloudflare** serves both domains today (`server: cloudflare` on `reach.radio/api/audio-stream`). VERIFIED. Proxy toggle state in dashboard: UNKNOWN.

## 4. Corrections to existing docs

- `GO-TO-PRODUCTION.md:90` says `/api/audio-stream` has a 10 req/60s per-IP limiter. The current `route.ts` has none and `proxy.ts` excludes `/api/`. VERIFIED. Either the limiter was removed or the doc is stale; check `2026-09-11-streaming-routes-rate-limit.md`.
- "23 unpushed commits on reach-radio-web" (audit prompt) is false. VERIFIED (section 3).
- `GO-TO-PRODUCTION.md:98-108` (DNS-switch safety) is correct for the live apps but omits the Sanity `radioAudioURL` coupling for browser listeners and iOS v4.

## 5. Decisions needed (user)

- [ ] **Audio approach.** Recommended: set Sanity `radioAudioURL` to `https://stream.radiojar.com/g4d600bv6p5tv` (direct). Alternative: keep the proxy and confirm a Vercel plan that supports 780s. The Sanity change takes effect immediately on the old site for browser listeners and is reversible. **Not made yet; needs approval.**
- [ ] **`reachradiotucson.com` role.** Second canonical host (duplicate content) or 301 → `reach.radio`.
- [ ] **Vercel plan** (dashboard).

## 6. Checklist

### Pre-cutover
- [ ] Apply the approved audio change in Sanity; verify old site playback in a browser, and the live iOS and Android apps still play (native players, expected unchanged).
- [ ] Update Sanity `hostURL` to the production URL.
- [ ] Set `NEXT_PUBLIC_SITE_URL=https://reach.radio` in Vercel Production.
- [ ] Fix soft 404 (explicit not-found for unmatched paths); verify `curl` returns 404 on the preview.
- [ ] Add `reach.radio`, `www`, `reachradiotucson.com` and its `www` in Vercel (DNS unchanged).
- [ ] Register the Sanity webhook → `https://reach.radio/api/revalidate`; add the reCAPTCHA domains and Sanity CORS origins; set up monitoring/alerts.
- [ ] Decide rate limiting for `/api/audio-stream` (see section 4).
- [ ] Record all current DNS records (A/CNAME/MX/TXT) for both domains.
- [ ] Lower DNS TTL one day ahead.
- [ ] Device check: confirm the live apps send `mobile-app` on every request.

### Cutover (low-traffic hours)
- [ ] Switch apex and `www` for `reach.radio` to Vercel, **DNS only** (grey cloud).
- [ ] Same for `reachradiotucson.com` (or configure the 301).
- [ ] Vercel shows "Valid Configuration" with an issued certificate; `curl -sI` shows `server: Vercel`.
- [ ] Check `/`, `/donate`, `/teachers`, `/api/native-config`, `/api/audio-stream`, `/sitemap.xml`, `/robots.txt`.
- [ ] Confirm `reach-radio-web.pages.dev` is unchanged.

### Post-cutover
- [ ] Submit the new sitemap; watch for 404s.
- [ ] Test the webhook end to end (publish in Sanity → page updates).
- [ ] Test reCAPTCHA and the contact form.
- [ ] Smoke-test live iOS v3.2 and Android; test iOS v4 on a device.
- [ ] Then ship iOS v4.

### Rollback
- [ ] Restore the recorded DNS records; wait for TTL. Revert the Sanity audio change if needed. Do not touch `pages.dev`.

## 7. Freeze list

- Never redirect or retire `reach-radio-web.pages.dev`.
- Anything pushed to `reach-radio-web` reaches the live apps' WebViews immediately (if Cloudflare auto-deploys master — UNKNOWN; confirm).
- Do not change `native-config`'s `protocolVersion` or the bridge message shapes without a native-side check.

## 8. Unknowns and how to resolve

| Unknown | How |
|---|---|
| Cloudflare proxy toggle state | Cloudflare dashboard |
| Vercel plan and function limits | Vercel dashboard |
| Subdomain MX records | `dig MX` from a real terminal |
| Cloudflare Pages auto-deploys master | Cloudflare dashboard |
| `mobile-app` header on every request | On-device network capture |
| Cause of soft 404 | Test fix on a Vercel preview |

## 9. Execution handoff

CLI:
```
cd ~/Documents/Development/reach-radio-nextjs && claude "Execute docs/superpowers/plans/2026-10-09-web-cutover-findings-and-checklist.md pre-cutover section. Ask before any Sanity write or DNS change."
```

In-session:
```
Execute the pre-cutover checklist in docs/superpowers/plans/2026-10-09-web-cutover-findings-and-checklist.md. Stop and ask before any Sanity write, Vercel env change or DNS change.
```
