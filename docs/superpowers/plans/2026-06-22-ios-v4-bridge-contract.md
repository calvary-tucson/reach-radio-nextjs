# iOS v4 Bridge Contract

> Give this document to any developer (or LLM) working on the iOS v4 native app.  
> Last updated: 2026-06-25

This is the authoritative contract for how the v4 iOS native app communicates with the Reach Radio Next.js web app (`reach.radio`).

---

## What This App Is

A thin WKWebView wrapper. The web app (`reach.radio`) owns all UI and navigation. The native app owns audio playback and OS chrome (lock screen controls, CarPlay, bottom nav, media bar). They talk via two simple channels:

- **Web → Native**: web posts JSON via `window.webkit.messageHandlers.messageHandler.postMessage(json)`
- **Native → Web**: native dispatches `CustomEvent('nativeCommand')` into the WebView via `evaluateJavaScript()`

---

## Startup Sequence

```
1. App launches
2. Fetch remote config from /api/native-config (see Remote Config section)
3. Load WebView with webUrl from config
4. Send HTTP header on initial request: mobile-app: true
5. Wait for { loaded: true } postMessage from web
   → web is now hydrated and ready
6. App can now call evaluateJavaScript() safely
```

**Do NOT call evaluateJavaScript() before receiving `{ loaded: true }`.** The web is not hydrated yet and the CustomEvent listener won't be set up.

---

## Remote Config — GET /api/native-config

Fetch on every launch. Try URLs in order until one succeeds:

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

Cache the last successful response in UserDefaults — use cached value if fetch fails on next launch.

---

## Audio Stream

- Source: `streamUrl` from remote config (or cached fallback)
- Native AVPlayer handles all playback — do NOT use the web `<audio>` element
- The web `AudioProvider` is hidden in native mode via the `isMobileApp` cookie
- Cache the last known `streamUrl` so audio works before the WebView finishes loading

```swift
// Persist last known stream URL
UserDefaults.standard.set(streamUrl, forKey: "streamUrl")

// On init, load cached value — fallback to hardcoded if never fetched
private var streamURL: String = UserDefaults.standard.string(forKey: "streamUrl")
    ?? "https://reach.radio/api/audio-stream"
```

---

## Native → Web

Native calls `evaluateJavaScript()` to dispatch a `CustomEvent('nativeCommand')` into the WebView. The web's `BridgeInit.tsx` listens for this event.

```swift
// Dispatch pattern — iOS
let js = """
  window.dispatchEvent(new CustomEvent('nativeCommand', {
    detail: \(jsonPayload)
  }))
"""
webView.evaluateJavaScript(js, completionHandler: nil)
```

### Command types

| `detail.type` | Additional fields | Web action |
|---|---|---|
| `navigate` | `path: string` | `router.push(path)` |
| `refresh` | — | `router.refresh()` (Next.js RSC refresh, NOT hard reload) |
| `setPlayState` | `playing: boolean` | Updates web play button / media bar |
| `setBuffering` | `buffering: boolean` | Shows/hides web buffering indicator |
| `prefetchRoutes` | `paths: string[]` | Prefetch Next.js routes |

### When to call each

**navigate(path)** — use for: deep links, CarPlay navigation, tapping native bottom nav tabs.

**refresh()** — use for: pull-to-refresh. This triggers an RSC refresh, not a hard `window.location.reload()`. Do NOT use `window.location.reload()` in iOS — it bypasses the Next.js router and can break client state.

**setPlayState(playing)** — call whenever the AVPlayer play state changes. Keeps the web play button in sync. Call with `playing: false` when audio stops or errors.

**setBuffering(buffering)** — call when AVPlayer buffering state changes. Shows/hides the web loading spinner.

---

## Web → Native

The web sends JSON via:
```
window.webkit.messageHandlers.messageHandler.postMessage(json)
```

> ⚠️ **Handler name is `messageHandler`** — not `nativeBridge`, not `bridge`. Register your `WKScriptMessageHandler` under exactly `messageHandler` in `WKUserContentController`. If the name doesn't match, all messages are silently dropped.

Every message includes `"protocolVersion": 1`. Drop any message where `protocolVersion !== 1`.

Handle these fields:

