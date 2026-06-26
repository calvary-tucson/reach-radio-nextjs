# Native WebView Bridge

> Last updated: 2026-06-25 (sleep timer bridge added)
> Status: Web bridge complete. Native apps load Astro (`reach-radio-web.pages.dev`) — switching to `reach.radio` requires an app store update.

---

## Overview

Both the iOS and Android Reach Radio apps are thin native wrappers around a WebView. The native side handles audio playback and OS-level UI (lock screen controls, notifications, bottom nav, media bar). The web side handles all content and navigation. The bridge is the communication layer between them.

```
┌──────────────────────────────────────────────────────┐
│              Native App (iOS or Android)             │
│                                                      │
│  ┌─────────────────┐   ┌────────────────────────┐   │
│  │  Native Audio   │   │       WebView           │   │
│  │  AVPlayer (iOS) │   │  reach.radio (Next.js)  │   │
│  │  ExoPlayer (And)│   │                         │   │
│  └────────┬────────┘   └───────────┬─────────────┘   │
│           │                        │                  │
│           │      Bridge Layer       │                  │
│           └──────────┬─────────────┘                  │
│                      │                                │
│  ┌───────────────────▼──────────────────────────┐    │
│  │  Native UI: MediaBar · BottomNav · Splash    │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Web → Native**: web posts JSON via `postMessageToNative()`. Native reads fields and updates audio state, Now Playing metadata, UI chrome visibility.

**Native → Web**: native calls JavaScript directly on the WebView via `evaluateJavaScript()`. It dispatches a `CustomEvent('nativeCommand')` that `BridgeInit.tsx` handles.

---

## Message Protocol at a Glance

### Web → Native (JSON fields)

Every message is a JSON object with `"protocolVersion": 1` plus any of these fields. Multiple fields can appear in one message.

| Field | Type | Sent when | Native action |
|---|---|---|---|
| `loaded` | `true` | After first hydration | Dismiss splash / skeleton |
| `streamUrl` | string | With `loaded` | Override hardcoded audio stream URL |
| `location` | string | Every route change | Update active nav tab |
| `showMediaBar` | boolean | Route change, keyboard focus | Show/hide native media bar |
| `showMobileNav` | boolean | Route change, keyboard focus | Show/hide native bottom nav |
| `isPlaying` | boolean | Play state change | Sync play button |
| `isBuffering` | boolean | Buffering state change | Show/hide loading indicator |
| `title` | string | Track metadata change | Lock screen / CarPlay title |
| `artist` | string | Track metadata change | Lock screen / CarPlay artist |
| `image` | string | Track metadata change | Lock screen / CarPlay artwork |
| `offline` | boolean | Network change | Show/hide offline banner |
| `sleepTimer` | `{ active, paused, remainingSeconds, endsAt }` | Timer start/pause/resume/cancel + structural state changes | Update native sleep timer HUD; `endsAt` is ISO 8601 string or `null`; sent on structural changes only, not per countdown tick |

Example message:
```json
{
  "protocolVersion": 1,
  "isPlaying": true,
  "title": "Morning Devotional",
  "artist": "Alistair Begg",
  "image": "https://cdn.sanity.io/..."
}
```

### Native → Web (JavaScript calls via evaluateJavaScript)

Native dispatches a `CustomEvent('nativeCommand')` into the WebView. `BridgeInit.tsx` listens for this event and handles it.

```js
// iOS/Android dispatch pattern
window.dispatchEvent(new CustomEvent('nativeCommand', {
  detail: { type: 'navigate', path: '/teachers' }
}))
```

| `detail.type` | Payload | Web action |
|---|---|---|
| `navigate` | `{ path: string }` | `router.push(path)` |
| `refresh` | — | `router.refresh()` |
| `setPlayState` | `{ playing: boolean }` | Updates media store |
| `setBuffering` | `{ buffering: boolean }` | Updates media store |
| `prefetchRoutes` | `{ paths: string[] }` | `router.prefetch()` each path |
| `startSleepTimer` | `{ seconds: number }` | Starts countdown; `seconds` must be a finite non-negative number — invalid values are silently dropped |
| `setSleepTimer` | `{ seconds: number }` | Adjusts active/paused timer duration; same validation as `startSleepTimer` |
| `pauseSleepTimer` | — | Pauses countdown; clears `endsAt` in store |
| `resumeSleepTimer` | — | Resumes from `remainingSeconds`; recalculates `endsAt = now + remainingSeconds` |
| `cancelSleepTimer` | — | Cancels and resets all timer state |

**Android additionally** calls these global functions directly (registered in `BridgeInit.tsx`):

```ts
window.globalActions.goToPage('/path')   // native nav tabs
window.globalActions.goBack()            // hardware back button
window.globalState.mediaBarState.isPlaying.set(boolean)    // push play state
window.globalState.mediaBarState.isBuffering.set(boolean)  // push buffering state
window.globalState.mediaBarState.isMuted.set(boolean)
```

**Both platforms** call these Unpoly compatibility shims (registered in `BridgeInit.tsx`):

```ts
up.history.location   // getter → current pathname
up.reload()           // triggers router.refresh()
```

---

## How It Works

### 1. Startup Sequence

```
App launches
  → native sends HTTP header: mobile-app: true
  → Next.js middleware sets cookie: mobile-app=true (1 year)
  → layout.tsx reads header+cookie → sets isMobileApp=true
  → server renders WITHOUT AudioProvider, Header, Footer, MobileNav
  → server renders WITH MediaBar (metadata relay to native)
  → React hydrates → BridgeInit.tsx mounts
  → BridgeInit posts { loaded: true, streamUrl } → native dismisses splash
  → SSE polling starts (useNowPlaying) → populates Zustand store
  → BridgeInit watches store → posts { title, artist, image } to native
