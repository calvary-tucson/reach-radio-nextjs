# Astro → Next.js Feature & UI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore all missing features, UI/UX parity, and fix broken functionality in the Next.js Reach Radio app relative to the Astro/Unpoly original.

**Architecture:** Fixes span multiple layers — CSP headers in `next.config.ts`, media store additions for volume/sleep timer, new React components for sleep timer overlay and volume control, UI class updates for teacher cards/detail, and server-action enhancements for contact form spam protection. Each task is independent and produces a working, testable change.

**Tech Stack:** Next.js 15 App Router, React 19, Zustand (media-store), Tailwind CSS, Sanity CMS, Google reCAPTCHA v3, Formspree

---

## File Map

**Modified:**
- `next.config.ts` — CSP: add `frame-src`, `www.google.com` script-src, `formspree.io` connect-src
- `src/lib/store/media-store.ts` — add volume, sleep timer state
- `src/components/home/RadioPlayer.tsx` — add sleep timer button, volume control, click-to-play, intersection observer
- `src/app/sleep-timer/page.tsx` — fix timer options (5,10,15,30,45,60)
- `src/actions/contact.ts` — add honeypot check, GDPR validation, mobile-app bypass
- `src/components/about/ContactForm.tsx` — add honeypot fields, GDPR checkbox, timestamp
- `src/app/donate/page.tsx` — fix form ID, add skeleton, iframe focus/blur postMessage
- `src/app/about/page.tsx` — add frequency display, app download links, privacy policy link
- `src/app/layout.tsx` — persist mobile-app cookie
- `src/components/teachers/TeacherCard.tsx` — add teal box-shadow, green border, hover scale
- `src/app/teachers/[slug]/page.tsx` — fix 2-col layout, button-style links, grouped schedule

**Created:**
- `src/components/home/SleepTimerButton.tsx` — clock icon button that links to sleep timer page
- `src/components/home/SleepTimerOverlay.tsx` — countdown overlay over album art when timer active
- `src/components/home/VolumeControl.tsx` — desktop-only volume slider
- `src/app/api/stream-info/route.ts` — regular JSON now-playing endpoint (non-SSE)

---

## Task 1: Fix CSP — Unblock Donations, reCAPTCHA, and Formspree

**Files:**
- Modify: `next.config.ts`

The current CSP has no `frame-src` (defaults to `default-src 'self'` — blocks Ministry Forms iframe), no `www.google.com` in `script-src` (blocks reCAPTCHA), and no `formspree.io` in `connect-src` (blocks contact form submission).

- [ ] **Step 1: Read the current config**

Open `next.config.ts` and locate the CSP header array.

- [ ] **Step 2: Update the CSP header**

In `next.config.ts`, replace the CSP value array with:

```typescript
value: [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' cdn.sanity.io data: blob: https://www.google.com",
  "media-src 'self'",
  "connect-src 'self' api.sanity.io cdn.sanity.io *.radiojar.com https://formspree.io https://www.google.com",
  "font-src 'self'",
  "object-src 'none'",
  "frame-src https://forms.ministryforms.net",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self' https://formspree.io",
].join('; '),
```

- [ ] **Step 3: Verify CSP syntax is valid**

