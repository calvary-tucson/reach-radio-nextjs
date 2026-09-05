# Fix Pre-Existing Test Failures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 5 known pre-existing test failures in reach-radio-nextjs (2 unit, 3 e2e) so the full test suite is fully green, with no "known failures" caveat left in project docs.

**Architecture:** No architectural change. Five independent, single-concern fixes: two are test-only bugs (wrong mock lifecycle, stale assertions), one is a real accessibility gap in `ContactForm` (missing live-region announcement for async pending state), and two are e2e tests asserting against intentionally-changed UI/schema output or missing a required test-environment mock. Each task stands alone — no task depends on another.

**Tech Stack:** Next.js 16 / React 19, TypeScript strict, Vitest + `@testing-library/react` for unit tests (`npx vitest run <path>`), Playwright for e2e (`npx playwright test <path> --reporter=list` — auto-starts its own dev server per `playwright.config.ts`).

## Global Constraints

- TypeScript strict mode, no `any`.
- Use `@/` path alias for all imports.
- Conventional commits using the scopes from `AGENTS.md`: `about` (ContactForm.tsx), `test` (test-file-only changes, no source file touched).
- Every task's fix must be verified by running the specific test file before moving on, then a final full-suite run after all 5 tasks confirms no new failures were introduced.
- Root causes were investigated and confirmed against the actual current source (not assumed from a stale project doc) before this plan was written — see each task's "Root cause" note. Task 2's fix was additionally verified empirically (applied, tested, reverted) before this plan was saved — see Task 2's note.
- **Sandbox note for Tasks 3-5 (Playwright):** `playwright.config.ts`'s `webServer` tries to bind `0.0.0.0:3000` itself. In a sandboxed shell this fails with `EPERM`. Run `npx playwright test ...` with the sandbox disabled for that command (or pre-start `npm run dev` outside the sandbox first — `reuseExistingServer` will then attach to it instead of trying to bind its own).
- **Task independence:** Tasks 1-5 touch disjoint files and can be executed in any order or in parallel. The one exception is verification scope, not implementation: Task 2's Step 4 only re-runs files this task itself touches — it does not assume Task 1 has already landed.

---

### Task 1: Fix `contact-form-on-success.test.tsx`'s broken state-transition mock

**Files:**
- Modify: `tests/unit/contact-form-on-success.test.tsx:30-35`

**Root cause:** The failing test calls `mockState({ success: true })` and then a single `render(...)` — so the mocked `useActionState` returns the "success" object on the very first (mount) render. `ContactForm`'s `prevStateRef = useRef(state)` (`src/components/about/ContactForm.tsx:20`) captures that *same* object reference at mount, so the effect's change-check `state !== prevStateRef.current` (`ContactForm.tsx:33`) is comparing the state object to itself and is always `false` — `onSuccess` never fires. In real usage, `useActionState` starts at the `initial` state and only transitions to a *new* success object after a real submission causes a re-render. The test must simulate that same mount-then-transition lifecycle using `rerender`, not mount directly into the already-succeeded state.

**Interfaces:**
- Consumes: existing `mockState(state: ContactState)` helper (`tests/unit/contact-form-on-success.test.tsx:21-23`) — unchanged, no signature change needed.
- Produces: nothing new — same test file, same `describe` block, only this one `it` body changes.

- [ ] **Step 1: Run the test to confirm the current failure**

Run: `npx vitest run tests/unit/contact-form-on-success.test.tsx`
Expected: FAIL — `calls onSuccess when submission succeeds` fails with `AssertionError: expected "vi.fn()" to be called once, but got 0 times`.

- [ ] **Step 2: Fix the test to simulate a real mount-then-transition**

In `tests/unit/contact-form-on-success.test.tsx`, replace lines 30-35:

```tsx
  it('calls onSuccess when submission succeeds', async () => {
    mockState({ success: true })
    const onSuccess = vi.fn()
    render(<ContactForm onSuccess={onSuccess} />)
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })
```

with:

```tsx
  it('calls onSuccess when submission succeeds', async () => {
    const onSuccess = vi.fn()
    mockState({ success: false })
    const { rerender } = render(<ContactForm onSuccess={onSuccess} />)
    mockState({ success: true })
    rerender(<ContactForm onSuccess={onSuccess} />)
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx vitest run tests/unit/contact-form-on-success.test.tsx`
Expected: all 3 tests in the file PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/contact-form-on-success.test.tsx
git commit -m "$(cat <<'EOF'
test: fix ContactForm onSuccess test's broken mount-state mock

The test mounted useActionState directly into the "success" state, so
ContactForm's prevStateRef (initialized from that same render) was
always equal to state — the change-detection effect never saw a
transition and onSuccess never fired. Real usage always starts at the
initial state and transitions to a new object on a later render; the
test now reproduces that with mount + rerender instead of a single
already-succeeded mount.
EOF
)"
```

---

### Task 2: Add an accessible live-region announcement for ContactForm's pending state

**Files:**
- Modify: `src/components/about/ContactForm.tsx:115-121`

**Root cause:** `tests/unit/contact-form-pending-spinner.test.tsx` queries `getByRole('status', { name: /sending/i })` — an ARIA live region announcing the async submit state to screen reader users who aren't focused on the button. `ContactForm` renders the spinner as `aria-hidden="true"` and the "Sending..." text as plain button content (`ContactForm.tsx:115-121`) — neither has `role="status"`, so there's no live-region announcement at all. This is a real accessibility gap, not a test bug: a screen reader user who submits the form and looks away won't be told the submission is in progress until the button's own label happens to be re-read.

**Verified empirically before saving this plan:** `role="status"` is `nameFrom:author` in ARIA — unlike `button`/`heading`/`link`, it does **not** compute its accessible name from text content. A first attempt at this fix (`<span role="status" className="sr-only">Sending...</span>`) was applied and tested directly — it still failed `getByRole('status', { name: /sending/i })` because the computed name was empty. The span needs an explicit `aria-label`; the code below reflects the version that was actually run and passed.

**Interfaces:**
- Consumes: existing `isPending` (from `useActionState`, `ContactForm.tsx:17`) — unchanged.
- Produces: nothing new — purely additive JSX inside the existing button.

- [ ] **Step 1: Run the test to confirm the current failure**

Run: `npx vitest run tests/unit/contact-form-pending-spinner.test.tsx`
Expected: FAIL — `shows a spinner alongside the submit button while pending` fails with `Unable to find an accessible element with the role "status" and name /sending/i`.

- [ ] **Step 2: Add the live-region span**

In `src/components/about/ContactForm.tsx`, replace lines 115-121:

```tsx
        {isPending && (
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 border-2 border-[#0a1305] border-t-transparent rounded-full motion-safe:animate-spin"
          />
        )}
        {isPending ? 'Sending...' : 'Send Message'}
```

with:

```tsx
        {isPending && (
          <>
            <span
              aria-hidden="true"
              className="h-4 w-4 shrink-0 border-2 border-[#0a1305] border-t-transparent rounded-full motion-safe:animate-spin"
            />
            <span role="status" aria-label="Sending..." className="sr-only" />
          </>
        )}
        {isPending ? 'Sending...' : 'Send Message'}
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx vitest run tests/unit/contact-form-pending-spinner.test.tsx`
Expected: both tests in the file PASS.

- [ ] **Step 4: Run the other existing ContactForm-related unit test files to confirm no regression**

This task doesn't depend on Task 1 — run only files unaffected by Task 1's change (do not include `contact-form-on-success.test.tsx` here; if Task 1 hasn't landed yet in whatever order these are executed, that file is still expected to fail for the reason described in Task 1, unrelated to this task's change).

Run: `npx vitest run tests/unit/contact-form-pending-spinner.test.tsx tests/unit/contact-sheet.test.tsx tests/unit/contact-sheet-focus-trap.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/about/ContactForm.tsx
git commit -m "$(cat <<'EOF'
fix(about): announce ContactForm's pending submit state to screen readers

The spinner was aria-hidden and the "Sending..." text was plain button
content with no live region, so screen reader users who aren't
focused on the submit button during an async submission got no
announcement that it was in progress. Add a role="status" sr-only
span alongside the existing visual spinner. role="status" doesn't
compute its accessible name from content, so it needs an explicit
aria-label rather than relying on inner text.
EOF
)"
```

---

### Task 3: Fix `home.spec.ts`'s two stale assertions

**Files:**
- Modify: `tests/e2e/home.spec.ts:6`, `tests/e2e/home.spec.ts:14-18`

**Root cause (heading):** The test expects an `h2` reading "Today's Schedule" (`tests/e2e/home.spec.ts:6`). The home page's actual heading (`src/app/page.tsx:24`) was intentionally changed to "Playing Next" — the test is simply stale.

**Root cause (JSON-LD order):** The test grabs `.first()` JSON-LD script and expects it to contain `"RadioStation"` (`tests/e2e/home.spec.ts:16-17`). `src/app/layout.tsx:159-160` intentionally renders `<WebSiteSchema />` before `<RadioStationSchema />`, so `.first()` is the `WebSite` schema, not `RadioStation`. The test should check across all JSON-LD scripts for the one containing `RadioStation`, not assume script order.

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — test-file-only change.

- [ ] **Step 1: Run the test file to confirm both current failures**

Run: `npx playwright test tests/e2e/home.spec.ts --reporter=list`
Expected: `loads and shows radio player` and `RadioStation JSON-LD present` both FAIL; `has correct page title` PASSES.

- [ ] **Step 2: Fix the heading assertion**

In `tests/e2e/home.spec.ts`, replace line 6:

```ts
    await expect(page.locator('h2', { hasText: "Today's Schedule" })).toBeVisible()