```

**iOS**: splash dismisses on 2-second timer (not message-driven).  
**Android**: splash dismisses when `{ loaded: true }` is received.

### 2. Track Metadata Flow

Understanding this flow prevents a common bug (see Pitfalls):

```
/api/stream-info-sse
  polls radiojar JSONP every 30s
  ↓
useNowPlaying hook  ← runs in ALL contexts, including native WebView
  resolves artist name → teacher photo from /api/teachers-list
  ↓
Zustand media store  (title, artist, image)
  ↓
BridgeInit useEffect  ← watches store, fires on every change
  ↓
postMessageToNative({ title, artist, image })
  ↓
native: lock screen · CarPlay · media bar
```

`BridgeInit` is a **pure store relay** — it does not fetch metadata independently. The SSE must run to populate the store.

### 3. Native App Detection

Two layers, both checked:

**Server-side** (in `src/app/layout.tsx`):
```ts
const isMobileApp =
  headersList.get('mobile-app') === 'true' ||           // HTTP header (both platforms, every request)
  cookieHeader.split(';').some(c => c.trim() === 'mobile-app=true')  // cookie (persists via middleware)
```

When `isMobileApp` is true, the layout omits: `AudioProvider`, `SleepTimerProvider`, `Header`, `MobileHeader`, `Footer`, `MobileNav`. It keeps `MediaBar` (the metadata relay).

**Client-side** (`BridgeInit.tsx`):
```ts
function isNativeBridgePresent(): boolean {
  return !!(
    window.Android?.postMessage ||                                 // Android JavascriptInterface
    window.webkit?.messageHandlers?.messageHandler?.postMessage || // iOS WKScriptMessageHandler
    window.inNativeApp                                             // iOS WKUserScript flag
  )
}
```

On mount, if bridge objects are detected → sets `mobile-app=true` cookie (fallback for deep links that skip the initial header). If bridge objects are absent but cookie exists → clears the stale cookie.

### 4. How Messages Are Sent

```ts
// src/lib/bridge/post-message.ts
export function postMessageToNative(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const message = JSON.stringify({ protocolVersion: 1, ...payload })
  if (window.Android?.postMessage) {
    window.Android.postMessage(message)       // Android JavascriptInterface
  } else if (window.webkit?.messageHandlers?.messageHandler?.postMessage) {
    window.webkit.messageHandlers.messageHandler.postMessage(message)  // iOS WKWebView
  }
}
```

iOS WKWebView: messages go to `messageHandlers.messageHandler` — the handler name is `messageHandler`, not `nativeBridge`. If iOS registers under a different name, no messages will be received.

---

## Platform Reference

### iOS (WKWebView / SwiftUI)

| Item | Value |
|---|---|
| WebView URL | `https://reach-radio-web.pages.dev/` (hardcoded — Astro) |
| Audio stream | `https://reach-radio-web.pages.dev/api/audio-stream` (hardcoded) |
| Splash dismiss | 2-second timer (not message-driven) |
| Skeleton dismiss | `webView:didFinishNavigation` |
| Pull-to-refresh | `up.reload()` via evaluateJavaScript |
| Path tracking | Reads `up.history.location` in `didFinishNavigation`; also from `location` messages |
| External domains | `forms.ministryforms.net`, `login.ministryid.com` stay in WebView |
| Debug | `webView.isInspectable = true` — Safari DevTools connects in debug builds |

