# Focus-Trap & Keyboard-Focus Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps found while auditing the iOS WebKit keyboard/focus-scroll-desync fix (`docs/bugs/ios-webview-keyboard-focus-scroll-desync.md`): a disabled-element bug in the shared `useFocusTrap` hook, a redundant/duplicate focus trap in `ContactSheet` that it was masking (and a nested duplicate `role="dialog"` it also introduced), a missed `focusWithoutScroll` call site in `TeacherSearchBar`, and a dead component (`SearchInput`) carrying the same unsafe pattern.

**Architecture:** No architectural change. This is a bug-fix + dead-code-removal pass across existing files: one shared hook gets a correctness fix, one component sheds duplicate logic it never needed, one component call site is brought in line with the established `focusWithoutScroll` policy, and one unused component is deleted outright rather than patched.

**Tech Stack:** Next.js / React 19, TypeScript strict, Vitest + `@testing-library/react` for tests (`npx vitest run <path>`).

## Global Constraints

- TypeScript strict mode, no `any`.
- Use `@/` path alias for all imports.
- Conventional commits using the scopes from `AGENTS.md`: `modal` (useFocusTrap, ContactSheet, the bug doc), `teachers` (TeacherSearchBar), `global` (SearchInput deletion).
- Every `.focus()` call inside a fixed-position sheet/overlay must go through `focusWithoutScroll` (`src/lib/utils.ts`) — never a bare `.focus()`. This is the established project policy this whole plan enforces.
- Run `npx vitest run` after each task. **Known pre-existing failures, unrelated to this work, will still be present and are out of scope:** `tests/unit/contact-form-on-success.test.tsx` ("calls onSuccess when submission succeeds") and `tests/unit/contact-form-pending-spinner.test.tsx` ("shows a spinner alongside the submit button while pending"). Do not attempt to fix these as part of this plan. The only test this plan must turn from failing to passing is `tests/unit/contact-sheet.test.tsx > renders dialog when open` (Task 2 fixes it as a side effect of removing the duplicate `role="dialog"`).

---

## Background: why this ordering matters

`useFocusTrap`'s `FOCUSABLE_SELECTOR` currently matches `button`, `input`, etc. **without** excluding `disabled` elements. `ContactSheet` re-implemented its own Tab-wrap trap by hand, using a selector that **does** exclude disabled elements — and, because `ContactForm`'s submit button is `disabled={isPending}` during the real async submit, `ContactSheet`'s own trap is the only thing that correctly wraps focus once the form starts submitting. If Task 2 simply deleted `ContactSheet`'s trap without Task 1 fixing the shared hook first, tabbing forward from the last real field mid-submit would fall through with nothing calling `preventDefault()` — focus would escape the open modal entirely. **Task 1 must land and be verified before Task 2 removes the duplicate.**

---

### Task 1: Fix `useFocusTrap`'s disabled-element exclusion

**Files:**
- Modify: `src/lib/hooks/useFocusTrap.ts:4` (the `FOCUSABLE_SELECTOR` constant)
- Test: `tests/unit/use-focus-trap.test.tsx` (new file)

**Interfaces:**
- Consumes: nothing new — `useFocusTrap(containerRef: RefObject<HTMLElement | null>)` keeps its existing signature.
- Produces: nothing new — same hook, same signature. Task 2 relies on this hook now correctly excluding disabled elements from its "first"/"last" computation.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/use-focus-trap.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useRef } from 'react'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

