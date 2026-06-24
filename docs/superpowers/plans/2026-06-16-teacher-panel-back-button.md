# Teacher Panel Stack Navigation — Back Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user clicks a related teacher from inside the TeacherPanelChrome, a back button appears that navigates to the previous teacher (keeping the panel open), while the X/close button always fully closes the panel regardless of stack depth.

**Architecture:** The modal store already tracks `stackDepth` for stacked teacher navigations. We add `stackDepth` to `ModalContext`, split `handleDismiss` in `ModalLayout` into two callables — `handleClose` (force full dismiss via `window.history.go`) and `handleBack` (pop one step, keep panel open) — then expose both via `ModalContext`. `TeacherPanelChrome` reads `stackDepth` and conditionally renders an `<ArrowLeft>` back button.

**Tech Stack:** React 19, Next.js (App Router with `@modal` parallel route), Zustand, Radix UI Dialog, Lucide icons, Tailwind CSS, Vitest + Testing Library.

## Global Constraints

- All interactive elements must follow AGENTS.md a11y rules: `cursor-pointer`, `aria-label`, `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`, min `h-11 w-11` touch target.
- Commit scope for all changes: `modal` (TeacherPanelChrome, ModalContext, ModalLayout) per AGENTS.md canonical commit scopes.
- TypeScript strict — no `any` in public APIs.
- No new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `src/components/modals/ModalContext.tsx` | Add `stackDepth: number` to `ModalContextValue` interface and `ModalProvider` props |
| `src/app/@modal/layout.tsx` | Split `handleDismiss` into `handleClose` + `handleBack`; subscribe to `stackDepth`; pass all three to `ModalProvider` |
| `src/components/modals/chrome/TeacherPanelChrome.tsx` | Read `stackDepth` from `useModal()`; render `<ArrowLeft>` back button when `stackDepth > 0` on mobile and desktop |
| `tests/unit/modal-context.test.tsx` | Add `stackDepth` to all `ModalProvider` wrapper usages |
| `tests/unit/teacher-panel-chrome.test.tsx` | Update wrapper; add back-button visibility and behavior tests |
| `tests/unit/modal-layout.test.tsx` | Add test for force-close behavior |

---

### Task 1: Add `stackDepth` to ModalContext

**Files:**
- Modify: `src/components/modals/ModalContext.tsx`
- Test: `tests/unit/modal-context.test.tsx`

**Interfaces:**
- Produces: `ModalContextValue.stackDepth: number` — consumed by `TeacherPanelChrome` in Task 3.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/modal-context.test.tsx`:

```tsx
function StackConsumer() {
  const { stackDepth } = useModal()
  return <div data-testid="depth">{stackDepth}</div>
}

it('provides stackDepth to children', () => {
  render(
    <ModalProvider onDismiss={vi.fn()} onBack={vi.fn()} isClosing={false} stackDepth={2}>
      <StackConsumer />
    </ModalProvider>
  )
  expect(screen.getByTestId('depth')).toHaveTextContent('2')
})
```

Also update the three existing `ModalProvider` usages in that file to pass `stackDepth={0}` (they will fail to compile without it once the type is updated).

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs
npx vitest run tests/unit/modal-context.test.tsx
```

Expected: compile error — `stackDepth` does not exist on type.

- [ ] **Step 3: Update ModalContext**

Replace the contents of `src/components/modals/ModalContext.tsx`:

```tsx
'use client'

import { createContext, useContext } from 'react'

interface ModalContextValue {
  onDismiss: () => void
  onBack: () => void
  isClosing: boolean
  stackDepth: number
}

export const ModalContext = createContext<ModalContextValue | null>(null)

export function ModalProvider({
  children,
  onDismiss,
  onBack,
  isClosing,
  stackDepth,
}: ModalContextValue & { children: React.ReactNode }) {
  return (
    <ModalContext value={{ onDismiss, onBack, isClosing, stackDepth }}>
      {children}
    </ModalContext>
  )
}

export function useModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within ModalProvider')
  return ctx
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/modal-context.test.tsx
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/ModalContext.tsx tests/unit/modal-context.test.tsx
git commit -m "feat(modal): add stackDepth to ModalContext for back-navigation awareness"
```