**Handles these web → native messages**:
- `isPlaying` → AudioStreamingManager play/stop
- `title`, `artist`, `image` → NowPlayingInfoCenter (lock screen / CarPlay)
- `location` → active tab highlight
- `showMediaBar` / `showMobileNav` → native chrome visibility

**Does NOT** call `window.globalState.*.set()` — iOS manages audio independently and does not push play state back to the web. This means the web play button won't reflect lock screen controls.

**Native → Web**: dispatches `CustomEvent('nativeCommand')` via `evaluateJavaScript`.

---

### Android (WebView / Jetpack Compose)

| Item | Value |
|---|---|
| WebView URL | `https://reach-radio-web.pages.dev/` (hardcoded — Astro) |
| JavaScript interface | `window.Android.postMessage(msg)` → `WebAppInterface` → `MainViewModel` |
| Splash dismiss | On `{ loaded: true }` message |
| Skeleton dismiss | `onPageFinished` AND `{ loaded: true }` |
| Pull-to-refresh | SwipeRefreshLayout → `up.reload()` |
| Path tracking | Reads `up.history.location` in `onPageFinished`; also from `location` messages |
| Back navigation | `webView.goBack()` first, then `window.globalActions.goBack()` |
| External domains | `forms.ministryforms.net`, `login.ministryid.com` stay in WebView |

**Handles these web → native messages**:
- `loaded` → dismiss splash + skeleton (critical — without this, splash never goes away)
- `isPlaying` → audio play/pause (with `ignoreWebViewPlayState` race guard)
- `isBuffering` → buffering indicator
- `title`, `artist`, `image` → media bar + notification metadata
- `location` → active tab highlight
- `showMediaBar` / `showMobileNav` → native chrome visibility
- `offline` → received but currently ignored

**Does** push state back to web via `window.globalState.mediaBarState.isPlaying.set()` and `.isBuffering.set()` — so web play button stays in sync with native audio.

**Native → Web**: dispatches `CustomEvent('nativeCommand')` and also calls `window.globalActions.*` directly.

---

## Current Deployment State

| | Web browser users | Native app users |
|---|---|---|
| Site loaded from | `reach.radio` (Vercel) | `reach-radio-web.pages.dev` (Astro) |
| Audio stream | `reach.radio/api/audio-stream` | `reach-radio-web.pages.dev/api/audio-stream` |
| Bridge | ✅ Working | ✅ Working (on Astro) |
| Native tabs switch to Next.js | — | ❌ Blocked (hardcoded domain allowlist) |

**Why native apps can't switch without an app update**: both apps hardcode the domain allowlist. Any WebView navigation to a non-allowed domain opens in the system browser. A Cloudflare redirect won't help — the redirect target fails the allowlist check too.

