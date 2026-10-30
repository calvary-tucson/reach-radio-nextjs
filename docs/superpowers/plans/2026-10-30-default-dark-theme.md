# Default-Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The web site shows dark mode unless the visitor's system explicitly asks for light or they saved a choice; the native app is always dark.

**Architecture:** Extract the "which theme applies" decision into one pure, tested module (`src/lib/theme/resolve-theme.ts`). The pre-paint inline script (moved into `src/lib/theme/init-script.ts` so it can be unit-tested) and `ThemeProvider` both follow the same rules. Native-app detection uses the `html.native-app` class, which the inline script already sets before first paint.

**Tech Stack:** Next.js (see `AGENTS.md`: read `node_modules/next/dist/docs/` before touching Next APIs), React 19, TypeScript strict, Vitest + Testing Library (jsdom), Playwright.

## Global Constraints

- Precedence, highest first: `?theme=light|dark|system` URL param, then (web only) saved `theme` cookie, then default. Default is `system` on web, `dark` in the native app.
- `system` resolves to **light only when `(prefers-color-scheme: light)` matches**. Dark preference and "no preference" both resolve to dark.
- Native app = `html.native-app` class (set pre-paint when `window.inNativeApp`, `mobile-app=true` cookie, or `window.Android.postMessage` is present). In the app a saved `theme` cookie is ignored. The `?theme=` param still wins (deliberate override, e.g. testing).
- No flash: the pre-paint inline script must pick the final class, so `ThemeProvider` never flips it afterwards.
- No new UI. The three theme toggles (`Header`, `MobileHeader`, `Footer`) are already not rendered in the app (`layout.tsx` `LayoutChrome` and `LayoutFooter` return nothing when `detectMobileApp()` is true). Do not change them.
- Commit scope is `theme` (see `AGENTS.md` canonical scopes). Conventional commits. Do not push.
- CSP already allows the inline script (`script-src 'unsafe-inline'`). Do not change `next.config.ts`.
- Heavy commands (`npm run build`, Playwright) go through the resource guard. On a `RESOURCE GUARD:` denial wait 2-3 min and retry.

## Verified native signals (2026-10-30, checked in native repos)

- iOS (`reach-radio-native-ios/.../WebView.swift`): `WKUserScript` sets `window.inNativeApp = true` at `.atDocumentStart`, plus `mobile-app: true` request header and cookie. The pre-paint head script sees it.
- Android (`MainActivity.kt`): `window.inNativeApp` is set via `evaluateJavascript` after load (too late for pre-paint); the `window.Android.postMessage` interface is present at document start and the `mobile-app: true` header makes `proxy.ts` set a non-httpOnly `mobile-app=true` cookie (`httpOnly: false`). The pre-paint script already keys on both, so the app is detected before first paint.
- `body.dataset.app` is set nowhere in `src/` or either native repo (the `body[data-app]` CSS at `globals.css:147` is also unused). Removing the branch is safe. `ThemeProvider` reads the `native-app` class, which the pre-paint script sets.
- Current store apps load `reach-radio-web.pages.dev` (old Astro site), so they do not run this code. This change only reaches the app once a build pointing at reach.radio ships (unreleased iOS v4, future Android).

## File Structure

- Create `src/lib/theme/resolve-theme.ts`: pure functions `isTheme`, `pickTheme`, `resolveTheme`, type `Theme`.
- Create `src/lib/theme/init-script.ts`: exports `THEME_INIT_SCRIPT` string.
- Modify `src/app/layout.tsx` (the `<script dangerouslySetInnerHTML>` in `<head>`, about lines 148-152): use `THEME_INIT_SCRIPT`.
- Modify `src/components/theme/ThemeProvider.tsx`: use `resolve-theme`, light query, `native-app` class.
- Modify `tests/unit/theme-provider.test.tsx`: new media-query stub and native-app cases.
- Create `tests/unit/theme-resolve.test.ts`, `tests/unit/theme-init-script.test.ts`.
- Create `tests/e2e/theme-default.spec.ts`.
- Modify `docs/design-system.md`: add a `## Theme` section.

---

### Task 1: Pure theme resolution module

