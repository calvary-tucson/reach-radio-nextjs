# iOS keyboard focus triggers WebKit fixed-position paint desync

**Status:** RESOLVED and committed 2026-07-06 (`0d2b8aa`, `0912668`). Awaiting on-device confirmation before closing the tracking memory.

**Applies to:** any full-height `position:fixed`/`position:absolute` overlay or sheet on iOS Safari or a WKWebView-based app, whenever it contains an input/textarea that gets programmatically focused. Relevant to `reach-radio-native-ios` / `reach-radio-native-android` WebView wrappers and any future project embedding web content in a native shell.

**Provenance note:** this doc merges two independent writeups of the *same* bug from two different sessions/repos that converged on the identical fix without coordinating:
- The web-side debugging trail (`reach-radio-nextjs`, sessions 2-4, see [[project-search-sheet-focus-ios]] memory) — root-caused the paint desync with on-device `getBoundingClientRect`/`getComputedStyle` numbers, ruled out 6 fix categories, but stalled before finding `preventScroll` and handed off to the native side.
- A `reach-radio-native-ios` session's writeup (`docs/bugs/ios-webview-keyboard-fixed-position.md`, now merged and deleted) — found `preventScroll` independently, plus native/WKWebView-specific debugging footguns not visible from the web side.

Where the two accounts describe the same mechanism, the numbers/evidence are consistent across both — that agreement is itself useful signal that the root cause is correctly identified, not an artifact of one session's environment.

## Symptom

A full-screen search sheet (`position:fixed`, `h-[100dvh]`) rendered correctly on every open *except* the very first keyboard focus after a fresh page load. On that first focus only, the sheet rendered cramped — only ~1 result visible, page content bleeding through below the cutoff. Dismissing the keyboard and refocusing rendered correctly from then on, every time.

## Root cause

Focusing an input inside a `position:fixed` sheet fires WebKit's native "auto-scroll ancestor to reveal the focused input" behavior — a browser-internal `window.scrollTo`/`visualViewport` adjustment, not something your app's code issues. On a **fresh page**, that scroll happens concurrently with the keyboard's own visual-viewport resize (the address bar is also still collapsing). The two compound transitions racing each other left WebKit's compositor in a desynced state: computed style said `top: 337px` (a compensating value our own code had applied), `getBoundingClientRect()` on the wrapper still measured `top: 0`, and the inner `role="dialog"` child measured `top: -337` — painted 337px too high, with only its bottom portion inside the visible `0..358` window (matching the keyboard-open visual viewport height). On a **second** focus (address bar already settled, only the keyboard resizing), there's no compound transition to race, so it paints correctly — which is exactly why the bug was maddeningly first-open-only.

The document-level scroll jump was the first clue (`windowScrollY` 0 → ~677px on focus) — but it's an important trap: **this is not the same thing as a missing body scroll-lock.** `overflow:hidden` / pinning `<body>` via `position:fixed` blocks *touch*-driven scroll. It does not block WebKit's own programmatic scroll-into-view-on-focus, which fires regardless of any scroll lock. Locking the body (tried first) measurably did not stop the jump.

## Fixes tried and ruled out

All of these treated the scroll as an unstoppable environmental fact and tried to compensate for its downstream effect, rather than removing its trigger:

1. **Body/html scroll lock** (`position:fixed` on `<body>`) — doesn't touch it; `windowScrollY` still jumped with the lock active.
2. **`top` CSS synced to `visualViewport.offsetTop`** — React/DOM state updated correctly but `getBoundingClientRect()` didn't reflect it on first paint (the actual desync).
3. **`transform: translateY()` instead of `top`** — same desync, plus caused a separate performance regression (page became sluggish, suspected containing-block interaction with a dev-only mutating attribute).
4. **Height-matching instead of top-offset** — ruled out on the DOM-geometry evidence (wrapper/scrollBox were byte-identical between broken and correct renders — the bug is paint, not layout geometry).
5. **Programmatic `blur()` + `focus()` replay** — confirmed via console: regains DOM focus but does **not** reopen the iOS keyboard. Script-triggered `.focus()`, regardless of origin (page JS or a native `evaluateJavaScript` call from a WKWebView), only reopens a *closed* keyboard if it's synchronously chained from a live user touch gesture. This rules out any native-side trick that just calls back into the DOM input's `.focus()`.
6. **`position:absolute` instead of `fixed`** — made it worse; reintroduced sensitivity to the underlying forced document-scroll that `fixed` is normally immune to.
7. **Forced-repaint scroll nudge** (`scrollBy(0,-1)` then `scrollBy(0,1)` on `visualViewport.resize`) — fired at the right moment, no effect on final paint.

## Actual fix

Stop the scroll from ever happening, at its source, instead of reacting to it:

```ts
input.focus({ preventScroll: true })
```

Applied at **every** focus call site in the chain (`PassiveSearchBar.tsx`'s initial open, and all focus calls in `SheetChrome.tsx`'s mount-focus effect + `guardFocus` reclaim helper). `preventScroll: true` is a standard `HTMLElement.focus()` option — it tells the browser "move focus here, but skip your default scroll-into-view behavior." With no scroll, there's no race with the keyboard's viewport resize, so the downstream WebKit paint desync never gets a chance to occur.

