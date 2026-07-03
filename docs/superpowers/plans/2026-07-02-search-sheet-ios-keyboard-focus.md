# iOS Search-Sheet Keyboard Focus Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On iPhone, tapping "Search teachers..." on `/teachers` must open the search sheet with the real keyboard visible and the sheet staying open — not flashing/closing, and not silently failing to focus.

**Architecture:** Two speculative fixes were already applied this session with NO device verification (`router.prefetch` in `PassiveSearchBar`, a `justOpenedRef` outside-dismiss guard in `@modal/layout.tsx`). Per `superpowers:systematic-debugging`, we do not add a third guess. This plan first adds pure diagnostic instrumentation (console logging only, zero behavior change), gets one device-tested console capture from the user, and only then branches into a fix task chosen by that evidence. If evidence rules out the two leading single-cause hypotheses (Radix `onOpenAutoFocus` stealing focus; Radix `DismissableLayer` catching a stray outside pointerdown), the plan falls through to an architectural task that decouples the sheet's real input from the intercepted-route Suspense boundary entirely, per the established "target input must exist synchronously at gesture time" pattern used by production apps (Nike/Foodspring-style dummy-focus keep-alive).

**Tech Stack:** Next.js 16 App Router (intercepting routes, `cacheComponents`/PPR), React 19, Radix `@radix-ui/react-dialog` v1.1.15, Zustand, Vitest + Testing Library.

## Global Constraints