**Files:**
- Create: `src/lib/theme/resolve-theme.ts`
- Test: `tests/unit/theme-resolve.test.ts`

**Interfaces:**
- Produces:
  - `type Theme = 'light' | 'dark' | 'system'`
  - `type ResolvedTheme = 'light' | 'dark'`
  - `isTheme(v: unknown): v is Theme`
  - `pickTheme(input: { param: string | null; cookie: Theme | null; isNativeApp: boolean }): Theme`
  - `resolveTheme(theme: Theme, prefersLight: boolean): ResolvedTheme`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/theme-resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isTheme, pickTheme, resolveTheme } from '@/lib/theme/resolve-theme'

describe('isTheme', () => {
  it('accepts the three values only', () => {
    expect(isTheme('light')).toBe(true)
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('system')).toBe(true)
    expect(isTheme('blue')).toBe(false)
    expect(isTheme(null)).toBe(false)
    expect(isTheme(undefined)).toBe(false)
  })
})

describe('pickTheme', () => {
  it('web: defaults to system', () => {
    expect(pickTheme({ param: null, cookie: null, isNativeApp: false })).toBe('system')
  })
  it('web: saved cookie wins over default', () => {
    expect(pickTheme({ param: null, cookie: 'light', isNativeApp: false })).toBe('light')
  })
  it('web: param wins over cookie', () => {
    expect(pickTheme({ param: 'dark', cookie: 'light', isNativeApp: false })).toBe('dark')
  })
  it('web: invalid param is ignored', () => {
    expect(pickTheme({ param: 'blue', cookie: 'light', isNativeApp: false })).toBe('light')
  })
  it('native app: always dark, ignores cookie', () => {
    expect(pickTheme({ param: null, cookie: 'light', isNativeApp: true })).toBe('dark')
    expect(pickTheme({ param: null, cookie: null, isNativeApp: true })).toBe('dark')
  })
  it('native app: param still overrides', () => {
    expect(pickTheme({ param: 'light', cookie: null, isNativeApp: true })).toBe('light')
  })
})