function Harness() {
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef)
  return (
    <div ref={containerRef} tabIndex={-1}>
      <input aria-label="First" />
      <input aria-label="Last enabled" />
      <button disabled>Disabled trailing button</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('wraps Tab from the last enabled element to the first, skipping a disabled trailing element', () => {
    const { getByLabelText } = render(<Harness />)
    const first = getByLabelText('First')
    const lastEnabled = getByLabelText('Last enabled')
    lastEnabled.focus()
    fireEvent.keyDown(lastEnabled, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })

  it('wraps Shift+Tab from the first element to the last enabled element, skipping a disabled trailing element', () => {
    const { getByLabelText } = render(<Harness />)
    const first = getByLabelText('First')
    const lastEnabled = getByLabelText('Last enabled')
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastEnabled)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/use-focus-trap.test.tsx`
Expected: both tests FAIL. In the current (buggy) selector, `last` resolves to the disabled `<button>` — which real focus can never land on — so the forward-Tab wrap never fires (`document.activeElement` stays on "Last enabled" instead of moving to "First"), and the Shift+Tab wrap tries to focus the disabled button (a no-op — disabled elements are not focusable), leaving `document.activeElement` stuck on "First" instead of moving to "Last enabled".

- [ ] **Step 3: Fix the selector**

In `src/lib/hooks/useFocusTrap.ts`, change line 4:

```ts
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
```

This also folds in the `:not([tabindex="-1"])` exclusion on `input` that `ContactSheet`'s old hand-rolled selector had (to skip honeypot anti-spam inputs like `ContactForm`'s `tabIndex={-1}` fields) but the shared hook's selector lacked. It's benign today either way — those honeypot inputs sit in the middle of DOM order, never at `first`/`last`, and native Tab already skips `tabindex="-1"` regardless — but leaving the two selectors' criteria divergent contradicts the exact lesson this plan's Task 5 doc update states, so align them now while touching this line rather than leave a second latent gap on record.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/use-focus-trap.test.tsx`
Expected: both tests PASS.

- [ ] **Step 5: Run the full suite to confirm no other consumer regressed**

Run: `npx vitest run tests/unit/bottom-sheet.test.tsx tests/unit/teacher-panel-chrome.test.tsx tests/unit/sheet-chrome.test.tsx`
Expected: all PASS, unchanged from before this task (none of these currently render disabled focusable elements, so the selector change has no behavioral effect on them — confirmed by grep before writing this plan).

- [ ] **Step 6: Commit**

```bash
git add src/lib/hooks/useFocusTrap.ts tests/unit/use-focus-trap.test.tsx
git commit -m "$(cat <<'EOF'
fix(modal): exclude disabled elements from useFocusTrap's focusable set

A trailing disabled control (e.g. a submit button mid-isPending) was
being treated as the trap's "last" focusable element even though real
Tab navigation can never reach it, so the forward-Tab wrap silently
stopped firing whenever a sheet's last control was conditionally
disabled.
EOF
)"
```

---

### Task 2: Remove ContactSheet's duplicate Tab-trap and duplicate dialog role

**Files:**
- Modify: `src/components/about/ContactSheet.tsx:22` (remove `dialogRef`), `:46-68` (simplify keydown handler to Escape-only), `:90` (remove `role="dialog" aria-modal="true" aria-label="Contact Us" tabIndex={-1}` and the `ref`)
- Test: `tests/unit/contact-sheet-focus-trap.test.tsx` (new file — exercises the *real* `SheetChrome`, unlike the existing `tests/unit/contact-sheet.test.tsx` which mocks it out for isolation)

**Interfaces:**
- Consumes: `useFocusTrap` (via `SheetChrome`, already wired — no change needed there) fixed in Task 1.
- Produces: nothing new. `ContactSheet`'s public props (`open`, `onClose`) are unchanged.

- [ ] **Step 1: Write the failing/characterizing tests**

Create `tests/unit/contact-sheet-focus-trap.test.tsx`. This intentionally does **not** mock `SheetChrome` or `ModalContext` — it renders the real modal chrome to prove the shared trap (fixed in Task 1) is sufficient on its own, and that removing `ContactSheet`'s duplicate doesn't reopen the mid-submit tab-escape bug or leave a duplicate dialog role behind.

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ContactSheet } from '@/components/about/ContactSheet'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))

