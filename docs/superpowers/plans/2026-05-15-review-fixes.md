# Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical bugs, security issues, accessibility failures, SEO gaps, and warnings identified in the pre-launch review.

**Architecture:** Five independent task groups (A–E) with zero file overlap — run in parallel. Each group owns a specific concern and can commit independently. No shared state between groups.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind CSS, Zustand, `next/og` for OG image, `ReadableStream` Web API.

---

## File Map

| Group | Files |
|-------|-------|
| A — Bugs + Security | `src/app/api/stream-info-sse/route.ts`, `src/components/bridge/BridgeInit.tsx`, `src/actions/contact.ts`, `src/components/seo/RadioStationSchema.tsx` |
| B — Layout + App-level | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/about/page.tsx`, `src/app/opengraph-image.tsx` (new) |
| C — Accessibility (UI) | `src/components/layout/Header.tsx`, `src/components/layout/MobileHeader.tsx`, `src/components/layout/MobileNav.tsx`, `src/components/layout/Footer.tsx`, `src/components/teachers/TeacherCard.tsx`, `src/components/teachers/SearchBar.tsx`, `src/components/media-bar/MediaBar.tsx` |
| D — Teacher + Donate pages | `src/app/teachers/page.tsx`, `src/app/teachers/[slug]/page.tsx`, `src/app/donate/page.tsx` |
| E — Types + Hook tweaks | `src/lib/sanity/types.ts`, `src/hooks/useNowPlaying.ts` |

---

## Group A — Bugs + Security

### Task A1: Fix SSE interval leak

**Files:**
- Modify: `src/app/api/stream-info-sse/route.ts`

The `start()` function returns a cancel closure, but `ReadableStream` ignores return values from `start`. The `cancel` handler must be a named property on the source object. Without this, every connected client leaks a 30s interval forever.

- [ ] **Step 1: Apply fix**

Replace the entire file:

```typescript
const RADIOJAR_URL = 'https://proxy.radiojar.com/api/stations/g4d600bv6p5tv/now_playing/?callback='

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder()
  let interval: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    async start(controller) {
      async function poll() {
        try {
          const res = await fetch(RADIOJAR_URL, {
            signal: AbortSignal.timeout(5_000),
          })
          const text = await res.text()
          const json = JSON.parse(text.substring(1, text.length - 2)) as {
            song?: { title?: string; artist?: string }
          }
          const title = json.song?.title || 'Reach Radio'
          const artist = json.song?.artist || ''
          const data = JSON.stringify({ title, artist })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch {
          // retain previous state — send nothing on error
        }
      }

      await poll()
      interval = setInterval(poll, 30_000)
    },
    cancel() {
      clearInterval(interval)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stream-info-sse/route.ts
git commit -m "fix(sse): wire cancel handler to clear interval on client disconnect"
```

---

### Task A2: Fix BridgeInit cookie from any origin

**Files:**
- Modify: `src/components/bridge/BridgeInit.tsx`

`handleMessage` sets the `mobile-app=true` cookie for any `message` event from any origin. A cross-origin iframe or page could set this cookie silently. Fix: only accept messages from the same origin or null-origin (Android WebView native postMessage).

- [ ] **Step 1: Apply fix**

In `BridgeInit.tsx`, replace the third `useEffect`:

```typescript
useEffect(() => {
  function handleMessage(e: MessageEvent) {
    // Allow same-origin and null-origin (native WebView postMessage)
    if (e.origin !== '' && e.origin !== window.location.origin) return
    if (!document.cookie.includes('mobile-app=true')) {
      document.cookie = 'mobile-app=true; path=/; max-age=315360000'
    }
  }
  window.addEventListener('message', handleMessage)
  return () => window.removeEventListener('message', handleMessage)
}, [])
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/bridge/BridgeInit.tsx
git commit -m "fix(security): restrict BridgeInit cookie to same-origin and native WebView messages"
```

---

### Task A3: Add email format validation

**Files:**
- Modify: `src/actions/contact.ts`

No email format validation exists. A malformed email passes all checks and reaches Formspree, which may silently drop it.

- [ ] **Step 1: Apply fix**

In `src/actions/contact.ts`, after the existing length checks on `name` and before the `gdprConsent` check, add:

```typescript
  if (message.length < 10 || message.length > 2000) {
    return { success: false, error: 'Message must be 10–2000 characters.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Please enter a valid email address.' }
  }

  if (!gdprConsent) {
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/actions/contact.ts
git commit -m "fix(contact): add email format validation before submission"
```

---

### Task A4: Fix JSON-LD `</script>` injection risk

**Files:**
- Modify: `src/components/seo/RadioStationSchema.tsx`

`JSON.stringify` can emit `</script>` if CMS data contains it, which would terminate the script tag early. All three schema components in this file need a safe serializer.

- [ ] **Step 1: Apply fix**

Add `safeJsonLd` helper at the top of `src/components/seo/RadioStationSchema.tsx`, then replace all three `JSON.stringify(schema)` calls:

```typescript
function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/<\/script>/gi, '<\\/script>')
}

export function RadioStationSchema() {
  const schema = {
    // ... (unchanged)
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
}

// PersonSchema — same change:
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )

// EventSchema — same change:
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
```

The full file after changes:

```typescript
function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/<\/script>/gi, '<\\/script>')
}