describe('resolveTheme', () => {
  it('system + prefers light -> light', () => {
    expect(resolveTheme('system', true)).toBe('light')
  })
  it('system + not prefers light (dark or no preference) -> dark', () => {
    expect(resolveTheme('system', false)).toBe('dark')
  })
  it('explicit choices ignore the system', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/theme-resolve.test.ts`
Expected: FAIL, "Failed to resolve import @/lib/theme/resolve-theme".

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/theme/resolve-theme.ts`:

```ts
export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export function isTheme(v: unknown): v is Theme {
  return v === 'light' || v === 'dark' || v === 'system'
}

interface PickInput {
  param: string | null
  cookie: Theme | null
  isNativeApp: boolean
}

/** Which theme setting applies: ?theme param, then (web only) saved cookie, else native=dark / web=system. */
export function pickTheme({ param, cookie, isNativeApp }: PickInput): Theme {
  if (isTheme(param)) return param
  if (isNativeApp) return 'dark'
  return cookie ?? 'system'
}

/** Dark unless the visitor's system explicitly asks for light ("no preference" stays dark). */
export function resolveTheme(theme: Theme, prefersLight: boolean): ResolvedTheme {
  if (theme === 'system') return prefersLight ? 'light' : 'dark'
  return theme
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/theme-resolve.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme/resolve-theme.ts tests/unit/theme-resolve.test.ts
git commit -m "feat(theme): add pure theme resolution rules" -- src/lib/theme/resolve-theme.ts tests/unit/theme-resolve.test.ts
```

---

### Task 2: Testable pre-paint script, wired into the layout

**Files:**
- Create: `src/lib/theme/init-script.ts`
- Modify: `src/app/layout.tsx` (import near the other `@/components/theme/ThemeProvider` import at line 19; the `<script>` in `<head>` at about lines 148-152)
- Test: `tests/unit/theme-init-script.test.ts`

**Interfaces:**
- Consumes: the rules in Global Constraints (mirrors `pickTheme` and `resolveTheme` from Task 1; the script cannot import, so it re-implements them in plain ES5).
- Produces: `THEME_INIT_SCRIPT: string`, an IIFE that adds `light` or `dark` to `<html>`, plus `native-app` (and `native-android`) when in the app.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/theme-init-script.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { THEME_INIT_SCRIPT } from '@/lib/theme/init-script'

type Scheme = 'light' | 'dark' | 'none'

function stubScheme(scheme: Scheme) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q === '(prefers-color-scheme: light)' ? scheme === 'light' : scheme === 'dark',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function run(opts: { scheme: Scheme; cookie?: string; search?: string }) {
  stubScheme(opts.scheme)
  Object.defineProperty(document, 'cookie', { writable: true, configurable: true, value: opts.cookie ?? '' })
  window.history.replaceState({}, '', `/${opts.search ?? ''}`)
  new Function(THEME_INIT_SCRIPT)()
  return document.documentElement.classList
}

describe('THEME_INIT_SCRIPT', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    delete (window as { inNativeApp?: unknown }).inNativeApp
    delete (window as { Android?: unknown }).Android
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('web, no saved choice, system light -> light', () => {
    expect(run({ scheme: 'light' }).contains('light')).toBe(true)
  })
  it('web, no saved choice, system dark -> dark', () => {
    expect(run({ scheme: 'dark' }).contains('dark')).toBe(true)
  })
  it('web, no saved choice, no system preference -> dark', () => {
    const cl = run({ scheme: 'none' })
    expect(cl.contains('dark')).toBe(true)
    expect(cl.contains('light')).toBe(false)
  })
  it('web, saved light beats system dark', () => {
    expect(run({ scheme: 'dark', cookie: 'theme=light' }).contains('light')).toBe(true)
  })
  it('web, saved dark beats system light', () => {
    expect(run({ scheme: 'light', cookie: 'theme=dark' }).contains('dark')).toBe(true)
  })
  it('web, saved system follows system light', () => {
    expect(run({ scheme: 'light', cookie: 'theme=system' }).contains('light')).toBe(true)
  })
  it('web, ?theme param beats cookie', () => {
    expect(run({ scheme: 'light', cookie: 'theme=light', search: '?theme=dark' }).contains('dark')).toBe(true)
  })
  it('native app via window.inNativeApp: dark even with system light and saved light', () => {
    ;(window as { inNativeApp?: boolean }).inNativeApp = true
    const cl = run({ scheme: 'light', cookie: 'theme=light' })
    expect(cl.contains('dark')).toBe(true)
    expect(cl.contains('light')).toBe(false)
    expect(cl.contains('native-app')).toBe(true)
  })
  it('native app via mobile-app cookie: dark', () => {
    const cl = run({ scheme: 'light', cookie: 'mobile-app=true; theme=light' })
    expect(cl.contains('dark')).toBe(true)
    expect(cl.contains('native-app')).toBe(true)
  })
  it('native Android via window.Android: dark and native-android', () => {
    ;(window as { Android?: unknown }).Android = { postMessage: () => {} }
    const cl = run({ scheme: 'light' })
    expect(cl.contains('dark')).toBe(true)
    expect(cl.contains('native-app')).toBe(true)
    expect(cl.contains('native-android')).toBe(true)
  })
  it('native app: ?theme=light still overrides', () => {
    ;(window as { inNativeApp?: boolean }).inNativeApp = true
    expect(run({ scheme: 'dark', search: '?theme=light' }).contains('light')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/theme-init-script.test.ts`
Expected: FAIL, "Failed to resolve import @/lib/theme/init-script".

- [ ] **Step 3: Write the implementation**

Create `src/lib/theme/init-script.ts`:

```ts
/**
 * Runs in <head> before first paint (plain ES5, no imports: it is inlined as a string).
 * Mirrors pickTheme/resolveTheme in resolve-theme.ts: ?theme param > (web only) cookie >
 * default (native=dark, web=system); system is light only if the OS asks for light.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;var c=document.cookie;var native=false;try{native=!!(window.inNativeApp||/(?:^|;\\s*)mobile-app=true/.test(c));}catch(e){}try{if(window.Android&&window.Android.postMessage){native=true;d.classList.add('native-android');}}catch(e){}if(native)d.classList.add('native-app');try{var q=location.search.match(/[?&]theme=(light|dark|system)/);var m=c.match(/(?:^|;\\s*)theme=(light|dark|system)/);var t=q?q[1]:native?'dark':m?m[1]:'system';var light=t==='light'||(t==='system'&&window.matchMedia('(prefers-color-scheme: light)').matches);d.classList.add(light?'light':'dark');}catch(e){d.classList.add('dark');}})();`
```

Modify `src/app/layout.tsx`:
1. Add next to the existing `ThemeProvider` import (line 19): `import { THEME_INIT_SCRIPT } from '@/lib/theme/init-script'`
2. Replace the whole `__html: \`(function(){...})();\`,` value in the `<script dangerouslySetInnerHTML={{ ... }}` with `__html: THEME_INIT_SCRIPT,`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/theme-init-script.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/theme/init-script.ts src/app/layout.tsx tests/unit/theme-init-script.test.ts
git commit -m "feat(theme): default to system with dark fallback in pre-paint script" -- src/lib/theme/init-script.ts src/app/layout.tsx tests/unit/theme-init-script.test.ts
```

---

### Task 3: ThemeProvider follows the same rules

**Files:**
- Modify: `src/components/theme/ThemeProvider.tsx`
- Modify: `tests/unit/theme-provider.test.tsx`

**Interfaces:**
- Consumes: `isTheme`, `pickTheme`, `resolveTheme`, `Theme` from `@/lib/theme/resolve-theme`.
- Produces: `ThemeProvider`, `useTheme`, and a re-exported `type Theme` (`ThemeToggle.tsx` imports `Theme` from this file; keep that import working).

- [ ] **Step 1: Update the tests first**

Replace the whole content of `tests/unit/theme-provider.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useTheme, ThemeProvider } from '@/components/theme/ThemeProvider'

function ThemeReader({ onRender }: { onRender: (v: { theme: string }) => void }) {
  const ctx = useTheme()
  onRender(ctx)
  return null
}

function wrap(children: React.ReactNode) {
  return <ThemeProvider>{children}</ThemeProvider>
}

type Scheme = 'light' | 'dark' | 'none'

function stubScheme(scheme: Scheme) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q === '(prefers-color-scheme: light)' ? scheme === 'light' : scheme === 'dark',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const cls = () => document.documentElement.classList

describe('ThemeProvider', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'cookie', { writable: true, configurable: true, value: '' })
    document.documentElement.className = ''
    stubScheme('none')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('applies dark class when cookie is dark', async () => {
    Object.defineProperty(document, 'cookie', { writable: true, configurable: true, value: 'theme=dark' })
    await act(async () => { render(wrap(<div />)) })
    expect(cls().contains('dark')).toBe(true)
  })

  it('applies light class when cookie is light', async () => {
    Object.defineProperty(document, 'cookie', { writable: true, configurable: true, value: 'theme=light' })
    await act(async () => { render(wrap(<div />)) })
    expect(cls().contains('light')).toBe(true)
  })

  it('no cookie + system light -> light', async () => {
    stubScheme('light')
    await act(async () => { render(wrap(<div />)) })
    expect(cls().contains('light')).toBe(true)
  })

  it('no cookie + system dark -> dark', async () => {
    stubScheme('dark')
    await act(async () => { render(wrap(<div />)) })
    expect(cls().contains('dark')).toBe(true)
  })

  it('no cookie + no system preference -> dark (not light)', async () => {
    stubScheme('none')
    await act(async () => { render(wrap(<div />)) })
    expect(cls().contains('dark')).toBe(true)
    expect(cls().contains('light')).toBe(false)
  })

  it('native app (html.native-app) stays dark with system light and a saved light cookie', async () => {
    stubScheme('light')
    document.documentElement.classList.add('native-app')
    Object.defineProperty(document, 'cookie', { writable: true, configurable: true, value: 'theme=light' })
    await act(async () => { render(wrap(<div />)) })
    expect(cls().contains('dark')).toBe(true)
    expect(cls().contains('light')).toBe(false)
  })

  it('useTheme setTheme updates class', async () => {
    let ctx: ReturnType<typeof useTheme>
    const capture = vi.fn((v) => { ctx = v })
    await act(async () => { render(wrap(<ThemeReader onRender={capture} />)) })
    await act(async () => { ctx!.setTheme('light') })
    expect(cls().contains('light')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run tests/unit/theme-provider.test.tsx`
Expected: FAIL on "no cookie + system light" (provider still tests the dark query and `body[data-app]`), and on "native app (html.native-app) stays dark".

- [ ] **Step 3: Change the provider**

In `src/components/theme/ThemeProvider.tsx`:

1. Replace the `export type Theme = ...` line and add imports, so the top reads:

```tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { isTheme, pickTheme, resolveTheme, type Theme } from '@/lib/theme/resolve-theme'

export type { Theme }
```

2. Replace `applyTheme` with:

```tsx
const LIGHT_QUERY = '(prefers-color-scheme: light)'

function applyTheme(theme: Theme) {
  const html = document.documentElement
  const resolved = resolveTheme(theme, window.matchMedia(LIGHT_QUERY).matches)
  html.classList.remove('light', 'dark')
  html.classList.add(resolved)
}
```

3. Replace the whole `useEffect` body in `ThemeInit` (everything from `const param = ...` to the closing `}, [searchParams])`) with:

```tsx
  useEffect(() => {
    const param = searchParams?.get('theme') ?? null
    if (isTheme(param)) setThemeCookie(param)

    const isNativeApp = document.documentElement.classList.contains('native-app')
    const chosen = pickTheme({ param, cookie: getThemeCookie(), isNativeApp })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- coordinates theme state with cookie/DOM mutations to prevent theme-flash on paint
    setThemeState(chosen)
    applyTheme(chosen)
    if (chosen !== 'system') return

    const mq = window.matchMedia(LIGHT_QUERY)
    const apply = () => applyTheme('system')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [searchParams])
```

Leave `getThemeCookie`, `setThemeCookie`, `setTheme`, `ThemeContext`, `useTheme` and the exported `ThemeProvider` unchanged.

- [ ] **Step 4: Run the theme tests**

Run: `npx vitest run tests/unit/theme-provider.test.tsx tests/unit/theme-toggle.test.tsx tests/unit/api-theme.test.ts tests/unit/theme-resolve.test.ts tests/unit/theme-init-script.test.ts`
Expected: all PASS.

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint` then `npx tsc --noEmit`
Expected: no errors (the `eslint-disable` comment must stay attached to the `setThemeState(chosen)` line).

- [ ] **Step 6: Commit**

```bash
git add src/components/theme/ThemeProvider.tsx tests/unit/theme-provider.test.tsx
git commit -m "fix(theme): keep native app dark and treat no preference as dark" -- src/components/theme/ThemeProvider.tsx tests/unit/theme-provider.test.tsx
```

---

### Task 4: E2E coverage, docs, full verification

**Files:**
- Create: `tests/e2e/theme-default.spec.ts`
- Modify: `docs/design-system.md` (append a section)

- [ ] **Step 1: Write the e2e spec**

Create `tests/e2e/theme-default.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

/** Records every class value `<html>` ever has, so a dark-then-light flash is caught. */
async function logHtmlClasses(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __htmlClasses: string[] }
    w.__htmlClasses = []
    new MutationObserver(() => w.__htmlClasses.push(document.documentElement.className)).observe(document, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    })
  })
}

const seen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __htmlClasses: string[] }).__htmlClasses)

