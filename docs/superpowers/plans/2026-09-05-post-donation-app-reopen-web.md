# Post-Donation App Reopen — Web (reach-radio-nextjs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an unconditional "Have the app? Return to Reach Radio" link to
`/donate/thank-you`, pointing at the native app's `reachradio://` custom
scheme, so a donor with the app installed can get back to it in one tap
after PushPay's post-gift redirect lands them in an in-app browser sheet
(iOS `SFSafariViewController`, Android Chrome Custom Tab).

**Architecture:** A single addition to the existing
`src/app/donate/thank-you/page.tsx` server component — no new routes, no
client-side detection logic. The link is rendered unconditionally (not
gated on `detectMobileApp()`) because that detection relies on a
`mobile-app` cookie/header that is never present on this page when reached
via PushPay's redirect (confirmed: both the iOS `SFSafariViewController`
and Android's Chrome Custom Tabs keep a cookie jar isolated from the app's
own embedded WebView). See
`docs/superpowers/specs/2026-09-05-post-donation-app-reopen-design.md` for
the full investigation — this plan implements only its web-side half; a
companion plan in `reach-radio-native-ios`
(`docs/superpowers/plans/2026-09-05-post-donation-app-reopen-ios.md` in
that repo) makes the iOS app actually dismiss its browser sheet when this
link is tapped. Nothing in this plan depends on that one landing first —
both are independently testable.

**Tech Stack:** Next.js 16 server component, Tailwind CSS, Vitest, Playwright.

## Global Constraints

- TypeScript strict mode; no `any` in public APIs.
- Commit scope: `donate`.
- Every interactive element needs `cursor-pointer` and a
  `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`
  treatment, per `AGENTS.md`.
- Run `npx tsc --noEmit`, `npx eslint <changed files>`, `npx vitest run`,
  and the new/existing Playwright specs before considering this done.
- Commit messages must end with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```

---

### Task 1: Add the "Have the app? Return to Reach Radio" link

**Files:**
- Modify: `src/app/donate/thank-you/page.tsx`
- Test: `tests/e2e/donate.spec.ts` (existing file — add to the existing
  `describe('Donate')` block rather than creating a new one, since it
  already covers `/donate/thank-you`)

**Interfaces:**
- Consumes: nothing new — this is a static addition to an existing server
  component, no new props or exported functions.
- Produces: nothing new for later tasks. This is the only task in this plan.

- [x] **Step 1: Write the failing e2e test**

Open `tests/e2e/donate.spec.ts`. Find the existing test
`'thank-you page renders a Listen link back to home'` inside the
`describe('Donate')` block (it scopes to main content because the
persistent nav also has a "Listen" link). Add a new test immediately after
it, inside the same `describe` block:

```typescript
  test('thank-you page renders an unconditional return-to-app link', async ({ page }) => {
    await page.goto('/donate/thank-you')
    const returnLink = page.locator('a[href="reachradio://"]')
    await expect(returnLink).toBeVisible()
    // toContainText, not toHaveText: the element's full text content also
    // includes the sr-only disclosure span's text (sr-only hides visually,
    // not from textContent) — asserting the visible label and the
    // disclosure as two separate, exact checks avoids relying on a loose
    // regex to skip over that span.
    await expect(returnLink).toContainText('Have the app? Return to Reach Radio')
    await expect(returnLink.locator('span.sr-only')).toHaveText(
      '(opens the Reach Radio app if installed; does nothing otherwise)'
    )
  })

  test('return-to-app link renders even when the mobile-app cookie is set', async ({ page, context }) => {
    // The whole point of this link: unlike the Donate CTA (which DOES
    // branch on this cookie, per the "omits target in-app" test above),
    // this link must render identically whether or not isMobileApp is
    // true — that signal is never actually present on this page when
    // reached via PushPay's redirect (see the design spec's "Why
    // Universal Links don't work here" section), so gating on it would be
    // wrong. Setting the cookie here (not clearing it) is what actually
    // exercises that claim — a test against a cookie-free context can't
    // fail either way and wouldn't prove anything.
    await context.addCookies([{ name: 'mobile-app', value: 'true', url: 'http://localhost:3000' }])
    await page.goto('/donate/thank-you')
    await expect(page.locator('a[href="reachradio://"]')).toBeVisible()
  })
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx playwright test tests/e2e/donate.spec.ts -g "return-to-app"`
Expected: FAIL — no element matches `a[href="reachradio://"]` yet.

- [x] **Step 3: Add the link to the thank-you page**

Read the current full contents of `src/app/donate/thank-you/page.tsx`
first — it's a small file (under 40 lines) and this step replaces its
return statement, so confirm the exact current content of the
`<ListenButton />` line and its surrounding `<div>` before editing, in case
it has changed since this plan was written.

Replace:

```tsx
import type { Metadata } from 'next'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { ListenButton } from './ListenButton'

export const metadata: Metadata = {
  title: { absolute: 'Thank You | Reach Radio' },
  description: 'Thank you for supporting Reach Radio — 106.7FM / 690AM in Tucson, AZ.',
  alternates: { canonical: '/donate/thank-you' },
  robots: { index: false },
  openGraph: {
    title: 'Thank You — Reach Radio',
    description: 'Thank you for supporting Reach Radio — 106.7FM / 690AM in Tucson, AZ.',
    url: '/donate/thank-you',
  },
}

