# Post-Donation App Reopen: Return-to-App Link

**Status:** Design-reviewed, ready for writing-plans
**Date:** 2026-09-05 (supersedes an earlier same-day draft of this spec built
around Universal Links / App Links — see "Why Universal Links don't work
here" below for why that approach was rejected before any code was written)

## Background

`/donate` (this repo) and both native apps link out to PushPay's hosted giving
page, per `2026-09-04-donate-page-link-out-design.md`. That spec identified,
but explicitly deferred, one gap:

> **Universal Links / App Links "reopen app after gift"** — deferred,
> cross-repo (this app + both native repos), post-launch.

Today, a donor who completes a gift on PushPay is redirected (via PushPay's
"Preconfigured Redirect" setting, see that spec's Gap #2) to
`https://reach.radio/donate/thank-you`. That's a plain web navigation inside
whichever in-app browser surface opened PushPay:

- **iOS:** an `SFSafariViewController` sheet layered over the app
  (`WebViewCoordinator.swift`).
- **Android:** a Chrome Custom Tab (`373e92b`, "fix: open external links in
  a Chrome Custom Tab instead of the default browser," 2026-09-04).

Neither hands control back to the native app automatically. The donor sees
the thank-you page as "a web page" and has to manually dismiss the sheet /
Custom Tab to get back to the app underneath.

## Why Universal Links don't work here

The first draft of this spec proposed Universal Links (iOS) / App Links
(Android) so the OS would intercept PushPay's redirect and reopen the app.
Two things rule that out, confirmed before any code was written:

1. **Apple suppresses this exact case.** iOS does not perform a Universal
   Link hand-off back to the app that presented the `SFSafariViewController`
   showing the link — this exists specifically to stop an app from trapping
   a user in a hijack loop. Even setting that aside, Universal Links
   generally activate on a user's tap on a link, not on a server-side HTTP
   redirect (which is exactly what PushPay's "Preconfigured Redirect" is).
2. Even if that worked, a second idea — auto-bounce via the existing
   `reachradio://` custom scheme, gated on the existing `isMobileApp`
   detection (`src/lib/utils/mobile-app.ts`) — also fails, for a different
   reason: `detectMobileApp()` relies on a `mobile-app` cookie/header that
   is set on requests made through the app's own `WKWebView`
   (`WKWebsiteDataStore.default()`, iOS) or `android.webkit.WebView`
   (Android). Both platforms keep that cookie jar **isolated** from the
   surface PushPay's redirect actually lands in:
   - iOS: `SFSafariViewController` does not share cookies with `WKWebView`'s
     default data store (changed in iOS 11, specifically for privacy).
   - Android: Chrome Custom Tabs use Chrome's own cookie jar, separate from
     `android.webkit.WebView`'s `CookieManager`.

   So `/donate/thank-you`, reached via this redirect, will never see the
   `mobile-app` signal — regardless of whether the visitor actually came
   from the app. Gating anything on `isMobileApp` here would just make it
   never fire, for anyone.

## Design

Skip detection entirely. Add one **unconditional, always-visible** link to
the existing `/donate/thank-you` page: "Have the app? Return to Reach
Radio," pointing at the app's own `reachradio://` custom scheme. Both apps'
custom-scheme handlers already ship today and already route a path to the
right place in the embedded WebView (iOS: `.onOpenURL` in
`Reach_Radio_NativeApp.swift`; Android: `handleDeepLink()` in
`MainActivity.kt`). A visitor without the app sees a link that quietly does
nothing if tapped (standard, well-understood behavior for an unregistered
custom scheme — no error dialog, no crash). A visitor with the app gets
back to it in one tap — **on Android as shipped today; iOS needs one small
addition, below.**

### iOS: the presented browser sheet must be dismissed explicitly

`WebViewCoordinator.presentSafariVC` (`WebViewCoordinator.swift:159-178`)
presents PushPay in an `SFSafariViewController` sheet layered over the
app's own UI. Nothing in the existing deep-link chain
(`.onOpenURL` → `pendingDeepLink` → `NativeBridgeHandler.navigate`) ever
dismisses that sheet. This is not a hypothetical risk — it's the standard,
well-documented requirement for any `SFSafariViewController`-based
OAuth/payment callback flow: **the presenting app is always responsible for
dismissing the sheet itself** when it detects the return URL; iOS does not
do this automatically for a same-app custom-scheme handoff. Without this
fix, tapping "Have the app? Return to Reach Radio" would navigate the
underlying WebView correctly, invisibly, behind a browser sheet that's
still covering the whole screen — indistinguishable from the link doing
nothing at all.

**Fix:** when `.onOpenURL` receives a `reachradio://` URL, dismiss whatever
view controller is currently presented before (or alongside) setting
`navigationState.pendingDeepLink` — mirroring the exact window-scene-walking
technique `presentSafariVC` already uses to *present* the sheet, run in
reverse to *dismiss* it (walk `UIApplication.shared.connectedScenes` to the
foreground `UIWindowScene`, get its key window's `rootViewController`, walk
`.presentedViewController` to the topmost one, call `.dismiss(animated:)` on
it if it exists). This is intentionally generic — "dismiss whatever's
presented," not "specifically find and dismiss the Safari VC" — because a
deep link arriving while *any* modal is covering the screen should reveal
the content underneath; there's no other modal this app presents that a
user would want preserved in preference to acting on a link they just
tapped.

### The exact URL

The link's destination is the app's root/home route (see "Destination"
below), which sidesteps a quirk worth documenting anyway since it affects
any *other* path this pattern might be reused for later: both apps' custom
scheme parsers treat the URL's *host* as the first path segment when
there's no triple slash — e.g. `reachradio://about` resolves to `/about`
because `about` is read as the host, not `reachradio:///about`'s literal
path. For the empty/root path this spec actually uses, that quirk doesn't
matter — traced against both apps' actual parsing, `reachradio://` (no
path at all) resolves to `/` on both iOS (`Reach_Radio_NativeApp.swift`'s
`.onOpenURL`: `url.path.isEmpty ? "/" : url.path`) and Android
(`MainActivity.kt`'s `handleDeepLink()`: `combinedPath.ifEmpty { "/" }`).
**Use `href="reachradio://"`** — no triple slash needed here, since there's
no path segment for the host-vs-path ambiguity to apply to.

### Placement and copy

**Design Review Findings Addressed** (ux, ia, a11y, content-editorial —
2026-09-05; see `~/.claude/skills/design-review/review-log.md`): the
sections below reflect several corrections from an initial draft that
pointed the link at the wrong destination, reused a near-duplicate label,
and omitted disclosure/contrast/tap-target details this codebase already
has established conventions for.

- **Destination:** `href="reachradio://"` — the app's home/player route,
  **not** `/donate/thank-you`. The donor is already looking at the
  thank-you confirmation; re-showing that identical screen a second time
  inside the app isn't a useful destination. This matches what
  `ListenButton` on this same page already does for web donors (sends them
  to `/`, the live player) — the app-context version of the same action.
- **Label:** **"Have the app? Return to Reach Radio"** — chosen instead of
  "Return to the Reach Radio app" for three reasons: (1) it doesn't
  duplicate `ListenButton`'s existing `aria-label="Return to Reach Radio
  player"` on the same page (a screen-reader user would otherwise hear two
  near-identical announcements for two different destinations); (2) it
  reads as conditional rather than an unconditional promise, appropriate
  since it does nothing for the large majority of visitors (web-only
  donors) who don't have the app; (3) it's plain link text serving as its
  own accessible name — no separate `aria-label` needed.
- **Visible context-switch cue:** include the same `lucide-react`
  `ExternalLink` icon already used for the Donate CTA on `/donate`
  (`src/app/donate/page.tsx`), inline with the label, `aria-hidden="true"`
  — this page already has a precedent (from `2026-09-04-donate-page-link-out-design.md`)
  for giving every context-switching link a visible icon, not just
  `aria`-only signaling (WCAG technique G201).
- **Disclosure of no-op behavior:** add an `sr-only` qualifier after the
  visible label — `<span className="sr-only"> (opens the Reach Radio app if
  installed; does nothing otherwise)</span>` — matching this site's existing
  convention for disclosing non-default link behavior (`Footer.tsx`'s
  `(opens in new tab)` pattern), extended to cover a bigger context switch
  than that pattern originally addressed.
- **Placement:** below the existing "Listen" button, as a secondary,
  smaller link — not a second competing primary CTA. Both controls now
  resolve to the same functional destination (the live player) — `Listen`
  for web donors, this link for app donors landing in the same spot inside
  the app shell — which is deliberate, not a naming inconsistency to
  resolve further: they're the same action surfaced for two different
  contexts a single donor could be in.
- **Sizing/tap target:** block-level (not inline-in-prose) with `py-3`
  vertical padding and full-width tap area on mobile
  (`w-full md:w-auto flex items-center justify-center gap-1.5`), meeting
  this project's established 44px (`h-11`) minimum touch-target convention
  (`AGENTS.md`; see `BackButton.tsx` for the existing compact-control
  pattern this follows) and giving clear separation from `ListenButton`
  above it (`mt-3` gap, matching this page's existing vertical rhythm).
- **Color/contrast:** `text-white/90 light:text-gray-600` for the visible
  label (this project's established body-copy tone-down token pair, per
  `docs/design-system.md` and used identically elsewhere on this same page
  for the gratitude paragraph) — explicitly **not** a lower-opacity/accent
  color, to avoid repeating the exact contrast gap already documented in
  `2026-09-04-donate-page-link-out-design.md`'s Gap #2 (`text-[#84b84f]` at
  ≈2.08:1 against `light:bg-gray-50`, below the 4.5:1 WCAG 1.4.3 minimum —
  that pattern "only ever shipped in a dark context"). `text-white/90` /
  `text-gray-600` against this page's actual card background
  (`bg-[#1c2128]` dark / `bg-gray-50` light) clears 4.5:1 in both themes.
- `rel="noopener"` not applicable (not `target="_blank"`); no `target`
  attribute — irrelevant for a custom scheme. Same focus-visible ring
  treatment as this project's other links
  (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`,
  per `AGENTS.md`).
- Rendered unconditionally — not gated on `detectMobileApp()`, for the
  reason established above.

## Non-goals

- No Universal Links / App Links, no Associated Domains entitlement, no
  `assetlinks.json`/`apple-app-site-association`, no Play Console SHA-256
  fingerprint, no DNS-cutover dependency. All of that is now unnecessary —
  removed from scope, not deferred.
- No Android code changes — its existing `reachradio://` handler and
  Custom Tab hand-off already bring the app forward correctly. (iOS needs
  one small addition — see "iOS: the presented browser sheet must be
  dismissed explicitly" above — this is the one native change this spec
  does require.)
- No `launchMode` change on Android's `MainActivity` (currently
  `singleTop`) to close the gap documented in Gap #3 below. That change has
  its own blast radius — it also governs the notification `ACTION_PLAY`/
  `ACTION_PAUSE` intents, widget intents, and the QS tile — and deserves its
  own isolated design/plan rather than being bundled into this fix.
- No attempt to auto-fire the custom-scheme navigation (e.g. via
  `window.location` on page load). Browsers increasingly block
  non-user-gesture navigation to external schemes, and firing it
  unconditionally for the 100% of visitors who don't have the app installed
  is pure noise with no benefit — a plain, visible, tap-to-act link is both
  simpler and more reliable.
- No detection of whether the visitor actually has the app installed before
  showing the link — not feasible without App/Universal Links (ruled out
  above), and the cost of showing it to someone without the app is a single
  inert link, not a broken experience.

## Testing / verification

- Unit/e2e: the "Have the app? Return to Reach Radio" link renders
  unconditionally on `/donate/thank-you`, regardless of `isMobileApp`
  state — it is not gated the way other app-only copy elsewhere on this
  page (e.g. the About page's app-download section) is, for the reason
  established above (the cookie/header signal `isMobileApp` relies on is
  never present on this page when reached via PushPay's redirect).
- e2e: `href` is exactly `reachradio://`, the visible label matches, and
  the `sr-only` disclosure span is present in the DOM.
- Manual, both themes: confirm the link's text meets 4.5:1 contrast against
  the card background in light and dark mode (this project has shipped the
  inverse of this check being skipped before — see the "Color/contrast"
  note above — so treat this as a required check, not a formality).
- Manual, iOS, the actual failure mode this spec exists to prevent: from
  the Donate CTA, let PushPay open in the `SFSafariViewController` sheet,
  navigate to a page hosting this link (standing in for PushPay's
  redirect), and tap it. Confirm the sheet **visibly dismisses** and the
  app's own player UI becomes visible — not just that the WebView
  navigated correctly underneath a still-open sheet.
- Manual, Android: same setup with the Custom Tab. Confirm the app comes
  forward. Then check `adb shell dumpsys activity activities` for a
  duplicate `MainActivity` instance, and press back once to see whether it
  returns to the stale Custom Tab — both are the known, accepted limitation
  in Gap #3 below, not a pass/fail condition for this plan, but worth
  confirming the actual severity matches what's documented.
- Manual regression: confirm tapping the link on a device without the app
  installed does not error or crash the browser (expected: no-op or a
  brief native "can't open this link" indicator, browser-dependent).

## Gaps / open items (tracked, not blocking the plan)

1. **PushPay redirect confirmation still pending** — this spec doesn't
   change anything about Gaps #1–#4 in the original donate spec (real
   PushPay URL, PushPay-side setup, redirect-whitelisting ambiguity,
   EasyTithe sequencing). Those remain open and unrelated to this change.
2. **No install-conversion path.** A donor without the app who taps the
   link gets nothing — no App Store prompt, no fallback page. Universal
   Links would normally provide that "deferred deep link" upsell, but since
   Universal Links don't work for this specific redirect-from-in-app-browser
   case (see above), that upsell isn't available here either. Not pursued
   further — out of scope for "reopen the app for existing users," which is
   the actual problem this spec solves.
3. **Android back-stack duplication, accepted, not fixed.** `MainActivity`
   is `launchMode="singleTop"`, which only reuses the existing instance
   when it's already at the top of the stack. The Custom Tab PushPay opens
   sits on top of it in the same task, so the `reachradio://` deep link can
   spin up a *second* `MainActivity` instance instead of reusing the first
   — the app still comes forward correctly, but a stale Custom Tab (showing
   the thank-you page) is left in the back stack, reachable by pressing
   back once. Fixing this properly means changing `launchMode` (most likely
   to `singleTask`), which also affects the existing notification
   `ACTION_PLAY`/`ACTION_PAUSE` intents, widget intents, and the QS tile —
   a distinct design decision with its own blast radius, not a one-line
   change to bundle into this fix. Revisit as its own plan if manual
   testing (see Testing/verification above) shows this matters in practice
   more than expected.
