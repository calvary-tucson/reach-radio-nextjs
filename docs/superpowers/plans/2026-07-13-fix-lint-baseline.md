# Fix Pre-Existing Lint Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear all 28 pre-existing `npm run lint` errors and 10 warnings across the project so the `~/.claude/hooks/quality-pipeline.sh` Gate 1 pre-commit hook stops blocking commits, without changing any observable behavior.

**Architecture:** Two phases. Phase 1 fixes 20 zero-runtime-risk errors + all 10 warnings — mechanical edits in test files and one content page, verified by lint + existing tests only. Phase 2 fixes 8 errors in 6 production components where React's newer compiler-oriented rules (`react-hooks/purity`, `react-hooks/refs`, `react-hooks/set-state-in-effect`) flag real behavioral patterns — each fix is verified live in a browser, not just by a green test run, per two of these being genuinely tricky (RadioPlayer's image-fallback state, TeacherSearchBar's debounced search).

**Tech Stack:** Next.js 16 / React 19, TypeScript strict, Vitest, ESLint (`eslint-config-next` + React Compiler-era hooks rules), Playwright (via `mcp__plugin_playwright_playwright__*` tools — the project's Chromium isn't installed locally and the Chrome extension wasn't connected in the last session; use whichever is available).

## Global Constraints

- All 28 errors are 100% pre-existing and unrelated to any other in-flight work — confirmed via `git diff`/`git stash` against every touched file before this plan was written. Do not expand scope to files not listed below.
- **Critical ordering constraint:** `quality-pipeline.sh` runs `npm run lint` over the **entire project** (not staged files) on any `git commit` that stages a `.ts`/`.tsx` file, and blocks if the total error count is `> 0`. This means **no commit can succeed until every error below is fixed in the working tree** — Phase 1 and Phase 2 must both complete before Task 15 (first commit attempt). Partial completion (e.g., Phase 1 only) does not unblock anything; the gate still sees the Phase 2 errors and blocks.
- Never use `git commit --no-pipeline` as a substitute for fixing errors — it exists in the hook as a documented, logged escape hatch for other situations, not as this plan's exit path.
- Match this repo's existing conventions: canonical commit scopes from `AGENTS.md`, and the existing precedent of scoped `eslint-disable-next-line <rule> -- <reason>` comments (see `BridgeInit.tsx`'s current exhaustive-deps disable) for the one case (ThemeProvider) where a real refactor would risk a regression.
- Every task's "run lint" step targets the specific file(s) that task touched (fast feedback); Task 14 is the one whole-project lint run that must show zero errors before any commit happens.
- **The working tree already has unrelated, uncommitted work in it** (a prior session's native-bridge media-bar visibility fix), and three files this plan touches are the *same* files that work already modified: `BridgeInit.tsx`, `ContactSheet.tsx`, `ContactForm.tsx`. Since patch-level (`git add -p`) staging is off the table, those three files' commits in Task 15 necessarily cover both bodies of work — write commit messages that say so. Six more files from that prior session (`globals.css`, `SleepTimerSheet.tsx`, `ScheduleTabView.tsx`, `tests/unit/sleep-timer-sheet.test.tsx`, `src/lib/hooks/useHideMediaBarWhileOpen.ts`, and four new test files) aren't touched by this plan at all but still need their own commits in Task 15 — otherwise they're silently left orphaned and uncommitted. `.gitignore`, `doppler.yaml`, and two scratch screenshot PNGs at the repo root are pre-existing/unrelated to both bodies of work and must NOT be committed by this plan.

---

## Phase 1 — Mechanical fixes (zero runtime risk)

### Task 1: Escape unescaped quote entities in the privacy policy page

**Files:**
- Modify: `src/app/about/privacy-policy/page.tsx:32,41,73,142`

**Interfaces:** None — pure JSX text content change, renders visually identical (curly/straight quote glyphs are unaffected; `&quot;` renders as `"`).

- [ ] **Step 1: Replace the four unescaped-quote lines**

In `src/app/about/privacy-policy/page.tsx`, line 32:
```diff
-          Calvary Chapel of Tucson, Inc. ("we," "us," or "our") operates the Reach Radio website (
+          Calvary Chapel of Tucson, Inc. (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the Reach Radio website (
```

Line 41:
```diff
-          (collectively, the "Service"). This Privacy Policy describes how we collect, use, and protect
+          (collectively, the &quot;Service&quot;). This Privacy Policy describes how we collect, use, and protect
```

Line 73:
```diff
-          our streaming service in order to display "now playing" information. This metadata is not stored
+          our streaming service in order to display &quot;now playing&quot; information. This metadata is not stored
```

Line 142:
```diff
-          revised policy on this page with an updated "Last updated" date. Your continued use of the Service
+          revised policy on this page with an updated &quot;Last updated&quot; date. Your continued use of the Service
```

- [ ] **Step 2: Run lint on this file**

Run: `npx eslint src/app/about/privacy-policy/page.tsx`
Expected: no output (0 problems)

- [ ] **Step 3: Commit deferred**

Do not commit yet — see Task 15. Move to Task 2.

---

### Task 2: Remove `any` casts in post-message.test.ts

**Files:**
- Modify: `tests/unit/post-message.test.ts`

**Interfaces:** `window.Android` and `window.webkit` are already typed as optional properties on the global `Window` interface in `src/lib/bridge/post-message.ts:1-8` (`Android?: { postMessage: (msg: string) => void }`, `webkit?: { messageHandlers: { messageHandler: { postMessage: (msg: string) => void } } }`) — no cast is needed at all.

- [ ] **Step 1: Remove every `as any` cast**

Replace the full file content of `tests/unit/post-message.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { postMessageToNative } from '@/lib/bridge/post-message'

describe('postMessageToNative', () => {
  beforeEach(() => {
    delete window.Android
    delete window.webkit
  })

  it('calls Android.postMessage when Android interface present', () => {
    const mockPostMessage = vi.fn()
    window.Android = { postMessage: mockPostMessage }
    postMessageToNative({ isPlaying: true })
    expect(mockPostMessage).toHaveBeenCalledWith('{"protocolVersion":1,"isPlaying":true}')
  })

  it('calls webkit.messageHandlers.messageHandler.postMessage when on iOS', () => {
    const mockPostMessage = vi.fn()
    window.webkit = {
      messageHandlers: { messageHandler: { postMessage: mockPostMessage } },
    }
    postMessageToNative({ isPlaying: true })
    expect(mockPostMessage).toHaveBeenCalledWith('{"protocolVersion":1,"isPlaying":true}')
  })

  it('does nothing when no native interface present', () => {
    expect(() => postMessageToNative({ isPlaying: true })).not.toThrow()
  })

  it('wraps messages with protocolVersion: 1', () => {
    const mockPostMessage = vi.fn()
    window.Android = { postMessage: mockPostMessage }
    postMessageToNative({ loaded: true })
    expect(mockPostMessage).toHaveBeenCalledWith('{"protocolVersion":1,"loaded":true}')
  })

  it('uses webkit when Android is not present', () => {
    const mockPostMessage = vi.fn()
    window.webkit = {
      messageHandlers: { messageHandler: { postMessage: mockPostMessage } },
    }
    postMessageToNative({ location: '/teachers' })
    expect(mockPostMessage).toHaveBeenCalledWith('{"protocolVersion":1,"location":"/teachers"}')
  })
})
```

- [ ] **Step 2: Run the test and lint**

Run: `npx vitest run tests/unit/post-message.test.ts && npx eslint tests/unit/post-message.test.ts`
Expected: all 5 tests pass; 0 lint problems

---

### Task 3: Use `next/link` instead of a raw `<a>` in button.test.tsx

**Files:**
- Modify: `tests/unit/button.test.tsx`

**Interfaces:** None — `Link` renders an `<a>` under the hood, so `getByRole('link', ...)` assertions are unaffected.

- [ ] **Step 1: Add the import and swap the element**

```diff
 import { describe, it, expect } from 'vitest'
 import { render, screen } from '@testing-library/react'
+import Link from 'next/link'
 import { Button } from '@/components/ui/button'
```

```diff
   it('renders as child element with asChild', () => {
     render(
       <Button asChild>
-        <a href="/test">Link</a>
+        <Link href="/test">Link</Link>
       </Button>
     )
     expect(screen.getByRole('link', { name: 'Link' })).toBeInTheDocument()
     expect(screen.queryByRole('button')).not.toBeInTheDocument()
   })
```

- [ ] **Step 2: Run the test and lint**

Run: `npx vitest run tests/unit/button.test.tsx && npx eslint tests/unit/button.test.tsx`
Expected: all 5 tests pass; 0 lint problems

**Fallback if `next/link` throws without a router context in bare jsdom:** revert the `<Link>` swap, keep the raw `<a>`, and instead add a justified disable matching Task 7's pattern: `// eslint-disable-next-line @next/next/no-html-link-for-pages -- testing Button's asChild composition with an arbitrary child element, not real page navigation`. Re-run this step's commands to confirm 0 problems either way.

---

### Task 4: Fix sheet-chrome.test.tsx (hoist inline component + drop unused import)

**Files:**
- Modify: `tests/unit/sheet-chrome.test.tsx`

**Interfaces:** `DelayedInput` takes no props and closes over nothing from `WrapperWithDelayedInput` — safe to hoist to module scope unchanged.

- [ ] **Step 1: Remove the unused `MODAL_ENTER_ANIMATION` import**

```diff
 import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
 import { ModalProvider } from '@/components/modals/ModalContext'
-import { MODAL_ENTER_ANIMATION } from '@/lib/constants/modal'
```

- [ ] **Step 2: Hoist `DelayedInput` out of `WrapperWithDelayedInput`**

```diff
-// Wrapper where input appears 50ms after mount (simulates Suspense resolving)
-function WrapperWithDelayedInput({ onDismiss = vi.fn() } = {}) {
-  function DelayedInput() {
-    const [show, setShow] = useState(false)
-    useEffect(() => {
-      const id = setTimeout(() => setShow(true), 50)
-      return () => clearTimeout(id)
-    }, [])
-    return show ? <input type="text" aria-label="Delayed input" /> : null
-  }
+function DelayedInput() {
+  const [show, setShow] = useState(false)
+  useEffect(() => {
+    const id = setTimeout(() => setShow(true), 50)
+    return () => clearTimeout(id)
+  }, [])
+  return show ? <input type="text" aria-label="Delayed input" /> : null
+}
+
+// Wrapper where input appears 50ms after mount (simulates Suspense resolving)
+function WrapperWithDelayedInput({ onDismiss = vi.fn() } = {}) {
   return (
     <ModalProvider onDismiss={onDismiss} onBack={vi.fn()} isClosing={false} stackDepth={0}>
       <SheetChrome title="Test Sheet" autoFocusInput>
         <DelayedInput />
       </SheetChrome>
     </ModalProvider>
   )
 }
```

- [ ] **Step 3: Run the test and lint**

Run: `npx vitest run tests/unit/sheet-chrome.test.tsx && npx eslint tests/unit/sheet-chrome.test.tsx`
Expected: all 6 tests pass; 0 lint problems

---

### Task 5: Remove dead `eslint-disable` directives (3 files)

**Files:**
- Modify: `src/app/@modal/layout.tsx:34`
- Modify: `src/app/teachers/[slug]/opengraph-image.tsx:69`
- Modify: `src/components/bridge/BridgeInit.tsx:64,140`

**Interfaces:** None.

- [ ] **Step 1: Remove the unused directive in `@modal/layout.tsx`**

```diff
   return (
-    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
     <div
       className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center"
       onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
     >
```

- [ ] **Step 2: Remove the unused directive in `opengraph-image.tsx`**

```diff
         {photoUrl && (
-          // eslint-disable-next-line @next/next/no-img-element
           <img
             src={photoUrl}
             alt=""
             style={{ width: 630, height: 630, objectFit: 'cover', flexShrink: 0 }}
           />
         )}
```

- [ ] **Step 3: Move BridgeInit.tsx's exhaustive-deps disable to the line ESLint actually flags**

The `eslint-disable-next-line` above the `useEffect(() => {` opening (line 65) only suppresses a warning reported *on that line*; ESLint attributes this particular warning to the closing `}, [])` 75 lines below (line 140), so the directive above is dead and the real warning is unsuppressed. Move it to a same-line `eslint-disable-line` on the dependency array itself:

```diff
   // Native bridge: receive commands from iOS/Android via CustomEvent
   // Fix: gate on isNativeBridgePresent() (both platforms) not window.inNativeApp (iOS only)
-  // eslint-disable-next-line react-hooks/exhaustive-deps -- bridge must initialize exactly once; router is stable and adding it causes re-runs on every navigation; streamUrl intentionally excluded — treated as mount-time constant; native receives it once via the loaded handshake
   useEffect(() => {
     if (!isNativeBridgePresent()) return
```

...then find the effect's closing line (`  }, [])` — it's the one immediately followed by the `// native 'refresh' command completion` comment — and change it to:

```diff
-  }, [])
+  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- bridge must initialize exactly once; router is stable and adding it causes re-runs on every navigation; streamUrl intentionally excluded — treated as mount-time constant; native receives it once via the loaded handshake
```

- [ ] **Step 4: Run lint on all three files**

Run: `npx eslint src/app/@modal/layout.tsx src/app/teachers/[slug]/opengraph-image.tsx src/components/bridge/BridgeInit.tsx`
Expected: 0 problems

- [ ] **Step 5: Run BridgeInit's existing test suite (behavior must be unchanged — this task only moves a comment)**

Run: `npx vitest run tests/unit/bridge-init-sheet-focus-race.test.tsx tests/unit/bridge-init-modal-bars.test.tsx tests/unit/bridge-sleep-timer.test.tsx tests/unit/bridge-init-metadata-forward.test.tsx`
Expected: all pass

---

### Task 6: Remove unused identifiers (4 files)

**Files:**
- Modify: `src/components/teachers/ScheduleCardList.tsx:33`
- Modify: `tests/unit/filter-teachers.test.ts:4`
- Modify: `tests/unit/sanity-queries.test.ts:2`
- Modify: `tests/unit/theme-provider.test.tsx:51`

**Interfaces:** None — this project's ESLint config has no `argsIgnorePattern`/`varsIgnorePattern` override (confirmed in `eslint.config.mjs`), so underscore-prefixing does **not** silence these; each unused identifier must be dropped outright.

- [ ] **Step 1: Drop the unused loop index in ScheduleCardList.tsx**

```diff
-      {slots.map((slot, i) => {
+      {slots.map((slot) => {
```

- [ ] **Step 2: Drop the unused `SortOption` import in filter-teachers.test.ts**

```diff
 import { filterTeachers } from '@/lib/teachers/filter'
 import type { TeacherSummary, ScheduleDay } from '@/lib/sanity/types'
-import type { SortOption } from '@/lib/teachers/filter'
```

- [ ] **Step 3: Drop the unused `fullScheduleQuery` import in sanity-queries.test.ts**

```diff
-import { teacherListQuery, teacherDetailQuery, scheduleQuery, fullScheduleQuery } from '@/lib/sanity/queries'
+import { teacherListQuery, teacherDetailQuery, scheduleQuery } from '@/lib/sanity/queries'
```

- [ ] **Step 4: Drop the unused `q` param in theme-provider.test.tsx's matchMedia stub**

```diff
-    vi.stubGlobal('matchMedia', (q: string) => ({
+    vi.stubGlobal('matchMedia', () => ({
       matches: false, // prefers-color-scheme: light
       addEventListener: vi.fn(),
       removeEventListener: vi.fn(),
     }))
```

- [ ] **Step 5: Run lint + affected tests**

Run: `npx eslint src/components/teachers/ScheduleCardList.tsx tests/unit/filter-teachers.test.ts tests/unit/sanity-queries.test.ts tests/unit/theme-provider.test.tsx`
Expected: 0 problems

Run: `npx vitest run tests/unit/filter-teachers.test.ts tests/unit/sanity-queries.test.ts tests/unit/theme-provider.test.tsx tests/unit/schedule-slots.test.ts tests/unit/schedule-card-list.test.tsx`
Expected: all pass

---

### Task 7: Justify the `<img>` warning in teacher-search-client.test.tsx

**Files:**
- Modify: `tests/unit/teacher-search-client.test.tsx:14`

**Interfaces:** None. This is a `vi.mock('next/image', ...)` test double, not production code — `next/image`'s real optimization pipeline doesn't run in jsdom, so a plain `<img>` stand-in is the correct, deliberate choice, not an oversight (mirrors the same reasoning already used for the now-fixed `opengraph-image.tsx` disable in Task 5, which is a genuine Next.js OG-image-generation context where `<Image>` cannot be used).

- [ ] **Step 1: Add a scoped, justified disable**

```diff
 vi.mock('next/image', () => ({
+  // eslint-disable-next-line @next/next/no-img-element -- test double for next/image; jsdom has no image-optimization pipeline to exercise
   default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
 }))
```

- [ ] **Step 2: Run lint + the test**

Run: `npx eslint tests/unit/teacher-search-client.test.tsx && npx vitest run tests/unit/teacher-search-client.test.tsx`
Expected: 0 lint problems; all tests pass

---

## Phase 2 — Production behavioral fixes (verify live, not just green tests)

### Task 8: ContactForm.tsx — replace impure ref init with a lazy state initializer

**Files:**
- Modify: `src/components/about/ContactForm.tsx:3,19,75`

**Interfaces:** None external — `timestamp` replaces `timestampRef.current` as the hidden field's value, same string content (`Date.now().toString()`), same one-time-per-mount semantics.

**Why this fix, not a disable:** `useRef(Date.now().toString())` calls an impure function directly in the render body (flagged by `react-hooks/purity`), *and* separately reads `.current` during render in the JSX (`react-hooks/refs`) — two errors from one root cause. `useState(() => Date.now().toString())`'s lazy initializer is React's own sanctioned escape hatch for "compute an impure value exactly once, at mount" (this is the documented pattern in the very rule React links to), and a plain state value read in JSX has no `refs` violation at all. This isn't a workaround; it's the correct hook for this job — `useRef` was never right here since the value doesn't need to skip re-renders, it needs to exist as data.

- [ ] **Step 1: Add `useState` to the react import**

```diff
-import { startTransition, useActionState, useEffect, useRef } from 'react'
+import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
```

(`useRef` stays — still used by `formRef` and `prevStateRef`.)

- [ ] **Step 2: Replace the ref with lazy state**

```diff
   const [state, formAction, isPending] = useActionState(submitContact, initial)
   const formRef = useRef<HTMLFormElement>(null)
-  const timestampRef = useRef(Date.now().toString())
+  const [timestamp] = useState(() => Date.now().toString())
   const prevStateRef = useRef(state)
```

- [ ] **Step 3: Use the state value in JSX instead of the ref**

```diff
-      <input type="hidden" name="timestamp" value={timestampRef.current} />
+      <input type="hidden" name="timestamp" value={timestamp} />
```

- [ ] **Step 4: Run lint**

Run: `npx eslint src/components/about/ContactForm.tsx`
Expected: 0 problems

**Fallback if the lazy `useState` initializer doesn't clear `react-hooks/purity`:** the timestamp is only ever read at submit time (inside `handleSubmit`, via `formData`/the hidden input), not needed during earlier renders — compute it directly in `handleSubmit` instead (`formData.set('timestamp', Date.now().toString())` right before `startTransition(() => formAction(formData))`), drop the hidden input and the state/ref entirely, and update `src/actions/contact.ts`'s spam-protection check if it reads `formData.get('timestamp')` (it should, unchanged). If that's also undesirable, fall back to a justified `eslint-disable-next-line react-hooks/purity` on the `useState` line with a one-line reason.

- [ ] **Step 5: Run existing ContactForm tests**

Run: `npx vitest run tests/unit/contact-form-on-success.test.tsx tests/unit/contact-form-pending-spinner.test.tsx tests/unit/action-contact.test.ts tests/unit/spam-protection.test.ts`
Expected: all pass (the two pre-existing failures in `contact-form-on-success.test.tsx` — confirmed unrelated in the prior session — may still be present; do not attempt to fix them here, that's out of this plan's scope)

- [ ] **Step 6: Browser-verify the honeypot/anti-spam timestamp still submits correctly**

The `timestamp` hidden field feeds `src/actions/contact.ts`'s spam-protection check (a submission faster than some minimum elapsed time is treated as a bot). Confirm the field still renders with a numeric string value and the form still submits successfully:

Start the dev server if not already running: `npm run dev > /tmp/reach-radio-dev.log 2>&1 &` then wait for `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` to return `200`.

Using the Playwright MCP tools (`mcp__plugin_playwright_playwright__*`) or Chrome extension tools:
1. Navigate to `http://localhost:3000/about`
2. Evaluate: `() => document.querySelector('input[name="timestamp"]')?.value` — expect a numeric string (epoch ms), not empty/undefined
3. Fill the Name/Email/Message fields and the consent checkbox, click "Send Message"
4. Confirm no client-side error and the form either succeeds or shows the expected reCAPTCHA/Formspree-related message (not a spam-rejection due to a malformed timestamp)

Stop the dev server after: `pkill -f "next dev"`

---

### Task 9: ContactSheet.tsx — replace the mount-flag effect with `useSyncExternalStore`

**Files:**
- Modify: `src/components/about/ContactSheet.tsx:4,17,23`

**Interfaces:** `mounted` keeps the exact same meaning and timing (`false` during SSR and the first client render before hydration settles, `true` immediately after) — this is the same one-frame "false then true" behavior the current `useState + useEffect` already produces, just without an explicit `setState` call inside an effect body.

**Why this fix, not a disable:** the effect body is *only* `setMounted(true)` — no other synchronization work happens there, so there's no side-effect to preserve by keeping an effect (unlike Task 13's ThemeProvider). `useSyncExternalStore` with a no-op subscribe and `getServerSnapshot: false` / `getSnapshot: true` is React's documented mechanism for exactly this "was this rendered on the client yet" signal.

Note: this is deliberately **not** extracted into a shared hook — `BottomSheet.tsx` and `RouteAnnouncer.tsx` have the identical `useEffect(() => setMounted(true), [])` pattern but are not currently flagged by lint (confirmed via `npx eslint` directly on both files — zero output). Touching them is out of scope for this plan; only fix what's actually erroring.

- [ ] **Step 1: Add `useSyncExternalStore` to the react import; drop `useState`'s use here (keep it — still used for `isClosing`)**

```diff
-import { useCallback, useEffect, useRef, useState } from 'react'
+import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
```

- [ ] **Step 2: Replace the mounted state + effect**

```diff
 export function ContactSheet({ open, onClose }: ContactSheetProps) {
-  const [mounted, setMounted] = useState(false)
+  const mounted = useSyncExternalStore(
+    () => () => {},
+    () => true,
+    () => false
+  )
   const [isClosing, setIsClosing] = useState(false)
   const triggerRef = useRef<HTMLElement | null>(null)
   const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
   const dialogRef = useRef<HTMLDivElement>(null)
 
-  useEffect(() => setMounted(true), [])
-
   useEffect(() => () => {
     if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
   }, [])
```

- [ ] **Step 3: Run lint**

Run: `npx eslint src/components/about/ContactSheet.tsx`
Expected: 0 problems

- [ ] **Step 4: Run existing ContactSheet tests + this session's focus-race regression test**

Run: `npx vitest run tests/unit/contact-sheet.test.tsx tests/unit/bridge-init-sheet-focus-race.test.tsx`
Expected: all pass except the one pre-existing, already-confirmed-unrelated `renders dialog when open` failure in `contact-sheet.test.tsx`

- [ ] **Step 5: Browser-verify ContactSheet still portals/renders correctly**

Using Playwright MCP tools: navigate to `http://localhost:3000/about`, click the header "Contact" button, confirm the dialog renders (it's built via `createPortal`, which is exactly what `mounted` gates) and the Name/Email/Message fields are visible and focusable.

---

### Task 10: Shared `useIsNativeApp()` hook — BackButton.tsx + VolumeControl.tsx

**Files:**
- Create: `src/lib/hooks/useIsNativeApp.ts`
- Modify: `src/components/global/BackButton.tsx`
- Modify: `src/components/home/VolumeControl.tsx`

**Interfaces:**
- Produces: `useIsNativeApp(): boolean` — `false` during SSR/first paint, `true` if `document.documentElement.classList.contains('native-app')` on the client. Both consumers currently derive this identically via `useState(false)` + a mount-only effect; this hook reproduces the exact same "false, then settles to the real value after mount" timing.

**Why a shared hook, not two inline fixes:** unlike Task 9 (single consumer), this exact check is duplicated byte-for-byte in two files — extracting it is DRY, not speculative infrastructure.

- [ ] **Step 1: Create the hook**

```typescript
// src/lib/hooks/useIsNativeApp.ts
'use client'

import { useSyncExternalStore } from 'react'

function subscribe() {
  return () => {}
}

function getSnapshot() {
  return document.documentElement.classList.contains('native-app')
}

function getServerSnapshot() {
  return false
}

export function useIsNativeApp() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
```

- [ ] **Step 2: Apply it in BackButton.tsx**

```diff
 'use client'
 
-import { useState, useEffect } from 'react'
 import { useRouter } from 'next/navigation'
 import { cn } from '@/lib/utils'
+import { useIsNativeApp } from '@/lib/hooks/useIsNativeApp'
```

```diff
 export function BackButton({ variant, className }: BackButtonProps) {
   const router = useRouter()
-  const [isApp, setIsApp] = useState(false)
-
-  useEffect(() => {
-    setIsApp(document.documentElement.classList.contains('native-app'))
-  }, [])
+  const isApp = useIsNativeApp()
```

- [ ] **Step 3: Apply it in VolumeControl.tsx**

```diff
 'use client'
 
-import { useState, useEffect } from 'react'
 import { Volume, Volume1, Volume2, VolumeX } from 'lucide-react'
 import { useShallow } from 'zustand/react/shallow'
 import { useMediaStore } from '@/lib/store/media-store'
 import { Slider } from '@/components/ui/slider'
 import { cn } from '@/lib/utils'
+import { useIsNativeApp } from '@/lib/hooks/useIsNativeApp'
```

```diff
   const [isNative, setIsNative] = useState(false)
-
-  useEffect(() => {
-    setIsNative(document.documentElement.classList.contains('native-app'))
-  }, [])
+  const isNative = useIsNativeApp()
```

(Note: the diff above shows the state declaration line being replaced — make sure the final file has exactly one `const isNative = useIsNativeApp()` line and no leftover `useState`/`useEffect` import.)

- [ ] **Step 4: Run lint**

Run: `npx eslint src/lib/hooks/useIsNativeApp.ts src/components/global/BackButton.tsx src/components/home/VolumeControl.tsx`
Expected: 0 problems

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Browser-verify both consumers**

Using Playwright MCP tools:
1. Navigate to `http://localhost:3000/teachers/alistair-begg` (a teacher detail panel, where `BackButton` renders) — confirm the back button appears and its click still calls `router.back()` (navigating back to `/teachers`)
2. Navigate to `http://localhost:3000/` at a desktop viewport (≥768px) — confirm `VolumeControl` renders and the slider still controls volume (drag it, or use arrow keys after focusing, and confirm the audio element's volume changes)

---

### Task 11: RadioPlayer.tsx — adjust `imgSrc` during render instead of in an effect

**Files:**
- Modify: `src/components/home/RadioPlayer.tsx:26,28-30`

**Interfaces:** `imgSrc` keeps its exact current behavior: defaults to `image || FALLBACK_OG_IMAGE`, resets to that whenever the store's `image` value changes, and can still be independently overridden to `FALLBACK_OG_IMAGE` by the `<Image onError>` handler (unchanged, that's a plain event handler, never touched by this rule).

**Why this fix, not a disable:** this is textbook "adjust state when a prop changes" — React's own documented alternative to a sync-effect (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes). `image` is a plain string from the store, so a direct `!==` comparison is safe (no object-identity risk).

- [ ] **Step 1: Replace the effect with a render-time adjustment**

```diff
   const containerRef = useRef<HTMLDivElement>(null)
   const togglePlay = useTogglePlay()
+  const [prevImage, setPrevImage] = useState(image)
   const [imgSrc, setImgSrc] = useState(image || FALLBACK_OG_IMAGE)
 
-  useEffect(() => {
-    setImgSrc(image || FALLBACK_OG_IMAGE)
-  }, [image])
+  // Adjust imgSrc during render when the store's image changes, instead of
+  // in an effect -- keeps this in sync with `image` while still letting
+  // onError below independently override it to the fallback.
+  if (image !== prevImage) {
+    setPrevImage(image)
+    setImgSrc(image || FALLBACK_OG_IMAGE)
+  }
```

- [ ] **Step 2: Run lint**

Run: `npx eslint src/components/home/RadioPlayer.tsx`
Expected: 0 problems

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Browser-verify the image still updates on track change AND the error fallback still works**

This is the one that most needs live verification — a green test/lint run does not prove the two-mutation-source interaction (store update vs. onError) still behaves correctly.

Using Playwright MCP tools:
1. Navigate to `http://localhost:3000/`
2. Evaluate: `() => document.querySelector('img[alt=""]')?.getAttribute('src')` — note the current image src
3. Evaluate to simulate a track change (mirrors what `BridgeInit`'s `setNowPlaying` flow does): `() => { window.__zustand_media_store__?.getState().setNowPlaying('Test Show', 'Test Artist', null, '/some-other-image.jpg') }` — if there's no global store handle exposed, instead trigger it via the app's own now-playing SSE by waiting ~10s and re-checking the img src changes naturally, OR inspect `src/lib/store/media-store.ts` for how to reach `setNowPlaying` from the console (e.g. it may already be attached to `window` for debugging; check first with `() => typeof window.useMediaStore`)
4. Confirm the `<img>` src updates to reflect the new image
5. Evaluate to simulate an image load failure and confirm fallback: `() => { const img = document.querySelector('img[alt=""]'); img.dispatchEvent(new Event('error')) }`, then re-check the src equals `FALLBACK_OG_IMAGE`'s value (check `src/lib/constants.ts` for the exact fallback path/URL to assert against)

If the store isn't reachable from the console, it's acceptable to instead read `src/lib/hooks/use-toggle-play.ts` and `media-store.ts` to identify a real user action (e.g. waiting for the next scheduled show) that changes `image` naturally, and observe the `<img>` src update via a screenshot before/after.

---

### Task 12: TeacherSearchBar.tsx — adjust `displayValue` during render instead of in an effect

**Files:**
- Modify: `src/components/teachers/TeacherSearchBar.tsx:13-17`

**Interfaces:** `displayValue` keeps its current behavior: initialized from and re-synced to the URL's `?q=` param, while still diverging locally while the user types (debounced 300ms before `router.replace` updates the URL).

**Why value comparison, not object-identity comparison:** comparing `searchParams !== prevSearchParams` (object identity) risks resetting `displayValue` on every keystroke if `useSearchParams()` ever returns a new object reference on a render the URL didn't actually change (e.g. triggered by this component's own `setDisplayValue` while typing) — that would silently break the debounce. Comparing the derived string `searchParams.get('q') ?? ''` sidesteps that risk entirely: it only changes when the actual URL query changes, which happens only after `router.replace` resolves.

- [ ] **Step 1: Replace the effect with a render-time adjustment keyed on the derived query string**

```diff
   const inputRef = useRef<HTMLInputElement>(null)
   const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
-  const [displayValue, setDisplayValue] = useState(searchParams.get('q') ?? '')
-
-  useEffect(() => {
-    setDisplayValue(searchParams.get('q') ?? '')
-  }, [searchParams])
+  const currentQuery = searchParams.get('q') ?? ''
+  const [lastSyncedQuery, setLastSyncedQuery] = useState(currentQuery)
+  const [displayValue, setDisplayValue] = useState(currentQuery)
+
+  // Adjust displayValue during render when the URL's ?q= actually changes
+  // (e.g. back/forward navigation), instead of in an effect -- comparing
+  // the derived string (not the searchParams object) avoids resetting
+  // displayValue on renders caused by this component's own debounced typing.
+  if (currentQuery !== lastSyncedQuery) {
+    setLastSyncedQuery(currentQuery)
+    setDisplayValue(currentQuery)
+  }
```

- [ ] **Step 2: Run lint**

Run: `npx eslint src/components/teachers/TeacherSearchBar.tsx`
Expected: 0 problems

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run existing tests that exercise search**

Run: `npx vitest run tests/unit/teacher-search-client.test.tsx tests/unit/passive-search-bar.test.tsx`
Expected: all pass

- [ ] **Step 5: Browser-verify debounced typing, URL sync, and the clear button**

This is the other case that most needs live verification — the render-time comparison must not fight the debounce.

Using Playwright MCP tools:
1. Navigate to `http://localhost:3000/teachers`
2. Click the search input, type `guzik` character by character (or via a single `type` action)
3. Confirm the input's displayed value updates on every keystroke immediately (not debounced) — screenshot or evaluate `() => document.querySelector('[data-search-input]')?.value` after typing
4. Wait ~400ms, then confirm the URL now has `?q=guzik` — evaluate `() => window.location.search`
5. Confirm the results filtered to teachers matching "guzik"
6. Click the clear (X) button, confirm the input empties immediately and the URL's `q` param is removed
7. Use the browser back button (`mcp__plugin_playwright_playwright__browser_navigate` with `url: "back"` if supported, or re-navigate to a URL with `?q=guzik` directly) and confirm the input's displayed value updates to match

---

### Task 13: ThemeProvider.tsx — justified `eslint-disable` (no refactor)

**Files:**
- Modify: `src/components/theme/ThemeProvider.tsx:43-44`

**Interfaces:** No behavior change at all — this task only adds a comment.

**Why a disable here and nowhere else in Phase 2:** this effect isn't a pure "mirror a prop into state" pattern like Tasks 11/12 — the flagged `setThemeState(param)` call sits directly alongside `setThemeCookie(param)` (writes a cookie) and `applyTheme(param)` (mutates `document.documentElement`'s class list) as one atomic response to a URL theme override. Splitting the state update out to a render-time adjustment while leaving the cookie/DOM writes in the effect would decouple two things that must stay in lockstep, risking a flash of the wrong theme on initial paint — a worse regression than the lint warning it silences. The project already uses this exact pattern (see `BridgeInit.tsx`'s exhaustive-deps disable, fixed in Task 5) for genuinely justified cases.

- [ ] **Step 1: Add the scoped disable**

```diff
   useEffect(() => {
     const param = searchParams?.get('theme') ?? null
     if (param === 'light' || param === 'dark' || param === 'system') {
       setThemeCookie(param)
+      // eslint-disable-next-line react-hooks/set-state-in-effect -- this branch also writes the theme cookie and mutates document.documentElement's class list in lockstep; splitting the state update out to a render-time adjustment would decouple them and risk a theme-flash on initial paint
       setThemeState(param)
       applyTheme(param)
       return
     }
```

- [ ] **Step 2: Run lint**

Run: `npx eslint src/components/theme/ThemeProvider.tsx`
Expected: 0 problems

- [ ] **Step 3: Run the existing ThemeProvider test suite (this is the regression net — it already covers cookie/system/dark-native-app paths)**

Run: `npx vitest run tests/unit/theme-provider.test.tsx`
Expected: all pass

---

## Final tasks — verify whole tree, then commit

### Task 14: Confirm the gate's own check passes project-wide

**Files:** None (verification only).

- [ ] **Step 1: Run the exact commands the hook runs**

Run: `npx tsc --noEmit --pretty`
Expected: 0 errors

Run: `npm run lint`
Expected: `0 problems` (all 28 errors and all 10 warnings gone — if any warnings remain, that's a signal a task above was missed; go back and fix it, since the goal is "fix all")

- [ ] **Step 2: Run the full unit test suite**

Run: `npx vitest run`
Expected: same pass count as before this plan started, plus the fixes from Tasks 2-13 — the only remaining failures should be the 2 pre-existing, already-confirmed-unrelated ones (`contact-sheet.test.tsx`'s `renders dialog when open`, `contact-form-on-success.test.tsx`'s `calls onSuccess when submission succeeds`)

---

### Task 15: Commit in scoped groups, then confirm the gate opens

**Files:** None new — this task stages and commits work from Tasks 1-13 *and* the prior session's already-verified media-bar fixes that are still sitting uncommitted in the same working tree (see Global Constraints). The gate only opens once the whole tree is lint-clean, so these two bodies of work ship together whether or not that was the original intent — there's no way to commit one without the other now.

Before Step 1, run `git status --short` and confirm it matches this expected set (adjust only if something unexpected changed since this plan was written):

```
 M .gitignore                                          <- pre-existing, unrelated — do not commit
 M src/app/globals.css                                  <- prior session: contrast fix
 M src/components/about/ContactForm.tsx                 <- prior session + Task 8
 M src/components/about/ContactSheet.tsx                <- prior session + Task 9
 M src/components/bridge/BridgeInit.tsx                 <- prior session + Task 5 Step 3
 M src/components/home/SleepTimerSheet.tsx               <- prior session
 M src/components/teachers/ScheduleTabView.tsx           <- prior session
 M tests/unit/sleep-timer-sheet.test.tsx                 <- prior session
?? doppler.yaml                                         <- pre-existing, unrelated — do not commit
?? home-before-sleep-timer.png                          <- scratch screenshot — do not commit
?? schedule-daypicker-open.png                           <- scratch screenshot — do not commit
?? src/lib/hooks/useHideMediaBarWhileOpen.ts              <- prior session
?? tests/unit/bridge-init-metadata-forward.test.tsx       <- prior session
?? tests/unit/bridge-init-sheet-focus-race.test.tsx       <- prior session
?? tests/unit/contact-form-pending-spinner.test.tsx       <- prior session
?? tests/unit/schedule-tab-view-media-bar.test.tsx        <- prior session
```
...plus everything Tasks 1-13 in *this* plan touched: `src/app/about/privacy-policy/page.tsx`, `tests/unit/post-message.test.ts`, `tests/unit/button.test.tsx`, `tests/unit/sheet-chrome.test.tsx`, `src/app/@modal/layout.tsx`, `src/app/teachers/[slug]/opengraph-image.tsx`, `src/components/teachers/ScheduleCardList.tsx`, `tests/unit/filter-teachers.test.ts`, `tests/unit/sanity-queries.test.ts`, `tests/unit/theme-provider.test.tsx`, `tests/unit/teacher-search-client.test.tsx`, `src/lib/hooks/useIsNativeApp.ts` (new), `src/components/global/BackButton.tsx`, `src/components/home/VolumeControl.tsx`, `src/components/home/RadioPlayer.tsx`, `src/components/teachers/TeacherSearchBar.tsx`, `src/components/theme/ThemeProvider.tsx`.

- [ ] **Step 1: Commit privacy-policy fix (about scope)**

```bash
git add src/app/about/privacy-policy/page.tsx
git commit -m "$(cat <<'EOF'
fix(about): escape unescaped quote entities in privacy policy copy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

If this first commit is blocked by the gate, it means Task 14 wasn't actually clean — stop and re-run Task 14's lint command to see what's left before continuing.

- [ ] **Step 2: Commit test-only mechanical fixes (test scope)**

```bash
git add tests/unit/post-message.test.ts tests/unit/button.test.tsx tests/unit/sheet-chrome.test.tsx tests/unit/filter-teachers.test.ts tests/unit/sanity-queries.test.ts tests/unit/theme-provider.test.tsx tests/unit/teacher-search-client.test.tsx
git commit -m "$(cat <<'EOF'
fix(test): clear lint errors in test-only files

Removes any-casts already covered by post-message.ts's own Window typing,
hoists a component defined during render, drops unused imports/params, and
justifies one Image-mock <img> usage that can't use next/image in jsdom.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Commit modal + seo warning cleanups**

```bash
git add src/app/@modal/layout.tsx
git commit -m "$(cat <<'EOF'
fix(modal): remove unused eslint-disable directive

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"

git add "src/app/teachers/[slug]/opengraph-image.tsx"
git commit -m "$(cat <<'EOF'
fix(seo): remove unused eslint-disable directive

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Commit everything in BridgeInit.tsx — prior session's focus-race fix AND this plan's disable relocation, together**

This file carries two concerns that can't be split (no patch-staging available): the prior session's aria-modal focus guard + useShallow→subscribe refactor, and this plan's Task 5 Step 3 exhaustive-deps disable relocation. Fold in the two new regression tests the prior session wrote for it.

```bash
git add src/components/bridge/BridgeInit.tsx tests/unit/bridge-init-sheet-focus-race.test.tsx tests/unit/bridge-init-metadata-forward.test.tsx
git commit -m "$(cat <<'EOF'
fix(bridge): guard media-bar focus handling against standalone sheet dialogs

Tabbing between fields inside a standalone sheet (e.g. ContactSheet) that
doesn't use useModalStore raced BridgeInit's focus-based bar hide/restore,
leaving the media bar stuck visible once focus landed on a non-input
element (submit button) where the handler no longer fires. Skip any focus
target inside an aria-modal="true" container so those sheets own their own
bar visibility instead.

Also drops the reactive useMediaStore(useShallow(...)) subscription used
only to forward metadata to native, in favor of a direct store subscription
so the null-returning component doesn't re-render on every store change —
and relocates its exhaustive-deps eslint-disable to the line ESLint actually
flags (the dependency array, not the effect's opening line, which had left
the warning both dead-directive-flagged there and unsuppressed at the real
location).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Commit ScheduleCardList's unused-var fix (schedule scope, separate from Step 6)**

```bash
git add src/components/teachers/ScheduleCardList.tsx
git commit -m "$(cat <<'EOF'
fix(schedule): remove unused map index parameter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Commit the prior session's ScheduleTabView media-bar fix (schedule scope)**

```bash
git add src/components/teachers/ScheduleTabView.tsx tests/unit/schedule-tab-view-media-bar.test.tsx
git commit -m "$(cat <<'EOF'
fix(schedule): hide the media bar behind the day-picker sheet

ScheduleTabView's day-picker only posted to native (a no-op in plain-browser
use); it never actually hid the on-page MediaBar. Adopts the shared
useHideMediaBarWhileOpen hook so the bar is genuinely hidden for the sheet's
full lifetime, matching @modal/layout.tsx's behavior.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Commit everything in ContactForm.tsx + ContactSheet.tsx — prior session's media-bar fix AND this plan's purity/refs/set-state-in-effect fixes, together**

Same situation as Step 4: these two files carry both the prior session's work (spinner, contrast bump, useHideMediaBarWhileOpen adoption) and this plan's Tasks 8-9. Fold in the new shared hook (first used here) and its associated new test.

```bash
git add src/components/about/ContactForm.tsx src/components/about/ContactSheet.tsx src/lib/hooks/useHideMediaBarWhileOpen.ts tests/unit/contact-form-pending-spinner.test.tsx
git commit -m "$(cat <<'EOF'
fix(about): hide the on-page media bar for the full ContactSheet lifetime

Introduces useHideMediaBarWhileOpen so ContactSheet actually flips
useMediaStore.showMediaBar while open (previously it only posted to native,
a no-op in plain-browser use), adds a pending-state spinner and fixes
error-text contrast on ContactForm, and — separately — replaces
ContactForm's impure Date.now() ref initializer and refs-read-during-render
of that value with a lazy useState initializer, and replaces ContactSheet's
mount-flag effect (which only ever called setState) with
useSyncExternalStore.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Commit the prior session's SleepTimerSheet media-bar fix (sleep-timer scope)**

```bash
git add src/components/home/SleepTimerSheet.tsx tests/unit/sleep-timer-sheet.test.tsx
git commit -m "$(cat <<'EOF'
fix(sleep-timer): hide the media bar while the sleep timer sheet is open

Adopts useHideMediaBarWhileOpen so the sheet actually flips
useMediaStore.showMediaBar (previously postMessageToNative-only, a no-op in
plain-browser use), matching @modal/layout.tsx's behavior.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Commit the shared native-app hook + its two consumers (global scope)**

```bash
git add src/lib/hooks/useIsNativeApp.ts src/components/global/BackButton.tsx src/components/home/VolumeControl.tsx
git commit -m "$(cat <<'EOF'
fix(global): replace duplicated native-app detection effects with a shared hook

BackButton and VolumeControl each had an identical useState+mount-effect
pair to detect the native-app class. Extracted into useIsNativeApp(), backed
by useSyncExternalStore, so the value is available without a setState call
inside an effect body.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: Commit RadioPlayer (player scope)**

```bash
git add src/components/home/RadioPlayer.tsx
git commit -m "$(cat <<'EOF'
fix(player): adjust imgSrc during render instead of in an effect

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 11: Commit TeacherSearchBar (teachers scope)**

```bash
git add src/components/teachers/TeacherSearchBar.tsx
git commit -m "$(cat <<'EOF'
fix(teachers): adjust displayValue during render instead of in an effect

Compares the derived query string rather than the searchParams object
identity, so the debounced local typing state can't be reset by a render
the URL didn't actually change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 12: Commit the prior session's globals.css contrast fix AND this plan's ThemeProvider fix (theme scope, two commits — different files, no overlap)**

```bash
git add src/app/globals.css
git commit -m "$(cat <<'EOF'
fix(theme): bump native-app light focus border contrast for WCAG 2.4.7

html.light.native-app's focus-visible border was rgba(75,85,99,0.6), ~2.76:1
against the input background — fails the 3:1 non-text contrast minimum.
Bumped to rgba(31,41,55,0.85), ~7.2:1, computed against bg-gray-100.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"

git add src/components/theme/ThemeProvider.tsx
git commit -m "$(cat <<'EOF'
fix(theme): justify set-state-in-effect exception for URL theme override

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 13: Confirm the gate is open and nothing was left behind**

Run: `git status --short`

Expected output is only the pre-existing, unrelated items — nothing from either body of work should remain:
```
 M .gitignore
?? doppler.yaml
?? home-before-sleep-timer.png
?? schedule-daypicker-open.png
```

If anything else appears, a file was missed in Steps 1-12 — stage and commit it into whichever scope it best matches before considering this task done. Every commit in Steps 1-12 succeeding (none blocked by the gate) is itself the confirmation the gate is open; no separate check is needed.

---

## Self-Review Notes

- **Spec coverage:** all 28 errors and 10 warnings from the `npm run lint` baseline captured at plan-writing time are covered by Tasks 1-13 — verified by hand-counting: Task 1 (12) + Task 2 (6) + Task 3 (1) + Task 4 (1 error + 1 warning) + Task 5 (3 warnings) + Task 6 (4 warnings) + Task 7 (1 warning) + Task 8 (2) + Task 9 (1) + Task 10 (1) + Task 11 (1) + Task 12 (1) + Task 13 (1) = 20 errors + 8 errors = 28 errors; 1+3+4+1+1(from Task4) = 10 warnings.
- **Placeholder scan:** no TBD/"handle appropriately"/"similar to Task N" language — every step has literal code or an exact command; both risky assumptions flagged by review (Task 3's `next/link` in jsdom, Task 8's lazy-initializer purity exemption) now have concrete, non-placeholder fallbacks.
- **Type consistency:** `useIsNativeApp()` returns `boolean` and is called identically in both consumers.
- **Working-tree accounting (added after the second review pass):** the initial draft's Task 15 assumed the tree contained only this plan's lint fixes. It doesn't — a prior session's uncommitted native-bridge media-bar fix shares three files with this plan (`BridgeInit.tsx`, `ContactSheet.tsx`, `ContactForm.tsx`) and contributes six more files this plan never touches. Task 15 was rewritten to enumerate the exact expected `git status --short` output before committing, fold both concerns into the three shared files' commit messages (Steps 4 and 7), and give the other six files their own scoped commits (Steps 6, 8, 12) — so Step 13's final check expects only the four pre-existing/unrelated items to remain, not "nothing."
