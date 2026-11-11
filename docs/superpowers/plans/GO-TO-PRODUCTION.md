# Go To Production — Master Plan

Tracks all work required to switch the Reach Radio Next.js app from dev to production and redirect native apps (iOS/Android) from the Astro URL to the Next.js URL.

---

## Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ | Done |
| 🔲 | Not started |
| 🔧 | In progress |

---

## Sequence Overview

Work must flow in this order. Later steps depend on earlier ones.

```
Step 1 (web fixes) → Step 2 (Vercel deploy) → Step 3 (PPR Phase 3) → Step 4 (go-live)
```

---

## Step 1 — Native Bridge Fixes (web-side only)

**Original plan:** `docs/superpowers/plans/2026-05-29-native-webview-bridge-fixes.md`
**v4 bridge plan (supersedes some tasks):** `docs/superpowers/plans/2026-06-22-v4-bridge-and-migration.md`

| Task | File | Status |
|------|------|--------|
| T1: Fix audio stream 10s timeout | `src/app/api/audio-stream/route.ts` | ✅ Done |
| T2: Middleware for native detection | superseded — `BridgeInit` sets `mobile-app` cookie client-side when bridge objects detected | ✅ Done (differently) |
| T3: Fix BridgeInit gaps (loaded, showMediaBar, focus/blur, streamUrl) | `src/components/bridge/BridgeInit.tsx` | ✅ Done |
| T4: Add protocolVersion to all bridge messages | `src/lib/bridge/post-message.ts` | ✅ Done |
| T5: Add /api/native-config endpoint | `src/app/api/native-config/route.ts` | ✅ Done |
| T6: Implement `window.nativeBridge` for iOS v4 (T1–T7 in v4 plan) | `BridgeInit.tsx`, `MediaBar.tsx`, `post-message.ts` | ✅ Done |
| T7: Manual verification in native apps (pre-switch checklist) | — | 🔲 Not started |

**All web-side bridge tasks complete.**

---

## Step 2 — Vercel Deploy

Move hosting from Cloudflare Pages → Vercel. Required because Cloudflare Pages does not support Next.js PPR (`cacheComponents: true`).

| Task | Status |
|------|--------|
| Env vars set in Vercel | ✅ Done — Production scope confirmed pre-existing; Preview scope was missing `SANITY_PROJECT_ID`/`SANITY_DATASET`/`SANITY_WEBHOOK_SECRET`/`FORMSPREE_ENDPOINT`/`RECAPTCHA_SECRET_KEY` (build failed without them), added from Doppler `dev` config on 2026-08-04 |
| Verify PPR routes show `◐` in Vercel preview | ✅ Done 2026-08-04 — preview build clean, `/`, `/about`, `/donate`, `/teachers`, `/teachers/[slug]`, `/teachers/search`, `/about/privacy-policy` all show `◐` |
| Deploy to Vercel production | ✅ Done 2026-08-04 — aliased to `https://reach-radio-nextjs.vercel.app` (not `reach.radio` yet — DNS below) |
| Point `reach.radio` DNS to Vercel | 🔲 Not started — deliberately held; also listed under Step 4 (Go Live) since native apps still hardcode the Astro URL until App Store/Play Store updates ship |

---

## Step 3 — PPR Phase 3: Cache Invalidation

**Plan:** `docs/superpowers/plans/2026-05-29-ppr-phase-3-cache-invalidation.md`

Must happen after Vercel deploy — Sanity webhook needs the live production URL.

| Task | Status |
|------|--------|
| PPR Phase 2 (cacheComponents + Suspense refactor) | ✅ Done — all routes show `◐` |
| Fix revalidate endpoint (3 bugs: bad revalidateTag call, tag mismatch, weak auth) | 🔲 Not started |
| Verify home page `/` shows `◐` (likely already done) | 🔲 Not started |
| Add per-slug cache tags to teacher detail pages | 🔲 Not started |
| Register Sanity webhook → `https://reach.radio/api/revalidate` | 🔲 Not started (requires live URL) |
| End-to-end webhook test (publish in Sanity → page updates live) | 🔲 Not started |

---

## Step 4 — Go Live

**v3 iOS (App Store live, "Reach Radio FM" v3.2, released 2025-05-19):** WebView hardcodes `reach-radio-web.pages.dev` (Astro). Audio stream also hardcodes `reach-radio-web.pages.dev/api/audio-stream`. Domain migration does NOT affect v3.
**v4 iOS (in dev, not yet released):** Fetches `webUrl`/`streamUrl` from `/api/native-config` at launch, tries `reach-radio-nextjs.vercel.app` first, then `reach.radio`, then `reachradiotucson.com`. URL comes from config, no hardcode to change. App-bound domains (`WKAppBoundDomains`) already list all three hosts, so v4 is ready for the switch whenever it ships.
**Android (Play Store live, updated 2026-03-24):** Same as iOS v3 — WebView hardcodes `reach-radio-web.pages.dev`. **Audio stream is also hardcoded to `reach-radio-web.pages.dev/api/audio-stream`, NOT `reach.radio`** (corrected 2026-09-11 — see verification below; a prior note in this doc and in memory claimed Android audio already used `reach.radio`, which was wrong). Domain migration does NOT affect prod Android at all.
**Android (`bridge-testing`):** WebView uses `YOUR_TUNNEL_DOMAIN` placeholder — not shipped, dev-only.