test.describe('system = light', () => {
  test.use({ colorScheme: 'light' })

  test('web visitor gets light with no dark flash', async ({ page }) => {
    await logHtmlClasses(page)
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\blight\b/)
    expect((await seen(page)).some((c) => /\bdark\b/.test(c))).toBe(false)
  })

  test('saved dark beats system light', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'theme', value: 'dark', url: baseURL! }])
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  })

  test('native app (mobile-app cookie) stays dark, even with a saved light cookie', async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: 'mobile-app', value: 'true', url: baseURL! },
      { name: 'theme', value: 'light', url: baseURL! },
    ])
    await logHtmlClasses(page)
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    await expect(page.locator('html')).toHaveClass(/\bnative-app\b/)
    expect((await seen(page)).some((c) => /\blight\b/.test(c))).toBe(false)
    await expect(page.getByRole('button', { name: 'Toggle color theme' })).toHaveCount(0)
  })

  test('native app (iOS-style injected window.inNativeApp, no cookie) stays dark', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'theme', value: 'light', url: baseURL! }])
    await page.addInitScript(() => {
      ;(window as unknown as { inNativeApp: boolean }).inNativeApp = true
    })
    await logHtmlClasses(page)
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    expect((await seen(page)).some((c) => /\blight\b/.test(c))).toBe(false)
  })
})