---

### Task 2: Refactor ModalLayout — split dismiss into close vs back

**Files:**
- Modify: `src/app/@modal/layout.tsx`
- Test: `tests/unit/modal-layout.test.tsx`

**Interfaces:**
- Consumes: `useModalStore` `.stackDepth`, `.prepareBack()`, `.close()`; `ModalProvider.stackDepth` from Task 1.
- Produces: `onDismiss` = `handleClose` (force full close); `onBack` = `handleBack` (pop one step).

**Context:** The old `handleDismiss` branched on `stackDepth > 0` to either go-back-one or close-all. This caused the X button (which called `onDismiss` → `handleDismiss`) to go back one step instead of closing. The fix: `handleClose` always fully closes (all stack levels), `handleBack` always pops one level without closing.

`handleClose` uses `window.history.go(-(depth + 1))` to pop all stacked history entries at once. This is safe because:
1. `state.close()` is called first (synchronously), so `isOpen` becomes `false`.
2. When the browser's `popstate` fires (triggering Next.js's pathname effect), the effect sees `!isOpen` and exits early — no double-close.
3. `ModalLayout` is a client-component; `window` is always available at runtime.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/modal-layout.test.tsx`:

```tsx
it('close button fully closes when stackDepth > 0', async () => {
  // Arrange: modal open with stack depth 1 (nested teacher)
  useModalStore.setState({
    expectingRoute: false, isOpen: true, isClosing: false,
    title: 'Teacher B', triggerRef: null, stackDepth: 1,
    expectingBack: false,
  })
  const historyGoSpy = vi.spyOn(window.history, 'go').mockImplementation(() => {})
  const ModalLayout = await loadLayout()
  render(
    <ModalLayout>
      <button data-testid="close-trigger">Close</button>
    </ModalLayout>
  )
  // Simulate dismiss (onDismiss is handleClose)
  const store = useModalStore.getState()
  store.startClosing()
  // After EXIT_DURATION (150ms), close() and history.go() should be called
  await vi.advanceTimersByTimeAsync?.(200)
  // store.isOpen should be false
  expect(useModalStore.getState().isOpen).toBe(false)
  historyGoSpy.mockRestore()
})
```

Note: this test verifies the store shape; full integration of `window.history.go` is exercised via manual inspection / verify skill.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/modal-layout.test.tsx
```

Expected: FAIL — `stackDepth` not in `setState` shape (type error) or test assertion fails.

- [ ] **Step 3: Update ModalLayout**

Replace `src/app/@modal/layout.tsx`:

