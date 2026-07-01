# Contact Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Contact nav link with a button that opens an accessible sheet containing the contact form — bottom sheet on mobile, centered modal on desktop.

**Architecture:** Self-contained `ContactSheet` component (portal-based, no routing). Uses the existing `SheetChrome` + `ModalProvider` for chrome and animations, wrapped in a local `isClosing` state. `ContactForm` gets an optional `onSuccess` callback so the sheet can auto-close on successful submission.

**Tech Stack:** React 19 (`useState`, `useEffect`, `useCallback`, `useRef`, `createPortal`), Vitest + React Testing Library, Tailwind CSS, existing project components (`SheetChrome`, `ModalProvider`, `ContactForm`).

## Global Constraints

- All interactive elements must have `cursor-pointer` and `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`
- Touch targets min `h-11 w-11` on mobile
- No `any` in TypeScript — strict mode
- Conventional commit scope: `global` for ContactSheet (shared primitive), `layout` for header changes, `about` for ContactForm change
- Test runner: `npm test` (vitest run)
- All imports use `@/` path alias

---

### Task 1: ContactForm — add `onSuccess` prop and remove `max-w-lg`

**Files:**
- Modify: `src/components/about/ContactForm.tsx`
- Modify: `src/app/about/page.tsx`
- Test: `tests/unit/contact-form-on-success.test.tsx`

**Interfaces:**
- Produces: `ContactForm({ onSuccess?: () => void })` — optional callback, called alongside toast + form reset on success

---

- [ ] **Step 1: Write the failing test**

Create `tests/unit/contact-form-on-success.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import type { ContactState } from '@/actions/contact'

// Mock useActionState before importing ContactForm
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, useActionState: vi.fn() }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/actions/contact', () => ({
  submitContact: vi.fn(),
}))

import { useActionState } from 'react'
import { ContactForm } from '@/components/about/ContactForm'

function mockState(state: ContactState) {
  vi.mocked(useActionState).mockReturnValue([state, vi.fn(), false] as never)
}

describe('ContactForm onSuccess', () => {
  beforeEach(() => {
    mockState({ success: false })
  })

  it('calls onSuccess when submission succeeds', async () => {
    mockState({ success: true })
    const onSuccess = vi.fn()
    render(<ContactForm onSuccess={onSuccess} />)
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })

  it('does not throw when onSuccess is not provided', async () => {
    mockState({ success: true })
    expect(() => render(<ContactForm />)).not.toThrow()
  })

  it('does not call onSuccess when success is false', async () => {
    mockState({ success: false })
    const onSuccess = vi.fn()
    render(<ContactForm onSuccess={onSuccess} />)
    await waitFor(() => {}, { timeout: 50 }).catch(() => {})
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- contact-form-on-success
```

Expected: FAIL — `onSuccess` prop does not exist yet.

- [ ] **Step 3: Add `onSuccess` prop to ContactForm and move `max-w-lg`**

Update `src/components/about/ContactForm.tsx`:

```tsx
'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { submitContact, type ContactState } from '@/actions/contact'

interface ContactFormProps {
  onSuccess?: () => void
}

const initial: ContactState = { success: false }

export function ContactForm({ onSuccess }: ContactFormProps) {
  const [state, action, isPending] = useActionState(submitContact, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const timestampRef = useRef(Date.now().toString())

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      toast.success("Message sent! We'll be in touch.")
      onSuccess?.()
    }
  }, [state.success, onSuccess])

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state.error])

  return (
    <form ref={formRef} action={action} className="space-y-4" aria-describedby={state.error ? 'form-error' : undefined}>
      {/* Honeypot fields */}
      <div className="absolute left-[-9999px] top-[-9999px]" aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="url" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="homepage" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="text" name="phone" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>
      <input type="hidden" name="timestamp" value={timestampRef.current} />

      <div>
        <label htmlFor="name" className="text-white/80 light:text-gray-700 text-sm block mb-1">Name *</label>
        <input
          id="name" name="name" type="text" required minLength={2} maxLength={100}
          className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>
      <div>
        <label htmlFor="email" className="text-white/80 light:text-gray-700 text-sm block mb-1">Email *</label>
        <input
          id="email" name="email" type="email" required
          className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>
      <div>
        <label htmlFor="message" className="text-white/80 light:text-gray-700 text-sm block mb-1">Message *</label>
        <textarea
          id="message" name="message" required rows={5} minLength={10} maxLength={2000}
          className="w-full bg-gray-700/50 light:bg-gray-100 text-white light:text-gray-900 rounded px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none resize-none"
        />
      </div>

      <label className="flex gap-3 cursor-pointer items-start">
        <input type="checkbox" name="gdprConsent" required className="mt-1" />
        <span className="text-white light:text-gray-900 text-sm leading-relaxed">
          I consent to having my submitted information stored for the purpose of responding to my inquiry. *
        </span>
      </label>

      <button
        type="submit" disabled={isPending}
        className="bg-[var(--color-brand-green)] text-[#0a1305] px-6 py-3 min-h-[44px] rounded font-medium text-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {isPending ? 'Sending...' : 'Send Message'}
      </button>
      {state.error && (
        <p id="form-error" role="alert" className="text-red-400 text-sm">{state.error}</p>
      )}
    </form>
  )
}
```