Kept as defense-in-depth, not as the primary fix: a `useVisualViewportOffset` hook (syncs the sheet's `top` to `window.visualViewport.offsetTop`) stays wired in `SheetChrome.tsx` and `@modal/layout.tsx`'s overlay — useful for any *other* path that might still shift the visual viewport, but it alone was never sufficient (see ruled-out #2/#3 above).

## Where the two writeups agreed vs. added distinct value

| | Web-side (this repo, sessions 2-4) | Native-side (`reach-radio-native-ios` session) |
|---|---|---|
| Root cause | Same: WebKit native scroll-into-view-on-focus racing keyboard viewport resize | Same, described independently |
| Evidence | On-device `getBoundingClientRect`/`getComputedStyle` rects, exact pixel numbers (`top:337` vs `top:0` vs `top:-337`) | Confirmed reproduces in both mobile Safari **and** a native WKWebView — ruled out "WKWebView address-bar" as a variable, since WKWebView has no address bar at all |
| Fix found | Not found — 7 categories ruled out, stalled, handed off | Found `preventScroll: true` independently |
| Unique contribution | Precise paint-vs-layout desync mechanism (wrapper vs. dialog child disagreeing internally) | WKWebView-specific debugging footguns (cache purge, version-gate skip, harness hygiene) — see below |

The confirmation that this reproduces in a WKWebView with no address bar at all is worth calling out on its own: it rules out "address-bar-collapse" as a *necessary* part of the compound transition (the web-side root cause write-up initially framed it as address-bar-collapse + keyboard-rise). The actually-necessary condition is just: fixed-position layer + first-ever keyboard-driven `visualViewport` transition on that page load, address bar involved or not.

## Checklist for the next project with this architecture

- Any full-height/fixed-position sheet with an autofocused input needs `preventScroll: true` on **all** of its focus calls, not just the obvious one — a single missed call site (fallback timer, MutationObserver branch, focus-guard reclaim, etc.) still leaves a scroll trigger live.
- If you already built a `visualViewport`-tracking repositioning hook to fight this bug, you can leave it in as a no-op safety net, but the real fix is removing the scroll trigger, not compensating for its side effects after the fact.
- **Test cold first-focus specifically**, on a fresh page load, not a warm reload. Second-focus-onward almost always looks fine regardless of whether the bug is actually fixed — it's easy to "fix" this by accident of test timing and ship it still broken.
- A large, sudden `window.scrollY` jump immediately after `.focus()` on a fixed-position container is WebKit's native focus-reveal scroll, not a scroll-lock gap — don't reach for a stronger body/html scroll lock, it won't touch this.

## Native-side lessons (WKWebView-wrapper debugging)

Surfaced while diagnosing this bug from the native iOS wrapper app pointed at a dev tunnel — worth flagging for any future native-wrapper debugging session, independent of this specific bug:

1. **WKWebView has its own disk/memory cache**, entirely separate from mobile Safari's. Restarting the dev server, or even a hard-reload in Safari's own devtools, does nothing to it. If you're chasing "why does the device still show old JS after I changed the code," suspect this first — force a purge via `WKWebsiteDataStore.default().removeData(ofTypes:modifiedSince:)`.
2. **A same-version rebuild+reinstall on a physical device does not clear app data.** If the app has "purge WKWebView cache on version bump" logic gated on `CFBundleShortVersionString` (reasonable for production upgrades), that gate silently skips the purge across every debug rebuild during a single dev session — Xcode's incremental install doesn't touch `UserDefaults` or the website data store. Temporarily force the purge unconditionally while debugging, and remember to restore the version-gate afterward.
3. If you repurpose a native wrapper as a disposable test harness for a web-side bug (pointing its fallback URL at a different dev tunnel to get a real on-device WKWebView + Safari Web Inspector combo, without standing up a separate test app), track every temp-patched file explicitly and revert as a batch once the repro is confirmed — easy to lose track of which files are "real" vs. harness-only after several rounds.

## Generalizable lesson for future WebView/mobile-web projects

- **A large, sudden `window.scrollY` jump immediately following a `.focus()` call, on a fixed-position container, is WebKit's native focus-reveal scroll — not a scroll-lock gap.** Don't reach for stronger body/html scroll locks to fix it; they operate on touch-driven scroll and won't stop this.
- **The fix is at the call site of `.focus()`, not in CSS or in a scroll-lock layer.** `{ preventScroll: true }` removes the trigger entirely. Check every `.focus()` call in the interaction chain — a single missed call site (e.g. a fallback/guard path) can leave the bug intact.
- **A script-triggered `.focus()` cannot reopen an already-dismissed iOS keyboard**, even from native code via `evaluateJavaScript`. Any keyboard-reopen must be chained synchronously from a live user gesture. This rules out an entire class of "just refocus it" fixes, on both the web and native sides of a WebView wrapper.
- **When a CSS-geometry hypothesis is falsified twice** (state/computed-style is correct but `getBoundingClientRect()` disagrees), stop iterating on CSS/JS geometry compensation — it's a paint bug, not a layout bug, and no amount of correct computed style will fix a paint that already desynced.
- If a native WKWebView wrapper hits this same symptom independent of any web-side fix, check whether the WebView's own frame/`scrollView.contentInset` can be adjusted directly from `UIResponder.keyboardWillShowNotification`, sidestepping page-side compositor behavior entirely — but try `preventScroll` on the web side first, since it fixes this at zero cost to either side and doesn't require native changes.