Run the build to catch any syntax errors:
```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs
npm run build 2>&1 | tail -20
```
Expected: build succeeds with no CSP errors.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "fix: CSP — allow Ministry Forms iframe, reCAPTCHA scripts, and Formspree connections"
```

---

## Task 2: Fix Donate Page — Correct Form ID, Add Skeleton, Add iframe Focus/Blur Nav Hiding

**Files:**
- Modify: `src/app/donate/page.tsx`

The form ID is wrong (`018b4ff7` → `32b9c82a`). The iframe needs: a skeleton shown while loading, hide/show the mobile nav and media bar when donation form inputs are focused/blurred (via postMessage), and restore nav on unmount.

- [ ] **Step 1: Rewrite the donate page**

Replace the entire contents of `src/app/donate/page.tsx` with:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Metadata } from 'next'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

// Metadata must be in a separate server component when using 'use client',
// but for this page the title is set via the layout template so no export needed.

const DONATE_URL =
  'https://forms.ministryforms.net/viewForm.aspx?formid=32b9c82a-1472-4180-b023-73b42532b63e&direct-link=true&embed=false'
const EXPECTED_ORIGIN = 'https://forms.ministryforms.net'

export default function DonatePage() {
  const [loaded, setLoaded] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const setShowMediaBar = useMediaStore((s) => s.setShowMediaBar)

  useEffect(() => {
    // Restore nav on unmount
    return () => {
      setShowMediaBar(true)
      postMessageToNative(JSON.stringify({ showMediaBar: true }))
    }
  }, [setShowMediaBar])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== EXPECTED_ORIGIN) return
      if (event.data?.type === 'donationFormInputFocus') {
        setShowMediaBar(false)
        postMessageToNative(JSON.stringify({ showMediaBar: false }))
      } else if (event.data?.type === 'donationFormInputBlur') {
        setShowMediaBar(true)
        postMessageToNative(JSON.stringify({ showMediaBar: true }))
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setShowMediaBar])

  function handleLoad() {
    setLoaded(true)
    // Notify iframe of parent origin so it can communicate back
    const attempts = { count: 0 }
    function trySend() {
      if (attempts.count >= 5) return
      attempts.count++
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'initParentInfo', origin: window.location.origin },
          EXPECTED_ORIGIN
        )
      } catch {}
      if (attempts.count < 5) setTimeout(trySend, 500)
    }
    trySend()
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-white text-2xl font-bold mb-4">Support Reach Radio</h1>
      <p className="text-white/70 mb-6">Your generous support keeps Reach Radio on the air.</p>

      {/* Skeleton shown until iframe loads */}
      {!loaded && (
        <div className="animate-pulse flex flex-col gap-4 h-[800px] bg-black rounded p-4">
          <div className="h-[60px] bg-gray-700 rounded" />
          <div className="h-[1.2em] w-[90%] bg-gray-700 rounded" />
          <div className="h-[1.2em] w-[60%] bg-gray-700 rounded" />
          <div className="h-[150px] bg-gray-700 rounded" />
          <div className="h-[1.2em] w-[85%] bg-gray-700 rounded" />
          <div className="h-[1.2em] w-[75%] bg-gray-700 rounded" />
          <div className="h-[100px] bg-gray-700 rounded" />
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={DONATE_URL}
        title="Donation Form"
        onLoad={handleLoad}
        className={`w-full min-h-[1000px] border-0 ${loaded ? 'block' : 'hidden'}`}
        loading="lazy"
      />
    </div>
  )
}
```

- [ ] **Step 2: Add metadata export in a server wrapper**

The page uses `'use client'` so metadata must come from the parent route segment. Add `src/app/donate/layout.tsx`:

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Donate',
  description: 'Support Reach Radio — 106.7FM / 690AM in Tucson, AZ',
}

export default function DonateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: builds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/donate/page.tsx src/app/donate/layout.tsx
git commit -m "fix: donate page — correct form ID, add skeleton, iframe focus/blur nav toggling"
```

---

## Task 3: Fix Sleep Timer Options

**Files:**
- Modify: `src/app/sleep-timer/page.tsx`

Astro has: 5, 10, 15, 30, 45, 60. Next.js has 15, 30, 45, 60, 90. Fix to match original.

- [ ] **Step 1: Fix TIMER_OPTIONS constant**

In `src/app/sleep-timer/page.tsx`, change:

```typescript
// from:
const TIMER_OPTIONS = [15, 30, 45, 60, 90]
// to:
const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60]
```

- [ ] **Step 2: Commit**

```bash
git add src/app/sleep-timer/page.tsx
git commit -m "fix: restore sleep timer options to 5,10,15,30,45,60 matching original"
```

---

## Task 4: Add Volume Control to Media Store and RadioPlayer

**Files:**
- Modify: `src/lib/store/media-store.ts`
- Create: `src/components/home/VolumeControl.tsx`
- Modify: `src/components/home/RadioPlayer.tsx`

Volume control is desktop-only (hidden on mobile), not shown in mobile app (`isMobileApp` detected client-side via `showMediaBar` isn't the right signal — check `window.mobileApp` bridge or `navigator.userAgent` is unreliable, so use a CSS approach: `hidden md:flex` and hide when `isMobileApp` prop passed from layout).

The simplest approach: add `volume` to Zustand store, render `VolumeControl` in RadioPlayer always, but wrapped in `hidden md:flex` so it's desktop-only (mirrors Astro's `.md:flex hidden`). The `isMobileApp` hiding can be done by the layout passing a prop.

- [ ] **Step 1: Add volume to media store**

In `src/lib/store/media-store.ts`, find the store state interface and add volume fields. Read the file first to know the exact shape, then add:

```typescript
// Add to state interface:
volume: number
isMuted: boolean
setVolume: (v: number) => void
setMuted: (m: boolean) => void
```

And in the `create()` call, add initial values and actions:
```typescript
volume: 100,
isMuted: false,
setVolume: (v) => {
  set({ volume: v, isMuted: v === 0 })
},
setMuted: (m) => set({ isMuted: m }),
```

- [ ] **Step 2: Wire volume to RadioPlayer audio element**

In `src/components/home/RadioPlayer.tsx`, find where the `<audio>` element is (or where `isPlaying` drives audio), and add a `useEffect` that sets `audioRef.current.volume = volume / 100` whenever `volume` or `isMuted` changes.

- [ ] **Step 3: Create VolumeControl component**

Create `src/components/home/VolumeControl.tsx`:

```tsx
'use client'

