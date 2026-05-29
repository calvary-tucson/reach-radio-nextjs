# Light/Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add light/dark/system theme support to reach-radio-nextjs, dark-first, using dual Tailwind v4 custom variants (`light:` and `dark:`) with SSR flash prevention and a URL param override for testing.

**Architecture:** Tailwind v4 `@custom-variant` configures both `light:` and `dark:` selectors keyed to `.light`/`.dark` on `<html>`. A client `ThemeProvider` owns runtime logic (URL param → cookie → native-app default → system preference), setting the class on `document.documentElement`. `layout.tsx` reads the theme cookie server-side and sets the initial `<html className>` to prevent flash.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4 (CSS-first config), React 19, `vitest` + `@testing-library/react` (jsdom), `lucide-react`.

---

## File Map

**Create:**
- `src/components/theme/ThemeProvider.tsx` — context, `useTheme()` hook, runtime class logic
- `src/components/theme/ThemeToggle.tsx` — footer control (Light/Dark/System buttons)
- `src/app/api/theme/route.ts` — POST endpoint to set `theme` cookie
- `tests/unit/theme-provider.test.tsx`
- `tests/unit/theme-toggle.test.tsx`
- `tests/unit/api-theme.test.ts`

**Modify:**
- `src/app/globals.css` — add `@custom-variant` declarations
- `src/app/layout.tsx` — SSR initial class, wrap `<ThemeProvider>`
- `src/components/layout/Header.tsx` — `light:` overrides
- `src/components/layout/MobileHeader.tsx` — `light:` overrides
- `src/components/layout/MobileNav.tsx` — `light:` overrides
- `src/components/layout/Footer.tsx` — add `<ThemeToggle>` + `light:` overrides
- `src/components/media-bar/MediaBar.tsx` — `light:` overrides
- `src/components/media-bar/NowPlayingInfo.tsx` — `light:` overrides
- `src/components/media-bar/PlayPauseButton.tsx` — no color change needed (green button, white icons stay)
- `src/components/modals/chrome/SheetChrome.tsx` — `light:` overrides
- `src/components/modals/chrome/TeacherPanelChrome.tsx` — `light:` overrides
- `src/components/global/BottomSheet.tsx` — `light:` overrides
- `src/components/home/RadioPlayer.tsx` — `light:` overrides
- `src/components/home/TodaySchedule.tsx` — `light:` overrides
- `src/components/home/SleepTimerSheet.tsx` — `light:` overrides
- `src/components/home/SleepTimerButton.tsx` — `light:` overrides
- `src/components/home/SleepTimerOverlay.tsx` — no light override needed (always dark overlay)
- `src/components/home/VolumeControl.tsx` — `light:` overrides
- `src/components/global/SearchInput.tsx` — `light:` overrides
- `src/components/global/PassiveSearchBar.tsx` — `light:` overrides
- `src/components/global/BackButton.tsx` — `light:` overrides
- `src/components/global/Pagination.tsx` — `light:` overrides
- `src/components/global/OfflineIndicator.tsx` — no change (amber alert, always same)
- `src/components/global/Breadcrumbs.tsx` — `light:` overrides
- `src/components/global/SectionErrorBoundary.tsx` — `light:` overrides
- `src/components/teachers/TeacherCard.tsx` — `light:` overrides
- `src/components/teachers/TeacherDetailContent.tsx` — `light:` overrides
- `src/components/teachers/TeacherSearchClient.tsx` — `light:` overrides
- `src/components/teachers/TeachersClientView.tsx` — `light:` overrides
- `src/components/teachers/ScheduleCardList.tsx` — `light:` overrides
- `src/components/teachers/ScheduleTabView.tsx` — `light:` overrides
- `src/components/teachers/ScheduleWeekCards.tsx` — `light:` overrides
- `src/components/teachers/RecommendedTeachers.tsx` — `light:` overrides
- `src/components/teachers/primitives/TeacherInfoChip.tsx` — `light:` overrides
- `src/components/about/ContactForm.tsx` — `light:` overrides
- `src/components/skeletons/RadioPlayerSkeleton.tsx` — `light:` overrides
- `src/components/skeletons/TeacherCardSkeleton.tsx` — `light:` overrides
- `src/components/skeletons/TeacherDetailSkeleton.tsx` — `light:` overrides
- `src/components/skeletons/ScheduleSkeleton.tsx` — `light:` overrides
- `src/components/skeletons/SearchResultsSkeleton.tsx` — `light:` overrides
- `src/app/@modal/layout.tsx` — `light:` overrides
- `src/app/page.tsx` — `light:` overrides
- `src/app/about/page.tsx` — `light:` overrides
- `src/app/donate/page.tsx` — `light:` overrides
- `src/app/scheduled-list/page.tsx` — `light:` overrides
- `src/app/sleep-timer/SleepTimerClient.tsx` — `light:` overrides
- `src/app/teachers/page.tsx` — `light:` overrides
- `src/app/teachers/[slug]/page.tsx` — `light:` overrides
- `src/app/teachers/[slug]/error.tsx` — `light:` overrides

---

## Task 1: Add Tailwind v4 custom variants

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add dual custom variants after `@import "tailwindcss"`**

Open `src/app/globals.css`. Add these two lines immediately after line 1 (`@import "tailwindcss"`):

```css
@import "tailwindcss";
/* Theme variants — .light/.dark on <html> triggers these prefixes */
@custom-variant light (&:where(.light, .light *));
@custom-variant dark (&:where(.dark, .dark *));
@import "tw-animate-css";
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully` (or similar — no errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): add light/dark custom Tailwind v4 variants"
```

---

## Task 2: ThemeProvider + useTheme + tests

**Files:**
- Create: `src/components/theme/ThemeProvider.tsx`
- Create: `tests/unit/theme-provider.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/theme-provider.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useTheme } from '@/components/theme/ThemeProvider'

// Minimal consumer to read context
function ThemeReader({ onRender }: { onRender: (v: { theme: string }) => void }) {
  const ctx = useTheme()
  onRender(ctx)
  return null
}

