# Teacher Panel Push/Pop Motion + Overlay Flash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App-like in-panel slide between teacher states with a fixed shell, an animated Back button, and no nav bar flash when the overlay opens.

**Architecture:** Hoist panel chrome (drag handle, Back, X, dialog shell) out of the per-slug intercepted page into `@modal/layout.tsx` so it never remounts. Wrap only the swapped content in a stage that animates imperatively (Web Animations API, one-shot on a direction signal from the store) with a DOM "ghost" of the outgoing content, so Next hiding or un-hiding old pages never replays animations.

**Tech Stack:** Next 16.2.10 (App Router, parallel route `@modal`, intercepting route), React 19, Radix Dialog, Zustand, Tailwind v4, Vitest, Playwright.

## Global Constraints

- AGENTS.md: read `node_modules/next/dist/docs/` before routing code; every clickable has `cursor-pointer`; icon buttons have `aria-label`; 44px (`h-11 w-11`) touch targets; focus ring `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`; animations wrapped in `motion-safe:` (JS animations check `matchMedia('(prefers-reduced-motion: reduce)')`).
- Commit scope `modal` (component fixes), `test` for test-only. Do NOT stage `package-lock.json` or `test-results/`. No push.
- Do NOT enable `experimental.viewTransition` (global side effects on every navigation, and `router.back()` / browser Back carry no transition type per `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). Decided 2026-11-02.
- Owner-approved mock: `docs/superpowers/plans/2026-11-02-teacher-panel-motion.mock.html`.

## UI mocks (approved)

Approved by owner 2026-11-02 ("proceed"): `2026-11-02-teacher-panel-motion.mock.html` (mobile 390 + desktop panel, dark/light, overlay current vs proposed).

- Shell (panel, drag handle, X) never moves. Back button animates in on first push, out on return to root (opacity, translateX -12px, scale .75, 300ms `cubic-bezier(0.32,0.72,0,1)`).
- Push: new content `translateX(100%)→0`, old drifts `0→-28%` and dims (`brightness .7`), 300ms.
- Pop: leaving content `0→100%`, revealed content `-28%→0`, 300ms.
- Close: mobile slides down + fades (0.2s), desktop slides right (0.25s), overlay fades out with it.
- Overlay: opaque at once instead of fade-in (**only if Task 1 confirms the flash is the overlay fade**).

## Known seams (must be handled and tested)

1. **Search-sheet root.** `rootSheet === 'search' && stackDepth === 0` renders `TeacherSearchSheetContent` (own SheetChrome), not the teacher shell. Teacher shell wraps only the detail branch. Detail pushed over search, then Back, swaps shell type: keep today's behavior (no slide, instant swap). Test it.
2. **Back button a11y.** Hidden Back uses `inert` + `tabIndex={-1}` + `aria-hidden` (never aria-hidden alone). If Back holds focus when the stack returns to root, move focus to the dialog (`contentRef.focus()`).
3. **Double Back / double push mid-animation.** `navLockRef` guards Back/push for the animation duration (like `dismissGuardRef`).
4. **Ghost clone traps.** `cloneNode` resets `scrollTop` (copy it onto the ghost scroller), copies ids/focusables (ghost gets `inert` + `aria-hidden="true"` and ids stripped), and timers must skip entirely under reduced motion (navigate immediately, no ghost).
5. **Suspense.** New page may show `TeacherDetailSkeleton` first; the slide runs on the skeleton, real content fades in via its existing `fade-in`.

---

### Task 1: Spike — confirm nav flash cause and close gap (gates Task 5)

**Files:**
- Create (throwaway, delete after): `tests/e2e/_flash-probe.spec.ts`
- Modify: this plan, appendix "Spike findings"

- [ ] **Step 1:** Ask owner Yes/No to start dev server (`npm run dev -- -p 3100` under `doppler`; check `lsof -i :3100` first). Playwright project config starts its own on 3000: stop 3100 before running e2e.
- [ ] **Step 2:** Write the probe: set light theme (`localStorage`/class per `ThemeProvider`), mobile viewport 390x844, open the panel from `/teachers` Recommended row, and every frame (`requestAnimationFrame` loop inside `page.evaluate`, ~20 frames) record `getComputedStyle(overlay).opacity`, `getComputedStyle(nav).opacity/visibility`, and the media bar visibility. Also record frames while closing.
- [ ] **Step 3:** Decide from data: (a) overlay opacity 0→0.8 over 200ms while nav fully visible ⇒ overlay fix (Task 5). (b) nav/media bar hide lag (`useHideMediaBarWhileOpen`) ⇒ fix that hook instead. Record frames in the appendix. Confirm whether close already animates out (it does in code: `EXIT_DURATION` 280, exit classes) and whether the owner's "animate out" ask means a visible gap (e.g. overlay vs panel timing mismatch: overlay 0.15s vs panel 0.15s but `EXIT_DURATION` 280).
- [ ] **Step 4:** Delete the probe, stop the dev server, commit appendix only: `docs: record teacher panel flash probe findings`.

### Task 2: Store direction signal

**Files:** Modify `src/lib/stores/modal.ts`; Test `tests/unit/modal-store.test.ts`

**Interfaces:** Produces `navDirection: 'push' | 'pop' | null`, `clearNavDirection: () => void`. `pushModal` sets `'push'`, `prepareBack` sets `'pop'`, `openModal`/`openSearchSheet`/`close` set `null`.

- [ ] **Step 1:** Failing tests: pushModal → `'push'`; prepareBack → `'pop'`; openModal/close → `null`; clearNavDirection → `null`.
- [ ] **Step 2:** `npx vitest run tests/unit/modal-store.test.ts` fails. Implement, rerun, pass.
- [ ] **Step 3:** Commit `feat(modal): track panel nav direction in store`.

### Task 3: Hoist shell into layout (no motion yet)

**Files:**
- Create: `src/components/modals/chrome/TeacherPanelShell.tsx` (moved from `TeacherPanelChrome.tsx`, `git mv`)
- Modify: `src/app/@modal/layout.tsx`, `src/app/@modal/(...)teachers/[slug]/page.tsx` (drop chrome wrapper, keep Suspense + content), `tests/unit/teacher-panel-chrome.test.tsx` (rename to `teacher-panel-shell.test.tsx`), `tests/unit/modal-layout.test.tsx`
- Delete: `panelEntered` / `markPanelEntered` from store and its tests (shell no longer remounts), the `skipEnter` / `animationend` code.

**Interfaces:** Consumes `useModal()` (`onDismiss`, `onBack`, `isClosing`, `stackDepth`). Produces `<TeacherPanelShell>{children}</TeacherPanelShell>`; layout renders it only for the detail branch (`!(rootSheet === 'search' && stackDepth === 0)`).

- [ ] **Step 1:** Tests: shell stays mounted across `stackDepth` 0→1→0 (same DOM node); Back present only when `stackDepth > 0`; search root renders no teacher shell; Close/Escape/overlay-click still dismiss.
- [ ] **Step 2:** Move component, wire into layout inside `ModalProvider`, remove chrome from the per-slug page. Keep enter animation classes (first open only now trivially true) and exit animations unchanged.
- [ ] **Step 3:** `npx tsc --noEmit && npx vitest run` green; manual: open, swap, Back, close, search→detail→Back.
- [ ] **Step 4:** Commit `refactor(modal): hoist teacher panel shell into modal layout`.

### Task 4: Content stage (push/pop) + Back button motion

**Files:** Create `src/components/modals/chrome/PanelContentStage.tsx`, `src/lib/constants/modal.ts` (add `PANEL_PAGE_DURATION = 300`, `PANEL_PAGE_EASE`); Modify `TeacherPanelShell.tsx`, `src/app/@modal/layout.tsx` (`handleBack` waits for pop animation); Tests `tests/unit/panel-content-stage.test.tsx`.

**Interfaces:** Stage props `{ direction: 'push'|'pop'|null; reducedMotion: boolean; onSettled: () => void; children }`. Imperative behavior:
- On `direction === 'push'`: before children swap, snapshot `scrollRef.current` into a ghost (`cloneNode(true)`, `inert`, `aria-hidden`, ids stripped, `scrollTop` copied); ghost animates `translateX(0→-28%)` + `filter brightness(1→.7)`; live content animates `100%→0`. Remove ghost on `finished`.
- On `pop`: `handleBack` first calls `stage.beginPop()`, which clones current content into a top ghost animating `0→100%`; the revealed (Next un-hidden) content animates `-28%→0`; then `router.back()` runs without waiting (visual is carried by the ghost). Clear `navDirection`.
- Reduced motion: no ghost, no animation, no waiting.
- Back button: classes per mock, toggled by `stackDepth > 0`; `inert` + `tabIndex={-1}` + `aria-hidden` when hidden; if focused when hiding, focus dialog.
- All animations are `Element.animate()` triggered once per `navDirection` change, never CSS classes (so Next's hide/un-hide cannot replay them, the cause of the Back replay bug fixed in `5cd278c`).

- [ ] **Step 1:** Failing jsdom tests (stub `Element.prototype.animate`): push creates ghost with inert/aria-hidden/no ids and copied scrollTop; pop ghost goes right; reduced motion makes no `animate` call; second Back during animation ignored; Back button inert when hidden, focus moves to dialog when it held focus.
- [ ] **Step 2:** Implement, run tests green.
- [ ] **Step 3:** Commit `feat(modal): slide teacher content in panel with fixed shell`.

### Task 5: Overlay / nav flash fix (per Task 1 result)

**Files:** Modify `src/app/@modal/layout.tsx` (overlay classes) and/or `src/lib/hooks/useHideMediaBarWhileOpen.ts`; Test `tests/unit/modal-layout.test.tsx`.

- [ ] **Step 1:** Failing test for the confirmed cause (e.g. overlay has no `fade-in` class on open, exit keeps `fade-out`).
- [ ] **Step 2:** Implement only the fix the Task 1 data supports (default if overlay: drop the `fade-in` animation on open, keep fade-out). Do not apply the overlay change if Task 1 shows another cause.
- [ ] **Step 3:** Re-run the Task 1 probe approach once (throwaway, delete) on light theme to show the flash gone; attach frame numbers in the commit body.
- [ ] **Step 4:** Commit `fix(modal): stop nav bar flashing before overlay covers it`.

### Task 6: Tests

**Files:** Modify `tests/e2e/teachers.spec.ts`.

- [ ] **Step 1:** Replace the `animationName === 'none'` / `getAnimations().length === 0` assertions (wrong by design now) with: dialog node is the same element across a swap (`elementHandle` kept, `isConnected`), heading and URL change, Back button appears (`aria-hidden` absent) after swap, no ghost remains after settle (`[data-panel-ghost]` count 0), Back restores URL and first heading, Back button hides at root.
- [ ] **Step 2:** Add emulated reduced-motion e2e: swap completes with no ghost and no delay.
- [ ] **Step 3:** `rg-run` e2e (ticket class per `rg-queue` docs, not `heavy`); stop any dev server on 3100 first. Commit `test(modal): cover panel push/pop motion`.

### Task 7: Verify and review

- [ ] **Step 1:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, e2e green. Browser check on mobile and desktop widths, dark and light, per mock; search-sheet → teacher → Back seam; Escape, drag-to-dismiss, focus return to trigger.
- [ ] **Step 2:** One review pass (`code-review`); fix findings. Report commits (do NOT push; owner asks separately). Move CAL-181/182 to Done only after owner approves in browser.

---

## Appendix: Spike findings

_(filled in by Task 1)_
