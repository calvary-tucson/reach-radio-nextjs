# UI Library Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install and integrate lucide-react, Radix UI primitives, CVA, sonner, and tw-animate-css into reach-radio-nextjs, applying each to relevant existing components.

**Architecture:** Install all packages, create shadcn-style primitive wrappers in `src/components/ui/`, then update existing components to use them. No structural refactors — only targeted replacements. `TooltipProvider` and `Toaster` go in `layout.tsx` to cover the full component tree.

**Tech Stack:** lucide-react, @radix-ui/react-slider, @radix-ui/react-tooltip, @radix-ui/react-slot, @radix-ui/react-dialog, @radix-ui/react-tabs, @radix-ui/react-dropdown-menu, class-variance-authority, sonner, tw-animate-css (devDep), shadcn (devDep)

---

### Task 1: Install packages

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install lucide-react@^1.7.0 @radix-ui/react-slider@^1.3.6 @radix-ui/react-tooltip@^1.2.8 @radix-ui/react-dialog@^1.1.15 @radix-ui/react-tabs@^1.1.13 @radix-ui/react-dropdown-menu@^2.1.16 class-variance-authority@^0.7.1 sonner@^2.0.7
```

Note: `@radix-ui/react-slot` is already in `package.json`. Skip if already installed — npm install is idempotent.

- [ ] **Step 2: Install dev dependencies**

```bash
npm install --save-dev shadcn tw-animate-css
```

- [ ] **Step 3: Verify install succeeded**

```bash
node -e "require('lucide-react'); require('sonner'); require('class-variance-authority'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install ui library dependencies (lucide, radix, cva, sonner)"
```

---

### Task 2: Add tw-animate-css to globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add import at top of globals.css**

In `src/app/globals.css`, add as the second line (after `@import "tailwindcss"`):

```css
@import "tailwindcss";
@import "tw-animate-css";
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build 2>&1 | tail -5
```

Expected: no CSS import errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add tw-animate-css for animation utilities"
```

---

### Task 3: Create ui/button.tsx with TDD

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `tests/unit/button.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/button.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('has cursor-pointer class', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveClass('cursor-pointer')
  })

  it('renders disabled state with cursor-not-allowed', () => {
    render(<Button disabled>Click me</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).toHaveClass('cursor-not-allowed')
  })

  it('renders as child element with asChild', () => {
    render(
      <Button asChild>
        <a href="/test">Link</a>
      </Button>
    )
    expect(screen.getByRole('link', { name: 'Link' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('applies variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-red-600')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose tests/unit/button.test.tsx 2>&1 | tail -15
```

Expected: FAIL — `Cannot find module '@/components/ui/button'`

- [ ] **Step 3: Create src/components/ui/button.tsx**

```tsx
'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--color-brand-green)] text-white hover:opacity-90',
        secondary: 'bg-gray-700 text-white hover:bg-gray-600',
        ghost: 'text-white hover:bg-white/10',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose tests/unit/button.test.tsx 2>&1 | tail -15
```

Expected: 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/button.tsx tests/unit/button.test.tsx
git commit -m "feat(ui): add CVA-based Button primitive with asChild support"
```

---

### Task 4: Create ui/slider.tsx

**Files:**
- Create: `src/components/ui/slider.tsx`

- [ ] **Step 1: Create src/components/ui/slider.tsx**

```tsx
'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-white/20">
      <SliderPrimitive.Range className="absolute h-full bg-white" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-3 w-3 rounded-full bg-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors relating to slider.tsx.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/slider.tsx