test.describe('system = dark', () => {
  test.use({ colorScheme: 'dark' })

  test('web visitor gets dark', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  })
})

test.describe('system = no preference', () => {
  test.use({ colorScheme: 'no-preference' })

  test('web visitor gets dark', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  })
})
```

- [ ] **Step 2: Run e2e (dev server must be on port 3000)**

`playwright.config.ts` has `baseURL: http://localhost:3000` and `webServer` with `reuseExistingServer` (outside CI), so an already-running dev server on 3000 is reused; if another session owns it, do not stop it. Run: `npx playwright test tests/e2e/theme-default.spec.ts tests/e2e/theme-hydration.spec.ts`
Expected: all PASS, including the existing hydration spec. If the sandbox blocks Playwright or the dev server, stop and ask the owner for the exact `! <command>`; do not skip.

- [ ] **Step 3: Document**

Append to `docs/design-system.md`:

```md
## Theme

- Default on the web: dark, unless the visitor's system asks for light (`prefers-color-scheme: light`). "No preference" is dark.
- A saved choice (footer toggle, `theme` cookie) overrides the system. `?theme=light|dark|system` overrides both.
- Native app: always dark (detected by `html.native-app`); the saved cookie is ignored; the three theme toggles are not rendered in the app. `?theme=` still overrides, for testing.
- Rules live in `src/lib/theme/resolve-theme.ts`; the pre-paint script is `src/lib/theme/init-script.ts` and must stay in sync with it (tests: `tests/unit/theme-*.test.ts*`, `tests/e2e/theme-default.spec.ts`).
```