| Task | Status |
|------|--------|
| Set `NEXT_PUBLIC_SITE_URL=https://reach.radio` in Vercel env (fixes `webUrl` in native-config, canonical tags, OG images, sitemap, JSON-LD — currently defaults to `vercel.app`) | 🔲 Not started |
| Migrate `reach.radio` DNS → Vercel | 🔲 Not started |
| Migrate `reachradiotucson.com` DNS → Vercel (fixes second fallback in v4 config chain) | 🔲 Not started |
| Decide `reachradiotucson.com`'s role once switched — second canonical host or 301 → `reach.radio` (both currently mirror the same Astro build 1:1; leaving both as canonical Next.js hosts is duplicate content) | 🔲 Not started |
| **Cloudflare proxy mode:** both domains currently proxy through Cloudflare (confirmed via `curl -I https://reach.radio/` — `server: cloudflare` + NEL headers, 2026-09-11), since that's required for the current Cloudflare Pages setup. When repointing to Vercel's target (A `76.76.21.21` or CNAME `cname.vercel-dns.com`), set those two records to **DNS only** (grey cloud, not proxied) in Cloudflare — leaving proxy on breaks Vercel's TLS termination/cert issuance and domain verification. Nameservers can stay on Cloudflare; only the proxy toggle on these 2 records needs to change. Verify post-switch via Vercel dashboard showing "Valid Configuration" + issued cert. | 🔲 Not started |
| ~~Review `/api/audio-stream`'s rate limit~~ — limiter deleted in `abaa9f3`; route has none now. Real open item is the 780s stream cap: see `2026-10-09-stream-hosting-decision.md` | 🔲 Superseded |
| iOS v4: replace dev tunnel fallback with `https://reach.radio` (⚠️ blocks App Store) | 🔲 Not started — iOS repo |
| Ship iOS v4 to App Store | 🔲 Not started |
| Android: replace `YOUR_TUNNEL_DOMAIN` → `https://reach.radio` on bridge-testing before Play Store | 🔲 Not started — Android repo |
| Ship Android to Play Store | 🔲 Not started |
| Verify native apps work end-to-end against production | 🔲 Not started |
| Keep Astro (`reach-radio-web.pages.dev`) alive — v3 iOS WebView + audio hardcoded there; Android WebView **and audio** hardcoded there | ⚠️ Permanent constraint |

### DNS-switch safety — verified 2026-09-11

Question: can `reach.radio` + `reachradiotucson.com` DNS move to Vercel today without breaking the apps currently in the stores? **Yes — verified directly against both native repos' git history, not inferred from memory.**

- All three hostnames (`reach.radio`, `reachradiotucson.com`, `reach-radio-web.pages.dev`) currently resolve to the *same* Astro/Cloudflare Pages build (identical `<title>`, near-identical byte size, `server: cloudflare` on all three). The shipped apps only ever call `reach-radio-web.pages.dev`, which this switch does not touch.
- **iOS:** the config-fetch code path (`AppConfig.swift`, the only thing that would make the app call `reach.radio`/`reachradiotucson.com`/`native-config`) was added in commit `627803f` on **2026-06-17** — over a year after the live App Store build (v3.2, released 2025-05-19). The commit nearest that release date (`fa2a274`, 2025-04-25) still uses the old `globalActions.goToPage` hardcoded-webview pattern. The live binary has no code path that touches either domain.
- **Android:** the `Config.kt` extraction (`944e3ae`, 2026-08-21) postdates the live Play Store build (updated 2026-03-24), but the diff shows it only *moved* an already-hardcoded `reach-radio-web.pages.dev` audio URL — it did not change the value. `CONFIG_ENDPOINTS` in current `main` still has only the pages.dev entry, with an explicit code comment that `reach.radio` was deliberately not added without verification.
- Confirmed live via `curl`: `reach.radio/api/native-config` → 404 (Astro has no such route); `reach-radio-nextjs.vercel.app/api/native-config` → returns the full contract (`protocolVersion`, `streamUrl`, `hostURL`, `webUrl`, `minAppVersion`) correctly today, so the not-yet-shipped iOS v4 build will get valid config the moment it's released post-switch.
- `src/proxy.ts`'s matcher excludes `/api/*`, so no auth/cookie gate blocks `native-config` or `audio-stream` for native clients.

