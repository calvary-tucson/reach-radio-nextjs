# Teacher Photo Crop + Teacher Modal Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Stop teacher photos losing the top of the head. (2) When a teacher is picked from "Also on Reach Radio" inside the teacher side panel, keep the panel open and swap content instead of replaying the close/open animation.

**Architecture:** (1) Bias `TeacherAvatar`'s `object-cover` crop to the top. (2) The `@modal` layout (`ModalLayout`) already persists across swaps, but `TeacherPanelChrome` lives inside the per-slug intercepted page, so it remounts on each swap and replays its slide-in animation and focus reset. Add a `panelEntered` flag to the modal store; the chrome plays its slide-in only when the flag is unset, then sets it. The flag resets on `openModal`/`openSearchSheet`/`close`.

**Tech Stack:** Next.js 16 App Router (intercepting route `src/app/@modal/(...)teachers/[slug]`), React 19, Zustand, Tailwind, Vitest + Testing Library, Playwright.

**Linear:** CAL-181 (photo crop), CAL-182 (modal reuse).

## Global Constraints

- TypeScript strict; no `any` in public APIs. Use `@/` imports.
- AGENTS.md UI rules: `cursor-pointer` on clickables, `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`, animations wrapped in `motion-safe:`. Do not regress any of these in `TeacherPanelChrome`.
- Commit scopes: `teachers` (Task 1), `modal` (Task 2). Conventional commits, small and atomic.
- Per AGENTS.md: this Next.js has breaking changes; before touching routing/modal code, skim the relevant guide in `node_modules/next/dist/docs/` (intercepting routes / parallel routes).
- Before claiming done: `npm run lint`, `npx tsc --noEmit`, `npm test`, and the new e2e test pass; golden path checked in the browser (dev server: `npm run dev -- -p 3100`, needs Doppler, already set up in this worktree).
- Do not push without explicit owner permission.

---

### Task 1: Top-biased teacher photo crop (CAL-181)

**Files:**
- Modify: `src/components/teachers/primitives/TeacherAvatar.tsx:48`
- Test: `tests/unit/teacher-avatar.test.tsx` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `TeacherAvatar` photo `<img>` carries `object-cover object-top`. No prop changes.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/teacher-avatar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeacherAvatar } from '@/components/teachers/primitives/TeacherAvatar'