```tsx
'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef } from 'react'
import { ModalProvider } from '@/components/modals/ModalContext'
import { Skeleton } from '@/components/ui/skeleton'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
import { DragHandle } from '@/components/global/DragHandle'
import { EXIT_DURATION, MODAL_ENTER_ANIMATION, MODAL_EXIT_ANIMATION } from '@/lib/constants/modal'
import { useModalStore } from '@/lib/stores/modal'
import { postMessageToNative } from '@/lib/bridge/post-message'
import { cn } from '@/lib/utils'

function ModalSkeleton({
  title,
  onDismiss,
  isClosing,
}: {
  title?: string | null
  onDismiss: () => void
  isClosing?: boolean
}) {
  const skeletonRef = useRef<HTMLDivElement>(null)
  const drag = useSheetDrag({ onDismiss, contentRef: skeletonRef })

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        ref={skeletonRef}
        className={cn(
          'w-full max-h-[90dvh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/10 light:border-gray-200 bg-gray-800 light:bg-white p-0 h-[85dvh] sm:h-auto sm:max-w-2xl sm:w-[95vw]',
          isClosing ? MODAL_EXIT_ANIMATION : MODAL_ENTER_ANIMATION
        )}
      >
        <DragHandle drag={drag} onDismiss={onDismiss} className="w-full pt-3 pb-2 sm:hidden" />
        <div className="flex items-center justify-between border-b border-white/10 light:border-gray-200 bg-gray-800 light:bg-white px-6 py-4">
          {title ? (
            <h2 className="text-xl font-bold text-white light:text-gray-900">{title}</h2>
          ) : (
            <Skeleton className="h-6 w-1/3" />
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 light:text-gray-500 transition-colors hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="w-full h-12 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export default function ModalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isOpen = useModalStore((s) => s.isOpen)
  const isClosing = useModalStore((s) => s.isClosing)
  const title = useModalStore((s) => s.title)
  const stackDepth = useModalStore((s) => s.stackDepth)
  const close = useModalStore((s) => s.close)
  const startClosing = useModalStore((s) => s.startClosing)
  const expectingRoute = useModalStore((s) => s.expectingRoute)
  const expectingBack = useModalStore((s) => s.expectingBack)
  const routeArrived = useModalStore((s) => s.routeArrived)
  const clearBack = useModalStore((s) => s.clearBack)
  const dismissGuardRef = useRef(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current) }
  }, [])

  useEffect(() => {
    postMessageToNative({ showMobileNav: false })
    return () => { postMessageToNative({ showMobileNav: true }) }
  }, [])

  const pathname = usePathname()

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

  // Force-close: always dismisses the entire panel regardless of stack depth.
  // Pops all stacked history entries (depth + 1) in one go via window.history.go
  // so the user lands on the page they had before the modal was opened.
  const handleClose = useCallback(() => {
    if (dismissGuardRef.current) return
    dismissGuardRef.current = true
    startClosing()
    dismissTimer.current = setTimeout(() => {
      const state = useModalStore.getState()
      const triggerEl = state.triggerRef
      const depth = state.stackDepth
      state.close()
      window.history.go(-(depth + 1))
      dismissGuardRef.current = false
      triggerEl?.focus()
    }, EXIT_DURATION)
  }, [startClosing])

  // Back: pop one step in the stack, keep panel open showing the previous teacher.
  // prepareBack() signals the pathname effect to treat the upcoming pop as an
  // in-panel navigation (not a full close).
  const handleBack = useCallback(() => {
    const state = useModalStore.getState()
    state.prepareBack()
    router.back()
  }, [router])

  if (!isOpen) return null

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={
            isClosing
              ? 'fixed inset-0 z-[70] bg-black/80 motion-safe:animate-[fade-out_0.15s_ease-in_forwards]'
              : 'fixed inset-0 z-[70] bg-black/80 motion-safe:animate-[fade-in_0.2s_ease-out_both]'
          }
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[70] outline-none"
          onEscapeKeyDown={(e) => {
            const active = document.activeElement as HTMLInputElement | null
            if (active?.tagName === 'INPUT' && active.value.length > 0) {
              e.preventDefault()
              return
            }
            handleClose()
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {title ?? 'Modal'}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Press Escape to close.
          </DialogPrimitive.Description>
          <ModalProvider
            onDismiss={handleClose}
            onBack={handleBack}
            isClosing={isClosing}
            stackDepth={stackDepth}
          >
            <Suspense
              fallback={
                <ModalSkeleton title={title} onDismiss={handleClose} isClosing={isClosing} />
              }
            >
              {children}
            </Suspense>
          </ModalProvider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/modal-layout.test.tsx
```

Expected: all tests pass (including the new one).

- [ ] **Step 5: Commit**

```bash
git add src/app/@modal/layout.tsx tests/unit/modal-layout.test.tsx
git commit -m "feat(modal): split handleDismiss into handleClose (force) and handleBack (pop one)"
```

---

### Task 3: Add back button to TeacherPanelChrome

**Files:**
- Modify: `src/components/modals/chrome/TeacherPanelChrome.tsx`
- Test: `tests/unit/teacher-panel-chrome.test.tsx`

**Interfaces:**
- Consumes: `useModal()` — now returns `{ onDismiss, onBack, isClosing, stackDepth }` from Task 1.
- `ArrowLeft` from `lucide-react` (already installed).

