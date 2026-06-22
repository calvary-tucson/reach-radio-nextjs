# iOS v4 Bridge Contract — LLM Brief

This document is the authoritative contract for how the v4 iOS native app communicates
with the Reach Radio Next.js web app. Give this to any LLM working on the native iOS project.

---

## Context

Reach Radio native iOS is a WKWebView wrapper around `https://reach.radio`.
The native app handles audio playback. The web app handles UI and navigation.
They communicate via two channels:

1. **Web → Native**: `window.webkit.messageHandlers.messageHandler.postMessage(json)`
2. **Native → Web**: Direct JS function calls via `WKWebView.evaluateJavaScript()`

---

## Startup sequence

```
1. App launches
2. Fetch remote config from /api/native-config (see Config section)
3. Load WebView with webUrl from config
4. Wait for { loaded: true } postMessage from web
5. Web has now hydrated — window.nativeBridge is available
6. App can now call window.nativeBridge.* methods
```

**Critical:** Do NOT call `window.nativeBridge.*` before receiving `{ loaded: true }`.
The object is assigned during React hydration. It does not exist before that.

---

## Remote config — GET /api/native-config

Fetch on every launch. Try in order until one succeeds:

1. `https://reach.radio/api/native-config`
2. `https://reachradiotucson.com/api/native-config`
3. `https://reach-radio-nextjs.vercel.app/api/native-config`

Response shape:
```json
{
  "protocolVersion": 1,
  "webUrl": "https://reach.radio",
  "streamUrl": "https://reach.radio/api/audio-stream",
  "hostURL": "https://reach.radio",
  "minAppVersion": { "ios": "1.0.0", "android": "1.0.0" }
}
```

If all three fail, use hardcoded fallback:
```
webUrl:    https://reach.radio
streamUrl: https://reach.radio/api/audio-stream
```

Do NOT use dev tunnel URLs in production builds.

---

## Audio stream

- Use `streamUrl` from config
- Fallback: `https://reach.radio/api/audio-stream`
- Native audio engine handles playback — do NOT use web audio
- `AudioProvider` (web `<audio>` element) is hidden in native mode via `isMobileApp` cookie

---

## Native → Web: window.nativeBridge

The web app defines this object during React hydration. Call these methods via
`WKWebView.evaluateJavaScript()` after receiving `{ loaded: true }`.

```ts
interface NativeBridge {
  navigate(path: string): void      // pushes Next.js router to path
  refresh(): void                   // triggers Next.js router.refresh()
  getLocation(): string             // returns current pathname
  setPlayState(playing: boolean): void   // sets media store isPlaying
  setBuffering(buffering: boolean): void // sets media store isBuffering
}
```

### navigate(path)
```js
window.nativeBridge.navigate('/teachers')
```
Use for: deep links, CarPlay navigation, in-app nav from native UI.

### refresh()
```js
window.nativeBridge.refresh()
```
Use for: pull-to-refresh. Triggers Next.js RSC refresh, NOT a hard page reload.

### getLocation()
```js
const path = window.nativeBridge.getLocation()
```
Returns current pathname (e.g. `/`, `/teachers`, `/schedule`).

### setPlayState(playing)
```js
window.nativeBridge.setPlayState(true)   // audio started
window.nativeBridge.setPlayState(false)  // audio stopped
```
Call when native audio engine play state changes. Updates web UI (play button, media bar).

### setBuffering(buffering)
```js
window.nativeBridge.setBuffering(true)   // stream buffering
window.nativeBridge.setBuffering(false)  // stream playing
```
Call when native audio engine buffering state changes. Updates web UI spinner.

---

## v3 legacy shims — removed

`window.up.*`, `window.globalActions.*`, `window.globalState.*` no longer exist in the
Next.js app. v3 never loaded Next.js (it hardcodes the Astro/Cloudflare site), so
these were dead code and have been deleted. Do not reference them.

---

## Web → Native: postMessage protocol

The web sends JSON via `window.webkit.messageHandlers.messageHandler.postMessage(json)`.
Every message includes `"protocolVersion": 1`.

Handle these fields:

| Field | Type | When | Action |
|---|---|---|---|
| `loaded` | `true` | After hydration (once) | Web is ready — now safe to call `window.nativeBridge.*` |
| `streamUrl` | string | With `loaded` | Override hardcoded stream URL if present |
| `location` | string | Every route change | Update native navigation state, history stack |
| `showMediaBar` | bool | Route change + keyboard | Show/hide floating media bar chrome |
| `showMobileNav` | bool | Route change + keyboard | Show/hide bottom nav bar |
| `isPlaying` | bool | Play state change | Sync play button state |
| `isBuffering` | bool | Buffering state change | Show/hide loading indicator |
| `title` | string | Track change | Update Lock Screen / CarPlay title |
| `artist` | string | Track change | Update Lock Screen / CarPlay artist |
| `image` | string | Track change | Update Lock Screen / CarPlay artwork URL |
| `offline` | bool | Network change | Show/hide offline banner |

Multiple fields can appear in one message. Example:
```json
{ "protocolVersion": 1, "isPlaying": true, "title": "Morning Devotional", "artist": "Alistair Begg", "image": "https://cdn.sanity.io/..." }
```

---

## Detection: is this a native app?

On launch, the native app sets a cookie:
```
mobile-app=true; path=/; max-age=31536000; SameSite=Lax
```

The web reads this cookie server-side to gate native-only UI (hide web chrome, show native chrome).
The cookie is set automatically by `BridgeInit.tsx` when it detects bridge objects present.

Do NOT manually set this cookie — `BridgeInit` handles it.

---

## What the native app does NOT do

- Does NOT inject JavaScript at document start
- Does NOT create `window.nativeBridge` stub
- Does NOT send `window.postMessage()` — only receives via `messageHandlers`
- Does NOT handle web audio — all audio is native

---

## Summary checklist for v4 iOS build

- [ ] Fetch `/api/native-config` on launch with three-URL fallback chain
- [ ] Replace dev tunnel fallback with `https://reach.radio`
- [ ] Load WebView with `webUrl` from config
- [ ] Use `streamUrl` from config for native audio engine
- [ ] Wait for `{ loaded: true }` postMessage before calling any `window.nativeBridge.*`
- [ ] Handle all postMessage fields in the table above
- [ ] Call `setPlayState()` when native audio play state changes
- [ ] Call `setBuffering()` when native audio buffering state changes
- [ ] Use `navigate()` for deep links and CarPlay navigation
- [ ] Use `refresh()` for pull-to-refresh (NOT `window.location.reload()`)
- [ ] Do NOT call `window.up.*` or `window.globalActions.*` (v3 only)
