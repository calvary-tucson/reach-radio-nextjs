# Theme Toggle Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user clicks Light/Dark in the theme toggle, the whole page zooms in slightly while blurring, swaps theme at peak blur, then eases back to 100% sharp. Reduced-motion users get an instant switch.

**Architecture:** Wrap only the toggle's `setTheme` DOM update in `document.startViewTransition`. First load, `?theme=` param and OS `prefers-color-scheme` changes stay instant (they call `applyTheme` directly). CSS keyframes target the `root` view-transition pseudo-elements, scoped by a transient `theme-transition` class on `<html>` so the existing page-navigation transitions are untouched.

**Tech Stack:** View Transitions API, CSS keyframes, React 19 (`flushSync`), Vitest.

## Global Constraints

- Approved values (from the mock, `.superpowers/sdd/theme-transition-mock.html`): duration 500ms, peak scale 1.05, peak blur 6px, timing `ease-in-out`, `mix-blend-mode: normal`. Old theme zooms/blurs 0%→45% then holds. New theme is opacity 0 and held at peak until 45%, opaque by 60%, then eases to scale 1 / blur 0 at 100%.
- Motion only under `prefers-reduced-motion: no-preference` (AGENTS.md "Motion" rule). Reduced motion or no `startViewTransition` support: instant switch, as today.
- Do not change `applyTheme` callers other than the toggle path (`setTheme`).
- Existing nav transitions (`.nav-forward`, `.nav-back`, `site-header` group, React `<ViewTransition name="teacher-…">`) must be unaffected outside a theme switch.
- Commit scope is `theme`. Do not push.

## UI mocks (approved)

Owner approved 2026-11-01 ("yeah the 3 tweaks are better": faster 500ms, subtler 105%, less blur 6px). Mock file: `.superpowers/sdd/theme-transition-mock.html` (tweaks pre-ticked). Final CSS from the mock, with the approved values:

```css
::view-transition-old(root), ::view-transition-new(root) {
  animation-duration: 500ms; animation-fill-mode: both;
  animation-timing-function: ease-in-out; mix-blend-mode: normal;
}
::view-transition-old(root) { animation-name: theme-out; }
::view-transition-new(root) { animation-name: theme-in; }
@keyframes theme-out { 0% { transform: scale(1); filter: blur(0); } 45%,100% { transform: scale(1.05); filter: blur(6px); } }
@keyframes theme-in  { 0%,45% { transform: scale(1.05); filter: blur(6px); opacity: 0; }
  60% { opacity: 1; } 100% { transform: scale(1); filter: blur(0); opacity: 1; } }
```

---

### Task 1: Animated `setTheme` in ThemeProvider (with tests)

**Files:**
- Modify: `src/components/theme/ThemeProvider.tsx` (the `setTheme` callback, `applyTheme` unchanged)
- Test: `tests/unit/theme-provider.test.tsx`

**Interfaces:**
- Consumes: existing `applyTheme(theme)`, `setThemeCookie(theme)`.
- Produces: `setTheme(t)` keeps its signature; behavior now animated when supported.

- [ ] **Step 1: Make the test `matchMedia` stub answer per query.** In `stubScheme`, give the reduced-motion query its own flag so simulating a color scheme never reads as reduced motion:

```ts
let reducedMotion = false

function stubScheme(scheme: Scheme) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches:
      q === '(prefers-reduced-motion: reduce)'
        ? reducedMotion
        : q === '(prefers-color-scheme: light)'
          ? scheme === 'light'
          : scheme === 'dark',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}
```

Reset `reducedMotion = false` in `beforeEach`. Existing tests must stay green.

- [ ] **Step 2: Write failing tests** (append inside the `describe`):

```ts
  it('setTheme runs the class swap inside startViewTransition when supported', async () => {
    const start = vi.fn((cb: () => void) => { cb(); return { finished: Promise.resolve() } })
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
    let ctx: ReturnType<typeof useTheme>
    await act(async () => { render(wrap(<ThemeReader onRender={(v) => { ctx = v }} />)) })
    await act(async () => { ctx!.setTheme('light') })
    expect(start).toHaveBeenCalledTimes(1)
    expect(cls().contains('light')).toBe(true)
    Reflect.deleteProperty(document, 'startViewTransition')
  })

  it('setTheme skips the transition under reduced motion', async () => {
    reducedMotion = true
    stubScheme('none')
    const start = vi.fn()
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
    let ctx: ReturnType<typeof useTheme>
    await act(async () => { render(wrap(<ThemeReader onRender={(v) => { ctx = v }} />)) })
    await act(async () => { ctx!.setTheme('light') })
    expect(start).not.toHaveBeenCalled()
    expect(cls().contains('light')).toBe(true)
    Reflect.deleteProperty(document, 'startViewTransition')
  })

  it('removes the theme-transition class when the transition finishes', async () => {
    const start = vi.fn((cb: () => void) => { cb(); return { finished: Promise.resolve() } })
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
    let ctx: ReturnType<typeof useTheme>
    await act(async () => { render(wrap(<ThemeReader onRender={(v) => { ctx = v }} />)) })
    await act(async () => { ctx!.setTheme('light') })
    await act(async () => { await Promise.resolve() })
    expect(cls().contains('theme-transition')).toBe(false)
    Reflect.deleteProperty(document, 'startViewTransition')
  })
```

