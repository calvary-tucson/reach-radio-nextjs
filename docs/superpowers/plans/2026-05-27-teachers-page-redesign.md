# Teachers Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add modal sheet infrastructure (ported from calvarytucson-nextjs), move teacher search into an intercepting-route sheet, and replace the home-page-style FeaturedTeachers carousel with a `RecommendedTeachers` grid section on the Teachers page.

**Architecture:** Modal infrastructure uses Next.js `@modal` parallel route slot + Radix Dialog + Zustand store, ported verbatim from calvarytucson-nextjs with theme colors swapped (purple → gray-800). Teachers page shows a `PassiveSearchBar` (tap-to-open sheet) + `RecommendedTeachers` server component + `TeachersClientView` (stripped of inline search/filter).

**Tech Stack:** Next.js App Router (intercepting routes, parallel routes), Radix Dialog, Zustand 5, Vitest + React Testing Library, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-05-27-teachers-page-redesign.md`

---

## Group A — Modal Infrastructure

### Task 1: Add modal keyframes to globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add keyframes**

Append to `src/app/globals.css`:

```css
/* Modal animations */
@keyframes modal-slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes modal-slide-down {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(12px); }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add modal-slide-up/down and fade-in/out keyframes"
```

---

### Task 2: Create modal constants

**Files:**
- Create: `src/lib/constants/modal.ts`

- [ ] **Step 1: Create the file**

```typescript
export const EXIT_DURATION = 150

export const MODAL_ENTER_ANIMATION =
  'motion-safe:animate-[modal-slide-up_0.2s_cubic-bezier(0.32,0.72,0,1)]'
export const MODAL_EXIT_ANIMATION =
  'motion-safe:animate-[modal-slide-down_0.15s_ease-in_forwards]'
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/constants/modal.ts
git commit -m "feat: add modal animation constants"
```

---

### Task 3: Create modal store

**Files:**
- Create: `src/lib/stores/modal.ts`
- Test: `tests/unit/modal-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/modal-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useModalStore } from '@/lib/stores/modal'

beforeEach(() => {
  useModalStore.setState({
    expectingRoute: false,
    isOpen: false,
    isClosing: false,
    title: null,
    originPath: null,
    keepAlive: false,
    triggerRef: null,
  })
})