- [ ] **Step 4: Full verification**

Run each, expect clean:
- `npm test` (all unit tests pass)
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build` (heavy: guard may delay it; do not run two builds at once)

- [ ] **Step 5: Manual check (owner or Playwright, dev server)**

On `http://localhost:3000/`, DevTools > Rendering > "Emulate prefers-color-scheme": light shows light with no dark flash on reload; dark shows dark; "No emulation" with OS light shows light. Toggle in footer: choose Dark while OS is light, reload, stays dark. Add cookie `mobile-app=true`: always dark, no theme buttons.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/theme-default.spec.ts docs/design-system.md
git commit -m "test(theme): e2e for default-dark theme and document rules" -- tests/e2e/theme-default.spec.ts docs/design-system.md
```

---

## Self-review

- **Spec coverage:** default dark unless system light (Tasks 1-3); saved local setting wins (Tasks 1-3, tests for cookie); native app always dark (Tasks 1-3, e2e); decision A toggles hidden in app (already true, asserted in e2e, no code change); no flash (Task 2 + e2e flash log).
- **Placeholders:** none.
- **Type consistency:** `pickTheme`, `resolveTheme`, `isTheme`, `Theme` defined in Task 1 and used with the same signatures in Task 3; `THEME_INIT_SCRIPT` defined in Task 2 and imported in the layout.

## Rollout and rollback

- After review the owner pushes `main`; Vercel auto-deploys. Verify live with Playwright emulating `colorScheme: 'light'` against `https://reach.radio` (curl cannot see the class, it is set client-side).
- Rollback: `git revert` the 4 commits. No data or config changes.
- Current store apps (iOS live build, Android `main`) load `reach-radio-web.pages.dev`, so they are unaffected. Verify app behaviour with the Playwright emulated signals (Task 4) and, when available, the unreleased iOS v4 / TestFlight build that targets reach.radio on a light-mode phone: the app must be dark, no theme buttons.