**Keep `reach-radio-web.pages.dev` (Astro) alive indefinitely.** It is free on Cloudflare Pages, and current native users depend on it for the WebView URL and the iOS audio stream proxy.

---

## Sleep Timer Bridge

The sleep timer runs entirely on the web side. Native receives state updates and can send commands to control it.

### Web → Native: `sleepTimer` message

Sent whenever `sleepTimerActive`, `sleepTimerPaused`, or `sleepTimerEndsAt` changes in the Zustand store — on structural transitions only, never per countdown tick.

```json
{
  "protocolVersion": 1,
  "sleepTimer": {
    "active": true,
    "paused": false,
    "remainingSeconds": 1740,
    "endsAt": "2026-06-25T03:15:00.000Z"
  }
}
```

| Field | Type | Meaning |
|---|---|---|
| `active` | boolean | Timer is running or paused |
| `paused` | boolean | Timer is paused (countdown frozen) |
| `remainingSeconds` | number | Seconds left (last known value; not live-updated per tick) |
| `endsAt` | string \| null | ISO 8601 UTC; null when paused or inactive |

### State Machine

```
idle ──startSleepTimer(s)──→ active  (endsAt = now+s)
active ──pauseSleepTimer──→ paused  (endsAt = null, remainingSeconds preserved)
paused ──resumeSleepTimer──→ active  (endsAt = now+remainingSeconds)
active ──setSleepTimer(s)──→ active  (endsAt = now+s)
paused ──setSleepTimer(s)──→ paused  (remainingSeconds = s, endsAt stays null)
active/paused ──cancelSleepTimer──→ idle
active ──countdown hits 0──→ idle + isPlaying: false sent to native
```

### Pitfall: `remainingSeconds` is not live

The `sleepTimer` message is sent on state transitions, not per tick. If native needs a live countdown, calculate from `endsAt` using the device clock. If the timer is paused, `endsAt` is null — use `remainingSeconds` directly.

---

## Pitfalls

### Do not skip SSE in native WebViews

```ts
// WRONG — this was commit 313e46a, fixed 2026-06-25
if (isNativeApp()) return  // ← starves the Zustand store
```

`BridgeInit` reads `title/artist/image` from the Zustand store and relays them to native. If SSE doesn't run, the store stays empty and native gets blank metadata. SSE (`useNowPlaying`) must run in all contexts.

### Handler name must match exactly

Web sends to `messageHandlers.messageHandler`. If iOS registers its `WKScriptMessageHandler` under any other name (e.g. `nativeBridge`), no messages will be received — silently. Confirm both sides agree on the name.

### `loaded: true` is critical for Android

Android splash never dismisses without this message. It is sent once, on `BridgeInit` mount (after hydration). Pull-to-refresh naturally re-sends it because `up.reload()` → full page reload → `BridgeInit` mounts again.

### `window.globalActions.*` / `window.globalState.*` still exist

These are registered in `BridgeInit.tsx` and must remain for Android backward compatibility. Do not remove them.

### `window.addEventListener('message', ...)` in BridgeInit is dead code

Neither platform sends messages via `window.postMessage`. Android and iOS both use `evaluateJavaScript()` for native → web communication. The listener is harmless but never fires for bridge traffic.

---

## Migration: Moving Native Apps to reach.radio

This requires an app store update. The web is already ready.

### Android changes (`MainActivity.kt`)

```kotlin
// Expand domain allowlist
private val allowedWebViewDomains = setOf(
    "reach-radio-web.pages.dev",  // keep during transition
    "reach.radio",
    "reachradiotucson.com",
)
// In shouldOverrideUrlLoading:
if (allowedWebViewDomains.contains(host) || allowedExternalDomains.contains(host)) {
    return false  // allow in WebView
}

// Change initial URL
createdWebView.loadUrl("https://reach.radio/", headers)
```

### iOS changes (`ContentView.swift`)

```swift
static let initialURL = URL(string: "https://reach.radio/")!
// Also update audio stream URL, or start reading streamUrl from the bridge message
```

### Post-switch checklist

