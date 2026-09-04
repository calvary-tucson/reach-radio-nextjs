# Donate Page Redesign: Link-Out to PushPay (Next.js)

**Status:** Design-reviewed (ux/ia/a11y/editorial, 14/14 findings accepted and folded in) — ready for writing-plans
**Date:** 2026-09-04

## Background

Reach Radio is switching donation processors from EasyTithe to PushPay. The
current `/donate` page (`src/app/donate/page.tsx`) embeds the EasyTithe form
as a cross-origin `<iframe>` (`forms.ministryforms.net`), with iFrameResizer
plumbing, a postMessage handshake for focus/blur, and a 10s load-timeout
fallback.

PushPay does not support this. Its Embedded Giving product still renders the
form fields inside a fixed white box that cannot be restyled, and being a
cross-origin iframe, no CSS on our side can reach inside it regardless.

Decision: stop embedding the donation form on-site. Redirect to PushPay's own
hosted giving page instead, and put design effort into making that hand-off
feel intentional. `reach-radio-web` (the Astro site) already shipped this
exact change — see its
`docs/superpowers/specs/2026-09-01-donate-page-link-out-design.md` and
`2026-09-01-donate-page-native-redesign-design.md` — and went through a full
design-review pass (ux/ia/a11y/editorial) there. This spec adapts that
already-reviewed structure to this project's own design system and native
bridge architecture, which differ from the Astro site's in several material
ways (see "Differences from the reach-radio-web precedent" below).

### Native app research (verified against actual source, this session)

- **iOS** (`reach-radio-native-ios/Reach Radio Native/Bridge/WebViewCoordinator.swift`):
  `decidePolicyFor` intercepts any top-level navigation to a host that isn't
  the current host or in `AppConfig.allowedExternalDomains`, cancels it, and
  presents an `SFSafariViewController` sheet over the app. `createWebViewWith`
  does the same for `target="_blank"`/`window.open`. **Both a plain link and
  a `target="_blank"` link produce the same in-app browser sheet on iOS** —
  dismissible, never backgrounds the app. `main` branch already points at
  `reach-radio-nextjs.vercel.app` / `reach.radio`, so this page reaches iOS
  users as soon as it ships.