- No code changes without a preceding evidence step confirming the hypothesis it targets — do not stack a fix on top of an unverified fix.
- All logging added in Phase 0 must be removed before this work is considered done (Phase 3, Task 3.1) — no `console.log` left in shipped code.
- Every device-dependent claim ("keyboard shows", "sheet stays open") must come from the user's own report or pasted console output — never asserted from reasoning alone.
- Existing unit tests (`tests/unit/passive-search-bar.test.tsx`) and `npx tsc --noEmit` must stay clean after every task.
- Commit scope for all tasks in this plan: touches `global` (PassiveSearchBar), `modal` (ModalLayout/SheetChrome), and `test` per the scope table in `AGENTS.md` — use the scope matching whichever file a given commit actually touches.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/global/PassiveSearchBar.tsx` | Proxy input on `/teachers`; focuses synchronously on `pointerdown`, prefetches and navigates to `/teachers/search`. |
| `src/app/@modal/layout.tsx` | Radix `Dialog` shell for all intercepted-route sheets (search + teacher detail); owns open/close/dismiss wiring against `useModalStore`. |
| `src/components/modals/chrome/SheetChrome.tsx` | Per-sheet chrome; owns the `autoFocusInput` MutationObserver that focuses the real input once it mounts. |
| `src/app/@modal/(...)teachers/search/page.tsx` | Intercepted-route content: `SheetChrome` + `TeacherSearchBar` + Suspense-gated Sanity-backed results. |
| `src/components/teachers/TeacherSearchBar.tsx` | The real search `<input>` inside the sheet. |
| `src/lib/stores/modal.ts` | Zustand store: `isOpen`, `expectingRoute`, `triggerRef`, etc. |
| `tests/unit/passive-search-bar.test.tsx` | Existing unit coverage for the proxy input + prefetch. |
| **(Phase 3 only, conditional)** `src/components/teachers/TeacherSearchOverlay.tsx` | New always-mounted client overlay that renders the sheet + real input independent of route Suspense. |
| **(Phase 3 only, conditional)** `src/app/api/teachers/search-data/route.ts` | New Route Handler exposing `fetchAllTeacherData` for client-side fetch, so the overlay's data doesn't block its own mount. |

---

## Phase 0: Diagnostic Instrumentation (no behavior change)

### Task 0.1: Add logging to the proxy's navigate handler

**Files:**
- Modify: `src/components/global/PassiveSearchBar.tsx:40-51`

**Interfaces:**
- Consumes: existing `navigate()` function, `inputRef`, `router`.
- Produces: nothing new — logging only.

- [ ] **Step 1: Add activeElement logging around the synchronous focus call**

Replace the `navigate` function body:

```typescript
  function navigate() {
    inputRef.current?.focus()
    console.log('[focus-debug] proxy focus() called, activeElement:', document.activeElement, 'is proxy:', document.activeElement === inputRef.current)
    setTriggerRef(inputRef.current)
    resetNav()
    const store = useModalStore.getState()
    if (store.isOpen) {
      store.pushModal(modalTitle ?? placeholder)
    } else {
      openModal(modalTitle ?? placeholder)
    }
    console.log('[focus-debug] calling router.push', href)
    router.push(href)
  }
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/components/global/PassiveSearchBar.tsx
git commit -m "test(global): add focus-debug logging to PassiveSearchBar navigate handler"
```

### Task 0.2: Add logging to ModalLayout's store/pathname transitions and Radix dialog lifecycle events

**Files:**
- Modify: `src/app/@modal/layout.tsx:112-119` (justOpenedRef effect), `:134-143` (pathname effect), `:184-195` (`DialogPrimitive.Content`)

**Interfaces:**
- Consumes: existing `isOpen`, `expectingRoute`, `expectingBack`, `pathname`, `justOpenedRef` from the surrounding component.
- Produces: nothing new — logging only.

- [ ] **Step 1: Log every pathname-effect firing with full state**

Replace the pathname effect:

```typescript
  useEffect(() => {
    console.log('[focus-debug] pathname effect fired', { pathname, isOpen, isClosing, expectingRoute, expectingBack })
    if (!isOpen) return
    if (expectingRoute) { routeArrived(); console.log('[focus-debug] -> routeArrived()'); return }
    if (expectingBack) { clearBack(); console.log('[focus-debug] -> clearBack()'); return }
    if (isOpen && !isClosing) {
      console.log('[focus-debug] -> unexpected pathname change, force-closing')
      close()
      dismissGuardRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
```

- [ ] **Step 2: Log the justOpenedRef window**

Replace the justOpenedRef effect:

```typescript
  useEffect(() => {
    if (!isOpen) return
    justOpenedRef.current = true
    console.log('[focus-debug] justOpenedRef window opened')
    justOpenedTimer.current = setTimeout(() => {
      justOpenedRef.current = false
      console.log('[focus-debug] justOpenedRef window closed (500ms elapsed)')
    }, 500)
    return () => {
      if (justOpenedTimer.current) clearTimeout(justOpenedTimer.current)
    }
  }, [isOpen])
```

- [ ] **Step 3: Log every relevant Radix Dialog Content lifecycle event, without changing dismiss behavior for events we're not yet targeting**

Replace the `DialogPrimitive.Content` props:

```typescript
        <DialogPrimitive.Content
          className="fixed inset-0 z-[70] outline-none"
          onOpenAutoFocus={(e) => {
            console.log('[focus-debug] onOpenAutoFocus fired, activeElement before:', document.activeElement)
          }}
          onCloseAutoFocus={(e) => {
            console.log('[focus-debug] onCloseAutoFocus fired')
          }}
          onFocusOutside={(e) => {
            console.log('[focus-debug] onFocusOutside fired, target:', (e.target as HTMLElement)?.tagName, e.target)
          }}
          onPointerDownOutside={(e) => {
            console.log('[focus-debug] onPointerDownOutside fired, target:', (e.target as HTMLElement)?.tagName, 'justOpened:', justOpenedRef.current)
            if (justOpenedRef.current) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            console.log('[focus-debug] onInteractOutside fired, type:', e.type, 'target:', (e.target as HTMLElement)?.tagName, 'justOpened:', justOpenedRef.current)
            if (justOpenedRef.current) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            const active = document.activeElement as HTMLInputElement | null
            if (active?.tagName === 'INPUT' && active.value.length > 0) {
              e.preventDefault()
              return
            }
            handleClose()
          }}
        >
```

Note: `onOpenAutoFocus`/`onCloseAutoFocus` are logged only, no `preventDefault()` yet — Phase 0 gathers evidence, it does not fix anything.

- [ ] **Step 4: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add src/app/@modal/layout.tsx
git commit -m "test(modal): add focus-debug logging to ModalLayout dialog lifecycle"
```

### Task 0.3: Add logging to SheetChrome's autoFocusInput effect

**Files:**
- Modify: `src/components/modals/chrome/SheetChrome.tsx:45-52`

**Interfaces:**
- Consumes: existing `tryFocus()` closure, `contentRef`.
- Produces: nothing new — logging only.

- [ ] **Step 1: Log before/after focus state around the real-input focus call**

Replace the `tryFocus` function and the immediate-focus branch:

```typescript
    function tryFocus() {
      const input = contentRef.current?.querySelector<HTMLElement>('input, textarea')
      if (input) {
        observer?.disconnect()
        clearTimeout(fallbackTimer)
        console.log('[focus-debug] SheetChrome found input via MutationObserver, activeElement before focus:', document.activeElement)
        input.focus()
        console.log('[focus-debug] SheetChrome called input.focus(), activeElement after:', document.activeElement, 'match:', document.activeElement === input)
      }
    }

    // Input may already be in the DOM (e.g., no Suspense delay)
    const immediate = contentRef.current?.querySelector<HTMLElement>('input, textarea')
    if (immediate) {
      console.log('[focus-debug] SheetChrome found input immediately (no Suspense gap), activeElement before focus:', document.activeElement)
      immediate.focus()
      console.log('[focus-debug] SheetChrome called immediate.focus(), activeElement after:', document.activeElement, 'match:', document.activeElement === immediate)
    } else {
      console.log('[focus-debug] SheetChrome: no input in DOM yet, starting MutationObserver')
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/chrome/SheetChrome.tsx
git commit -m "test(modal): add focus-debug logging to SheetChrome autoFocusInput"
```

---

## Phase 1: Device Capture (manual gate — no code)

### Task 1.1: Capture one full console trace from a real tap

Not a code task. Hand this to the user directly:

1. On a Mac, open Safari → Develop menu → select the connected iPhone → select the `dev.calvarytucson.com` tab (or the native app's WebView, whichever is loaded).
2. Clear the console.
3. On the iPhone, tap "Search teachers..." once.
4. Copy the entire console output in order (all `[focus-debug]` lines) and paste it back into this conversation, along with what you visually observed (keyboard showed/didn't, sheet stayed open/closed, timing).

**Do not proceed to Phase 2 until this trace is captured.** Guessing which Phase 2 task to run without it repeats the exact mistake this plan exists to stop.

---

## Phase 2: Evidence-Directed Fix (pick ONE task based on Task 1.1's trace)

Read the trace in this order and pick the first branch that matches:

- **If `onOpenAutoFocus fired, activeElement before:` shows the proxy `<input>` (or any element outside the dialog) as `activeElement` at that point, and the very next log line shows `activeElement` changed to something inside the dialog (e.g. the Content div) before `SheetChrome found input`/`.focus()` lines appear** → Radix's default auto-focus-into-dialog behavior is stealing focus before `SheetChrome` gets a chance to focus the real input. Run **Task 2.A**.
- **If `onPointerDownOutside fired` or `onInteractOutside fired` appears AFTER the sheet's content has rendered, with `justOpened: true` logged, and the sheet still visibly closes** → the `justOpenedRef` guard isn't actually preventing the dismiss (i.e., `preventDefault()` on that event type doesn't stop this particular Radix dismiss path). Run **Task 2.B**.
- **If `pathname effect fired` logs a force-close branch (`-> unexpected pathname change, force-closing`) when `expectingRoute` was `false` at that point** → the `openModal()`/`pushModal()` state write is racing behind the pathname update. Run **Task 2.C**.
- **If none of the above show up as the cause** — e.g. `SheetChrome called input.focus()` genuinely fires and `activeElement` matches, but the keyboard still doesn't show or the sheet still closes for a reason not captured by any log line above — **stop coding fixes**. This means the single-cause hypotheses are exhausted (this would be the 3rd+ attempt). Do not run Task 2.A/B/C speculatively. Go straight to **Phase 3** and discuss the architectural pivot with the user before writing any of it.
- **If a Task 2.X fix was applied and the device retest (its final step) still fails** — do not treat that as "single-cause hypotheses exhausted." Re-run **Task 1.1** for a fresh trace with the fix still in place first. Only fall through to Phase 3 once a fresh trace, captured after a real fix attempt, still shows no matching branch — don't jump to the architectural rewrite off a stale or absent trace.

### Task 1.1 result (2026-07-02, first device trace)

Confirmed **Task 2.A**: the trace showed `activeElement` was the proxy input at `onOpenAutoFocus fired`, then the dialog `<div role="dialog" ... tabindex="-1">` at `SheetChrome found input immediately` (before SheetChrome's own `.focus()` call ran). Radix moved focus to a non-editable div in between — on iOS that alone drops the keyboard, and a later `.focus()` on the real input (even milliseconds after) doesn't bring it back without a fresh gesture. **Applied and committed** (`e.preventDefault()` on `onOpenAutoFocus`).

**Ruled out: Task 2.B and 2.C.** No `onPointerDownOutside`/`onInteractOutside`/`onFocusOutside` line appeared anywhere in the trace, and the `-> unexpected pathname change, force-closing` line never appeared either (the pathname effect for `/teachers` fired with `isOpen` *already* `false`). Neither branch's mechanism is the cause of the observed auto-close.

**New, previously-unanticipated 4th cause found:** the trace's tail (`isOpen: false` pathname-effect entry for `/teachers`, followed by `onCloseAutoFocus`) is the fingerprint of `handleClose`'s `setTimeout` body (`close()` then `window.history.go(-(depth+1))`) having actually run — meaning `onDismiss` was invoked from somewhere. With Radix's own outside-dismiss/escape paths ruled out by the silent logs, the only remaining path to `onDismiss` is `SheetChrome`'s own backdrop `onClick` (`role="presentation"` div, `src/components/modals/chrome/SheetChrome.tsx:86-91`) — not instrumented by Phase 0. Leading hypothesis: the trailing synthetic click from the original tap fires while the sheet is still mid-entrance-animation, landing on the backdrop (still exposed at those screen coordinates) before the sheet has slid fully into place.

**Added logging (not yet a fix) for this 4th hypothesis**, alongside applying 2.A, so the next device trace can confirm or refute it in one round trip:
- `SheetChrome.tsx`'s backdrop `onClick`: logs `e.target.tagName`, whether `e.target === e.currentTarget`, and `e.clientX`/`e.clientY`.
- `@modal/layout.tsx`'s `handleClose`: logs a caller-stack snippet (`new Error().stack?.split('\n').slice(1, 5)`) at entry, to see what actually invoked it.

**Note for whoever executes this plan from a fresh read:** the branch-selection list below (originally written before this trace) predates this finding and does not cover the backdrop-click hypothesis. Treat the "New, previously-unanticipated 4th cause" section above as authoritative for what's currently being tested — do not re-derive branch selection from the original bullet list alone without reading this update first.

**Next device retest:** do one hard reload first (a `[Fast Refresh] rebuilding` line appeared mid-trace last time — HMR noise mid-tap complicates timing reads), then tap once, capture the full trace again.

### Task 1.1 result (2026-07-02, second and third device traces)

Second trace: with Task 2.A applied, `activeElement` before `SheetChrome`'s focus call was correctly the proxy input (not the dialog div) — Radix no longer steals focus, confirming Task 2.A's fix works as intended. That trace showed no dismiss signal at all, but the user still saw the sheet/keyboard flash-and-disappear on other attempts — so Task 2.A alone wasn't sufficient. Ruled out a hard-reload/tunnel fallback (Network tab showed a normal `?_rsc=` fetch, not a full document navigation) and the native-app bridge (repro is in Safari directly on `dev.calvarytucson.com`, not the WebView).

Third trace, from a tap that reproduced the failure, ended with:
```
SheetChrome backdrop onClick fired, target: DIV, isBackdrop: true, clientX/Y: 162, 151
handleClose entered, caller stack: SheetChrome[<div>.onClick]@...
justOpenedRef window closed (500ms elapsed)
pathname effect fired {pathname: "/teachers", isOpen: false, ...}
onCloseAutoFocus fired
```

**4th hypothesis confirmed as the real root cause:** `SheetChrome.tsx`'s own backdrop `onClick` (`role="presentation"` div, not any Radix mechanism) fires with `isBackdrop: true` and calls `onDismiss()` → `handleClose()`. Mechanism: iOS Safari's trailing synthetic click from the original tap gesture lands at the tap's original screen coordinates; during the sheet's entrance (slide-up) animation, those coordinates can still be showing the backdrop rather than the sheet's content, so `e.target === e.currentTarget` passes and the sheet dismisses itself immediately after opening.

**Fixed and committed:** removed the now-confirmed-dead `justOpenedRef` guard from `@modal/layout.tsx` (two traces showed `onPointerDownOutside`/`onInteractOutside`/`onFocusOutside` never fire — that was never the actual mechanism). Added a `justMountedRef` guard directly in `SheetChrome.tsx`'s backdrop `onClick`, cleared after `ENTER_DURATION + 50ms` (new constant in `@/lib/constants/modal`, matching the mobile sheet-enter animation's actual 300ms length) — ignores backdrop dismissal until the entrance animation has finished. Applies to all `SheetChrome` consumers (search sheet, `ContactSheet`), not just this repro path.

**Status: awaiting a 4th device trace to confirm both fixes (2.A + the backdrop guard) together resolve the bug fully** — keyboard shows and stays, sheet stays open. Debug logging is still in place (removal is a Phase 4 cleanup task) so a recurrence would still be caught.

## Superseded: Phase 3 executed, differently than originally drafted (2026-07-02)

The 4th trace showed both 2.A and the backdrop guard working (sheet stayed open, no dismiss fingerprint), but revealed the deeper issue directly: even with focus handoff succeeding at the DOM level (`match: true` in the logs), the keyboard still didn't reliably show, and was confirmed **tap-position-dependent** — taps landing above/below the old proxy `<input>`'s own (shorter than the 44px bar) box missed it entirely and hit the wrapping `<a>`, which had no navigate handler.

This, plus direct user pushback on the two-input design ("the first input on the teachers page is meaningless because we won't be using it"), led to implementing the architectural pivot — but a corrected version of the one flagged as broken above, not the original draft:

- Added `rootSheet: 'search' | 'detail' | null` to the store (fixed for the stack's lifetime, untouched by `pushModal`/`prepareBack`) — solves the `TeacherModalLink` stacking break the earlier review caught.
- `ModalLayout` renders `TeacherSearchSheetContent` directly (bypassing `{children}`/Suspense) when `rootSheet === 'search' && stackDepth === 0` — same single Dialog host, same backdrop/animation/escape-key/dismiss-guard/focus-restore machinery every sheet gets, no second parallel Dialog system. Solves the missing-backdrop/animation blockers.
- `TeacherSearchSheetContent` fetches results client-side via a new `GET /api/teachers/search-data` route, so nothing blocks the input's own mount.
- `PassiveSearchBar` no longer renders a second, throwaway `<input>`. It's a plain `<button>` that calls `flushSync(() => openSearchSheet(title))` — forcing React to synchronously commit the real search input into the DOM before the tap handler returns — then focuses that real input directly, still inside the trusted `pointerdown` gesture. `router.push` after is URL/history sync only, no longer gating the input's existence.
- `q=`/`days=` URL params, deep-linking to `/teachers/search?...`, and detail-sheet stacking (search → teacher detail → back → search) are all unaffected — confirmed by design: `TeacherSearchBar`'s existing `router.replace`-based param syncing doesn't change, the standalone fallback page for hard navigation doesn't change, and `TeacherModalLink`'s `isOpen`-based stacking logic doesn't change.
- Neutered `@modal/(...)teachers/search/page.tsx` to `return null` (still exists for Next's URL bookkeeping; the overlay owns rendering).
- Removed all `[focus-debug]` logging.

Typecheck clean, lint clean (no new errors — verified pre-existing warnings are unchanged from `HEAD`), full test suite: 312 passing, same 2 pre-existing unrelated failures as before (`contact-sheet.test.tsx`, `contact-form-on-success.test.tsx`).

**Awaiting device confirmation of this final version** — keyboard shows and stays, sheet stays open regardless of tap position, search → detail → back stacking still works, URL params still work.

### Task 2.A: Prevent Radix's default open-auto-focus from stealing focus

**Files:**
- Modify: `src/app/@modal/layout.tsx` (the `onOpenAutoFocus` handler added in Task 0.2)

**Interfaces:**
- Consumes: `SheetChrome`'s existing `autoFocusInput` effect (unchanged) — this task only stops Radix from competing with it.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Prevent default in onOpenAutoFocus so Radix doesn't move focus into the dialog container itself, leaving SheetChrome's own MutationObserver-driven focus as the only focus mover**

```typescript
          onOpenAutoFocus={(e) => {
            e.preventDefault()
          }}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Run existing unit tests**

Run: `npx vitest run tests/unit/passive-search-bar.test.tsx`
Expected: 6 passed.

- [ ] **Step 4: Commit**

```bash
git add src/app/@modal/layout.tsx
git commit -m "fix(modal): stop Radix onOpenAutoFocus from competing with SheetChrome's input focus"
```

- [ ] **Step 5: Ask user to retest on device with console still attached, confirm keyboard shows AND stays, sheet does not self-close.**

### Task 2.B: Fix the outside-dismiss guard to actually suppress the dismissal

**Files:**
- Modify: `src/app/@modal/layout.tsx`

**Interfaces:**
- Consumes: `justOpenedRef` (already exists from the prior session's edit).
- Produces: nothing new for later tasks.

- [ ] **Step 1: If the trace shows `onFocusOutside` (not `onPointerDownOutside`/`onInteractOutside`) is what's actually firing and closing the dialog, add the same guard there — this is the gap in the previous attempt, which only guarded two of the three outside-event handlers**

```typescript
          onFocusOutside={(e) => {
            if (justOpenedRef.current) e.preventDefault()
          }}
```

- [ ] **Step 2: If instead the trace shows the guard fires (`justOpened: true`) and calls `preventDefault()`, but Radix still closes the dialog — this means `onOpenChange(false)` is being triggered through a path `preventDefault()` on these events doesn't stop (check the trace for what calls `handleClose()`). Widen the guard directly at the source in `DialogPrimitive.Root`:**

```typescript
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open && justOpenedRef.current) return
        if (!open) handleClose()
      }}
    >
```

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Run existing unit tests**

Run: `npx vitest run tests/unit/passive-search-bar.test.tsx`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/@modal/layout.tsx
git commit -m "fix(modal): close the outside-dismiss guard gap that let the sheet self-close on open"
```

- [ ] **Step 6: Ask user to retest on device with console still attached, confirm keyboard shows AND stays, sheet does not self-close.**

### Task 2.C: Fix the openModal/pathname race

**Files:**
- Modify: `src/components/global/PassiveSearchBar.tsx`

**Interfaces:**
- Consumes: `useModalStore.getState()`, `router.push`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Make the store write and the navigation atomic from React's perspective by flushing the store update before router.push, using `flushSync` so there is no render tick where the pathname can change ahead of `expectingRoute` being visible**

```typescript
import { flushSync } from 'react-dom'
```

Replace the body of `navigate()`:

```typescript
  function navigate() {
    inputRef.current?.focus()
    setTriggerRef(inputRef.current)
    resetNav()
    flushSync(() => {
      const store = useModalStore.getState()
      if (store.isOpen) {
        store.pushModal(modalTitle ?? placeholder)
      } else {
        openModal(modalTitle ?? placeholder)
      }
    })
    router.push(href)
  }
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Run existing unit tests**

Run: `npx vitest run tests/unit/passive-search-bar.test.tsx`
Expected: 6 passed.

- [ ] **Step 4: Commit**

```bash
git add src/components/global/PassiveSearchBar.tsx
git commit -m "fix(global): flush modal-open state synchronously before navigating to close race with pathname effect"
```

- [ ] **Step 5: Ask user to retest on device with console still attached, confirm keyboard shows AND stays, sheet does not self-close.**

---

## Phase 3: Architectural Pivot (only if Phase 2's single-cause branch didn't fully fix it)

> **⚠️ Do NOT execute this phase as currently written.** An independent review (fresh subagent, no prior context, read every referenced file against the actual repo) found real blockers in Tasks 3.3–3.5 below:
> - **Blocker:** the `activeSheet` field is disjoint from the existing `isOpen`/`stackDepth` stacking system that `src/components/teachers/TeacherModalLink.tsx` depends on (`if (store.isOpen) pushModal(name) else openModal(name)`). As written, tapping a search result inside the new overlay would leave two independent, un-synced overlay systems mounted at once, and back-navigation from a detail sheet to the search sheet would show a blank sheet. `TeacherModalLink.tsx` isn't touched by any Phase 3 task.
> - **Blocker:** `TeacherSearchOverlay` (Task 3.3) renders `SheetChrome` directly, bypassing `@modal/layout.tsx`'s `DialogPrimitive.Overlay`/`Content` entirely — losing the dimmed backdrop, the `z-[70]` stacking context, the exit animation (`isClosing`/`EXIT_DURATION`), Escape-key-to-close, the `justOpenedRef` guard, and `handleClose`'s focus-restoration to the trigger element.
> - **Should-fix:** Task 3.4 Step 4's instructions to fix the unit test are wrong (misidentifies which test asserts `openModalMock`, and doesn't account for `router.push` gaining a second argument, which breaks `toHaveBeenCalledWith`). Task 3.4 also leaves the now-unused `openModal` store selector in `PassiveSearchBar.tsx`, and Task 3.5 leaves 7 dead imports in the neutered route — both are lint failures Task 4.1 would then catch.
>
> **A promising redesign direction** (not yet vetted, do not build without re-review): rather than a second parallel overlay/Dialog system, keep `@modal/layout.tsx` as the single Dialog host. Give the store a `rootSheet: 'search' | 'detail' | null` field set once by `openModal`/a search-opening call and left untouched by `pushModal`/`prepareBack` (so it survives the whole stack's lifetime). Inside `@modal/layout.tsx`, render a lean, no-Suspense-dependency search-content component in place of `{children}` when `rootSheet === 'search'`, otherwise render `children` via the existing `Suspense`/`ModalSkeleton` path as today — this reuses the existing backdrop, animation, escape-key, dismiss-guard, and focus-restore logic instead of duplicating it. To get a synchronous focus target for iOS, the tap handler would call `flushSync(() => store.openModal(title, 'search'))` (forcing React to synchronously commit the new DOM before `flushSync` returns) and then `document.querySelector(...)?.focus()` immediately after, still inside the same trusted `pointerdown` handler — no route navigation, no Suspense, no `setTimeout`/microtask gap. This is a hypothesis, not a plan — if Phase 3 is ever needed, redesign it properly (with fresh review) before writing code, rather than resuming Tasks 3.2–3.5 below as-is.
>
> Tasks 3.1–3.5 below are preserved only as a record of what NOT to blindly execute. **Phase 3 does not start until Phase 2 is genuinely exhausted (see the loop-back rule above) AND the user has explicitly signed off on a freshly-reviewed redesign.**

Do not start this phase without first telling the user explicitly that Phase 2 is exhausted and this is the "decouple everything from route Suspense" rewrite — get their go-ahead, per `superpowers:systematic-debugging`'s rule to discuss architecture changes rather than silently escalating.

**Behavior change to flag to the user before starting:** today, hard-loading (or refreshing on) `/teachers/search` directly renders the intercepted-route's modal shell (a sheet floating over the teachers page). After Task 3.5, a hard load renders the full standalone page at `src/app/teachers/search/page.tsx` instead (no modal chrome). This only affects direct/hard navigation — soft navigation from `/teachers` is unaffected and gets the sheet either way. Confirm this is acceptable (it likely reads as more normal for a deep link) before executing Task 3.5.

**Design:** The real search `<input>` must exist in the DOM and be reachable by `.focus()` synchronously within the same gesture that opens the sheet — no route navigation, no Suspense boundary, no RSC round trip in between, per the researched Nike/Foodspring "dummy input keep-alive" pattern. Concretely: render the search sheet as an always-mounted (but hidden-until-open) client component driven purely by Zustand state, independent of `/teachers/search`'s intercepted route. `router.push(href)` becomes a URL-sync side effect only (for shareability/back button), not the thing that mounts the sheet's input.

### Task 3.1: Remove all Phase 0 diagnostic logging

**Before starting:** check the Task 1.1 trace for whether `justOpenedRef window opened` / `onPointerDownOutside`-or-`onInteractOutside` firing with `justOpened: true` ever appeared during a failing tap. If the guard never fired in any captured trace, delete the whole `justOpenedRef`/`justOpenedTimer` mechanism in Step 2 below instead of preserving it — don't keep dead speculative code from the pre-plan session.

**Files:**
- Modify: `src/components/global/PassiveSearchBar.tsx` (remove both `console.log` lines from Task 0.1)
- Modify: `src/app/@modal/layout.tsx` (remove all `console.log` lines from Task 0.2, keep whichever `preventDefault()` logic survived from Phase 2)
- Modify: `src/components/modals/chrome/SheetChrome.tsx` (remove all `console.log` lines from Task 0.3, restore the plain `tryFocus`/immediate-focus code without logging)

- [ ] **Step 1: Strip logging from `navigate()` in PassiveSearchBar.tsx, restoring it to:**

```typescript
  function navigate() {
    inputRef.current?.focus()
    setTriggerRef(inputRef.current)
    resetNav()
    const store = useModalStore.getState()
    if (store.isOpen) {
      store.pushModal(modalTitle ?? placeholder)
    } else {
      openModal(modalTitle ?? placeholder)
    }
    router.push(href)
  }
```

- [ ] **Step 2: Strip logging from ModalLayout.tsx, restoring the pathname effect, justOpenedRef effect, and `DialogPrimitive.Content` handlers to their log-free form. Keep whichever `preventDefault()` addition Phase 2 confirmed (Task 2.A's `onOpenAutoFocus`, and/or Task 2.B's widened guard) — only the `console.log` calls are removed. The pathname effect and justOpenedRef effect have no fix logic in them regardless of branch, so restore them exactly to:**

```typescript
  useEffect(() => {
    if (!isOpen) return
    justOpenedRef.current = true
    justOpenedTimer.current = setTimeout(() => { justOpenedRef.current = false }, 500)
    return () => {
      if (justOpenedTimer.current) clearTimeout(justOpenedTimer.current)
    }
  }, [isOpen])
```

```typescript
  useEffect(() => {
    if (!isOpen) return
    if (expectingRoute) { routeArrived(); return }
    if (expectingBack) { clearBack(); return }
    if (isOpen && !isClosing) {
      close()
      dismissGuardRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
```

For `DialogPrimitive.Content`, restore to (shown with both Task 2.A's and 2.B's fixes present — drop whichever one your branch didn't use):

```typescript
        <DialogPrimitive.Content
          className="fixed inset-0 z-[70] outline-none"
          onOpenAutoFocus={(e) => { e.preventDefault() }}
          onPointerDownOutside={(e) => { if (justOpenedRef.current) e.preventDefault() }}
          onInteractOutside={(e) => { if (justOpenedRef.current) e.preventDefault() }}
          onFocusOutside={(e) => { if (justOpenedRef.current) e.preventDefault() }}
          onEscapeKeyDown={(e) => {
            const active = document.activeElement as HTMLInputElement | null
            if (active?.tagName === 'INPUT' && active.value.length > 0) {
              e.preventDefault()
              return
            }
            handleClose()
          }}
        >
```

- [ ] **Step 3: Strip logging from SheetChrome.tsx's `tryFocus`/immediate-focus block, restoring it to exactly:**

```typescript
    function tryFocus() {
      const input = contentRef.current?.querySelector<HTMLElement>('input, textarea')
      if (input) {
        observer?.disconnect()
        clearTimeout(fallbackTimer)
        input.focus()
      }
    }

    // Input may already be in the DOM (e.g., no Suspense delay)
    const immediate = contentRef.current?.querySelector<HTMLElement>('input, textarea')
    if (immediate) {
      immediate.focus()
    } else {
```

- [ ] **Step 4: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add src/components/global/PassiveSearchBar.tsx src/app/@modal/layout.tsx src/components/modals/chrome/SheetChrome.tsx
git commit -m "chore(modal): remove focus-debug diagnostic logging"
```

### Task 3.2: Expose teacher search data via a client-fetchable Route Handler

**Files:**
- Create: `src/app/api/teachers/search-data/route.ts`

**Interfaces:**
- Consumes: `fetchAllTeacherData` from `@/lib/sanity/teachers` (already used by `ModalSearchContent` and `SearchContent`).
- Produces: `GET /api/teachers/search-data` returning `{ teachers: TeacherSummary[], scheduleTeachers: TeacherWithSchedule[] }` as JSON, for `TeacherSearchOverlay` (Task 3.3) to fetch client-side.

- [ ] **Step 1: Create the Route Handler**

```typescript
import { NextResponse } from 'next/server'
import { fetchAllTeacherData } from '@/lib/sanity/teachers'

export async function GET() {
  const data = await fetchAllTeacherData()
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Manually verify the endpoint returns data**

Run: `curl -s http://localhost:3000/api/teachers/search-data | head -c 500`
Expected: JSON output starting with `{"teachers":[...`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/teachers/search-data/route.ts
git commit -m "feat(api): expose teacher search data as a client-fetchable route"
```

### Task 3.3: Build the always-mounted TeacherSearchOverlay

**Files:**
- Create: `src/components/teachers/TeacherSearchOverlay.tsx`
- Modify: `src/app/layout.tsx:98-123` (the `LayoutChrome` component, which already renders the `@modal` slot)

**Interfaces:**
- Consumes: `useModalStore` (extended in Task 3.4 with a new `activeSheet: 'search' | 'detail' | null` field), `SheetChrome`, `TeacherSearchBar`, `TeacherSortControl`, `GET /api/teachers/search-data` from Task 3.2, `ModalProvider` from `@/components/modals/ModalContext`.
- Produces: a component that renders identically to the current `TeachersSearchSheetPage` but is mounted at all times (hidden via `activeSheet !== 'search'` early-return), so the real `<input>` already exists in the DOM before any tap.

**Note:** `SheetChrome` calls `useModal()`, which throws if there's no `ModalProvider` above it in the tree. `@modal/layout.tsx` supplies one for the intercepted-route sheets, but this overlay is mounted independently, so it must supply its own.

- [ ] **Step 1: Create the overlay component, wrapping `SheetChrome` in its own `ModalProvider`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useModalStore } from '@/lib/stores/modal'
import { ModalProvider } from '@/components/modals/ModalContext'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
import { TeacherSearchBar } from '@/components/teachers/TeacherSearchBar'
import { TeacherSortControl } from '@/components/teachers/TeacherSortControl'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { SearchResultsSkeleton } from '@/components/skeletons/SearchResultsSkeleton'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'

interface SearchData {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
}

export function TeacherSearchOverlay() {
  const activeSheet = useModalStore((s) => s.activeSheet)
  const [data, setData] = useState<SearchData | null>(null)

  useEffect(() => {
    // Warm the results cache as soon as the app loads, not gated on the sheet opening —
    // the input itself never waits on this fetch.
    let cancelled = false
    fetch('/api/teachers/search-data')
      .then((res) => res.json())
      .then((json: SearchData) => { if (!cancelled) setData(json) })
    return () => { cancelled = true }
  }, [])

  if (activeSheet !== 'search') return null

  return (
    <ModalProvider
      onDismiss={() => useModalStore.getState().close()}
      onBack={() => useModalStore.getState().close()}
      isClosing={false}
      stackDepth={0}
    >
      <SheetChrome title="Search Teachers" padded={false} autoFocusInput>
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <div className="flex-1">
            <TeacherSearchBar />
          </div>
          <TeacherSortControl />
        </div>
        <div className="px-4 pb-16">
          {data ? (
            <TeacherSearchClient teachers={data.teachers} scheduleTeachers={data.scheduleTeachers} />
          ) : (
            <SearchResultsSkeleton />
          )}
        </div>
      </SheetChrome>
    </ModalProvider>
  )
}
```

- [ ] **Step 2: Mount it once inside `LayoutChrome`, alongside the existing modal slot (`src/app/layout.tsx:120`)**

```typescript
import { TeacherSearchOverlay } from '@/components/teachers/TeacherSearchOverlay'

// ...inside LayoutChrome's returned JSX, replacing this line:
      {modal ? <div key="modal">{modal}</div> : null}
// with:
      {modal ? <div key="modal">{modal}</div> : null}
      <TeacherSearchOverlay />
```

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add src/components/teachers/TeacherSearchOverlay.tsx src/app/layout.tsx
git commit -m "feat(teachers): add always-mounted search overlay decoupled from route Suspense"
```

### Task 3.4: Add activeSheet to the modal store and wire PassiveSearchBar to open the overlay synchronously

**Files:**
- Modify: `src/lib/stores/modal.ts`
- Modify: `src/components/global/PassiveSearchBar.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `useModalStore.activeSheet: 'search' | 'detail' | null` and `openSearchSheet()` — used by `PassiveSearchBar` (this task) and read by `TeacherSearchOverlay` (Task 3.3).

- [ ] **Step 1: Add `activeSheet` state and an `openSearchSheet` action to the store**

Add to the `ModalStore` interface in `src/lib/stores/modal.ts`:

```typescript
  activeSheet: 'search' | 'detail' | null
  openSearchSheet: () => void
```

Add to the store implementation:

```typescript
  activeSheet: null,
  openSearchSheet: () => set({ activeSheet: 'search' }),
```

Add `activeSheet: null` to the `close: () => set({...})` implementation's returned object so closing any sheet also clears it:

```typescript
  close: () => set({
    isOpen: false,
    expectingRoute: false,
    expectingBack: false,
    isClosing: false,
    title: null,
    triggerRef: null,
    stackDepth: 0,
    activeSheet: null,
  }),
```

- [ ] **Step 2: Wire PassiveSearchBar to open the overlay synchronously in the same gesture, before navigating**

Replace `navigate()`:

```typescript
  function navigate() {
    inputRef.current?.focus()
    setTriggerRef(inputRef.current)
    resetNav()
    useModalStore.getState().openSearchSheet()
    // URL sync only — TeacherSearchOverlay is already open and focused by this point,
    // this is purely for shareability/back-button support, not the mount trigger.
    router.push(href, { scroll: false })
  }
```

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Run existing unit tests, update mocks for the new store shape**

The mock in `tests/unit/passive-search-bar.test.tsx` mocks `@/lib/stores/modal` with `openModal`/`pushModal`/`isOpen` — add `openSearchSheet: openSearchSheetMock` to the hoisted mocks and the mocked `state` object, and update the last test to assert `openSearchSheetMock` was called instead of `openModalMock`.

Run: `npx vitest run tests/unit/passive-search-bar.test.tsx`
Expected: passes once the mock is updated.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/modal.ts src/components/global/PassiveSearchBar.tsx tests/unit/passive-search-bar.test.tsx
git commit -m "feat(global): open the search overlay synchronously in the same gesture as the tap"
```

### Task 3.5: Prevent the old intercepted-route sheet from double-rendering the search sheet

**Files:**
- Modify: `src/app/@modal/(...)teachers/search/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this task neutralizes the old route so `TeacherSearchOverlay` is the only thing rendering the search sheet, while direct/hard navigation to `/teachers/search` still works via the existing full-page fallback at `src/app/teachers/search/page.tsx` (interception only affects soft/client-side navigation).

- [ ] **Step 1: Replace the intercepted route's content with a no-op — `TeacherSearchOverlay` (already mounted at root, opened via `openSearchSheet()`) now owns rendering the sheet for client-side navigations. This route still exists so Next.js's URL/back-button bookkeeping for `/teachers/search` keeps working, but it must render nothing since the overlay already handles the visible sheet.**

```typescript
export default function TeachersSearchSheetPage() {
  return null
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add "src/app/@modal/(...)teachers/search/page.tsx"
git commit -m "refactor(modal): stop the intercepted search route from rendering its own sheet"
```

- [ ] **Step 4: Ask user to retest on device: tap search, confirm keyboard shows immediately and stays, sheet stays open, results eventually populate. Also test hard-refreshing directly on `/teachers/search` (should still render the full non-modal page from the existing fallback) and the browser/native back button (should close the overlay and return to `/teachers`).**

---

## Phase 4: Final Verification and Cleanup

### Task 4.1: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors (existing warnings, if any pre-date this work, are acceptable — do not introduce new ones).

- [ ] **Step 3: Full unit test suite**

Run: `npx vitest run`
Expected: all pass except the 2 pre-existing unrelated failures already noted in memory (`contact-sheet.test.tsx`, `contact-form-on-success.test.tsx`) — confirm no new failures.

- [ ] **Step 4: Device retest of the full golden path**

Ask user to confirm on real iPhone: tap search bar → keyboard shows and stays → type a query → results filter → tap a result → teacher detail sheet opens correctly → back button returns to search sheet with query intact → close returns to `/teachers`.

- [ ] **Step 5: Only after Step 4 is confirmed by the user, update memory file `project-search-sheet-focus-ios.md` marking this resolved, and prepare for final commit/PR per `superpowers:finishing-a-development-branch`.**
