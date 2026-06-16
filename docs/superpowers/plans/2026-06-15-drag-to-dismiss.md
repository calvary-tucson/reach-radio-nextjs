# Drag-to-Dismiss Unified System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify drag-to-dismiss across all sheet surfaces with a shared `DragHandle` component, x-axis support for tablet side-panel swipe, and consistent style cleanup on snap-back and pure taps.

**Architecture:** Extend `useSheetDrag` with an `axis` option and style-cleanup fix; extract a shared `DragHandle` button component that is hidden on pure-mouse devices via a new `touch:` Tailwind variant; wire each sheet surface to `DragHandle` with the correct axis; add tablet x-axis swipe to `TeacherPanelChrome`.

**Tech Stack:** React 19, Tailwind CSS v4, `@custom-variant`, Vitest, `@testing-library/react`

---

## File Map

| Action | File |
|---|---|
| Modify | `src/app/globals.css` |
| Modify | `src/lib/hooks/useSheetDrag.ts` |
| **Create** | `src/components/global/DragHandle.tsx` |
| Modify | `src/components/global/BottomSheet.tsx` |
| Modify | `src/components/modals/chrome/SheetChrome.tsx` |
| Modify | `src/components/modals/chrome/TeacherPanelChrome.tsx` |
| Modify | `src/app/@modal/layout.tsx` |
| **Create** | `tests/unit/use-sheet-drag.test.ts` |
| **Create** | `tests/unit/drag-handle.test.tsx` |
| Modify | `tests/unit/bottom-sheet.test.tsx` |
| Modify | `tests/unit/sheet-chrome.test.tsx` |
| **Create** | `tests/unit/teacher-panel-chrome.test.tsx` |

---

### Task 1: Add `touch:` Tailwind Variant

**Files:**
- Modify: `src/app/globals.css` (after the existing `@custom-variant dark` line, around line 4)

- [ ] **Add `touch:` custom variant**

Open `src/app/globals.css`. After the existing `@custom-variant` lines, add:

```css
@custom-variant touch (@media (any-pointer: coarse));
```

The file top should now read:

```css
@import "tailwindcss";
/* Theme variants — .light/.dark on <html> triggers these prefixes */
@custom-variant light (&:where(.light, .light *));
@custom-variant dark (&:where(.dark, .dark *));
@custom-variant touch (@media (any-pointer: coarse));
@import "tw-animate-css";
```

`any-pointer: coarse` (not `pointer: coarse`) ensures hybrid devices like Surface with keyboard show the handle even though the trackpad is the primary pointer.

- [ ] **Run tests to confirm no regression**

```bash
npm run test
```

Expected: same pass/fail count as before this task (pre-existing failures are unrelated).

- [ ] **Commit**

```bash
git add src/app/globals.css
git commit -m "style(global): add touch: custom variant for any-pointer:coarse"
```

---

### Task 2: Extend `useSheetDrag` with `axis` + Style Cleanup

**Files:**
- Modify: `src/lib/hooks/useSheetDrag.ts`
- Create: `tests/unit/use-sheet-drag.test.ts`

This task also fixes two pre-existing bugs:
1. **Tap-then-close broken:** On tap (no drag), `onTouchStart` sets `animation: none` + `transition: none` inline. These lingered and blocked CSS keyframe close animations. Fix: clear them immediately on tap.
2. **Snap-back leaves stale styles:** After a failed drag, inline `style.transform` remained, blocking CSS class changes. Fix: clear all inline styles 220ms after snap-back completes.

- [ ] **Write failing tests**