export function RadioStationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'RadioStation',
    name: 'Reach Radio',
    url: 'https://reach-radio.com',
    broadcastFrequency: [
      { '@type': 'BroadcastFrequencySpecification', broadcastFrequency: '106.7', broadcastSignalModulation: 'FM' },
      { '@type': 'BroadcastFrequencySpecification', broadcastFrequency: '690', broadcastSignalModulation: 'AM' },
    ],
    areaServed: {
      '@type': 'City',
      name: 'Tucson',
      containedInPlace: { '@type': 'State', name: 'Arizona' },
    },
    broadcaster: {
      '@type': 'Organization',
      name: 'Calvary Chapel of Tucson, Inc.',
      url: 'https://calvarytucson.com',
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
}

interface PersonSchemaProps {
  name: string
  jobTitle: string
  imageUrl?: string
  url: string
}

export function PersonSchema({ name, jobTitle, imageUrl, url }: PersonSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    jobTitle,
    ...(imageUrl ? { image: imageUrl } : {}),
    url,
    worksFor: {
      '@type': 'Organization',
      name: 'Reach Radio',
      url: 'https://reach-radio.com',
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
}

interface EventItem {
  name: string
  startTime: string
  endTime: string
  day: string
}

interface EventSchemaProps {
  events: EventItem[]
}

export function EventSchema({ events }: EventSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Event',
        name: event.name,
        description: `${event.day} ${event.startTime}–${event.endTime}`,
        organizer: {
          '@type': 'Organization',
          name: 'Reach Radio',
          url: 'https://reach-radio.com',
        },
      },
    })),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  )
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/seo/RadioStationSchema.tsx
git commit -m "fix(security): escape </script> in JSON-LD schema output"
```

---

## Group B — Layout + App-level

### Task B1: Conditional SleepTimerProvider

**Files:**
- Modify: `src/app/layout.tsx`

`SleepTimerProvider` renders unconditionally. In mobile-app mode, `AudioProvider` is absent, so the timer fires `setIsPlaying(false)` against no audio element. Wrap it with the same `!isMobileApp` guard.

Also remove the manual `openGraph.images: ['/og-image.png']` — the file doesn't exist and will be replaced by the file-convention OG image in Task B4.

- [ ] **Step 1: Apply fix**

In `src/app/layout.tsx`, make two changes:

**Change 1** — remove `openGraph.images` from the metadata export:

```typescript
export const metadata: Metadata = {
  title: { default: 'Reach Radio', template: '%s | Reach Radio' },
  description: 'Reach Radio 106.7FM / 690AM — Tucson, AZ',
  metadataBase: new URL('https://reach-radio.com'),
}
```

**Change 2** — wrap `SleepTimerProvider` conditionally in the JSX:

```tsx
        {!isMobileApp && <AudioProvider streamUrl={streamUrl} />}
        {!isMobileApp && <SleepTimerProvider />}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(layout): guard SleepTimerProvider behind !isMobileApp; remove missing og-image ref"
```

---

### Task B2: Fix heading hierarchy

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/about/page.tsx`

Both pages have `<h2>` elements but no `<h1>`, which is a WCAG 2.1 failure (1.3.1 Info and Relationships). Fix: add a visually hidden `<h1>` as the first heading on each page.

- [ ] **Step 1: Fix home page**

In `src/app/page.tsx`, add `<h1 className="sr-only">Reach Radio</h1>` as the first child of the root `<div>`:

```tsx
export default function HomePage() {
  return (
    <div className="px-3 pt-3 space-y-6 pb-32">
      <h1 className="sr-only">Reach Radio</h1>
      <RadioStationSchema />

      <Suspense fallback={<RadioPlayerSkeleton />}>
        <RadioPlayer />
      </Suspense>

      <section>
        <h2 className="text-white font-semibold text-base mb-3">Today&apos;s Schedule</h2>
        <Suspense fallback={<ScheduleSkeleton />}>
          <TodaySchedule />
        </Suspense>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Fix about page**

In `src/app/about/page.tsx`, add `<h1 className="sr-only">About Reach Radio</h1>` as the first child:

```tsx
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      <h1 className="sr-only">About Reach Radio</h1>

      {/* Frequency hero */}
      <div className="grid md:grid-cols-2 rounded overflow-hidden">
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/about/page.tsx
git commit -m "fix(a11y): add sr-only h1 to home and about pages for heading hierarchy"
```

---

### Task B3: Add canonical URLs to root-level pages

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/about/page.tsx`

Add `alternates.canonical` to the root layout (site-wide default) and override on individual pages.

- [ ] **Step 1: Add site-wide canonical base to layout metadata**

In `src/app/layout.tsx`, update the metadata export (after Task B1 changes):

```typescript
export const metadata: Metadata = {
  title: { default: 'Reach Radio', template: '%s | Reach Radio' },
  description: 'Reach Radio 106.7FM / 690AM — Tucson, AZ',
  metadataBase: new URL('https://reach-radio.com'),
  alternates: {
    canonical: '/',
  },
}
```

- [ ] **Step 2: Add canonical to home page**

In `src/app/page.tsx`, update metadata:

```typescript
export const metadata: Metadata = {
  title: 'Listen',
  description: 'Reach Radio features Bible teachings and Christian music. Listen online or on the air in Tucson at 106.7FM and 690AM.',
  alternates: { canonical: '/' },
}
```

- [ ] **Step 3: Add canonical to about page**

In `src/app/about/page.tsx`, update metadata:

```typescript
export const metadata: Metadata = {
  title: 'About',
  description: 'About Reach Radio — 106.7FM / 690AM in Tucson, AZ',
  alternates: { canonical: '/about' },
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/about/page.tsx
git commit -m "feat(seo): add canonical URLs to layout, home, and about pages"
```

---

### Task B4: Create OG image via Next.js file convention

**Files:**
- Create: `src/app/opengraph-image.tsx`

Next.js 13+ picks up `app/opengraph-image.tsx` automatically and injects the correct `<meta property="og:image">` tag. No static PNG file needed.

- [ ] **Step 1: Create file**

```typescript
// src/app/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Reach Radio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1040 0%, #2D1B69 50%, #1a1040 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 80,
            fontWeight: 800,
            letterSpacing: '-3px',
            lineHeight: 1,
          }}
        >
          Reach Radio
        </div>
        <div
          style={{
            color: '#22C55E',
            fontSize: 36,
            fontWeight: 600,
            marginTop: 24,
            letterSpacing: '2px',
          }}
        >
          106.7FM · 690AM
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 24,
            marginTop: 8,
          }}
        >
          Tucson, AZ
        </div>
      </div>
    ),
    { ...size }
  )
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/opengraph-image.tsx
git commit -m "feat(seo): add OG image via Next.js file convention (1200x630, brand purple)"
```

---

## Group C — Accessibility (UI Components)

### Task C1: Logo link accessible names

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/MobileHeader.tsx`

Logo `<Link href="/">` wraps an `<Image alt="Reach Radio">`. While the alt text theoretically provides the accessible name, explicitly labelling the link avoids ambiguity across assistive technologies.

- [ ] **Step 1: Fix Header.tsx**

In `src/components/layout/Header.tsx`, add `aria-label` to the logo link:

```tsx
      <Link href="/" aria-label="Reach Radio home" className="flex items-center w-[clamp(130px,16vw,186px)]">
        <Image
          src="/reach_radio_logo.svg"
          alt=""
          width={186}
          height={40}
          className="h-10 w-auto"
          priority
        />
      </Link>
