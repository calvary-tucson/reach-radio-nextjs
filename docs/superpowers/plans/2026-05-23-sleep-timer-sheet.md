# Sleep Timer Bottom Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sleep timer's page navigation with a bottom sheet modal that slides up from the bottom, has a drag-to-dismiss handle, and supports both timer-selection and active-countdown states.

**Architecture:** Port `useSheetDrag` hook (zero deps, pure touch events) from calvarytucson-nextjs. Build `SleepTimerSheet` using `createPortal` with ARIA attributes and slide-up animation. Convert `SleepTimerButton` from a `Link` to a `button` that owns local `open` state and renders the sheet.

**Tech Stack:** React 19, Zustand (`useMediaStore`), Tailwind CSS v4, Vitest + Testing Library

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/hooks/useSheetDrag.ts` | Create | Touch drag-to-dismiss gesture logic |
| `src/components/home/SleepTimerSheet.tsx` | Create | Bottom sheet with timer UI (both states) |
| `src/components/home/SleepTimerButton.tsx` | Modify | Link → button that controls sheet open state |
| `tests/unit/sleep-timer-sheet.test.tsx` | Create | Component unit tests |
| `tests/unit/sleep-timer-button.test.tsx` | Create | Button + sheet integration tests |

---

### Task 1: Port useSheetDrag hook

**Files:**
- Create: `src/lib/hooks/useSheetDrag.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/hooks/useSheetDrag.ts
import { type RefObject, useCallback, useRef } from 'react'

const DISMISS_THRESHOLD = 120
const VELOCITY_THRESHOLD = 0.5

interface UseSheetDragOptions {
  onDismiss: () => void
  contentRef: RefObject<HTMLDivElement | null>
}

export function useSheetDrag({ onDismiss, contentRef }: UseSheetDragOptions) {
  const startY = useRef(0)
  const startTime = useRef(0)
  const currentY = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    startTime.current = Date.now()
    currentY.current = 0
    if (contentRef.current) {
      contentRef.current.style.transition = 'none'
    }
  }, [contentRef])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - startY.current
    currentY.current = Math.max(0, deltaY)
    if (contentRef.current) {
      contentRef.current.style.transform = `translateY(${currentY.current}px)`
      contentRef.current.style.opacity = String(
        Math.max(0.5, 1 - currentY.current / 400)
      )
    }
  }, [contentRef])

  const onTouchEnd = useCallback(() => {
    const elapsed = Date.now() - startTime.current
    const velocity = currentY.current / elapsed

    if (currentY.current > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
        contentRef.current.style.transform = 'translateY(100%)'
        contentRef.current.style.opacity = '0'
      }
      setTimeout(onDismiss, 150)
    } else {
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
        contentRef.current.style.transform = 'translateY(0)'
        contentRef.current.style.opacity = '1'
      }
    }
  }, [contentRef, onDismiss])

  return { onTouchStart, onTouchMove, onTouchEnd }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/hooks/useSheetDrag.ts
git commit -m "feat: add useSheetDrag hook for bottom sheet touch dismiss"
```

---

### Task 2: Build SleepTimerSheet component

**Files:**
- Create: `src/components/home/SleepTimerSheet.tsx`
- Create: `tests/unit/sleep-timer-sheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/unit/sleep-timer-sheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SleepTimerSheet } from '@/components/home/SleepTimerSheet'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  }),
}))

beforeEach(() => {
  useMediaStore.setState({
    sleepTimerActive: false,
    remainingSleepSeconds: 0,
  })
})

