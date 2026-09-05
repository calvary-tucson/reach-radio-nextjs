# Post-Donation App Reopen: Universal Links / App Links

**Status:** Design-drafted, pending user review before writing-plans
**Date:** 2026-09-05

## Background

`/donate` (this repo) and both native apps link out to PushPay's hosted giving
page, per `2026-09-04-donate-page-link-out-design.md`. That spec identified,
but explicitly deferred, one gap:

> **Universal Links / App Links "reopen app after gift"** — deferred,
> cross-repo (this app + both native repos), post-launch.

Today, a donor who completes a gift on PushPay is redirected (via PushPay's
"Preconfigured Redirect" setting, see that spec's Gap #2) to
`https://reach.radio/donate/thank-you`. That's a plain web navigation, so
where it lands depends on how the native app opened PushPay in the first
place:

- **iOS:** the Donate CTA opens PushPay inside an `SFSafariViewController`
  sheet layered over the app (confirmed in `WebViewCoordinator.swift`). The
  redirect loads inside that same sheet — still "a web page," and the user
  must tap the sheet's own Done button to get back to the app underneath.
- **Android:** as of `373e92b` ("fix: open external links in a Chrome Custom
  Tab instead of the default browser," committed 2026-09-04, on local `main`,
  not yet pushed), external links now open in a Custom Tab rather than fully
  backgrounding the app. This closes the donate spec's Android gap. The
  redirect loads inside that Custom Tab — same situation as iOS.

Neither platform automatically hands control back to the native app. This
spec adds that: **Universal Links** (iOS) and **App Links** (Android) so the
OS itself intercepts the redirect URL and reopens the app instead of
rendering the page in the browser surface.

### Why this needs no new native UI

Both native apps are WebView shells around this Next.js site, and both
already have a working deep-link pipeline built for their `reachradio://`
custom URL scheme:

- **iOS** (`Reach_Radio_NativeApp.swift`): `.onOpenURL` validates the path,
  sets `navigationState.pendingDeepLink`. `ContentView.swift`'s
  `handlePendingDeepLinkIfReady()` consumes it once the bridge is ready and
  calls `NativeBridgeHandler.navigate(to: path, in: webView)` — navigating
  the *existing* embedded WebView.
- **Android** (`MainActivity.kt`'s `handleDeepLink()`): parses `intent.data`,
  builds a path, and calls
  `webView?.evaluateJavascript("window.globalActions.goToPage(...)")` —
  same idea, same WebView.

A Universal Link / App Link delivers the same thing an `Intent`/`onOpenURL`
call always has: a URL for the OS to hand to the app. Once the OS decides to
open the app instead of the browser, it arrives through these identical entry
points. The fix is to make each app *recognize* an `https://reach.radio/...`
URL alongside the `reachradio://` scheme it already recognizes, and route it
the same way. The donor lands on the real `/donate/thank-you` page — the one
already designed and copy-reviewed — inside the app shell instead of a
browser tab. No bespoke native thank-you screen to build or keep in sync.

## Scope

**Associated Domain / App Link covers donate paths only** — not all of
`reach.radio`. Concretely: `/donate` and `/donate/thank-you` (a donor's PushPay
session could in principle redirect back to either, and scoping by path
costs nothing extra to set up). This is the minimal fix for the actual
problem; widening to the whole domain (so any shared reach.radio link opens
the app when installed) is a plausible future enhancement but out of scope
here — the plumbing this adds makes that a config change later, not a
redesign.

## Non-goals

- No native UI for the thank-you moment — the existing web `/donate/thank-you`
  page is reused as-is (see "Why this needs no new native UI" above).
- No change to PushPay configuration itself (already specified in the donate
  spec's Gap #2).
- No widening of `allowedExternalDomains` — unrelated; that allowlist governs
  which hosts the WebView will render in-place, not this reopen mechanism.
- No reading of PushPay's payment-token / `sr` redirect params (already a
  non-goal in the donate spec).
- Android: no change to the Custom Tabs fix itself (`373e92b`) — this spec
  only adds the App Link on top of it.

## Design

### 1. reach-radio-nextjs — serve the verification files

Universal Links / App Links both require the web app to serve a static JSON
file proving it's controlled by the same party as the native app:

- **`public/.well-known/apple-app-site-association`** (no file extension,
  served as `application/json`, no redirects allowed):
  ```json
  {
    "applinks": {
      "details": [
        {
          "appID": "9CY89P42PV.com.goodbarber.reachradio",
          "paths": ["/donate", "/donate/thank-you"]
        }
      ]
    }
  }
  ```
  (Team ID `9CY89P42PV`, bundle ID `com.goodbarber.reachradio` — both
  confirmed from `reach-radio-native-ios/*.xcodeproj/project.pbxproj`.)
  Next.js serves `.well-known` static files with the wrong content-type by
  default (it infers from the extension, and this file has none) — the plan
  needs to add a route handler or `next.config.ts` header rule forcing
  `Content-Type: application/json` for this path specifically.

- **`public/.well-known/assetlinks.json`**:
  ```json
  [
    {
      "relation": ["delegate_permission/common.handle_all_urls"],
      "target": {
        "namespace": "android_app",
        "package_name": "com.goodbarber.reachradio",
        "sha256_cert_fingerprints": ["<FROM PLAY CONSOLE>"]
      }
    }
  ]
  ```
  `package_name` confirmed from `app/build.gradle.kts`'s `applicationId`. The
  `sha256_cert_fingerprints` value is **not available in either repo** — the
  app uses Play App Signing, so the real signing certificate is held by
  Google. It must be pulled from Play Console → *Setup → App signing → App
  signing key certificate → SHA-256*. Tracked as an explicit gap below, not
  a placeholder to guess at.

- Both files are static and public by design (this is how the mechanism
  works — no secrets involved), so no auth/middleware concerns.

### 2. reach-radio-native-ios — Associated Domains entitlement + handler

- Add the **Associated Domains** capability in Xcode, entitlement
  `applinks:reach.radio` in `ReachRadio.entitlements` (alongside the existing
  `com.apple.security.application-groups` entry).
- SwiftUI delivers Universal Links via `.onContinueUserActivity(NSUserActivityTypeBrowsingWeb)`,
  a separate modifier from the existing `.onOpenURL` (which only fires for
  the custom `reachradio://` scheme). Add it next to the existing modifier in
  `Reach_Radio_NativeApp.swift`, extracting `webpageURL.path` (+ query) the
  same way `.onOpenURL` extracts `url.path`, running it through the same
  allowed-character validation, and setting the same
  `navigationState.pendingDeepLink`. From that point on, existing code
  (`handlePendingDeepLinkIfReady()` → `NativeBridgeHandler.navigate`) needs no
  changes.

### 3. reach-radio-native-android — App Link intent filter + handler

- Add a second `<intent-filter>` on `MainActivity` in `AndroidManifest.xml`,
  alongside the existing `reachradio://` one, with `android:autoVerify="true"`
  and `<data android:scheme="https" android:host="reach.radio"
  android:pathPrefix="/donate" />`. Unlike `apple-app-site-association`'s
  exact-path matching (which is why the iOS JSON above lists both `/donate`
  and `/donate/thank-you` explicitly), Android's `pathPrefix` already covers
  everything under `/donate` — one entry is enough.
- Extend `MainActivity.kt`'s `handleDeepLink()`: currently it early-returns
  unless `uri.scheme == "reachradio"`. Add an `https` + host-`reach.radio`
  branch that derives the same `path` (dropping scheme/host instead of the
  custom scheme's host-as-first-path-segment quirk) and feeds it into the
  same `webView?.evaluateJavascript("window.globalActions.goToPage(...)")`
  call. Same escaping discipline applies — this URI is externally supplied.

### 4. Dependency on domain cutover

Per `GO-TO-PRODUCTION.md`, `reach.radio` DNS still points at the old Astro
site; this Next.js app is only live at `reach-radio-nextjs.vercel.app`, and
Android's shipped build still hardcodes `reach-radio-web.pages.dev`. None of
that blocks building or merging this work — same framing already used for
the Android Custom Tabs fix ("dormant until cutover, not blocked by it"):

- The `.well-known` files can be added and deployed now; they simply won't
  be reachable at `reach.radio` until DNS cuts over, at which point they
  become live with no further code change.
- The iOS entitlement and Android intent-filter can be added and shipped now;
  `apple-app-site-association`/`assetlinks.json` verification happens at
  install/update time, so it activates automatically for a given user once
  both (a) the app update ships and (b) the DNS cutover has happened — order
  between those two doesn't matter.

## Testing / verification

- **iOS:** Universal Links cannot be reliably tested in the Simulator; use a
  real device. After the DNS cutover (or via a test domain override, if one
  becomes necessary before then), confirm Apple's CDN has fetched
  `apple-app-site-association` (Settings → Developer → Universal Links can
  help diagnose association failures) and that tapping a PushPay-redirect
  link reopens the app to `/donate/thank-you` instead of Safari.
- **Android:** `adb shell pm get-app-links com.goodbarber.reachradio` to
  confirm verification status; Play Console's App Links Assistant will also
  validate `assetlinks.json` once published. Confirm the intent resolves to
  the app (not the disambiguation chooser, which usually means verification
  failed) after a real install.
- Both: confirm a donor who is **not** signed into the app already (cold
  start) still lands correctly — deep link path must survive whatever
  cold-start bridge-readiness gating each app already has (iOS:
  `bridgeState.isBridgeReady` gate already exists for this reason; confirm
  Android's WebView-ready timing handles it too).
- Confirm the existing `reachradio://` custom-scheme deep links still work
  unmodified on both platforms (regression check — this is additive, not a
  replacement).

## Gaps / open items (tracked, not blocking the plan)

1. **Android SHA-256 signing certificate fingerprint** — must be pulled from
   Play Console (App Signing key certificate), not derivable from either
   repo. Blocks finishing `assetlinks.json` but not the rest of the work.
2. **iOS Team ID / Bundle ID confirmed stable** — `9CY89P42PV` /
   `com.goodbarber.reachradio`, read directly from the current
   `project.pbxproj`. Re-verify if either ever changes (e.g. an Apple
   Developer account transfer).
3. **DNS cutover ordering** — see "Dependency on domain cutover" above; this
   is the same pre-existing, already-tracked dependency from
   `GO-TO-PRODUCTION.md` Step 4, not new to this spec.
4. **Path scope is donate-only for now** — see "Scope" above. Revisit if the
   product ever wants "any reach.radio link opens the app" more broadly.
