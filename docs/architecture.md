# Reach Radio — Architecture

How the site works, how it runs inside a native WebView, and how the bridge communicates.

---

## Site Architecture

### Tech Stack

- **Next.js** (App Router, React Server Components)
- **Sanity CMS** — project `bk05c6rl`, all content fetched at request time with ISR cache tags
- **Zustand** — client-side media state (`useMediaStore`)
- **Tailwind CSS** — design tokens via CSS variables
- **Vercel** — hosting at `reach.radio` and `reachradiotucson.com`

### Routes

| Route | Type | Description |
|---|---|---|
| `/` | RSC | Home page — radio player, stream info, NowPlaying |
| `/about` | RSC | About page, contact form |
| `/about/privacy-policy` | RSC | Privacy policy |
| `/donate` | RSC | Donate page (MinistryForms iframe) |
| `/teachers` | RSC | Teacher list with search |
| `/teachers/[slug]` | RSC | Teacher detail page |
| `/teachers/search` | RSC | Search results |

Teacher detail (`/teachers/[slug]`) and teacher search also render as **intercepted routes** (`@modal/`) — when reached via client navigation from the teachers list they open as a modal overlay. Direct URL load shows the full page.

### API Routes

| Route | Description |
|---|---|
| `GET /api/audio-stream` | Proxies the live radiojar stream to browser audio |
| `GET /api/stream-info` | Current track title/artist (single fetch) |
| `GET /api/stream-info-sse` | Server-Sent Events — pushes track updates to `NowPlayingProvider` |
| `GET /api/native-config` | Config endpoint for rebuilt native apps — stream URL, web URL, min version |
| `GET /api/teachers-list` | JSON list of teachers for search |
| `POST /api/revalidate` | Sanity webhook — revalidates ISR cache tags on publish |
| `GET /api/theme` | Reads theme cookie, returns current theme |

### Key Providers

All providers live in the root layout. Several are **suppressed in native mode** (see WebView section).

| Provider | Suppressed in native | Role |
|---|---|---|
| `ThemeProvider` | No | Dark/light/system theme via CSS class on `<html>` |
| `AudioProvider` | **Yes** | Browser audio element, stream URL, play/pause/volume state |
| `NowPlayingProvider` | No | SSE subscription to `/api/stream-info-sse`, writes to `useMediaStore` |
| `SleepTimerProvider` | **Yes** | Countdown timer that stops playback |
| `BridgeInit` | No (always mounted) | Native bridge setup, always runs |

### Media State (`useMediaStore`)

Zustand store — source of truth for all playback UI. Fields:

```ts
isPlaying: boolean
isBuffering: boolean
title: string
artist: string
image: string
```

Both `AudioProvider` (browser) and native commands (`BridgeInit`) write to this store. `MediaBar`, `RadioPlayer`, and `PlayPauseButton` read from it.

### Root Layout — What Mounts

```
<ThemeProvider>
  <WebSiteSchema />              // JSON-LD
  <RadioStationSchema />         // JSON-LD
  <LayoutChrome>
    <BridgeInit />               // always
    <NowPlayingProvider />       // always
    {!isMobileApp && <AudioProvider />}
    {!isMobileApp && <SleepTimerProvider />}
    {!isMobileApp && <Header />}
    {!isMobileApp && <MobileHeader />}
  </LayoutChrome>
  <main>{children}</main>
  <LayoutFooter>
    {!isMobileApp && <Footer />}
    {!isMobileApp && <MobileNav />}
  </LayoutFooter>
  <MediaBar />                   // always (metadata relay in native mode)
  <RouteAnnouncer />             // a11y: aria-live announces route changes
</ThemeProvider>
```

---

## Native WebView Mode

Both iOS and Android apps are thin native wrappers. The WebView loads the Next.js site. The native layer provides background audio, lock screen controls, pull-to-refresh, and the bottom navigation bar.

### Detection

Native app detection happens in two layers.

**Layer 1 — Server-side (per request)**

Both platforms send `mobile-app: true` as an HTTP header on every WebView request.

`middleware.ts` (`proxy()`) reads this header. If present and no cookie exists, it sets a `mobile-app=true` cookie (non-httpOnly, 1 year, `SameSite=Lax`). This persists native mode across RSC navigations that don't re-send the header.

`layout.tsx` (`LayoutChrome` / `LayoutFooter`) checks both:

