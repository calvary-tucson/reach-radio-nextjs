# Native WebView Bridge — Architecture & Migration Plan

> Last updated: 2026-05-29
> Status: Both native apps load Astro (`reach-radio-web.pages.dev`). Next.js bridge layer built but not yet live in production.

---

## Architecture Overview

Both the iOS (Swift/WKWebView) and Android (Kotlin/WebView) apps are thin native wrappers around the web UI. They provide:

- Background audio playback (AVPlayer on iOS, ExoPlayer/Media3 on Android)
- Lock screen / notification controls
- Native bottom navigation bar (4 tabs: Listen / About / Donate / Teachers)
- Native media bar (album art, title, artist, play/pause)
- Pull-to-refresh
- External link interception (opens browser for non-app domains)

```
┌──────────────────────────────────────────────────────┐
│              Native App (iOS or Android)             │
│                                                      │
│  ┌──────────────┐  ┌───────────────────────────────┐ │
│  │ Native Audio │  │         WebView               │ │
│  │ (AVPlayer /  │  │  loads reach-radio-web or     │ │
│  │  ExoPlayer)  │  │  reach-radio-nextjs            │ │
│  └──────┬───────┘  └──────────────┬────────────────┘ │
│         │                         │                  │
│         │    ┌────────────────────▼──────────────┐   │
│         │    │   Bridge Layer                    │   │
│         │    │   iOS: ContentView + Coordinator  │   │
│         └────┤   Android: MainViewModel          │   │
│              └───────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ Native UI                                    │    │
│  │ MediaBar · BottomNav · Splash · Skeleton     │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

---

## Message Protocol

All messages are JSON strings. Two directions:

### Web → Native

| Message field     | Type    | Sender (Next.js)                          | Description                                  |
|-------------------|---------|-------------------------------------------|----------------------------------------------|
| `isPlaying`       | boolean | `MediaBar` useEffect, `RadioPlayer`        | Play/pause state                             |
| `title`           | string  | `MediaBar` useEffect                      | Current track title                          |
| `artist`          | string  | `MediaBar` useEffect                      | Current artist                               |
| `image`           | string  | `MediaBar` useEffect                      | Album art URL                                |
| `showMediaBar`    | boolean | `proxy.toggleMediaBar()`                  | Show/hide native media bar                   |
| `location`        | string  | `BridgeInit` on pathname change           | Current path (e.g. `/teachers`)              |
| `offline`         | boolean | `BridgeInit` online/offline events        | Network connectivity                         |
| `loaded`          | boolean | ❌ MISSING in Next.js                     | Page finished loading (Android splash/skeleton trigger) |
| `loading`         | boolean | ❌ MISSING in Next.js                     | Page started loading                         |
| `showMobileNav`   | boolean | ❌ MISSING in Next.js                     | Show/hide native nav on input focus/blur     |

#### How messages are sent (Next.js)

```ts
// src/lib/bridge/post-message.ts
export function postMessageToNative(message: string): void {
  if (window.Android?.postMessage) {
    window.Android.postMessage(message)       // Android JavascriptInterface
  } else if (window.webkit?.messageHandlers?.messageHandler?.postMessage) {
    window.webkit.messageHandlers.messageHandler.postMessage(message)  // iOS WKWebView
  }
}
```

#### How messages are sent (Astro — reference)

Astro also tried `window.ReactNativeWebView?.postMessage` first, but iOS only sets `ReactNativeWebView = true` (a boolean), so `?.postMessage` was always undefined. Effectively the same flow — Android first, then webkit.

---

### Native → Web

| JS call                                               | Platform | Purpose                          |
|-------------------------------------------------------|----------|----------------------------------|
| `window.globalState.mediaBarState.isPlaying.set(v)`  | Android  | Push play state from native      |
| `window.globalState.mediaBarState.isBuffering.set(v)`| Android  | Push buffering state             |
| `window.globalActions.goToPage('/path')`             | Both     | Native nav tab tapped            |
| `window.globalActions.goBack()`                      | Android  | Android back button              |
| `up.history.location`                                | Both     | Read current path (compat shim)  |
| `up.reload()`                                        | Both     | Pull-to-refresh (compat shim)    |

All of these work correctly in Next.js via `src/lib/bridge/proxy.ts` and `src/lib/bridge/compat.ts`.

---

## Native App Detection

### Android
Sends HTTP header `mobile-app: true` on every page load.

`window.Android` JavascriptInterface is registered via `addJavascriptInterface()` **before** `loadUrl()` is called in `MainActivity.kt`. This means `window.Android` is available before any JS runs — no async injection, no race condition.

### iOS
1. HTTP header `mobile-app: true` on initial request (in `URLRequest`)
2. Injects `window.ReactNativeWebView = true` and `window.inNativeApp = true` via WKUserScript at `.atDocumentEnd` (boolean flags, not functional interfaces)
3. `window.webkit.messageHandlers.messageHandler` is registered via `userContentController.add()` before the WKWebView is created — available before any JS runs

`.atDocumentEnd` fires after the HTML body is parsed but before subresources load, well before React hydration. All three iOS signals are available at React `useEffect` mount time.

### Next.js (server-side)

Two-layer detection — both must be checked:

```ts
// src/app/layout.tsx
const isMobileApp =
  headersList.get('mobile-app') === 'true' ||           // layer 1: request header
  cookieHeader.split(';').some(c => c.trim() === 'mobile-app=true')  // layer 2: cookie