None of this blocks the switch — the three follow-up rows added to the table above (`SITE_URL`, rate limiter, `reachradiotucson.com` canonical decision) are the only open items, and none are legacy-app risks.

### Cross-host DNS (Cloudflare → Vercel) — checked 2026-09-11

Question: `reach-radio-nextjs` is hosted on Vercel, `reach-radio-web` (the legacy Astro site) is hosted on Cloudflare Pages — is having the two projects on different hosting platforms itself a problem for the DNS switch?

**No, that part is fine and doesn't need to be solved** — `reach-radio-web.pages.dev` is a Cloudflare Pages default subdomain, entirely independent of the `reach.radio`/`reachradiotucson.com` custom-domain DNS records. Nothing about repointing those two records to Vercel touches `.pages.dev` or the legacy site's own hosting — it keeps serving the shipped apps unchanged regardless of what happens to the custom domains.

**The real, solvable gotcha: Cloudflare's reverse proxy currently sits in front of both domains, and needs to be turned off (not moved) for the two records once they point at Vercel.**

- Confirmed via `curl -I https://reach.radio/` (2026-09-11): response includes `server: cloudflare` and a Cloudflare NEL/`report-to` header block — Cloudflare's proxy (the "orange cloud") is active in the request path today, which is expected since Cloudflare Pages custom domains proxy through Cloudflare automatically.
- If that proxy toggle stays on after the DNS value is changed to point at Vercel, requests still hit Cloudflare's edge first. This breaks Vercel's own TLS termination, its automatic cert issuance (Let's Encrypt via Vercel), and its domain-verification check — a classic "looks like a DNS problem, is actually a proxy-mode problem" failure mode.
- **Fix is a toggle, not a migration:** in Cloudflare's DNS dashboard, when adding the Vercel target record (A `76.76.21.21` or CNAME `cname.vercel-dns.com`), set that record's proxy status to **DNS only** (grey cloud) instead of "Proxied" (orange cloud).
- Nameservers do **not** need to move off Cloudflare — keeping Cloudflare as the DNS zone while the origin is Vercel is a standard, fully-supported setup, as long as the proxy toggle above is set correctly.
- Both `reach.radio` and `reachradiotucson.com` are apex/root domains (no subdomain), so a plain CNAME at the zone apex isn't valid DNS — but Cloudflare auto-flattens CNAMEs at the apex regardless of proxy status, so staying on Cloudflare DNS for the apex-to-Vercel CNAME works correctly once DNS-only is set.
- Verification after the switch: Vercel's dashboard should show "Valid Configuration" for both domains with an issued certificate — that's the confirmation the proxy mode was set correctly, not just that the DNS record resolves.
- Not independently confirmed from this session: the actual current proxy toggle state in the Cloudflare dashboard (DNS/whois lookups are blocked in this sandbox) — worth a quick dashboard check, or `dig +short reach.radio` from a real terminal, before the cutover.

Rolled into the Step 4 table above as its own row.

### Native repo deep-dive — 2026-09-11 (triggered by iOS search-sheet-focus parity check)

Went deeper into both native repos' actual code (not just git-history dates) to check whether either has native-side handling for the `/teachers` search-sheet keyboard/focus bug class ([[project-search-sheet-focus-ios]] equivalent in this repo's memory). **None of this changes the DNS-switch verdict above — it's entirely about the unreleased next versions — but it belongs in this plan since Step 4's table references both.**