```

with:

```ts
    await expect(page.locator('h2', { hasText: 'Playing Next' })).toBeVisible()
```

- [ ] **Step 3: Fix the JSON-LD assertion to not assume script order**

In `tests/e2e/home.spec.ts`, replace lines 14-18:

```ts
  test('RadioStation JSON-LD present', async ({ page }) => {
    await page.goto('/')
    const ldJson = await page.locator('script[type="application/ld+json"]').first().textContent()
    expect(ldJson).toContain('"RadioStation"')
  })
```

with:

```ts
  test('RadioStation JSON-LD present', async ({ page }) => {
    await page.goto('/')
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents()
    const radioStationJson = scripts.find((s) => s.includes('"RadioStation"'))
    expect(radioStationJson).toBeTruthy()
  })
```

- [ ] **Step 4: Run the test file to verify all 3 tests pass**

Run: `npx playwright test tests/e2e/home.spec.ts --reporter=list`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/home.spec.ts
git commit -m "$(cat <<'EOF'
test: fix home.spec.ts's stale heading and JSON-LD order assumptions

"Today's Schedule" was intentionally renamed to "Playing Next"; the
JSON-LD test assumed RadioStationSchema renders first, but
WebSiteSchema intentionally renders before it in layout.tsx. Search
all ld+json scripts for the RadioStation one instead of assuming
position.
EOF
)"
```

---

### Task 4: Fix `teachers.spec.ts`'s singular/plural aria-live assertion

**Files:**
- Modify: `tests/e2e/teachers.spec.ts:28`

**Root cause:** The test searches for "Jack" and asserts the aria-live count region contains the literal substring `'teachers found'` (plural). `src/components/teachers/TeacherSearchClient.tsx:101` correctly renders `${results.length} ${results.length === 1 ? 'teacher' : 'teachers'} found` — when "Jack" matches exactly one teacher, the region reads "1 teacher found" (singular), which doesn't contain the plural substring the test checks for. The component's grammar is correct; the test is overly specific to one count.

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — test-file-only change.

- [ ] **Step 1: Run the test file to confirm the current failure**

Run: `npx playwright test tests/e2e/teachers.spec.ts --reporter=list`
Expected: `search page filters teachers and syncs URL` FAILS at the `toContainText('teachers found')` assertion; the other two tests PASS.