```

Layer 1 (header) is set by both platforms on every request. Layer 2 (cookie) is set by middleware when the header is present, persisting native mode across RSC navigations and deep links that may not re-send the header.

When `isMobileApp`:
- `AudioProvider` NOT rendered (native handles audio)
- `SleepTimerProvider` NOT rendered
- `Header`, `MobileHeader`, `Footer`, `MobileNav` NOT rendered
- `MediaBar` IS rendered (acts as metadata relay, sends postMessage)

### Next.js (client-side, BridgeInit)

`BridgeInit.tsx` runs a secondary detection on mount as a fallback for cases where the server-side header was absent (e.g., deep link skips the initial request):

```ts
function isNativeBridgePresent(): boolean {
  return !!(
    window.Android?.postMessage ||                                    // Android JavascriptInterface
    window.webkit?.messageHandlers?.messageHandler?.postMessage ||    // iOS WKScriptMessageHandler
    window.inNativeApp                                                // iOS WKUserScript flag
  )
}
```

- **If bridge objects detected on mount**: sets `mobile-app=true` cookie (non-httpOnly, 1 year)
- **If bridge objects absent but cookie present**: clears the cookie — auto-heals stale cookies from the old detection logic

A `window.addEventListener('message', ...)` fallback also exists but **is dead code** — neither platform sends messages via `window.postMessage`. Android → Web uses `evaluateJavascript()` (globalState/globalActions); iOS → Web uses `evaluateJavaScript()`. The `window.message` event never fires for bridge traffic. The listener is harmless and provides a last-resort safety net if the protocol ever adds bidirectional `postMessage`.

---

## Platform-Specific Behavior

### iOS (WKWebView / SwiftUI)

- **URL**: `https://reach-radio-web.pages.dev/` (hardcoded — Astro version)
- **Audio stream**: `https://reach-radio-web.pages.dev/api/audio-stream` (hardcoded)
- **Splash**: 2-second timed delay, not message-driven
- **Skeleton**: shown while `isLoading = true`, cleared on `webView:didFinishNavigation`
- **Pull-to-refresh**: `up.reload()` via evaluateJavaScript
- **Path tracking**: reads `up.history.location` in `didFinishNavigation`; also updates from `{ location: ... }` messages
- **Allowed external domains**: `forms.ministryforms.net`, `login.ministryid.com`
- **Inspectable**: `webView.isInspectable = true` (Safari DevTools can connect in debug builds)

**Messages iOS handles**:
- `isPlaying` → AudioStreamingManager play/stop
- `title`, `artist`, `image` → Now Playing Info Center
- `location` → currentPath (active tab highlight)
- `showMediaBar` → native media bar visible/hidden
- `showMobileNav` → native nav bar visible/hidden

**iOS does NOT call `globalState.*.set()`** — it manages audio independently via AVPlayer and doesn't push state back to the web.

### Android (WebView / Jetpack Compose)

- **URL**: `https://reach-radio-web.pages.dev/` (hardcoded — Astro version)
- **JavaScript interface**: `window.Android.postMessage(msg)` → `WebAppInterface.postMessage()` → `MainViewModel.processWebViewMessage()`
- **Splash**: shown until first `{ loaded: true }` message received
- **Skeleton**: shown while `isWebViewLoading = true`, cleared on `onPageFinished` AND on `{ loaded: true }` message
- **Pull-to-refresh**: SwipeRefreshLayout → `up.reload()`
- **Path tracking**: reads `up.history.location` in `onPageFinished`; also from `{ location: ... }` messages
- **Back navigation**: tries `webView.goBack()` first, then `window.globalActions.goBack()`
- **Allowed external domains**: `forms.ministryforms.net`, `login.ministryid.com`

**Messages Android handles**:
- `loaded` → dismiss splash + skeleton (critical)
- `loading` → logged only (non-critical)
- `isPlaying` → audio play/pause (with ignoreWebViewPlayState guard)
- `title`, `artist`, `image` → media bar + notification metadata
- `location` → currentPath (active tab highlight)
- `showMediaBar` → native media bar visible/hidden
- `showMobileNav` → native nav bar visible/hidden
- `isBuffering` → buffering indicator in media bar
- `offline` → not handled (received but ignored)

**Android pushes state to web** via:
- `window.globalState.mediaBarState.isPlaying.set(v)`
- `window.globalState.mediaBarState.isBuffering.set(v)`

---

## Compatibility Shims (Next.js compat.ts)

The Astro version used Unpoly for SPA navigation. The native apps call `up.*` APIs directly. Next.js provides shims:

```ts
// src/lib/bridge/compat.ts
window.up = {
  history: {
    get location() { return window.location.pathname }
  },
  reload: () => window.location.reload(),
}
```

This satisfies all native calls to `up.history.location` and `up.reload()`. ✓

---

## Gaps: Next.js vs Astro (Bridge Incompatibilities)

### Gap 1 — `{ loaded: true }` not sent (CRITICAL for Android)

**Astro**: sends `{ loaded: true }` on every Unpoly `up:request:loaded` event  
**Next.js**: nothing sends this

**Impact**: Android splash screen never dismisses. Skeleton stays on screen permanently after switching to Next.js URL.

**Fix** (web-side only):
```ts
// In BridgeInit.tsx, add to the main useEffect:
useEffect(() => {
  postMessageToNative(JSON.stringify({ loaded: true }))
}, []) // fires once after first hydration
```
Also needed after pull-to-refresh (page reload). Since `up.reload()` calls `window.location.reload()`, the page fully reloads and `BridgeInit` will fire again — this naturally re-sends `loaded: true`. ✓

### Gap 2 — `{ loading: true }` not sent (minor)

**Astro**: sends `{ loading: true }` on `up:request:load`  
**Next.js**: nothing sends this

**Impact**: Android logs it but doesn't act on it critically. Low priority.

### Gap 3 — `{ showMediaBar: ... }` not sent on route change

**Astro**: sends `{ showMediaBar: false }` when navigating to `/`, `{ showMediaBar: true }` elsewhere  
**Next.js**: `showMediaBar` only sent via `window.globalActions.toggleMediaBar()` — nothing calls this on route change

**Impact**: After switching to Next.js URL, native media bar won't automatically show/hide when navigating between pages. Users would see native media bar stuck in last state.

**Fix** (web-side only):
```ts
// In BridgeInit.tsx, in the pathname useEffect:
useEffect(() => {
  postMessageToNative(JSON.stringify({ location: pathname }))
  const showBar = pathname !== '/'
  postMessageToNative(JSON.stringify({ showMediaBar: showBar }))
}, [pathname])
```