export default function ThankYouPage() {
  return (
    <div className="page-enter px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <ShowMediaBar />

      <div className="bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-6 md:p-8 text-center">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase text-white light:text-gray-900">
          Thank You
        </h1>
        <p className="mt-3 text-white/90 light:text-gray-600">
          Thank you — your gift helps keep Bible teaching and gospel music on the air across Tucson.
        </p>

        <div className="mt-8 flex justify-center">
          <ListenButton />
        </div>
      </div>
    </div>
  )
}
```

with:

```tsx
import type { Metadata } from 'next'
import { ExternalLink } from 'lucide-react'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { ListenButton } from './ListenButton'

export const metadata: Metadata = {
  title: { absolute: 'Thank You | Reach Radio' },
  description: 'Thank you for supporting Reach Radio — 106.7FM / 690AM in Tucson, AZ.',
  alternates: { canonical: '/donate/thank-you' },
  robots: { index: false },
  openGraph: {
    title: 'Thank You — Reach Radio',
    description: 'Thank you for supporting Reach Radio — 106.7FM / 690AM in Tucson, AZ.',
    url: '/donate/thank-you',
  },
}

export default function ThankYouPage() {
  return (
    <div className="page-enter px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <ShowMediaBar />

      <div className="bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-6 md:p-8 text-center">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase text-white light:text-gray-900">
          Thank You
        </h1>
        <p className="mt-3 text-white/90 light:text-gray-600">
          Thank you — your gift helps keep Bible teaching and gospel music on the air across Tucson.
        </p>

        <div className="mt-8 flex justify-center">
          <ListenButton />
        </div>

        <div className="mt-3 flex justify-center">
          <a
            href="reachradio://"
            className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 py-3 px-4 text-sm text-white/90 light:text-gray-600 cursor-pointer motion-safe:transition-colors hover:text-white light:hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-full"
          >
            Have the app? Return to Reach Radio
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="sr-only"> (opens the Reach Radio app if installed; does nothing otherwise)</span>
          </a>
        </div>
      </div>
    </div>
  )
}
```

(Only the `ExternalLink` import and the new `<div className="mt-3 ...">`
block are new — everything else is unchanged, shown in full so the diff is
unambiguous. `py-3` plus the `flex items-center` layout gives the link a
tap area at or above this project's 44px/`h-11` minimum touch-target
convention.)

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test tests/e2e/donate.spec.ts`
Expected: PASS, full file (all existing Donate tests plus the two new
ones).

- [x] **Step 5: Manual both-themes contrast check**

Run the dev server (`npm run dev`), open `/donate/thank-you`, and use the
`ThemeToggle` in the footer ("Appearance" — Light/Dark/System) to switch
themes; the theme is driven by a cookie read in `layout.tsx`'s inline
script, not a URL query param. Confirm the new link's text
(`text-white/90` dark / `text-gray-600` light) is clearly readable against
the card background (`bg-[#1c2128]` dark / `bg-gray-50` light). This
project has shipped a contrast gap on this exact page before (see
`docs/superpowers/specs/2026-09-04-donate-page-link-out-design.md`'s Gap
#2) — treat this as a required check, not a formality.

- [x] **Step 6: Full verification sweep**

Run, in order, and confirm each is clean:

```bash
npx tsc --noEmit
npx eslint src/app/donate/thank-you/page.tsx tests/e2e/donate.spec.ts
npx vitest run
npx playwright test
```

- [x] **Step 7: Commit**

```bash
git add src/app/donate/thank-you/page.tsx tests/e2e/donate.spec.ts
git commit -m "$(cat <<'EOF'
feat(donate): add return-to-app link on the thank-you page

Adds an unconditional "Have the app? Return to Reach Radio" link to
/donate/thank-you, pointing at the app's own reachradio:// custom
scheme, so a donor with the app installed can get back to it after
PushPay's redirect lands them in an in-app browser sheet. Not gated
on isMobileApp — that signal is never present on this page via this
redirect path (SFSafariViewController and Chrome Custom Tabs both
keep a cookie jar isolated from the app's own WebView) — see
docs/superpowers/specs/2026-09-05-post-donation-app-reopen-design.md.

The link alone isn't sufficient on iOS — see the companion plan in
reach-radio-native-ios (docs/superpowers/plans/2026-09-05-post-donation-app-reopen-ios.md
in that repo) for the fix that makes the app's browser sheet actually
dismiss when this link is tapped.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Plan Self-Review

**Spec coverage:** The design spec's "Placement and copy" section is fully
covered: destination (`reachradio://`), label, visible `ExternalLink` icon,
`sr-only` disclosure, unconditional rendering, sizing/tap-target, and
color/contrast are all implemented exactly as specified. The spec's iOS
fix and Android limitation are out of scope for this plan by design (see
Architecture above) — covered by the companion `reach-radio-native-ios`
plan and the spec's Gap #3 respectively.

**Placeholder scan:** No TBD/TODO steps. No placeholder values — `reachradio://`
is the real, final `href`, not a stand-in.

**Type consistency:** N/A — this task adds static JSX to an existing server
component; no new TypeScript interfaces or functions are introduced.