```

Note: `alt=""` makes the image decorative (the link's accessible name comes from `aria-label`).

- [ ] **Step 2: Fix MobileHeader.tsx**

In `src/components/layout/MobileHeader.tsx`, same change on the logo link:

```tsx
      <Link href="/" aria-label="Reach Radio home" className="w-[clamp(180px,40vw,250px)]">
        <Image
          src="/reach_radio_logo.svg"
          alt=""
          width={250}
          height={40}
          className="h-8 w-auto"
          priority
        />
      </Link>
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header.tsx src/components/layout/MobileHeader.tsx
git commit -m "fix(a11y): add aria-label to logo links in Header and MobileHeader"
```

---

### Task C2: Teacher card accessible name

**Files:**
- Modify: `src/components/teachers/TeacherCard.tsx`

The card `<Link>` wraps an image and text. Screen readers may announce both the alt text and visible text, causing duplication. An explicit `aria-label` on the link and `alt=""` on the image avoids this.

- [ ] **Step 1: Apply fix**

In `src/components/teachers/TeacherCard.tsx`, update the Link and the Image:

```tsx
export function TeacherCard({ teacher }: { teacher: TeacherSummary }) {
  return (
    <Link
      href={`/teachers/${teacher.slug}`}
      aria-label={teacher.name}
      transitionTypes={['nav-forward']}
      className="block rounded overflow-hidden border border-green-700 [box-shadow:0_0_28px_-10px_#517987] motion-safe:hover:scale-105 transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {teacher.photo ? (
        <ViewTransition name={`teacher-${teacher.slug}`}>
          <div className="relative aspect-square">
            <Image
              src={teacher.photo}
              alt=""
              fill
              className="object-cover"
              placeholder={teacher.lqip ? 'blur' : 'empty'}
              blurDataURL={teacher.lqip}
              sizes="(max-width: 640px) 50vw, 25vw"
            />
          </div>
        </ViewTransition>
      ) : (
        <TeacherInitials name={teacher.name} />
      )}
      <div className="p-3">
        <p className="text-white font-semibold text-sm" aria-hidden="true">{teacher.name}</p>
        <p className="text-white/80 text-xs mt-1" aria-hidden="true">{teacher.title}</p>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/TeacherCard.tsx
git commit -m "fix(a11y): add aria-label to teacher card link; suppress duplicate text from SR"
```

---

### Task C3: MediaBar landmark role

**Files:**
- Modify: `src/components/media-bar/MediaBar.tsx`

The media bar is a persistent control region but renders as a plain `<div>` with no landmark role. Screen reader users cannot navigate to it by landmark.

- [ ] **Step 1: Apply fix**

In `src/components/media-bar/MediaBar.tsx`, add `role` and `aria-label` to the outer div:

```tsx
  return (
    <div
      role="region"
      aria-label="Media player"
      className="fixed bottom-[72px] md:bottom-0 left-0 right-0 bg-[var(--color-brand-gray)] border-t border-white/10 px-4 py-2 flex items-center gap-3 z-50"
    >
      <NowPlayingInfo />
      <PlayPauseButton />
    </div>
  )
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/media-bar/MediaBar.tsx
git commit -m "fix(a11y): add role=region and aria-label to MediaBar"
```

---

### Task C4: Focus-visible styles on nav and footer links

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/MobileHeader.tsx`
- Modify: `src/components/layout/MobileNav.tsx`
- Modify: `src/components/layout/Footer.tsx`

Nav and footer links have `hover:` styles but no `focus-visible:` ring. Keyboard users get no visible focus indicator (WCAG 2.4.7).

- [ ] **Step 1: Header.tsx nav links**

In `src/components/layout/Header.tsx`, update each nav `<Link>` className to add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`:

```tsx
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center h-16 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded"
            >
```

Also update the Contact link and Facebook link:

```tsx
        <a
          href="https://www.facebook.com/reachradiotucson"
          target="_blank"
          rel="noopener noreferrer"
          title="Facebook"
          className="w-7 fill-slate-300 hover:fill-white transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded"
          aria-label="Reach Radio on Facebook"
        >
```

```tsx
        <Link
          href="/about#aboutGotQuestions"
          className="flex items-center px-3 py-1.5 bg-white rounded text-black font-bold text-sm hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
```

- [ ] **Step 2: MobileHeader.tsx links**

In `src/components/layout/MobileHeader.tsx`, update the Facebook link and Contact link:

```tsx
        <a
          href="https://www.facebook.com/reachradiotucson"
          target="_blank"
          rel="noopener noreferrer"
          title="Facebook"
          className="w-8 fill-slate-300 hover:fill-white transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded"
          aria-label="Reach Radio on Facebook"
        >