Create `tests/unit/use-sheet-drag.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'

function touch(clientX: number, clientY: number): React.TouchEvent {
  return { touches: [{ clientX, clientY }] } as unknown as React.TouchEvent
}

describe('useSheetDrag', () => {
  let el: HTMLDivElement
  let contentRef: { current: HTMLDivElement }

  beforeEach(() => {
    el = document.createElement('div')
    contentRef = { current: el }
  })

  describe('y-axis (default)', () => {
    it('translates Y on downward move', () => {
      const { result } = renderHook(() => useSheetDrag({ onDismiss: vi.fn(), contentRef }))
      act(() => { result.current.onTouchStart(touch(0, 100)) })
      act(() => { result.current.onTouchMove(touch(0, 200)) })
      expect(el.style.transform).toBe('translateY(100px)')
    })

    it('dismisses via translateY(100%) when delta > 120', () => {
      vi.useFakeTimers()
      const onDismiss = vi.fn()
      const { result } = renderHook(() => useSheetDrag({ onDismiss, contentRef }))
      act(() => { result.current.onTouchStart(touch(0, 0)) })
      act(() => { result.current.onTouchMove(touch(0, 130)) })
      act(() => { result.current.onTouchEnd() })
      expect(el.style.transform).toBe('translateY(100%)')
      vi.advanceTimersByTime(200)
      expect(onDismiss).toHaveBeenCalledOnce()
      vi.useRealTimers()
    })

    it('snaps back via translateY(0) when delta <= 120', () => {
      const onDismiss = vi.fn()
      const { result } = renderHook(() => useSheetDrag({ onDismiss, contentRef }))
      act(() => { result.current.onTouchStart(touch(0, 0)) })
      act(() => { result.current.onTouchMove(touch(0, 50)) })
      act(() => { result.current.onTouchEnd() })
      expect(onDismiss).not.toHaveBeenCalled()
      expect(el.style.transform).toBe('translateY(0)')
    })

    it('clears inline styles 220ms after snap-back', () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useSheetDrag({ onDismiss: vi.fn(), contentRef }))
      act(() => { result.current.onTouchStart(touch(0, 0)) })
      act(() => { result.current.onTouchMove(touch(0, 50)) })
      act(() => { result.current.onTouchEnd() })
      expect(el.style.transform).toBe('translateY(0)')
      act(() => { vi.advanceTimersByTime(220) })
      expect(el.style.transform).toBe('')
      expect(el.style.animation).toBe('')
      vi.useRealTimers()
    })

    it('clears styles immediately on pure tap (no movement)', () => {
      const onDismiss = vi.fn()
      const { result } = renderHook(() => useSheetDrag({ onDismiss, contentRef }))
      act(() => { result.current.onTouchStart(touch(0, 100)) })
      act(() => { result.current.onTouchEnd() })
      expect(onDismiss).not.toHaveBeenCalled()
      expect(el.style.transform).toBe('')
      expect(el.style.animation).toBe('')
    })

    it('ignores upward swipe (clamps to 0)', () => {
      const onDismiss = vi.fn()
      const { result } = renderHook(() => useSheetDrag({ onDismiss, contentRef }))
      act(() => { result.current.onTouchStart(touch(0, 200)) })
      act(() => { result.current.onTouchMove(touch(0, 50)) }) // upward — delta negative
      act(() => { result.current.onTouchEnd() })
      expect(onDismiss).not.toHaveBeenCalled()
    })
  })

  describe('x-axis', () => {
    it('translates X on rightward move', () => {
      const { result } = renderHook(() =>
        useSheetDrag({ onDismiss: vi.fn(), contentRef, axis: 'x' })
      )
      act(() => { result.current.onTouchStart(touch(100, 0)) })
      act(() => { result.current.onTouchMove(touch(200, 0)) })
      expect(el.style.transform).toBe('translateX(100px)')
    })

    it('dismisses via translateX(100%) when delta > 120', () => {
      vi.useFakeTimers()
      const onDismiss = vi.fn()
      const { result } = renderHook(() =>
        useSheetDrag({ onDismiss, contentRef, axis: 'x' })
      )
      act(() => { result.current.onTouchStart(touch(0, 0)) })
      act(() => { result.current.onTouchMove(touch(130, 0)) })
      act(() => { result.current.onTouchEnd() })
      expect(el.style.transform).toBe('translateX(100%)')
      vi.advanceTimersByTime(200)
      expect(onDismiss).toHaveBeenCalledOnce()
      vi.useRealTimers()
    })

    it('snaps back via translateX(0) when delta <= 120', () => {
      const onDismiss = vi.fn()
      const { result } = renderHook(() =>
        useSheetDrag({ onDismiss, contentRef, axis: 'x' })
      )
      act(() => { result.current.onTouchStart(touch(0, 0)) })
      act(() => { result.current.onTouchMove(touch(50, 0)) })
      act(() => { result.current.onTouchEnd() })
      expect(onDismiss).not.toHaveBeenCalled()
      expect(el.style.transform).toBe('translateX(0)')
    })

    it('ignores leftward swipe (clamps to 0)', () => {
      const onDismiss = vi.fn()
      const { result } = renderHook(() =>
        useSheetDrag({ onDismiss, contentRef, axis: 'x' })
      )
      act(() => { result.current.onTouchStart(touch(200, 0)) })
      act(() => { result.current.onTouchMove(touch(50, 0)) })
      act(() => { result.current.onTouchEnd() })
      expect(onDismiss).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Run tests to confirm they fail**

```bash
npm run test -- tests/unit/use-sheet-drag.test.ts
```

Expected: all tests fail (file not found or wrong behavior).

- [ ] **Implement the updated hook**

Replace `src/lib/hooks/useSheetDrag.ts` entirely:

```ts
import { type RefObject, useCallback, useEffect, useRef } from 'react'