- [ ] **Step 2: Fix the assertion to accept either singular or plural**

In `tests/e2e/teachers.spec.ts`, replace line 28:

```ts
    await expect(countLabel).toContainText('teachers found')
```

with:

```ts
    await expect(countLabel).toContainText(/\d+ teachers? found/)
```

- [ ] **Step 3: Run the test file to verify it passes**

Run: `npx playwright test tests/e2e/teachers.spec.ts --reporter=list`
Expected: all 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/teachers.spec.ts
git commit -m "$(cat <<'EOF'
test: accept singular or plural in teachers.spec.ts's result-count assertion

TeacherSearchClient correctly renders "1 teacher found" (singular) vs
"N teachers found" (plural) — the test hardcoded the plural substring,
which fails whenever a search (e.g. "Jack") matches exactly one
teacher. The component's grammar was correct; the test was overly
specific to one result count.
EOF
)"
```

---

### Task 5: Fix `bridge.spec.ts` by mocking the native bridge presence check

**Files:**
- Modify: `tests/e2e/bridge.spec.ts`

**Root cause:** `BridgeInit`'s `nativeCommand` listener (`src/components/bridge/BridgeInit.tsx:64-65`) is gated behind `isNativeBridgePresent()` (`BridgeInit.tsx:37-43`), which checks for `window.Android`, `window.webkit?.messageHandlers?.messageHandler`, or `window.inNativeApp` — none of which exist in a plain Chromium Playwright run. So the listener never attaches, and dispatching a `nativeCommand` CustomEvent (`tests/e2e/bridge.spec.ts:3-7`) reaches nothing. This is not flakiness or an inherent environment limitation — `page.addInitScript` can inject a stub `window.webkit.messageHandlers.messageHandler.postMessage` before `page.goto`, which is exactly what `isNativeBridgePresent()` checks for and exactly what `postMessageToNative` (`src/lib/bridge/post-message.ts:31-37`) calls, so a no-op stub is sufficient — no need to actually capture or assert on native-bound messages for this fix.

**Verified empirically before saving this plan:** `src/lib/bridge/post-message.ts` already globally augments `Window.webkit` as an optional property whose shape (`{ messageHandlers: { messageHandler: { postMessage: (msg: string) => void } } }`) the stub below satisfies exactly — the assignment type-checks with no cast needed. An earlier draft of this fix added a `// @ts-expect-error` above the assignment defensively; applying it and running `npx tsc --noEmit` produced `error TS2578: Unused '@ts-expect-error' directive` — the directive was removed and the code below is the version that actually passes typecheck.

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — test-file-only change, adds one local helper function.

- [ ] **Step 1: Run the test file to confirm the current failure**

Run: `npx playwright test tests/e2e/bridge.spec.ts --reporter=list`
Expected: `nativeCommand navigate dispatches router.push` FAILS (URL never changes to `/teachers` because the listener was never attached); the other 3 tests PASS trivially (they only assert `expect(true).toBe(true)`, unrelated to whether the listener fired).

- [ ] **Step 2: Add a native-bridge mock helper and use it in every test**

Replace the full contents of `tests/e2e/bridge.spec.ts` with:

```ts
import { test, expect } from '@playwright/test'

function dispatchNativeCommand(page: import('@playwright/test').Page, detail: Record<string, unknown>) {
  return page.evaluate((d) => {
    window.dispatchEvent(new CustomEvent('nativeCommand', { detail: d }))
  }, detail)
}

function mockNativeBridge(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    window.webkit = { messageHandlers: { messageHandler: { postMessage: () => {} } } }
  })
}

test.describe('Native bridge', () => {
  test('nativeCommand navigate dispatches router.push', async ({ page }) => {
    await mockNativeBridge(page)
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'navigate', path: '/teachers' })
    await expect(page).toHaveURL('/teachers')
  })

  test('nativeCommand setPlayState updates media store', async ({ page }) => {
    await mockNativeBridge(page)
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'setPlayState', playing: true })
    expect(true).toBe(true)
  })

  test('nativeCommand setBuffering updates media store', async ({ page }) => {
    await mockNativeBridge(page)
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'setBuffering', buffering: true })
    expect(true).toBe(true)
  })

  test('nativeCommand refresh calls router.refresh', async ({ page }) => {
    await mockNativeBridge(page)
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'refresh' })
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test file to verify it passes**

Run: `npx playwright test tests/e2e/bridge.spec.ts --reporter=list`
Expected: all 4 tests PASS.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (confirms the plain assignment in `mockNativeBridge` type-checks against the existing `Window.webkit` global augmentation with no directive needed).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/bridge.spec.ts
git commit -m "$(cat <<'EOF'
test: mock native bridge presence in bridge.spec.ts

BridgeInit gates its nativeCommand listener on isNativeBridgePresent(),
which checks for window.webkit/window.Android — neither exists in a
plain Chromium Playwright run, so the listener never attached and
dispatched events reached nothing. Inject a no-op window.webkit stub
via page.addInitScript before each test's goto, matching what
isNativeBridgePresent() and postMessageToNative() actually check for.
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- `contact-form-on-success.test.tsx` failure → Task 1. ✅
- `contact-form-pending-spinner.test.tsx` failure → Task 2. ✅
- `home.spec.ts` failures (heading + JSON-LD order) → Task 3 (both sub-assertions covered). ✅
- `teachers.spec.ts` failure → Task 4. ✅
- `bridge.spec.ts` failure → Task 5. ✅
- User's earlier flag that the "~22 failing unit tests" project-doc claim is stale → not a task in itself (nothing to fix — today's actual run already shows only the 2 unit failures covered by Tasks 1-2); noted here so it isn't lost, and the final full-suite run in the handoff will confirm no other unit failures exist.

**Placeholder scan:** No TBD/TODO/"add appropriate"/"similar to Task N" — every step has complete, exact code and exact current line numbers verified against the real files today.

**Type consistency:** No new shared types or function signatures introduced across tasks — `mockNativeBridge`/`dispatchNativeCommand` (Task 5) and `mockState` (Task 1, unchanged) are each local to their own single test file, not shared across tasks.

**Task ordering:** All 5 tasks touch disjoint files and can be implemented in any order or in parallel by separate subagents. Task 2's verification step was narrowed (see its Step 4) to not assume Task 1 has already landed, since both touch ContactForm-adjacent test files.

**Corrections made after an advisor review of this plan, before saving:**
1. Task 2's fix originally used `<span role="status">Sending...</span>` with no `aria-label`, on the assumption that `role="status"` computes its accessible name from content like `button`/`heading` do. It doesn't (`nameFrom:author` per ARIA). This was caught by applying the change and running the test directly — it failed — so `aria-label="Sending..."` was added and re-verified passing before this plan was saved.
2. Task 2's Step 4 originally re-ran `contact-form-on-success.test.tsx` too, which only passes once Task 1 has also landed — narrowed to only the files this task's own change affects.
3. Task 5's fix originally included a defensive `// @ts-expect-error` above the `window.webkit` assignment. Applying it and running `npx tsc --noEmit` showed the directive itself is a type error (`TS2578: Unused '@ts-expect-error' directive`) since the assignment already type-checks against the existing global augmentation in `post-message.ts`. Removed, and a `tsc --noEmit` step was added to Task 5 to keep this checked going forward.
4. Added an explicit sandbox note to Global Constraints: Playwright's `webServer` can't bind `0.0.0.0:3000` inside a sandboxed shell (`EPERM`) — Tasks 3-5's verification commands need the sandbox disabled or a pre-started `npm run dev` for `reuseExistingServer` to attach to.

**Full-suite verification (not a task, run once after all 5 land):**

```bash
npx vitest run && npx playwright test
```

Expected: 100% pass, no remaining "known pre-existing failure" caveats to document anywhere. Per the sandbox note above, this needs to run outside the sandbox restriction (or with a dev server already running) for the Playwright half to execute at all.