Note: `max-w-lg` removed from the form's `className`. The about page will add it as a wrapper (next step).

- [ ] **Step 4: Wrap ContactForm in `about/page.tsx` to restore width constraint**

In `src/app/about/page.tsx`, find the line `<ContactForm />` (around line 185) and wrap it:

```tsx
<div className="max-w-lg">
  <ContactForm />
</div>
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- contact-form-on-success
```

Expected: 3 tests PASS.

- [ ] **Step 6: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all existing tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/about/ContactForm.tsx src/app/about/page.tsx tests/unit/contact-form-on-success.test.tsx
git commit -m "feat(about): add onSuccess prop to ContactForm, move max-w-lg to page wrapper"
```

---

### Task 2: ContactSheet component

**Files:**
- Create: `src/components/about/ContactSheet.tsx`
- Test: `tests/unit/contact-sheet.test.tsx`

**Interfaces:**
- Consumes: `ContactForm({ onSuccess })` from Task 1; `SheetChrome`, `ModalProvider` from existing codebase; `EXIT_DURATION` from `@/lib/constants/modal`; `postMessageToNative` from `@/lib/bridge/post-message`
- Produces: `ContactSheet({ open: boolean, onClose: () => void })` — used by Header and MobileHeader in Task 3

---

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/contact-sheet.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContactSheet } from '@/components/about/ContactSheet'

// Mock SheetChrome — isolate ContactSheet behavior from SheetChrome internals
vi.mock('@/components/modals/chrome/SheetChrome', () => ({
  SheetChrome: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}))

// Mock ContactForm — we test form behavior separately
vi.mock('@/components/about/ContactForm', () => ({
  ContactForm: ({ onSuccess }: { onSuccess?: () => void }) => (
    <button onClick={onSuccess}>Submit</button>
  ),
}))

// Mock ModalProvider — pass through children
vi.mock('@/components/modals/ModalContext', () => ({
  ModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock bridge — postMessageToNative is a no-op in tests
vi.mock('@/lib/bridge/post-message', () => ({
  postMessageToNative: vi.fn(),
}))

describe('ContactSheet', () => {
  it('renders nothing when closed', () => {
    render(<ContactSheet open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog when open', () => {
    render(<ContactSheet open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders backdrop when open', () => {
    render(<ContactSheet open={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('contact-sheet-backdrop')).toBeInTheDocument()
  })

  it('calls onClose after Escape key + animation delay', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<ContactSheet open={true} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('calls onClose when form submission succeeds (via onSuccess)', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<ContactSheet open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Submit'))
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('does not call onClose when Escape pressed while closed', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<ContactSheet open={false} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    vi.advanceTimersByTime(300)
    expect(onClose).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- contact-sheet
```

Expected: FAIL — module `@/components/about/ContactSheet` does not exist.

- [ ] **Step 3: Implement ContactSheet**

Create `src/components/about/ContactSheet.tsx`:

```tsx
'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ModalProvider } from '@/components/modals/ModalContext'
import { SheetChrome } from '@/components/modals/chrome/SheetChrome'
import { ContactForm } from '@/components/about/ContactForm'
import { EXIT_DURATION } from '@/lib/constants/modal'
import { postMessageToNative } from '@/lib/bridge/post-message'

interface ContactSheetProps {
  open: boolean
  onClose: () => void
}

export function ContactSheet({ open, onClose }: ContactSheetProps) {
  const [mounted, setMounted] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement as HTMLElement
  }, [open])

  // Hide native bottom nav while sheet is open (matches @modal/layout.tsx behavior)
  useEffect(() => {
    if (!open) return
    postMessageToNative({ showMobileNav: false })
    return () => { postMessageToNative({ showMobileNav: true }) }
  }, [open])

  const handleDismiss = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setIsClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setIsClosing(false)
      onClose()
      triggerRef.current?.focus()
    }, EXIT_DURATION)
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleDismiss() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, handleDismiss])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open || !mounted) return null

  return createPortal(
    <div
      data-testid="contact-sheet-backdrop"
      className={`fixed inset-0 z-[70] bg-black/80 [will-change:opacity] ${
        isClosing
          ? 'motion-safe:animate-[fade-out_0.15s_ease-in_forwards]'
          : 'motion-safe:animate-[fade-in_0.2s_ease-out_both]'
      }`}
    >
      <ModalProvider
        onDismiss={handleDismiss}
        onBack={handleDismiss}
        isClosing={isClosing}
        stackDepth={0}
      >
        <SheetChrome title="Contact Us" autoFocusInput>
          <ContactForm onSuccess={handleDismiss} />
        </SheetChrome>
      </ModalProvider>
    </div>,
    document.body
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- contact-sheet
```

Expected: 6 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/about/ContactSheet.tsx tests/unit/contact-sheet.test.tsx
git commit -m "feat(global): add ContactSheet component (portal, SheetChrome, mobile/desktop)"
```

---

### Task 3: Wire Contact button in Header and MobileHeader

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/MobileHeader.tsx`

**Interfaces:**
- Consumes: `ContactSheet({ open: boolean, onClose: () => void })` from Task 2

No new test file — the component renders a `<button>` (not a Link) and the sheet unit tests cover ContactSheet behavior.

---

- [ ] **Step 1: Update `Header.tsx`**

In `src/components/layout/Header.tsx`:

Add import at top (after existing imports):
```tsx
import { useState } from 'react'
import { ContactSheet } from '@/components/about/ContactSheet'
```

Inside the `Header` function, add state after the existing hooks:
```tsx
const [contactOpen, setContactOpen] = useState(false)
```

Replace the Contact `<Link>` (lines 76–81):
```tsx
<Link
  href="/about#aboutGotQuestions"
  className="flex items-center px-3 py-1.5 bg-white light:border light:border-gray-800 rounded text-black font-bold text-sm hover:bg-gray-100 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
>
  Contact
</Link>
```

With:
```tsx
<button
  type="button"
  onClick={() => setContactOpen(true)}
  className="flex items-center px-3 py-1.5 bg-white light:border light:border-gray-800 rounded text-black font-bold text-sm hover:bg-gray-100 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
>
  Contact
</button>
<ContactSheet open={contactOpen} onClose={() => setContactOpen(false)} />
```