describe('useModalStore', () => {
  it('openModal sets isOpen and expectingRoute', () => {
    useModalStore.getState().openModal('Test', '/page')
    const s = useModalStore.getState()
    expect(s.isOpen).toBe(true)
    expect(s.expectingRoute).toBe(true)
    expect(s.title).toBe('Test')
    expect(s.originPath).toBe('/page')
  })

  it('openModal twice keeps first originPath', () => {
    useModalStore.getState().openModal('First', '/first')
    useModalStore.getState().openModal('Second', '/second')
    expect(useModalStore.getState().originPath).toBe('/first')
  })

  it('startClosing sets isClosing', () => {
    useModalStore.getState().openModal()
    useModalStore.getState().startClosing()
    expect(useModalStore.getState().isClosing).toBe(true)
  })

  it('close resets all state', () => {
    useModalStore.getState().openModal('T', '/x')
    useModalStore.getState().close()
    const s = useModalStore.getState()
    expect(s.isOpen).toBe(false)
    expect(s.title).toBeNull()
    expect(s.originPath).toBeNull()
    expect(s.isClosing).toBe(false)
    expect(s.keepAlive).toBe(false)
  })

  it('routeExpected and routeArrived toggle expectingRoute', () => {
    useModalStore.getState().routeExpected()
    expect(useModalStore.getState().expectingRoute).toBe(true)
    useModalStore.getState().routeArrived()
    expect(useModalStore.getState().expectingRoute).toBe(false)
  })

  it('setKeepAlive updates keepAlive', () => {
    useModalStore.getState().setKeepAlive(true)
    expect(useModalStore.getState().keepAlive).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/modal-store.test.ts
```

Expected: `Cannot find module '@/lib/stores/modal'`

- [ ] **Step 3: Create the store**

Create `src/lib/stores/modal.ts`:

```typescript
import { create } from 'zustand'

interface ModalStore {
  expectingRoute: boolean
  isOpen: boolean
  isClosing: boolean
  title: string | null
  originPath: string | null
  keepAlive: boolean
  triggerRef: HTMLElement | null
  openModal: (title?: string, originPath?: string) => void
  setTriggerRef: (el: HTMLElement | null) => void
  routeExpected: () => void
  routeArrived: () => void
  startClosing: () => void
  close: () => void
  setKeepAlive: (value: boolean) => void
}

export const useModalStore = create<ModalStore>((set) => ({
  expectingRoute: false,
  isOpen: false,
  isClosing: false,
  title: null,
  originPath: null,
  keepAlive: false,
  triggerRef: null,
  openModal: (title, originPath) =>
    set((state) => ({
      expectingRoute: true,
      isOpen: true,
      isClosing: false,
      title: title ?? null,
      originPath: !state.isOpen ? (originPath ?? null) : state.originPath,
    })),
  setTriggerRef: (el) => set({ triggerRef: el }),
  routeExpected: () => set({ expectingRoute: true }),
  routeArrived: () => set({ expectingRoute: false }),
  startClosing: () => set({ isClosing: true }),
  close: () => set({
    isOpen: false,
    expectingRoute: false,
    isClosing: false,
    title: null,
    keepAlive: false,
    originPath: null,
    triggerRef: null,
  }),
  setKeepAlive: (value) => set({ keepAlive: value }),
}))
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/modal-store.test.ts
```

Expected: all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/modal.ts tests/unit/modal-store.test.ts
git commit -m "feat: add modal Zustand store"
```

---

### Task 4: Create navigation store

**Files:**
- Create: `src/lib/stores/navigation-store.ts`
- Test: `tests/unit/navigation-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/navigation-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNavigationStore } from '@/lib/stores/navigation-store'

beforeEach(() => {
  useNavigationStore.setState({ navigating: false, title: null })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useNavigationStore', () => {
  it('start sets navigating after 150ms delay', () => {
    useNavigationStore.getState().start('Page')
    expect(useNavigationStore.getState().navigating).toBe(false)
    vi.advanceTimersByTime(150)
    expect(useNavigationStore.getState().navigating).toBe(true)
    expect(useNavigationStore.getState().title).toBe('Page')
  })

  it('reset prevents navigating from showing if called before delay', () => {
    useNavigationStore.getState().start()
    useNavigationStore.getState().reset()
    vi.advanceTimersByTime(200)
    expect(useNavigationStore.getState().navigating).toBe(false)
  })

  it('reset clears navigating when already showing', () => {
    useNavigationStore.getState().start()
    vi.advanceTimersByTime(200)
    expect(useNavigationStore.getState().navigating).toBe(true)
    useNavigationStore.getState().reset()
    expect(useNavigationStore.getState().navigating).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/navigation-store.test.ts
```

Expected: `Cannot find module '@/lib/stores/navigation-store'`

- [ ] **Step 3: Create the store**

Create `src/lib/stores/navigation-store.ts`:

```typescript
import { create } from 'zustand'

const SHOW_DELAY_MS = 150

interface NavigationStore {
  navigating: boolean
  title: string | null
  start: (title?: string) => void
  reset: () => void
}

let delayTimer: ReturnType<typeof setTimeout> | null = null

export const useNavigationStore = create<NavigationStore>((set) => ({
  navigating: false,
  title: null,
  start: (title) => {
    if (delayTimer) clearTimeout(delayTimer)
    delayTimer = setTimeout(() => {
      delayTimer = null
      set({ navigating: true, title: title ?? null })
    }, SHOW_DELAY_MS)
  },
  reset: () => {
    if (delayTimer) {
      clearTimeout(delayTimer)
      delayTimer = null
    }
    set({ navigating: false, title: null })
  },
}))
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/navigation-store.test.ts
```

Expected: all 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/navigation-store.ts tests/unit/navigation-store.test.ts
git commit -m "feat: add navigation Zustand store"
```

---

### Task 5: Create ModalContext

**Files:**
- Create: `src/components/modals/ModalContext.tsx`
- Test: `tests/unit/modal-context.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/modal-context.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModalProvider, useModal } from '@/components/modals/ModalContext'

function ConsumerComponent() {
  const { isClosing } = useModal()
  return <div>{isClosing ? 'closing' : 'open'}</div>
}

function ThrowingComponent() {
  useModal()
  return null
}

describe('ModalContext', () => {
  it('provides values to children via useModal', () => {
    render(
      <ModalProvider onDismiss={vi.fn()} onBack={vi.fn()} isClosing={false}>
        <ConsumerComponent />
      </ModalProvider>
    )
    expect(screen.getByText('open')).toBeInTheDocument()
  })

  it('useModal throws outside ModalProvider', () => {
    expect(() => render(<ThrowingComponent />)).toThrow(
      'useModal must be used within ModalProvider'
    )
  })

  it('reflects isClosing=true', () => {
    render(
      <ModalProvider onDismiss={vi.fn()} onBack={vi.fn()} isClosing={true}>
        <ConsumerComponent />
      </ModalProvider>
    )
    expect(screen.getByText('closing')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/modal-context.test.tsx
```

Expected: `Cannot find module '@/components/modals/ModalContext'`

- [ ] **Step 3: Create the context**

Create `src/components/modals/ModalContext.tsx`:

```typescript
'use client'

import { createContext, useContext } from 'react'

interface ModalContextValue {
  onDismiss: () => void
  onBack: () => void
  isClosing: boolean
}

export const ModalContext = createContext<ModalContextValue | null>(null)

export function ModalProvider({
  children,
  onDismiss,
  onBack,
  isClosing,
}: ModalContextValue & { children: React.ReactNode }) {
  return (
    <ModalContext value={{ onDismiss, onBack, isClosing }}>
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

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/modal-context.test.tsx
```

Expected: all 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/ModalContext.tsx tests/unit/modal-context.test.tsx
git commit -m "feat: add ModalContext and ModalProvider"
```

---

### Task 6: Create SheetChrome

**Files:**
- Create: `src/components/modals/chrome/SheetChrome.tsx`
- Test: `tests/unit/sheet-chrome.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/sheet-chrome.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
import { ModalProvider } from '@/components/modals/ModalContext'
import { MODAL_ENTER_ANIMATION } from '@/lib/constants/modal'

vi.mock('@/lib/hooks/useSheetDrag', () => ({
  useSheetDrag: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  }),
}))

function Wrapper({ isClosing = false, onDismiss = vi.fn() } = {}) {
  return (
    <ModalProvider onDismiss={onDismiss} onBack={vi.fn()} isClosing={isClosing}>
      <SheetChrome title="Test Sheet">
        <p>Sheet content</p>
      </SheetChrome>
    </ModalProvider>
  )
}

describe('SheetChrome', () => {
  it('renders children', () => {
    render(<Wrapper />)
    expect(screen.getByText('Sheet content')).toBeInTheDocument()
  })

  it('renders title', () => {
    render(<Wrapper />)
    expect(screen.getByRole('heading', { name: 'Test Sheet' })).toBeInTheDocument()
  })

  it('close button calls onDismiss', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(<Wrapper onDismiss={onDismiss} />)
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('close button has cursor-pointer', () => {
    render(<Wrapper />)
    const btn = screen.getByRole('button', { name: /close/i })
    expect(btn.className).toContain('cursor-pointer')
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/sheet-chrome.test.tsx
```

Expected: `Cannot find module '@/components/modals/chrome/SheetChrome'`

- [ ] **Step 3: Create SheetChrome**

Create `src/components/modals/chrome/SheetChrome.tsx`:

```typescript
'use client'

import { X } from 'lucide-react'
import { useRef } from 'react'
import { useModal } from '@/components/modals/ModalContext'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
import { MODAL_ENTER_ANIMATION, MODAL_EXIT_ANIMATION } from '@/lib/constants/modal'
import { cn } from '@/lib/utils'

interface SheetChromeProps {
  children: React.ReactNode
  title?: string
  /** Wrap children in p-6 padding. Default true. */
  padded?: boolean
  className?: string
}

export function SheetChrome({ children, title, padded = true, className }: SheetChromeProps) {
  const { onDismiss, isClosing } = useModal()
  const contentRef = useRef<HTMLDivElement>(null)
  const drag = useSheetDrag({ onDismiss, contentRef })

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 flex items-end sm:items-center sm:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        ref={contentRef}
        className={cn(
          'w-full max-h-[90dvh] overflow-hidden flex flex-col border border-white/10 bg-gray-800 p-0',
          'rounded-t-2xl rounded-b-none h-[85dvh]',
          isClosing ? MODAL_EXIT_ANIMATION : MODAL_ENTER_ANIMATION,
          'sm:inset-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:w-[95vw] sm:rounded-2xl',
          className
        )}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Drag handle — mobile only */}
        <div
          className="flex justify-center pt-3 pb-2 sm:hidden cursor-grab active:cursor-grabbing touch-none shrink-0"
          onTouchStart={drag.onTouchStart}
          onTouchMove={drag.onTouchMove}
          onTouchEnd={drag.onTouchEnd}
        >
          <div className="h-1 w-10 rounded-full bg-white/30" />
        </div>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-white/10 bg-gray-800 px-6 py-4">
          {title ? (
            <h2 className="text-xl font-bold text-white">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {padded ? <div className="p-6">{children}</div> : children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/sheet-chrome.test.tsx
```

Expected: all 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/chrome/SheetChrome.tsx tests/unit/sheet-chrome.test.tsx
git commit -m "feat: add SheetChrome bottom-sheet component"
```

---

### Task 7: Create ModalLink

**Files:**
- Create: `src/components/modals/ModalLink.tsx`
- Test: `tests/unit/modal-link.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/modal-link.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModalLink } from '@/components/modals/ModalLink'

vi.mock('next/navigation', () => ({
  usePathname: () => '/teachers',
}))

vi.mock('@/lib/stores/modal', () => ({
  useModalStore: (selector: (s: { openModal: () => void; setTriggerRef: () => void }) => unknown) =>
    selector({ openModal: vi.fn(), setTriggerRef: vi.fn() }),
}))

vi.mock('@/lib/stores/navigation-store', () => ({
  useNavigationStore: (selector: (s: { reset: () => void }) => unknown) =>
    selector({ reset: vi.fn() }),
}))

describe('ModalLink', () => {
  it('renders an anchor element', () => {
    render(
      <ModalLink href="/teachers/search" modalTitle="Search Teachers">
        <span>Search</span>
      </ModalLink>
    )
    expect(screen.getByRole('link')).toBeInTheDocument()
  })

  it('renders children', () => {
    render(
      <ModalLink href="/teachers/search">
        <span>Search teachers</span>
      </ModalLink>
    )
    expect(screen.getByText('Search teachers')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/modal-link.test.tsx
```

Expected: `Cannot find module '@/components/modals/ModalLink'`

- [ ] **Step 3: Create ModalLink**

Create `src/components/modals/ModalLink.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps } from 'react'
import { useModalStore } from '@/lib/stores/modal'
import { useNavigationStore } from '@/lib/stores/navigation-store'

interface ModalLinkProps extends ComponentProps<typeof Link> {
  /** Title shown in the modal skeleton while the route loads */
  modalTitle?: string
}

export function ModalLink({ children, modalTitle, ...props }: ModalLinkProps) {
  const openModal = useModalStore((s) => s.openModal)
  const setTriggerRef = useModalStore((s) => s.setTriggerRef)
  const resetNav = useNavigationStore((s) => s.reset)
  const pathname = usePathname()

  return (
    <Link
      {...props}
      onNavigate={() => {
        setTriggerRef(document.activeElement instanceof HTMLElement ? document.activeElement : null)
        resetNav()
        openModal(modalTitle, pathname)
      }}
    >
      {children}
    </Link>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/modal-link.test.tsx
```

Expected: both tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/ModalLink.tsx tests/unit/modal-link.test.tsx
git commit -m "feat: add ModalLink — opens modal on client navigation"
```

---

### Task 8: Create PassiveSearchBar

**Files:**
- Create: `src/components/global/PassiveSearchBar.tsx`
- Test: `tests/unit/passive-search-bar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/passive-search-bar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PassiveSearchBar } from '@/components/global/PassiveSearchBar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('@/lib/stores/modal', () => ({
  useModalStore: (selector: (s: { openModal: () => void; setTriggerRef: () => void }) => unknown) =>
    selector({ openModal: vi.fn(), setTriggerRef: vi.fn() }),
}))

vi.mock('@/lib/stores/navigation-store', () => ({
  useNavigationStore: (selector: (s: { reset: () => void }) => unknown) =>
    selector({ reset: vi.fn() }),
}))

describe('PassiveSearchBar', () => {
  it('renders placeholder text', () => {
    render(<PassiveSearchBar href="/teachers/search" placeholder="Search teachers..." />)
    expect(screen.getByText('Search teachers...')).toBeInTheDocument()
  })

  it('renders a link pointing to the provided href', () => {
    render(<PassiveSearchBar href="/teachers/search" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/teachers/search')
  })

  it('link has cursor-pointer class', () => {
    render(<PassiveSearchBar href="/teachers/search" />)
    expect(screen.getByRole('link').className).toContain('cursor-pointer')
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/passive-search-bar.test.tsx
```

Expected: `Cannot find module '@/components/global/PassiveSearchBar'`

- [ ] **Step 3: Create PassiveSearchBar**

Create `src/components/global/PassiveSearchBar.tsx`:

```typescript
import { ModalLink } from '@/components/modals/ModalLink'
import { cn } from '@/lib/utils'

interface PassiveSearchBarProps {
  href: string
  placeholder?: string
  modalTitle?: string
  className?: string
}

export function PassiveSearchBar({
  href,
  placeholder = 'Search...',
  modalTitle,
  className,
}: PassiveSearchBarProps) {
  return (
    <ModalLink
      href={href}
      modalTitle={modalTitle ?? placeholder}
      className={cn(
        'flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer',
        className
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white/40 shrink-0"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <span className="text-white/40">{placeholder}</span>
    </ModalLink>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/passive-search-bar.test.tsx
```

Expected: all 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/global/PassiveSearchBar.tsx tests/unit/passive-search-bar.test.tsx
git commit -m "feat: add PassiveSearchBar — tappable search trigger for modal sheet"
```

---

### Task 9: Create @modal route defaults

**Files:**
- Create: `src/app/@modal/default.tsx`
- Create: `src/app/@modal/[...catchAll]/page.tsx`

- [ ] **Step 1: Create default.tsx**

Create `src/app/@modal/default.tsx`:

```typescript
export default function ModalRootDefault() {
  return null
}
```

- [ ] **Step 2: Create catch-all page**

Create `src/app/@modal/[...catchAll]/page.tsx`:

```typescript
export default function ModalCatchAll() {
  return null
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/@modal/default.tsx "src/app/@modal/[...catchAll]/page.tsx"
git commit -m "feat: add @modal parallel route defaults"
```

---

### Task 10: Create @modal layout (ModalLayout)

**Files:**
- Create: `src/app/@modal/layout.tsx`
- Test: `tests/unit/modal-layout.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/modal-layout.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useModalStore } from '@/lib/stores/modal'

vi.mock('next/navigation', () => ({
  usePathname: () => '/teachers',
  useRouter: () => ({ back: vi.fn() }),
}))

vi.mock('@radix-ui/react-dialog', async () => {
  const actual = await vi.importActual<typeof import('@radix-ui/react-dialog')>('@radix-ui/react-dialog')
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

async function loadLayout() {
  const mod = await import('@/app/@modal/layout')
  return mod.default
}

beforeEach(() => {
  useModalStore.setState({
    expectingRoute: false, isOpen: false, isClosing: false,
    title: null, originPath: null, keepAlive: false, triggerRef: null,
  })
})

describe('ModalLayout', () => {
  it('renders null when modal is closed', async () => {
    const ModalLayout = await loadLayout()
    const { container } = render(<ModalLayout><p>content</p></ModalLayout>)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders children when modal is open', async () => {
    useModalStore.getState().openModal('Test', '/page')
    const ModalLayout = await loadLayout()
    render(<ModalLayout><p>modal content</p></ModalLayout>)
    expect(screen.getByText('modal content')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/modal-layout.test.tsx
```

Expected: `Cannot find module '@/app/@modal/layout'`

- [ ] **Step 3: Create the layout**

Create `src/app/@modal/layout.tsx`:

```typescript
'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef } from 'react'
import { ModalProvider } from '@/components/modals/ModalContext'
import { Skeleton } from '@/components/ui/skeleton'
import { EXIT_DURATION, MODAL_ENTER_ANIMATION, MODAL_EXIT_ANIMATION } from '@/lib/constants/modal'
import { useModalStore } from '@/lib/stores/modal'
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
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        className={cn(
          'w-full max-h-[90dvh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/10 bg-gray-800 p-0 h-[85dvh] sm:h-auto sm:max-w-2xl sm:w-[95vw]',
          isClosing ? MODAL_EXIT_ANIMATION : MODAL_ENTER_ANIMATION
        )}
      >
        <div className="flex justify-center pt-3 pb-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-white/30" />
        </div>
        <div className="flex items-center justify-between border-b border-white/10 bg-gray-800 px-6 py-4">
          {title ? (
            <h2 className="text-xl font-bold text-white">{title}</h2>
          ) : (
            <Skeleton className="h-6 w-1/3" />
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
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
  const close = useModalStore((s) => s.close)
  const startClosing = useModalStore((s) => s.startClosing)
  const expectingRoute = useModalStore((s) => s.expectingRoute)
  const routeArrived = useModalStore((s) => s.routeArrived)
  const dismissGuardRef = useRef(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current) }
  }, [])

  const pathname = usePathname()

  useEffect(() => {
    if (!isOpen) return
    if (expectingRoute) { routeArrived(); return }
    if (useModalStore.getState().keepAlive) return
    if (isOpen && !isClosing) {
      close()
      dismissGuardRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const handleDismiss = useCallback(() => {
    if (dismissGuardRef.current) return
    dismissGuardRef.current = true
    startClosing()
    dismissTimer.current = setTimeout(() => {
      const triggerEl = useModalStore.getState().triggerRef
      close()
      dismissGuardRef.current = false
      router.back()
      triggerEl?.focus()
    }, EXIT_DURATION)
  }, [startClosing, close, router])

  const handleBack = useCallback(() => { router.back() }, [router])

  if (!isOpen) return null

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) handleDismiss() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={
            isClosing
              ? 'fixed inset-0 z-50 bg-black/80 motion-safe:animate-[fade-out_0.15s_ease-in_forwards]'
              : 'fixed inset-0 z-50 bg-black/80 motion-safe:animate-[fade-in_0.2s_ease-out]'
          }
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 outline-none"
          onEscapeKeyDown={handleDismiss}
        >
          <DialogPrimitive.Title className="sr-only">
            {title ?? 'Modal'}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Press Escape to close.
          </DialogPrimitive.Description>
          <ModalProvider onDismiss={handleDismiss} onBack={handleBack} isClosing={isClosing}>
            <Suspense
              fallback={
                <ModalSkeleton title={title} onDismiss={handleDismiss} isClosing={isClosing} />
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

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/modal-layout.test.tsx
```

Expected: both tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/@modal/layout.tsx tests/unit/modal-layout.test.tsx
git commit -m "feat: add @modal ModalLayout with Radix Dialog and enter/exit animation"
```

---

### Task 11: Wire modal slot into root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add modal slot prop to RootLayout**

In `src/app/layout.tsx`, update the function signature and add `{modal}` render:

```typescript
// Change:
export default async function RootLayout({ children }: { children: React.ReactNode }) {

// To:
export default async function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
```

Then inside the `<body>`, after the `<main>` block and before `<Footer />`, add:

```typescript
{modal ? <div key="modal">{modal}</div> : null}
```

Full placement in context:
```typescript
          <main
            id="main-content"
            className={!isMobileApp ? 'pt-16' : ''}
            style={isMobileApp ? { paddingBottom: 'var(--safe-bottom)' } : undefined}
          >{children}</main>
          {modal ? <div key="modal">{modal}</div> : null}
          {!isMobileApp && <Footer />}
```

- [ ] **Step 2: Run full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: all existing tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add @modal parallel route slot to root layout"
```

---

## Group B — Teachers Feature

### Task 12: Create RecommendedTeachers

**Files:**
- Create: `src/components/teachers/RecommendedTeachers.tsx`
- Test: `tests/unit/recommended-teachers.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/recommended-teachers.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecommendedTeachers } from '@/components/teachers/RecommendedTeachers'
import type { TeacherSummary } from '@/lib/sanity/types'

const mockTeachers: TeacherSummary[] = [
  { name: 'Robert Furrow', slug: 'robert-furrow', title: 'Pastor', photo: null },
  { name: 'David Guzik', slug: 'david-guzik', title: null, photo: null },
]

vi.mock('@/lib/sanity/client', () => ({
  sanityFetch: vi.fn().mockResolvedValue(mockTeachers),
}))

vi.mock('@/lib/teachers/highlighted', () => ({
  HIGHLIGHTED_TEACHER_SLUGS: ['robert-furrow', 'david-guzik'],
  sortByHighlightedOrder: (_teachers: TeacherSummary[], slugs: string[]) =>
    slugs.map((slug) => mockTeachers.find((t) => t.slug === slug)).filter(Boolean),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('RecommendedTeachers', () => {
  it('renders the Recommended heading', async () => {
    const Component = await RecommendedTeachers()
    render(Component)
    expect(screen.getByRole('heading', { name: /recommended/i })).toBeInTheDocument()
  })

  it('renders editorial picks subtitle', async () => {
    const Component = await RecommendedTeachers()
    render(Component)
    expect(screen.getByText(/editorial picks/i)).toBeInTheDocument()
  })

  it('renders a card for each teacher', async () => {
    const Component = await RecommendedTeachers()
    render(Component)
    expect(screen.getByText('Robert Furrow')).toBeInTheDocument()
    expect(screen.getByText('David Guzik')).toBeInTheDocument()
  })

  it('returns null when no teachers found', async () => {
    const { sanityFetch } = await import('@/lib/sanity/client')
    vi.mocked(sanityFetch).mockResolvedValueOnce([])
    const Component = await RecommendedTeachers()
    expect(Component).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/recommended-teachers.test.tsx
```

Expected: `Cannot find module '@/components/teachers/RecommendedTeachers'`

- [ ] **Step 3: Create RecommendedTeachers**

Create `src/components/teachers/RecommendedTeachers.tsx`:

```typescript
import { sanityFetch } from '@/lib/sanity/client'
import { highlightedTeachersQuery } from '@/lib/sanity/queries'
import { HIGHLIGHTED_TEACHER_SLUGS, sortByHighlightedOrder } from '@/lib/teachers/highlighted'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherCard } from '@/components/teachers/TeacherCard'

export async function RecommendedTeachers() {
  const raw = await sanityFetch<TeacherSummary[]>(
    highlightedTeachersQuery,
    { slugs: [...HIGHLIGHTED_TEACHER_SLUGS] },
    { tags: ['teachers'] }
  )

  const teachers = sortByHighlightedOrder(raw, HIGHLIGHTED_TEACHER_SLUGS)

  if (teachers.length === 0) return null

  return (
    <section className="mb-6">
      <div className="mb-3">
        <h2 className="text-white font-bold text-lg uppercase">Recommended</h2>
        <p className="text-white/50 text-sm">Our editorial picks</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {teachers.map((teacher, index) => (
          <TeacherCard key={teacher.slug} teacher={teacher} index={index} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/recommended-teachers.test.tsx
```

Expected: all 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/teachers/RecommendedTeachers.tsx tests/unit/recommended-teachers.test.tsx
git commit -m "feat: add RecommendedTeachers server component"
```

---

### Task 13: Create TeacherSearchClient

**Files:**
- Create: `src/components/teachers/TeacherSearchClient.tsx`
- Test: `tests/unit/teacher-search-client.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/teacher-search-client.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const teachers: TeacherSummary[] = [
  { name: 'Jack Hibbs', slug: 'jack-hibbs', title: 'Real Life Radio', photo: null },
  { name: 'Alistair Begg', slug: 'alistair-begg', title: 'Truth For Life', photo: null },
  { name: 'John MacArthur', slug: 'john-macarthur', title: 'Grace to You', photo: null },
]

const scheduleTeachers: TeacherWithSchedule[] = teachers.map((t) => ({
  ...t,
  schedule: [],
}))

describe('TeacherSearchClient', () => {
  it('renders search input', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByRole('textbox', { name: /search teachers/i })).toBeInTheDocument()
  })

  it('shows all teachers initially', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByText('Jack Hibbs')).toBeInTheDocument()
    expect(screen.getByText('Alistair Begg')).toBeInTheDocument()
    expect(screen.getByText('John MacArthur')).toBeInTheDocument()
  })

  it('filters teachers by name as user types', async () => {
    const user = userEvent.setup()
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    await user.type(screen.getByRole('textbox', { name: /search teachers/i }), 'begg')
    expect(screen.getByText('Alistair Begg')).toBeInTheDocument()
    expect(screen.queryByText('Jack Hibbs')).not.toBeInTheDocument()
    expect(screen.queryByText('John MacArthur')).not.toBeInTheDocument()
  })

  it('shows empty state when no results', async () => {
    const user = userEvent.setup()
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    await user.type(screen.getByRole('textbox', { name: /search teachers/i }), 'zzznomatch')
    expect(screen.getByText(/no teachers found/i)).toBeInTheDocument()
  })

  it('renders day filter chips', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByRole('button', { name: 'Mon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sun' })).toBeInTheDocument()
  })

  it('renders sort options', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByRole('button', { name: 'A–Z' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Z–A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Most on air' })).toBeInTheDocument()
  })

  it('sorts teachers A–Z when A–Z selected', async () => {
    const user = userEvent.setup()
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    await user.click(screen.getByRole('button', { name: 'A–Z' }))
    const links = screen.getAllByRole('link')
    const names = links.map((l) => l.textContent?.trim()).filter(Boolean)
    expect(names[0]).toContain('Alistair Begg')
  })

  it('shows results count', () => {
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    expect(screen.getByText(/3 teachers found/i)).toBeInTheDocument()
  })

  it('clear search button removes query', async () => {
    const user = userEvent.setup()
    render(
      <TeacherSearchClient teachers={teachers} scheduleTeachers={scheduleTeachers} />
    )
    const input = screen.getByRole('textbox', { name: /search teachers/i })
    await user.type(input, 'begg')
    await user.click(screen.getByRole('button', { name: /clear search/i }))
    expect(input).toHaveValue('')
    expect(screen.getByText('Jack Hibbs')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/teacher-search-client.test.tsx
```

Expected: `Cannot find module '@/components/teachers/TeacherSearchClient'`

- [ ] **Step 3: Create TeacherSearchClient**

Create `src/components/teachers/TeacherSearchClient.tsx`:

```typescript
'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X } from 'lucide-react'
import { filterTeachers } from '@/lib/teachers/filter'
import { computeWeeklyMinutes } from '@/lib/utils/time'
import type { SortOption } from '@/lib/teachers/filter'
import type { TeacherSummary, TeacherWithSchedule, ScheduleDay } from '@/lib/sanity/types'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_LABELS: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'A–Z' },
  { value: 'name-desc', label: 'Z–A' },
  { value: 'most-on-air', label: 'Most on air' },
]

interface TeacherSearchClientProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
  initialQuery?: string
}

function TeacherInitials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  const initials =
    parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : (parts[0]?.[0] ?? '?')
  return (
    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-green-900/60 to-gray-700/60 flex items-center justify-center shrink-0">
      <span className="text-white/80 text-sm font-bold uppercase">{initials}</span>
    </div>
  )
}

export function TeacherSearchClient({
  teachers,
  scheduleTeachers,
  initialQuery = '',
}: TeacherSearchClientProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(initialQuery)
  const [sort, setSort] = useState<SortOption | undefined>(undefined)
  const [activeDays, setActiveDays] = useState<string[]>([])

  useEffect(() => { inputRef.current?.focus() }, [])

  const scheduleMap = useMemo(
    () => new Map<string, ScheduleDay[]>(scheduleTeachers.map((t) => [t.slug, t.schedule])),
    [scheduleTeachers]
  )
  const hoursMap = useMemo(
    () =>
      new Map<string, number>(
        scheduleTeachers.map((t) => [t.slug, computeWeeklyMinutes(t.schedule)])
      ),
    [scheduleTeachers]
  )

  const results = useMemo(
    () => filterTeachers(teachers, query, { sort, days: activeDays, scheduleMap, hoursMap }),
    [teachers, query, sort, activeDays, scheduleMap, hoursMap]
  )

  const hasFilter = query.trim().length > 0 || !!sort || activeDays.length > 0

  function toggleDay(day: string) {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function clearAll() {
    setQuery('')
    setSort(undefined)
    setActiveDays([])
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search teachers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') setQuery('') }}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
          aria-label="Search teachers"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center text-white/40 hover:text-white cursor-pointer"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Day filters */}
      <div className="flex flex-wrap gap-2">
        {DAYS.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => toggleDay(day)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              activeDays.includes(day)
                ? 'bg-[var(--color-brand-green)] text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
            }`}
          >
            {DAY_LABELS[day]}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center flex-wrap gap-2">
        <span className="text-white/40 text-xs">Sort:</span>
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setSort(sort === option.value ? undefined : option.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              sort === option.value
                ? 'bg-[var(--color-brand-green)] text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
        {hasFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-xs text-white/40 hover:text-white cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-white/40 text-sm" aria-live="polite" aria-atomic="true">
        {results.length} {results.length === 1 ? 'teacher' : 'teachers'} found
      </p>

      {/* Results list */}
      {results.length > 0 ? (
        <ul className="space-y-1">
          {results.map((teacher) => (
            <li key={teacher.slug}>
              <Link
                href={`/teachers/${teacher.slug}`}
                className="flex items-center gap-3 rounded-xl p-3 hover:bg-white/5 transition-colors cursor-pointer"
              >
                {teacher.photo ? (
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-gray-700 shrink-0">
                    <Image
                      src={teacher.photo}
                      alt={teacher.name}
                      fill
                      className="object-cover"
                      placeholder={teacher.lqip ? 'blur' : 'empty'}
                      blurDataURL={teacher.lqip ?? undefined}
                      sizes="44px"
                    />
                  </div>
                ) : (
                  <TeacherInitials name={teacher.name} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{teacher.name}</p>
                  {teacher.title && (
                    <p className="text-white/50 text-xs truncate">{teacher.title}</p>
                  )}
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/20 shrink-0"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-white/40 text-center py-8">
          No teachers found. Try a different search.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/teacher-search-client.test.tsx
```

Expected: all 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/teachers/TeacherSearchClient.tsx tests/unit/teacher-search-client.test.tsx
git commit -m "feat: add TeacherSearchClient — in-memory search/filter in sheet"
```

---

### Task 14: Create teachers/search routes

**Files:**
- Create: `src/app/teachers/search/page.tsx`
- Create: `src/app/@modal/(...)teachers/search/page.tsx`

- [ ] **Step 1: Create the direct route (cmd+click / hard-nav fallback)**

Create `src/app/teachers/search/page.tsx`:

```typescript
import type { Metadata } from 'next'
import Link from 'next/link'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Search Teachers',
  robots: { index: false },
}

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function TeachersSearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams

  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/teachers"
          className="text-white/60 hover:text-white transition-colors cursor-pointer text-sm"
        >
          ← Teachers
        </Link>
        <h1 className="text-white text-2xl font-bold">Search</h1>
      </div>
      <TeacherSearchClient
        teachers={teachers}
        scheduleTeachers={scheduleTeachers}
        initialQuery={q}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create the intercepting modal route**

Create `src/app/@modal/(...)teachers/search/page.tsx`:

```typescript
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeacherSearchClient } from '@/components/teachers/TeacherSearchClient'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'

export const revalidate = 3600

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function TeachersSearchSheetPage({ searchParams }: Props) {
  const { q = '' } = await searchParams

  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <SheetChrome title="Search Teachers" padded={false}>
      <div className="px-4 pt-4 pb-16">
        <TeacherSearchClient
          teachers={teachers}
          scheduleTeachers={scheduleTeachers}
          initialQuery={q}
        />
      </div>
    </SheetChrome>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/teachers/search/page.tsx "src/app/@modal/(...)teachers/search/page.tsx"
git commit -m "feat: add teachers/search direct route and intercepting modal route"
```

---

## Group C — Cleanup & Wire-Up

### Task 15: Strip TeachersClientView of search/filter

**Files:**
- Modify: `src/components/teachers/TeachersClientView.tsx`

- [ ] **Step 1: Replace TeachersClientView entirely**

Replace the full contents of `src/components/teachers/TeachersClientView.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { ScheduleTabView } from '@/components/teachers/ScheduleTabView'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'

interface TeachersClientViewProps {
  teachers: TeacherSummary[]
  scheduleTeachers: TeacherWithSchedule[]
}

type Tab = 'teachers' | 'schedule'

export function TeachersClientView({ teachers, scheduleTeachers }: TeachersClientViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('teachers')

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-2xl font-bold">All Teachers</h2>
        <span className="text-white/50 text-sm">{teachers.length} teachers</span>
      </div>

      <div className="flex gap-1 mb-5 border-b border-white/10">
        {(['teachers', 'schedule'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-white border-[var(--color-brand-green)]'
                : 'text-white/50 border-transparent hover:text-white/80'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'teachers' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {teachers.map((teacher, index) => (
            <TeacherCard key={teacher.slug} teacher={teacher} index={index} />
          ))}
        </div>
      )}

      {activeTab === 'schedule' && <ScheduleTabView scheduleTeachers={scheduleTeachers} />}
    </>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (no tests reference the removed search props)

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/TeachersClientView.tsx
git commit -m "refactor: strip search/filter from TeachersClientView — search moved to sheet"
```

---

### Task 16: Restructure teachers/page.tsx

**Files:**
- Modify: `src/app/teachers/page.tsx`

- [ ] **Step 1: Replace teachers/page.tsx entirely**

Replace the full contents of `src/app/teachers/page.tsx`:

```typescript
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery, fullScheduleQuery } from '@/lib/sanity/queries'
import type { TeacherSummary, TeacherWithSchedule } from '@/lib/sanity/types'
import { TeachersClientView } from '@/components/teachers/TeachersClientView'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import { PassiveSearchBar } from '@/components/global/PassiveSearchBar'
import { RecommendedTeachers } from '@/components/teachers/RecommendedTeachers'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Teachers',
  description: 'Listen to many great bible teachers on Reach Radio Tucson.',
  alternates: { canonical: '/teachers' },
  openGraph: {
    title: 'Teachers | Reach Radio',
    description: 'Listen to many great bible teachers on Reach Radio Tucson.',
    url: '/teachers',
  },
  twitter: {
    title: 'Teachers | Reach Radio',
    description: 'Listen to many great bible teachers on Reach Radio Tucson.',
  },
}

export default async function TeachersPage() {
  const [teachers, scheduleTeachers] = await Promise.all([
    sanityFetch<TeacherSummary[]>(teacherListQuery, {}, { tags: ['teachers'] }),
    sanityFetch<TeacherWithSchedule[]>(fullScheduleQuery, {}, { tags: ['teachers'] }),
  ])

  return (
    <div className="px-4 py-6">
      <h1 className="sr-only">Teachers</h1>
      <ShowMediaBar />
      <PassiveSearchBar
        href="/teachers/search"
        placeholder="Search teachers..."
        modalTitle="Search Teachers"
        className="mb-4"
      />
      <Suspense fallback={null}>
        <RecommendedTeachers />
      </Suspense>
      <TeachersClientView
        teachers={teachers}
        scheduleTeachers={scheduleTeachers}
      />
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/teachers/page.tsx
git commit -m "feat: restructure teachers page — PassiveSearchBar + RecommendedTeachers + full grid"
```

---

### Task 17: Delete dead files

**Files:**
- Delete: `src/components/home/FeaturedTeachers.tsx`
- Delete: `src/components/skeletons/FeaturedTeachersSkeleton.tsx`
- Delete: `src/components/teachers/FilterSheet.tsx`
- Delete: `tests/unit/filter-sheet.test.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm src/components/home/FeaturedTeachers.tsx
rm src/components/skeletons/FeaturedTeachersSkeleton.tsx
rm src/components/teachers/FilterSheet.tsx
rm tests/unit/filter-sheet.test.tsx
```

- [ ] **Step 2: Run full test suite to confirm nothing broken**

```bash
npx vitest run
```

Expected: all tests pass, no import errors

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete FeaturedTeachers, FeaturedTeachersSkeleton, FilterSheet — superseded"
```

---

## Verification

- [ ] **Run the dev server**

```bash
npm run dev
```

- [ ] **Manual verification checklist**
  - `/teachers` loads: `PassiveSearchBar` visible at top, `Recommended` section with 5 cards, `All Teachers` grid below
  - Tapping `PassiveSearchBar` opens the search sheet (bottom sheet on mobile, centered dialog on desktop)
  - Search input is auto-focused when sheet opens
  - Typing filters the teacher list in real time
  - Day filter chips toggle correctly
  - Sort buttons work (A–Z, Z–A, Most on air)
  - Tapping a teacher result navigates to `/teachers/[slug]` and closes the sheet
  - Escape key closes the sheet
  - Drag handle dismisses the sheet on mobile
  - Cmd+clicking the `PassiveSearchBar` navigates directly to `/teachers/search` (non-modal)
  - `/teachers/search` renders as a standalone page with a "← Teachers" back link
  - No TypeScript errors: `npx tsc --noEmit`
  - Full test suite passes: `npx vitest run`