import { useMediaStore } from '@/lib/store/media-store'

export function VolumeControl() {
  const volume = useMediaStore((s) => s.volume)
  const setVolume = useMediaStore((s) => s.setVolume)

  return (
    <div className="hidden md:flex items-center gap-2 w-28">
      {/* Sound icon */}
      <svg className="w-5 h-5 text-white fill-current flex-shrink-0" viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
      </svg>
      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="w-full accent-white"
        aria-label="Volume"
      />
    </div>
  )
}
```

- [ ] **Step 4: Add VolumeControl to RadioPlayer**

In `src/components/home/RadioPlayer.tsx`, import `VolumeControl` and add it beside `PlayPauseButton`:

```tsx
import { VolumeControl } from './VolumeControl'

// In the button row div (currently has PlayPauseButton):
<div className="flex gap-11 items-center justify-center">
  <PlayPauseButton />
  <VolumeControl />
</div>
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no TypeScript or build errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/store/media-store.ts src/components/home/VolumeControl.tsx src/components/home/RadioPlayer.tsx
git commit -m "feat: add desktop volume control to radio player"
```

---

## Task 5: Add Sleep Timer Button and Overlay to RadioPlayer

**Files:**
- Create: `src/components/home/SleepTimerButton.tsx`
- Create: `src/components/home/SleepTimerOverlay.tsx`
- Modify: `src/lib/store/media-store.ts` — add sleep timer state
- Modify: `src/components/home/RadioPlayer.tsx` — add button + overlay

The sleep timer in the Astro version opens as an Unpoly modal. In Next.js it's a standalone page. Keep that — just add a Link to `/sleep-timer` with a clock icon. The overlay shows over the album art when timer is active.

- [ ] **Step 1: Add sleep timer state to media store**

In `src/lib/store/media-store.ts`, add to the state interface and implementation:

```typescript
// Interface additions:
sleepTimerActive: boolean
remainingSleepSeconds: number
setSleepTimerActive: (active: boolean) => void
setRemainingSleepSeconds: (s: number) => void
```

And in `create()`:
```typescript
sleepTimerActive: false,
remainingSleepSeconds: 0,
setSleepTimerActive: (active) => set({ sleepTimerActive: active }),
setRemainingSleepSeconds: (s) => set({ remainingSleepSeconds: s }),
```

- [ ] **Step 2: Wire sleep timer to sleep-timer page**

In `src/app/sleep-timer/page.tsx`, update the `start` function to also write to the global media store, so the overlay on the home page knows:

```typescript
const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)

function start(minutes: number) {
  setSelectedMinutes(minutes)
  setRemainingSeconds(minutes * 60)
  setActive(true)
  setSleepTimerActive(true)
  setRemainingSleepSeconds(minutes * 60)
}