const DISMISS_THRESHOLD = 120
const VELOCITY_THRESHOLD = 0.5
const OPACITY_SCALE_DISTANCE = 400
const OPACITY_MIN = 0.5
const SNAP_BACK_DURATION = 220

interface UseSheetDragOptions {
  onDismiss: () => void
  contentRef: RefObject<HTMLDivElement | null>
  axis?: 'y' | 'x'
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useSheetDrag({ onDismiss, contentRef, axis = 'y' }: UseSheetDragOptions) {
  const startPos = useRef(0)
  const startTime = useRef(0)
  const currentDelta = useRef(0)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mouseCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    if (mouseCleanupRef.current) mouseCleanupRef.current()
  }, [])

  const clearInlineStyles = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.style.transform = ''
      contentRef.current.style.opacity = ''
      contentRef.current.style.transition = ''
      contentRef.current.style.animation = ''
    }
  }, [contentRef])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startPos.current = axis === 'x' ? e.touches[0].clientX : e.touches[0].clientY
    startTime.current = Date.now()
    currentDelta.current = 0
    if (contentRef.current) {
      contentRef.current.style.animation = 'none'
      contentRef.current.style.transition = 'none'
    }
  }, [contentRef, axis])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const pos = axis === 'x' ? e.touches[0].clientX : e.touches[0].clientY
    currentDelta.current = Math.max(0, pos - startPos.current)
    if (contentRef.current && !prefersReducedMotion()) {
      contentRef.current.style.transform = axis === 'x'
        ? `translateX(${currentDelta.current}px)`
        : `translateY(${currentDelta.current}px)`
      contentRef.current.style.opacity = String(
        Math.max(OPACITY_MIN, 1 - currentDelta.current / OPACITY_SCALE_DISTANCE)
      )
    }
  }, [contentRef, axis])

  const onTouchEnd = useCallback(() => {
    if (currentDelta.current === 0) {
      clearInlineStyles()
      return
    }

    const elapsed = Math.max(1, Date.now() - startTime.current)
    const velocity = currentDelta.current / elapsed

    if (currentDelta.current > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
        contentRef.current.style.transform = axis === 'x' ? 'translateX(100%)' : 'translateY(100%)'
        contentRef.current.style.opacity = '0'
      }
      dismissTimer.current = setTimeout(onDismiss, 150)
    } else {
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
        contentRef.current.style.transform = axis === 'x' ? 'translateX(0)' : 'translateY(0)'
        contentRef.current.style.opacity = '1'
      }
      dismissTimer.current = setTimeout(clearInlineStyles, SNAP_BACK_DURATION)
    }
  }, [contentRef, onDismiss, axis, clearInlineStyles])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startPos.current = axis === 'x' ? e.clientX : e.clientY
    startTime.current = Date.now()
    currentDelta.current = 0
    if (contentRef.current) {
      contentRef.current.style.animation = 'none'
      contentRef.current.style.transition = 'none'
    }

    function handleMouseMove(ev: MouseEvent) {
      const pos = axis === 'x' ? ev.clientX : ev.clientY
      currentDelta.current = Math.max(0, pos - startPos.current)
      if (contentRef.current && !prefersReducedMotion()) {
        contentRef.current.style.transform = axis === 'x'
          ? `translateX(${currentDelta.current}px)`
          : `translateY(${currentDelta.current}px)`
        contentRef.current.style.opacity = String(
          Math.max(OPACITY_MIN, 1 - currentDelta.current / OPACITY_SCALE_DISTANCE)
        )
      }
    }

    function handleMouseUp() {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      mouseCleanupRef.current = null

      if (currentDelta.current === 0) {
        clearInlineStyles()
        return
      }

      const elapsed = Math.max(1, Date.now() - startTime.current)
      const velocity = currentDelta.current / elapsed

      if (currentDelta.current > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        if (contentRef.current) {
          contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
          contentRef.current.style.transform = axis === 'x' ? 'translateX(100%)' : 'translateY(100%)'
          contentRef.current.style.opacity = '0'
        }
        dismissTimer.current = setTimeout(onDismiss, 150)
      } else {
        if (contentRef.current) {
          contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
          contentRef.current.style.transform = axis === 'x' ? 'translateX(0)' : 'translateY(0)'
          contentRef.current.style.opacity = '1'
        }
        dismissTimer.current = setTimeout(clearInlineStyles, SNAP_BACK_DURATION)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    mouseCleanupRef.current = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [contentRef, onDismiss, axis, clearInlineStyles])

  return { onTouchStart, onTouchMove, onTouchEnd, onMouseDown }
}
```

- [ ] **Run tests to confirm they pass**

```bash
npm run test -- tests/unit/use-sheet-drag.test.ts
```

Expected: all 10 tests pass.

- [ ] **Commit**

```bash
git add src/lib/hooks/useSheetDrag.ts tests/unit/use-sheet-drag.test.ts
git commit -m "fix(player): extend useSheetDrag with axis option and inline style cleanup"
```

---

### Task 3: Create `DragHandle` Component

**Files:**
- Create: `src/components/global/DragHandle.tsx`
- Create: `tests/unit/drag-handle.test.tsx`

`DragHandle` is a `<button>` that renders the pill affordance. It is:
- Hidden on pure-mouse devices via `hidden touch:flex` (the `touch:` variant from Task 1)
- Keyboard accessible (Enter/Space calls `onDismiss`)
- Wires all four drag handlers from `useSheetDrag`
- Layout-agnostic: callers provide padding/width via `className`

- [ ] **Write failing tests**

Create `tests/unit/drag-handle.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DragHandle } from '@/components/global/DragHandle'
import type { useSheetDrag } from '@/lib/hooks/useSheetDrag'