```ts
const isMobileApp =
  headersList.get('mobile-app') === 'true' ||
  cookieHeader.split(';').some(c => c.trim() === 'mobile-app=true')
```

When `isMobileApp` is true, `AudioProvider`, `SleepTimerProvider`, `Header`, `MobileHeader`, `Footer`, and `MobileNav` are NOT rendered.

**Layer 2 — Client-side (on mount, `BridgeInit`)**

After hydration, `BridgeInit` checks for native bridge objects:

```ts
function isNativeBridgePresent(): boolean {
  return !!(
    window.Android?.postMessage ||                                 // Android JavascriptInterface
    window.webkit?.messageHandlers?.messageHandler?.postMessage || // iOS WKWebView
    window.inNativeApp                                             // iOS WKUserScript flag
  )
}
```

- Bridge present → sets `mobile-app=true` cookie (1 year)
- Bridge absent + cookie present → clears cookie (auto-heals stale sessions)

**Inline script (before hydration)**

The root layout has a small inline script that fires before React loads, adding classes to `<html>` to avoid flash:

```js
// Adds 'dark'/'light' class based on theme cookie
// Adds 'native-app' class if mobile-app cookie or window.inNativeApp is set
```

The `native-app` CSS class can be used in Tailwind with `[.native-app_&]:hidden` or similar selectors to hide elements that shouldn't appear in the WebView.

### iOS Detection Details

1. Sends `mobile-app: true` header on initial load
2. Injects `window.inNativeApp = true` and `window.ReactNativeWebView = true` via `WKUserScript` at `.atDocumentEnd`
3. Registers `window.webkit.messageHandlers.messageHandler` before WebView creation — available before any JS runs

### Android Detection Details

1. Sends `mobile-app: true` header on every request
2. Registers `window.Android` JavascriptInterface via `addJavascriptInterface()` before `loadUrl()` — no race condition

---

## Native Bridge

The bridge is the communication layer between the Next.js web app and the native iOS/Android shell.

All bridge setup lives in `BridgeInit` (`src/components/bridge/BridgeInit.tsx`), always mounted in the root layout. The sending utility is `postMessageToNative` (`src/lib/bridge/post-message.ts`).

### Sending: Web → Native

```ts
// src/lib/bridge/post-message.ts
export function postMessageToNative(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const message = JSON.stringify({ protocolVersion: 1, ...payload })
  if (window.Android?.postMessage) {
    window.Android.postMessage(message)          // Android JavascriptInterface
  } else if (window.webkit?.messageHandlers?.messageHandler?.postMessage) {
    window.webkit.messageHandlers.messageHandler.postMessage(message)   // iOS WKWebView
  }
}
```

Every outgoing message is wrapped with `protocolVersion: 1`.

#### Web → Native message fields

| Field | Type | When sent | Sender |
|---|---|---|---|
| `protocolVersion` | `1` | Every message | `postMessageToNative` wrapper |
| `loaded` | `boolean` | On mount (after hydration) | `BridgeInit` |
| `streamUrl` | `string` | On mount | `BridgeInit` (from Sanity via layout) |
| `location` | `string` | On every route change | `BridgeInit` pathname effect |
| `showMediaBar` | `boolean` | On every route change; on input focus/blur | `BridgeInit` |
| `showMobileNav` | `boolean` | On every route change; on input focus/blur | `BridgeInit` |
| `offline` | `boolean` | On `online`/`offline` events | `BridgeInit` |
| `isPlaying` | `boolean` | When play state changes | `RadioPlayer`, `MediaBar`, `PlayPauseButton` |
| `isBuffering` | `boolean` | When buffering state changes | `MediaBar` |
| `title` | `string` | When track metadata changes | `BridgeInit` (from `useMediaStore`) |
| `artist` | `string` | When track metadata changes | `BridgeInit` (from `useMediaStore`) |
| `image` | `string` | When track metadata changes | `BridgeInit` (from `useMediaStore`) |

**`showMediaBar` rules:**
- `true` on all routes except `/` and teacher detail pages (`/teachers/[slug]`)
- `false` when an input/textarea is focused (keyboard showing)
- Restores to route-appropriate value on input blur

**`showMobileNav` rules:**
- `false` on teacher detail pages (custom back-navigation layout)
- `false` when an input/textarea is focused
- `true` otherwise

### Receiving: Native → Web