vi.mock('next/image', () => ({
  default: ({ alt, fill: _fill, ...props }: { alt: string; fill?: boolean; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

describe('TeacherAvatar', () => {
  it('anchors the photo crop to the top so heads are not cut off', () => {
    render(<TeacherAvatar name="Jane Doe" photo="/jane.jpg" size="md" shape="circle" />)
    const img = screen.getByRole('img', { name: 'Jane Doe' })
    expect(img.className).toContain('object-cover')
    expect(img.className).toContain('object-top')
  })

  it('renders initials when there is no photo', () => {
    render(<TeacherAvatar name="Jane Doe" size="md" shape="circle" />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/teacher-avatar.test.tsx`
Expected: first test FAILS (`object-top` missing); second passes.

- [ ] **Step 3: Implement**

In `TeacherAvatar.tsx`, change `className="object-cover"` to `className="object-cover object-top"`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/teacher-avatar.test.tsx tests/unit/teacher-card.test.tsx tests/unit/recommended-teachers.test.tsx`
Expected: PASS.

- [ ] **Step 5: Visual check (all sizes and shapes)**

Start dev server, open `/teachers` (cards), a teacher detail page (banner `3xl`/ring avatar), the teacher modal ("Also on Reach Radio" `md` circles), and `/teachers/search`. Compare against the teachers whose heads were cut off; also confirm photos that were already fine do not now cut chins. If a specific photo looks worse, stop and report which one; do not add per-photo overrides in this task.

- [ ] **Step 6: Commit**

```bash
git add src/components/teachers/primitives/TeacherAvatar.tsx tests/unit/teacher-avatar.test.tsx
git commit -m "fix(teachers): anchor avatar photo crop to top"
```

---

### Task 2: Reuse the teacher panel when switching teachers (CAL-182)

**Files:**
- Modify: `src/lib/stores/modal.ts`
- Modify: `src/components/modals/chrome/TeacherPanelChrome.tsx`
- Test: `tests/unit/modal-store.test.ts` (add cases), `tests/unit/teacher-panel-chrome.test.tsx` (add cases), `tests/e2e/teachers.spec.ts` (add case)

**Interfaces:**
- Consumes: existing `useModalStore` (`openModal`, `openSearchSheet`, `pushModal`, `close`, `prepareBack`).
- Produces: `useModalStore` gains `panelEntered: boolean` and `markPanelEntered: () => void`. `openModal`, `openSearchSheet` and `close` set `panelEntered: false`. `pushModal` and `prepareBack` leave it untouched. `TeacherPanelChrome` skips the enter animation when `panelEntered` was already true at mount.

- [ ] **Step 1: Write the failing e2e test (this also reproduces the bug and confirms the root-cause hypothesis)**

Add to `tests/e2e/teachers.spec.ts`:

```ts
test('switching teacher from the panel reuses the open panel', async ({ page }) => {
  await page.goto('/teachers')
  // The grid cards are plain links (full-page nav); the "Recommended" row uses
  // TeacherModalLink, which opens the side panel.
  const recommended = page.getByRole('region', { name: 'Recommended teachers' })
  await recommended.getByRole('button').first().click()
  const panel = page.getByRole('dialog', { name: 'Teacher profile' })
  await expect(panel).toBeVisible()

  // Mark the live DOM node; a remount would drop this attribute.
  await panel.evaluate((el) => el.setAttribute('data-probe', 'same-panel'))

  const related = panel.getByText('Also on Reach Radio').locator('xpath=following-sibling::div//button').first()
  await related.click()
  await expect(panel.getByRole('heading', { level: 2 }).first()).toBeVisible()

  await expect(page.getByRole('dialog', { name: 'Teacher profile' })).toHaveAttribute('data-probe', 'same-panel')
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx playwright test tests/e2e/teachers.spec.ts -g "reuses the open panel"` (start the app per `playwright.config.ts`).
Expected: FAIL on the `data-probe` assertion (attribute lost because the chrome remounted). If it PASSES, the hypothesis is wrong: stop and report; do not implement Steps 3-6 blindly. Look at what actually replays (record console and DOM mutations on swap) and revise this plan.

- [ ] **Step 3: Write the failing store tests**

Add to `tests/unit/modal-store.test.ts` (add `panelEntered: false` to its `beforeEach` setState):

```ts
it('markPanelEntered sets panelEntered; close and openModal reset it', () => {
  useModalStore.getState().openModal('A')
  expect(useModalStore.getState().panelEntered).toBe(false)
  useModalStore.getState().markPanelEntered()
  expect(useModalStore.getState().panelEntered).toBe(true)
  useModalStore.getState().pushModal('B')
  expect(useModalStore.getState().panelEntered).toBe(true)
  useModalStore.getState().prepareBack()
  expect(useModalStore.getState().panelEntered).toBe(true)
  useModalStore.getState().close()
  expect(useModalStore.getState().panelEntered).toBe(false)
  useModalStore.getState().markPanelEntered()
  useModalStore.getState().openModal('C')
  expect(useModalStore.getState().panelEntered).toBe(false)
  useModalStore.getState().markPanelEntered()
  useModalStore.getState().openSearchSheet('S')
  expect(useModalStore.getState().panelEntered).toBe(false)
})
```

Run: `npx vitest run tests/unit/modal-store.test.ts` — Expected: FAIL (`markPanelEntered` is not a function).

- [ ] **Step 4: Implement the store change**

In `src/lib/stores/modal.ts`: add `panelEntered: boolean` and `markPanelEntered: () => void` to `ModalStore`; initial `panelEntered: false`; add `panelEntered: false` to the objects set by `openModal`, `openSearchSheet` and `close`; add `markPanelEntered: () => set({ panelEntered: true }),`. Leave `pushModal` and `prepareBack` unchanged.

Run: `npx vitest run tests/unit/modal-store.test.ts` — Expected: PASS.

- [ ] **Step 5: Write failing chrome tests, then implement the chrome change**

Add to `tests/unit/teacher-panel-chrome.test.tsx` (import `useModalStore` from `@/lib/stores/modal`):

```tsx
describe('TeacherPanelChrome enter animation', () => {
  it('plays the slide-in on first open and marks the panel entered', () => {
    useModalStore.setState({ panelEntered: false })
    render(<Wrapper />)
    expect(screen.getByRole('dialog').className).toContain('panel-slide-in')
    expect(useModalStore.getState().panelEntered).toBe(true)
  })

  it('skips the slide-in when the panel was already entered (teacher swap)', () => {
    useModalStore.setState({ panelEntered: true })
    render(<Wrapper />)
    const cls = screen.getByRole('dialog').className
    expect(cls).not.toContain('slide-in')
    expect(cls).not.toContain('slide-up')
  })

  it('still plays the exit animation while closing', () => {
    useModalStore.setState({ panelEntered: true })
    render(<Wrapper isClosing />)
    expect(screen.getByRole('dialog').className).toContain('slide-out')
  })
})
```

Run: `npx vitest run tests/unit/teacher-panel-chrome.test.tsx` — Expected: new tests FAIL.

Implement in `TeacherPanelChrome.tsx`:

```tsx
import { useModalStore } from '@/lib/stores/modal'
// inside the component, before the existing focus effect:
const [skipEnter] = useState(() => useModalStore.getState().panelEntered)
useEffect(() => { useModalStore.getState().markPanelEntered() }, [])
```

(add `useState` to the react import). In the `cn(...)` call, wrap the two non-closing enter-animation strings so they apply only when `!skipEnter`:

```tsx
isClosing
  ? 'motion-safe:animate-[modal-slide-down_0.15s_ease-in_forwards]'
  : !skipEnter && 'motion-safe:animate-[modal-slide-up_0.2s_cubic-bezier(0.32,0.72,0,1)_both]',
```
and the same `: !skipEnter && '...panel-slide-in...'` pattern for the `md:` line. Keep the focus-on-mount effect as is, so focus returns to the panel on swap. The content scroller remounts with the page, so scroll resets to the top.

Run: `npx vitest run tests/unit/teacher-panel-chrome.test.tsx tests/unit/modal-store.test.ts tests/unit/modal-layout.test.tsx tests/unit/modal-link.test.tsx` — Expected: PASS.

- [ ] **Step 6: Verify e2e and golden path in the browser**

Run: `npx playwright test tests/e2e/teachers.spec.ts` — Expected: PASS, including the new test. Then in the browser (dev server on port 3100): open a teacher panel from `/teachers`, click a teacher under "Also on Reach Radio": panel stays put (no slide-out/in), content swaps via skeleton, scroll is at top, Back arrow returns to the previous teacher without animation, Close (X, Escape, backdrop) still slides out and returns focus to the trigger, reopening a panel after close still slides in. Check mobile width (bottom sheet) and desktop (right panel), plus the search-sheet-to-teacher path: pushing a teacher from the search sheet still animates the first time.

- [ ] **Step 7: Full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test` — Expected: all green.

```bash
git add src/lib/stores/modal.ts src/components/modals/chrome/TeacherPanelChrome.tsx tests/unit/modal-store.test.ts tests/unit/teacher-panel-chrome.test.tsx tests/e2e/teachers.spec.ts
git commit -m "fix(modal): reuse teacher panel when switching teachers"
```

---

## Self-review notes

- Spec coverage: CAL-181 -> Task 1; CAL-182 -> Task 2 (reproduce-first, store flag, chrome change, e2e, edge paths: back, close, reopen, search-sheet push).
- Known risk: Task 2 rests on the remount hypothesis; Step 2 is the explicit gate. Another risk is that dev-mode React StrictMode double-invokes effects; the flag is read via a state initializer, so it is not affected.
- Out of scope: per-teacher Sanity hotspot crop (owner chose top-biased default only); moving chrome into the layout.