**iOS `main` (= v4, unreleased, `MARKETING_VERSION 4.0` / build 4):**
- Confirmed `main` already has the full multi-domain `ConfigService` chain (`vercel.app` → `reach.radio` → `reachradiotucson.com`) described in the v4 row above — this is real, wired, and not just "in dev" in the vague sense, it's a fully current, actively-developed branch (CarPlay, Watch app, widgets, Live Activities have all landed on it since).
- `origin/bridge-testing` is now a strict git ancestor of `main` (0 commits unique to it) — it has been fully absorbed, not a separate branch to track anymore.
- `main` already ships 3 native fixes for the WKWebView keyboard/focus bug class this repo's memory documents extensively under [[project-search-sheet-focus-ios]]:
  1. `WKWebView+ProgrammaticFocus.swift` — swizzles `WKContentView`'s private `_startAssistingNode` to force `userIsInteracting=true` globally, letting any JS `.focus()` show the keyboard even outside a live user gesture. Commit `8609495`, 2026-07-01 — predates this repo's own session 4 conclusion (2026-07-06) that "no code, native or web, can work around this," which was therefore too broad (true for JS/`evaluateJavaScript` alone, not true for a native private-API swizzle).
  2. `KeyboardObserver` + `ContentView` — hides native media-bar/bottom-nav while the keyboard is visible (its own plan doc explicitly scopes out this repo's cramped-sheet bug — complementary, not the same fix).
  3. `WKWebView+NoInputAccessory.swift` + a JS-blur/native-resign pairing for clean keyboard dismiss.
- **Open gap:** no commit or doc in that repo names the session-3/4 "cramped first-open" WebKit paint/compositor bug specifically. The `preventScroll` fix this repo shipped (session 5, credited to "a native-ios session, different angle") left no artifact there — untraceable, likely chat-only. Never confirmed whether that paint bug reproduces at all inside the real WKWebView (no Safari address-bar-collapse chrome — session 4 flagged this as a reason it might not exist there). Worth an on-device check in the actual wrapped app before assuming it's closed for native users too.
- iOS v4's own release checklist (`2026-06-19-reach-radio-v4-release-migration.md` in that repo) has Check 1/2 done, Check 3 (device bridge smoke test) and all TestFlight/App Store tasks unchecked, untouched since 2026-06-19 despite ~3 months of further feature work. Status of "how close is v4 to actually shipping" is genuinely unknown, not "still pending" — needs a fresh look on that side, not an assumption either way.

**Android `main` — materially earlier stage, confirms it is not close to ready:**
- `Config.kt` on `main` still hardcodes `reach-radio-web.pages.dev` — matches the live build, zero Next.js awareness merged.
- The migration branch, actually named `origin/bridge-testing-recovered` (not `bridge-testing`), has **diverged from `main`**: 9 commits unique to it (dynamic streamUrl, JSON-injection guard, back-button fix, buffering-state fix, AGP/Gradle bump), while `main` has moved 58 commits further since (widget/QS-tile work, Chrome Custom Tab links, perf fixes). Merging it now needs real conflict resolution, not a fast-forward.
- Android's own `docs/2026-06-17-nextjs-migration-evaluation.md` P0/P1 items are still open on `main`: `WebAppInterface` is still an `inner class` (Activity-leak risk), `jvmTarget` still `1.8`, no `offline` bridge-message handler at all.
- Some progress since that doc's 2026-08-21 parity-roadmap sibling doc claimed these didn't exist: `ConfigFetcher.kt` now exists and mirrors iOS's race-all-endpoints pattern, and a sleep-timer countdown is wired into `MediaBar.kt`. But `Config.CONFIG_ENDPOINTS` is a one-entry list (`WEB_BASE_URL`, still pages.dev) — the failover plumbing exists with nothing to fail over to yet.
- Zero commits or docs anywhere in the repo mention focus/keyboard/scroll/`preventScroll` — no native work on this bug class at all. Untested whether Android's WebView even has WKWebView's "no gesture → no keyboard" restriction in the first place.
- **Bottom line for Android specifically:** not a peer-readiness project to iOS. The URL switch itself isn't merged to its `main`, several of its own June P0s are still open, and the migration branch would need real catch-up work before it's even close to a Play Store submission candidate.

---

## Deferred — Native App Updates (non-blocking, batch into next release)

These require App Store / Play Store submissions. Not blocking the URL switch.

**Plan:** See "Native App Issues" section in `docs/superpowers/plans/2026-05-29-native-webview-bridge-fixes.md`

| Issue | Platform | Severity | Notes |
|-------|----------|---------|-------|
| iOS-1: `scheduleBufferingEnd()` guard bug | iOS | Medium | |
| iOS-2: `handleRefresh` retain cycle | iOS | Low | |
| iOS-3: Replace 2s splash timer with `loaded` postMessage | iOS | Medium | v4 already handles via `{ loaded: true }` |
| iOS-4: Consume `streamUrl` from bridge | iOS | Low | v4 fetches from `/api/native-config` instead |
| Android-1: IIFE guard on `up.history.location` | Android | ~~High~~ | **Moot** — `window.up` shim deleted from Next.js |
| Android-2: Remove `isPlaying=false` from `isBuffering` | Android | High | |
| Android-3: Back button exit at SPA root | Android | Medium | |
| Android-4: JSON-encode path in `goToPage` | Android | ~~Low~~ | **Moot** — `window.globalActions` deleted from Next.js |

---

## Key Constraints (never forget)

- **Keep Astro alive forever** — iOS v3 WebView AND audio stream both hardcode `reach-radio-web.pages.dev`. Android prod WebView **and** audio stream also hardcode `reach-radio-web.pages.dev` (corrected 2026-09-11 — audio is NOT already on `reach.radio`, see DNS-switch verification in Step 4). Do NOT shut down Astro without App Store + Play Store updates for both apps.
- **Vercel required for PPR** — Cloudflare Pages does not support `cacheComponents`.
- **Sanity webhook secret** — already set in Vercel env. Do not commit to git.