function cancel() {
  setActive(false)
  setRemainingSeconds(0)
  setSelectedMinutes(null)
  setSleepTimerActive(false)
  setRemainingSleepSeconds(0)
  if (intervalRef.current) clearInterval(intervalRef.current)
}
```

Also update the `useEffect` countdown to sync `setRemainingSleepSeconds` and `setSleepTimerActive`:

```typescript
useEffect(() => {
  if (!active) return
  intervalRef.current = setInterval(() => {
    setRemainingSeconds((s) => {
      const next = s - 1
      setRemainingSleepSeconds(next)
      if (next <= 0) {
        setIsPlaying(false)
        setActive(false)
        setSleepTimerActive(false)
        return 0
      }
      return next
    })
  }, 1000)
  return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
}, [active, setIsPlaying, setSleepTimerActive, setRemainingSleepSeconds])
```

- [ ] **Step 3: Create SleepTimerButton**

Create `src/components/home/SleepTimerButton.tsx`:

```tsx
import Link from 'next/link'

export function SleepTimerButton() {
  return (
    <Link
      href="/sleep-timer"
      aria-label="Sleep Timer"
      className="bg-gray-500 rounded-full p-1 w-9 h-9 flex items-center justify-center fill-white"
    >
      {/* Clock icon */}
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    </Link>
  )
}
```

- [ ] **Step 4: Create SleepTimerOverlay**

Create `src/components/home/SleepTimerOverlay.tsx`:

```tsx
'use client'

import { useMediaStore } from '@/lib/store/media-store'