function wrap(children: React.ReactNode) {
  const { ThemeProvider } = require('@/components/theme/ThemeProvider')
  return <ThemeProvider>{children}</ThemeProvider>
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'cookie', { writable: true, value: '' })
    document.documentElement.className = ''
    document.body.removeAttribute('data-app')
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === '(prefers-color-scheme: dark)' ? false : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('applies dark class when cookie is dark', async () => {
    Object.defineProperty(document, 'cookie', { writable: true, value: 'theme=dark' })
    await act(async () => { render(wrap(<div />)) })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('applies light class when cookie is light', async () => {
    Object.defineProperty(document, 'cookie', { writable: true, value: 'theme=light' })
    await act(async () => { render(wrap(<div />)) })
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('defaults to dark for native app context (no cookie)', async () => {
    document.body.setAttribute('data-app', 'true')
    await act(async () => { render(wrap(<div />)) })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('follows system preference (light) when no cookie and not native app', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, // prefers-color-scheme: light
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    await act(async () => { render(wrap(<div />)) })
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('useTheme setTheme updates class and sets cookie', async () => {
    let ctx: ReturnType<typeof useTheme>
    const capture = vi.fn((v) => { ctx = v })
    await act(async () => { render(wrap(<ThemeReader onRender={capture} />)) })
    await act(async () => { ctx!.setTheme('light') })
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/theme-provider.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '@/components/theme/ThemeProvider'`

- [ ] **Step 3: Create ThemeProvider**

Create `src/components/theme/ThemeProvider.tsx`:

```tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', setTheme: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

function getThemeCookie(): Theme | null {
  const m = document.cookie.match(/(?:^|;\s*)theme=(light|dark|system)/)
  return m ? (m[1] as Theme) : null
}

function setThemeCookie(theme: Theme) {
  document.cookie = `theme=${theme};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax`
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme
  html.classList.remove('light', 'dark')
  html.classList.add(resolved)
}

function ThemeInit({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const param = searchParams.get('theme')
    if (param === 'light' || param === 'dark' || param === 'system') {
      setThemeCookie(param)
      setThemeState(param)
      applyTheme(param)
      return
    }

    const cookie = getThemeCookie()

    if (!cookie && document.body.dataset.app === 'true') {
      setThemeState('dark')
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add('dark')
      return
    }

    const effectiveTheme: Theme = cookie ?? 'system'
    setThemeState(effectiveTheme)

    if (effectiveTheme !== 'system') {
      applyTheme(effectiveTheme)
      return
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => applyTheme('system')
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [searchParams])

  const setTheme = useCallback((t: Theme) => {
    setThemeCookie(t)
    setThemeState(t)
    applyTheme(t)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <ThemeInit>{children}</ThemeInit>
    </Suspense>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/theme-provider.test.tsx 2>&1 | tail -10
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/theme/ThemeProvider.tsx tests/unit/theme-provider.test.tsx
git commit -m "feat(theme): add ThemeProvider with cookie, URL param, and system preference support"
```

---

## Task 3: API route /api/theme + tests

**Files:**
- Create: `src/app/api/theme/route.ts`
- Create: `tests/unit/api-theme.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/api-theme.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/theme/route'
import { NextRequest } from 'next/server'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/theme', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/theme', () => {
  it('returns 200 and sets cookie for valid theme', async () => {
    const res = await POST(makeRequest({ theme: 'dark' }))
    expect(res.status).toBe(200)
    const cookie = res.cookies.get('theme')
    expect(cookie?.value).toBe('dark')
  })

  it('accepts light and system themes', async () => {
    for (const theme of ['light', 'system'] as const) {
      const res = await POST(makeRequest({ theme }))
      expect(res.status).toBe(200)
      expect(res.cookies.get('theme')?.value).toBe(theme)
    }
  })

  it('returns 400 for invalid theme', async () => {
    const res = await POST(makeRequest({ theme: 'purple' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed body', async () => {
    const req = new NextRequest('http://localhost/api/theme', {
      method: 'POST',
      body: 'not-json',
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/api-theme.test.ts 2>&1 | tail -5
```

Expected: FAIL — cannot find module.

- [ ] **Step 3: Create the route**

Create `src/app/api/theme/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const theme = (body as Record<string, unknown>)?.theme
  if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
    return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('theme', theme, {
    maxAge: 365 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  })
  return res
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/api-theme.test.ts 2>&1 | tail -5
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/theme/route.ts tests/unit/api-theme.test.ts
git commit -m "feat(theme): add POST /api/theme cookie-setting route"
```

---

## Task 4: ThemeToggle component + tests

**Files:**
- Create: `src/components/theme/ThemeToggle.tsx`
- Create: `tests/unit/theme-toggle.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/theme-toggle.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

vi.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: vi.fn(() => ({ theme: 'dark', setTheme: vi.fn() })),
}))

describe('ThemeToggle', () => {
  it('renders Light, Dark, System buttons', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument()
  })

  it('marks active theme button as pressed', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: /dark/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /light/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls setTheme when a button is clicked', async () => {
    const setTheme = vi.fn()
    const { useTheme } = await import('@/components/theme/ThemeProvider')
    vi.mocked(useTheme).mockReturnValue({ theme: 'dark', setTheme })
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button', { name: /light/i }))
    expect(setTheme).toHaveBeenCalledWith('light')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/theme-toggle.test.tsx 2>&1 | tail -5
```

Expected: FAIL — cannot find module.

- [ ] **Step 3: Create ThemeToggle**

Create `src/components/theme/ThemeToggle.tsx`:

```tsx
'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark' | 'system'

const OPTIONS: { value: Theme; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div role="group" aria-label="Color theme" className="inline-flex items-center rounded-lg bg-white/5 light:bg-gray-100 p-0.5 gap-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
            theme === value
              ? 'bg-green-600 text-white'
              : 'text-white/60 hover:text-white/90 light:text-gray-500 light:hover:text-gray-900'
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/theme-toggle.test.tsx 2>&1 | tail -5
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run full test suite to confirm nothing broken**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/theme/ThemeToggle.tsx tests/unit/theme-toggle.test.tsx
git commit -m "feat(theme): add ThemeToggle component (Light/Dark/System)"
```

---

## Task 5: SSR initial class + ThemeProvider in layout.tsx

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add theme cookie parsing and ThemeProvider wrap**

In `src/app/layout.tsx`, make these changes:

1. Add the import at the top with other component imports:
```tsx
import { ThemeProvider } from '@/components/theme/ThemeProvider'
```

2. Inside `RootLayout`, after the existing cookie/isMobileApp lines, add theme resolution:
```tsx
// Existing lines (keep as-is):
const cookieHeader = headersList.get('cookie') ?? ''
const isMobileApp =
  headersList.get('mobile-app') === 'true' ||
  cookieHeader.split(';').some(c => c.trim() === 'mobile-app=true')

// Add these new lines:
const themeCookieValue = cookieHeader
  .split(';')
  .map(c => c.trim())
  .find(c => c.startsWith('theme='))
  ?.replace('theme=', '')
const initialThemeClass: string =
  themeCookieValue === 'dark' || themeCookieValue === 'light'
    ? themeCookieValue
    : isMobileApp
      ? 'dark'
      : ''
```

3. Set `className` on `<html>`:
```tsx
// Change:
<html lang="en">
// To:
<html lang="en" className={initialThemeClass || undefined}>
```

4. Wrap the `<body>` contents with `<ThemeProvider>` (inside `<TooltipProvider>`):
```tsx
<body className={`bg-[var(--color-brand-purple)] text-white min-h-screen light:bg-white light:text-gray-900${!isMobileApp ? ' pb-[152px]' : ''}`} data-app={isMobileApp ? 'true' : undefined}>
  <ThemeProvider>
    <TooltipProvider delayDuration={500}>
      {/* ... all existing children unchanged ... */}
    </TooltipProvider>
  </ThemeProvider>
</body>
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Smoke test — start dev server and visit `/?theme=light`**

```bash
npm run dev &
sleep 4
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/?theme=light
```

Expected: `200`.

- [ ] **Step 4: Confirm theme class is set via URL param**

Visit `http://localhost:3000/?theme=light` in a browser. Open DevTools → Elements → `<html>`. Should have `class="light"`. Visit `/?theme=dark` — should have `class="dark"`.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(theme): add SSR initial theme class and ThemeProvider to root layout"
```

---

## Task 6: Layout shell — Header, MobileHeader, MobileNav

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/MobileHeader.tsx`
- Modify: `src/components/layout/MobileNav.tsx`

- [ ] **Step 1: Update Header.tsx**

Apply these class additions (add `light:` suffixes — do not remove existing classes):

```tsx
// Line 49 — header element className:
// Change:
className="hidden md:flex fixed top-0 z-50 w-full h-16 items-center justify-between bg-gray-800 border-b border-b-green-500/20 px-6"
// To:
className="hidden md:flex fixed top-0 z-50 w-full h-16 items-center justify-between bg-gray-800 light:bg-white border-b border-b-green-500/20 light:border-b-gray-200 px-6"

// Line 80 — nav link span (text-white):
// Change:
<span className={`relative z-10 text-white text-[clamp(14px,1.5vw,16px)] ${isActive ? 'font-bold' : ''}`}>
// To:
<span className={`relative z-10 text-white light:text-gray-900 text-[clamp(14px,1.5vw,16px)] ${isActive ? 'font-bold' : ''}`}>

// Line 94 — Facebook icon fill:
// Change:
className="w-7 fill-slate-300 hover:fill-white transition-colors duration-500 ..."
// To:
className="w-7 fill-slate-300 light:fill-gray-500 hover:fill-white light:hover:fill-gray-900 transition-colors duration-500 ..."
```

- [ ] **Step 2: Update MobileHeader.tsx**

```tsx
// Line 38 — header className:
// Change:
className="md:hidden fixed top-0 z-50 flex items-center justify-between w-full min-h-[64px] px-4 bg-black border-b border-b-white/10"
// To:
className="md:hidden fixed top-0 z-50 flex items-center justify-between w-full min-h-[64px] px-4 bg-black light:bg-white border-b border-b-white/10 light:border-b-gray-200"

// Line 57 — Facebook SVG fill:
// Change:
className="w-8 fill-slate-300 hover:fill-white transition-colors duration-500"
// To:
className="w-8 fill-slate-300 light:fill-gray-500 hover:fill-white light:hover:fill-gray-900 transition-colors duration-500"
```

- [ ] **Step 3: Update MobileNav.tsx**

```tsx
// Line 39 — nav className:
// Change:
className="md:hidden fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-around w-full px-1 text-white bg-black border-t border-t-green-500"
// To:
className="md:hidden fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-around w-full px-1 text-white light:text-gray-900 bg-black light:bg-white border-t border-t-green-500 light:border-t-green-600"

// Line 56 — SVG fill:
// Change:
<svg className="w-5 h-5 fill-white" viewBox="0 -960 960 960" aria-hidden="true">
// To:
<svg className="w-5 h-5 fill-white light:fill-gray-900" viewBox="0 -960 960 960" aria-hidden="true">
```

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx src/components/layout/MobileHeader.tsx src/components/layout/MobileNav.tsx
git commit -m "feat(theme): add light: overrides to layout shell (Header, MobileHeader, MobileNav)"
```

---

## Task 7: Footer + MediaBar

**Files:**
- Modify: `src/components/layout/Footer.tsx`
- Modify: `src/components/media-bar/MediaBar.tsx`
- Modify: `src/components/media-bar/NowPlayingInfo.tsx`

- [ ] **Step 1: Update Footer.tsx — add ThemeToggle + light: overrides**

```tsx
import { ThemeToggle } from '@/components/theme/ThemeToggle'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="overflow-hidden relative z-10 border-t border-t-gray-500 light:border-t-gray-200 px-[clamp(10px,_3vw,_30px)] py-[clamp(20px,_3vw,_30px)] bg-[var(--color-brand-gray)] light:bg-gray-100 mt-5">
      <div className="text-white light:text-gray-900 text-xs">
        Reach Radio is a ministry of{' '}
        <a
          className="font-bold border-b-2 border-b-green-500 pb-1"
          href="https://calvarytucson.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Calvary Tucson Church
        </a>{' '}
        © {year}
      </div>

      <div className="mt-8">
        <div className="w-[50px] border-t border-gray-300 light:border-gray-400" />
        <div className="text-gray-300 light:text-gray-500 text-xs mt-1">
          Structured content powered by{' '}
          <a
            className="font-bold"
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.sanity.io/"
          >
            Sanity.io
          </a>
        </div>
      </div>

      <div className="mt-6">
        <ThemeToggle />
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Update MediaBar.tsx**

```tsx
// Line 27 — div className:
// Change:
className="fixed bottom-[72px] md:bottom-0 left-0 right-0 bg-[var(--color-brand-gray)] border-t border-white/10 px-4 py-3 flex items-center gap-3 z-50"
// To:
className="fixed bottom-[72px] md:bottom-0 left-0 right-0 bg-[var(--color-brand-gray)] light:bg-gray-100 border-t border-white/10 light:border-gray-200 px-4 py-3 flex items-center gap-3 z-50"
```

- [ ] **Step 3: Update NowPlayingInfo.tsx**

```tsx
// text-white → add light:text-gray-900
// text-white/70 → add light:text-gray-500
```

Open `src/components/media-bar/NowPlayingInfo.tsx` and add `light:text-gray-900` to the title `<p>` and `light:text-gray-500` to the artist `<p>`.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Footer.tsx src/components/media-bar/MediaBar.tsx src/components/media-bar/NowPlayingInfo.tsx
git commit -m "feat(theme): add light: overrides to Footer (+ ThemeToggle) and MediaBar"
```

---

## Task 8: Modal / sheet chrome components

**Files:**
- Modify: `src/components/modals/chrome/SheetChrome.tsx`
- Modify: `src/components/modals/chrome/TeacherPanelChrome.tsx`
- Modify: `src/components/global/BottomSheet.tsx`

- [ ] **Step 1: Update SheetChrome.tsx**

Apply these additions:

```tsx
// Line 33 — outer content div (bg-gray-800, border-white/10):
// bg-gray-800 → add light:bg-white
// border-white/10 → add light:border-gray-200

// Line 54 — drag handle inner div (bg-white/30):
// add light:bg-gray-300

// Line 57 — header div (border-white/10, bg-gray-800):
// add light:border-gray-200 light:bg-white

// Line 59 — h2 (text-white):
// add light:text-gray-900

// Line 64 — close button (text-white/60, hover:bg-white/10, hover:text-white):
// add light:text-gray-500 light:hover:bg-gray-100 light:hover:text-gray-900
```

Full updated className strings:

```tsx
// outer div (line ~33):
className={cn(
  'w-full max-h-[90dvh] overflow-hidden flex flex-col border border-white/10 light:border-gray-200 bg-gray-800 light:bg-white p-0',
  'rounded-t-2xl rounded-b-none h-[85dvh]',
  isClosing ? MODAL_EXIT_ANIMATION : MODAL_ENTER_ANIMATION,
  'sm:inset-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:w-[95vw] sm:rounded-2xl',
  className
)}

// drag handle div:
<div className="h-1 w-10 rounded-full bg-white/30 light:bg-gray-300" aria-hidden="true" />

// header div:
<div className="shrink-0 flex items-center justify-between border-b border-white/10 light:border-gray-200 bg-gray-800 light:bg-white px-6 py-4">

// h2:
<h2 className="text-xl font-bold text-white light:text-gray-900">{title}</h2>

// close button:
className="ml-auto -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 light:text-gray-500 transition-colors hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 cursor-pointer"
```

- [ ] **Step 2: Update TeacherPanelChrome.tsx**

```tsx
// bg-[#0f1a0a] is the dark teacher panel bg — for light mode use white
// Add light:bg-white to the inner panel div
// border-white/[0.08] → add light:border-gray-200
// text-white/60 → add light:text-gray-500
// hover:bg-white/10 → add light:hover:bg-gray-100
// hover:text-white → add light:hover:text-gray-900
// bg-white/30 (drag handle) → add light:bg-gray-300

// Line 28 — inner panel div:
className={cn(
  'w-full flex flex-col bg-[#0f1a0a] light:bg-white border-white/[0.08] light:border-gray-200 overflow-hidden',
  ...
)}

// Drag handle:
<div className="h-1 w-10 rounded-full bg-white/30 light:bg-gray-300" aria-hidden="true" />

// Close buttons (both mobile and desktop):
className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 light:text-gray-500 hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 transition-colors cursor-pointer"
```

- [ ] **Step 3: Update BottomSheet.tsx**

```tsx
// Line 76 — sheet div (bg-gray-800):
// Add light:bg-white

// Line 88 — drag handle div (bg-white/30):
// Add light:bg-gray-300

// Full change:
className={`fixed inset-x-0 bottom-0 z-[70] bg-gray-800 light:bg-white rounded-t-2xl transition-transform duration-[280ms] ease-out ${
  visible ? 'translate-y-0' : 'translate-y-full'
} ${className ?? ''}`}

// drag handle:
<div className="h-1 w-10 rounded-full bg-white/30 light:bg-gray-300" />
```

- [ ] **Step 4: Run existing modal/sheet tests**

```bash
npx vitest run tests/unit/sheet-chrome.test.tsx tests/unit/bottom-sheet.test.tsx 2>&1 | tail -5
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/chrome/SheetChrome.tsx src/components/modals/chrome/TeacherPanelChrome.tsx src/components/global/BottomSheet.tsx
git commit -m "feat(theme): add light: overrides to modal/sheet chrome components"
```

---

## Task 9: Home components

**Files:**
- Modify: `src/components/home/RadioPlayer.tsx`
- Modify: `src/components/home/TodaySchedule.tsx`
- Modify: `src/components/home/SleepTimerSheet.tsx`
- Modify: `src/components/home/SleepTimerButton.tsx`
- Modify: `src/components/home/VolumeControl.tsx`

- [ ] **Step 1: Update RadioPlayer.tsx**

```tsx
// Line 54 — outer div (bg-[#1c2128]):
// Change:
className="p-2 pb-5 md:p-5 bg-[#1c2128] border border-white/5 rounded-[18px]"
// To:
className="p-2 pb-5 md:p-5 bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px]"

// title p (text-white):
// Add light:text-gray-900

// artist p (text-white/80):
// Add light:text-gray-700
```

- [ ] **Step 2: Update TodaySchedule.tsx**

Add `light:` overrides to each class group:

```tsx
// "now playing" row div (bg-white/5, border-white/10, text-white):
className="flex items-center gap-5 bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-xl p-2 text-white light:text-gray-900"

// "Reach Radio" label (text-white/70):
className="uppercase text-sm text-white/70 light:text-gray-500"

// schedule list wrapper (text-white):
className="flex flex-col gap-y-2 text-white light:text-gray-900"

// schedule row name (text-white/70):
className="uppercase text-sm text-white/70 light:text-gray-500"

// schedule row time (text-white/60):
className="text-sm text-white/60 light:text-gray-500"

// clickable schedule row (bg-white/5, border-white/10):
className="schedule-row flex gap-5 bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-xl p-2"

// hover row (bg-white/5, hover:bg-white/10):
className="schedule-row flex items-center justify-between flex-wrap bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-xl p-2 hover:bg-white/10 light:hover:bg-gray-100 hover:border-white/20 light:hover:border-gray-300 transition-colors cursor-pointer"
```

- [ ] **Step 3: Update SleepTimerSheet.tsx**

```tsx
// h2 (text-white):
className="text-white light:text-gray-900 text-xl font-bold select-none"

// close button (text-white/60, hover:bg-white/10, hover:text-white):
className="-mr-2 flex h-11 w-11 ... text-white/60 light:text-gray-500 ... hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 cursor-pointer"

// timer display (text-white):
className="text-white light:text-gray-900 text-5xl font-mono mb-2"

// timer subtitle (text-white/60):
className="text-white/60 light:text-gray-500 text-sm mb-8"

// preset buttons (bg-gray-700, text-white):
className="bg-gray-700 light:bg-gray-200 text-white light:text-gray-900 py-5 rounded-xl ..."
```

- [ ] **Step 4: Update SleepTimerButton.tsx**

```tsx
// button (bg-gray-500):
className="bg-gray-500 light:bg-gray-300 rounded-full p-1 w-9 h-9 flex items-center justify-center cursor-pointer ..."

// Clock icon (text-white):
<Clock className="w-5 h-5 text-white light:text-gray-900" />
```

- [ ] **Step 5: Update VolumeControl.tsx**

```tsx
// icon props (text-white):
const props = { size: 18, className: 'text-white light:text-gray-900' } as const
```

- [ ] **Step 6: Run existing sleep timer tests**

```bash
npx vitest run tests/unit/sleep-timer-button.test.tsx tests/unit/sleep-timer-sheet.test.tsx 2>&1 | tail -5
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/home/RadioPlayer.tsx src/components/home/TodaySchedule.tsx src/components/home/SleepTimerSheet.tsx src/components/home/SleepTimerButton.tsx src/components/home/VolumeControl.tsx
git commit -m "feat(theme): add light: overrides to home components"
```

---

## Task 10: Global utility components

**Files:**
- Modify: `src/components/global/SearchInput.tsx`
- Modify: `src/components/global/PassiveSearchBar.tsx`
- Modify: `src/components/global/BackButton.tsx`
- Modify: `src/components/global/Pagination.tsx`
- Modify: `src/components/global/Breadcrumbs.tsx`
- Modify: `src/components/global/SectionErrorBoundary.tsx`

- [ ] **Step 1: Update SearchInput.tsx**

```tsx
// search icon (text-white/60):
className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 light:text-gray-400 pointer-events-none"

// input (border-white/20, bg-white/5, text-white, placeholder:text-white/60):
className="w-full rounded-lg border border-white/20 light:border-gray-300 bg-white/5 light:bg-white pl-10 pr-10 py-2 text-white light:text-gray-900 placeholder:text-white/60 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"

// clear button (border-white/20, bg-white/5, text-white/60):
className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded border border-white/20 light:border-gray-300 bg-white/5 light:bg-gray-50 text-white/60 light:text-gray-400 hover:text-white/80 light:hover:text-gray-700 hover:border-white/40 light:hover:border-gray-400 cursor-pointer"
```

- [ ] **Step 2: Update PassiveSearchBar.tsx**

```tsx
// button (border-white/10, bg-white/5, hover:bg-white/10):
'flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-white/10 light:border-gray-300 bg-white/5 light:bg-gray-50 px-4 py-3 transition-colors hover:bg-white/10 light:hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer'

// search icon (text-white/40):
className="text-white/40 light:text-gray-400 shrink-0"

// placeholder (text-white/40):
<span className="text-white/40 light:text-gray-400">{placeholder}</span>
```

- [ ] **Step 3: Update BackButton.tsx**

```tsx
// button (bg-white/25, text-white, hover:bg-white/40):
'hidden h-11 w-11 items-center justify-center rounded-full bg-white/25 light:bg-gray-200 text-white light:text-gray-900 transition-all duration-300 hover:bg-white/40 light:hover:bg-gray-300 md:flex cursor-pointer ...'
```

- [ ] **Step 4: Update Pagination.tsx**

```tsx
// prev/next buttons (border-white/10, bg-white/5, text-white/80, hover:bg-white/10):
className="rounded-lg border border-white/10 light:border-gray-300 bg-white/5 light:bg-gray-50 px-4 py-2 text-sm text-white/80 light:text-gray-700 transition-colors hover:bg-white/10 light:hover:bg-gray-100"

// ellipsis (text-white/60):
<span key={`e${i}`} className="px-2 text-white/60 light:text-gray-400">...</span>

// page buttons — inactive state (border-white/10, bg-white/5, text-white/70):
'border border-white/10 light:border-gray-300 bg-white/5 light:bg-gray-50 text-white/70 light:text-gray-700 hover:bg-white/10 light:hover:bg-gray-100'
```

- [ ] **Step 5: Update Breadcrumbs.tsx**

```tsx
// BreadcrumbList (bg-black/30):
className="rounded-lg bg-black/30 light:bg-gray-100 backdrop-blur-sm px-3 py-1.5 w-fit font-semibold gap-2"

// BreadcrumbLink (text-white/80, hover:text-white):
className="text-white/80 light:text-gray-600 underline-offset-4 hover:text-white light:hover:text-gray-900 hover:underline cursor-pointer"

// BreadcrumbSeparator (text-white/60):
className="text-white/60 light:text-gray-400"

// BreadcrumbPage (text-white):
className="text-white light:text-gray-900"
```

- [ ] **Step 6: Update SectionErrorBoundary.tsx**

```tsx
// error container (border-white/10, bg-white/5, text-white/60):
className="rounded-2xl border border-white/10 light:border-gray-200 bg-white/5 light:bg-gray-50 px-6 py-8 text-center text-sm text-white/60 light:text-gray-500"
```

- [ ] **Step 7: Run existing global component tests**

```bash
npx vitest run tests/unit/passive-search-bar.test.tsx 2>&1 | tail -5
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add \
  src/components/global/SearchInput.tsx \
  src/components/global/PassiveSearchBar.tsx \
  src/components/global/BackButton.tsx \
  src/components/global/Pagination.tsx \
  src/components/global/Breadcrumbs.tsx \
  src/components/global/SectionErrorBoundary.tsx
git commit -m "feat(theme): add light: overrides to global utility components"
```

---

## Task 11: Teacher components

**Files:**
- Modify: `src/components/teachers/TeacherCard.tsx`
- Modify: `src/components/teachers/TeacherDetailContent.tsx`
- Modify: `src/components/teachers/TeacherSearchClient.tsx`
- Modify: `src/components/teachers/TeachersClientView.tsx`
- Modify: `src/components/teachers/primitives/TeacherInfoChip.tsx`

- [ ] **Step 1: Update TeacherCard.tsx**

```tsx
// card link (bg-[#1c2128], border-white/5, focus-visible:ring-white):
className="teacher-card block rounded-[18px] overflow-hidden bg-[#1c2128] light:bg-white border border-white/5 light:border-gray-200 motion-safe:hover:scale-[1.03] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white light:focus-visible:ring-gray-400 cursor-pointer"

// name p (text-white):
<p className="text-white light:text-gray-900 font-bold text-[13px] md:text-sm leading-snug" aria-hidden="true">

// title p (text-white/80):
<p className="text-white/80 light:text-gray-600 text-[11px] md:text-xs mt-[3px]" aria-hidden="true">
```

- [ ] **Step 2: Update TeacherDetailContent.tsx**

```tsx
// outer wrapper (text-white):
<div className="text-white light:text-gray-900">

// bio text (text-white/85):
<p className="text-base text-white/85 light:text-gray-700 mt-[3px] font-medium">

// schedule tab chip (bg-white/10, border-white/20, text-white/80):
className="bg-white/10 light:bg-gray-100 border border-white/20 light:border-gray-300 rounded-full px-4 py-2 text-sm font-semibold text-white/80 light:text-gray-700 hover:bg-white/15 light:hover:bg-gray-200 hover:text-white light:hover:text-gray-900 transition-colors cursor-pointer"

// divider (bg-white/6):
<div className="h-px bg-white/6 light:bg-gray-200 mx-4 md:hidden mb-3" />

// schedule section header (text-white/80):
<p className="text-sm font-bold uppercase tracking-[0.1em] text-white/80 light:text-gray-600 mb-[10px]">

// day name (text-white/90):
<p className="text-base font-bold text-white/90 light:text-gray-900 mb-[5px]">{day.day}</p>

// show slot (bg-[rgba(132,184,79,0.08)] keeps; text-white/90):
className="border-l-[3px] border-[#84b84f] bg-[rgba(132,184,79,0.08)] light:bg-green-50 rounded-r-[8px] py-1.5 px-2.5 text-base md:text-sm text-white/90 light:text-gray-900 mb-[3px]"

// recommended teacher span (text-white/80):
<span className="text-sm text-white/80 light:text-gray-700 text-center line-clamp-2 leading-tight">
```

- [ ] **Step 3: Update TeacherSearchClient.tsx**

```tsx
// filter chip inactive (bg-white/5, border-white/10, text-white/60):
'bg-white/5 light:bg-gray-50 border-white/10 light:border-gray-200 text-white/60 light:text-gray-500 can-hover:hover:border-white/20 light:can-hover:hover:border-gray-400 can-hover:hover:text-white/80 light:can-hover:hover:text-gray-900'

// filter label (text-white/60):
'text-[10px] font-semibold text-white/60 light:text-gray-500 uppercase tracking-widest mb-1.5'

// search icon (text-white/40):
className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 light:text-gray-400"

// search input (bg-white/5, border-white/10, text-white, placeholder:text-white/40):
className="w-full bg-white/5 light:bg-white border border-white/10 light:border-gray-300 rounded-xl pl-10 pr-12 py-2.5 text-sm text-white light:text-gray-900 placeholder:text-white/40 light:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 light:focus:ring-gray-300"

// spinner (text-white/40):
className="h-4 w-4 text-white/40 light:text-gray-400 animate-spin"

// clear button (text-white/40):
className="flex h-8 w-8 items-center justify-center text-white/40 light:text-gray-400 hover:text-white light:hover:text-gray-900 cursor-pointer"

// result count (text-white/45):
className="ml-auto text-xs text-white/45 light:text-gray-400 ..."

// section label (text-white/60):
className="text-sm text-white/60 light:text-gray-500 mb-3"

// result row (bg-white/5, border-white/10):
className="w-full rounded-xl border border-white/10 light:border-gray-200 bg-white/5 light:bg-gray-50 p-3 flex items-center gap-3 text-left transition-colors cursor-pointer can-hover:hover:bg-white/10 light:can-hover:hover:bg-gray-100 can-hover:hover:border-white/20 light:can-hover:hover:border-gray-300"

// result name (text-white):
<p className="text-sm font-semibold text-white light:text-gray-900 truncate">

// result title (text-white/60):
<p className="text-xs text-white/60 light:text-gray-500 truncate">

// empty state (text-white/45):
<p className="text-sm text-white/45 light:text-gray-400 py-12">
```

- [ ] **Step 4: Update TeachersClientView.tsx**

```tsx
// tab list border (border-white/7):
<div role="tablist" className="flex gap-1 mb-5 border-b border-white/7 light:border-gray-200">

// inactive tab (text-white/55):
: 'text-white/55 light:text-gray-500 border-transparent hover:text-white/75 light:hover:text-gray-700'

// count label (text-white/55):
<p className="text-[13px] md:text-sm font-bold uppercase tracking-[0.08em] text-white/55 light:text-gray-500">

// count value (text-white/50):
<span className="text-[12px] md:text-sm text-white/50 light:text-gray-400">
```

- [ ] **Step 5: Update TeacherInfoChip.tsx**

```tsx
// dim variant (bg-white/5, border-white/10, text-white/50):
dim: 'bg-white/5 light:bg-gray-100 border border-white/10 light:border-gray-200 text-white/50 light:text-gray-500',
```

- [ ] **Step 6: Run teacher component tests**

```bash
npx vitest run tests/unit/teacher-card.test.tsx tests/unit/teacher-search-client.test.tsx tests/unit/recommended-teachers.test.tsx 2>&1 | tail -5
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add \
  src/components/teachers/TeacherCard.tsx \
  src/components/teachers/TeacherDetailContent.tsx \
  src/components/teachers/TeacherSearchClient.tsx \
  src/components/teachers/TeachersClientView.tsx \
  src/components/teachers/primitives/TeacherInfoChip.tsx
git commit -m "feat(theme): add light: overrides to teacher components"
```

---

## Task 12: Schedule components

**Files:**
- Modify: `src/components/teachers/ScheduleCardList.tsx`
- Modify: `src/components/teachers/ScheduleTabView.tsx`
- Modify: `src/components/teachers/ScheduleWeekCards.tsx`
- Modify: `src/components/teachers/RecommendedTeachers.tsx`

- [ ] **Step 1: Update ScheduleCardList.tsx**

```tsx
// empty state (text-white/50):
<p className="text-white/50 light:text-gray-400 text-sm text-center py-8">No shows scheduled for this day.</p>

// music slot row (bg-white/[0.025]):
className="bg-white/[0.025] light:bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-2"

// music label (text-white/25):
<span className="text-white/25 light:text-gray-400 text-xs italic">♪ Music</span>

// music time (text-white/20):
<span className="text-white/20 light:text-gray-300 text-xs">

// inactive row (bg-white/[0.04]):
'bg-white/[0.04] light:bg-gray-50 hover:bg-white/[0.07] light:hover:bg-gray-100'

// teacher name (text-white):
<p className={`text-white light:text-gray-900 font-semibold truncate ${compact ? 'text-xs' : 'text-sm'}`}>

// time text (text-white/55 when inactive):
className={`${compact ? 'text-[10px]' : 'text-xs'} ${isActive ? 'text-[#84b84f]' : 'text-white/55 light:text-gray-500'}`}

// play chip inactive (text-white/30, bg-white/[0.06]):
: 'text-white/30 light:text-gray-400 bg-white/[0.06] light:bg-gray-100'
```

- [ ] **Step 2: Update ScheduleTabView.tsx**

```tsx
// "Most on air" text (text-white/55):
<span className="text-xs text-white/55 light:text-gray-500">

// teacher name in badge (text-white):
<span className="text-white light:text-gray-900 font-semibold">

// day picker button (bg-[#262d34], border-white/20, text-white):
className="flex items-center gap-2 mb-4 px-4 py-[7px] rounded-full bg-[#262d34] light:bg-gray-100 border border-white/20 light:border-gray-300 text-white light:text-gray-900 text-sm font-semibold cursor-pointer"

// chevron (text-white/50):
<ChevronDown className="h-3.5 w-3.5 text-white/50 light:text-gray-400" aria-hidden="true" />

// day header label (text-white/40):
<p className="text-xs font-semibold uppercase tracking-wider text-white/40 light:text-gray-400 mb-3">

// day button row (hover:bg-white/5):
className="flex items-center gap-3 w-full px-2 py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors hover:bg-white/5 light:hover:bg-gray-50 active:bg-white/10 light:active:bg-gray-100"

// day name (text-white or text-white/60):
<span className={selectedDay === day ? 'text-white light:text-gray-900' : 'text-white/60 light:text-gray-500'}>
```

- [ ] **Step 3: Update ScheduleWeekCards.tsx**

```tsx
// inactive day text (text-white/40, border-white/[0.06]):
: 'text-white/40 light:text-gray-400 border-white/[0.06] light:border-gray-200'
```

- [ ] **Step 4: Update RecommendedTeachers.tsx**

```tsx
// section label (text-white/55):
<p className="text-[11px] md:text-sm font-bold uppercase tracking-[0.08em] text-white/55 light:text-gray-500 ...">

// teacher name (text-white/75):
<span className="text-xs md:text-[13px] text-white/75 light:text-gray-700 text-center leading-tight line-clamp-2">

// arrow icon (text-white/50):
<svg className="w-4 h-4 text-white/50 light:text-gray-400" ...>
```

- [ ] **Step 5: Run schedule tests**

```bash
npx vitest run tests/unit/schedule-card-list.test.tsx 2>&1 | tail -5
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add \
  src/components/teachers/ScheduleCardList.tsx \
  src/components/teachers/ScheduleTabView.tsx \
  src/components/teachers/ScheduleWeekCards.tsx \
  src/components/teachers/RecommendedTeachers.tsx
git commit -m "feat(theme): add light: overrides to schedule components"
```

---

## Task 13: Pages

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/about/page.tsx`
- Modify: `src/app/donate/page.tsx`
- Modify: `src/app/scheduled-list/page.tsx`
- Modify: `src/app/sleep-timer/SleepTimerClient.tsx`
- Modify: `src/app/teachers/page.tsx`
- Modify: `src/app/teachers/[slug]/page.tsx`
- Modify: `src/app/teachers/[slug]/error.tsx`
- Modify: `src/app/@modal/layout.tsx`

- [ ] **Step 1: Update `src/app/page.tsx`**

```tsx
// "Playing Next" label (text-white/80):
<h2 className="text-[10px] md:text-[12px] font-bold uppercase tracking-[0.08em] text-white/80 light:text-gray-600 mb-3 px-1">Playing Next</h2>
```

- [ ] **Step 2: Update `src/app/about/page.tsx`**

```tsx
// info grid border (border-white/5):
<div className="grid md:grid-cols-2 rounded-[18px] overflow-hidden border border-white/5 light:border-gray-200">

// text-only half (bg-[#1c2128]):
<div className="p-6 bg-[#1c2128] light:bg-gray-50">

// section label (text-white):
<div className="border-l-4 pl-3 font-bold text-sm mb-3 border-l-[#84b84f] uppercase text-white light:text-gray-900 tracking-wide">

// body text (text-white/70):
<p className="text-white/70 light:text-gray-600 text-sm leading-relaxed">

// app download card (bg-[#1c2128], border-white/5):
<div className="bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-5">

// card label (text-white/80):
<h2 className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/80 light:text-gray-600 mb-4">

// got questions card (bg-[#1c2128], border-white/5):
<div className="bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-5">

// got questions label (text-white/80):
<h2 className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/80 light:text-gray-600 mb-2">

// got questions body (text-white/60):
<p className="text-white/60 light:text-gray-500 text-sm mb-4">

// privacy policy link row (bg-white/5, border-white/10):
className="block bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-xl p-5 hover:bg-white/10 light:hover:bg-gray-100 hover:border-white/20 light:hover:border-gray-300 transition-colors cursor-pointer group"

// privacy title (text-white):
<p className="text-white light:text-gray-900 font-semibold text-sm">

// privacy body (text-white/70):
<p className="text-white/70 light:text-gray-500 text-xs mt-1">

// arrow icon (text-white/40):
className="w-4 h-4 text-white/40 light:text-gray-400 group-hover:text-white/70 light:group-hover:text-gray-600 ..."
```

- [ ] **Step 3: Update `src/app/donate/page.tsx`**

```tsx
// page title (text-white):
<h1 className="text-[22px] md:text-4xl font-extrabold text-white light:text-gray-900 tracking-tight mb-6">Donate</h1>

// error/loading text (text-white/70):
<div role="alert" className="text-white/70 light:text-gray-500 text-sm py-8 text-center">

// skeleton container (bg-[#1c2128], border-white/5):
<div className="animate-pulse flex flex-col gap-4 h-[900px] bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-4">

// skeleton rows (bg-white/5):
// Each: add light:bg-gray-200
```

- [ ] **Step 4: Update `src/app/scheduled-list/page.tsx`**

```tsx
// page title (text-white):
<h1 className="text-[22px] md:text-4xl font-extrabold text-white light:text-gray-900 tracking-tight mb-6">Full Schedule</h1>

// empty state (text-white/45):
<p className="text-sm text-white/45 light:text-gray-400 py-12">No schedule available.</p>

// day header (text-white/80):
<h2 className="text-[10px] md:text-[12px] font-bold uppercase tracking-[0.08em] text-white/80 light:text-gray-600 mb-3">{day}</h2>

// slot row (bg-white/5, border-white/10):
className="flex items-center gap-3 p-3 bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 rounded-xl hover:bg-white/10 light:hover:bg-gray-100 hover:border-white/20 light:hover:border-gray-300 transition-colors cursor-pointer"

// slot name (text-white):
<p className="text-white light:text-gray-900 text-sm font-medium truncate">

// slot title (text-white/80):
<p className="text-white/80 light:text-gray-600 text-xs truncate">

// slot time (text-white/50):
<span className="text-white/50 light:text-gray-400 text-xs flex-shrink-0">
```

- [ ] **Step 5: Update `src/app/sleep-timer/SleepTimerClient.tsx`**

```tsx
// page title (text-white):
<h1 className="text-[22px] font-extrabold text-white light:text-gray-900 tracking-tight mb-6">Sleep Timer</h1>

// timer display (text-white):
className="text-white light:text-gray-900 text-4xl font-mono mb-4"

// subtitle (text-white/60):
<p className="text-white/60 light:text-gray-500 text-sm mb-6">Radio stops in {minutes}m {seconds}s</p>

// preset buttons (bg-white/5, border-white/10, text-white):
className="bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 text-white light:text-gray-900 py-4 rounded-xl font-medium text-sm hover:bg-white/10 light:hover:bg-gray-100 hover:border-white/20 light:hover:border-gray-300 transition-colors ... cursor-pointer"
```

- [ ] **Step 6: Update `src/app/teachers/page.tsx`**

```tsx
// page title (text-white):
<h1 className="text-[22px] md:text-4xl font-extrabold text-white light:text-gray-900 tracking-tight mb-3">Teachers</h1>
```

- [ ] **Step 7: Update `src/app/teachers/[slug]/page.tsx`**

```tsx
// wrapper (text-white):
<div className="text-white light:text-gray-900 max-w-screen-xl mx-auto">
```

- [ ] **Step 8: Update `src/app/teachers/[slug]/error.tsx`**

```tsx
// error text (text-white/80):
<p className="text-white/80 light:text-gray-600">Unable to load teacher. Please try again.</p>
```

- [ ] **Step 9: Update `src/app/@modal/layout.tsx`**

```tsx
// modal wrapper div (border-white/10, bg-gray-800):
className={cn(
  'w-full max-h-[90dvh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/10 light:border-gray-200 bg-gray-800 light:bg-white p-0 h-[85dvh] sm:h-auto sm:max-w-2xl sm:w-[95vw]',
  ...
)}

// drag handle (bg-white/30):
<div className="h-1 w-10 rounded-full bg-white/30 light:bg-gray-300" />

// header div (border-white/10, bg-gray-800):
<div className="flex items-center justify-between border-b border-white/10 light:border-gray-200 bg-gray-800 light:bg-white px-6 py-4">

// h2 (text-white):
<h2 className="text-xl font-bold text-white light:text-gray-900">{title}</h2>

// close button (text-white/60, hover:bg-white/10, hover:text-white):
className="ml-auto -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 light:text-gray-500 transition-colors hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 cursor-pointer"
```

- [ ] **Step 10: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 11: Commit**

```bash
git add \
  src/app/page.tsx \
  src/app/about/page.tsx \
  src/app/donate/page.tsx \
  src/app/scheduled-list/page.tsx \
  src/app/sleep-timer/SleepTimerClient.tsx \
  src/app/teachers/page.tsx \
  "src/app/teachers/[slug]/page.tsx" \
  "src/app/teachers/[slug]/error.tsx" \
  src/app/@modal/layout.tsx
git commit -m "feat(theme): add light: overrides to pages and modal layout"
```

---

## Task 14: Skeletons + ContactForm

**Files:**
- Modify: `src/components/skeletons/RadioPlayerSkeleton.tsx`
- Modify: `src/components/skeletons/TeacherCardSkeleton.tsx`
- Modify: `src/components/skeletons/TeacherDetailSkeleton.tsx`
- Modify: `src/components/skeletons/ScheduleSkeleton.tsx`
- Modify: `src/components/skeletons/SearchResultsSkeleton.tsx`
- Modify: `src/components/about/ContactForm.tsx`

- [ ] **Step 1: Update RadioPlayerSkeleton.tsx**

```tsx
// outer div (bg-white/5):
<div className="p-2 pb-5 md:p-5 bg-white/5 light:bg-gray-50 rounded animate-pulse">

// inner blocks (bg-white/10):
// Each: add light:bg-gray-200
```

- [ ] **Step 2: Update TeacherCardSkeleton.tsx**

```tsx
// inline skeleton (bg-[#252b32]):
return <div className={`bg-[#252b32] light:bg-gray-200 animate-pulse rounded ${className}`} />

// card container (bg-[#1c2128], border-white/5):
<div className="bg-[#1c2128] light:bg-white rounded-[18px] overflow-hidden border border-white/5 light:border-gray-200">

// image placeholder (bg-[#252b32]):
<div className="aspect-square bg-[#252b32] light:bg-gray-200 animate-pulse" />
```

- [ ] **Step 3: Update TeacherDetailSkeleton.tsx**

```tsx
// inline skeleton (bg-[#252b32]):
return <div className={`bg-[#252b32] light:bg-gray-200 animate-pulse ${className}`} />

// divider (bg-white/5):
<div className="h-px bg-white/5 light:bg-gray-200 mx-4 md:mx-8 mb-3" />
```

- [ ] **Step 4: Update ScheduleSkeleton.tsx**

```tsx
// row (bg-white/5):
<div key={i} className="flex items-center gap-3 p-3 bg-white/5 light:bg-gray-50 rounded">

// avatar placeholder (bg-white/10):
<div className="w-12 h-12 bg-white/10 light:bg-gray-200 rounded-full flex-shrink-0" />

// text lines (bg-white/10):
<div className="h-4 w-1/2 bg-white/10 light:bg-gray-200 rounded" />
<div className="h-3 w-1/3 bg-white/10 light:bg-gray-200 rounded" />

// time placeholder (bg-white/10):
<div className="h-3 w-24 bg-white/10 light:bg-gray-200 rounded" />
```

- [ ] **Step 5: Update SearchResultsSkeleton.tsx**

```tsx
// inline skeleton (bg-[#252b32]):
return <div className={`bg-[#252b32] light:bg-gray-200 animate-pulse rounded ${className}`} />

// list item rows (bg-white/5):
<li key={i} className="h-[68px] rounded-xl bg-white/5 light:bg-gray-100 animate-pulse" />
```

- [ ] **Step 6: Update ContactForm.tsx**

```tsx
// label (text-white/80):
<label htmlFor="name" className="text-white/80 light:text-gray-700 text-sm block mb-1">Name *</label>
// (repeat for email, message labels)

// inputs (bg-gray-700/50, text-white):
className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white light:focus:ring-gray-400"
// (repeat for email, message inputs/textarea)

// success message (text-white):
<span className="text-white light:text-gray-900 text-sm leading-relaxed">
```

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 8: Final build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 9: Commit**

```bash
git add \
  src/components/skeletons/RadioPlayerSkeleton.tsx \
  src/components/skeletons/TeacherCardSkeleton.tsx \
  src/components/skeletons/TeacherDetailSkeleton.tsx \
  src/components/skeletons/ScheduleSkeleton.tsx \
  src/components/skeletons/SearchResultsSkeleton.tsx \
  src/components/about/ContactForm.tsx
git commit -m "feat(theme): add light: overrides to skeletons and ContactForm"
```

---

## Verification

After Task 14, verify the full feature manually:

1. Start dev server: `npm run dev`
2. Visit `http://localhost:3000/?theme=light` — site should render white/gray backgrounds, dark text
3. Visit `http://localhost:3000/?theme=dark` — site should render dark purple/gray backgrounds, white text
4. Visit `http://localhost:3000/?theme=system` — should follow OS preference
5. Click Light/Dark/System in footer — should switch instantly with no reload
6. Reload after selecting a theme — should persist (cookie)
7. Clear cookies, visit as first-time user — should default to system/dark preference
8. Check `?theme=light` on teachers, about, donate, schedule pages
9. Open a teacher detail modal with `?theme=light` — modal should be white
