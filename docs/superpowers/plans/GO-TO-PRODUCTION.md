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

**Plan:** `docs/superpowers/plans/2026-05-29-native-webview-bridge-fixes.md`

All changes are in `reach-radio-nextjs`. No native app updates needed for these.

| Task | File | Status |
|------|------|--------|
| T1: Fix audio stream 10s timeout | `src/app/api/audio-stream/route.ts` | ✅ Done |
| T2: Add middleware for native detection | `src/middleware.ts` | 🔲 Not started |
| T3: Fix BridgeInit gaps (loaded, showMediaBar, focus/blur, streamUrl) | `src/components/bridge/BridgeInit.tsx` | ✅ Done |
| T4: Add protocolVersion to all bridge messages | `src/lib/bridge/post-message.ts` | ✅ Done |
| T5: Add /api/native-config endpoint | `src/app/api/native-config/route.ts` | ✅ Done |
| T6: Manual verification in native apps (pre-switch checklist) | — | 🔲 Not started |

**Only blocker remaining: T2 (middleware)**

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

| Task | Status |
|------|--------|
| Update `native-config` `webUrl` from `reach-radio-web.pages.dev` → `reach.radio` | 🔲 Not started |
| Switch iOS WebView URL to `reach.radio` | 🔲 Not started |
| Switch Android WebView URL to `reach.radio` | 🔲 Not started |
| Verify native apps work end-to-end against production | 🔲 Not started |
| Keep Astro (`reach-radio-web.pages.dev`) alive — iOS audio stream hardcoded there | ⚠️ Permanent constraint |

---

## Deferred — Native App Updates (non-blocking, batch into next release)

These require App Store / Play Store submissions. Not blocking the URL switch.

**Plan:** See "Native App Issues" section in `docs/superpowers/plans/2026-05-29-native-webview-bridge-fixes.md`

| Issue | Platform | Severity |
|-------|----------|---------|
| iOS-1: `scheduleBufferingEnd()` guard bug | iOS | Medium |
| iOS-2: `handleRefresh` retain cycle | iOS | Low |
| iOS-3: Replace 2s splash timer with `loaded` message | iOS | Medium |
| iOS-4: Consume `streamUrl` from bridge | iOS | Low |
| Android-1: IIFE guard on `up.history.location` | Android | High |
| Android-2: Remove `isPlaying=false` from `isBuffering` | Android | High |
| Android-3: Back button exit at SPA root | Android | Medium |
| Android-4: JSON-encode path in `goToPage` | Android | Low |

---

## Key Constraints (never forget)

- **Keep Astro alive forever** — iOS native audio stream is hardcoded to `reach-radio-web.pages.dev/api/audio-stream`. Do NOT shut it down without an iOS app update.
- **Vercel required for PPR** — Cloudflare Pages does not support `cacheComponents`.
- **Sanity webhook secret** — already set in Vercel env. Do not commit to git.