export function SleepTimerOverlay() {
  const active = useMediaStore((s) => s.sleepTimerActive)
  const seconds = useMediaStore((s) => s.remainingSleepSeconds)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)

  if (!active) return null

  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60

  function cancel() {
    setSleepTimerActive(false)
    setRemainingSleepSeconds(0)
    setIsPlaying(false)
  }

  return (
    <div className="absolute inset-0 z-10 bg-black/80 rounded flex flex-col items-center justify-center gap-4">
      <p className="text-white text-4xl font-mono">
        {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </p>
      <button
        onClick={cancel}
        className="text-white bg-white/10 uppercase font-bold border border-green-500 py-2 px-5 rounded-full"
      >
        Cancel
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Update RadioPlayer to include button and overlay**

In `src/components/home/RadioPlayer.tsx`, add both components:

```tsx
import { SleepTimerButton } from './SleepTimerButton'
import { SleepTimerOverlay } from './SleepTimerOverlay'

// Wrap the image in a relative div and add overlay:
<div className="relative flex items-center justify-center w-full">
  <SleepTimerOverlay />
  <Image ... />
</div>

// In the button row, add SleepTimerButton beside PlayPauseButton:
<div className="flex gap-5 md:items-center items-end">
  <PlayPauseButton />
  <SleepTimerButton />
</div>
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/store/media-store.ts src/app/sleep-timer/page.tsx src/components/home/SleepTimerButton.tsx src/components/home/SleepTimerOverlay.tsx src/components/home/RadioPlayer.tsx
git commit -m "feat: add sleep timer button and countdown overlay to radio player"
```

---

## Task 6: Add Click-to-Play on Album Art + IntersectionObserver MediaBar

**Files:**
- Modify: `src/components/home/RadioPlayer.tsx`

Astro toggles play when album art is clicked. It also shows the media bar only when the player scrolls out of view.

- [ ] **Step 1: Add click-to-play to album art**

In `src/components/home/RadioPlayer.tsx`, read `setIsPlaying` from store and attach onClick to the Image:

```tsx
const setIsPlaying = useMediaStore((s) => s.setIsPlaying)
const isPlaying = useMediaStore((s) => s.isPlaying)

// On the Image element:
<Image
  ...
  onClick={() => setIsPlaying(!isPlaying)}
  className="... cursor-pointer"
/>
```

- [ ] **Step 2: Add IntersectionObserver to auto-show/hide MediaBar**

In `src/components/home/RadioPlayer.tsx`, add a ref on the player container and use IntersectionObserver:

```tsx
import { useEffect, useRef } from 'react'

const containerRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (!containerRef.current) return
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        setShowMediaBar(false)
      } else if (window.scrollY > 100) {
        setShowMediaBar(true)
      }
    },
    { threshold: 0.1 }
  )
  observer.observe(containerRef.current)
  return () => observer.disconnect()
}, [setShowMediaBar])

// On the outermost div of the return:
<div ref={containerRef} className="p-2 pb-5 md:p-5 bg-gray-700/50 rounded">
```

Also update the initial `useEffect` to set `showMediaBar(false)` on mount (home page hides the bar, other pages show it):

```tsx
useEffect(() => {
  setShowMediaBar(false)
  return () => setShowMediaBar(true)
}, [setShowMediaBar])
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/RadioPlayer.tsx
git commit -m "feat: click-to-play on album art, auto-show/hide media bar via IntersectionObserver"
```

---

## Task 7: Contact Form — Honeypots, GDPR, Mobile-App reCAPTCHA Bypass

**Files:**
- Modify: `src/components/about/ContactForm.tsx`
- Modify: `src/actions/contact.ts`

- [ ] **Step 1: Update ContactForm component to add honeypots, GDPR, timestamp**

Replace the contents of `src/components/about/ContactForm.tsx` with:

```tsx
'use client'

import { useActionState, useEffect, useRef } from 'react'
import { submitContact, type ContactState } from '@/actions/contact'

const initial: ContactState = { success: false }

export function ContactForm() {
  const [state, action, isPending] = useActionState(submitContact, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const timestampRef = useRef(Date.now().toString())

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  return (
    <form ref={formRef} action={action} className="space-y-4 max-w-lg">
      {/* Honeypot fields — hidden from real users */}
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
          className="w-full bg-gray-700/50 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
        />
      </div>
      <div>
        <label htmlFor="email" className="text-white/80 text-sm block mb-1">Email *</label>
        <input
          id="email" name="email" type="email" required
          className="w-full bg-gray-700/50 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
        />
      </div>
      <div>
        <label htmlFor="message" className="text-white/80 text-sm block mb-1">Message *</label>
        <textarea
          id="message" name="message" required rows={5} minLength={10} maxLength={2000}
          className="w-full bg-gray-700/50 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20 resize-none"
        />
      </div>

      {/* GDPR consent */}
      <label className="flex gap-3 cursor-pointer items-start">
        <input type="checkbox" name="gdprConsent" required className="mt-1" />
        <span className="text-white text-sm leading-relaxed">
          I consent to having my submitted information stored for the purpose of responding to my inquiry. *
        </span>
      </label>

      {state.error && <p role="alert" className="text-red-400 text-sm">{state.error}</p>}
      {state.success && <p role="status" className="text-green-400 text-sm">Message sent! We&apos;ll be in touch.</p>}

      <button
        type="submit" disabled={isPending}
        className="bg-[var(--color-brand-green)] text-white px-6 py-2 rounded font-medium text-sm disabled:opacity-50"
      >
        {isPending ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Update contact server action to check honeypots, GDPR, timestamp, mobile-app bypass**

Replace `src/actions/contact.ts` with:

```typescript
'use server'

import { headers } from 'next/headers'

export interface ContactState {
  success: boolean
  error?: string
}

const MIN_SUBMIT_MS = 3_000 // 3 seconds — bots submit instantly

export async function submitContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const name = formData.get('name')
  const email = formData.get('email')
  const message = formData.get('message')
  const gdprConsent = formData.get('gdprConsent')
  const recaptchaToken = formData.get('recaptchaToken')
  const timestamp = formData.get('timestamp')

  // Honeypot fields — any value here means a bot
  const honeypots = ['website', 'url', 'homepage', 'phone']
  for (const field of honeypots) {
    if (formData.get(field)) {
      // Silently succeed to not tip off bots
      return { success: true }
    }
  }

  // Timing check
  if (timestamp) {
    const elapsed = Date.now() - Number(timestamp)
    if (elapsed < MIN_SUBMIT_MS) {
      return { success: true } // Silent — bot
    }
  }

  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
    return { success: false, error: 'Invalid form data.' }
  }

  if (name.length < 2 || name.length > 100) {
    return { success: false, error: 'Name must be 2–100 characters.' }
  }

  if (message.length < 10 || message.length > 2000) {
    return { success: false, error: 'Message must be 10–2000 characters.' }
  }

  if (!gdprConsent) {
    return { success: false, error: 'Please accept the consent checkbox.' }
  }

  // Mobile app WebView skips reCAPTCHA
  const headersList = await headers()
  const isMobileApp =
    headersList.get('mobile-app') === 'true' ||
    headersList.get('cookie')?.includes('mobile-app=true')

  if (!isMobileApp) {
    if (!recaptchaToken || typeof recaptchaToken !== 'string') {
      return { success: false, error: 'reCAPTCHA verification required.' }
    }

    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY ?? '',
        response: recaptchaToken,
      }),
    })
    const verifyData = await verifyRes.json() as { success: boolean; score?: number }

    if (!verifyData.success || (verifyData.score !== undefined && verifyData.score < 0.5)) {
      return { success: false, error: 'reCAPTCHA verification failed. Please try again.' }
    }
  }

  const formspreeRes = await fetch(process.env.FORMSPREE_ENDPOINT ?? '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      name,
      email,
      message,
      gdprConsent: true,
      _subject: 'New Contact Form Submission - Reach Radio',
    }),
  })

  if (!formspreeRes.ok) {
    return { success: false, error: 'Failed to send message. Please try again.' }
  }

  return { success: true }
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/about/ContactForm.tsx src/actions/contact.ts
git commit -m "feat: contact form — add honeypots, GDPR consent, timing check, mobile-app reCAPTCHA bypass"
```

---

## Task 8: About Page — Frequencies, App Download Links, Privacy Policy Link

**Files:**
- Modify: `src/app/about/page.tsx`

- [ ] **Step 1: Read current about page**

Open `src/app/about/page.tsx` to understand current structure.

- [ ] **Step 2: Replace about page content**

```tsx
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ContactForm } from '@/components/about/ContactForm'

