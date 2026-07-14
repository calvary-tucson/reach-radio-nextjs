# About Page Native Focus Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the platform-native focus-style pattern (built for the Teachers search field, commit `a88abc1`) to the About page's Contact form fields, so `name`/`email`/`message` also get iOS/Android-native focus treatment instead of a web-style glowing ring inside the native-wrapped app. Task 1 is not just prep for that extension — it's a standalone fix for a live regression: on real Android sessions today, the already-shipped Teachers search field has the exact stacking bug this plan was almost about to copy forward (ring not suppressed + green border added on top, instead of the clean override). Task 1 should land and be verified even if Tasks 2-3 get deprioritized.

**Architecture:** The existing mechanism lives in three places: (1) a pre-paint `<html>` class script in `src/app/layout.tsx` that tags `.native-app` (either platform) and `.native-android` (Android only) before first paint, (2) CSS overrides in `src/app/globals.css` keyed off those classes plus a `[data-search-input]` attribute selector, (3) the Tailwind `focus-visible:ring-2 focus-visible:ring-ring` utility left in place on the input for plain web. This plan first fixes a real gap in (1) discovered during planning (Android never reliably gets `.native-app`, only `.native-android` — see Task 1), then generalizes step (2)'s attribute selector so it also matches a new, reusable `data-native-focus` attribute, then adds that attribute to the About page's Contact form's three text fields.

**Tech Stack:** Next.js 16 / React 19 / Tailwind CSS v4 (CSS-first config, `@theme`/`@custom-variant` in `globals.css`) / Playwright MCP for visual verification (no automated visual-regression suite in this repo).

## Global Constraints

- Plain web (desktop keyboard users, unwrapped mobile Safari visitors) must keep the full `focus-visible:ring-2 focus-visible:ring-ring` per AGENTS.md's a11y rule — the native-only override must never leak onto ungated `.native-app`/`.native-android` classes.
- Don't rename or remove the existing `[data-search-input]` attribute on `TeacherSearchBar`'s input — `PassiveSearchBar.tsx` uses `document.querySelector('[data-search-input]')` to find and focus it; that's load-bearing DOM-query behavior, not just styling.
- Don't assume `reach-radio-native-android` will fix this from its side. Per the user (2026-07-06): the Android native app hasn't had the overhaul `reach-radio-native-ios` got and isn't being touched in this pass — it'll eventually borrow lessons from the iOS rework, but on an unknown timeline. The web-side fix in Task 1 must be self-sufficient against Android's *current*, unmodified behavior (HTTP header on initial request only, no synchronous `window.inNativeApp`-equivalent global) — don't design around a future Android change that hasn't happened.
- Every task must end with: `npx tsc --noEmit -p .` clean, `npx eslint <changed files>` clean (ignore the 1 pre-existing `react-hooks/set-state-in-effect` error in `TeacherSearchBar.tsx:16` and the 2 pre-existing vitest failures in `contact-sheet.test.tsx`/`contact-form-on-success.test.tsx` — both unrelated, do not attempt to fix them here), `npx vitest run` showing no *new* failures beyond those 2.
- Commit using this repo's conventional-commit scopes (`bridge` for the `layout.tsx` pre-paint-script fix, per `AGENTS.md`'s scope table — it's native-bridge platform detection, not modal-specific; `about` for `ContactForm.tsx` changes; the shared `globals.css` generalization is cross-cutting — use `modal` scope since the mechanism lives alongside the existing native-focus modal work from `a88abc1`).
- The dev server on `:3000` is owned by another session — do not restart or kill it (see `feedback-dont-manage-other-sessions-dev-server` memory). Use it read-only for Playwright verification.

---

## Task 1: Fix `.native-app` never being set on Android (gap in `a88abc1`)

**Files:**
- Modify: `src/app/layout.tsx:149`

**Interfaces:**
- Consumes: nothing new — same `window.Android`/`window.inNativeApp`/`mobile-app` cookie signals the script already checks.
- Produces: a guarantee that `.native-android` is never present on `<html>` without `.native-app` also being present, in the same synchronous pre-paint script. Task 2 and Task 3's CSS rely on this guarantee — without it, the Android-only case (`.native-android` set, `.native-app` not set) matches only the accent-border rule and NOT the ring-suppressing rule, stacking a green border on top of the still-visible Tailwind ring.