git commit -m "feat(ui): add Radix Slider primitive wrapper"
```

---

### Task 5: Create ui/tooltip.tsx and ui/dialog.tsx

**Files:**
- Create: `src/components/ui/tooltip.tsx`
- Create: `src/components/ui/dialog.tsx`

- [ ] **Step 1: Create src/components/ui/tooltip.tsx**

```tsx
'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded bg-gray-800 px-3 py-1.5 text-xs text-white shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
```

- [ ] **Step 2: Create src/components/ui/dialog.tsx**

```tsx
'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl bg-gray-800 p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-white', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-white/60', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/tooltip.tsx src/components/ui/dialog.tsx
git commit -m "feat(ui): add Radix Tooltip and Dialog primitive wrappers"
```

---

### Task 6: Update VolumeControl — Radix Slider + lucide icons

**Files:**
- Modify: `src/components/home/VolumeControl.tsx`

Current: uses `<input type="range">` and four hand-crafted SVG icons.  
After: uses `<Slider>` from `ui/slider.tsx` and lucide `Volume`/`Volume1`/`Volume2`/`VolumeX`.

- [ ] **Step 1: Replace VolumeControl.tsx**

Replace the entire content of `src/components/home/VolumeControl.tsx` with:

```tsx
'use client'

import { Volume, Volume1, Volume2, VolumeX } from 'lucide-react'
import { useMediaStore } from '@/lib/store/media-store'
import { Slider } from '@/components/ui/slider'

export function VolumeControl() {
  const volume = useMediaStore((s) => s.volume)
  const isMuted = useMediaStore((s) => s.isMuted)
  const setVolume = useMediaStore((s) => s.setVolume)
  const toggleMute = useMediaStore((s) => s.toggleMute)

  const effectiveVolume = isMuted ? 0 : volume

  return (
    <>
      {/* Mobile: mute button only */}
      <button
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        className="hidden w-11 h-11 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-white rounded-full cursor-pointer"
      >
        <VolumeIcon volume={effectiveVolume} />
      </button>

      {/* Desktop: slider + mute button */}
      <div className="hidden md:flex items-center gap-2 w-28">
        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className="flex-shrink-0 focus-visible:ring-2 focus-visible:ring-white rounded cursor-pointer"
        >
          <VolumeIcon volume={effectiveVolume} />
        </button>
        <Slider
          min={0}
          max={100}
          value={[volume]}
          onValueChange={([v]) => setVolume(v)}
          aria-label="Volume"
          className="w-full"
        />
      </div>
    </>
  )
}

function VolumeIcon({ volume }: { volume: number }) {
  const props = { size: 18, className: 'text-white' } as const
  if (volume <= 0) return <VolumeX {...props} />
  if (volume <= 33) return <Volume {...props} />
  if (volume <= 66) return <Volume1 {...props} />
  return <Volume2 {...props} />
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "volumecontrol\|volume-control" || echo "No VolumeControl errors"
```

Expected: `No VolumeControl errors`

- [ ] **Step 3: Run existing tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass (VolumeControl has no unit tests, so no regressions expected).

- [ ] **Step 4: Commit**

```bash
git add src/components/home/VolumeControl.tsx
git commit -m "feat(volume): replace range input with Radix Slider, replace SVG icons with lucide"
```

---

### Task 7: Update SleepTimerButton — lucide Clock + Tooltip

**Files:**
- Modify: `src/components/home/SleepTimerButton.tsx`
- Modify: `tests/unit/sleep-timer-button.test.tsx`

Note: `Tooltip` uses context from `TooltipProvider`. The provider will be added to `layout.tsx` in Task 13. For tests, wrap with `TooltipProvider` manually.

- [ ] **Step 1: Replace SleepTimerButton.tsx**

Replace the entire content of `src/components/home/SleepTimerButton.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SleepTimerSheet } from './SleepTimerSheet'

export function SleepTimerButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Sleep Timer"
            aria-expanded={open}
            aria-haspopup="dialog"
            className="bg-gray-500 rounded-full p-1 w-9 h-9 flex items-center justify-center cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <Clock className="w-5 h-5 text-white" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Sleep Timer</TooltipContent>
      </Tooltip>
      <SleepTimerSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