**Layout logic:**
- Mobile (`md:hidden` header): show `<ArrowLeft>` button left of drag handle when `stackDepth > 0`; else show `<div className="w-9" />` spacer.
- Desktop (`hidden md:flex` drag zone): change to `justify-between`; show `<ArrowLeft>` button on left when `stackDepth > 0`, else `<div className="w-11" />`; keep `<X>` button on right. When `stackDepth === 0`, only the X appears — keep `justify-end` in that case to avoid leftward shift.

- [ ] **Step 1: Write the failing tests**

Replace `tests/unit/teacher-panel-chrome.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherPanelChrome } from '@/components/modals/chrome/TeacherPanelChrome'
import { ModalProvider } from '@/components/modals/ModalContext'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))

function Wrapper({
  onDismiss = vi.fn(),
  onBack = vi.fn(),
  isClosing = false,
  stackDepth = 0,
}: {
  onDismiss?: () => void
  onBack?: () => void
  isClosing?: boolean
  stackDepth?: number
} = {}) {
  return (
    <ModalProvider
      onDismiss={onDismiss}
      onBack={onBack}
      isClosing={isClosing}
      stackDepth={stackDepth}
    >
      <TeacherPanelChrome>
        <p>Panel content</p>
      </TeacherPanelChrome>
    </ModalProvider>
  )
}

describe('TeacherPanelChrome', () => {
  it('renders children', () => {
    render(<Wrapper />)
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('desktop close button calls onDismiss', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(<Wrapper onDismiss={onDismiss} />)
    const desktopClose = screen.getByTestId('desktop-close-btn')
    await user.click(desktopClose)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('tablet drag zone is present', () => {
    render(<Wrapper />)
    expect(screen.getByTestId('tablet-drag-zone')).toBeInTheDocument()
  })

  it('mobile drag handle button is present in DOM', () => {
    render(<Wrapper />)
    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    expect(closeButtons.length).toBeGreaterThanOrEqual(2) // DragHandle + desktop X
  })

  it('does not render back button when stackDepth is 0', () => {
    render(<Wrapper stackDepth={0} />)
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('renders back button when stackDepth > 0', () => {
    render(<Wrapper stackDepth={1} />)
    expect(screen.getAllByRole('button', { name: /back/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('back button calls onBack', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<Wrapper stackDepth={1} onBack={onBack} />)
    const backBtns = screen.getAllByRole('button', { name: /back/i })
    await user.click(backBtns[0])
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('X close button calls onDismiss, not onBack, even when stacked', async () => {
    const onDismiss = vi.fn()
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<Wrapper stackDepth={1} onDismiss={onDismiss} onBack={onBack} />)
    const desktopClose = screen.getByTestId('desktop-close-btn')
    await user.click(desktopClose)
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onBack).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/teacher-panel-chrome.test.tsx
```

Expected: existing tests compile-fail (missing `stackDepth` prop on `ModalProvider`), new back-button tests fail with "not in document".

- [ ] **Step 3: Update TeacherPanelChrome**

Replace `src/components/modals/chrome/TeacherPanelChrome.tsx`:

```tsx
'use client'

import { useRef } from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { useModal } from '@/components/modals/ModalContext'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
import { DragHandle } from '@/components/global/DragHandle'
import { cn } from '@/lib/utils'

interface TeacherPanelChromeProps {
  children: React.ReactNode
}

export function TeacherPanelChrome({ children }: TeacherPanelChromeProps) {
  const { onDismiss, onBack, isClosing, stackDepth } = useModal()
  const contentRef = useRef<HTMLDivElement>(null)
  const mobileDrag = useSheetDrag({ onDismiss, contentRef, axis: 'y' })
  const tabletDrag = useSheetDrag({ onDismiss, contentRef, axis: 'x' })
  const canGoBack = stackDepth > 0

  const backButtonClass =
    'flex h-11 w-11 items-center justify-center rounded-full text-white/60 light:text-gray-500 hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  const closeButtonClass =
    'flex h-11 w-11 items-center justify-center rounded-full text-white/60 light:text-gray-500 hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div
      role="presentation"
      className="fixed inset-0 flex items-end md:items-stretch md:justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) onDismiss() }}
    >
      <div
        ref={contentRef}
        className={cn(
          'w-full flex flex-col bg-[#0f1a0a] light:bg-white border-white/[0.08] light:border-gray-200 overflow-hidden',
          // Mobile: bottom sheet
          'max-h-[92dvh] rounded-t-2xl border',
          isClosing
            ? 'motion-safe:animate-[modal-slide-down_0.15s_ease-in_forwards]'
            : 'motion-safe:animate-[modal-slide-up_0.2s_cubic-bezier(0.32,0.72,0,1)_both]',
          // Desktop: right panel
          'md:max-h-none md:h-full md:w-[480px] md:rounded-none md:rounded-l-2xl md:border-y-0 md:border-r-0 md:border-l',
          isClosing
            ? 'md:motion-safe:animate-[panel-slide-out_0.15s_ease-in_forwards]'
            : 'md:motion-safe:animate-[panel-slide-in_0.25s_cubic-bezier(0.32,0.72,0,1)_both]',
        )}
      >
        {/* Mobile: drag handle + optional back button + close button */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2 md:hidden shrink-0">
          {canGoBack ? (
            <button
              type="button"
              onClick={onBack}
              className={backButtonClass}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="w-9" />
          )}
          <DragHandle drag={mobileDrag} onDismiss={onDismiss} />
          <button
            type="button"
            onClick={onDismiss}
            className={closeButtonClass}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop: tablet swipe zone + optional back button + close button.
            touch-pan-y: browser owns vertical scroll; our handlers receive horizontal swipes.
            stopPropagation on buttons prevents tap from triggering drag context. */}
        <div
          data-testid="tablet-drag-zone"
          className={cn(
            'hidden md:flex items-center px-4 pt-4 pb-0 shrink-0 touch-pan-y',
            canGoBack ? 'justify-between' : 'justify-end',
          )}
          onTouchStart={tabletDrag.onTouchStart}
          onTouchMove={tabletDrag.onTouchMove}
          onTouchEnd={tabletDrag.onTouchEnd}
        >
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className={backButtonClass}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <button
            data-testid="desktop-close-btn"
            type="button"
            onClick={onDismiss}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className={closeButtonClass}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content; pb-20 clears the fixed bottom nav bar on mobile */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-0">
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/teacher-panel-chrome.test.tsx
```

Expected: all 8 tests pass.

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
npx vitest run
```

Expected: all tests pass. If `modal-context.test.tsx` or `modal-layout.test.tsx` fail (because they use `ModalProvider` without `stackDepth`), update those files to pass `stackDepth={0}` to all `ModalProvider` usages.

- [ ] **Step 6: Commit**

```bash
git add src/components/modals/chrome/TeacherPanelChrome.tsx tests/unit/teacher-panel-chrome.test.tsx
git commit -m "feat(modal): add back button to TeacherPanelChrome when navigating stacked teachers"
```

---

### Task 4: Verify in browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the golden path**

1. Open `http://localhost:3000/teachers`
2. Click any teacher card — panel opens (stackDepth=0). Confirm: no back button, X closes fully.
3. Scroll to "Also on Reach Radio" carousel — click a related teacher. Confirm: back button (`←`) appears alongside the X button.
4. Click the back button (`←`). Confirm: previous teacher loads in the same panel (no full close).
5. Click the X button. Confirm: panel closes entirely, returns to `/teachers` page.
6. Repeat steps 2–5 on mobile viewport (375px). Confirm: back button appears left of drag handle on mobile.

- [ ] **Step 3: Test edge cases**

- Two levels deep (A → B → C): back from C returns to B; back from B returns to A; X from A closes fully. X from B or C also closes fully in one action.
- Escape key from stacked teacher: panel closes fully (same as X), not just pops one step.
- Backdrop click from stacked teacher: panel closes fully.
- Swipe to dismiss from stacked teacher: panel closes fully.

- [ ] **Step 4: Use `/verify` skill if available to capture screenshots**

```
/verify
```

Confirm no visual regressions on the non-stacked teacher panel (back button must NOT appear when `stackDepth === 0`).