Native apps call JavaScript directly via `evaluateJavaScript()` (iOS) or `evaluateJavascript()` (Android). There is no `window.postMessage` from native — the `window.message` event never fires for bridge traffic.

#### `nativeCommand` CustomEvent

`BridgeInit` listens for `CustomEvent('nativeCommand', { detail: NativeCommand })`:

```ts
type NativeCommand =
  | { type: 'navigate'; path: string }
  | { type: 'refresh' }
  | { type: 'setPlayState'; playing: boolean }
  | { type: 'setBuffering'; buffering: boolean }
```

Native apps dispatch this event using `evaluateJavaScript`:

```js
// Called by native to navigate
window.dispatchEvent(new CustomEvent('nativeCommand', {
  detail: { type: 'navigate', path: '/teachers' }
}))
```

#### Global JS APIs (called directly by native)

Both platforms also call these globals set up by `BridgeInit`:

```ts
// Navigation (both platforms)
window.globalActions.goToPage('/teachers')  // router.push()
window.globalActions.goBack()               // window.history.back()

// State setters (Android only)
window.globalState.mediaBarState.isPlaying.set(true)    // → useMediaStore.setIsPlaying()
window.globalState.mediaBarState.isBuffering.set(true)  // → useMediaStore.setIsBuffering()
```

iOS does **not** call `globalState.*`. It manages audio independently via AVPlayer and never pushes play state back to the web. This means the web UI play button won't reflect lock screen controls on iOS — a known gap.

#### Compat shims (V3 legacy)

The previous Astro site used Unpoly for navigation. Old native app builds call Unpoly APIs. `BridgeInit` shimms these:

```ts
window.up = {
  navigate: ({ url }) => router.push(url),
  reload: () => router.refresh(),
  history: { get location() { return pathname } }
}
```

These shims remain until the v3 iOS build retires from the App Store.

### `/api/native-config`

A lightweight endpoint for rebuilt native apps to bootstrap config at launch:

```ts
GET /api/native-config
// Response (cached 5 min):
{
  protocolVersion: 1,
  streamUrl: string,    // from Sanity, fallback to radiojar direct
  hostURL: string,      // from Sanity
  webUrl: string,       // SITE_URL constant
  minAppVersion: {
    ios: "1.0.0",
    android: "1.0.0"
  }
}
```

Current native apps do not call this endpoint — they have hardcoded URLs. Rebuilt apps will use it to load the WebView URL and audio stream URL dynamically, eliminating hardcoded values.

### `RouteAnnouncer`

`src/components/bridge/RouteAnnouncer.tsx` — a11y component. On every route change, writes the page `<title>` to an `aria-live="polite"` region so screen readers announce navigation. Also moves focus to `#main-content` after navigation (with 100ms delay to let React finish rendering).

---

## Platform-Specific Behavior

### iOS (WKWebView / SwiftUI)

- **Splash**: 2-second timed delay, not message-driven
- **Skeleton**: visible until `webView:didFinishNavigation` fires
- **Pull-to-refresh**: calls `window.up.reload()`
- **Path tracking**: reads `window.up.history.location` in `didFinishNavigation` + listens for `{ location }` messages
- **Audio**: AVPlayer, stream URL hardcoded to `reach-radio-web.pages.dev/api/audio-stream`
- **Allowed in WebView**: `forms.ministryforms.net`, `login.ministryid.com` — everything else opens in Safari

### Android (WebView / Jetpack Compose)

- **Splash**: dismissed on first `{ loaded: true }` message
- **Skeleton**: hidden on `{ loaded: true }` message or `onPageFinished`, whichever comes first
- **Pull-to-refresh**: SwipeRefreshLayout → `window.up.reload()`
- **Back button**: tries `webView.goBack()` first, then `window.globalActions.goBack()`
- **Path tracking**: reads `window.up.history.location` in `onPageFinished` + listens for `{ location }` messages
- **Audio**: ExoPlayer/Media3, stream URL via `window.Android` bridge
- **State sync**: pushes `isPlaying`/`isBuffering` back to web via `window.globalState.*`
- **Allowed in WebView**: same as iOS

---

## Data Flow Summary