- **Android** (`reach-radio-native-android/.../MainActivity.kt`):
  `shouldOverrideUrlLoading` intercepts the same way, but hands off via a bare
  `Intent(Intent.ACTION_VIEW, url)` — there is no `WebChromeClient`,
  `onCreateWindow`, or `androidx.browser` (Custom Tabs) dependency anywhere in
  the project. This opens the user's default browser app, fully backgrounding
  Reach Radio, rather than an in-app sheet. Confirmed via Chrome's own
  guidance that Custom Tabs is the recommended pattern for exactly this case
  (first-party app linking to third-party web content) and that a full
  external-browser launch is "a heavy context switch" —
  [Chrome for Android Custom Tabs](https://developer.chrome.com/docs/android/custom-tabs/).
  **Android `main` still hardcodes `WEB_DOMAIN = "reach-radio-web.pages.dev"`**
  (the old Astro site) — this new page will not be reachable from the shipped
  Android app until the domain/URL cutover in `GO-TO-PRODUCTION.md` Step 3
  happens. Testing against Android must use the `bridge-testing` branch +
  tunnel, not assume prod parity.
- **Neither app's `allowedExternalDomains` allowlist includes a PushPay
  domain** (Android: `forms.ministryforms.net`, `login.ministryid.com`; iOS:
  same two). This is correct and must stay that way — adding PushPay's domain
  to either allowlist would trap it inside the WebView instead of handing it
  to the native browser surface.
- **Both native apps have their own top-level "Donate" tab**
  (`BottomNavigationBar.swift` on iOS, `NavigationBar.kt` on Android) —
  confirmed, not assumed. `/donate` is reached the same way `/`, `/teachers`,
  `/about` are: a native tab, not a same-tab drill-down link. No back-button
  affordance is needed on this page.

### External research

- **Donation-redirect trust cost:** off-domain redirects to an unbranded
  third-party processor are the costliest documented donation-page mistake —
  roughly 1-in-6 donors abandon when sent to an external payment page. Best
  practice is to avoid it when possible (not possible here, per PushPay's
  embed limits) and, when unavoidable, make the opt-in deliberate (no
  auto-redirect) and set expectations clearly before the click —
  [Donation Page Structure Best Practices](https://www.depositfix.com/blog/donation-page-structure),
  [Donation Page Mistakes](https://morweb.org/post/Donation-Page-Mistakes-Costing-Nonprofits-Thousands).
  This raises the stakes on the mission/trust content below — it's the
  specific mitigation for a documented risk, not decoration.
- **WCAG new-window warnings (G200/G201):** a warning that a link opens a new
  context should be **visible**, not just carried in `aria-label`/
  `aria-describedby` —
  [G201](https://www.w3.org/WAI/WCAG21/Techniques/general/G201). The CTA
  design below puts a visible external-link icon inline with the button's
  visible label, plus a visible reassurance sentence next to it, rather than
  relying on screen-reader-only text.

## Differences from the reach-radio-web precedent

1. **Light/dark theme parity.** reach-radio-web is dark-only. This app has a
   full light/dark theme system (`light:` Tailwind variant used throughout,
   `ThemeProvider`). None of the Astro spec's color decisions carry over
   1:1 — every surface on the new pages needs an explicit `light:` token per
   `docs/design-system.md`, and contrast must be checked in both themes.
2. **No BackNav needed.** The Astro app's native shell supplies no chrome at
   all, so its `/donate` needed a bespoke `BackNav`. This app's native shells
   supply their own tab bar (confirmed above) and this app's own
   `BackButton`/`Breadcrumbs` pattern is reserved for drill-down pages
   (teacher detail, privacy policy), not top-level nav destinations. `/donate`
   is top-level. Nothing to add.
3. **Rebuild, not strip-down.** The current `src/app/donate/page.tsx` is a
   `'use client'` component built entirely around the iframe (postMessage
   handshake, iFrameResizer script tag, retry timers, `useMediaStore` hook
   directly). The newer pattern this codebase has since adopted (see
   `src/app/about/page.tsx`) is a server component using `<ShowMediaBar />`.
   The rebuild follows that pattern rather than deleting iframe code from the
   existing client component.
4. **Existing reusable primitives.** This project already has an "Info Chip"
   pattern (`bg-[rgba(132,184,79,0.1)] border border-[rgba(132,184,79,0.2)]
   text-[#84b84f]`) for the stats strip, and a "Primary CTA Button" pattern
   (`bg-[#84b84f] hover:bg-[#96cc5e] text-[#0a1305] rounded-full font-bold`)
   already used on teacher panels — reused here instead of inventing new
   button/chip styling. `lucide-react` (already a dependency) supplies the
   `ExternalLink` icon instead of a bespoke SVG icon file.

## Goals

- Replace the embedded EasyTithe iframe with a redesigned `/donate` that
  links out to PushPay's hosted giving page, following this project's own
  design system (not a port of reach-radio-web's dark-only visual language).
- Make the on-site page substantive (mission/impact content, stats strip) so
  donors have context and trust before leaving the site — the documented
  mitigation for redirect drop-off.
- Provide a branded `/donate/thank-you` landing page for PushPay's post-gift
  redirect.
- Fix the Android in-app link hand-off (`Custom Tabs` instead of a bare
  `ACTION_VIEW` intent) as a small, separate, same-plan task in
  `reach-radio-native-android`.
- Simplify: remove all iframe-specific plumbing that no longer applies.

## Non-goals

- No funds/designation picker, text-to-give, or mail-in-check sections — only
  one-time and recurring giving apply.
- No PushPay API integration to read/display payment details on the
  thank-you page (PushPay appends a payment token + `sr` param on redirect;
  parsing it is a future enhancement).
- No Android/iOS Universal-Links "reopen the app after giving" setup —
  deferred, cross-repo, post-launch (same as reach-radio-web).
- No changes to `allowedExternalDomains` in either native app — PushPay's
  domain must NOT be added to either allowlist.
- iOS native code changes — iOS already gets the good hand-off (verified
  above); nothing to fix there.

## Design

### 1. `/donate` — content structure

Server component (`src/app/donate/page.tsx`), following the `/about` pattern
(`<ShowMediaBar />`, `detectMobileApp()`), max-w-2xl centered container per
this project's established narrow-page convention:

1. **Hero** — `<h1>` **"Donate"** (design-review, editorial: every page on
   this site with a visible `<h1>` uses the nav label verbatim — `donate/page.tsx`
   today, `teachers/page.tsx` — not a marketing headline; keeping this
   consistent means the warmer copy moves to the subhead instead), using the
   existing page-`<h1>` token (`text-[22px] md:text-4xl font-extrabold
   text-white light:text-gray-900 tracking-tight`) + one-line subhead
   ("Support Reach Radio — your gift keeps Bible teaching and gospel music on
   the air across Tucson." — **"gospel music," not "Christian music"**
   (design-review, editorial: matches this site's own established
   terminology in `page.tsx`, root `layout.tsx` metadata, `RadioStationSchema.tsx`'s
   genre list, and the About page's visible body copy — all say "gospel,"
   not "Christian music," which this site doesn't otherwise use to describe
   itself)).
2. **Stats strip** — reuse the existing "Info Chip" accent variant for
   `690AM · 106.7FM`, `24/7`, `Tucson, AZ` (`flex flex-wrap gap-2`). **Before
   this ships, add explicit light-theme tokens to the accent variant itself**
   (design-review, a11y, site-wide fix — not a donate-page override): computed
   contrast of `text-[#84b84f]` over the tinted `bg-gray-50` light background
   is ≈2.08:1, well under the 4.5:1 WCAG 1.4.3 minimum for this text size (it
   passes ≈5.8:1 in dark mode, which is why this has never been caught — the
   pattern has only ever shipped in a dark context). Add e.g.
   `light:bg-green-100 light:border-green-300 light:text-green-700`-style
   tokens (computed to clear 4.5:1) directly to `TeacherInfoChip.tsx`'s
   `accent` variant, and update the `docs/design-system.md` Info Chip entry
   so future reuse doesn't repeat the gap.
3. **Mission/impact card** — `bg-[#1c2128] light:bg-gray-50 border
   border-white/5 light:border-gray-200 rounded-[18px] p-5 md:p-6`, `<h2>`
   with the existing `border-l-4 border-l-[#84b84f]` accent-bar heading
   ("Keeping the Gospel on the Air, 24/7"), with this copy below it
   (design-review, editorial: the spec must not leave this unwritten — it's
   the documented mitigation for redirect-abandonment risk, the highest-stakes
   place to under-specify): "Every gift keeps 690AM and 106.7FM on the air,
   reaching drivers, shut-ins, and anyone within range of a radio — no app,
   login, or subscription required. Your support covers the airtime,
   equipment, and staff that make that possible, day and night."
4. **CTA card** — signature "on-air" moment: small pulsing dot + thin
   waveform-bar divider (both `aria-hidden="true"`, `motion-safe:` guarded),
   then the **"Donate"** button (single word, matching the `<h1>`/nav label —
   design-review, editorial: dropping "Now" avoids stacking two different
   labels for the same action on one page):
   - Reuses the existing Primary CTA Button pattern
     (`bg-[#84b84f] hover:bg-[#96cc5e] text-[#0a1305] rounded-full font-bold`),
     `w-full` on mobile/app, `md:w-auto` at `md`+.
   - Visible `lucide-react` `ExternalLink` icon inline with the label (WCAG
     G201 — visible warning, not aria-only).
   - `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`
     per this project's a11y rule (AGENTS.md), not the Astro precedent's
     `focus-visible:outline` pattern.
   - **Reassurance line — resolved to a real two-way branch, not a single
     variant** (design-review, editorial + ux: the prior draft of this
     section talked itself into one universal copy variant via a
     self-reversing parenthetical, and the "confirmed for both" claim only
     holds for iOS. Android's `MainActivity.kt` still hands off via a bare
     `ACTION_VIEW` intent — no Custom Tabs yet — which fully backgrounds the
     app, not "stays right where you left it." `detectMobileApp()` can't
     distinguish iOS from Android server-side without new plumbing this spec
     doesn't add — see gap #11 — so the app-branch copy must stay accurate
     for the *weaker* case, Android, rather than the stronger one, iOS, until
     that fix ships and adopts):
     - **Web:** "Give once or set up recurring giving — you'll finish on
       PushPay's secure site, which opens in a new tab. Reach Radio stays
       right where you left it." ("opens in a new tab," not "opens
       separately" — design-review, editorial: matches this site's one
       existing external-link warning wording, `Footer.tsx`'s `(opens in new
       tab)`, and is more literally accurate for the web path specifically.)
     - **App:** "Give once or set up recurring giving on PushPay's secure
       site." — no "stays right where you left it" claim, true today on both
       platforms regardless of which native browser surface actually
       appears.
5. **CTA hand-off mechanic** — branch on `detectMobileApp()`:
   - Web: `<a href={PUSHPAY_GIVING_URL} target="_blank" rel="noopener
     noreferrer">`, matching this site's existing external-link convention.
   - App: `<a href={PUSHPAY_GIVING_URL} rel="noopener noreferrer">` — no
     `target`, so both native interceptors (`decidePolicyFor` on iOS,
     `shouldOverrideUrlLoading` on Android) reliably catch it as a top-level
     navigation.
   - `PUSHPAY_GIVING_URL` — named const, placeholder value
     (`https://pushpay.com/g/PLACEHOLDER-reach-radio`), swapped in before
     launch.

No loading skeleton — static SSR content, nothing to wait on.

### 2. `/donate/thank-you`

New route, same visual language (mission card treatment wrapping the whole
block), server component with `<ShowMediaBar />`:

- **Own `metadata` export, not inherited from `/donate`** (design-review, ia:
  `donate/layout.tsx`'s `metadata` — title "Donate", `alternates.canonical:
  '/donate'` — shallow-merges across the subtree per this project's own
  Next.js docs, so without its own export `/donate/thank-you` would resolve
  with title "Donate" and a canonical pointing at the donation form, not
  itself). Give this route its own `title: 'Thank You'`, its own
  description, `alternates: { canonical: '/donate/thank-you' }`, and
  `robots: { index: false }` (it's transactional, already excluded from the
  sitemap, and shouldn't attract direct search traffic with a mismatched
  identity).
- `<h1>` "Thank You" + one-line gratitude copy: "Thank you — your gift helps
  keep Bible teaching and gospel music on the air across Tucson." (design-review,
  editorial: written now rather than left as placeholder structure, same
  reasoning as the mission-card copy above).
- **"Listen"** → `/`, `w-full` mobile / `md:w-auto` desktop, primary style.
  **Web-only refinement** (design-review, ux: on desktop/mobile web this page
  lands in a literal second browser tab disconnected from the original
  `/donate` tab — sending "Listen" to `/` reloads the whole app a second time
  in that new tab rather than returning the user anywhere): if `window.opener`
  is present, "Listen" calls `window.close()` to return to the original tab
  instead of navigating to `/`. Browsers restrict `window.close()` to
  script-opened tabs and silently no-op otherwise, so this must degrade
  gracefully — feature-detect (`window.opener` truthy) before attempting it,
  and if the tab is still open a moment later, fall through to a normal `/`
  link rather than leaving a dead button. Falls back to a normal `/` link
  whenever no opener exists at all (direct visit, in-app browser sheet,
  `noopener` context) — this is a `'use client'` concern scoped to this one
  button, not a layout change.
- **"Follow on Facebook" — app-only, not shown on web** (design-review, ia:
  the citation for this CTA was wrong — `Footer.tsx` has no social links at
  all; the real Facebook link lives in `Header.tsx`/`MobileHeader.tsx`,
  rendered globally on every non-app web page. Showing this CTA on web would
  duplicate that persistent header link in the same viewport. `Header`/
  `MobileHeader` are suppressed in-app, so there this is the only instance —
  gate it to the existing `isMobileApp` branch already used for the CTA
  hand-off mechanic on this page, rather than showing it unconditionally.
  Note this is deliberately new visible-text copy, not a ported label — the
  existing Header/MobileHeader instance is icon-only with accessible name
  "Reach Radio on Facebook," not visible text.) Same visible external-link
  treatment as the Donate CTA (design-review, ux + a11y: the prior draft gave
  Donate a visible `ExternalLink` icon citing WCAG G201 but omitted it here
  for the identical external-context-switch interaction) — visible
  `ExternalLink` icon inline with the label; plain link (no `target`) since
  this only ever renders in-app.
- PushPay's payment token / `sr` param on redirect is not read (non-goal).

### 3. Cleanup — removed from current implementation

- `<iframe id="donation-iframe">` and its loading-skeleton markup.
- The 10s load-timeout / retry / error-fallback logic entirely.
- `<Script src="/js/iFrameResizer.min.js">` and the `window.iFrameResize`
  global type declaration.
- The `message` event listener for `donationFormInputFocus`/`Blur`.
- The `'use client'` directive + `useMediaStore` direct usage — replaced by
  the server-component + `<ShowMediaBar />` pattern.
- Check whether `public/js/iFrameResizer.min.js` has any other consumer
  before deleting the file (grep first — unlike reach-radio-web's `_headers`
  file, this hasn't been confirmed single-purpose yet).

### 4. Android native fix (separate repo, same plan)

`reach-radio-native-android`, `MainActivity.kt`'s `shouldOverrideUrlLoading`
else-branch (currently `Intent(Intent.ACTION_VIEW, url)` +
`startActivity`): add `androidx.browser` (Custom Tabs) as a dependency, build
a `CustomTabsIntent` and call `.launchUrl(context, url)` instead. Scoped to
that one fallback path — no change to `allowedExternalDomains`, no change to
`initialDomain` handling for in-app content.

### 5. Testing / verification

- Manual browser check against both themes (dark default + light) at mobile
  and desktop widths, per this project's `/verify` practice.
- Keyboard check: tab to CTA, confirm visible focus ring at sufficient
  contrast against the card background, in both themes.
- Stats-pill and CTA contrast check against actual chosen shades in **both**
  themes (not just dark, unlike the Astro precedent).
- `detectMobileApp()` branch: unit test that the app path omits `target`,
  the web path includes `target="_blank"`, and reassurance copy matches the
  branch (no "stays right where you left it" claim in the app copy).
- Thank-you page: unit/e2e test that "Follow on Facebook" renders only when
  `isMobileApp` is true, and that "Listen" falls back to a plain `/` link
  when no `window.opener` is present.
- Manual click-through once the real PushPay URL exists: web opens a new
  tab, correct URL, completed gift lands on `/donate/thank-you`.
- Confirm in the actual apps (via `bridge-testing` tunnel setup for Android,
  since Android `main` doesn't yet point at this app) that tapping the CTA
  opens the expected native surface — `SFSafariViewController` on iOS,
  Custom Tab on Android post-fix.
- `npm run build`, `npm run lint`, `tsc` clean.

## Gaps / open items (tracked, not blocking the plan)

1. **Real PushPay URL** — placeholder const swapped in before launch; blocks
   real end-to-end click-through testing until then.
2. **PushPay-side setup, outside code:** create the giving page, set Giving
   Page Settings branding (bg color/image, to soften PushPay's own white-box
   hop as much as their settings allow), create a Preconfigured Redirect Key
   → `https://reach.radio/donate/thank-you`, obtain the final URL with
   `ru=` (and optional `sr=` campaign tag).
3. **PushPay redirect-whitelisting ambiguity** — PushPay's docs say
   third-party API integrators must email `api@pushpay.com` to whitelist
   redirect URLs; unclear whether merchant-admin Preconfigured Redirects need
   this too. Confirm with PushPay support during setup.
4. **Sequencing risk with the old EasyTithe form.** Don't ship the link-out
   pointing at a placeholder in production — confirm whether EasyTithe stays
   live until the real PushPay URL is ready, or whether this needs to be
   deployed behind a flag / merged-but-not-live until the URL is real.
5. **Two live `/donate` pages simultaneously? — checked, currently no.**
   `reach.radio` DNS still points at reach-radio-web (this Next.js app is
   only live at `reach-radio-nextjs.vercel.app`, per
   `GO-TO-PRODUCTION.md`), so reach-radio-web's `/donate` is the one real
   donors hit today. Verified reach-radio-web's own PushPay redesign is
   **not deployed either** — its local `master` is 23 commits ahead of
   `origin/master` plus uncommitted changes, all unpushed. Both versions are
   pre-launch; no active divergence risk right now. Re-check this assumption
   before either one ships, and make sure both eventually agree on the same
   real `PUSHPAY_GIVING_URL` and thank-you redirect target once DNS cuts
   over.
6. **Android production readiness mismatch.** Android `main` still hardcodes
   `reach-radio-web.pages.dev` — this new page is invisible to shipped
   Android users until the domain/URL cutover (`GO-TO-PRODUCTION.md` Step 3).
   The Android Custom Tabs fix (section 4 above) can and should still be
   merged now — it's dormant until cutover, not blocked by it — but end-to-end
   verification against a real Android build has to happen via the
   `bridge-testing` tunnel, not assumed from prod.
7. **Android Custom Tabs fix rollout lag.** Once merged, it still needs a
   Play Store release + user update adoption before all Android users get
   the improved hand-off. Not a blocker, just non-uniform for a while.
8. **Re-verify `allowedExternalDomains` once the real PushPay URL is known**
   — currently correct (PushPay's host isn't in either allowlist), but this
   should be a explicit checklist item during final QA, not just an
   assumption that holds forever.
9. **No existing tests for `/donate`** in this repo — everything in the
   Testing section above is net-new coverage, nothing to port forward.
10. **Universal Links / App Links "reopen app after gift"** — deferred,
    cross-repo (this app + both native repos), post-launch, same as
    reach-radio-web's own deferral.
11. **`detectMobileApp()` can't distinguish iOS from Android.** It's a single
    boolean from a shared header/cookie set by both native shells. The
    reassurance-copy resolution above (section 1, CTA card) has to write for
    the weaker case (Android's current `ACTION_VIEW` hand-off) rather than
    the stronger one (iOS's `SFSafariViewController`) as a result. If a
    reliable platform signal already exists somewhere in the bridge contract,
    revisit this — iOS users are currently getting a more conservative claim
    than their actual experience supports. Not worth adding new plumbing
    just for this one line of copy.