**Why this is real, not theoretical:** `reach-radio-native-android`'s own docs (`IMPROVEMENT-PLAN.md:338`) confirm Android sends a `mobile-app: true` HTTP header on the WebView's initial request — it does **not** set `window.inNativeApp` (that's iOS-only, injected via a `WKUserScript` that runs before page scripts). The `mobile-app=true` *cookie* checked by this script is set client-side by `BridgeInit.tsx` only after the bridge mounts — which happens after hydration, i.e. always after this pre-paint script has already run once. Since a WebView typically does one hard page load and then all further navigation is client-side (Next.js router doesn't re-run `<head>` scripts on route changes), this means: for the entire lifetime of a typical Android session, `.native-app` is never set, only `.native-android` is. `window.Android.postMessage` itself (Android's `addJavascriptInterface` object) IS synchronously available at pre-paint time — that's the reliable signal to key off, so use it to set `.native-app` too, not just `.native-android`.

- [ ] **Step 1: Read the current script to confirm it hasn't changed since this plan was written**

Run: `sed -n '149p' src/app/layout.tsx`

Expected: contains `...classList.add('native-app');}}catch(e){}try{if(window.Android&&window.Android.postMessage){document.documentElement.classList.add('native-android');}}catch(e){}})();`

- [ ] **Step 2: Make the Android branch also set `.native-app`**

Replace this exact substring within the `dangerouslySetInnerHTML` string on line 149:

```
try{if(window.Android&&window.Android.postMessage){document.documentElement.classList.add('native-android');}}catch(e){}
```

with:

```
try{if(window.Android&&window.Android.postMessage){document.documentElement.classList.add('native-app','native-android');}}catch(e){}
```

(One-word change: `classList.add('native-android')` → `classList.add('native-app','native-android')`. Everything else in the script is untouched.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no output.

- [ ] **Step 4: Verify via Playwright that Android-only detection now sets both classes**

With the dev server on `:3000` already running (don't restart it), use Playwright MCP to navigate to `http://localhost:3000/teachers`, then evaluate — this simulates a fresh Android WebView load (`window.Android` present, no cookie, no `inNativeApp`) by injecting `window.Android` **before** re-running the equivalent of the pre-paint logic (since the real script already ran without it on this plain page load, re-invoke the same check manually to confirm the *new* logic, not the already-executed one):

```js
() => {
  window.Android = { postMessage: () => {} } // simulate Android's injected interface
  // re-run the (updated) pre-paint logic's Android branch directly, since the
  // real <head> script already executed once before this injection:
  if (window.Android && window.Android.postMessage) {
    document.documentElement.classList.add('native-app', 'native-android')
  }
  return document.documentElement.className
}
```

Expected: className string contains both `native-app` and `native-android`.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "$(cat <<'EOF'
fix(bridge): set .native-app when Android is detected, not just .native-android

Android never sets window.inNativeApp (iOS-only) and the mobile-app
cookie this script also checks is set client-side by BridgeInit.tsx
after mount -- after the pre-paint script has already run once, and a
WebView's <head> script doesn't re-run on client-side navigations. So
.native-app was never actually set for the lifetime of a real Android
session, only .native-android -- any CSS keyed on .native-app alone
(chrome suppression, and the upcoming native-focus override) silently
missed Android. window.Android.postMessage is synchronously available
at pre-paint time; use it to set both classes together.
EOF
)"
```

---

## Task 2: Generalize the native-focus CSS selector to a reusable `data-native-focus` attribute

**Files:**
- Modify: `src/app/globals.css:60-87`

**Interfaces:**
- Consumes: `.native-app` / `.native-android` / `.light` classes on `<html>`, now reliably co-set for Android per Task 1.
- Produces: a `[data-native-focus]` attribute selector any future input/textarea/field can opt into for the same native-platform focus treatment, without needing a bespoke CSS block per field. `TeacherSearchBar`'s existing `[data-search-input]` selector keeps working unchanged (comma-joined into the same rule, not replaced).

- [ ] **Step 1: Read the current block to confirm line numbers haven't shifted**

Run: `sed -n '60,87p' src/app/globals.css`

Expected: matches the block shown below (comment starting `/* === Native search-field focus === */` through the `html.native-android [data-search-input]:focus-visible` rule).

- [ ] **Step 2: Replace the block, adding `[data-native-focus]` alongside `[data-search-input]` in all three rules, and rename the section comment since it's no longer search-specific**

Replace this exact block (lines 60-87):

```css
/* === Native search-field focus ===
   Approved one-off exception to AGENTS.md's blanket
   `focus-visible:ring-2 focus-visible:ring-ring` a11y rule (2026-07-06),
   scoped to the native-wrapped app only -- plain web (desktop keyboard
   users, mobile Safari visitors) keeps the full compliant ring via the
   Tailwind utility in TeacherSearchBar.tsx. Inside the wrapper, touch is
   the primary input and a glowing web-style ring reads as un-native; HIG
   and Material both treat a search field's focus as a subtle border/
   background shift instead. `.native-android` (set alongside `.native-app`
   when `window.Android` is present) gets Material's more visible
   accent-colored border; iOS falls through to the shared, more minimal
   `.native-app` treatment matching HIG's own search-bar restraint.
   Selector specificity here is deliberately higher than Tailwind's
   generated ring utility so this wins regardless of stylesheet order. */
html.native-app [data-search-input]:focus-visible {
  outline: none;
  box-shadow: none;
  border-color: rgba(255, 255, 255, 0.3);
}

html.light.native-app [data-search-input]:focus-visible {
  border-color: rgba(75, 85, 99, 0.6);
}

html.native-android [data-search-input]:focus-visible {
  border-width: 2px;
  border-color: rgba(132, 184, 79, 0.7);
}
```

with:

```css
/* === Native form-field focus ===
   Approved one-off exception to AGENTS.md's blanket
   `focus-visible:ring-2 focus-visible:ring-ring` a11y rule (2026-07-06),
   scoped to the native-wrapped app only -- plain web (desktop keyboard
   users, mobile Safari visitors) keeps the full compliant ring via the
   Tailwind utility on each field. Inside the wrapper, touch is the
   primary input and a glowing web-style ring reads as un-native; HIG
   and Material both treat a text/search field's focus as a subtle
   border/background shift instead. `.native-android` (set alongside
   `.native-app` when `window.Android` is present) gets Material's more
   visible accent-colored border; iOS falls through to the shared, more
   minimal `.native-app` treatment matching HIG's own restraint.
   Selector specificity here is deliberately higher than Tailwind's
   generated ring utility so this wins regardless of stylesheet order.
   `[data-search-input]` is the Teachers search field (also used as a
   DOM-query target by PassiveSearchBar.tsx -- don't rename it).
   `[data-native-focus]` is the generic opt-in for any other field
   (e.g. ContactForm's inputs) that wants the same treatment. */
html.native-app [data-search-input]:focus-visible,
html.native-app [data-native-focus]:focus-visible {
  outline: none;
  box-shadow: none;
  border-color: rgba(255, 255, 255, 0.3);
}

html.light.native-app [data-search-input]:focus-visible,
html.light.native-app [data-native-focus]:focus-visible {
  border-color: rgba(75, 85, 99, 0.6);
}

html.native-android [data-search-input]:focus-visible,
html.native-android [data-native-focus]:focus-visible {
  border-width: 2px;
  border-color: rgba(132, 184, 79, 0.7);
}
```

- [ ] **Step 3: Typecheck and lint (CSS has no test runner in this repo — this is a pure syntax/regression check)**

Run: `npx tsc --noEmit -p .`
Expected: no output (clean).

Run: `npx eslint src/app/globals.css`
Expected: `warning File ignored because no matching configuration was supplied` only (CSS isn't ESLint-lintable here — this warning is expected, not a regression).

- [ ] **Step 4: Verify the Teachers search field still gets its native-focus override unchanged (regression check for the generalization)**

With the dev server already running on `:3000` (owned by another session — don't restart it), use Playwright MCP:

```js
// navigate to http://localhost:3000/teachers, resize to 390x844
// click "Search teachers..." button to open the sheet
// then evaluate:
() => {
  document.documentElement.classList.add('native-app', 'native-android')
  const el = document.querySelector('[data-search-input]')
  el.blur(); el.focus()
  const cs = getComputedStyle(el)
  return { boxShadow: cs.boxShadow, borderColor: cs.borderColor, borderWidth: cs.borderWidth }
}
```

Expected: `{ boxShadow: "none", borderColor: "rgba(132, 184, 79, 0.7)", borderWidth: "2px" }` — identical to the values confirmed in commit `a88abc1`'s verification. If this differs, the generalized selector broke something — stop and investigate before Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "$(cat <<'EOF'
refactor(modal): generalize native-focus CSS selector to a reusable data-native-focus attribute

The Teachers search field's native-platform focus override (commit
a88abc1) was hardcoded to [data-search-input]. Generalize the selector
to also match a new [data-native-focus] attribute so other fields
(About page's Contact form, next) can opt into the same treatment
without a bespoke CSS block per field. [data-search-input] keeps
working unchanged -- it's also a DOM-query target in
PassiveSearchBar.tsx, not renamed.
EOF
)"
```

---

## Task 3: Apply `data-native-focus` to the Contact form's name/email/message fields

**Files:**
- Modify: `src/components/about/ContactForm.tsx:80-97`

**Interfaces:**
- Consumes: `[data-native-focus]` CSS selector from Task 2 (already wired to `.native-app`/`.native-android`/`.light` — no further CSS changes needed here).
- Produces: nothing consumed by later tasks — this is the leaf change.

**Explicitly out of scope for this task (flagged, not silently included):** the `gdprConsent` checkbox (`ContactForm.tsx:101`) and the submit button (`ContactForm.tsx:107-109`). Checkboxes and buttons are discrete controls, not text-entry fields — native platforms don't treat their focus state the same way a text field's cursor-entry state is treated (Material's own spec shows a ripple/state-layer for buttons, not a border change; iOS buttons show a pressed-opacity change, not a focus ring). Applying the same border-swap treatment to them wasn't part of the original ask and needs its own design decision. If you want these included, ask the user first, then add a Task 4 following the same pattern as this task — don't fold it into Task 3 silently.

- [ ] **Step 1: Read the current file to confirm line numbers haven't shifted**

Run: `sed -n '78,98p' src/components/about/ContactForm.tsx`

Expected: matches the `name`/`email`/`message` field markup shown below.

- [ ] **Step 2: Add `data-native-focus` to all three fields**

Replace (lines 78-98):

```tsx
      <div>
        <label htmlFor="name" className="text-white/90 light:text-gray-700 text-sm block mb-1">Name *</label>
        <input
          id="name" name="name" type="text" required minLength={2} maxLength={100}
          className="w-full h-11 bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>
      <div>
        <label htmlFor="email" className="text-white/90 light:text-gray-700 text-sm block mb-1">Email *</label>
        <input
          id="email" name="email" type="email" required
          className="w-full h-11 bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>
      <div>
        <label htmlFor="message" className="text-white/90 light:text-gray-700 text-sm block mb-1">Message *</label>
        <textarea
          id="message" name="message" required rows={5} minLength={10} maxLength={2000}
          className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none resize-none"
        />
      </div>
```

with:

```tsx
      <div>
        <label htmlFor="name" className="text-white/90 light:text-gray-700 text-sm block mb-1">Name *</label>
        <input
          id="name" name="name" type="text" required minLength={2} maxLength={100}
          data-native-focus
          className="w-full h-11 bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>
      <div>
        <label htmlFor="email" className="text-white/90 light:text-gray-700 text-sm block mb-1">Email *</label>
        <input
          id="email" name="email" type="email" required
          data-native-focus
          className="w-full h-11 bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>
      <div>
        <label htmlFor="message" className="text-white/90 light:text-gray-700 text-sm block mb-1">Message *</label>
        <textarea
          id="message" name="message" required rows={5} minLength={10} maxLength={2000}
          data-native-focus
          className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none resize-none"
        />
      </div>
```

- [ ] **Step 3: Typecheck, lint, and run the existing test suite**

Run: `npx tsc --noEmit -p .`
Expected: no output.

Run: `npx eslint src/components/about/ContactForm.tsx`
Expected: no output (this file has no pre-existing lint issues, unlike `TeacherSearchBar.tsx`).

Run: `npx vitest run tests/unit/contact-sheet.test.tsx tests/unit/contact-form-on-success.test.tsx`
Expected: same 2 pre-existing failures as before this change (`ContactSheet > renders dialog when open` and `ContactForm onSuccess > calls onSuccess when submission succeeds`) — confirm the failure messages are unchanged (still the `getByRole('dialog')` multiple-elements error, not a new error), meaning this change didn't make them worse. Do not attempt to fix these two — out of scope per Global Constraints.

- [ ] **Step 4: Visual verification — all three platform states, on the actual About page contact sheet**

With the dev server on `:3000` already running, use Playwright MCP:

```js
// navigate to http://localhost:3000/about, resize to 390x844
// click the "Contact" button in the header to open ContactSheet
// evaluate to check plain-web state (expect the full green ring):
() => {
  const el = document.getElementById('name')
  el.focus()
  const cs = getComputedStyle(el)
  return { boxShadow: cs.boxShadow, htmlClass: document.documentElement.className }
}
```

Expected: `boxShadow` contains a non-`none` value (the ring), `htmlClass` has no `native-app`.

Then simulate native-android and re-check (mirroring Task 2 Step 4's approach, and the original verification in commit `a88abc1`):

```js
() => {
  document.documentElement.classList.add('native-app', 'native-android')
  const el = document.getElementById('name')
  el.blur(); el.focus()
  const cs = getComputedStyle(el)
  return { boxShadow: cs.boxShadow, borderColor: cs.borderColor, borderWidth: cs.borderWidth }
}
```

Expected: `{ boxShadow: "none", borderColor: "rgba(132, 184, 79, 0.7)", borderWidth: "2px" }`.

Then remove `native-android`, re-focus, and confirm the iOS/generic-native fallback:

```js
async () => {
  document.documentElement.classList.remove('native-android')
  const el = document.getElementById('name')
  el.blur(); el.focus()
  await new Promise(r => setTimeout(r, 400)) // let the border-color transition settle
  const cs = getComputedStyle(el)
  return { boxShadow: cs.boxShadow, borderColor: cs.borderColor, borderWidth: cs.borderWidth }
}
```

Expected: `{ boxShadow: "none", borderColor: "rgba(255, 255, 255, 0.3)", borderWidth: "1px" }`.

`#name` is now fully verified across all three states. `#email` and `#message` share the exact same `[data-native-focus]` mechanism (same selector, same CSS rule — nothing field-specific), so a full three-state re-check on each would just re-prove the same CSS rule matches three different elements. Spot-check one state only, on both remaining fields, to confirm the attribute was actually added correctly to each (a copy-paste step, the real risk is a typo or a missed field, not the CSS logic):

```js
() => {
  document.documentElement.classList.add('native-app', 'native-android')
  return ['email', 'message'].map(id => {
    const el = document.getElementById(id)
    el.focus()
    const cs = getComputedStyle(el)
    return { id, hasAttr: el.hasAttribute('data-native-focus'), boxShadow: cs.boxShadow, borderWidth: cs.borderWidth }
  })
}
```

Expected: both entries show `hasAttr: true, boxShadow: "none", borderWidth: "2px"`.

Clean up any screenshot/temp files this step creates before committing (matches the cleanup done after Task 2's verification and the original `a88abc1` work).

- [ ] **Step 5: Commit**

```bash
git add src/components/about/ContactForm.tsx
git commit -m "$(cat <<'EOF'
fix(about): give Contact form fields the platform-native focus style

Extends the Teachers search field's native-focus pattern (a88abc1) to
the About page's name/email/message fields via the generalized
[data-native-focus] selector (previous commit). Plain web keeps the
full a11y-compliant ring; the native-wrapped app gets iOS's minimal
border shift or Android's Material-style accent border, matching the
established per-platform treatment. Checkbox and submit button
intentionally left untouched -- different control type, needs its own
design decision, not folded in here.
EOF
)"
```

---

## Self-Review Notes (from writing-plans skill's required self-review pass)

**Spec coverage:** "continue this idea for the about page" → Task 3 applies the mechanism to the About page's actual text-entry fields (name/email/message — structurally identical to the Teachers search field this pattern was built for). Checkbox/button explicitly flagged as a separate, un-started decision rather than silently left out. Task 1 and Task 2 are prerequisites surfaced by advisor review during planning, not scope creep: Task 1 fixes a real, already-shipped gap (Android never got `.native-app`) that Task 3's new fields would otherwise inherit; Task 2 generalizes the CSS so Task 3 doesn't need a bespoke rule block.

**Placeholder scan:** no TBD/TODO — every step has literal before/after code blocks and exact expected command output.

**Type consistency:** no new functions/types introduced (a one-line script change, a CSS attribute selector, and a bare HTML attribute) — nothing to drift between tasks. Cross-task references (Task 3 saying "per Task 2 Step 4", "per Task 1 Step 4") were checked against the final task numbering after the reorder, not left pointing at pre-reorder task numbers.
