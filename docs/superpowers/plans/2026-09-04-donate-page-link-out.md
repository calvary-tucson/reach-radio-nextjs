# Donate Page Link-Out to PushPay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the embedded EasyTithe iframe on `/donate` with a redesigned page that links out to PushPay's hosted giving page, add a branded `/donate/thank-you` landing page, fix a light-mode contrast bug in a shared component the redesign reuses, and fix Android's in-app external-link hand-off to use Chrome Custom Tabs instead of a bare browser-launch intent.

**Architecture:** `/donate` and `/donate/thank-you` become async Server Components (matching this project's `/about` pattern: `detectMobileApp()` + `<ShowMediaBar />`, no client-side iframe plumbing). A small pure-function module (`src/lib/donate/cta.ts`) owns the web-vs-app copy/target branching so it's unit-testable without rendering. The thank-you page's "Listen" button is the one client component, since closing a tab is inherently a browser-side interaction. The Android fix is a separate, small change in `reach-radio-native-android`: extract the existing external-URL decision into a testable pure function, then swap the hand-off mechanism.

**Tech Stack:** Next.js 16 (App Router, Server Components), TypeScript strict, Tailwind CSS, Vitest + Testing Library, Playwright (`tests/e2e`), `lucide-react`. Android: Kotlin, Jetpack Compose, JUnit4 + Google Truth, `androidx.browser` (Custom Tabs).

## Global Constraints

- TypeScript strict mode; no `any` in public APIs.
- This codebase's own established convention is raw hex via Tailwind arbitrary values (`bg-[#84b84f]`, `text-[#1c2128]`, etc.) — not a token/theme-variable system. Follow that existing pattern exactly; do not introduce CSS variables or a different convention for these two pages.
- Every interactive element gets `cursor-pointer` explicitly (`AGENTS.md`); disabled elements also get `cursor-not-allowed`.
- Focus style on all interactive elements: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` (`AGENTS.md`) — not the older `focus-visible:outline` pattern seen on some existing components.
- All animations wrapped in `motion-safe:` (`AGENTS.md`).
- External links get `rel="noopener noreferrer"` always; `target="_blank"` only on the web branch, deliberately omitted on the in-app branch (this is a documented, reviewed exception to the general "external links always get target=_blank" rule in `security.md` — the in-app omission is what lets native WebViews intercept the navigation).
- Server-first rendering — both new pages are `async function` Server Components; the one exception (`ListenButton`) is `'use client'` only because it needs `window.opener`/`window.close`.
- Conventional commits, scope `donate` for every Next.js commit in this plan (per `AGENTS.md`'s Canonical Commit Scopes table). The Android-repo commits use plain conventional-commit form (no scope table exists in that repo).
- Run `npm run lint`, `tsc --noEmit` (or `npm run build`), and `npm test` clean before each commit that touches `src/`.

---

## File Structure

**reach-radio-nextjs:**
- Modify: `src/components/teachers/primitives/TeacherInfoChip.tsx` — add light-mode contrast tokens to the `accent` variant (Task 1, blocks Task 3's stats strip).
- Modify: `docs/design-system.md` — document the new light-mode Info Chip tokens (Task 1).
- Create: `tests/unit/teacher-info-chip-contrast.test.ts` (Task 1).
- Create: `src/lib/donate/cta.ts` — pure web/app copy+target branching (Task 2).
- Create: `tests/unit/donate-cta.test.ts` (Task 2).
- Rewrite: `src/app/donate/page.tsx` — drops the iframe entirely, becomes a Server Component (Task 3).
- Modify or delete: `public/js/iFrameResizer.min.js` — delete if this page was its only consumer (Task 4).
- Create: `src/app/donate/thank-you/page.tsx` (Task 5).
- Create: `src/app/donate/thank-you/ListenButton.tsx` (Task 5).
- Create: `tests/e2e/donate.spec.ts` (Task 6).

**reach-radio-native-android:**
- Create: `app/src/main/java/com/goodbarber/reachradio/UrlPolicy.kt` (Task 7).
- Create: `app/src/test/java/com/goodbarber/reachradio/UrlPolicyTest.kt` (Task 7).
- Modify: `app/build.gradle.kts` — add `androidx.browser` dependency (Task 8).
- Modify: `app/src/main/java/com/goodbarber/reachradio/MainActivity.kt` — use `UrlPolicy`, swap `ACTION_VIEW` for `CustomTabsIntent` (Task 8).

---

### Task 1: Fix `TeacherInfoChip`'s light-mode contrast (shared component)

The redesigned `/donate` page's stats strip reuses the existing `TeacherInfoChip` `accent` variant. That variant has no `light:` override — it was only ever used on dark-theme pages before now. Computed contrast of its `text-[#84b84f]` on the light-theme tinted background is ≈2.08:1, under the WCAG 1.4.3 AA minimum of 4.5:1 for this text size. This must land before Task 3, which is the first page to render this variant in light mode.

**Files:**
- Modify: `src/components/teachers/primitives/TeacherInfoChip.tsx`
- Modify: `docs/design-system.md:112-120`
- Test: `tests/unit/teacher-info-chip-contrast.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TeacherInfoChip`'s `accent` variant now renders with sufficient light-mode contrast — Task 3 renders three `<TeacherInfoChip label="..." variant="accent" />` instances and relies on this.

- [ ] **Step 1: Write the contrast-regression test**

This is a token/design-value regression guard, not a red/green unit test of new logic — the assertion will pass as soon as it's written, since it's checking the exact hex pair this task is about to put in place. Its job is to make sure nobody quietly regresses this pair back to something that fails WCAG later.

```typescript
// tests/unit/teacher-info-chip-contrast.test.ts
import { describe, it, expect } from 'vitest'

// Mirrors the exact hex values used by TeacherInfoChip.tsx's `accent`
// variant in light mode (light:text-green-700 on light:bg-green-100,
// both from src/app/globals.css's --color-green-* scale). If either token
// changes, update both this test and the component together.
const TEXT_GREEN_700 = '#4F712D'
const BG_GREEN_100 = '#E6F0DB'

function srgbToLinear(channel: number): number {
  const s = channel / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA)
  const lB = relativeLuminance(hexB)
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('TeacherInfoChip accent variant — light-mode contrast', () => {
  it('text-green-700 on bg-green-100 clears WCAG AA 4.5:1 for normal text', () => {
    expect(contrastRatio(TEXT_GREEN_700, BG_GREEN_100)).toBeGreaterThanOrEqual(4.5)
  })
})
```

- [ ] **Step 2: Run the test to confirm the math is right**

Run: `npm test -- tests/unit/teacher-info-chip-contrast.test.ts`
Expected: PASS (this validates the chosen color pair before it's wired into the component)

- [ ] **Step 3: Add the light-mode tokens to the component**

In `src/components/teachers/primitives/TeacherInfoChip.tsx`, change:

```typescript
const VARIANT_CLASS = {
  accent: 'bg-[rgba(132,184,79,0.1)] border border-[rgba(132,184,79,0.2)] text-[#84b84f]',
  dim: 'bg-white/5 light:bg-gray-100 border border-white/10 light:border-gray-200 text-white/50 light:text-gray-500',
}
```

to:

```typescript
const VARIANT_CLASS = {
  accent: 'bg-[rgba(132,184,79,0.1)] light:bg-green-100 border border-[rgba(132,184,79,0.2)] light:border-green-300 text-[#84b84f] light:text-green-700',
  dim: 'bg-white/5 light:bg-gray-100 border border-white/10 light:border-gray-200 text-white/50 light:text-gray-500',
}
```

- [ ] **Step 4: Update the design system doc**

In `docs/design-system.md`, replace the "Info Chip" section (lines 112-120):

```markdown
### Info Chip (badge/tag)

```tsx
// accent variant
bg-[rgba(132,184,79,0.1)] light:bg-green-100 border border-[rgba(132,184,79,0.2)] light:border-green-300 text-[#84b84f] light:text-green-700

// dim variant
bg-white/5 light:bg-gray-100 border border-white/10 light:border-gray-200 text-white/50 light:text-gray-500
```
```

- [ ] **Step 5: Run the full test suite to confirm nothing else broke**

Run: `npm test`
Expected: all existing tests plus the new one PASS (in particular, any existing `TeacherInfoChip`/teacher-card snapshot or rendering tests should be unaffected — the change only adds `light:`-prefixed classes, dark mode is untouched).

- [ ] **Step 6: Commit**

```bash
git add src/components/teachers/primitives/TeacherInfoChip.tsx docs/design-system.md tests/unit/teacher-info-chip-contrast.test.ts
git commit -m "$(cat <<'EOF'
fix(teachers): add light-mode contrast tokens to Info Chip accent variant

The accent variant had no light: override and computed to ~2.08:1 contrast
in light mode, under WCAG AA's 4.5:1 minimum — it had only ever shipped on
dark-theme pages before now. Needed before the donate page redesign reuses
this variant in a page that supports both themes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KrCD1fgvZbMFsHtUq5Tfyg
EOF
)"
```

---

### Task 2: `getDonateCtaCopy` — pure web/app branching logic

**Files:**
- Create: `src/lib/donate/cta.ts`
- Test: `tests/unit/donate-cta.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getDonateCtaCopy(isMobileApp: boolean): DonateCtaCopy` where `DonateCtaCopy = { target?: '_blank'; reassurance: string }`. Task 3's `/donate/page.tsx` imports and calls this with the result of `detectMobileApp()`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/donate-cta.test.ts
import { describe, it, expect } from 'vitest'
import { getDonateCtaCopy } from '@/lib/donate/cta'

describe('getDonateCtaCopy', () => {
  it('omits target and makes no "stays right where you left it" claim in-app', () => {
    const result = getDonateCtaCopy(true)
    expect(result.target).toBeUndefined()
    expect(result.reassurance).toBe("Give once or set up recurring giving on PushPay's secure site.")
  })

  it('opens a new tab and reassures the user on web', () => {
    const result = getDonateCtaCopy(false)
    expect(result.target).toBe('_blank')
    expect(result.reassurance).toBe(
      "Give once or set up recurring giving — you'll finish on PushPay's secure site, which opens in a new tab. Reach Radio stays right where you left it."
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/donate-cta.test.ts`
Expected: FAIL with "Failed to resolve import '@/lib/donate/cta'" (module doesn't exist yet)

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/lib/donate/cta.ts

export interface DonateCtaCopy {
  /** '_blank' on web so the original tab survives; omitted in-app so the
   *  native WebView's own external-link interceptor (iOS's
   *  decidePolicyFor, Android's shouldOverrideUrlLoading) reliably catches
   *  this as a plain top-level navigation. */
  target?: '_blank'
  reassurance: string
}

const WEB_REASSURANCE =
  "Give once or set up recurring giving — you'll finish on PushPay's secure site, which opens in a new tab. Reach Radio stays right where you left it."

// No "stays right where you left it" claim here: Android's current WebView
// hand-off (a bare ACTION_VIEW intent, not Chrome Custom Tabs) fully
// backgrounds the app rather than staying in place. detectMobileApp()
// can't distinguish iOS from Android, so this copy has to stay accurate
// for the weaker case until the Android Custom Tabs fix ships and adopts.
const APP_REASSURANCE = "Give once or set up recurring giving on PushPay's secure site."

export function getDonateCtaCopy(isMobileApp: boolean): DonateCtaCopy {
  if (isMobileApp) {
    return { reassurance: APP_REASSURANCE }
  }
  return { target: '_blank', reassurance: WEB_REASSURANCE }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/donate-cta.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/donate/cta.ts tests/unit/donate-cta.test.ts
git commit -m "$(cat <<'EOF'
feat(donate): add pure web/app CTA copy branching helper

Extracts the target/reassurance-copy decision into a plain function so
it's unit-testable without rendering a Server Component — donate/page.tsx
(next task) will call this with detectMobileApp()'s result.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KrCD1fgvZbMFsHtUq5Tfyg
EOF
)"
```

---

### Task 3: Rebuild `/donate` as a Server Component

**Files:**
- Modify: `src/app/donate/page.tsx` (full rewrite — replaces the entire current iframe-based implementation)
- Test: covered by `tests/e2e/donate.spec.ts` in Task 6 (rendering/keyboard checks need a running server; the branching logic itself is already covered by Task 2's unit test)

**Interfaces:**
- Consumes: `detectMobileApp()` from `@/lib/utils/mobile-app` (existing), `getDonateCtaCopy` from `@/lib/donate/cta` (Task 2), `ShowMediaBar` from `@/components/media-bar/ShowMediaBar` (existing), `TeacherInfoChip` from `@/components/teachers/primitives/TeacherInfoChip` (Task 1 fixed its light-mode contrast).
- Produces: the `/donate` route. `src/app/donate/layout.tsx` is unchanged — its existing `metadata` (title "Donate", canonical `/donate`) still applies correctly to this page.

- [ ] **Step 1: Replace the page implementation**

```typescript
// src/app/donate/page.tsx
import { ExternalLink } from 'lucide-react'
import { detectMobileApp } from '@/lib/utils/mobile-app'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { TeacherInfoChip } from '@/components/teachers/primitives/TeacherInfoChip'
import { getDonateCtaCopy } from '@/lib/donate/cta'

// Placeholder until the PushPay giving page and its Preconfigured Redirect
// (see docs/superpowers/specs/2026-09-04-donate-page-link-out-design.md,
// Gaps #1-#3) are set up. Replace with the real giving link before launch —
// the page renders and type-checks correctly either way, it just points
// nowhere useful until this is swapped in.
const PUSHPAY_GIVING_URL = 'https://pushpay.com/g/PLACEHOLDER-reach-radio'

export default async function DonatePage() {
  const isMobileApp = await detectMobileApp()
  const { target, reassurance } = getDonateCtaCopy(isMobileApp)

  return (
    <div className="page-enter px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-6">
      <ShowMediaBar />

      <div>
        <h1 className="text-[22px] md:text-4xl font-extrabold text-white light:text-gray-900 tracking-tight">
          Donate
        </h1>
        <p className="mt-2 text-sm md:text-base text-white/90 light:text-gray-600">
          Support Reach Radio — your gift keeps Bible teaching and gospel music on the air across Tucson.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <TeacherInfoChip label="690AM · 106.7FM" variant="accent" />
        <TeacherInfoChip label="24/7" variant="accent" />
        <TeacherInfoChip label="Tucson, AZ" variant="accent" />
      </div>

      <div className="bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-5 md:p-6">
        <h2 className="border-l-4 pl-3 font-bold text-sm border-l-[#84b84f] uppercase text-white light:text-gray-900 tracking-wide">
          Keeping the Gospel on the Air, 24/7
        </h2>
        <p className="mt-3 text-white/90 light:text-gray-600 text-sm leading-relaxed">
          Every gift keeps 690AM and 106.7FM on the air, reaching drivers, shut-ins, and anyone within
          range of a radio — no app, login, or subscription required. Your support covers the airtime,
          equipment, and staff that make that possible, day and night.
        </p>
      </div>

      <div className="bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-5 md:p-6">
        <div className="flex items-center justify-center gap-1 h-5 mb-4 motion-safe:animate-pulse" aria-hidden="true">
          <span className="w-1 h-2 bg-[#84b84f] rounded-full" />
          <span className="w-1 h-3.5 bg-[#84b84f] rounded-full" />
          <span className="w-1 h-5 bg-[#84b84f] rounded-full" />
          <span className="w-1 h-2.5 bg-[#84b84f] rounded-full" />
          <span className="w-1 h-4 bg-[#84b84f] rounded-full" />
        </div>

        <div className="flex justify-center">
          <a
            href={PUSHPAY_GIVING_URL}
            rel="noopener noreferrer"
            aria-describedby="donate-cta-note"
            {...(target ? { target } : {})}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#84b84f] hover:bg-[#96cc5e] text-[#0a1305] font-bold rounded-full cursor-pointer motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0a1305] opacity-40" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0a1305]" />
            </span>
            Donate
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <p id="donate-cta-note" className="mt-3 text-center text-xs md:text-sm text-white/70 light:text-gray-500">
          {reassurance}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors

- [ ] **Step 3: Manual visual check**

Follow this project's `/verify` practice: start the dev server, visit `/donate` at mobile and desktop widths, in both light and dark theme (toggle via the existing theme control). Confirm:
- Stats strip pills are legible in both themes (this is what Task 1 fixed).
- CTA button is `w-full` below `md`, auto-width at `md`+.
- Tab to the CTA button — visible focus ring at sufficient contrast in both themes.
- With devtools "Reduced motion" emulation on, the pulse-dot/waveform stop animating (motion-safe: guard).

- [ ] **Step 4: Commit**

```bash
git add src/app/donate/page.tsx
git commit -m "$(cat <<'EOF'
feat(donate): rebuild /donate as a link-out to PushPay

Replaces the embedded EasyTithe iframe (postMessage handshake,
iFrameResizer, retry timers) with a static Server Component: hero, stats
strip, mission card, and a CTA that links out to PushPay instead of
embedding it — PushPay's embedded form can't be restyled to match this
site's dark theme.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KrCD1fgvZbMFsHtUq5Tfyg
EOF
)"
```

---

### Task 4: Remove iframe-only assets no longer used

**Files:**
- Delete (conditionally): `public/js/iFrameResizer.min.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing new — this is cleanup only.

- [ ] **Step 1: Confirm the file exists, then check for other consumers before deleting**

Run: `ls public/js/` — confirms `iFrameResizer.min.js` is actually at this path (verified present as of this plan: `public/js/` also contains `iFrameResizer.contentWindow.min.js`, a *different* file — leave that one alone, it's not referenced by the page being deleted here either way, but this task only touches `iFrameResizer.min.js`).

Run: `grep -rn "iFrameResizer.min.js" src/ public/ --include="*.ts" --include="*.tsx" --include="*.html"`

Expected: the only remaining reference, if any, is the `<Script src="/js/iFrameResizer.min.js">` tag that Task 3 already removed from `src/app/donate/page.tsx`. If the grep returns zero results (or only comments/docs), proceed to Step 2. If it returns another live consumer, stop — leave the file in place and note the finding instead of deleting.

- [ ] **Step 2: Delete the file**

```bash
rm public/js/iFrameResizer.min.js
```

- [ ] **Step 3: Verify the build still succeeds**

Run: `npm run build`
Expected: clean build, no 404/missing-asset warnings referencing this file

- [ ] **Step 4: Commit**

```bash
git add -A public/js/iFrameResizer.min.js
git commit -m "$(cat <<'EOF'
chore(donate): remove iFrameResizer asset, no longer used

/donate no longer embeds an iframe (see prior commit) — this script had
no other consumer.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KrCD1fgvZbMFsHtUq5Tfyg
EOF
)"
```

---

### Task 5: `/donate/thank-you` page + `ListenButton`

**Files:**
- Create: `src/app/donate/thank-you/page.tsx`
- Create: `src/app/donate/thank-you/ListenButton.tsx`

**Interfaces:**
- Consumes: `detectMobileApp()`, `ShowMediaBar` (both existing, same as Task 3).
- Produces: the `/donate/thank-you` route with its own `metadata` export (title "Thank You", canonical `/donate/thank-you`, `robots: { index: false }`) — this does NOT inherit `/donate`'s metadata from `donate/layout.tsx` because Next.js metadata merges by key with the more specific (page-level) export winning.

- [ ] **Step 1: Create the `ListenButton` client component**

```typescript
// src/app/donate/thank-you/ListenButton.tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'

const BUTTON_CLASS =
  'w-full md:w-auto inline-flex items-center justify-center px-6 py-3 bg-[#84b84f] hover:bg-[#96cc5e] text-[#0a1305] font-bold uppercase rounded-full cursor-pointer motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

export function ListenButton() {
  const [closeFailed, setCloseFailed] = useState(false)

  // This page is a cold landing from PushPay's redirect — on web it's
  // typically a second tab opened from the original /donate tab. If an
  // opener exists, prefer returning to it over reloading the whole app a
  // second time in this tab.
  if (closeFailed) {
    return (
      <Link href="/" className={BUTTON_CLASS}>
        Listen
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={BUTTON_CLASS}
      onClick={() => {
        if (typeof window !== 'undefined' && window.opener) {
          window.close()
          // Browsers only allow window.close() on script-opened tabs and
          // silently no-op otherwise. If we're still here shortly after,
          // the close was refused — degrade to a normal link rather than
          // leaving a dead button.
          window.setTimeout(() => setCloseFailed(true), 300)
          return
        }
        window.location.href = '/'
      }}
    >
      Listen
    </button>
  )
}
```

- [ ] **Step 2: Create the page**

```typescript
// src/app/donate/thank-you/page.tsx
import type { Metadata } from 'next'
import { ExternalLink } from 'lucide-react'
import { detectMobileApp } from '@/lib/utils/mobile-app'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { ListenButton } from './ListenButton'

export const metadata: Metadata = {
  title: 'Thank You',
  description: 'Thank you for supporting Reach Radio — 106.7FM / 690AM in Tucson, AZ.',
  alternates: { canonical: '/donate/thank-you' },
  robots: { index: false },
  openGraph: {
    title: 'Thank You — Reach Radio',
    description: 'Thank you for supporting Reach Radio — 106.7FM / 690AM in Tucson, AZ.',
    url: '/donate/thank-you',
  },
}

const FACEBOOK_URL = 'https://www.facebook.com/reachradiotucson'

export default async function ThankYouPage() {
  const isMobileApp = await detectMobileApp()

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

        <div className="mt-8 flex flex-col md:flex-row gap-3 justify-center">
          <ListenButton />

          {isMobileApp && (
            <a
              href={FACEBOOK_URL}
              rel="noopener noreferrer"
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-transparent border border-[#84b84f] text-white font-bold uppercase rounded-full cursor-pointer hover:bg-[#84b84f]/10 motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Follow on Facebook
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
```

Note: `Follow on Facebook` renders only when `isMobileApp` — on web, `Header`/`MobileHeader` already show a persistent Facebook icon link in every viewport, so an in-page duplicate here would repeat the same destination twice on screen. In-app, `Header`/`MobileHeader` are suppressed entirely, so this is the only instance there.

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/donate/thank-you/page.tsx src/app/donate/thank-you/ListenButton.tsx
git commit -m "$(cat <<'EOF'
feat(donate): add /donate/thank-you landing page

Branded post-gift landing page for PushPay's redirect. "Listen" returns to
the original tab via window.close() when an opener exists (falls back to
a normal / link otherwise); "Follow on Facebook" only renders in-app,
where it isn't already duplicated by the persistent header link that web
visitors see in every viewport.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KrCD1fgvZbMFsHtUq5Tfyg
EOF
)"
```

---

### Task 6: E2E coverage for both pages

**Files:**
- Create: `tests/e2e/donate.spec.ts`

**Interfaces:**
- Consumes: the running dev/preview server at `http://localhost:3000` (per `playwright.config.ts`'s `baseURL`), both routes from Tasks 3 and 5.
- Produces: nothing consumed by other tasks — this is the terminal verification step for the Next.js side of this plan.

- [ ] **Step 1: Write the e2e spec**

```typescript
// tests/e2e/donate.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Donate', () => {
  // Locate by destination, not accessible name: on web, Header.tsx also
  // renders a "Donate" nav link to /donate on this same page, so
  // getByRole('link', { name: 'Donate' }) resolves to two elements and
  // throws under Playwright's strict mode. The href prefix is unique to
  // the CTA in both web and in-app contexts.
  const ctaLocator = (page: import('@playwright/test').Page) =>
    page.locator('a[href^="https://pushpay.com"]')

  test('donate page renders with a keyboard-focusable CTA', async ({ page }) => {
    await page.goto('/donate')
    await expect(page.locator('h1', { hasText: 'Donate' })).toBeVisible()

    const cta = ctaLocator(page)
    await cta.focus()
    await expect(cta).toBeFocused()
  })

  test('donate CTA opens PushPay in a new tab on web', async ({ page }) => {
    await page.goto('/donate')
    const cta = ctaLocator(page)
    await expect(cta).toHaveAttribute('target', '_blank')
    await expect(cta).toHaveAttribute('href', /pushpay/i)
  })

  test('donate CTA omits target in-app', async ({ page, context }) => {
    await context.addCookies([{ name: 'mobile-app', value: 'true', url: 'http://localhost:3000' }])
    await page.goto('/donate')
    const cta = ctaLocator(page)
    await expect(cta).not.toHaveAttribute('target', '_blank')
  })

  test('Follow on Facebook is hidden on web, shown in-app', async ({ page, context }) => {
    await page.goto('/donate/thank-you')
    await expect(page.getByRole('link', { name: /Follow on Facebook/ })).toHaveCount(0)

    await context.addCookies([{ name: 'mobile-app', value: 'true', url: 'http://localhost:3000' }])
    await page.goto('/donate/thank-you')
    await expect(page.getByRole('link', { name: /Follow on Facebook/ })).toBeVisible()
  })

  test('Listen closes the opener tab when one exists', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error test shim — simulates a tab opened via window.open/target=_blank
      window.opener = {}
      // @ts-expect-error test shim
      window.close = () => {
        // @ts-expect-error test shim
        window.__closeCalled = true
      }
    })
    await page.goto('/donate/thank-you')
    await page.getByRole('button', { name: 'Listen' }).click()
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __closeCalled?: boolean }).__closeCalled))
      .toBe(true)
  })

  test('Listen falls back to a plain link when window.close() is refused', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error test shim
      window.opener = {}
      // @ts-expect-error test shim — simulates the browser silently refusing to close
      window.close = () => {}
    })
    await page.goto('/donate/thank-you')
    await page.getByRole('button', { name: 'Listen' }).click()
    await expect(page.getByRole('link', { name: 'Listen' })).toBeVisible({ timeout: 1000 })
  })
})
```

- [ ] **Step 2: Run the e2e suite**

Run: `npm run test:e2e -- donate.spec.ts`
Expected: all 6 tests PASS. `playwright.config.ts`'s `webServer` block runs `npm run dev` automatically and reuses an already-running server outside CI (`reuseExistingServer: !process.env.CI`) — no separate terminal needed.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/donate.spec.ts
git commit -m "$(cat <<'EOF'
test(donate): add e2e coverage for /donate and /donate/thank-you

Covers the web/app target branching, the Facebook CTA's app-only gating,
and the Listen button's window.close()-with-fallback behavior.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KrCD1fgvZbMFsHtUq5Tfyg
EOF
)"
```

---

### Task 7: Android — extract `UrlPolicy` as a testable pure function

Repo: `reach-radio-native-android` (a sibling directory, not this repo — use its absolute path).

**Files:**
- Create: `app/src/main/java/com/goodbarber/reachradio/UrlPolicy.kt`
- Test: `app/src/test/java/com/goodbarber/reachradio/UrlPolicyTest.kt`

**Interfaces:**
- Consumes: nothing.
- Produces: `UrlPolicy.isExternal(host: String?, initialDomain: String, allowedExternalDomains: Set<String>): Boolean`. Task 8's `MainActivity.kt` calls this in place of its current inline condition.

- [ ] **Step 1: Write the failing test**

```kotlin
// app/src/test/java/com/goodbarber/reachradio/UrlPolicyTest.kt
package com.goodbarber.reachradio

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class UrlPolicyTest {
    private val initialDomain = "reach.radio"
    private val allowed = setOf("forms.ministryforms.net", "login.ministryid.com")

    @Test
    fun `initial domain is not external`() {
        assertThat(UrlPolicy.isExternal(initialDomain, initialDomain, allowed)).isFalse()
    }

    @Test
    fun `allowlisted domain is not external`() {
        assertThat(UrlPolicy.isExternal("forms.ministryforms.net", initialDomain, allowed)).isFalse()
    }

    @Test
    fun `pushpay domain is external`() {
        assertThat(UrlPolicy.isExternal("pushpay.com", initialDomain, allowed)).isTrue()
    }

    @Test
    fun `null host is external`() {
        assertThat(UrlPolicy.isExternal(null, initialDomain, allowed)).isTrue()
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `reach-radio-native-android/`): `./gradlew testDebugUnitTest --tests "com.goodbarber.reachradio.UrlPolicyTest"`
Expected: FAIL — compilation error, `UrlPolicy` is unresolved

- [ ] **Step 3: Write the minimal implementation**

```kotlin
// app/src/main/java/com/goodbarber/reachradio/UrlPolicy.kt
package com.goodbarber.reachradio

/**
 * Decides whether a URL the WebView is about to load should be handed off
 * externally (Custom Tab) rather than loaded in-app.
 */
object UrlPolicy {
    fun isExternal(host: String?, initialDomain: String, allowedExternalDomains: Set<String>): Boolean {
        return host != initialDomain && !allowedExternalDomains.contains(host)
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew testDebugUnitTest --tests "com.goodbarber.reachradio.UrlPolicyTest"`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-native-android
git add app/src/main/java/com/goodbarber/reachradio/UrlPolicy.kt app/src/test/java/com/goodbarber/reachradio/UrlPolicyTest.kt
git commit -m "$(cat <<'EOF'
refactor: extract external-URL decision into testable UrlPolicy

Pulls the host/allowlist check out of MainActivity's inline
shouldOverrideUrlLoading condition so it's unit-testable without
Android instrumentation. No behavior change yet — next commit swaps
the hand-off mechanism.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KrCD1fgvZbMFsHtUq5Tfyg
EOF
)"
```

---

### Task 8: Android — Custom Tabs instead of a bare `ACTION_VIEW` intent

Repo: `reach-radio-native-android`. Depends on Task 7.

**Files:**
- Modify: `app/build.gradle.kts`
- Modify: `app/src/main/java/com/goodbarber/reachradio/MainActivity.kt` (the `shouldOverrideUrlLoading` override, currently around line 450)

**Interfaces:**
- Consumes: `UrlPolicy.isExternal` (Task 7).
- Produces: nothing consumed elsewhere — this is the last task in the Android half of this plan. No change to `allowedExternalDomains` or `initialDomain` handling.

- [ ] **Step 1: Add the Custom Tabs dependency**

In `app/build.gradle.kts`, inside the existing `dependencies { ... }` block, add (near the other `androidx.*` entries, e.g. after `implementation("androidx.core:core:1.12.0")`):

```kotlin
implementation("androidx.browser:browser:1.8.0")
```

- [ ] **Step 2: Sync and confirm the dependency resolves**

Run: `./gradlew :app:dependencies --configuration debugRuntimeClasspath | grep androidx.browser`
Expected: shows `androidx.browser:browser:1.8.0` resolved with no conflicts

- [ ] **Step 3: Update the import and the `shouldOverrideUrlLoading` override**

Add near the other `androidx.*` imports at the top of `MainActivity.kt`:

```kotlin
import androidx.browser.customtabs.CustomTabsIntent
```

Replace the existing override (the exact block currently at `MainActivity.kt:450-472`):

```kotlin
override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
   val url = request?.url ?: return false // Get the URL
   val host = url.host // Get the host/domain

   Log.d(TAG, "######## WebViewClient -> Intercepting URL: $url Host: $host ########")

   // Check if the host is the initial domain or an allowed external one
   if (host == initialDomain || allowedExternalDomains.contains(host)) {
        Log.d(TAG, "######## URL allowed inside WebView ########")
        return false // Let the WebView handle it
   } else {
        Log.d(TAG, "######## URL blocked - Opening in external browser ########")
        // Open in external browser
        try {
            val intent = Intent(Intent.ACTION_VIEW, url)
            view?.context?.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error opening external browser for $url", e)
            // Optional: Show a toast to the user?
        }
        return true // Indicate we've handled the URL
   }
}
```

with:

```kotlin
override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
   val url = request?.url ?: return false // Get the URL
   val host = url.host // Get the host/domain

   Log.d(TAG, "######## WebViewClient -> Intercepting URL: $url Host: $host ########")

   if (!UrlPolicy.isExternal(host, initialDomain, allowedExternalDomains)) {
        Log.d(TAG, "######## URL allowed inside WebView ########")
        return false // Let the WebView handle it
   } else {
        Log.d(TAG, "######## URL blocked - Opening in Custom Tab ########")
        val context = view?.context
        try {
            if (context != null) {
                CustomTabsIntent.Builder().build().launchUrl(context, url)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error opening Custom Tab for $url, falling back to external browser", e)
            try {
                context?.startActivity(Intent(Intent.ACTION_VIEW, url))
            } catch (e2: Exception) {
                Log.e(TAG, "Error opening external browser for $url", e2)
            }
        }
        return true // Indicate we've handled the URL
   }
}
```

- [ ] **Step 4: Rebuild and run the existing unit test suite**

Run: `./gradlew testDebugUnitTest`
Expected: all existing tests plus `UrlPolicyTest` PASS

- [ ] **Step 5: Manual verification (requires the `bridge-testing` tunnel setup)**

Per `docs/superpowers/plans/2026-06-17-native-bridge-testing.md` in `reach-radio-nextjs`: run `npm run dev` + `cloudflared tunnel --url http://localhost:3000`, point this branch's `Config.kt` `WEB_DOMAIN` at the tunnel domain, install a debug build, navigate to `/donate`, tap the CTA. Expected: a Chrome Custom Tab sheet opens over the app (not a full app-switch to the default browser). This can only be confirmed on-device — not part of the automated suite.

- [ ] **Step 6: Commit**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-native-android
git add app/build.gradle.kts app/src/main/java/com/goodbarber/reachradio/MainActivity.kt
git commit -m "$(cat <<'EOF'
fix: open external links in a Chrome Custom Tab instead of the default browser

shouldOverrideUrlLoading previously handed external URLs to a bare
ACTION_VIEW intent, which fully backgrounds the app to the user's default
browser. Custom Tabs keeps the user in an in-app sheet instead — the same
UX iOS already gets via SFSafariViewController. No change to
allowedExternalDomains or initialDomain handling; falls back to the old
ACTION_VIEW behavior if Custom Tabs launch fails for any reason.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KrCD1fgvZbMFsHtUq5Tfyg
EOF
)"
```

---

## Plan Self-Review Notes

**Spec coverage:** Every numbered item in the design doc's "Design" section (1-5) maps to a task — stats-strip contrast (Task 1), CTA copy branching (Task 2), `/donate` structure and hand-off mechanic (Task 3), cleanup (Task 4), thank-you page (Task 5), testing (Task 6), Android fix (Tasks 7-8). The "Gaps / open items" section is explicitly non-blocking (PushPay URL, PushPay-side setup, DNS cutover, etc.) and intentionally has no task here — those require external/human action (PushPay admin console, DNS, App Store review), not code.

**Type consistency:** `DonateCtaCopy`'s `target?: '_blank'` (Task 2) matches the `{...(target ? { target } : {})}` spread used in Task 3's JSX. `ListenButton`'s `closeFailed` state and `UrlPolicy.isExternal`'s signature are each used exactly once, by the task that defines them plus (for `UrlPolicy`) Task 8 — no naming drift between definition and use.

**Ordering:** Task 1 before Task 3 (chip contrast fix must land before the stats strip renders it). Task 2 before Task 3 (page imports the helper). Task 7 before Task 8 (MainActivity references `UrlPolicy`). Tasks 4-6 have no hard ordering constraint relative to each other beyond following Task 3/5.

**Pre-flight checks (advisor-flagged, verified before finalizing this plan):** `lucide-react`'s `ExternalLink` export exists (`node_modules/lucide-react/dist/esm/icons/external-link.mjs`, confirmed present). `public/js/iFrameResizer.min.js` exists at the path Task 4 deletes (confirmed present, alongside a distinct `iFrameResizer.contentWindow.min.js` that Task 4 does not touch). `playwright.config.ts` has a `webServer` block (`command: 'npm run dev'`, `reuseExistingServer: !process.env.CI`) — Task 6 doesn't need a manually-started dev server. Task 6's original CTA locator (`getByRole('link', { name: 'Donate' })`) was ambiguous on web — `Header.tsx` renders its own "Donate" nav link on the same page — fixed to locate by `href` prefix instead. Task 5's `metadata` export originally left `openGraph` unset, which would have let it inherit `donate/layout.tsx`'s `openGraph` (title "Donate to Reach Radio", url `/donate`) — the same identity-mismatch bug the IA reviewer flagged for `title`/`canonical`, just on a different metadata key; fixed with an explicit `openGraph` block.
