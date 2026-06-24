# Native Bridge Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the missing web middleware and fix native app bugs so `reach-radio-nextjs` can be tested against both iOS and Android native WebView apps via a Cloudflare dev tunnel.

**Architecture:** Add `src/middleware.ts` to edge-promote the `mobile-app: true` request header to a persistent cookie on the very first server response — closing the race window between initial load and React hydration during auth redirects. Then fix 6 native bugs (4 Android, 2 iOS) that produce misleading failures during testing, and swap hardcoded production URLs to the dev tunnel URL in both native apps.

**Tech Stack:** Next.js App Router + TypeScript + Vitest (web); Swift + WKWebView (iOS); Kotlin + WebView (Android)

## Global Constraints

- TypeScript strict mode — no `any` in exported APIs
- Test files live in `tests/unit/` (not co-located), import via `@/` alias
- Vitest with jsdom environment (`npx vitest run` or `npm test`)
- Native app changes go on dev branches; do NOT merge to main until URL is switched to production
- Commit scope for web: `bridge` — see `AGENTS.md` for full scope list
- Cloudflare tunnel URL placeholder in steps below: `YOUR_TUNNEL_DOMAIN` (e.g. `random-name.trycloudflare.com`)

---

## File Map

### reach-radio-nextjs

| File | Action | Purpose |
|------|--------|---------|
| `src/middleware.ts` | **Create** | Edge middleware: detect `mobile-app: true` request header, write cookie into response |
| `tests/unit/middleware.test.ts` | **Create** | Vitest unit tests: 4 cases covering header/cookie combinations |

### reach-radio-native-android (dev branch)

| File | Action | Purpose |
|------|--------|---------|
| `app/src/main/java/com/goodbarber/reachradio/MainActivity.kt` | **Modify** | URL swap (L79, L463), IIFE guard (L385), back button exit (L326–351), goToPage JSON (L475) |
| `app/src/main/java/com/goodbarber/reachradio/viewmodel/MainViewModel.kt` | **Modify** | Remove `isPlaying=false` from both buffering handlers (L146–154, L426–432) |

### reach-radio-native-ios (dev branch)

| File | Action | Purpose |
|------|--------|---------|
| `Reach Radio Native/ContentView.swift` | **Modify** | URL swap (L219, L226), `loaded` message splash (L258–320, L528–535), handleRefresh retain cycle (L89) |
| `Reach Radio Native/AudioPlayer.swift` | **Modify** | Fix `bufferingEndWorkItem` nil guard (L96, L102) |

---

## ⚠️ Expected Test Noise (not Next.js bugs)

Before these native fixes land, you will observe these symptoms that look like web bugs but are native bugs:

| Symptom | Cause | Fixed in |
|---------|-------|---------|
| Nav tab highlight wrong after first load | Android-1: bare `up.history.location` returns `"null"` | Task 3 |
| Play button shows "play" while audio is playing | Android-2: `isBuffering=true` forces `isPlaying=false` | Task 3 |
| iOS splash stays 2 s even on fast connection | iOS-3: timer-based instead of message-based | Task 4 |
| Android back button never exits app | Android-3: callback never disabled | Task 3 |

---

## Task 1: Web Middleware

> **Testing gate 1** — must complete before native testing can begin.

**Files:**
- Create: `src/middleware.ts`
- Create: `tests/unit/middleware.test.ts`

**Context:** `layout.tsx` already reads both the `mobile-app` header AND the `mobile-app=true` cookie. `BridgeInit.tsx` already sets the cookie client-side after hydration. This middleware closes the gap: it writes the cookie into the *response* on the very first request so it's present on subsequent SSR requests (e.g., the return leg of a Descope auth redirect) before hydration has run.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/middleware.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

function makeRequest(
  headers: Record<string, string> = {},
  cookies: Record<string, string> = {},
): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return new NextRequest('http://localhost:3000/', {
    headers: {
      ...headers,
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  })
}