| Field | Type | When sent | Action |
|---|---|---|---|
| `loaded` | `true` | After React hydration, once per page load | Web is ready — start calling evaluateJavaScript |
| `streamUrl` | string | Sent with `loaded` | Update AVPlayer stream URL if changed |
| `location` | string | Every route change | Update active bottom nav tab |
| `showMediaBar` | boolean | Route change + keyboard focus/blur | Show/hide floating media bar |
| `showMobileNav` | boolean | Route change + keyboard focus/blur | Show/hide bottom nav bar |
| `isPlaying` | boolean | Play state change | Sync native play button |
| `isBuffering` | boolean | Buffering state change | Show/hide native loading indicator |
| `title` | string | Track metadata change | Lock screen / CarPlay title |
| `artist` | string | Track metadata change | Lock screen / CarPlay artist |
| `image` | string | Track metadata change | Lock screen / CarPlay artwork URL |
| `offline` | boolean | Network change | Show/hide offline banner |

Multiple fields arrive in one message. Process all present fields.

Example:
```json
{
  "protocolVersion": 1,
  "isPlaying": true,
  "title": "Morning Devotional",
  "artist": "Alistair Begg",
  "image": "https://cdn.sanity.io/..."
}
```

### Track metadata — where it comes from

The web polls a radiojar JSONP endpoint via SSE every 30 seconds. When the stream changes, `title`/`artist`/`image` arrive as a web → native message. There is no separate metadata push from native — the web is the metadata source. Update NowPlayingInfoCenter whenever these fields arrive.

---

## Native App Detection

iOS sets a cookie on the WebView's first request:
```
mobile-app=true; path=/; max-age=31536000; SameSite=Lax
```

The Next.js server reads this cookie to hide web chrome (header, footer, nav) and suppress the web audio element. The cookie is set automatically by `BridgeInit.tsx` on mount when it detects `messageHandlers.messageHandler` is present. Do NOT manually set or clear this cookie.

---

## Domain Allowlist

Allow navigation within the WebView for:
- `reach.radio`
- `reachradiotucson.com`
- `forms.ministryforms.net` (donation forms — must stay in WebView)
- `login.ministryid.com` (auth — must stay in WebView)

Open everything else in `UIApplication.shared.open(url)`.

---

## Known Gaps (v4 to fix)

| Gap | Impact | Fix |
|---|---|---|
| iOS does not call `setPlayState` back to web | Web play button doesn't reflect lock screen controls | Call `nativeCommand: setPlayState` when AVPlayer play state changes |
| Splash is time-based (2s), not message-driven | Feels slow on fast connections; may feel fast on slow ones | Drive splash dismiss from `{ loaded: true }` message instead |

---

## v3 Compatibility Shims (Still Present — Do Not Call From iOS v4)

The Next.js app still registers these globals for Android backward compatibility. iOS v4 should use `CustomEvent('nativeCommand')` instead. Do not call these from iOS v4:

```ts
window.globalActions.goToPage(path)   // Android nav — use nativeCommand:navigate
window.globalActions.goBack()         // Android back — use history APIs
window.globalState.mediaBarState.*    // Android state sync — use nativeCommand:setPlayState
window.up.reload()                    // Android pull-to-refresh compat
window.up.history.location            // Android path reading compat
```

---

## Build Checklist

- [ ] Fetch `/api/native-config` on launch with three-URL fallback chain
- [ ] Cache `webUrl` and `streamUrl` in UserDefaults
- [ ] Load WebView with `webUrl` from config
- [ ] Register `WKScriptMessageHandler` under the name **`messageHandler`** (exact)
- [ ] Set `mobile-app: true` HTTP header on initial WebView request
- [ ] Use `streamUrl` from config for AVPlayer
- [ ] Wait for `{ loaded: true }` before calling any `evaluateJavaScript()`
- [ ] Handle `streamUrl` in the `loaded` message — update AVPlayer if changed
- [ ] Handle `location` → update active nav tab
- [ ] Handle `showMediaBar` / `showMobileNav` → native chrome visibility
- [ ] Handle `isPlaying` / `isBuffering` → sync native UI
- [ ] Handle `title` / `artist` / `image` → NowPlayingInfoCenter
- [ ] Handle `offline` → show/hide offline banner
- [ ] Drop messages where `protocolVersion !== 1`
- [ ] Call `nativeCommand: setPlayState` when AVPlayer play state changes
- [ ] Call `nativeCommand: setBuffering` when AVPlayer buffering state changes
- [ ] Call `nativeCommand: navigate` for deep links and CarPlay nav
- [ ] Call `nativeCommand: refresh` for pull-to-refresh (NOT `window.location.reload()`)
- [ ] Allow `forms.ministryforms.net` and `login.ministryid.com` in WebView
- [ ] Open all other external domains in `UIApplication.shared.open()`
- [ ] Do NOT call `window.up.*`, `window.globalActions.*`, or `window.globalState.*`