export const metadata: Metadata = {
  title: 'About',
  description: 'About Reach Radio — 106.7FM / 690AM in Tucson, AZ',
}

export default async function AboutPage() {
  const headersList = await headers()
  const isMobileApp = headersList.get('mobile-app') === 'true'

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      {/* Frequency hero */}
      <div className="grid md:grid-cols-2 rounded overflow-hidden">
        <div className="text-center p-5 bg-gradient-to-b from-green-600 to-green-700 flex flex-col justify-center items-center">
          <div className="text-5xl text-white font-bold">690AM</div>
          <div className="text-5xl text-white font-bold">106.7FM</div>
          <div className="text-lg text-white uppercase font-bold mt-1">On the air in Tucson, AZ</div>
        </div>
        <div className="p-6 bg-gradient-to-b from-gray-800 to-gray-900">
          <div className="border-l-4 pl-3 font-bold text-xl mb-3 border-l-green-500 uppercase text-white">
            Providing Solid Bible Teachings and Uplifting Worship 24/7
          </div>
          <p className="text-white/80">
            Reach Radio first went online in February 2016, and on the air in February 2017.
            Our goal is simple, to bring the life-saving message and hope of the gospel to
            as many as can hear via the Tucson radio airwaves.
          </p>
        </div>
      </div>

      {/* App download links — hidden in mobile app */}
      {!isMobileApp && (
        <div className="bg-gray-700/40 p-5 rounded">
          <h2 className="text-white text-2xl mb-4">Download App</h2>
          <div className="flex gap-3 flex-wrap">
            <a
              href="https://apps.apple.com/us/app/reach-radio-fm/id1246500077"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-600 transition-colors"
            >
              App Store (iOS)
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.goodbarber.reachradio&hl=en_US&gl=US"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-600 transition-colors"
            >
              Google Play
            </a>
          </div>
        </div>
      )}

      {/* Contact form */}
      <div className="bg-gray-700/40 p-5 rounded">
        <h2 className="text-white text-2xl mb-2">Got Questions?</h2>
        <p className="text-white/60 text-sm mb-4">Send us a message and we will get back to you as soon as possible.</p>
        <ContactForm />
      </div>

      {/* Privacy policy */}
      <div className="bg-gray-700/40 p-5 rounded">
        <h2 className="text-white text-2xl mb-3">Privacy Policy</h2>
        <Link
          href="/about/privacy-policy"
          className="text-[var(--color-brand-green)] hover:underline text-sm"
        >
          Read our privacy policy →
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/about/page.tsx
git commit -m "feat: about page — add frequency display, app download links, privacy policy link"
```

---

## Task 9: Persist mobile-app Cookie in Layout

**Files:**
- Modify: `src/app/layout.tsx`

When `mobile-app: true` header is present, set a 10-year cookie so subsequent navigations (which don't include the header) still know it's a mobile app context.

- [ ] **Step 1: Update layout to set cookie**

In `src/app/layout.tsx`, add cookie-setting logic. Next.js App Router can set cookies in Server Components via `cookies()`:

```tsx
import { headers, cookies } from 'next/headers'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const cookieStore = await cookies()
  const isMobileAppHeader = headersList.get('mobile-app') === 'true'
  const isMobileAppCookie = cookieStore.get('mobile-app')?.value === 'true'
  const isMobileApp = isMobileAppHeader || isMobileAppCookie

  // Persist mobile-app state as a long-lived cookie
  if (isMobileAppHeader && !isMobileAppCookie) {
    cookieStore.set('mobile-app', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
      httpOnly: false, // client JS may need to read it
      sameSite: 'lax',
    })
  }

  return (
    <html lang="en">
      <body className="bg-[var(--color-brand-purple)] text-white min-h-screen">
        ...
      </body>
    </html>
  )
}
```

**Note:** In Next.js 15, `cookies()` in a Server Component outside a Route Handler is read-only — you cannot call `set()` on it directly. Instead, use a Server Action or Route Handler to set the cookie. The simplest workaround: create a small client component `BridgeInit` extension that sets the cookie client-side via `document.cookie` when `mobile-app` header is detected.

Alternative (simpler): detect via a `BridgeInit` client component that reads the bridge postMessage and sets `document.cookie` on first message. This already exists — update `BridgeInit.tsx` to set the cookie:

In `src/components/bridge/BridgeInit.tsx`, add:

```tsx
// When any message arrives from native app, set mobile-app cookie
useEffect(() => {
  function handleMessage(e: MessageEvent) {
    if (!document.cookie.includes('mobile-app=true')) {
      document.cookie = 'mobile-app=true; path=/; max-age=' + (60 * 60 * 24 * 365 * 10)
    }
  }
  window.addEventListener('message', handleMessage)
  return () => window.removeEventListener('message', handleMessage)
}, [])
```

- [ ] **Step 2: Read BridgeInit to understand its current shape**

Open `src/components/bridge/BridgeInit.tsx` and add the cookie-setting logic to the existing message handler.

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/bridge/BridgeInit.tsx src/app/layout.tsx
git commit -m "feat: persist mobile-app session via cookie from BridgeInit"
```

