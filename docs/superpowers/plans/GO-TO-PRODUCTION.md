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
| Env vars set in Vercel | ✅ Confirmed (`SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_WEBHOOK_SECRET`, `FORMSPREE_ENDPOINT`, `PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`) |
| Deploy to Vercel production | 🔲 Not started |
| Verify PPR routes show `◐` in Vercel preview | 🔲 Not started |
| Point `reach.radio` DNS to Vercel | 🔲 Not started |

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

**v3 iOS (prod `main`):** WebView hardcodes `reach-radio-web.pages.dev` (Astro). Audio stream also hardcodes `reach-radio-web.pages.dev/api/audio-stream`. Domain migration does NOT affect v3.
**v4 iOS (in dev):** Fetches `webUrl` from `/api/native-config` at launch. URL comes from config, no hardcode to change.
**Android (prod `main`):** Same as iOS v3 — WebView hardcodes `reach-radio-web.pages.dev`. Audio stream already points to `https://reach.radio/api/audio-stream` (no Astro dependency on audio). Domain migration does NOT affect prod Android WebView.
**Android (`bridge-testing`):** WebView uses `YOUR_TUNNEL_DOMAIN` placeholder — not shipped, dev-only.

| Task | Status |
|------|--------|
| Set `NEXT_PUBLIC_SITE_URL=https://reach.radio` in Vercel env (fixes `webUrl` in native-config) | 🔲 Not started |
| Migrate `reach.radio` DNS → Vercel | 🔲 Not started |
| Migrate `reachradiotucson.com` DNS → Vercel (fixes second fallback in v4 config chain) | 🔲 Not started |
| iOS v4: replace dev tunnel fallback with `https://reach.radio` (⚠️ blocks App Store) | 🔲 Not started — iOS repo |
| Ship iOS v4 to App Store | 🔲 Not started |
| Android: replace `YOUR_TUNNEL_DOMAIN` → `https://reach.radio` on bridge-testing before Play Store | 🔲 Not started — Android repo |
| Ship Android to Play Store | 🔲 Not started |
| Verify native apps work end-to-end against production | 🔲 Not started |
| Keep Astro (`reach-radio-web.pages.dev`) alive — v3 iOS WebView + audio hardcoded there; Android WebView also hardcoded there | ⚠️ Permanent constraint |

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

- **Keep Astro alive forever** — iOS v3 WebView AND audio stream both hardcode `reach-radio-web.pages.dev`. Android prod WebView also hardcodes `reach-radio-web.pages.dev` (audio is fine — already `reach.radio`). Do NOT shut down Astro without App Store + Play Store updates for both apps.
- **Vercel required for PPR** — Cloudflare Pages does not support `cacheComponents`.
- **Sanity webhook secret** — already set in Vercel env. Do not commit to git.