```

```tsx
        <Link
          href="/about#aboutGotQuestions"
          className="flex items-center px-2 py-1 bg-white rounded text-black font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
```

- [ ] **Step 3: MobileNav.tsx nav links**

In `src/components/layout/MobileNav.tsx`, update each `<Link>` className:

```tsx
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className="relative flex flex-col items-center pb-5 pt-4 px-4 min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded"
          >
```

- [ ] **Step 4: Footer.tsx links**

In `src/components/layout/Footer.tsx`, update both links:

```tsx
      <div className="flex justify-center gap-4 mt-2">
        <Link href="/about/privacy-policy" className="hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white focus-visible:rounded">Privacy Policy</Link>
        <Link href="/about" className="hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white focus-visible:rounded">Contact</Link>
      </div>
```

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Header.tsx src/components/layout/MobileHeader.tsx src/components/layout/MobileNav.tsx src/components/layout/Footer.tsx
git commit -m "fix(a11y): add focus-visible rings to nav and footer links"
```

---

### Task C5: Touch targets, SearchBar focus-visible, and search role

**Files:**
- Modify: `src/components/teachers/SearchBar.tsx`

Three issues:
1. Search input height ~37px (below 44px WCAG 2.5.5 minimum touch target)
2. Focus ring too subtle (`focus:ring-1 focus:ring-white/20`)
3. `<form>` missing `role="search"` — WCAG 4.1.2 (the 6th WCAG fail)

- [ ] **Step 1: Apply fix**

In `src/components/teachers/SearchBar.tsx`, update the form and input:

```tsx
    <form onSubmit={handleSubmit} role="search" className="flex gap-2 mb-6">
      <label htmlFor="teacher-search" className="sr-only">Search teachers</label>
      <input
        id="teacher-search"
        name="q"
        type="search"
        defaultValue={searchParams.get('q') ?? ''}
        placeholder="Search teachers..."
        maxLength={100}
        className="flex-1 min-h-[44px] bg-gray-700/50 text-white placeholder:text-white/40 rounded px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-white"
      />
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/teachers/SearchBar.tsx
git commit -m "fix(a11y): min-h-[44px] touch target and stronger focus ring on search input"
```

---

## Group D — Teacher + Donate Pages

### Task D1: Add revalidate to teacher pages

**Files:**
- Modify: `src/app/teachers/page.tsx`
- Modify: `src/app/teachers/[slug]/page.tsx`

Teacher pages use `generateStaticParams` with Sanity tags-based revalidation, but there is no `revalidate` export. Without it, pages cached at build time never refresh from ISR. Add `revalidate = 3600` (1 hour).

- [ ] **Step 1: teachers/page.tsx**

In `src/app/teachers/page.tsx`, add after the imports and before `metadata`:

```typescript
export const revalidate = 3600
```

Full file after change (only adding one line):

```typescript
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { sanityFetch } from '@/lib/sanity/client'
import { teacherListQuery } from '@/lib/sanity/queries'
import type { TeacherSummary } from '@/lib/sanity/types'
import { TeacherCard } from '@/components/teachers/TeacherCard'
import { SearchBar } from '@/components/teachers/SearchBar'
import { TeacherGridSkeleton } from '@/components/skeletons/TeacherCardSkeleton'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Teachers',
  description: 'Listen to many great bible teachers on Reach Radio Tucson.',
  alternates: { canonical: '/teachers' },
}
// ... rest unchanged
```

- [ ] **Step 2: teachers/[slug]/page.tsx**

In `src/app/teachers/[slug]/page.tsx`, add after imports:

```typescript
export const revalidate = 3600
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/teachers/page.tsx" "src/app/teachers/[slug]/page.tsx"
git commit -m "fix(perf): add revalidate=3600 to teacher pages for ISR cache refresh"
```

---

### Task D2: Add canonical URLs to teacher and donate pages

**Files:**
- Modify: `src/app/teachers/page.tsx`
- Modify: `src/app/teachers/[slug]/page.tsx`
- Modify: `src/app/donate/page.tsx`

- [ ] **Step 1: teachers/page.tsx**

Update the `metadata` export (combined with Task D1 changes):

```typescript
export const metadata: Metadata = {
  title: 'Teachers',
  description: 'Listen to many great bible teachers on Reach Radio Tucson.',
  alternates: { canonical: '/teachers' },
}
```