Full updated `src/components/layout/Header.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useScrollHide } from '@/lib/hooks/useScrollHide'
import { ContactSheet } from '@/components/about/ContactSheet'

const navItems = [
  { href: '/', label: 'Listen' },
  { href: '/about', label: 'About' },
  { href: '/donate', label: 'Donate' },
  { href: '/teachers', label: 'Teachers' },
]

export function Header() {
  const pathname = usePathname()
  const ref = useScrollHide<HTMLElement>()
  const [contactOpen, setContactOpen] = useState(false)

  return (
    <header
      ref={ref}
      id="site-header"
      data-web-chrome=""
      style={{ viewTransitionName: 'site-header' }}
      className="hidden md:flex fixed top-0 z-50 w-full h-16 items-center justify-between bg-gray-800 light:bg-white border-b border-b-green-500/20 light:border-b-gray-200 px-6 will-change-transform"
    >
      <Link href="/" aria-label="Reach Radio home" className="flex items-center w-[clamp(130px,16vw,186px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded">
        <Image
          src="/reach_radio_logo.svg"
          alt=""
          width={248}
          height={58}
          className="h-10 w-auto"
          priority
        />
      </Link>

      <nav aria-label="Primary navigation" className="flex items-center">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center h-16 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
            >
              {isActive && (
                <>
                  <div className="absolute bottom-0 w-full h-[6px] bg-green-500 rounded-t-md z-10" />
                  <div className="absolute inset-0 -bottom-4 bg-green-500 blur-2xl opacity-60 pointer-events-none" />
                </>
              )}
              <span className={`relative z-10 text-white light:text-gray-900 text-[clamp(14px,1.5vw,16px)] ${isActive ? 'font-bold' : ''}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="flex items-center gap-6">
        <a
          href="https://www.facebook.com/reachradiotucson"
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 fill-slate-300 light:fill-gray-500 hover:fill-white light:hover:fill-gray-900 motion-safe:transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
          aria-label="Reach Radio on Facebook"
        >
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <path d="M36.002 18.11a18 18 0 10-20.816 17.891V23.345h-4.567v-5.233h4.571v-3.993c0-4.538 2.688-7.044 6.8-7.044a27.53 27.53 0 014.029.353v4.454h-2.27a2.61 2.61 0 00-2.931 2.83v3.4h4.984l-.8 5.233h-4.2v12.656a18.081 18.081 0 0015.2-17.891z" fill="inherit" />
          </svg>
        </a>
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          className="flex items-center px-3 py-1.5 bg-white light:border light:border-gray-800 rounded text-black font-bold text-sm hover:bg-gray-100 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          Contact
        </button>
        <ContactSheet open={contactOpen} onClose={() => setContactOpen(false)} />
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Update `MobileHeader.tsx`**

Full updated `src/components/layout/MobileHeader.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useScrollHide } from '@/lib/hooks/useScrollHide'
import { ContactSheet } from '@/components/about/ContactSheet'

export function MobileHeader() {
  const ref = useScrollHide<HTMLElement>()
  const [contactOpen, setContactOpen] = useState(false)

  return (
    <header
      ref={ref}
      data-web-chrome=""
      className="md:hidden fixed top-0 z-50 flex items-center justify-between w-full min-h-[64px] px-4 bg-black light:bg-white border-b border-b-white/10 light:border-b-gray-200 will-change-transform"
    >
      <Link href="/" aria-label="Reach Radio home" className="w-[clamp(180px,40vw,250px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded">
        <Image
          src="/reach_radio_logo.svg"
          alt=""
          width={248}
          height={58}
          className="h-8 w-auto"
          priority
        />
      </Link>
      <div className="flex items-center gap-4">
        <a
          href="https://www.facebook.com/reachradiotucson"
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 fill-slate-300 light:fill-gray-500 hover:fill-white light:hover:fill-gray-900 motion-safe:transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
          aria-label="Reach Radio on Facebook"
        >
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <path d="M36.002 18.11a18 18 0 10-20.816 17.891V23.345h-4.567v-5.233h4.571v-3.993c0-4.538 2.688-7.044 6.8-7.044a27.53 27.53 0 014.029.353v4.454h-2.27a2.61 2.61 0 00-2.931 2.83v3.4h4.984l-.8 5.233h-4.2v12.656a18.081 18.081 0 0015.2-17.891z" fill="inherit" />
          </svg>
        </a>
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          className="flex items-center px-2 py-1 bg-white light:border light:border-gray-800 rounded text-black font-bold text-sm hover:bg-gray-100 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          Contact
        </button>
        <ContactSheet open={contactOpen} onClose={() => setContactOpen(false)} />
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Header.tsx src/components/layout/MobileHeader.tsx
git commit -m "feat(layout): replace Contact link with button that opens ContactSheet"
```

---

## Verification

After all tasks are committed, run the app and verify manually:

```bash
npm run dev
```

1. Open `http://localhost:3000`
2. Click Contact button in desktop nav → sheet slides in, centered on desktop, name field focused
3. Press Escape → sheet closes, focus returns to Contact button
4. Click Contact, drag sheet down → sheet closes
5. Click Contact, click X button → sheet closes
6. Click Contact, click dark backdrop → sheet closes
7. Resize to mobile → Contact button visible in mobile header, sheet full-height
8. Navigate to `/about` → contact form still visible on page, max-w-lg width unchanged