describe('SleepTimerSheet', () => {
  it('renders nothing when open is false', () => {
    render(<SleepTimerSheet open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders timer options when open and timer not active', () => {
    render(<SleepTimerSheet open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('5m')).toBeInTheDocument()
    expect(screen.getByText('30m')).toBeInTheDocument()
    expect(screen.getByText('60m')).toBeInTheDocument()
  })

  it('renders countdown when open and timer active', () => {
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 300 })
    render(<SleepTimerSheet open={true} onClose={vi.fn()} />)
    expect(screen.getByText('05:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel timer/i })).toBeInTheDocument()
  })

  it('starts timer and calls onClose when option selected', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<SleepTimerSheet open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('15m'))
    expect(useMediaStore.getState().sleepTimerActive).toBe(true)
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(900)
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('cancels timer and calls onClose when cancel clicked', () => {
    vi.useFakeTimers()
    useMediaStore.setState({ sleepTimerActive: true, remainingSleepSeconds: 300 })
    const onClose = vi.fn()
    render(<SleepTimerSheet open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel timer/i }))
    expect(useMediaStore.getState().sleepTimerActive).toBe(false)
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(0)
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('calls onClose when backdrop clicked', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<SleepTimerSheet open={true} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- tests/unit/sleep-timer-sheet.test.tsx
```
Expected: `Cannot find module '@/components/home/SleepTimerSheet'`

- [ ] **Step 3: Create SleepTimerSheet component**

```tsx
// src/components/home/SleepTimerSheet.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMediaStore } from '@/lib/store/media-store'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'

const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60]

interface SleepTimerSheetProps {
  open: boolean
  onClose: () => void
}

export function SleepTimerSheet({ open, onClose }: SleepTimerSheetProps) {
  const [visible, setVisible] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const firstBtnRef = useRef<HTMLButtonElement>(null)

  const active = useMediaStore((s) => s.sleepTimerActive)
  const remainingSeconds = useMediaStore((s) => s.remainingSleepSeconds)
  const startSleepTimer = useMediaStore((s) => s.startSleepTimer)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 280)
  }, [onClose])

  const drag = useSheetDrag({ onDismiss: handleClose, contentRef: sheetRef })

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      setVisible(true)
      firstBtnRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, handleClose])

  if (!open) return null

  const minutes = Math.floor(remainingSeconds / 60)
  const secs = remainingSeconds % 60

  function start(mins: number) {
    startSleepTimer(mins * 60)
    handleClose()
  }

  function cancel() {
    setSleepTimerActive(false)
    setRemainingSleepSeconds(0)
    handleClose()
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Sleep timer">
      <div
        data-testid="sheet-backdrop"
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className={`fixed inset-x-0 bottom-0 z-50 bg-gray-800 rounded-t-2xl transition-transform duration-[280ms] ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={drag.onTouchStart}
          onTouchMove={drag.onTouchMove}
          onTouchEnd={drag.onTouchEnd}
        >
          <div className="h-1 w-10 rounded-full bg-white/30" />
        </div>
        <div className="px-6 pb-10 pt-2">
          <h2 className="text-white text-xl font-bold text-center mb-6">Sleep Timer</h2>
          {active ? (
            <div className="text-center">
              <p
                className="text-white text-5xl font-mono mb-2"
                aria-live="polite"
                aria-atomic="true"
              >
                {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </p>
              <p className="text-white/60 text-sm mb-8">
                Radio stops in {minutes}m {secs}s
              </p>
              <button
                ref={firstBtnRef}
                onClick={cancel}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-semibold text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                Cancel Timer
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {TIMER_OPTIONS.map((mins, i) => (
                <button
                  key={mins}
                  ref={i === 0 ? firstBtnRef : undefined}
                  onClick={() => start(mins)}
                  className="bg-gray-700 text-white py-5 rounded-xl font-semibold text-lg hover:bg-gray-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  {mins}m
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- tests/unit/sleep-timer-sheet.test.tsx
```
Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/SleepTimerSheet.tsx tests/unit/sleep-timer-sheet.test.tsx
git commit -m "feat: add SleepTimerSheet bottom sheet component"
```

---

### Task 3: Update SleepTimerButton

**Files:**
- Modify: `src/components/home/SleepTimerButton.tsx`
- Create: `tests/unit/sleep-timer-button.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/unit/sleep-timer-button.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SleepTimerButton } from '@/components/home/SleepTimerButton'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

beforeEach(() => {
  useMediaStore.setState({ sleepTimerActive: false, remainingSleepSeconds: 0 })
})

describe('SleepTimerButton', () => {
  it('renders a button with sleep timer label', () => {
    render(<SleepTimerButton />)
    expect(screen.getByRole('button', { name: /sleep timer/i })).toBeInTheDocument()
  })

  it('does not render a link', () => {
    render(<SleepTimerButton />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('sheet is not visible before button click', () => {
    render(<SleepTimerButton />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the sheet when clicked', () => {
    render(<SleepTimerButton />)
    fireEvent.click(screen.getByRole('button', { name: /sleep timer/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows all timer options in the sheet after click', () => {
    render(<SleepTimerButton />)
    fireEvent.click(screen.getByRole('button', { name: /sleep timer/i }))
    expect(screen.getByText('5m')).toBeInTheDocument()
    expect(screen.getByText('15m')).toBeInTheDocument()
    expect(screen.getByText('60m')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- tests/unit/sleep-timer-button.test.tsx
```
Expected: FAIL — current `SleepTimerButton` renders a `Link`, not a button.

- [ ] **Step 3: Rewrite SleepTimerButton**

```tsx
// src/components/home/SleepTimerButton.tsx
'use client'

import { useState } from 'react'
import { SleepTimerSheet } from './SleepTimerSheet'

export function SleepTimerButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Sleep Timer"
        className="bg-gray-500 rounded-full p-1 w-9 h-9 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>
      <SleepTimerSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
```

- [ ] **Step 4: Run button tests — verify they pass**

```bash
npm test -- tests/unit/sleep-timer-button.test.tsx
```
Expected: All 5 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: All tests pass. Zero regressions.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/SleepTimerButton.tsx tests/unit/sleep-timer-button.test.tsx
git commit -m "feat(sleep-timer): replace page navigation with bottom sheet modal"
```

---

### Task 4: Smoke test in browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000` (home/listen page). Check:
- Clock icon button is visible in the player controls
- Clicking opens a sheet that slides up from the bottom
- All 6 time options (5m, 10m, 15m, 30m, 45m, 60m) are visible
- Selecting a time starts the timer and closes the sheet
- Tapping the clock icon again re-opens the sheet showing the countdown
- Cancel Timer button stops the timer and closes the sheet
- Tapping the dark backdrop dismisses the sheet
- On mobile (or DevTools mobile emulation): drag handle works, dragging down dismisses

- [ ] **Step 3: Build check**

```bash
npm run build
```
Expected: Clean build, zero TypeScript errors.