- [ ] Android splash dismisses on cold open
- [ ] Android skeleton hides after load
- [ ] Pull-to-refresh works, no splash re-show
- [ ] Android hardware back button works
- [ ] Native bottom nav tabs navigate correctly
- [ ] Native media bar shows on non-home routes, hides on `/`
- [ ] Play/pause from web updates native media bar
- [ ] Play/pause from native media bar updates web UI (Android)
- [ ] Title / artist / image appear in native media bar
- [ ] Title / artist / image appear on iOS lock screen and CarPlay
- [ ] Input focus hides native nav, blur restores it
- [ ] External links open in system browser
- [ ] `forms.ministryforms.net` and `login.ministryid.com` stay in WebView
- [ ] iOS native audio stream plays
- [ ] Android notification shows + play/pause works
- [ ] Regular browser: nav/header visible, no native chrome

---

## Future Architecture (Next Native App Rebuild)

Current native apps hardcode three values: the WebView URL, the audio stream URL, and the domain allowlist. Any change to these requires an app store update. The goal in a rebuild is to eliminate all hardcoding.

### Dynamic Config: `/api/native-config`

The endpoint already exists. Rebuilt apps fetch it at every launch:

```
GET https://reach.radio/api/native-config
```

```json
{
  "protocolVersion": 1,
  "webUrl": "https://reach.radio",
  "streamUrl": "https://reach.radio/api/audio-stream",
  "minAppVersion": { "ios": "2.0.0", "android": "2.0.0" }
}
```

- `webUrl` → load in WebView; derive domain allowlist from it (no hardcoding)
- `streamUrl` → audio engine URL; cache in UserDefaults / SharedPreferences
- `minAppVersion` → force upgrade gate without a new app release

Fallback: if all fetch attempts fail, use last cached value. Hard fallback only if never fetched.

### Audio Stream URL via Bridge

The web already sends `streamUrl` in the `loaded` message. Rebuilt apps read it and update the audio engine dynamically. Cache the last known value so audio works before WebView loads.

```swift
// iOS — persist last known URL
UserDefaults.standard.set(streamUrl, forKey: "streamUrl")
private var streamURL: String = UserDefaults.standard.string(forKey: "streamUrl")
    ?? "https://reach.radio/api/audio-stream"
```

### Summary: hardcoding eliminated

| Value | Current | Rebuilt |
|---|---|---|
| WebView URL | Hardcoded Swift/Kotlin constant | From `/api/native-config`, cached |
| Audio stream URL | Hardcoded Swift/Kotlin constant | From bridge `streamUrl` message, cached |
| Domain allowlist | Hardcoded constant | Derived from `webUrl` at runtime |
| Forced upgrade | Not possible | `minAppVersion` in native-config |

---

## Production Readiness Checklist

### Group 1 — Web/Server Changes ✅ All Complete

| # | Item | File | Status |
|---|---|---|---|
| 1 | Fix audio stream proxy — `AbortController` + `clearTimeout` after connect | `src/app/api/audio-stream/route.ts` | ✅ |
| 2 | Middleware to persist `mobile-app` cookie from request header | `src/middleware.ts` | ✅ |
| 3 | `BridgeInit`: send `{ loaded: true, streamUrl }` on mount | `src/components/bridge/BridgeInit.tsx` | ✅ |
| 4 | `BridgeInit`: send `{ showMediaBar }` on route change | `src/components/bridge/BridgeInit.tsx` | ✅ |
| 5 | `BridgeInit`: `focusin`/`focusout` → `showMobileNav`/`showMediaBar` | `src/components/bridge/BridgeInit.tsx` | ✅ |
| 6 | `BridgeInit`: bridge object detection on mount (set/clear cookie) | `src/components/bridge/BridgeInit.tsx` | ✅ |
| 7 | `post-message.ts`: wrap all messages with `protocolVersion: 1` | `src/lib/bridge/post-message.ts` | ✅ |
| 8 | Add `/api/native-config` endpoint | `src/app/api/native-config/route.ts` | ✅ |
| 9 | `useNowPlaying`: SSE runs in native WebView (do not skip) | `src/hooks/useNowPlaying.ts` | ✅ |