Run: `npx vitest run tests/unit/theme-provider.test.tsx`. Expected: the 3 new tests FAIL (start never called), old tests pass.

- [ ] **Step 3: Implement.** In `ThemeProvider.tsx` add `import { flushSync } from 'react-dom'` and replace `setTheme`:

```ts
  const setTheme = useCallback((t: Theme) => {
    setThemeCookie(t)
    const swap = () => {
      // flushSync so the new snapshot shows the new toggle state, not the old one
      flushSync(() => setThemeState(t))
      applyTheme(t)
    }
    const html = document.documentElement
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof document.startViewTransition !== 'function') {
      swap()
      return
    }
    html.classList.add('theme-transition')
    const vt = document.startViewTransition(swap)
    // finished settles on skip/abort too, so the class cannot stick
    void vt.finished.finally(() => html.classList.remove('theme-transition'))
  }, [])
```

- [ ] **Step 4: Run** `npx vitest run tests/unit/theme-provider.test.tsx tests/unit/theme-toggle.test.tsx`. Expected: all pass. Then `npx tsc --noEmit` and `npm run lint`: clean.

- [ ] **Step 5: Commit** `git add src/components/theme/ThemeProvider.tsx tests/unit/theme-provider.test.tsx` then `git commit -m "feat(theme): animate theme toggle with view transition" -- src/components/theme/ThemeProvider.tsx tests/unit/theme-provider.test.tsx`

### Task 2: CSS keyframes scoped to `theme-transition`

**Files:**
- Modify: `src/app/globals.css` (inside the existing `@supports (view-transition-name: none)` block, after the `prefers-reduced-motion: no-preference` block at ~line 257)

- [ ] **Step 1: Add** inside `@supports (view-transition-name: none) { @media (prefers-reduced-motion: no-preference) { … } }`:

```css
    /* Theme toggle: zoom in + blur, swap at peak, settle back (approved mock 2026-11-01).
       Named groups (site-header, teacher-*) are dropped so the whole page moves as one. */
    html.theme-transition * { view-transition-name: none !important; }
    html.theme-transition::view-transition-old(root),
    html.theme-transition::view-transition-new(root) {
      animation-duration: 500ms;
      animation-fill-mode: both;
      animation-timing-function: ease-in-out;
      mix-blend-mode: normal;
    }
    html.theme-transition::view-transition-old(root) { animation-name: theme-out; }
    html.theme-transition::view-transition-new(root) { animation-name: theme-in; }
```

and the two `@keyframes theme-out` / `theme-in` from "UI mocks (approved)" above, at top level of `globals.css` next to `vt-slide`.

- [ ] **Step 2: Run** `npm run lint` and `npx tsc --noEmit`. Expected: clean.
- [ ] **Step 3: Commit** `git add src/app/globals.css` then `git commit -m "feat(theme): add zoom and blur theme transition keyframes" -- src/app/globals.css`

### Task 3: Verify in the real app

Dev server is on `http://localhost:3000`. Use a throwaway node-playwright script (the Playwright MCP browser is not installed; import `playwright` from the worktree `node_modules`, run with the sandbox disabled).

- [ ] Light to dark and dark to light, at 390px and 1280px: `document.getAnimations()` includes `::view-transition-old(root)` and `::view-transition-new(root)` with duration 500; the html class ends on the target theme; `theme-transition` class is gone afterwards.
- [ ] `/teachers` (avatars + header visible): a mid-transition screenshot (about 200ms) shows the header and avatars zoomed and blurred together with the page, not crisp above it.
- [ ] Reduced motion (`reducedMotion: 'reduce'` context): no root pseudo animations, theme still switches.
- [ ] Reload and OS-scheme change stay instant (no root pseudo animations).
- [ ] Page navigation transition (click a teacher card) still runs `.nav-forward`; no console errors anywhere.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `doppler run -- npm run build`, and `doppler run -- npx playwright test tests/e2e/contrast.spec.ts` all pass.