---

## Task 10: Teacher Card — Box Shadow, Green Border, Hover Scale

**Files:**
- Modify: `src/components/teachers/TeacherCard.tsx`

Astro card: `[box-shadow:0_0_28px_-10px_#517987] border border-green-700 can-hover:sm:hover:scale-105 transition-all duration-500`

- [ ] **Step 1: Update TeacherCard className**

In `src/components/teachers/TeacherCard.tsx`, update the `Link` className to add the shadow, border, and hover scale:

```tsx
className="block rounded overflow-hidden transition-all duration-500 border border-green-700 [box-shadow:0_0_28px_-10px_#517987] hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
```

Remove `bg-gray-700/30 hover:bg-gray-700/50 transition-colors` (replaced by the shadow/scale approach matching Astro).

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/TeacherCard.tsx
git commit -m "fix: teacher card — restore teal box-shadow, green border, hover scale matching original"
```

---

## Task 11: Teacher Detail — 2-Column Layout, Button-Style Links, Grouped Schedule

**Files:**
- Modify: `src/app/teachers/[slug]/page.tsx`

Astro: 2-col grid (`md:grid-cols-2`) — full-width photo left with `rounded-br-3xl`, info right. Links are button-styled. Schedule groups by day in cards.

- [ ] **Step 1: Update teacher detail layout**

In `src/app/teachers/[slug]/page.tsx`, replace the return JSX with the 2-column layout:

```tsx
return (
  <div>
    <div className="px-4 py-4">
      <Link
        href="/teachers"
        transitionTypes={['nav-back']}
        className="text-white/60 text-sm hover:text-white inline-flex items-center gap-1"
      >
        <span aria-hidden="true">←</span> Teachers
      </Link>
    </div>

    <PersonSchema
      name={teacher.name}
      jobTitle={teacher.title}
      imageUrl={teacher.photo}
      url={`https://reach-radio.com/teachers/${teacher.slug}`}
    />

    <div className="grid md:grid-cols-2 grid-cols-1 gap-x-16 gap-y-5 text-white">
      {/* Photo — full width on left, no padding */}
      {teacher.photo && (
        <ViewTransition name={`teacher-${teacher.slug}`}>
          <Image
            src={teacher.photo}
            alt={teacher.name}
            width={600}
            height={600}
            className="w-full md:rounded-br-3xl aspect-square object-cover"
            priority
          />
        </ViewTransition>
      )}

      {/* Info */}
      <div className="md:mt-5 md:px-0 md:pr-3 px-3">
        <h1 className="text-4xl">{teacher.name}</h1>
        {teacher.title && (
          <h2 className="uppercase font-bold mt-1 text-white/80">
            {teacher.title}{teacher.subtitle ? `: ${teacher.subtitle}` : ''}
          </h2>
        )}

        {/* Button-style links */}
        {teacher.links && teacher.links.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {teacher.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[var(--color-brand-green)] text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
              >
                {link.title}
              </a>
            ))}
          </div>
        )}

        {/* Schedule grouped by day in cards */}
        {sortedSchedule.length > 0 && (
          <div className="mt-6">
            <h2 className="text-2xl mb-3">Schedule</h2>
            {sortedSchedule.map((day) => (
              <div key={day.day} className="mb-5">
                <h3 className="font-bold text-lg mb-2">{day.day}</h3>
                <div className="flex flex-col gap-2">
                  {day.times.map((t, i) => (
                    <div key={i} className="bg-gray-700 p-3 rounded text-sm">
                      {t.startTime} – {t.endTime}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/teachers/[slug]/page.tsx
git commit -m "fix: teacher detail — 2-col layout, button-style links, grouped schedule cards matching original"
```

---

## Task 12: Add /api/stream-info JSON Endpoint

**Files:**
- Create: `src/app/api/stream-info/route.ts`

Some clients (older native app fallback, server-to-server) use the plain JSON endpoint rather than SSE.

- [ ] **Step 1: Create the route**

Create `src/app/api/stream-info/route.ts`:

```typescript
const RADIOJAR_URL =
  'https://proxy.radiojar.com/api/stations/g4d600bv6p5tv/now_playing/?callback='

export async function GET(): Promise<Response> {
  try {
    const res = await fetch(RADIOJAR_URL, {
      next: { revalidate: 0 },
    })
    const text = await res.text()
    // Strip JSONP wrapper: callback(...)
    const json = JSON.parse(text.substring(1, text.length - 2)) as {
      title?: string
      artist?: string
    }

    const streamTitle = json.title || 'Reach Radio FM'
    const streamArtist = json.artist || ''

    return Response.json({ streamTitle, streamArtist })
  } catch {
    return Response.json({ streamTitle: 'Reach Radio FM', streamArtist: '' }, { status: 200 })
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stream-info/route.ts
git commit -m "feat: add /api/stream-info JSON endpoint for non-SSE clients"
```

---

## Self-Review

**Spec coverage check:**

| Gap | Task |
|-----|------|
| CSP blocks donate/reCAPTCHA/Formspree | Task 1 ✓ |
| Wrong donate form ID | Task 2 ✓ |
| Donate skeleton + iframe focus/blur | Task 2 ✓ |
| Sleep timer options wrong | Task 3 ✓ |
| No volume control | Task 4 ✓ |
| No sleep timer button on player | Task 5 ✓ |
| No sleep timer overlay | Task 5 ✓ |
| Click-to-play album art | Task 6 ✓ |
| IntersectionObserver media bar | Task 6 ✓ |
| No honeypots/GDPR/timing on contact form | Task 7 ✓ |
| Mobile-app reCAPTCHA bypass | Task 7 ✓ |
| About page frequencies / app links / privacy link | Task 8 ✓ |
| Mobile-app cookie persistence | Task 9 ✓ |
| Teacher card shadow/border/hover | Task 10 ✓ |
| Teacher detail layout/links/schedule | Task 11 ✓ |
| /api/stream-info JSON endpoint | Task 12 ✓ |

**Intentionally not included:**
- Hyperview endpoint — different native app architecture, not part of Next.js target
- Privacy policy content — stub is acceptable; content is static text the user can fill in

**Placeholder scan:** All steps have concrete code. No TBDs found.

**Type consistency:** `setSleepTimerActive`, `setRemainingSleepSeconds`, `setVolume`, `setMuted` defined in Task 4/5 step 1 and consumed in later steps of same task. `ContactState` interface unchanged. ✓