// Simulates the mid-submit state: a disabled trailing submit button, matching
// ContactForm's real disabled={isPending} behavior during useActionState submit.
vi.mock('@/components/about/ContactForm', () => ({
  ContactForm: () => (
    <>
      <input aria-label="Name" />
      <input aria-label="Message" />
      <button type="submit" disabled>Sending…</button>
    </>
  ),
}))

vi.mock('@/lib/bridge/post-message', () => ({
  postMessageToNative: vi.fn(),
}))

describe('ContactSheet + SheetChrome focus trap integration', () => {
  it('renders exactly one dialog role, not a nested duplicate', async () => {
    render(<ContactSheet open={true} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1))
  })

  it('wraps Tab from the last enabled field back into the dialog, without escaping it, skipping the disabled submit button', async () => {
    render(<ContactSheet open={true} onClose={vi.fn()} />)
    await screen.findByLabelText('Message')
    const message = screen.getByLabelText('Message')
    message.focus()
    fireEvent.keyDown(message, { key: 'Tab' })
    // Don't assert *which* element is first (SheetChrome renders its own
    // DragHandle/Close button ahead of ContactForm's children, so "first
    // focusable" is SheetChrome's Close button, not the Name field) --
    // assert the property actually under test: focus wrapped somewhere
    // inside the dialog instead of escaping it or getting stuck on Message.
    expect(document.activeElement).not.toBe(message)
    expect((document.activeElement as HTMLElement | null)?.closest('[role="dialog"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the new tests against the current code**

Run: `npx vitest run tests/unit/contact-sheet-focus-trap.test.tsx`
Expected: the "exactly one dialog role" test FAILS (today there are two — `ContactSheet`'s own outer wrapper and `SheetChrome`'s `contentRef`, both carrying `role="dialog"`). The Tab-wrap test already PASSES before this task's change — via `ContactSheet`'s own duplicate trap firing first as a document-level listener whenever the (fixed, Task 1) shared trap's element-level listener already moved focus off `Message`. That's expected: this test is a characterization/safety-net test for the Step 3 deletion (proving the shared trap alone remains sufficient), not a red/green pair for it. Confirm it still passes after Step 3 in Step 4.

- [ ] **Step 3: Remove the duplicate trap and duplicate dialog role from ContactSheet**

In `src/components/about/ContactSheet.tsx`:

Remove the `dialogRef` declaration (line 22):

```ts
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

(delete the `const dialogRef = useRef<HTMLDivElement>(null)` line that follows it)

Simplify the keydown effect (replace lines 46-68):

```tsx
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, handleDismiss])
```

Remove the duplicate dialog semantics from the wrapper div (replace line 90) — `SheetChrome`'s own `contentRef` div already owns `role="dialog"`, `aria-modal`, and (via its `title` prop) the accessible name, so this outer div becomes a plain click-guard wrapper:

```tsx
      <div onClick={(e) => e.stopPropagation()}>
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `npx vitest run tests/unit/contact-sheet-focus-trap.test.tsx`
Expected: both tests PASS. The Tab-wrap test now exercises the shared `useFocusTrap` (fixed in Task 1) instead of `ContactSheet`'s deleted duplicate, proving the shared trap alone is sufficient.

- [ ] **Step 5: Run the existing ContactSheet test file to confirm no regression, and that the pre-existing failure is now fixed**

Run: `npx vitest run tests/unit/contact-sheet.test.tsx`
Expected: all 8 tests PASS, including `renders dialog when open` — which was failing before this task (see Global Constraints) because `screen.getByRole('dialog')` matched two elements. It now matches only the mocked `SheetChrome`'s dialog.

- [ ] **Step 6: Commit**

```bash
git add src/components/about/ContactSheet.tsx tests/unit/contact-sheet-focus-trap.test.tsx
git commit -m "$(cat <<'EOF'
fix(modal): remove ContactSheet's duplicate focus trap and dialog role

ContactSheet re-implemented its own Tab-wrap trap and its own
role="dialog"/aria-modal/tabIndex, duplicating what SheetChrome's
contentRef already owns as its child. The duplicate trap only existed
because the shared useFocusTrap hook had a disabled-element bug (fixed
separately) that ContactSheet's hand-rolled version happened to avoid;
now that the shared hook is correct, delete the duplicate rather than
carry two independently-written Tab handlers. This also fixes a real
nested-dialog a11y defect (two DOM nodes both reporting role="dialog")
that was making tests/unit/contact-sheet.test.tsx's
"renders dialog when open" test fail.
EOF
)"
```

---

### Task 3: Fix TeacherSearchBar's clear() to use focusWithoutScroll

**Files:**
- Modify: `src/components/teachers/TeacherSearchBar.tsx:1-3` (add import), `:51` (the bare `.focus()` call)
- Test: `tests/unit/teacher-search-bar.test.tsx` (new file)

**Interfaces:**
- Consumes: `focusWithoutScroll(el: HTMLElement | null | undefined): void` from `@/lib/utils` (existing, unchanged).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/teacher-search-bar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeacherSearchBar } from '@/components/teachers/TeacherSearchBar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/teachers/search',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('TeacherSearchBar', () => {
  it('refocuses the input via focusWithoutScroll (preventScroll: true) when cleared', () => {
    render(<TeacherSearchBar />)
    const input = screen.getByLabelText('Search teachers') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'algebra' } })
    const focusSpy = vi.spyOn(input, 'focus')
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/teacher-search-bar.test.tsx`
Expected: FAIL — `focusSpy` was called with no arguments (bare `.focus()`), not `{ preventScroll: true }`.

- [ ] **Step 3: Fix the call site**

In `src/components/teachers/TeacherSearchBar.tsx`, add the import (near the top, alongside the existing imports):

```ts
import { focusWithoutScroll } from '@/lib/utils'
```

Replace line 51:

```ts
    focusWithoutScroll(inputRef.current)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/teacher-search-bar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/teachers/TeacherSearchBar.tsx tests/unit/teacher-search-bar.test.tsx
git commit -m "$(cat <<'EOF'
fix(teachers): use focusWithoutScroll when refocusing search input on clear

This input lives inside the fixed-position search sheet the WebKit
keyboard-focus-scroll-desync fix was written for. Every programmatic
focus call in that sheet is supposed to go through focusWithoutScroll
per docs/bugs/ios-webview-keyboard-focus-scroll-desync.md; this one
call site was missed.
EOF
)"
```

---

### Task 4: Delete the dead SearchInput component

**Files:**
- Delete: `src/components/global/SearchInput.tsx`

**Interfaces:**
- Consumes: nothing (deletion).
- Produces: nothing (deletion). Confirmed via `grep -rn "SearchInput" src tests` that nothing outside the file itself references it — it was ported from `calvarytucson-nextjs` (`91f6f42`) and never wired up here.

- [ ] **Step 1: Confirm it is still unused**

Run: `grep -rn "SearchInput" src tests`
Expected: only self-references inside `src/components/global/SearchInput.tsx` itself.

- [ ] **Step 2: Delete the file**

```bash
git rm src/components/global/SearchInput.tsx
```

- [ ] **Step 3: Confirm the build and full test suite are unaffected**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck passes; test results unchanged from Task 3's end state (same pre-existing 2 unrelated failures noted in Global Constraints, nothing new).

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore(global): delete unused SearchInput component

Ported from calvarytucson-nextjs but never wired up in this app —
confirmed no references anywhere in src/ or tests/. Its bare
autoFocus .focus() call carried the same unsafe-inside-a-fixed-sheet
pattern being cleaned up elsewhere in this change; deleting rather
than fixing dead code.
EOF
)"
```

---

### Task 5: Document the follow-up in the keyboard-desync bug doc

**Files:**
- Modify: `docs/bugs/ios-webview-keyboard-focus-scroll-desync.md` (append a new section)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (documentation only).

- [ ] **Step 1: Append a follow-up section**

Add this section at the end of `docs/bugs/ios-webview-keyboard-focus-scroll-desync.md` (after the existing "Native-side lessons" section):

```markdown

## Follow-up: focus-trap disabled-element gap (2026-07-16)

An audit of every `focusWithoutScroll` call site (prompted by a review of this
bug's commit history) found a related but distinct gap: the shared
`useFocusTrap` hook's focusable-element selector didn't exclude `disabled`
elements. Whenever a sheet's trailing control was conditionally disabled
(e.g. `ContactForm`'s submit button during its real `isPending` async submit
window), the hook's computed "last focusable element" became that
unreachable disabled control, so the forward-Tab wrap silently stopped
firing.

`ContactSheet` had independently re-implemented its own Tab-wrap trap by
hand, using a selector that correctly excluded disabled elements — which is
why *that* sheet never displayed the symptom, at the cost of duplicating
logic the shared `useFocusTrap` hook was supposed to own, plus adding a
second `role="dialog"` nested inside `SheetChrome`'s own (an a11y defect,
and the cause of a previously-failing unit test).

**Fix:** correct `useFocusTrap`'s selector once (`FOCUSABLE_SELECTOR` now
excludes `:not([disabled])` on every relevant tag), then delete
`ContactSheet`'s duplicate trap and duplicate dialog role, relying entirely
on `SheetChrome`'s already-installed `useFocusTrap(contentRef)`.

**Lesson for the next project with this architecture:** if you find two
independent focus-trap (or focus-management) implementations layered on the
same dialog "for defense in depth," check whether they use *identical*
focusable-element criteria before assuming one safely no-ops in the
other's presence. A silent selector divergence between them can mask a real
bug in the "primary" implementation until an edge case — here, a
conditionally-disabled trailing control — breaks the assumption that both
compute the same first/last elements.
```

- [ ] **Step 2: Commit**

```bash
git add docs/bugs/ios-webview-keyboard-focus-scroll-desync.md
git commit -m "$(cat <<'EOF'
docs(modal): document the useFocusTrap disabled-element follow-up fix
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- `useFocusTrap` disabled-element bug → Task 1. ✅
- `ContactSheet` duplicate Tab-trap → Task 2. ✅
- `ContactSheet` duplicate `role="dialog"` (found while writing this plan, same root cause/same file/same commit that introduced the duplicate trap) → Task 2. ✅
- `TeacherSearchBar.tsx` bare `.focus()` in `clear()` → Task 3. ✅
- `SearchInput.tsx` bare `.focus()` (dead code) → Task 4 (deletion, not a fix, per YAGNI — nothing references it). ✅
- Doc trail consistency with the established pattern of doc-updates-follow-fixes → Task 5. ✅
- Native iOS repo: investigated separately (prior turn) — confirmed complementary (`WKWebView+ProgrammaticFocus.swift` swizzle, `KeyboardObserver.swift`), no native code changes needed, so no task here. Explicitly out of scope for this plan.

**Placeholder scan:** no TBD/TODO/"add appropriate"/"similar to Task N" — every step has complete, exact code.

**Type consistency:** `useFocusTrap(containerRef: RefObject<HTMLElement | null>)` signature unchanged across Task 1 and its consumers (Task 2 doesn't touch the hook's call site, only removes a caller-side duplicate). `focusWithoutScroll(el: HTMLElement | null | undefined): void` used identically in Task 3 as everywhere else in the codebase — no new wrapper or renamed export introduced.

**Task ordering dependency called out explicitly:** Task 2 depends on Task 1 landing first (see "Background" section) — this is not just a nice-to-have ordering, it's load-bearing for correctness, so it's stated up front rather than left implicit.