```
Browser request
      │
      ▼
middleware (proxy.ts)
  ├─ mobile-app header? → set mobile-app cookie
  └─ pass to Next.js
      │
      ▼
layout.tsx (RSC — server)
  ├─ read header + cookie → isMobileApp
  ├─ fetch Sanity: siteSettings → metadata
  ├─ fetch Sanity: appSettings → streamUrl
  └─ render providers conditionally
      │
      ▼
Client hydration
  └─ BridgeInit mounts
      ├─ isNativeBridgePresent()? → set/clear cookie
      ├─ listen for 'nativeCommand' CustomEvents
      ├─ send { loaded: true, streamUrl }
      ├─ set up globalActions / globalState / up.* shims
      └─ effects: route → location/showMediaBar/showMobileNav
                  online/offline → offline
                  title/artist/image → track metadata
                  focusin/out → showMobileNav/showMediaBar

NowPlayingProvider (always)
  └─ SSE → /api/stream-info-sse → useMediaStore.title/artist/image

AudioProvider (browser only)
  └─ <audio> element → useMediaStore.isPlaying/isBuffering
```

---

## Bridge Communication Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     NATIVE APP (iOS / Android)                      │
│                                                                     │
│  ┌──────────────────────┐       ┌──────────────────────────────┐   │
│  │   Native Audio       │       │  Bridge Layer                │   │
│  │  iOS: AVPlayer       │       │  iOS:  ContentView +         │   │
│  │  Android: ExoPlayer  │       │        WKScriptMessageHandler│   │
│  └──────────────────────┘       │  Android: MainViewModel +    │   │
│                                 │           WebAppInterface    │   │
│  ┌──────────────────────┐       └────────────┬───────────┬─────┘   │
│  │   Native UI          │                    │           │         │
│  │  MediaBar            │◄── isPlaying ──────┘           │         │
│  │  BottomNav           │◄── title/artist/image           │         │
│  │  Splash/Skeleton     │◄── showMediaBar/showMobileNav   │         │
│  │  NowPlaying center   │◄── location                     │         │
│  └──────────────────────┘                                 │         │
│                                                           │         │
└───────────────────────────────────────────────────────────┼─────────┘
                                                            │
              ┌─────── WEB → NATIVE ───────────────────────┘
              │  window.Android.postMessage(json)             (Android)
              │  window.webkit.messageHandlers                (iOS)
              │        .messageHandler.postMessage(json)
              │
              │  All messages: { protocolVersion: 1, ...payload }
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        WebView  (Next.js)                           │
│                                                                     │
│  postMessageToNative()  ◄──── BridgeInit.tsx                        │
│  sends on:                    │                                     │
│    mount         → loaded, streamUrl                                │
│    route change  → location, showMediaBar, showMobileNav            │
│    metadata      → title, artist, image                             │
│    network       → offline                                          │
│    input focus   → showMobileNav: false, showMediaBar: false        │
│    input blur    → showMobileNav: true,  showMediaBar: (route rule) │
│    play state    → isPlaying, isBuffering                           │
│                                                                     │
│  BridgeInit listens for inbound native calls:                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  NATIVE → WEB  (evaluateJavaScript — no window.postMessage)  │   │
│  │                                                              │   │
│  │  nativeCommand CustomEvent  (both platforms)                 │   │
│  │    navigate  → router.push(path)                             │   │
│  │    refresh   → router.refresh()                              │   │
│  │    setPlayState   → useMediaStore.setIsPlaying()             │   │
│  │    setBuffering   → useMediaStore.setIsBuffering()           │   │
│  │                                                              │   │
│  │  Direct JS calls  (both)                                     │   │
│  │    window.globalActions.goToPage(path) → router.push()       │   │
│  │    window.globalActions.goBack()       → history.back()      │   │
│  │                                                              │   │
│  │  Direct JS calls  (Android only)                             │   │
│  │    window.globalState.mediaBarState                          │   │
│  │      .isPlaying.set(v)   → useMediaStore.setIsPlaying()      │   │
│  │      .isBuffering.set(v) → useMediaStore.setIsBuffering()    │   │
│  │                                                              │   │
│  │  Compat shims (v3 iOS legacy — remove when v3 retires)       │   │
│  │    window.up.navigate({ url }) → router.push()               │   │
│  │    window.up.reload()          → router.refresh()            │   │
│  │    window.up.history.location  → current pathname (getter)   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  useMediaStore (Zustand)                                            │
│    isPlaying, isBuffering, title, artist, image                     │
│    ▲ written by: AudioProvider (browser), BridgeInit (native cmds)  │
│    ▼ read by:    RadioPlayer, MediaBar, PlayPauseButton             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```