### Gap 4 — Input focus/blur not suppressing native nav (UX issue)

**Astro**: on input focus → sends `{ showMobileNav: false, showMediaBar: false }` to hide native nav (so keyboard doesn't overlap it). On blur → restores.  
**Next.js**: no equivalent

**Impact**: When user focuses a search field, Android/iOS native nav bar stays visible and may overlap the keyboard.

**Fix** (web-side only, in BridgeInit):
```ts
useEffect(() => {
  function onFocus(e: FocusEvent) {
    if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return
    postMessageToNative(JSON.stringify({ showMobileNav: false, showMediaBar: false }))
  }
  function onBlur(e: FocusEvent) {
    if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return
    postMessageToNative(JSON.stringify({ showMobileNav: true, showMediaBar: pathname !== '/' }))
  }
  document.addEventListener('focusin', onFocus)
  document.addEventListener('focusout', onBlur)
  return () => {
    document.removeEventListener('focusin', onFocus)
    document.removeEventListener('focusout', onBlur)
  }
}, [pathname])
```

### Gap 5 — Audio stream URL hardcoded in both native apps (not a bridge gap, but a config gap)

This is not a bridge protocol problem — it's a config problem. Neither native app queries Sanity or any dynamic source for the stream URL.

**iOS** (`AudioPlayer.swift`):
```swift
private let streamURL = "https://reach-radio-web.pages.dev/api/audio-stream"
```

**Android** (`PlaybackService.kt`):
```kotlin
private var audioStreamUrl = "https://reach-radio-web.pages.dev/api/audio-stream"
```

Both apps hardcode the proxy endpoint at the Astro domain. The proxy itself hardcodes radiojar:

**Next.js** (`/api/audio-stream/route.ts`):
```ts
const STREAM_URL = 'http://stream.radiojar.com/g4d600bv6p5tv'
```

**Astro** (`/api/audio-stream.ts`):
```ts
const response = await fetch('http://stream.radiojar.com/g4d600bv6p5tv')
```

The web app reads the stream URL from Sanity (`appSettingsQuery → radioAudioURL`), but this only affects `AudioProvider` — the browser audio component. Native apps never participate in this flow.

**Current failure scenarios**:

| Change | Browser users | Native users |
|--------|--------------|--------------|
| Sanity `radioAudioURL` updated | ✓ Gets new URL immediately | ✗ Still hits old proxy |
| Radiojar URL changes, proxy updated | ✓ Gets new URL | ✓ Proxy transparently serves new URL |
| Astro domain goes offline | ✓ Unaffected | ✗ Audio dead — no app update possible |

**Current mitigation**: Keep Astro at `reach-radio-web.pages.dev` alive indefinitely (Cloudflare Pages — free tier). Both native apps point there. As long as the proxy server-side URL is kept current, changing the underlying stream requires no app update.

---

## What Works Correctly (No Changes Needed)

| Feature | Status | Notes |
|---------|--------|-------|
| `window.globalActions.goToPage()` | ✓ | Proxy defines it, calls `router.push()` |
| `window.globalActions.goBack()` | ✓ | Calls `window.history.back()` |
| `window.globalState.mediaBarState.isPlaying.set()` | ✓ | Calls Zustand store |
| `window.globalState.mediaBarState.isBuffering.set()` | ✓ | Calls Zustand store |
| `up.history.location` | ✓ | Compat shim returns `window.location.pathname` |
| `up.reload()` | ✓ | Compat shim calls `window.location.reload()` |
| `{ location: ... }` messages | ✓ | BridgeInit sends on pathname change |
| `{ offline: ... }` messages | ✓ | BridgeInit sends on online/offline events |
| `{ isPlaying: ... }` messages | ✓ | RadioPlayer and MediaBar send this |
| `{ title, artist, image }` messages | ✓ | MediaBar useEffect sends these |
| `{ showMediaBar: ... }` via toggleMediaBar | ✓ | Proxy defines it (but not called on route change — see Gap 3) |
| `mobile-app` header detection | ✓ | Server reads header, skips audio/nav in native mode |
| `window.inNativeApp` / `window.ReactNativeWebView` | ✓ | iOS script injects these as detection flags |
| External link interception | ✓ | Native apps handle this in WebView delegates |
| Pull-to-refresh | ✓ | `up.reload()` compat shim works |
| Back navigation | ✓ | `window.globalActions.goBack()` calls `history.back()` |
| Allowed external domains | ✓ | ministryforms.net + ministryid.com pass through |

---

## Deployment Plan

### Web: Vercel + Cloudflare DNS

Next.js deploys to **Vercel**. Two custom domains point to Vercel:

- `reach.radio` — primary domain
- `reachradiotucson.com` — secondary / redirect to primary

DNS is managed through **Cloudflare** (CNAME to Vercel ingress, or Cloudflare proxied). Vercel handles TLS. This is the web-browser launch — independent of the native apps.

### Native Apps: Astro Stays Alive (For Now)

Both native apps are hardcoded to `reach-radio-web.pages.dev` (Astro, on Cloudflare Pages). They cannot be migrated to the Vercel/Next.js URL without a native app update because:

1. **Android `shouldOverrideUrlLoading`** — hardcoded `initialDomain = "reach-radio-web.pages.dev"`. Any other domain opens in the system browser. (See Known Issues #3.)
2. **iOS `decidePolicyFor`** — same problem, rejects non-`reach-radio-web.pages.dev` hosts.
3. A Cloudflare redirect (301 from `reach-radio-web.pages.dev` → `reach.radio`) does NOT help — both platforms call their URL-intercept delegate on the redirect target, which would fail the allowlist check.

**Keep `reach-radio-web.pages.dev` (Astro) alive indefinitely.** It is free on Cloudflare Pages and current native app users depend on it for the WebView URL and the iOS audio stream proxy.

---

## Migration Strategy: Astro → Next.js

### Phase 1 — Web Launch (No App Updates Required) ✅ Complete

All Next.js bridge gaps are fixed. Deploy to Vercel with `reach.radio` and `reachradiotucson.com` domains. Web browser users get Next.js immediately. Native app users remain on Astro.

### Phase 2 — Native App Migration (Requires App Store Update)

To move native apps from Astro to Next.js, a native update must:

**Android (`MainActivity.kt`):**
```kotlin
// Replace hardcoded domain with set that includes reach.radio
private val allowedWebViewDomains = setOf(
    "reach-radio-web.pages.dev",  // keep during transition
    "reach.radio",
    "reachradiotucson.com",
)
// In shouldOverrideUrlLoading:
if (allowedWebViewDomains.contains(host) || allowedExternalDomains.contains(host)) {
    return false
}

// Change load URL:
createdWebView.loadUrl("https://reach.radio/", headers)
```

**iOS (`ContentView.swift`):**
```swift
static let initialURL = URL(string: "https://reach.radio/")!
// Also update AudioPlayer.swift stream URL — or have the bridge deliver it via streamUrl message
```

**iOS audio stream** — currently hardcoded to `reach-radio-web.pages.dev/api/audio-stream`. Options:
- Keep Astro proxy alive and don't change it (simplest, zero risk)
- Update to `reach.radio/api/audio-stream` in the app update
- Read `streamUrl` from the bridge message (web already sends it — future-proofs against stream URL changes)

### Phase 3 — Post-Switch Verification Checklist

Before declaring migration done, verify in native apps:

- [ ] Android splash dismisses (requires `loaded: true` message)
- [ ] Android skeleton hides after load
- [ ] Pull-to-refresh works (page reloads, `loaded: true` sent again)
- [ ] Back button works (Android hardware back → `window.globalActions.goBack()`)
- [ ] Native bottom nav tabs navigate correctly (`window.globalActions.goToPage()`)
- [ ] Native media bar shows/hides on route change
- [ ] Play/pause from native media bar updates web UI
- [ ] Play/pause from web updates native media bar
- [ ] Title/artist/image update in native media bar
- [ ] Input focus hides native nav
- [ ] External links open in browser (ministryforms.net, ministryid.com stay in app)
- [ ] iOS lock screen / Now Playing shows correct metadata
- [ ] Android notification shows correct metadata + play/pause works
- [ ] iOS native audio stream continues working

---

## Known Issues in Native Apps (Not Requiring App Updates)

### Both Platforms

1. **Navigation tab mismatch**: iOS has 5 tabs (Listen / About / Donate / Teachers / spacer); Android has 4 tabs (Listen / About / Donate / Teachers). No user-facing impact since both ultimately call `window.globalActions.goToPage()` with the correct path.

2. **No protocol versioning**: Neither app sends or checks `protocolVersion` in messages. Adding it to Next.js messages is backward-compatible (apps ignore unknown fields). Adding version checking to apps requires an app update.

### Android Only (Requires App Update to Fix)

3. **`shouldOverrideUrlLoading` domain allowlist is hardcoded** — `MainActivity.kt`:
   ```kotlin
   private val initialDomain = "reach-radio-web.pages.dev"
   // ...
   if (host == initialDomain || allowedExternalDomains.contains(host)) {
       return false  // allow in WebView
   } else {
       // open in EXTERNAL BROWSER — this breaks the app
   }
   ```
   If Next.js is deployed to any domain other than `reach-radio-web.pages.dev`, Android opens it in the system browser instead of the WebView. **This is a hard blocker for Migration Options A and B (redirect or new domain).** Option C (deploy Next.js to `reach-radio-web.pages.dev`) avoids this entirely — no domain change, no app update required.

### iOS Only

3. **Audio stream URL hardcoded**: `https://reach-radio-web.pages.dev/api/audio-stream` — if Astro domain goes away, iOS native audio breaks. Keep Astro domain alive.

4. **`globalState.*` not called from iOS**: iOS never calls `window.globalState.mediaBarState.isPlaying.set()`. This means the web UI play button state doesn't update when user presses play on lock screen. (Android does this correctly.)

5. **Splash is time-based (2s), not message-based**: On slow connections, 2 seconds may not be enough. On fast connections, the skeleton shows for 2 seconds even if page loaded in 0.5s. (Android uses the `loaded` message which is accurate.)

### Android Only

6. **`ignoreWebViewPlayState` race condition**: When the native audio is already playing and the WebView loads, a 3-second window ignores web `isPlaying=false` messages. If the web takes >3s to confirm play state, the native UI may flicker.

7. **`onPageFinished` calls `up.history.location`**: This evaluateJavascript call fires on every full-page load (including `up.reload()`). If the compat shim isn't mounted yet (pre-hydration), it returns `null`. The Android code handles this gracefully with a null check.

---

## Bridge Message Reference (Complete Protocol)

### Web → Native JSON Fields

```ts
type NativeBridgeMessage = {
  // Playback
  isPlaying?: boolean
  isBuffering?: boolean
  
  // Metadata
  title?: string
  artist?: string
  image?: string          // URL to album art
  
  // UI State
  showMediaBar?: boolean  // show/hide native media bar
  showMobileNav?: boolean // show/hide native bottom nav
  
  // Navigation
  location?: string       // current pathname e.g. "/teachers"
  
  // Lifecycle
  loaded?: boolean        // page finished loading (Android splash/skeleton)
  loading?: boolean       // page started loading (informational)
  
  // Connectivity
  offline?: boolean       // true=offline, false=back online
}
```

### Native → Web JavaScript API

```ts
// State setters (called by Android)
window.globalState.mediaBarState.isPlaying.set(boolean)
window.globalState.mediaBarState.isBuffering.set(boolean)
window.globalState.mediaBarState.isMuted.set(boolean)
window.globalState.mediaBarState.showMediaBar.set(boolean)

// Navigation actions (called by both)
window.globalActions.goToPage(path: string)  // navigate to route
window.globalActions.goBack()                // history.back()

// Compat APIs (called by both)
up.history.location     // getter → current pathname
up.reload()             // full page reload
```

---

## Audio Stream — Future Architecture (When Redoing Native Apps)

The current architecture has three layers of hardcoding. The goal when rebuilding is to have one source of truth: Sanity. Here are the options in order of preference.

---

### Option A — Bridge message delivers stream URL (Recommended)

**Idea**: Web already fetches stream URL from Sanity on every page load. Just send it to native via the bridge. Native updates its player URL dynamically.

**Web side** — add to bridge message protocol:
```ts
// BridgeInit.tsx — send on mount
postMessageToNative(JSON.stringify({ streamUrl: streamUrl }))
```
`streamUrl` comes from the server-side layout via prop/context, already fetched from Sanity.

**iOS side**:
```swift
// In handleMessage():
if let streamUrl = jsonDict["streamUrl"] as? String {
    self.streamURL = streamUrl
    // If currently playing, restart with new URL
}
```

**Android side**:
```kotlin
// In processWebViewMessage():
if (jsonObject.has("streamUrl")) {
    playbackController.updateStreamUrl(jsonObject.getString("streamUrl"))
}
```

**Why this is best**:
- Zero extra network requests — web already fetched from Sanity
- Stream URL updates the moment user opens the app and WebView loads
- Sanity becomes the single source of truth for ALL clients (browser + native)
- No new API endpoint needed
- Native app still works offline (uses last known URL from memory/UserDefaults)

**Trade-off**: Native app gets the URL only after WebView loads (~1–2s). If the user presses play before WebView finishes loading, use the cached URL from last session.

**Implementation detail — cache it**:
```swift
// iOS: persist last known URL
UserDefaults.standard.set(streamUrl, forKey: "streamUrl")

// On init, load cached URL as default
private var streamURL: String = UserDefaults.standard.string(forKey: "streamUrl")
    ?? "https://stream.radiojar.com/g4d600bv6p5tv"
```

```kotlin
// Android: same pattern with SharedPreferences
```

---

### Option B — Dedicated config endpoint

**Idea**: Add `/api/native-config` to Next.js that returns live config from Sanity. Native apps hit it at launch before starting audio.

```ts
// app/api/native-config/route.ts
export async function GET() {
  const config = await sanityFetch(appSettingsQuery, { id: APP_SETTINGS_ID })
  return Response.json({
    streamUrl: config.radioAudioURL ?? FALLBACK_STREAM_URL,
    // future: featureFlags, minAppVersion, etc.
  })
}
```

Native apps hit this endpoint at startup, parse response, use `streamUrl` for audio.

**Why it's worse than Option A**:
- Extra network round-trip on every launch
- Requires error handling (endpoint down → fallback)
- More code in both native apps
- Option A gets the same result for free via the existing bridge

**When Option B makes sense**: If you ever need config before the WebView loads (e.g., a splash screen that plays audio before showing the web UI).

---

### Option C — Native apps go direct to radiojar (simpler but worse)

**Idea**: Skip the proxy entirely. Hardcode `http://stream.radiojar.com/g4d600bv6p5tv` directly in native apps.

**Why this is worse**:
- If radiojar URL changes, requires app store update — no server-side fix possible
- Loses the ability to swap stream providers without an app update
- Proxy also handles CORS headers that some devices need

**Only justified if**: Radiojar URL is effectively permanent and proxy adds measurable latency (it doesn't — it's a passthrough).

---

### Recommended new bridge message field

Add `streamUrl` to the protocol spec:

```ts
type NativeBridgeMessage = {
  // ... existing fields ...
  streamUrl?: string  // radiojar or replacement stream URL, from Sanity
}
```

**Web sends it once** on initial load (in `BridgeInit` after hydration).  
**Native caches it** in UserDefaults / SharedPreferences.  
**Native uses cached value** if WebView hasn't loaded yet when user taps play.

This eliminates all three hardcoded URL layers with one small change on each side.

---

## WebView URL & Domain Allowlist — Future Architecture (When Redoing Native Apps)

The current apps hardcode the WebView URL and domain allowlist as Kotlin/Swift constants. This is the root cause of the migration being blocked by an app update — changing the domain requires resubmitting to App Store / Play Store.

### The problem

```kotlin
// Android — two hardcoded values that must change together
private val initialDomain = "reach-radio-web.pages.dev"   // WebView loads this
private val allowedExternalDomains = setOf(...)            // allowlist does NOT include initialDomain
// shouldOverrideUrlLoading: host == initialDomain → allow; else → external browser
```

```swift
// iOS — same pattern
static let initialURL = URL(string: "https://reach-radio-web.pages.dev/")!
// decidePolicyFor: url.host != initialDomain → UIApplication.shared.open(url)
```

Changing the domain requires an app store update, review queue, and forces users to update before the migration can complete.

### The fix — bootstrap URL from `/api/native-config`

The `/api/native-config` endpoint already exists and returns `webUrl`. Rebuilt apps should fetch this at launch and use it as the WebView URL. The domain allowlist is then derived from the fetched URL — no hardcoding needed.

**Android (Kotlin):**
```kotlin
// On launch: fetch config, cache it, load WebView with live URL
private suspend fun fetchNativeConfig(): NativeConfig {
    val cached = prefs.getString("webUrl", null)
    return try {
        val response = httpClient.get("https://reach.radio/api/native-config")
        val config = response.body<NativeConfig>()
        prefs.edit().putString("webUrl", config.webUrl).apply()
        config
    } catch (e: Exception) {
        // Offline or endpoint down — use cached value, fall back to hardcoded
        NativeConfig(webUrl = cached ?: "https://reach.radio")
    }
}

// Derive allowlist from webUrl — no hardcoded list
private fun isAllowedInWebView(host: String?, webUrl: String): Boolean {
    val webHost = Uri.parse(webUrl).host ?: return false
    return host == webHost || allowedExternalDomains.contains(host)
}
```

**iOS (Swift):**
```swift
// On launch: fetch config, cache in UserDefaults
func fetchNativeConfig() async -> NativeConfig {
    if let cached = UserDefaults.standard.string(forKey: "webUrl") {
        Task { await refreshNativeConfig() }  // refresh in background
        return NativeConfig(webUrl: cached)
    }
    return await refreshNativeConfig()
}

// decidePolicyFor: derive allowed host from cached webUrl
let webHost = URL(string: webUrl)?.host
if url.host == webHost || allowedExternalDomains.contains(url.host ?? "") {
    decisionHandler(.allow)
} else {
    UIApplication.shared.open(url)
    decisionHandler(.cancel)
}
```

**Why this eliminates the problem:**
- Domain changes on the server → update `webUrl` in Sanity (or hardcode in native-config) → native apps pick it up on next launch, no app update
- `minAppVersion` field in native-config lets you force users to a minimum version without a new release
- Offline: cached value from last successful fetch, hard fallback only if never fetched before

### Recommended new `NativeConfig` schema

```ts
// /api/native-config response
{
  protocolVersion: 1,
  webUrl: "https://reach.radio",          // WebView loads this
  streamUrl: "https://...",               // audio stream (from Sanity)
  minAppVersion: {                        // forced upgrade gate
    ios: "2.0.0",
    android: "2.0.0"
  }
}
```

Native app checks `minAppVersion` on launch. If current version is below minimum, show a forced-upgrade screen before loading the WebView. No app store submission needed to activate the gate — just update the endpoint.

### Summary — All hardcoding eliminated in rebuilt apps

| Value | Current | Rebuilt |
|-------|---------|---------|
| WebView URL | Hardcoded Swift/Kotlin constant | From `/api/native-config` → cached |
| Audio stream URL | Hardcoded Swift/Kotlin constant | From bridge `streamUrl` message → cached |
| Domain allowlist | Hardcoded constant | Derived from `webUrl` at runtime |
| Forced upgrade | Not possible | `minAppVersion` in native-config |
| Protocol version | Not checked | `protocolVersion` in every message |

Any future domain change becomes a server-only config update. Zero app store reviews required.

---

## Server-Side Transitional Changes (Before Rebuilding Native Apps)

These are all web/server changes. Current native apps receive the benefit automatically — no app update needed. They also pre-wire the server so rebuilt native apps just start consuming without coordination.

---

### T1 — Fix audio stream proxy timeout (BUG — affects current native apps)

**File**: `src/app/api/audio-stream/route.ts`

**Problem**: `AbortSignal.timeout(10_000)` cancels the fetch after 10 seconds. This kills the proxied live stream 10 seconds into playback. Astro's proxy has no timeout. Current native apps using this proxy (once URL is switched) would drop audio every 10 seconds.

```ts
// CURRENT — broken for live streams
const upstream = await fetch(STREAM_URL, {
  signal: AbortSignal.timeout(10_000),  // ← kills stream after 10s
})
```

```ts
// FIX — connection timeout only, not total duration
const controller = new AbortController()
const connectTimeout = setTimeout(() => controller.abort(), 10_000)

const upstream = await fetch(STREAM_URL, { signal: controller.signal })
clearTimeout(connectTimeout)  // connected — stop the timeout

if (!upstream.ok || !upstream.body) {
  return new Response('Upstream error', { status: 502 })
}

return new Response(upstream.body, {
  status: 200,
  headers: {
    'Content-Type': 'audio/mpeg',          // explicit — AVPlayer picky about this
    'Cache-Control': 'no-cache, no-store',
    'Transfer-Encoding': 'chunked',
    'Access-Control-Allow-Origin': '*',
    'X-Stream-Source': STREAM_URL,         // debug header — visible in network logs
  },
})
```

**Note**: Cloudflare Pages / serverless platforms may impose their own response duration limits (typically 30s–5min). The proxy approach is fundamentally limited for long-lived streams in serverless. Consider whether native apps should hit radiojar directly after rebuild (they can't change stream URL, but they also won't have the proxy timeout problem). For now the fix above is correct.

---

### T2 — Send `streamUrl` in bridge message now (zero-cost forward compatibility)

**File**: `src/components/bridge/BridgeInit.tsx`  
**File**: `src/app/layout.tsx` (already fetches `streamUrl` from Sanity)

Current native apps ignore unknown fields. No harm. Rebuilt native apps just start reading `streamUrl` without any server change needed.

```ts
// BridgeInit.tsx — pass streamUrl down from layout via context or prop
useEffect(() => {
  initUnpolyShim()
  initBridgeProxy(router)
  postMessageToNative(JSON.stringify({
    loaded: true,
    streamUrl: streamUrl,   // ← add this — layout already has it from Sanity
  }))
  // ... rest of setup
}, [router])
```

`streamUrl` flows: Sanity → `appSettingsQuery` → layout server component → `BridgeInit` prop → `postMessageToNative`. Already the correct shape — just needs threading through.

---

### T3 — Send `protocolVersion` in all outgoing messages

Current apps ignore unknown JSON fields. Future rebuilt apps can check this and gate on it.

```ts
// post-message.ts — wrap all outgoing messages
export function postMessageToNative(message: string): void {
  if (typeof window === 'undefined') return
  try {
    const payload = JSON.parse(message)
    const versioned = JSON.stringify({ protocolVersion: 1, ...payload })
    if (window.Android?.postMessage) {
      window.Android.postMessage(versioned)
    } else if (window.webkit?.messageHandlers?.messageHandler?.postMessage) {
      window.webkit.messageHandlers.messageHandler.postMessage(versioned)
    }
  } catch {
    // fallback: send original if not valid JSON
    if (window.Android?.postMessage) window.Android.postMessage(message)
    else window.webkit?.messageHandlers?.messageHandler?.postMessage(message)
  }
}
```

Rebuilt native apps read `protocolVersion` and can show "please update" if it exceeds what they support.

---

### T4 — Add `/api/native-config` endpoint (ready for rebuilt apps)

No current native app calls this — they can't without an update. Build it now so rebuilt apps have a stable, documented endpoint to bootstrap from.

```ts
// src/app/api/native-config/route.ts
import { sanityFetch } from '@/lib/sanity/client'
import { appSettingsQuery, APP_SETTINGS_ID } from '@/lib/sanity/queries'

const FALLBACK = {
  streamUrl: 'https://stream.radiojar.com/g4d600bv6p5tv',
  webUrl: 'https://reach-radio-web.pages.dev',
  minAppVersion: { ios: '1.0.0', android: '1.0.0' },
}

export async function GET(): Promise<Response> {
  const settings = await sanityFetch<{ radioAudioURL: string }>(
    appSettingsQuery,
    { id: APP_SETTINGS_ID },
    { tags: ['appSettings'] }
  ).catch(() => null)

  return Response.json({
    protocolVersion: 1,
    streamUrl: settings?.radioAudioURL ?? FALLBACK.streamUrl,
    webUrl: FALLBACK.webUrl,
    minAppVersion: FALLBACK.minAppVersion,
  }, {
    headers: { 'Cache-Control': 'public, max-age=300' },  // 5min cache — cheap
  })
}
```

Rebuilt native apps hit this once at launch. Cache-Control means it won't hammer Sanity.

**`minAppVersion`** field: lets you gate old app versions without an emergency app update. If native app version < `minAppVersion`, show a forced upgrade screen. Requires rebuilt apps to check this field and respect it.

---

### T5 — Harden native app detection via middleware

Currently detection relies on the `mobile-app: true` HTTP header being present on the initial request. For Next.js RSC navigation, the layout doesn't re-render — detection at initial SSR is permanent for the session. But if a user somehow lands on the site without the header (e.g., deep link handling is off), the server-side detection fails and `AudioProvider` etc. get rendered.

Add middleware to persist native detection server-side via cookie:

```ts
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // If native app header present, set a long-lived cookie
  if (request.headers.get('mobile-app') === 'true') {
    response.cookies.set('mobile-app', 'true', {
      maxAge: 60 * 60 * 24 * 365,  // 1 year
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    })
  }
  
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

Then in `layout.tsx`, check both header AND cookie:
```ts
const isMobileApp =
  headersList.get('mobile-app') === 'true' ||
  headersList.get('cookie')?.includes('mobile-app=true')
```

This makes detection robust across deep links, refresh cycles, and any navigation pattern.

---

### Summary — What each change does for current vs future native apps

| Change | Current apps (no update) | Rebuilt apps |
|--------|--------------------------|--------------|
| T1 — Fix stream proxy timeout | ✓ Fixes 10s audio dropout | ✓ Same |
| T2 — Send `streamUrl` in bridge | ✗ Ignored (no harm) | ✓ Reads it, caches it, uses it |
| T3 — Send `protocolVersion` | ✗ Ignored (no harm) | ✓ Can check, gate on it |
| T4 — `/api/native-config` | ✗ Not called | ✓ Hits on launch, gets live config |
| T5 — Middleware detection | ✓ More robust native mode | ✓ Same |

T1 and T5 help current native apps today. T2, T3, T4 are zero-cost groundwork for rebuilt apps.

---

## Recommended Next Steps

### Immediate — Fix bridge gaps + server hardening (all web/server changes)

1. **T1** — Fix audio stream proxy timeout (`/api/audio-stream/route.ts`) — bug that kills live stream after 10s
2. **T5** — Add middleware for robust native detection (`src/middleware.ts`)
3. Update `BridgeInit.tsx`:
   - Send `{ loaded: true }` on mount (after hydration)
   - Send `{ showMediaBar: pathname !== '/' }` in pathname useEffect (alongside existing `{ location }`)
   - Add `focusin`/`focusout` event delegation for input elements → `showMobileNav`/`showMediaBar`
   - Send `streamUrl` (T2 — thread from layout)
   - Wrap messages with `protocolVersion: 1` (T3)
4. **T4** — Add `/api/native-config` endpoint (no urgency, but cheap)
5. Test all bridge behavior with native apps in debug mode.

### Before URL Switch

6. Complete all items above.
7. Decide on switch mechanism (Option C recommended — deploy Next.js to `reach-radio-web.pages.dev`).
8. Keep Astro at `reach-radio-web.pages.dev` available during transition (or as permanent fallback for iOS audio).

### Future (App Updates — only if high value)

These require going through App Store / Play Store review. Avoid unless the benefit is substantial.

**High priority — eliminates the entire class of "blocked by hardcoded URL" problems:**
- Bootstrap WebView URL and domain allowlist from `/api/native-config` at launch (see "WebView URL & Domain Allowlist — Future Architecture" section)
- Read `streamUrl` from bridge message + cache in UserDefaults/SharedPreferences (see "Audio Stream — Future Architecture" section)
- Add `minAppVersion` gate using native-config (enables forced upgrades without a new release)

**Medium priority:**
- Protocol versioning — check `protocolVersion` in incoming messages, show "please update" if unsupported
- Typed bridge message models — `NativeBridgeMessage.swift` / `NativeBridgeMessage.kt`
- iOS: call `globalState.isPlaying.set()` from lock screen controls (web UI play button stays in sync)
- Crash reporting (Firebase Crashlytics or Sentry)
- Exponential backoff on stream errors

**Low priority:**
- Unified native app detection — both platforms already send `mobile-app: true` header correctly

---

## Production Readiness Checklist

> Use this before switching native apps from Astro to Next.js. Items are ordered by dependency — complete each group before moving to the next.

### Group 1 — Web/Server Changes (No App Update Required)

These are all in-repo changes. Complete before any domain switch.

| # | Item | File | Status |
|---|------|------|--------|
| 1 | Fix audio stream proxy — `AbortController` + `clearTimeout` after connect (not `AbortSignal.timeout`) | `src/app/api/audio-stream/route.ts` | ✅ Done |
| 2 | Add middleware to persist `mobile-app` cookie from request header | `src/middleware.ts` | ✅ Done |
| 3 | `BridgeInit`: send `{ loaded: true }` on mount | `src/components/bridge/BridgeInit.tsx` | ✅ Done |
| 4 | `BridgeInit`: send `{ showMediaBar }` on route change | `src/components/bridge/BridgeInit.tsx` | ✅ Done |
| 5 | `BridgeInit`: input `focusin`/`focusout` → `showMobileNav`/`showMediaBar` | `src/components/bridge/BridgeInit.tsx` | ✅ Done |
| 6 | `BridgeInit`: bridge object detection on mount (set/clear cookie, no postMessage dependency) | `src/components/bridge/BridgeInit.tsx` | ✅ Done |
| 7 | `post-message.ts`: wrap all messages with `protocolVersion: 1` | `src/lib/bridge/post-message.ts` | ✅ Done |
| 8 | `BridgeInit`: send `streamUrl` in initial `loaded` message (layout fetches from Sanity, passes as prop) | `src/components/bridge/BridgeInit.tsx` | ✅ Done |
| 9 | Add `/api/native-config` endpoint | `src/app/api/native-config/route.ts` | ✅ Done |

### Group 2 — Device Testing (Before Domain Switch)

Test with actual native apps in debug mode. Android: `chrome://inspect`. iOS: Safari DevTools (`webView.isInspectable = true` already set).

| # | Scenario | Platform | Expected | Pass? |
|---|----------|----------|----------|-------|
| 1 | Cold open — splash dismisses | Android | `loaded: true` received → `_isAppReady = true` | ⬜ |
| 2 | Cold open — skeleton hides | Android | `loaded: true` → `_isWebViewLoading = false` | ⬜ |
| 3 | Cold open — splash dismisses | iOS | 2s timer fires (not message-driven) | ⬜ |
| 4 | Pull-to-refresh — page reloads + splash doesn't re-show | Both | `up.reload()` → full reload → `loaded: true` re-sent | ⬜ |
| 5 | Native bottom nav tab → page changes | Both | `window.globalActions.goToPage()` → router.push() | ⬜ |
| 6 | Native media bar shows on non-home route | Both | `showMediaBar: true` sent on route change | ⬜ |
| 7 | Native media bar hides on `/` | Both | `showMediaBar: false` sent | ⬜ |
| 8 | Input focus → native nav hides | Both | `showMobileNav: false` sent | ⬜ |
| 9 | Input blur → native nav restores | Both | `showMobileNav: true` sent | ⬜ |
| 10 | Play from web UI → native media bar updates | Both | `isPlaying: true`, `title`, `artist`, `image` sent | ⬜ |
| 11 | Play from native media bar → web UI updates | Android | `window.globalState.mediaBarState.isPlaying.set(true)` | ⬜ |
| 12 | Play from lock screen → web UI updates | iOS | **Known gap** — iOS does not call `globalState.isPlaying.set()` | N/A |
| 13 | Android hardware back button works | Android | `window.globalActions.goBack()` | ⬜ |
| 14 | External link (non-app domain) opens in browser | Both | `shouldOverrideUrlLoading` / `decidePolicyFor` intercepts | ⬜ |
| 15 | `forms.ministryforms.net` stays in WebView | Both | Allowlist passes it through | ⬜ |
| 16 | `login.ministryid.com` stays in WebView | Both | Allowlist passes it through | ⬜ |
| 17 | iOS audio stream plays | iOS | AVPlayer hits `reach-radio-web.pages.dev/api/audio-stream` | ⬜ |
| 18 | iOS lock screen / Now Playing metadata | iOS | `title`, `artist`, `image` update NowPlayingInfoCenter | ⬜ |
| 19 | Android notification shows + play/pause works | Android | Media notification reflects current state | ⬜ |
| 20 | `isMobileApp` true → nav/header/footer hidden in WebView | Both | Server-side layout check via header + cookie | ⬜ |
| 21 | Regular browser — `isMobileApp` false → nav visible | Web | No bridge objects → BridgeInit clears stale cookie | ⬜ |

### Group 3 — Web Launch (Vercel + Cloudflare DNS)

**Plan**: Deploy Next.js to Vercel. Point `reach.radio` and `reachradiotucson.com` DNS to Vercel via Cloudflare (CNAME or proxied). This is the web-browser launch and is **independent of native apps** — native apps stay on Astro until a separate app store update.

Pre-launch checklist:
- [ ] Next.js project connected to Vercel, production deployment passing
- [ ] `reach.radio` CNAME → Vercel ingress in Cloudflare DNS
- [ ] `reachradiotucson.com` CNAME → Vercel ingress (or redirect to `reach.radio`)
- [ ] Vercel domain verified, TLS provisioned
- [ ] Sanity CORS origins updated to include `reach.radio` and `reachradiotucson.com`
- [ ] Environment variables set in Vercel (Sanity project ID, dataset, tokens, etc.)
- [ ] Test `reach.radio` in a web browser — nav, audio, all pages work
- [ ] `isMobileApp` is false in web browser (no native headers, bridge cookie absent)
- [ ] `reach-radio-web.pages.dev` (Astro) still live — do NOT take it down

### Group 4 — Native App Migration (Future App Store Update)

This is a separate release from the web launch. Requires submitting updated native apps.

**Android changes required** (`MainActivity.kt`):
```kotlin
private val allowedWebViewDomains = setOf(
    "reach-radio-web.pages.dev",  // keep during transition period
    "reach.radio",
    "reachradiotucson.com",
)
// In shouldOverrideUrlLoading:
if (allowedWebViewDomains.contains(host) || allowedExternalDomains.contains(host)) {
    return false
}
createdWebView.loadUrl("https://reach.radio/", headers)
```

**iOS changes required** (`ContentView.swift`):
```swift
static let initialURL = URL(string: "https://reach.radio/")!
```

After app update ships, verify with production builds:
- [ ] Android: cold open loads `reach.radio` in WebView (not system browser)
- [ ] iOS: cold open loads `reach.radio` in WebView
- [ ] Android splash dismisses (`loaded: true` message received)
- [ ] iOS splash dismisses (2s timer)
- [ ] Audio plays on both platforms
- [ ] Navigation works from all native tabs
- [ ] External links still open in system browser
- [ ] `mobile-app` header arrives at Next.js/Vercel (check cookie presence in layout)
- [ ] iOS audio stream still works (still hitting `reach-radio-web.pages.dev/api/audio-stream` until updated)