### Group 2 — Device Testing (Before Domain Switch)

Test in debug mode. Android: `chrome://inspect`. iOS: Safari DevTools (already inspectable in debug builds).

| # | Scenario | Platform | Expected |
|---|---|---|---|
| 1 | Cold open — splash dismisses | Android | `loaded: true` received |
| 2 | Cold open — skeleton hides | Android | `loaded: true` → `isWebViewLoading = false` |
| 3 | Cold open — splash dismisses | iOS | 2s timer fires |
| 4 | Pull-to-refresh | Both | Page reloads, `loaded: true` re-sent, splash doesn't re-show |
| 5 | Native bottom nav → page changes | Both | `goToPage()` / `nativeCommand:navigate` |
| 6 | Media bar shows on non-home route | Both | `showMediaBar: true` |
| 7 | Media bar hides on `/` | Both | `showMediaBar: false` |
| 8 | Input focus → native nav hides | Both | `showMobileNav: false` |
| 9 | Input blur → native nav restores | Both | `showMobileNav: true` |
| 10 | Play from web → native media bar updates | Both | `isPlaying: true`, metadata sent |
| 11 | Title / artist appear in native media bar | Both | SSE → Zustand → BridgeInit → native |
| 12 | Play from native media bar → web UI updates | Android | `globalState.isPlaying.set(true)` |
| 13 | Play from lock screen → web UI updates | iOS | **Known gap** — iOS doesn't push play state back |
| 14 | Android hardware back | Android | `globalActions.goBack()` |
| 15 | External link opens in browser | Both | `shouldOverrideUrlLoading` / `decidePolicyFor` |
| 16 | `forms.ministryforms.net` stays in WebView | Both | Allowlist passes it |
| 17 | `login.ministryid.com` stays in WebView | Both | Allowlist passes it |
| 18 | iOS audio stream plays | iOS | AVPlayer hits audio-stream proxy |
| 19 | iOS lock screen / CarPlay metadata | iOS | `title`, `artist`, `image` → NowPlayingInfoCenter |
| 20 | Android notification + play/pause | Android | Media notification reflects state |
| 21 | `isMobileApp=true` → web chrome hidden | Both | Server layout check via header + cookie |
| 22 | Regular browser — web chrome visible | Web | No bridge objects → BridgeInit clears stale cookie |

### Group 3 — Web Launch (Vercel + Cloudflare DNS)

This is independent of native apps. Native users stay on Astro during the web launch.

- [ ] Next.js production deployment passing on Vercel
- [ ] `reach.radio` CNAME → Vercel ingress in Cloudflare DNS
- [ ] `reachradiotucson.com` CNAME → Vercel ingress (or redirect to `reach.radio`)
- [ ] Vercel domain verified, TLS provisioned
- [ ] Sanity CORS origins include `reach.radio` and `reachradiotucson.com`
- [ ] Vercel environment variables set (Sanity project ID, dataset, tokens, etc.)
- [ ] `reach.radio` works in web browser: nav, audio, all pages
- [ ] `isMobileApp` is false in web browser
- [ ] `reach-radio-web.pages.dev` (Astro) still live — do NOT take it down

### Group 4 — Native App Migration (App Store Update Required)

Submit updated native builds with domain allowlist and URL changes described in [Migration: Moving Native Apps to reach.radio](#migration-moving-native-apps-to-reachradio).

After app update ships:
- [ ] Android: cold open loads `reach.radio` in WebView
- [ ] iOS: cold open loads `reach.radio` in WebView
- [ ] Android splash dismisses
- [ ] iOS splash dismisses
- [ ] Audio plays on both platforms
- [ ] Navigation works from all native tabs
- [ ] External links open in system browser
- [ ] `mobile-app` header arrives at Vercel
- [ ] iOS audio stream works (update `AudioPlayer.swift` stream URL, or rely on `streamUrl` bridge message)