describe('middleware', () => {
  it('sets mobile-app cookie when header present and no cookie', () => {
    const req = makeRequest({ 'mobile-app': 'true' })
    const res = middleware(req)
    expect(res.cookies.get('mobile-app')?.value).toBe('true')
  })

  it('does not set cookie when mobile-app cookie already exists', () => {
    const req = makeRequest({ 'mobile-app': 'true' }, { 'mobile-app': 'true' })
    const res = middleware(req)
    expect(res.cookies.get('mobile-app')).toBeUndefined()
  })

  it('does not set cookie when no mobile-app header', () => {
    const req = makeRequest()
    const res = middleware(req)
    expect(res.cookies.get('mobile-app')).toBeUndefined()
  })

  it('does not set cookie when mobile-app header is not "true"', () => {
    const req = makeRequest({ 'mobile-app': 'false' })
    const res = middleware(req)
    expect(res.cookies.get('mobile-app')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- middleware
```

Expected: 4 failures — `Cannot find module '@/middleware'`

- [ ] **Step 3: Write the middleware implementation**

Create `src/middleware.ts`:

```typescript
import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next()

  const hasMobileHeader = request.headers.get('mobile-app') === 'true'
  const hasMobileCookie = request.cookies.get('mobile-app')?.value === 'true'

  if (hasMobileHeader && !hasMobileCookie) {
    response.cookies.set('mobile-app', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: false,
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

`httpOnly: false` is intentional — `BridgeInit.tsx` reads `document.cookie` to detect and clear a stale cookie. The cookie must be JS-readable.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- middleware
```

Expected: 4 passing

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts tests/unit/middleware.test.ts
git commit -m "feat(bridge): add middleware to promote mobile-app header to cookie"
```

---

## Task 2: Dev Tunnel Setup

> **Not a code change** — setup instructions for testing environment.

- [ ] **Step 1: Install cloudflared (if not already installed)**

```bash
brew install cloudflare/cloudflare/cloudflared
```

- [ ] **Step 2: Start Next.js dev server**

In the `reach-radio-nextjs` directory:

```bash
npm run dev
```

- [ ] **Step 3: Start the Cloudflare tunnel in a second terminal**

```bash
cloudflared tunnel --url http://localhost:3000
```

Expected output (example):
```
Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://random-name.trycloudflare.com
```

Copy that domain (e.g. `random-name.trycloudflare.com`) — you will substitute it for `YOUR_TUNNEL_DOMAIN` in Tasks 3 and 4.

> **Note:** The tunnel URL changes every time you restart `cloudflared`. If you restart the tunnel, repeat Tasks 3 and 4 URL swap steps.

---

## Task 3: Android Fixes + URL Swap

> **Testing gate 2 (Android)** — complete before running Android tests.
> Work on a dev branch: `git checkout -b bridge-testing` in `reach-radio-native-android`.

**Files:**
- Modify: `app/src/main/java/com/goodbarber/reachradio/MainActivity.kt`
- Modify: `app/src/main/java/com/goodbarber/reachradio/viewmodel/MainViewModel.kt`

### 3a: Fix Android-2 — isBuffering desync (MainViewModel.kt)

This bug causes the play button to show "play" while audio is actually playing. It occurs in two places.

- [ ] **Step 1: Fix `processWebViewMessage` (line 146–154)**

Current code (`MainViewModel.kt:146–154`):
```kotlin
if (jsonObject.has("isBuffering")) {
    val buffering = jsonObject.getBoolean("isBuffering")
    Log.d("MainViewModel", "Updating buffering state to: $buffering")
    updatedState = updatedState.copy(isBuffering = buffering)
    if (buffering && updatedState.isPlaying) {
        updatedState = updatedState.copy(isPlaying = false)
        Log.d("MainViewModel", "Setting isPlaying to false because buffering started")
    }
}
```

Replace with:
```kotlin
if (jsonObject.has("isBuffering")) {
    val buffering = jsonObject.getBoolean("isBuffering")
    Log.d("MainViewModel", "Updating buffering state to: $buffering")
    updatedState = updatedState.copy(isBuffering = buffering)
}
```

- [ ] **Step 2: Fix `updateBufferingStateFromNative` (line 426–432)**

Current code (`MainViewModel.kt:426–432`):
```kotlin
fun updateBufferingStateFromNative(isBuffering: Boolean) {
    if (mediaState.isBuffering != isBuffering) {
        Log.d("MainViewModel", "Updating buffering state from NATIVE source: $isBuffering")
        // If buffering starts while playing, ensure isPlaying becomes false
        val isPlayingUpdate = if (isBuffering && mediaState.isPlaying) false else mediaState.isPlaying
        mediaState = mediaState.copy(isBuffering = isBuffering, isPlaying = isPlayingUpdate)
        // WebView propagation handled by MainActivity.startStateObserver()
    }
}
```

Replace with:
```kotlin
fun updateBufferingStateFromNative(isBuffering: Boolean) {
    if (mediaState.isBuffering != isBuffering) {
        Log.d("MainViewModel", "Updating buffering state from NATIVE source: $isBuffering")
        mediaState = mediaState.copy(isBuffering = isBuffering)
        // WebView propagation handled by MainActivity.startStateObserver()
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/goodbarber/reachradio/viewmodel/MainViewModel.kt
git commit -m "fix(bridge): remove isPlaying=false override when buffering starts"
```

### 3b: Fix Android-1 — IIFE guard for up.history.location (MainActivity.kt)

Without this guard, `up.history.location` throws a `ReferenceError` if Unpoly isn't loaded yet. `evaluateJavascript` returns the string `"null"` on error, which becomes `path = "null"` (the string), corrupting the nav tab highlight.

- [ ] **Step 4: Fix `onPageFinished` (line 385–392)**

Current code (`MainActivity.kt:385–392`):
```kotlin
view?.evaluateJavascript("up.history.location") { result ->
    val path = result?.removeSurrounding("\"") ?: "/"
    Log.d("MainActivity", "######## WebViewClient -> Got path from JS: $path ########")
    val locationMessage = "{\"location\":\"$path\"}"
    runOnUiThread {
         viewModel.processWebViewMessage(locationMessage)
    }
}
```

Replace with:
```kotlin
val iife = "(function() { try { return typeof up !== 'undefined' && up.history ? up.history.location : null; } catch(e) { return null; } })()"
view?.evaluateJavascript(iife) { result ->
    if (result == null || result == "null") return@evaluateJavascript
    val path = result.removeSurrounding("\"")
    Log.d("MainActivity", "######## WebViewClient -> Got path from JS: $path ########")
    val locationMessage = "{\"location\":\"$path\"}"
    runOnUiThread {
         viewModel.processWebViewMessage(locationMessage)
    }
}
```

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/goodbarber/reachradio/MainActivity.kt
git commit -m "fix(bridge): guard up.history.location eval against undefined Unpoly"
```

### 3c: Fix Android-3 — Back button never exits (MainActivity.kt)

The `OnBackPressedCallback` stays enabled forever, so users can never exit the app.

- [ ] **Step 6: Add `lastBackPressTime` property**

At the class level in `MainActivity.kt`, after line 77 (after the `controllerStateObserverJob` declaration):

```kotlin
private var lastBackPressTime = 0L
```

- [ ] **Step 7: Fix the back press callback (line 326–351)**

Current code (`MainActivity.kt:326–351`):
```kotlin
val onBackPressedCallback = object : OnBackPressedCallback(true /* enabled by default */) {
    override fun handleOnBackPressed() {
        if (webView?.canGoBack() == true) {
            Log.d(TAG, "OnBackPressed: WebView going back (native history)")
            webView?.goBack()
        } else {
            Log.d(TAG, "OnBackPressed: WebView cannot go back natively, trying SPA back (window.globalActions.goBack())")
            // If WebView cannot go back, try calling the SPA's back function.
            val script = "window.globalActions.goBack()"
            webView?.evaluateJavascript(script) { result ->
                Log.d(TAG, "SPA back script ('$script') result: $result")
                // We don't have immediate feedback if this succeeded.
                // If the user presses back again and we land here again,
                // it likely means the SPA couldn't go back either.
                // For now, we just execute the script and keep the callback enabled.
                // A more robust solution might involve JS posting a message back
                // indicating if the back navigation was handled.
            }
            
            // --- Do NOT close the app here immediately --- 
            // isEnabled = false 
            // onBackPressedDispatcher.onBackPressed() 
        }
    }
}
```

Replace with:
```kotlin
val onBackPressedCallback = object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
        if (webView?.canGoBack() == true) {
            Log.d(TAG, "OnBackPressed: WebView going back (native history)")
            webView?.goBack()
        } else {
            val now = System.currentTimeMillis()
            if (now - lastBackPressTime < 2000) {
                isEnabled = false
                onBackPressedDispatcher.onBackPressed()
            } else {
                lastBackPressTime = now
                Toast.makeText(this@MainActivity, "Press back again to exit", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
```

Add `import android.widget.Toast` to the imports at the top of the file if not already present.

- [ ] **Step 8: Commit**

```bash
git add app/src/main/java/com/goodbarber/reachradio/MainActivity.kt
git commit -m "fix(bridge): add double-back-to-exit behavior in Android back handler"
```

### 3d: Fix Android-4 — JSON-encode goToPage path (MainActivity.kt)

String interpolation without encoding can corrupt the JS call if a path ever contains a single quote.

- [ ] **Step 9: Fix `goToPage` script injection (line 475)**

Current code (`MainActivity.kt:475`):
```kotlin
val script = "window.globalActions.goToPage(\'$path\')"
```

Replace with:
```kotlin
val encodedPath = org.json.JSONObject.quote(path)
val script = "window.globalActions.goToPage($encodedPath)"
```

`JSONObject.quote()` returns a properly JSON-escaped, double-quoted string (e.g. `"/teachers"` → `"\"/teachers\""`), so the resulting JS is `window.globalActions.goToPage("/teachers")`.

- [ ] **Step 10: Commit**

```bash
git add app/src/main/java/com/goodbarber/reachradio/MainActivity.kt
git commit -m "fix(bridge): JSON-encode goToPage path to prevent JS injection"
```

### 3e: Android URL Swap (testing only — revert before shipping)

- [ ] **Step 11: Swap `initialDomain` (line 79)**

Current (`MainActivity.kt:79`):
```kotlin
private val initialDomain = "reach-radio-web.pages.dev"
```

Replace `reach-radio-web.pages.dev` with your tunnel domain:
```kotlin
private val initialDomain = "YOUR_TUNNEL_DOMAIN"
```

- [ ] **Step 12: Swap `loadUrl` (line 463)**

Current (`MainActivity.kt:463`):
```kotlin
createdWebView.loadUrl("https://reach-radio-web.pages.dev/", headers)
```

Replace:
```kotlin
createdWebView.loadUrl("https://YOUR_TUNNEL_DOMAIN/", headers)
```

- [ ] **Step 13: Commit**

```bash
git add app/src/main/java/com/goodbarber/reachradio/MainActivity.kt
git commit -m "chore(bridge): point webview at dev tunnel URL for bridge testing"
```

- [ ] **Step 14: Build and install on device**

Build via Android Studio → Run on device, or:
```bash
./gradlew installDebug
```

---

## Task 4: iOS Fixes + URL Swap

> **Testing gate 2 (iOS)** — complete before running iOS tests.
> Work on a dev branch: create a branch in `reach-radio-native-ios`.

**Files:**
- Modify: `Reach Radio Native/ContentView.swift`
- Modify: `Reach Radio Native/AudioPlayer.swift`

### 4a: Fix iOS-3 — Replace 2s splash timer with `loaded` message (ContentView.swift)

The 2s timer causes splash to linger unnecessarily on fast connections and dismiss too early on slow ones. The web already sends `{ loaded: true }` after mount — handle it natively.

- [ ] **Step 1: Add `@State var isShowingSplash = true` check and loaded handler**

In the `onMessageReceived` closure (`ContentView.swift:258–320`), add a `loaded` handler after the existing `showMobileNav` block (around line 314), before the closing `} else {`:

Current end of the handler (around line 312–319):
```swift
                                    // Handle navigation bar visibility
                                    if let showMobileNav = jsonDict["showMobileNav"] as? Bool {
                                        isNavigationBarVisible = showMobileNav
                                    }
                                    
                                } else {
                                    print("Failed to parse message or invalid format: \(message)")
                                }
```

Replace with:
```swift
                                    // Handle navigation bar visibility
                                    if let showMobileNav = jsonDict["showMobileNav"] as? Bool {
                                        isNavigationBarVisible = showMobileNav
                                    }

                                    // Dismiss splash once web app signals it is ready
                                    if let loaded = jsonDict["loaded"] as? Bool, loaded {
                                        withAnimation(.easeOut(duration: 0.3)) {
                                            isShowingSplash = false
                                        }
                                    }
                                    
                                } else {
                                    print("Failed to parse message or invalid format: \(message)")
                                }
```

- [ ] **Step 2: Remove the 2s timer in `.onAppear` (line 528–535)**

Current (`.onAppear` block around line 528–535):
```swift
        .onAppear {
            // Hide splash screen after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                withAnimation(.easeOut(duration: 0.3)) {
                    isShowingSplash = false
                }
            }
        }
```

Replace with a fallback timer (5s) so splash never hangs forever if `loaded` message is lost:
```swift
        .onAppear {
            // Fallback: dismiss splash after 5s in case the loaded message is lost
            DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                withAnimation(.easeOut(duration: 0.3)) {
                    isShowingSplash = false
                }
            }
        }
```

- [ ] **Step 3: Commit**

```bash
git commit -am "fix(bridge): dismiss iOS splash on loaded message instead of 2s timer"
```

### 4b: Fix iOS-2 — handleRefresh retain cycle (ContentView.swift)

The completion closure captures `self` (Coordinator) strongly. Use `[weak self]` to prevent a retain cycle if the view is released while the JS eval is in flight.

- [ ] **Step 4: Add `[weak self]` to handleRefresh closure (line 89–99)**

Current (`ContentView.swift:89–99`):
```swift
@objc func handleRefresh() {
    // Using an IIFE returning null and checking if 'up' exists
    let script = "(function() { if (typeof up !== 'undefined') { up.reload(); } return null; })()"
    
    parent.webViewStore.webView?.evaluateJavaScript(script) { (result, error) in
        if let error = error {
            print("Reload error: \(error)")
        }
        // End refreshing
        self.parent.webViewStore.webView?.scrollView.refreshControl?.endRefreshing()
    }
```

Replace the closure:
```swift
@objc func handleRefresh() {
    let script = "(function() { if (typeof up !== 'undefined') { up.reload(); } return null; })()"
    
    parent.webViewStore.webView?.evaluateJavaScript(script) { [weak self] (result, error) in
        if let error = error {
            print("Reload error: \(error)")
        }
        self?.parent.webViewStore.webView?.scrollView.refreshControl?.endRefreshing()
    }
```

- [ ] **Step 5: Commit**

```bash
git commit -am "fix(bridge): add [weak self] to handleRefresh JS eval closure"
```

### 4c: Fix iOS-1 — scheduleBufferingEnd guard (AudioPlayer.swift)

**Root cause:** When `bufferingEndWorkItem?.cancel()` is called in the `.waitingToPlayAtSpecifiedRate` or `.paused` cases, the work item is cancelled but NOT set to `nil`. Later, when `.playing` fires and calls `scheduleBufferingEnd()`, the guard `bufferingEndWorkItem == nil` fails — the cancelled (but non-nil) work item blocks re-scheduling. `isBuffering` is never cleared to `false`, leaving the web UI stuck showing the buffering state.

- [ ] **Step 6: Nil the work item after cancellation in `.paused` case (line 96)**

Current (`AudioPlayer.swift:94–100`):
```swift
case .paused:
    if self.isPlaying { self.isPlaying = false; stateChanged = true }
    self.bufferingEndWorkItem?.cancel()
    if self.isBuffering {
        print("[\(Date())] AudioStreamingManager: Observer setting isBuffering = false (Player Paused)")
        self.isBuffering = false; stateChanged = true
    }
```

Replace:
```swift
case .paused:
    if self.isPlaying { self.isPlaying = false; stateChanged = true }
    self.bufferingEndWorkItem?.cancel()
    self.bufferingEndWorkItem = nil
    if self.isBuffering {
        print("[\(Date())] AudioStreamingManager: Observer setting isBuffering = false (Player Paused)")
        self.isBuffering = false; stateChanged = true
    }
```

- [ ] **Step 7: Nil the work item after cancellation in `.waitingToPlayAtSpecifiedRate` case (line 102)**

Current (`AudioPlayer.swift:101–106`):
```swift
case .waitingToPlayAtSpecifiedRate:
    self.bufferingEndWorkItem?.cancel()
    if !self.isBuffering {
        print("[\(Date())] AudioStreamingManager: Observer setting isBuffering = true (Player Waiting)")
        self.isBuffering = true; stateChanged = true
    }
```

Replace:
```swift
case .waitingToPlayAtSpecifiedRate:
    self.bufferingEndWorkItem?.cancel()
    self.bufferingEndWorkItem = nil
    if !self.isBuffering {
        print("[\(Date())] AudioStreamingManager: Observer setting isBuffering = true (Player Waiting)")
        self.isBuffering = true; stateChanged = true
    }
```

- [ ] **Step 8: Commit**

```bash
git commit -am "fix(bridge): nil bufferingEndWorkItem after cancel to unblock scheduleBufferingEnd"
```

### 4d: iOS URL Swap (testing only — revert before shipping)

- [ ] **Step 9: Swap `initialURL` (line 219)**

Current (`ContentView.swift:219`):
```swift
static let initialURL = URL(string: "https://reach-radio-web.pages.dev/")!
```

Replace:
```swift
static let initialURL = URL(string: "https://YOUR_TUNNEL_DOMAIN/")!
```

- [ ] **Step 10: Swap `streamURL` (line 226)**

Current (`ContentView.swift:226`):
```swift
private let streamURL = "https://reach-radio-web.pages.dev/api/audio-stream"
```

Replace:
```swift
private let streamURL = "https://YOUR_TUNNEL_DOMAIN/api/audio-stream"
```

- [ ] **Step 11: Commit**

```bash
git commit -am "chore(bridge): point webview at dev tunnel URL for bridge testing"
```

- [ ] **Step 12: Build and install on physical iPhone**

Build via Xcode → select physical device → Run (⌘R).

---

## Task 5: Manual Verification Checklist

Run these checks after Tasks 1–4 are complete. The dev server (`npm run dev`) and Cloudflare tunnel must be running throughout.

### Web-only sanity (browser, no native app)

- [ ] Open `http://localhost:3000` in browser — site loads, no console errors
- [ ] Open DevTools → Application → Cookies — no `mobile-app` cookie present
- [ ] Confirm Header renders (desktop nav visible)
- [ ] Confirm Footer renders

### Android checks

- [ ] **Cookie set**: Open app → navigate to any page → DevTools (chrome://inspect) → Application → Cookies → `mobile-app=true` cookie exists
- [ ] **Nav tab highlight**: Open app → tap Teachers tab → nav highlight moves to Teachers ✓
- [ ] **Play button**: Tap play → audio plays → play button shows pause ✓ (does NOT flip back to play while buffering)
- [ ] **Back button exit**: Navigate to Teachers → press back → returns to home → press back again → "Press back again to exit" toast → press back → app exits ✓
- [ ] **Keyboard nav**: Tap search input → keyboard shows → nav bar hides → dismiss keyboard → nav bar returns ✓
- [ ] **Auth flow** (if Descope login available): Log in → redirect to login.ministryid.com → return → site renders without Header/Footer (native app mode) ✓
- [ ] **Pull-to-refresh**: Pull down on any page → page reloads → still in native app mode (no Header/Footer visible) ✓

### iOS checks

- [ ] **Cookie set**: Open app → navigate to any page → `mobile-app=true` in response (check via Proxyman or Xcode network log)
- [ ] **Splash dismissal**: Open app → splash dismisses as soon as page is ready (not a fixed 2s delay) ✓
- [ ] **Play button**: Tap play → audio plays → play button shows pause ✓
- [ ] **Lock screen controls**: Play → lock phone → use lock screen controls → play/pause state syncs back to web UI ✓
- [ ] **Buffering indicator**: Start play on slow connection → buffering indicator shows → disappears once stream is live ✓ (does NOT stay stuck)
- [ ] **Pull-to-refresh**: Pull down → page reloads → still in native app mode ✓
- [ ] **Auth flow** (if Descope login available): Same as Android ✓

### Negative tests (regression)

- [ ] Open `http://localhost:3000` in plain browser — Header IS visible, Footer IS visible (non-native render) ✓
- [ ] Hard-refresh browser — still no `mobile-app` cookie ✓
- [ ] No `mobile-app` header sent on plain browser request (verify via DevTools Network) ✓

---

## After Testing: URL Switch for Production

When testing is complete and you are ready to ship, update both native apps to the production URL:

**Android** (`MainActivity.kt`):
```kotlin
private val initialDomain = "reach.radio"
// ...
createdWebView.loadUrl("https://reach.radio/", headers)
```

**iOS** (`ContentView.swift`):
```swift
static let initialURL = URL(string: "https://reach.radio/")!
private let streamURL = "https://reach.radio/api/audio-stream"
```

Submit both apps through their respective app stores before switching the production DNS.