function makeDrag(): ReturnType<typeof useSheetDrag> {
  return {
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }
}

describe('DragHandle', () => {
  it('renders a button with aria-label "Close"', () => {
    render(<DragHandle drag={makeDrag()} onDismiss={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('calls onDismiss on Enter key', () => {
    const onDismiss = vi.fn()
    render(<DragHandle drag={makeDrag()} onDismiss={onDismiss} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Enter' })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('calls onDismiss on Space key', () => {
    const onDismiss = vi.fn()
    render(<DragHandle drag={makeDrag()} onDismiss={onDismiss} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: ' ' })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('does not call onDismiss on unrelated keys', () => {
    const onDismiss = vi.fn()
    render(<DragHandle drag={makeDrag()} onDismiss={onDismiss} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Tab' })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('fires drag.onTouchStart on touch start', () => {
    const drag = makeDrag()
    render(<DragHandle drag={drag} onDismiss={vi.fn()} />)
    fireEvent.touchStart(screen.getByRole('button', { name: 'Close' }))
    expect(drag.onTouchStart).toHaveBeenCalled()
  })

  it('fires drag.onMouseDown on mouse down', () => {
    const drag = makeDrag()
    render(<DragHandle drag={drag} onDismiss={vi.fn()} />)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Close' }))
    expect(drag.onMouseDown).toHaveBeenCalled()
  })

  it('merges className onto the button', () => {
    render(<DragHandle drag={makeDrag()} onDismiss={vi.fn()} className="pt-3 pb-2 w-full" />)
    const btn = screen.getByRole('button', { name: 'Close' })
    expect(btn.className).toContain('pt-3')
    expect(btn.className).toContain('w-full')
  })

  it('renders the pill inside the button', () => {
    render(<DragHandle drag={makeDrag()} onDismiss={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Close' })
    const pill = btn.querySelector('[aria-hidden="true"]')
    expect(pill).toBeInTheDocument()
    expect(pill?.className).toContain('h-1')
    expect(pill?.className).toContain('w-10')
  })
})
```

- [ ] **Run tests to confirm they fail**

```bash
npm run test -- tests/unit/drag-handle.test.tsx
```

Expected: all fail (module not found).

- [ ] **Create `DragHandle` component**

Create `src/components/global/DragHandle.tsx`:

```tsx
'use client'

import { cn } from '@/lib/utils'
import type { useSheetDrag } from '@/lib/hooks/useSheetDrag'

interface DragHandleProps {
  drag: ReturnType<typeof useSheetDrag>
  onDismiss: () => void
  className?: string
}

export function DragHandle({ drag, onDismiss, className }: DragHandleProps) {
  return (
    <button
      type="button"
      aria-label="Close"
      className={cn(
        'hidden touch:flex items-center justify-center min-h-11',
        'touch-none cursor-grab active:cursor-grabbing',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDismiss() }}
      onTouchStart={drag.onTouchStart}
      onTouchMove={drag.onTouchMove}
      onTouchEnd={drag.onTouchEnd}
      onMouseDown={drag.onMouseDown}
    >
      <div className="h-1 w-10 rounded-full bg-white/30 light:bg-gray-300" aria-hidden="true" />
    </button>
  )
}
```

- [ ] **Run tests to confirm they pass**

```bash
npm run test -- tests/unit/drag-handle.test.tsx
```

Expected: all 8 tests pass.

- [ ] **Commit**

```bash
git add src/components/global/DragHandle.tsx tests/unit/drag-handle.test.tsx
git commit -m "feat(global): add DragHandle component — semantic, touch-only, keyboard accessible"
```

---

### Task 4: Update `BottomSheet` to Use `DragHandle`

**Files:**
- Modify: `src/components/global/BottomSheet.tsx`
- Modify: `tests/unit/bottom-sheet.test.tsx`

- [ ] **Update test mock to include `onMouseDown`**

Open `tests/unit/bottom-sheet.test.tsx`. The `useSheetDrag` mock is missing `onMouseDown`. Update it:

```ts
vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))
```

- [ ] **Run existing tests to confirm they still pass**

```bash
npm run test -- tests/unit/bottom-sheet.test.tsx
```

Expected: all 5 existing tests pass.

- [ ] **Update `BottomSheet.tsx`**

Open `src/components/global/BottomSheet.tsx`. Make these changes:

1. Add import for `DragHandle`:

```tsx
import { DragHandle } from '@/components/global/DragHandle'
```

2. Replace the drag zone div (lines 81–91 approximately) with `DragHandle`:

Before:
```tsx
          <div
            className="touch-none cursor-grab active:cursor-grabbing"
            onTouchStart={drag.onTouchStart}
            onTouchMove={drag.onTouchMove}
            onTouchEnd={drag.onTouchEnd}
            onMouseDown={drag.onMouseDown}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="h-1 w-10 rounded-full bg-white/30 light:bg-gray-300" />
            </div>
          </div>
```

After:
```tsx
          <DragHandle drag={drag} onDismiss={handleClose} className="w-full pt-3 pb-2" />
```

- [ ] **Run all tests**

```bash
npm run test -- tests/unit/bottom-sheet.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Commit**

```bash
git add src/components/global/BottomSheet.tsx tests/unit/bottom-sheet.test.tsx
git commit -m "refactor(player): replace BottomSheet drag div with DragHandle component"
```

---

### Task 5: Update `SheetChrome` to Use `DragHandle`

**Files:**
- Modify: `src/components/modals/chrome/SheetChrome.tsx`
- Modify: `tests/unit/sheet-chrome.test.tsx`

`SheetChrome` was previously missing `onMouseDown`. `DragHandle` provides it automatically.

- [ ] **Update test mock to include `onMouseDown`**

Open `tests/unit/sheet-chrome.test.tsx`. The `useSheetDrag` mock is missing `onMouseDown`:

```ts
vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))
```

- [ ] **Run existing tests to confirm they still pass**

```bash
npm run test -- tests/unit/sheet-chrome.test.tsx
```

Expected: all 4 existing tests pass.

- [ ] **Update `SheetChrome.tsx`**

Open `src/components/modals/chrome/SheetChrome.tsx`. Make these changes:

1. Add import for `DragHandle`:

```tsx
import { DragHandle } from '@/components/global/DragHandle'
```

2. Replace the drag handle button (lines 45–55 approximately) with `DragHandle`:

Before:
```tsx
        <button
          type="button"
          aria-label="Close"
          className="flex justify-center pt-3 pb-2 sm:hidden cursor-grab active:cursor-grabbing touch-none shrink-0 w-full"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDismiss() }}
          onTouchStart={drag.onTouchStart}
          onTouchMove={drag.onTouchMove}
          onTouchEnd={drag.onTouchEnd}
        >
          <div className="h-1 w-10 rounded-full bg-white/30 light:bg-gray-300" aria-hidden="true" />
        </button>
```

After:
```tsx
        <DragHandle drag={drag} onDismiss={onDismiss} className="w-full pt-3 pb-2 sm:hidden shrink-0" />
```

- [ ] **Run all tests**

```bash
npm run test -- tests/unit/sheet-chrome.test.tsx
```

Expected: all 4 tests pass.

- [ ] **Commit**

```bash
git add src/components/modals/chrome/SheetChrome.tsx tests/unit/sheet-chrome.test.tsx
git commit -m "refactor(modal): replace SheetChrome drag button with DragHandle, adds mouse drag"
```

---

### Task 6: Update `TeacherPanelChrome` — Mobile `DragHandle` + Tablet X-Axis Swipe

**Files:**
- Modify: `src/components/modals/chrome/TeacherPanelChrome.tsx`
- Create: `tests/unit/teacher-panel-chrome.test.tsx`

Two drag contexts:
- **Mobile** (`md:hidden`): y-axis `DragHandle` pill, as before
- **Tablet** (`hidden md:flex` header): x-axis touch handlers on the desktop close button row. `touch-pan-y` allows vertical scroll while we intercept horizontal. `stopPropagation` on the X button prevents tapping it from initiating the drag context.

- [ ] **Write failing tests**

Create `tests/unit/teacher-panel-chrome.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

function Wrapper({ onDismiss = vi.fn(), isClosing = false } = {}) {
  return (
    <ModalProvider onDismiss={onDismiss} onBack={vi.fn()} isClosing={isClosing}>
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
    // Desktop close button has aria-label "Close" and is inside tablet-drag-zone
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
    // DragHandle renders a button with aria-label "Close" — it's in the DOM even if CSS-hidden
    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    expect(closeButtons.length).toBeGreaterThanOrEqual(2) // DragHandle + desktop X
  })
})
```

- [ ] **Run tests to confirm they fail**

```bash
npm run test -- tests/unit/teacher-panel-chrome.test.tsx
```

Expected: "desktop-close-btn" and "tablet-drag-zone" testids not found.

- [ ] **Update `TeacherPanelChrome.tsx`**

Replace `src/components/modals/chrome/TeacherPanelChrome.tsx` entirely:

```tsx
'use client'

import { useRef } from 'react'
import { X } from 'lucide-react'
import { useModal } from '@/components/modals/ModalContext'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
import { DragHandle } from '@/components/global/DragHandle'
import { cn } from '@/lib/utils'

interface TeacherPanelChromeProps {
  children: React.ReactNode
}

export function TeacherPanelChrome({ children }: TeacherPanelChromeProps) {
  const { onDismiss, isClosing } = useModal()
  const contentRef = useRef<HTMLDivElement>(null)
  const mobileDrag = useSheetDrag({ onDismiss, contentRef, axis: 'y' })
  const tabletDrag = useSheetDrag({ onDismiss, contentRef, axis: 'x' })

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
        {/* Mobile: drag handle + close button */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2 md:hidden shrink-0">
          <div className="w-9" />
          <DragHandle drag={mobileDrag} onDismiss={onDismiss} />
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 light:text-gray-500 hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop close button + tablet swipe zone.
            touch-pan-y: browser owns vertical scroll; our handlers receive horizontal swipes.
            stopPropagation on the X button prevents tap-on-X from triggering drag context. */}
        <div
          data-testid="tablet-drag-zone"
          className="hidden md:flex justify-end px-4 pt-4 pb-0 shrink-0 touch-pan-y"
          onTouchStart={tabletDrag.onTouchStart}
          onTouchMove={tabletDrag.onTouchMove}
          onTouchEnd={tabletDrag.onTouchEnd}
        >
          <button
            data-testid="desktop-close-btn"
            type="button"
            onClick={onDismiss}
            onTouchStart={(e) => e.stopPropagation()}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 light:text-gray-500 hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

- [ ] **Run tests**

```bash
npm run test -- tests/unit/teacher-panel-chrome.test.tsx
```

Expected: all 4 tests pass.

- [ ] **Commit**

```bash
git add src/components/modals/chrome/TeacherPanelChrome.tsx tests/unit/teacher-panel-chrome.test.tsx
git commit -m "feat(modal): add tablet x-axis swipe dismiss and DragHandle to TeacherPanelChrome"
```

---

### Task 7: Wire `ModalSkeleton` Drag

**Files:**
- Modify: `src/app/@modal/layout.tsx`
- Modify: `tests/unit/modal-layout.test.tsx`

The `ModalSkeleton` (Suspense fallback) renders a cosmetic drag pill with no handlers. Replace it with `DragHandle` so users can swipe-dismiss during loading.

- [ ] **Update `modal-layout.test.tsx` to mock `useSheetDrag`**

Open `tests/unit/modal-layout.test.tsx`. Add a `useSheetDrag` mock at the top (after the existing mocks):

```ts
vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onMouseDown: vi.fn(),
  }),
}))
```

- [ ] **Run existing tests to confirm they still pass**

```bash
npm run test -- tests/unit/modal-layout.test.tsx
```

Expected: both existing tests pass.

- [ ] **Update `layout.tsx`**

Open `src/app/@modal/layout.tsx`. Make these changes:

1. Add imports (the file already imports `useRef` from React):

```tsx
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
import { DragHandle } from '@/components/global/DragHandle'
```

2. Update `ModalSkeleton` to add a ref, wire `useSheetDrag`, and replace the cosmetic pill:

Before:
```tsx
function ModalSkeleton({
  title,
  onDismiss,
  isClosing,
}: {
  title?: string | null
  onDismiss: () => void
  isClosing?: boolean
}) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        className={cn(
          'w-full max-h-[90dvh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/10 light:border-gray-200 bg-gray-800 light:bg-white p-0 h-[85dvh] sm:h-auto sm:max-w-2xl sm:w-[95vw]',
          isClosing ? MODAL_EXIT_ANIMATION : MODAL_ENTER_ANIMATION
        )}
      >
        <div className="flex justify-center pt-3 pb-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-white/30 light:bg-gray-300" />
        </div>
```

After:
```tsx
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
```

- [ ] **Run all tests**

```bash
npm run test -- tests/unit/modal-layout.test.tsx
```

Expected: both tests pass.

- [ ] **Run full suite**

```bash
npm run test
```

Expected: same pass count as before this task series began (pre-existing failures unchanged, no new failures introduced).

- [ ] **Commit**

```bash
git add src/app/@modal/layout.tsx tests/unit/modal-layout.test.tsx
git commit -m "fix(modal): wire ModalSkeleton drag handle — was cosmetic-only, now dismissible"
```