- [ ] **Step 2: teachers/[slug]/page.tsx**

In `generateMetadata`, add `alternates`:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const teacher = await getTeacher(slug)
  if (!teacher) return { title: 'Teacher Not Found' }
  return {
    title: teacher.name,
    description: `${teacher.title} on Reach Radio Tucson`,
    alternates: { canonical: `/teachers/${slug}` },
    openGraph: {
      images: teacher.photo ? [{ url: teacher.photo }] : [],
    },
  }
}
```

- [ ] **Step 3: donate/layout.tsx**

`src/app/donate/layout.tsx` already exists with a `metadata` export. Add `alternates.canonical`:

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Donate',
  description: 'Support Reach Radio — 106.7FM / 690AM in Tucson, AZ',
  alternates: { canonical: '/donate' },
}

export default function DonateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/teachers/page.tsx" "src/app/teachers/[slug]/page.tsx" src/app/donate/layout.tsx
git commit -m "feat(seo): add canonical URLs to teacher and donate pages"
```

---

### Task D3: Donate iframe sandbox + skeleton height

**Files:**
- Modify: `src/app/donate/page.tsx`

Two issues:
1. `<iframe>` has no `sandbox` attribute — allows the embedded form full privileges
2. Skeleton height is `h-[800px]` but iframe `min-h-[1000px]` — height mismatch causes CLS

- [ ] **Step 1: Apply both fixes**

In `src/app/donate/page.tsx`, update the skeleton and iframe:

```tsx
      {!loaded && (
        <div className="animate-pulse flex flex-col gap-4 h-[1000px] bg-black rounded p-4">
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
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
        className={`w-full min-h-[1000px] border-0 ${loaded ? 'block' : 'hidden'}`}
      />
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/donate/page.tsx
git commit -m "fix(donate): add iframe sandbox attribute; align skeleton height to iframe min-height"
```

---

## Group E — Types + Hook Tweaks

### Task E1: Type TeacherSummary.photo as `string | null`

**Files:**
- Modify: `src/lib/sanity/types.ts`
- Modify: `src/app/teachers/[slug]/page.tsx`

Sanity can return `null` for an unset image field. `photo: string` doesn't reflect this and causes silent type errors at runtime when null arrives.

- [ ] **Step 1: Update type**

In `src/lib/sanity/types.ts`, change the `photo` field in `TeacherSummary`:

```typescript
export interface TeacherSummary {
  name: string
  slug: string
  title: string
  photo: string | null
  lqip?: string
}
```

- [ ] **Step 2: Fix callsite in teachers/[slug]/page.tsx**

`PersonSchema` receives `imageUrl={teacher.photo}`. `PersonSchema.imageUrl` is typed `string | undefined`. Now that `photo` is `string | null`, pass `teacher.photo ?? undefined`:

```tsx
      <PersonSchema
        name={teacher.name}
        jobTitle={teacher.title}
        imageUrl={teacher.photo ?? undefined}
        url={`https://reach-radio.com/teachers/${teacher.slug}`}
      />
```

`TeacherCard` and `generateMetadata` already guard with `teacher.photo ?` so they're safe.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sanity/types.ts "src/app/teachers/[slug]/page.tsx"
git commit -m "fix(types): TeacherSummary.photo typed as string | null"
```

---

### Task E2: Add jitter to SSE retry backoff

**Files:**
- Modify: `src/hooks/useNowPlaying.ts`

Pure exponential backoff can cause retry storms when many clients reconnect simultaneously after a server restart. Add ±500ms jitter.

- [ ] **Step 1: Apply fix**

In `src/hooks/useNowPlaying.ts`, update the `onerror` handler:

```typescript
      es.onerror = () => {
        if (retries >= MAX_RETRIES) return
        const delay = Math.pow(2, retries) * 1000 + Math.random() * 500
        retries++
        retryTimer = setTimeout(connect, delay)
      }
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useNowPlaying.ts
git commit -m "fix(sse): add jitter to retry backoff to avoid reconnect storms"
```

---

## Final Verification

After all groups complete, run a full type check and build:

```bash
npx tsc --noEmit && npx next build
```

Expected: no new type errors (one pre-existing error exists at `src/app/api/revalidate/route.ts:27` — `Expected 2 arguments, but got 1` — this is out of scope for this plan). Build should succeed and no missing `og-image.png` warnings should appear.