```

- [ ] **Step 2: Update sleep-timer-button test to wrap with TooltipProvider**

Replace the entire content of `tests/unit/sleep-timer-button.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SleepTimerButton } from '@/components/home/SleepTimerButton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMediaStore } from '@/lib/store/media-store'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  }),
}))

function renderWithProvider() {
  return render(
    <TooltipProvider>
      <SleepTimerButton />
    </TooltipProvider>
  )
}

beforeEach(() => {
  useMediaStore.setState({ sleepTimerActive: false, remainingSleepSeconds: 0 })
})

describe('SleepTimerButton', () => {
  it('renders a button with sleep timer label', () => {
    renderWithProvider()
    expect(screen.getByRole('button', { name: /sleep timer/i })).toBeInTheDocument()
  })

  it('does not render a link', () => {
    renderWithProvider()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('sheet is not visible before button click', () => {
    renderWithProvider()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the sheet when clicked', () => {
    renderWithProvider()
    fireEvent.click(screen.getByRole('button', { name: /sleep timer/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows all timer options in the sheet after click', () => {
    renderWithProvider()
    fireEvent.click(screen.getByRole('button', { name: /sleep timer/i }))
    expect(screen.getByText('5m')).toBeInTheDocument()
    expect(screen.getByText('15m')).toBeInTheDocument()
    expect(screen.getByText('60m')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it passes**

```bash
npm test -- --reporter=verbose tests/unit/sleep-timer-button.test.tsx 2>&1 | tail -15
```

Expected: 5 tests passing.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/SleepTimerButton.tsx tests/unit/sleep-timer-button.test.tsx
git commit -m "feat(sleep-timer): replace clock SVG with lucide Clock, add Tooltip"
```

---

### Task 8: Update SleepTimerSheet — lucide X for close button

**Files:**
- Modify: `src/components/home/SleepTimerSheet.tsx`

- [ ] **Step 1: Replace close button SVG with lucide X**

In `src/components/home/SleepTimerSheet.tsx`, add the import at the top (after the existing imports):

```tsx
import { X } from 'lucide-react'
```

Then find the close button SVG (lines 104–109) and replace the `<svg>` element inside it with:

```tsx
<X className="w-5 h-5" aria-hidden="true" />
```

The full close button after the change should look like:

```tsx
<button
  type="button"
  onClick={handleClose}
  className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
  aria-label="Close sleep timer"
>
  <X className="w-5 h-5" aria-hidden="true" />
</button>
```

- [ ] **Step 2: Run sleep-timer-sheet tests**

```bash
npm test -- --reporter=verbose tests/unit/sleep-timer-sheet.test.tsx 2>&1 | tail -15
```

Expected: all tests pass (tests check behavior/labels, not SVG markup).

- [ ] **Step 3: Commit**

```bash
git add src/components/home/SleepTimerSheet.tsx
git commit -m "style(sleep-timer-sheet): replace close SVG with lucide X"
```

---

### Task 9: Update PlayPauseButton — lucide Play/Pause

**Files:**
- Modify: `src/components/media-bar/PlayPauseButton.tsx`

Note: Current component uses custom filled SVG paths. Lucide icons are stroke-based by default; set `strokeWidth={0}` and `fill="white"` (or use `className="fill-white"`) to replicate filled style.

- [ ] **Step 1: Replace PlayPauseButton.tsx**

Replace the entire content of `src/components/media-bar/PlayPauseButton.tsx` with:

```tsx
'use client'

import { Pause, Play } from 'lucide-react'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

interface PlayPauseButtonProps {
  size?: 'sm' | 'lg'
}

export function PlayPauseButton({ size = 'sm' }: PlayPauseButtonProps) {
  const isPlaying = useMediaStore((s) => s.isPlaying)
  const isBuffering = useMediaStore((s) => s.isBuffering)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)

  function toggle() {
    const next = !isPlaying
    setIsPlaying(next)
    postMessageToNative(JSON.stringify({ isPlaying: next }))
  }

  const btnSize = size === 'lg' ? 'md:w-16 md:h-16 w-14 h-14' : 'w-11 h-11'
  const iconSize = size === 'lg' ? 28 : 20

  return (
    <button
      onClick={toggle}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      className={`${btnSize} rounded-full bg-[var(--color-brand-green)] flex items-center justify-center flex-shrink-0 cursor-pointer`}
    >
      {isBuffering ? (
        <span
          className={`border-2 border-white border-t-transparent rounded-full motion-safe:animate-spin`}
          style={{ width: iconSize, height: iconSize }}
        />
      ) : isPlaying ? (
        <Pause size={iconSize} className="fill-white" strokeWidth={0} />
      ) : (
        <Play size={iconSize} className="fill-white" strokeWidth={0} />
      )}
    </button>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/media-bar/PlayPauseButton.tsx
git commit -m "style(player): replace play/pause SVGs with lucide Play/Pause"
```

---

### Task 10: Update SearchInput — lucide Search + X

**Files:**
- Modify: `src/components/global/SearchInput.tsx`

- [ ] **Step 1: Replace inline SVGs with lucide icons**

Replace the entire content of `src/components/global/SearchInput.tsx` with:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  'aria-label'?: string
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search…',
  className,
  autoFocus,
  'aria-label': ariaLabel,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={cn('relative', className)}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="w-full rounded-lg border border-white/20 bg-white/5 pl-10 pr-10 py-2 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); onClear?.() }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded border border-white/20 bg-white/5 text-white/60 hover:text-white/80 hover:border-white/40 cursor-pointer"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/global/SearchInput.tsx
git commit -m "style(search): replace inline SVGs with lucide Search and X"
```

---

### Task 11: Replace ArrowLeftIcon with lucide ArrowLeft

**Files:**
- Delete: `src/components/icons/ArrowLeftIcon.tsx`
- Delete: `tests/unit/arrow-left-icon.test.tsx`
- Modify: `src/app/teachers/[slug]/page.tsx`

- [ ] **Step 1: Update teacher detail page to use lucide ArrowLeft**

In `src/app/teachers/[slug]/page.tsx`, replace:

```tsx
import { ArrowLeftIcon } from '@/components/icons/ArrowLeftIcon'
```

with:

```tsx
import { ArrowLeft } from 'lucide-react'
```

Then replace the usage:

```tsx
<ArrowLeftIcon className="w-4 h-4" />
```

with:

```tsx
<ArrowLeft className="w-4 h-4" aria-hidden="true" />
```

- [ ] **Step 2: Delete the old icon file and its test**

```bash
rm src/components/icons/ArrowLeftIcon.tsx
rm tests/unit/arrow-left-icon.test.tsx
```

- [ ] **Step 3: Remove empty icons directory if empty**

```bash
rmdir src/components/icons 2>/dev/null || echo "icons dir not empty or already removed"
```

- [ ] **Step 4: Run full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass (arrow-left-icon test is gone, no regressions).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(icons): replace ArrowLeftIcon with lucide ArrowLeft, remove icons directory"
```

---

### Task 12: Update ContactForm — sonner toasts

**Files:**
- Modify: `src/components/about/ContactForm.tsx`

Current: inline `<p>` elements for success/error, errorRef focuses the error paragraph.
After: `toast.success` / `toast.error` from sonner. Remove errorRef.

- [ ] **Step 1: Replace ContactForm.tsx**

Replace the entire content of `src/components/about/ContactForm.tsx` with:

```tsx
'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { submitContact, type ContactState } from '@/actions/contact'

const initial: ContactState = { success: false }

export function ContactForm() {
  const [state, action, isPending] = useActionState(submitContact, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const timestampRef = useRef(Date.now().toString())

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      toast.success("Message sent! We'll be in touch.")
    }
  }, [state.success])

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state.error])

  return (
    <form ref={formRef} action={action} className="space-y-4 max-w-lg">
      {/* Honeypot fields */}
      <div className="absolute left-[-9999px] top-[-9999px]" aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="url" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="homepage" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="phone" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>
      <input type="hidden" name="timestamp" value={timestampRef.current} />

      <div>
        <label htmlFor="name" className="text-white/80 text-sm block mb-1">Name *</label>
        <input
          id="name" name="name" type="text" required minLength={2} maxLength={100}
          className="w-full bg-gray-700/50 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white"
        />
      </div>
      <div>
        <label htmlFor="email" className="text-white/80 text-sm block mb-1">Email *</label>
        <input
          id="email" name="email" type="email" required
          className="w-full bg-gray-700/50 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white"
        />
      </div>
      <div>
        <label htmlFor="message" className="text-white/80 text-sm block mb-1">Message *</label>
        <textarea
          id="message" name="message" required rows={5} minLength={10} maxLength={2000}
          className="w-full bg-gray-700/50 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white resize-none"
        />
      </div>

      <label className="flex gap-3 cursor-pointer items-start">
        <input type="checkbox" name="gdprConsent" required className="mt-1" />
        <span className="text-white text-sm leading-relaxed">
          I consent to having my submitted information stored for the purpose of responding to my inquiry. *
        </span>
      </label>

      <button
        type="submit" disabled={isPending}
        className="bg-[var(--color-brand-green)] text-white px-6 py-2 rounded font-medium text-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {isPending ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass (`action-contact.test.ts` tests the server action, not the component, so it's unaffected).

- [ ] **Step 3: Commit**

```bash
git add src/components/about/ContactForm.tsx
git commit -m "feat(contact): replace inline status messages with sonner toasts"
```

---

### Task 13: Update layout.tsx — Toaster + TooltipProvider

**Files:**
- Modify: `src/app/layout.tsx`

`TooltipProvider` must wrap all tooltip consumers (including `SleepTimerButton` deep in the tree). `Toaster` from sonner renders the toast portal.

- [ ] **Step 1: Add imports to layout.tsx**

In `src/app/layout.tsx`, add these two imports after the existing component imports:

```tsx
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
```

- [ ] **Step 2: Wrap body content with TooltipProvider and add Toaster**

In the `return` of `RootLayout`, wrap the full `<body>` content in `<TooltipProvider delayDuration={500}>` and add `<Toaster>` before the closing `</body>`.

The `<body>` should look like:

```tsx
<body className={`bg-[var(--color-brand-purple)] text-white min-h-screen${!isMobileApp ? ' pb-[152px]' : ''}`} data-app={isMobileApp ? 'true' : undefined}>
  <TooltipProvider delayDuration={500}>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded">
      Skip to main content
    </a>
    <BridgeInit />
    {!isMobileApp && <AudioProvider streamUrl={streamUrl} />}
    {!isMobileApp && <SleepTimerProvider />}
    {!isMobileApp && <Header />}
    {!isMobileApp && <MobileHeader />}
    <main
      id="main-content"
      className={!isMobileApp ? 'pt-16' : ''}
      style={isMobileApp ? { paddingBottom: 'var(--safe-bottom)' } : undefined}
    >{children}</main>
    {!isMobileApp && <Footer />}
    {!isMobileApp && <MobileNav />}
    <MediaBar />
    <Toaster richColors position="top-center" />
  </TooltipProvider>
</body>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(layout): add TooltipProvider and Toaster to root layout"
```

---

### Task 14: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test 2>&1
```

Expected: all tests pass, no failures.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 4: Verify new ui/ files exist**

```bash
ls src/components/ui/
```

Expected output includes: `button.tsx  dialog.tsx  skeleton.tsx  slider.tsx  tooltip.tsx`

- [ ] **Step 5: Verify ArrowLeftIcon is gone**

```bash
ls src/components/icons/ 2>/dev/null && echo "icons dir still exists" || echo "icons dir removed"
grep -r "ArrowLeftIcon" src/ --include="*.tsx" || echo "No ArrowLeftIcon references"
```

Expected: `icons dir removed` and `No ArrowLeftIcon references`
