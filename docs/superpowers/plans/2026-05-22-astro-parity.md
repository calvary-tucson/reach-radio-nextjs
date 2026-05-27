# Astro → Next.js Parity Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining feature and visual gaps between reach-radio-nextjs and reach-radio-web (Astro) after Phase 1 fixes.

**Architecture:** Ten independent tasks across: SSE/audio pipeline, schedule logic, RadioPlayer layout, static content (privacy policy), SEO schema, UI component polish, and third-party integrations (iFrameResizer). Each task commits atomically and is testable in isolation.

**Tech Stack:** Next.js App Router, React 19, Zustand (media-store), Tailwind CSS, Sanity CMS, TypeScript strict

---

## Gap Analysis Summary

| # | Gap | Impact |
|---|-----|--------|
| 1 | SSE route parses `json.song?.title` but actual API is top-level `json.title` | Now Playing shows stale/wrong info |
| 2 | Teacher photo not resolved when artist matches a teacher | Player always shows logo instead of teacher photo |
| 3 | TodaySchedule shows past shows; no music-break filler | Home schedule is stale after midday |
| 4 | RadioPlayer always vertical; Astro is horizontal row on desktop | Visual mismatch on desktop |
| 5 | Privacy policy is a stub — missing actual content | Legal compliance risk |
| 6 | About page missing OrganizationSchema | Missing structured data for SEO |
| 7 | App Store buttons are plain text; Astro uses SVG icons | Visual fidelity gap |
| 8 | Footer missing Sanity non-profit attribution | Required by Sanity plan terms |
| 9 | Donate iframe missing iFrameResizer auto-height script | Iframe may be too tall/short |
| 10 | Home schedule section labeled "Today's Schedule"; Astro says "Playing Next" | Copy mismatch |

**Phase 1 tasks already done** (verified in codebase): CSP headers, sleep timer options, volume control, sleep timer button/overlay, click-to-play, IntersectionObserver media bar, contact form honeypots/GDPR, about page frequency display + app links, mobile-app cookie persistence in BridgeInit, teacher card shadow/border/hover, teacher detail 2-col layout, `/api/stream-info` JSON endpoint.

---

## File Map

**Modified:**
- `src/app/api/stream-info-sse/route.ts` — fix RadioJar JSONP parsing + add teacher-photo image enrichment
- `src/hooks/useNowPlaying.ts` — pass teacher list to enrichment logic
- `src/lib/store/media-store.ts` — add `teachersList` state
- `src/components/home/TodaySchedule.tsx` — future-only filter + music-break insertion
- `src/components/home/RadioPlayer.tsx` — md horizontal layout
- `src/app/about/privacy-policy/page.tsx` — full policy content
- `src/app/about/page.tsx` — OrganizationSchema + SVG store buttons
- `src/components/layout/Footer.tsx` — Sanity attribution
- `src/app/donate/page.tsx` — iFrameResizer integration
- `src/app/page.tsx` — rename schedule section heading

**Created:**
- `src/components/seo/OrganizationSchema.tsx` — Organization JSON-LD component
- `public/js/iframeResizer.min.js` — vendored iFrameResizer v4 (copy from reach-radio-web public/js/)

---

## Task 1: Fix SSE RadioJar Parsing

**Files:**
- Modify: `src/app/api/stream-info-sse/route.ts`

The SSE route currently parses `json.song?.title` (nested) but the Astro reference implementation and the existing `/api/stream-info` JSON route both parse `json.title` at top level. These must be consistent or one of them is silently returning empty strings.

**Verification first:** The Astro route uses:
```
const streamTitle = streamInfoJson.title || 'Reach Radio FM'
const streamArtist = streamInfoJson.artist || ''
```
The Next.js JSON route (`/api/stream-info/route.ts`) uses:
```
const json = JSON.parse(...) as { title?: string; artist?: string }
const title = json.title || 'Reach Radio'
```
The SSE route uses `json.song?.title` — this is the outlier and is almost certainly wrong.

- [ ] **Step 1: Read the current SSE route**

Open `src/app/api/stream-info-sse/route.ts` and locate the JSONP parsing block.

- [ ] **Step 2: Fix the parsing**

In `src/app/api/stream-info-sse/route.ts`, change the type annotation and field access:

```typescript
// Before:
const json = JSON.parse(text.substring(1, text.length - 2)) as {
  song?: { title?: string; artist?: string }
}
const title = json.song?.title || 'Reach Radio'
const artist = json.song?.artist || ''

// After:
const json = JSON.parse(text.substring(1, text.length - 2)) as {
  title?: string
  artist?: string
}
const title = json.title || 'Reach Radio'
const artist = json.artist || ''
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs && npm run build 2>&1 | tail -20
```
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stream-info-sse/route.ts
git commit -m "fix(sse): correct RadioJar JSONP parsing — use top-level title/artist not song.title"
```

---

## Task 2: Teacher Photo Matching in Now Playing

**Files:**
- Modify: `src/lib/store/media-store.ts`
- Modify: `src/hooks/useNowPlaying.ts`
- Modify: `src/lib/sanity/queries.ts`

When the SSE stream artist matches a teacher name, show that teacher's photo in the player. Astro does this by maintaining a `teachersList` signal and cross-referencing.

The teacher list is already fetched for the schedule — we add a lightweight query and store field to enable matching.

- [ ] **Step 1: Add teacher list type and query**

In `src/lib/sanity/queries.ts`, add at the bottom:

```typescript
export const teacherNamesAndPhotosQuery = `
  *[_type == "teacher"] {
    "name": name.first + " " + name.last,
    "photo": photo.asset->url
  }
`
```

- [ ] **Step 2: Add teachersList to media store**

In `src/lib/store/media-store.ts`, add to the state interface:

```typescript
teachersList: { name: string; photo: string }[]
setTeachersList: (list: { name: string; photo: string }[]) => void
```

And in the `create()` call, add:

```typescript
teachersList: [],
setTeachersList: (list) => set({ teachersList: list }),
```

- [ ] **Step 3: Fetch teacher list in useNowPlaying and cross-reference**

In `src/hooks/useNowPlaying.ts`, update to fetch teacher list once on mount and resolve artist → photo:

```typescript
'use client'

import { useEffect } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

const MAX_RETRIES = 5
const DEFAULT_IMAGE = 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg'

export function useNowPlaying(): void {
  const setNowPlaying = useMediaStore((s) => s.setNowPlaying)
  const setTeachersList = useMediaStore((s) => s.setTeachersList)

  // Fetch teacher list once — used to resolve artist → photo
  useEffect(() => {
    fetch('/api/teachers-list')
      .then((r) => r.json())
      .then((data: { name: string; photo: string }[]) => {
        setTeachersList(data)
      })
      .catch(() => {
        // non-critical, best-effort
      })
  }, [setTeachersList])

  useEffect(() => {
    let retries = 0
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (es) es.close()
      es = new EventSource('/api/stream-info-sse')

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { title?: string; artist?: string }
          const { teachersList } = useMediaStore.getState()

          let image = DEFAULT_IMAGE
          let resolvedArtist = data.artist ?? ''

          if (resolvedArtist && teachersList.length > 0) {
            const match = teachersList.find((t) =>
              t.name.toLowerCase().includes(resolvedArtist.toLowerCase()) ||
              resolvedArtist.toLowerCase().includes(t.name.toLowerCase())
            )
            if (match) {
              image = match.photo + '?w=420&fm=webp'
              resolvedArtist = match.name
            }
          }

          setNowPlaying(
            data.title ?? useMediaStore.getState().title,
            resolvedArtist,
            image
          )
          retries = 0
        } catch {
          // retain existing values on parse error
        }
      }

      es.onerror = () => {
        if (retries >= MAX_RETRIES) return
        const delay = Math.pow(2, retries) * 1000 + Math.random() * 500
        retries++
        retryTimer = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      if (es) es.close()
    }
  }, [setNowPlaying])
}
```

- [ ] **Step 4: Create /api/teachers-list route**

Create `src/app/api/teachers-list/route.ts`:

```typescript
import { sanityFetch } from '@/lib/sanity/client'
import { teacherNamesAndPhotosQuery } from '@/lib/sanity/queries'

export const revalidate = 3600

export async function GET(): Promise<Response> {
  try {
    const teachers = await sanityFetch<{ name: string; photo: string }[]>(
      teacherNamesAndPhotosQuery,
      {},
      { tags: ['teachers'] }
    )
    return Response.json(teachers)
  } catch {
    return Response.json([])
  }
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sanity/queries.ts src/lib/store/media-store.ts src/hooks/useNowPlaying.ts src/app/api/teachers-list/route.ts
git commit -m "feat: resolve teacher photo from artist name in now playing"
```

---

## Task 3: TodaySchedule — Future-Only Filtering + Music Break Insertion

**Files:**
- Modify: `src/components/home/TodaySchedule.tsx`

Astro behavior on home page:
1. Shows only schedule items that **haven't ended yet** (compared to current time)
2. Inserts a "Reach Radio Music" filler entry for gaps ≥5 min between teaching shows
3. Heading is "Playing Next" (not "Today's Schedule")

The Next.js version shows all of today's shows in chronological order regardless of whether they've ended.

Time format from Sanity: `"4:30 PM"` (12-hour with space before AM/PM).

- [ ] **Step 1: Read TodaySchedule.tsx**

Open `src/components/home/TodaySchedule.tsx` to understand current shape before editing.

- [ ] **Step 2: Replace TodaySchedule implementation**

Replace the entire file content:

```tsx
import { sanityFetch } from '@/lib/sanity/client'
import { scheduleQuery } from '@/lib/sanity/queries'
import Image from 'next/image'
import Link from 'next/link'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

const MUSIC_IMAGE = 'https://cdn.sanity.io/images/bk05c6rl/production/5891a2050443dc125c47c8607419caf3afaa21a5-1024x1024.jpg'
const TZ = 'America/Phoenix'

interface SlotItem {
  name: string
  slug: string
  title: string
  photo: string
  time: string
  startTime: string
  endTime: string
  isMusic?: boolean
}

function to24h(time: string): string {
  const [timeStr, period] = time.split(' ')
  const [h, m] = timeStr.split(':')
  let hours = parseInt(h, 10)
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return `${hours.toString().padStart(2, '0')}:${m}`
}

function toMinutes(time24: string): number {
  const [h, m] = time24.split(':').map(Number)
  return h * 60 + m
}

function isInFuture(endTime: string): boolean {
  const now = dayjs().tz(TZ)
  const [h, m] = to24h(endTime).split(':').map(Number)
  const nowMinutes = now.hour() * 60 + now.minute()
  return h * 60 + m > nowMinutes
}

export async function TodaySchedule() {
  const day = dayjs().tz(TZ).format('dddd')

  const raw = await sanityFetch<{
    name: string
    slug: string
    title: string
    photo: string
    schedule: { day: string; times: { startTime: string; endTime: string }[] }[]
  }[]>(scheduleQuery, { day }, { tags: ['schedule'] })

  // Expand to individual time slots
  let slots: SlotItem[] = []
  for (const t of raw) {
    if (!t.schedule?.[0]?.times) continue
    for (const time of t.schedule[0].times) {
      slots.push({
        name: t.name,
        slug: t.slug,
        title: t.title || t.name,
        photo: t.photo,
        time: `${time.startTime} - ${time.endTime}`,
        startTime: time.startTime,
        endTime: time.endTime,
      })
    }
  }

  // Sort by start time
  slots.sort((a, b) => toMinutes(to24h(a.startTime)) - toMinutes(to24h(b.startTime)))

  // Deduplicate
  const seen = new Set<string>()
  slots = slots.filter((s) => {
    const key = `${s.startTime}|${s.endTime}|${s.slug}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Filter past shows (keep only those whose end time is still in the future)
  slots = slots.filter((s) => isInFuture(s.endTime))

  if (slots.length === 0) {
    return (
      <p className="text-white/80 text-sm px-3">
        No more programs scheduled today.
      </p>
    )
  }

  // Insert music break filler for gaps >= 5 min
  const withBreaks: SlotItem[] = []
  for (let i = 0; i < slots.length; i++) {
    withBreaks.push(slots[i])
    const next = slots[i + 1]
    if (next) {
      const gap =
        toMinutes(to24h(next.startTime)) - toMinutes(to24h(slots[i].endTime))
      if (gap >= 5) {
        withBreaks.push({
          name: 'Reach Radio',
          slug: '',
          title: 'Music',
          photo: MUSIC_IMAGE,
          time: `${slots[i].endTime} - ${next.startTime}`,
          startTime: slots[i].endTime,
          endTime: next.startTime,
          isMusic: true,
        })
      }
    }
  }

  return (
    <div className="flex flex-col gap-y-2 text-white">
      {withBreaks.map((item, idx) => {
        const content = (
          <>
            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded flex-shrink-0 overflow-hidden">
              <Image
                src={item.photo + '?w=420&fm=webp'}
                alt={item.isMusic ? 'Music' : item.name}
                fill
                className="object-cover rounded"
                sizes="80px"
              />
            </div>
            <div>
              <div className="font-bold text-base">{item.title}</div>
              {!item.isMusic && <div className="uppercase text-sm text-white/70">{item.name}</div>}
              <div className="text-sm text-white/60">{item.time}</div>
            </div>
          </>
        )

        if (item.isMusic || !item.slug) {
          return (
            <div
              key={`${item.startTime}-${idx}`}
              className="flex gap-5 bg-gray-700 p-2 rounded"
            >
              {content}
            </div>
          )
        }

        return (
          <Link
            key={`${item.slug}-${item.startTime}`}
            href={`/teachers/${item.slug}`}
            className="flex items-center justify-between flex-wrap bg-gray-700 p-2 rounded hover:bg-gray-700/80 transition-colors"
          >
            <div className="flex gap-5">{content}</div>
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Update home page heading**

In `src/app/page.tsx`, find the `<h2>` for the schedule section and update:

```tsx
// Before:
<h2 className="text-white font-semibold text-base mb-3">Today&apos;s Schedule</h2>

// After:
<h2 className="text-white font-bold text-lg px-3 uppercase mb-3">Playing Next</h2>
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no TypeScript or build errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/TodaySchedule.tsx src/app/page.tsx
git commit -m "feat(schedule): future-only filtering, music break insertion, rename to 'Playing Next'"
```

---

## Task 4: RadioPlayer Desktop Horizontal Layout

**Files:**
- Modify: `src/components/home/RadioPlayer.tsx`

Astro desktop (md+) layout: title + artist on left, play/sleep/volume row on right (`flex md:flex-row flex-col items-center justify-between`). Next.js is always `flex-col items-center`.

- [ ] **Step 1: Read RadioPlayer.tsx**

Open `src/components/home/RadioPlayer.tsx` to locate the controls section below the image.

- [ ] **Step 2: Replace controls section layout**

Find the div after the image section containing the title/artist/buttons and replace it:

```tsx
{/* Controls — horizontal row on desktop, vertical on mobile */}
<div className="flex md:flex-row flex-col items-center justify-between md:gap-0 gap-8 mt-5">
  {/* Title + artist — left-aligned on desktop */}
  <div className="flex flex-col md:items-start items-center md:gap-3 gap-1 w-full md:w-[calc(100%_-_276px)] px-2">
    <p className="md:text-4xl text-2xl font-normal leading-tight text-white truncate w-full md:text-left text-center">
      {title}
    </p>
    {artist && (
      <p className="md:font-bold font-medium md:text-lg uppercase text-white/80 truncate w-full md:text-left text-center">
        {artist}
      </p>
    )}
  </div>

  {/* Buttons — right side on desktop */}
  <div className="flex gap-11">
    <div className="flex gap-5 md:items-center items-end md:ml-0 ml-14">
      <PlayPauseButton />
      <SleepTimerButton />
    </div>
    <VolumeControl />
  </div>
</div>
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/RadioPlayer.tsx
git commit -m "fix(player): restore md horizontal layout — title/artist left, controls right"
```

---

## Task 5: Privacy Policy — Full Content

**Files:**
- Modify: `src/app/about/privacy-policy/page.tsx`

The current page is a stub. Replace with the actual privacy policy content from the Astro site.

- [ ] **Step 1: Read the current file**

Open `src/app/about/privacy-policy/page.tsx`.

- [ ] **Step 2: Replace with full content**

Replace the entire file:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: "Privacy Policy for Reach Radio Tucson's website and mobile applications.",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <Link href="/about" className="text-white/60 text-sm mb-6 block hover:text-white">
        ← About
      </Link>
      <div className="prose prose-invert max-w-none">
        <h1>Privacy Policy</h1>
        <p><strong>Last updated:</strong> March 17, 2026</p>
        <p>
          Calvary Chapel of Tucson, Inc. ("we," "us," or "our") operates the Reach Radio website (
          <a href="https://reach.radio">reach.radio</a>) and the Reach Radio mobile applications available on the{' '}
          <a href="https://apps.apple.com/us/app/reach-radio-fm/id1246500077" target="_blank" rel="noopener noreferrer">
            Apple App Store
          </a>{' '}
          and the{' '}
          <a href="https://play.google.com/store/apps/details?id=com.goodbarber.reachradio&hl=en_US&gl=US" target="_blank" rel="noopener noreferrer">
            Google Play Store
          </a>{' '}
          (collectively, the "Service"). This Privacy Policy describes how we collect, use, and protect
          your information when you use the Service.
        </p>
        <p>
          We are committed to maintaining your privacy and believe that as a user of the Service you are
          entitled to know our information practices.
        </p>

        <h2>About the Mobile Applications</h2>
        <p>
          The Reach Radio mobile apps for Android and iOS are hybrid applications. They load web content
          from our website and provide native audio playback so you can listen to Reach Radio&apos;s live stream.
          The apps do not require you to create an account or log in.
        </p>

        <h2>Information We Collect</h2>
        <h3>Information You Provide Voluntarily</h3>
        <p>
          If you choose to contact us through the contact form on our website, we collect the information
          you submit, such as your name, email address, and message content. This information is used
          solely to respond to your inquiry and is not shared with third parties.
        </p>
        <h3>Information Collected Automatically</h3>
        <p>The Reach Radio mobile apps and website do <strong>not</strong> collect personal data automatically. Specifically:</p>
        <ul>
          <li>We do not use analytics or tracking services.</li>
          <li>We do not use advertising networks or ad identifiers.</li>
          <li>We do not collect device identifiers, location data, or usage statistics.</li>
          <li>We do not require user accounts, login, or registration.</li>
        </ul>
        <p>
          The app does process audio stream metadata (such as song title, artist name, and artwork) from
          our streaming service in order to display "now playing" information. This metadata is not stored
          and does not contain personal information.
        </p>
        <h3>Photographic Images</h3>
        <p>
          Photographic images of individuals and groups at Calvary Chapel of Tucson, Inc. events may be
          displayed on the website. We will not sell, share, or rent any of these images to third parties.
        </p>

        <h2>Device Permissions (Mobile Apps)</h2>
        <p>The Reach Radio mobile apps request the following device permissions to function properly:</p>
        <ul>
          <li><strong>Internet access</strong> — Required to stream audio content and load web content from our servers.</li>
          <li><strong>Foreground service</strong> — Allows audio playback to continue when the app is in the background or the screen is off.</li>
          <li><strong>Wake lock</strong> — Prevents the device from sleeping during active audio playback.</li>
          <li><strong>Network state</strong> — Used to detect internet connectivity and handle connection changes gracefully.</li>
          <li><strong>Notifications</strong> — Used to display media playback controls in the notification shade while audio is playing.</li>
        </ul>
        <p>
          These permissions are used exclusively for audio streaming and playback functionality. No permissions
          are used to collect, transmit, or store personal data.
        </p>

        <h2>Third-Party Services</h2>
        <p>The Service relies on the following third-party infrastructure:</p>
        <ul>
          <li><strong>Cloudflare Pages / Vercel</strong> — Hosts and delivers the web content displayed within the mobile apps and on the website.</li>
          <li><strong>RadioJar</strong> — Provides the audio streaming infrastructure for live radio playback.</li>
          <li>
            <strong>Formspree</strong> — Processes contact form submissions on our behalf. Formspree&apos;s privacy
            policy is available at{' '}
            <a href="https://formspree.io/legal/privacy-policy/" target="_blank" rel="noopener noreferrer">
              formspree.io/legal/privacy-policy
            </a>.
          </li>
        </ul>
        <p>
          We do not share personal information with any other third-party services, advertisers, or data brokers.
        </p>

        <h2>Data Retention and Deletion</h2>
        <p>
          The Reach Radio mobile apps do not store personal data on your device. Any temporary data cached
          by the embedded web view (such as cookies or cached pages) can be cleared through your device&apos;s
          system settings by clearing the app&apos;s storage or cache.
        </p>
        <p>
          Contact form submissions are retained only as long as necessary to respond to your inquiry. You may
          request deletion of any information you have submitted by contacting us using the information below.
        </p>

        <h2>Security</h2>
        <p>
          Calvary Chapel of Tucson, Inc. takes the security of your information seriously and considers any
          information contained in our records to be confidential. We follow practices to prevent unauthorized
          access to personally identifiable information. However, no method of electronic transmission or
          storage is completely secure, and we cannot guarantee absolute security.
        </p>

        <h2>Children&apos;s Privacy</h2>
        <p>
          The Service is not directed at children under the age of 13. We do not knowingly collect personal
          information from children under 13. If you are a parent or guardian and believe that your child has
          provided us with personal information, please contact us so that we can take appropriate action.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          Calvary Chapel of Tucson, Inc. may update this Privacy Policy from time to time. We will post the
          revised policy on this page with an updated "Last updated" date. Your continued use of the Service
          after any changes constitutes acceptance of the updated policy.
        </p>

        <h2>Contact Us</h2>
        <p>If you have any questions or concerns about this Privacy Policy or our data practices, please contact us:</p>
        <ul>
          <li><strong>Online:</strong> <Link href="/about">reach.radio/about</Link> (contact form)</li>
          <li><strong>Website:</strong> <a href="https://calvarytucson.com" target="_blank" rel="noopener noreferrer">calvarytucson.com</a></li>
          <li><strong>Organization:</strong> Calvary Chapel of Tucson, Inc. — Tucson, AZ</li>
        </ul>
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
git add src/app/about/privacy-policy/page.tsx
git commit -m "content: replace privacy policy stub with full legal content"
```

---

## Task 6: About Page — OrganizationSchema

**Files:**
- Create: `src/components/seo/OrganizationSchema.tsx`
- Modify: `src/app/about/page.tsx`

Astro fetches `siteSettings` from Sanity and builds an Organization JSON-LD. Next.js about page is missing this entirely.

- [ ] **Step 1: Create OrganizationSchema component**

Create `src/components/seo/OrganizationSchema.tsx`:

```tsx
interface OrganizationSchemaProps {
  name: string
  alternateName?: string
  description?: string
  logoUrl?: string
  facebookUrl?: string
  twitterHandle?: string
}

export function OrganizationSchema({
  name,
  alternateName,
  description,
  logoUrl,
  facebookUrl,
  twitterHandle,
}: OrganizationSchemaProps) {
  const sameAs = [
    facebookUrl,
    twitterHandle ? `https://twitter.com/${twitterHandle}` : null,
  ].filter(Boolean)

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    ...(alternateName && { alternateName }),
    description: description ?? 'Christian radio station bringing the gospel to Tucson',
    url: 'https://reach.radio',
    ...(logoUrl && { logo: { '@type': 'ImageObject', url: logoUrl } }),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      url: 'https://reach.radio/about',
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Tucson',
      addressRegion: 'AZ',
      addressCountry: 'US',
    },
    foundingDate: '2016-02',
    ...(sameAs.length > 0 && { sameAs }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

- [ ] **Step 2: Add siteSettings query**

In `src/lib/sanity/queries.ts`, add:

```typescript
export const siteSettingsQuery = `
  *[_type == "siteSettings"][0] {
    siteTitle,
    siteDescription,
    "siteIconURL": siteIconLight.asset->url,
    twitterHandle,
    facebookPage
  }
`
```

- [ ] **Step 3: Wire OrganizationSchema into about page**

In `src/app/about/page.tsx`, add the import and fetch:

```tsx
import { sanityFetch } from '@/lib/sanity/client'
import { siteSettingsQuery } from '@/lib/sanity/queries'
import { OrganizationSchema } from '@/components/seo/OrganizationSchema'

// Inside AboutPage (before return):
const siteSettings = await sanityFetch<{
  siteTitle: string
  siteDescription?: string
  siteIconURL?: string
  twitterHandle?: string
  facebookPage?: string
}>(siteSettingsQuery, {}, { tags: ['siteSettings'] }).catch(() => ({
  siteTitle: 'Reach Radio',
}))

// Inside return JSX, before the grid:
<OrganizationSchema
  name={siteSettings.siteTitle}
  alternateName="Reach Radio Tucson"
  description={siteSettings.siteDescription}
  logoUrl={siteSettings.siteIconURL}
  facebookUrl={siteSettings.facebookPage}
  twitterHandle={siteSettings.twitterHandle}
/>
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/seo/OrganizationSchema.tsx src/lib/sanity/queries.ts src/app/about/page.tsx
git commit -m "feat(seo): add OrganizationSchema to about page, fetch from Sanity siteSettings"
```

---

## Task 7: About Page — App Store SVG Icon Buttons

**Files:**
- Modify: `src/app/about/page.tsx`

Astro uses `<AppleStore />` and `<GooglePlay />` SVG icon components. Next.js has plain text buttons. Replace with inline SVGs matching the Astro originals.

- [ ] **Step 1: Read current about page app download section**

Open `src/app/about/page.tsx` and locate the "Download App" section.

- [ ] **Step 2: Replace plain-text buttons with SVG icon links**

Replace the two `<a>` elements for app stores with these inline SVGs. These are the exact brand-compliant badges from the Astro implementation (`reach-radio-web/src/icons/AppleStore.astro` and `GooglePlay.astro`), converted to JSX (camelCase attributes, namespaced gradient IDs to avoid DOM conflicts).

```tsx
{/* Apple App Store */}
<a
  href="https://apps.apple.com/us/app/reach-radio-fm/id1246500077"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Download on the App Store"
  className="inline-block hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded"
>
  <svg xmlns="http://www.w3.org/2000/svg" width="119.664" height="40" viewBox="0 0 119.664 40" className="h-10 w-auto" aria-hidden="true">
    <g transform="translate(0 0)">
      <path d="M110.135,0H9.535C9.168,0,8.806,0,8.44,0c-.306,0-.61.008-.919.013a13.215,13.215,0,0,0-2,.177,6.665,6.665,0,0,0-1.9.627A6.438,6.438,0,0,0,2,2,6.258,6.258,0,0,0,.819,3.618a6.6,6.6,0,0,0-.625,1.9,12.993,12.993,0,0,0-.179,2C.006,7.83,0,8.138,0,8.444V31.559c0,.31.006.611.015.922a12.992,12.992,0,0,0,.179,2,6.588,6.588,0,0,0,.625,1.9A6.208,6.208,0,0,0,2,38,6.274,6.274,0,0,0,3.616,39.18a6.7,6.7,0,0,0,1.9.631,13.454,13.454,0,0,0,2,.177c.309.007.613.011.919.011.366,0,.728,0,1.095,0h100.6c.359,0,.725,0,1.084,0,.3,0,.617,0,.922-.011a13.279,13.279,0,0,0,2-.177,6.8,6.8,0,0,0,1.908-.631A6.277,6.277,0,0,0,117.666,38a6.4,6.4,0,0,0,1.182-1.614,6.6,6.6,0,0,0,.619-1.9,13.507,13.507,0,0,0,.186-2c0-.311,0-.611,0-.922.008-.363.008-.725.008-1.094V9.536c0-.366,0-.729-.008-1.092,0-.307,0-.614,0-.921a13.505,13.505,0,0,0-.186-2,6.618,6.618,0,0,0-.619-1.9,6.466,6.466,0,0,0-2.8-2.8,6.768,6.768,0,0,0-1.908-.627,13.044,13.044,0,0,0-2-.177c-.3,0-.617-.011-.922-.013-.359,0-.725,0-1.084,0Z" fill="#a6a6a6" />
      <path d="M8.445,39.125c-.3,0-.6,0-.9-.011a12.688,12.688,0,0,1-1.869-.163A5.884,5.884,0,0,1,4.015,38.4a5.406,5.406,0,0,1-1.4-1.017A5.321,5.321,0,0,1,1.6,35.99a5.722,5.722,0,0,1-.543-1.657,12.413,12.413,0,0,1-.167-1.875c-.006-.211-.015-.913-.015-.913V8.444s.009-.691.015-.895a12.37,12.37,0,0,1,.166-1.872A5.755,5.755,0,0,1,1.6,4.016a5.374,5.374,0,0,1,1.015-1.4A5.565,5.565,0,0,1,4.014,1.6a5.823,5.823,0,0,1,1.653-.544A12.586,12.586,0,0,1,7.543.887l.9-.012H111.214l.913.013a12.385,12.385,0,0,1,1.858.163,5.938,5.938,0,0,1,1.671.548,5.594,5.594,0,0,1,2.415,2.42,5.763,5.763,0,0,1,.535,1.649,12.994,12.994,0,0,1,.174,1.887c0,.283,0,.587,0,.89.008.375.008.732.008,1.092V30.465c0,.363,0,.718-.008,1.075,0,.325,0,.623,0,.93a12.734,12.734,0,0,1-.171,1.853,5.739,5.739,0,0,1-.54,1.67,5.481,5.481,0,0,1-1.016,1.386,5.413,5.413,0,0,1-1.4,1.023,5.862,5.862,0,0,1-1.668.55,12.542,12.542,0,0,1-1.869.163c-.293.007-.6.011-.9.011l-1.084,0Z" />
      <path d="M24.769,20.3a4.949,4.949,0,0,1,2.357-4.152,5.066,5.066,0,0,0-3.991-2.158c-1.679-.176-3.307,1-4.163,1-.872,0-2.19-.987-3.608-.958a5.315,5.315,0,0,0-4.473,2.728c-1.934,3.348-.491,8.269,1.361,10.976.927,1.325,2.01,2.806,3.428,2.753,1.387-.058,1.905-.884,3.579-.884,1.659,0,2.145.884,3.591.851,1.488-.024,2.426-1.331,3.321-2.669A10.962,10.962,0,0,0,27.688,24.7a4.782,4.782,0,0,1-2.919-4.4Z" fill="#fff" />
      <path d="M22.037,12.211A4.872,4.872,0,0,0,23.152,8.72a4.957,4.957,0,0,0-3.208,1.66A4.636,4.636,0,0,0,18.8,13.741a4.1,4.1,0,0,0,3.237-1.53Z" fill="#fff" />
      <path d="M42.3,27.14H37.569L36.432,30.5h-2l4.483-12.418h2.083L45.477,30.5H43.438Zm-4.243-1.549h3.752l-1.85-5.447H39.91Z" fill="#fff" />
      <path d="M55.16,25.97c0,2.813-1.506,4.621-3.778,4.621a3.069,3.069,0,0,1-2.849-1.584H48.49v4.484H46.631V21.442h1.8v1.506h.034a3.212,3.212,0,0,1,2.883-1.6C53.645,21.348,55.16,23.164,55.16,25.97Zm-1.91,0c0-1.833-.947-3.038-2.393-3.038-1.42,0-2.375,1.23-2.375,3.038,0,1.824.955,3.046,2.375,3.046,1.445,0,2.393-1.2,2.393-3.046Z" fill="#fff" />
      <path d="M65.124,25.97c0,2.813-1.506,4.621-3.778,4.621A3.069,3.069,0,0,1,58.5,29.007h-.043v4.484H56.6V21.442h1.8v1.506h.034a3.212,3.212,0,0,1,2.883-1.6C63.61,21.348,65.124,23.164,65.124,25.97Zm-1.91,0c0-1.833-.947-3.038-2.393-3.038-1.42,0-2.375,1.23-2.375,3.038,0,1.824.955,3.046,2.375,3.046,1.445,0,2.393-1.2,2.393-3.046Z" fill="#fff" />
      <path d="M71.711,27.036c.138,1.231,1.334,2.04,2.969,2.04,1.566,0,2.693-.809,2.693-1.919,0-.964-.68-1.541-2.289-1.937l-1.609-.388c-2.28-.551-3.339-1.617-3.339-3.348,0-2.143,1.867-3.614,4.519-3.614,2.624,0,4.423,1.472,4.483,3.614H77.261c-.112-1.239-1.137-1.987-2.634-1.987s-2.521.757-2.521,1.858c0,.878.654,1.395,2.255,1.79l1.368.336c2.548.6,3.606,1.626,3.606,3.442,0,2.323-1.851,3.778-4.794,3.778-2.754,0-4.613-1.421-4.733-3.667Z" fill="#fff" />
      <path d="M83.346,19.3v2.143h1.722v1.472H83.346v4.991c0,.775.345,1.137,1.1,1.137A5.807,5.807,0,0,0,85.059,29v1.463a5.1,5.1,0,0,1-1.032.086c-1.833,0-2.548-.688-2.548-2.444V22.914H80.163V21.442h1.316V19.3Z" fill="#fff" />
      <path d="M86.065,25.97c0-2.849,1.678-4.639,4.294-4.639s4.295,1.79,4.295,4.639-1.661,4.639-4.295,4.639S86.065,28.826,86.065,25.97Zm6.7,0c0-1.954-.9-3.107-2.4-3.107s-2.4,1.162-2.4,3.107c0,1.962.895,3.106,2.4,3.106s2.4-1.145,2.4-3.106Z" fill="#fff" />
      <path d="M96.186,21.442h1.772v1.541H98a2.159,2.159,0,0,1,2.178-1.636,2.866,2.866,0,0,1,.637.069v1.738a2.6,2.6,0,0,0-.835-.112,1.873,1.873,0,0,0-1.937,2.083V30.5H96.186Z" fill="#fff" />
      <path d="M109.384,27.837c-.25,1.644-1.851,2.771-3.9,2.771-2.634,0-4.269-1.765-4.269-4.6s1.644-4.682,4.19-4.682c2.5,0,4.08,1.721,4.08,4.466v.637h-6.395v.112a2.358,2.358,0,0,0,2.436,2.564,2.048,2.048,0,0,0,2.091-1.273Zm-6.282-2.7h4.526a2.177,2.177,0,0,0-2.221-2.3,2.292,2.292,0,0,0-2.305,2.3Z" fill="#fff" />
      <path d="M37.826,8.731A2.64,2.64,0,0,1,40.634,11.7c0,1.906-1.03,3-2.808,3H35.671V8.731ZM36.6,13.854h1.125a1.876,1.876,0,0,0,1.968-2.146,1.881,1.881,0,0,0-1.968-2.134H36.6Z" fill="#fff" />
      <path d="M41.681,12.444a2.133,2.133,0,1,1,4.247,0,2.134,2.134,0,1,1-4.247,0Zm3.333,0c0-.976-.438-1.547-1.208-1.547s-1.207.571-1.207,1.547.435,1.55,1.207,1.55S45.014,13.424,45.014,12.444Z" fill="#fff" />
      <path d="M51.573,14.7h-.922l-.931-3.316h-.07L48.724,14.7h-.913l-1.241-4.5h.9l.807,3.436h.066l.926-3.436h.853l.926,3.436h.07l.8-3.436h.889Z" fill="#fff" />
      <path d="M53.854,10.195h.855v.715h.066a1.348,1.348,0,0,1,1.344-.8,1.465,1.465,0,0,1,1.559,1.675V14.7h-.889V12.006c0-.724-.314-1.083-.972-1.083a1.033,1.033,0,0,0-1.075,1.141V14.7h-.889Z" fill="#fff" />
      <path d="M59.094,8.437h.889V14.7h-.889Z" fill="#fff" />
      <path d="M61.218,12.444a2.133,2.133,0,1,1,4.248,0,2.134,2.134,0,1,1-4.248,0Zm3.333,0c0-.976-.438-1.547-1.208-1.547s-1.207.571-1.207,1.547.435,1.55,1.207,1.55S64.551,13.424,64.551,12.444Z" fill="#fff" />
      <path d="M66.4,13.424c0-.811.6-1.278,1.675-1.344l1.22-.07v-.389c0-.476-.314-.744-.922-.744-.5,0-.84.182-.938.5h-.86c.091-.773.818-1.27,1.84-1.27,1.129,0,1.766.562,1.766,1.513V14.7h-.855v-.633h-.07a1.515,1.515,0,0,1-1.353.707,1.36,1.36,0,0,1-1.5-1.348ZM69.3,13.04v-.376l-1.1.07c-.62.042-.9.252-.9.649s.352.641.835.641A1.061,1.061,0,0,0,69.3,13.04Z" fill="#fff" />
      <path d="M71.348,12.444c0-1.423.731-2.324,1.869-2.324a1.484,1.484,0,0,1,1.381.79h.066V8.437h.889V14.7H74.7v-.711h-.07a1.563,1.563,0,0,1-1.414.786C72.072,14.772,71.348,13.871,71.348,12.444Zm.918,0c0,.955.45,1.53,1.2,1.53s1.212-.583,1.212-1.526-.468-1.53-1.212-1.53-1.2.579-1.2,1.526Z" fill="#fff" />
      <path d="M79.23,12.444a2.133,2.133,0,1,1,4.247,0,2.134,2.134,0,1,1-4.247,0Zm3.333,0c0-.976-.438-1.547-1.208-1.547s-1.207.571-1.207,1.547.435,1.55,1.207,1.55S82.563,13.424,82.563,12.444Z" fill="#fff" />
      <path d="M84.669,10.195h.855v.715h.066a1.348,1.348,0,0,1,1.344-.8,1.465,1.465,0,0,1,1.559,1.675V14.7h-.889V12.006c0-.724-.314-1.083-.972-1.083a1.033,1.033,0,0,0-1.075,1.141V14.7h-.889Z" fill="#fff" />
      <path d="M93.515,9.074v1.142h.976v.749h-.976v2.315c0,.472.194.678.637.678a2.967,2.967,0,0,0,.339-.021v.74a2.916,2.916,0,0,1-.483.045c-.988,0-1.382-.348-1.382-1.216V10.964h-.715v-.749h.715V9.074Z" fill="#fff" />
      <path d="M95.7,8.437h.881v2.481h.07a1.386,1.386,0,0,1,1.373-.807,1.483,1.483,0,0,1,1.551,1.679V14.7h-.89V12.01c0-.719-.335-1.083-.963-1.083a1.052,1.052,0,0,0-1.134,1.142V14.7H95.7Z" fill="#fff" />
      <path d="M104.761,13.482a1.828,1.828,0,0,1-1.951,1.3,2.045,2.045,0,0,1-2.08-2.324,2.077,2.077,0,0,1,2.076-2.353c1.253,0,2.009.856,2.009,2.27v.31h-3.18v.05a1.19,1.19,0,0,0,1.2,1.29,1.079,1.079,0,0,0,1.071-.546Zm-3.126-1.451h2.274a1.086,1.086,0,0,0-1.108-1.167,1.152,1.152,0,0,0-1.166,1.167Z" fill="#fff" />
    </g>
  </svg>
</a>

{/* Google Play — gradient IDs namespaced to avoid conflicts with other inline SVGs */}
<a
  href="https://play.google.com/store/apps/details?id=com.goodbarber.reachradio&hl=en_US&gl=US"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Get it on Google Play"
  className="inline-block hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:rounded"
>
  <svg xmlns="http://www.w3.org/2000/svg" width="135" height="40" viewBox="0 0 135 40" className="h-10 w-auto" aria-hidden="true">
    <defs>
      <linearGradient id="gp-a" x1="0.915" y1="6.617" x2="-0.384" y2="5.947" gradientUnits="objectBoundingBox">
        <stop offset="0" stopColor="#00a0ff" />
        <stop offset="0.007" stopColor="#00a1ff" />
        <stop offset="0.26" stopColor="#00beff" />
        <stop offset="0.512" stopColor="#00d2ff" />
        <stop offset="0.76" stopColor="#00dfff" />
        <stop offset="1" stopColor="#00e3ff" />
      </linearGradient>
      <linearGradient id="gp-b" x1="1.076" y1="17.089" x2="-1.305" y2="17.089" gradientUnits="objectBoundingBox">
        <stop offset="0" stopColor="#ffe000" />
        <stop offset="0.409" stopColor="#ffbd00" />
        <stop offset="0.775" stopColor="orange" />
        <stop offset="1" stopColor="#ff9c00" />
      </linearGradient>
      <linearGradient id="gp-c" x1="0.863" y1="10.864" x2="-0.502" y2="9.095" gradientUnits="objectBoundingBox">
        <stop offset="0" stopColor="#ff3a44" />
        <stop offset="1" stopColor="#c31162" />
      </linearGradient>
      <linearGradient id="gp-d" x1="-0.188" y1="13.585" x2="0.421" y2="12.794" gradientUnits="objectBoundingBox">
        <stop offset="0" stopColor="#32a071" />
        <stop offset="0.068" stopColor="#2da771" />
        <stop offset="0.476" stopColor="#15cf74" />
        <stop offset="0.801" stopColor="#06e775" />
        <stop offset="1" stopColor="#00f076" />
      </linearGradient>
    </defs>
    <g transform="translate(-10 -10)">
      <path d="M140,50H15a5.015,5.015,0,0,1-5-5V15a5.015,5.015,0,0,1,5-5H140a5.015,5.015,0,0,1,5,5V45A5.015,5.015,0,0,1,140,50Z" />
      <path d="M140,10.8a4.2,4.2,0,0,1,4.2,4.2V45a4.2,4.2,0,0,1-4.2,4.2H15A4.2,4.2,0,0,1,10.8,45V15A4.2,4.2,0,0,1,15,10.8H140m0-.8H15a5.015,5.015,0,0,0-5,5V45a5.015,5.015,0,0,0,5,5H140a5.015,5.015,0,0,0,5-5V15a5.015,5.015,0,0,0-5-5Z" fill="#a6a6a6" />
      <path d="M57.42,20.24a2.677,2.677,0,0,1-.75,2,2.908,2.908,0,0,1-2.2.89A3.091,3.091,0,0,1,51.35,20a2.994,2.994,0,0,1,.91-2.23,3.159,3.159,0,0,1,3.44-.65,2.544,2.544,0,0,1,.94.67l-.53.53a2.035,2.035,0,0,0-1.64-.71,2.266,2.266,0,0,0-1.64.67,2.4,2.4,0,0,0,1.64,4.13,2.276,2.276,0,0,0,1.68-.67,1.871,1.871,0,0,0,.5-1.22H54.47V19.8h2.91A3.424,3.424,0,0,1,57.42,20.24Z" fill="#fff" stroke="#fff" strokeMiterlimit={10} strokeWidth="0.2" />
      <path d="M62.03,17.74H59.3v1.9h2.46v.72H59.3v1.9h2.73V23h-3.5V17h3.5Z" fill="#fff" stroke="#fff" strokeMiterlimit={10} strokeWidth="0.2" />
      <path d="M65.28,23h-.77V17.74H62.83V17h4.12v.74H65.27V23Z" fill="#fff" stroke="#fff" strokeMiterlimit={10} strokeWidth="0.2" />
      <path d="M69.94,23V17h.77v6Z" fill="#fff" stroke="#fff" strokeMiterlimit={10} strokeWidth="0.2" />
      <path d="M74.13,23h-.77V17.74H71.68V17H75.8v.74H74.12V23Z" fill="#fff" stroke="#fff" strokeMiterlimit={10} strokeWidth="0.2" />
      <path d="M83.61,22.22a3.114,3.114,0,0,1-4.4,0,3.24,3.24,0,0,1,0-4.44,2.927,2.927,0,0,1,2.2-.91,2.958,2.958,0,0,1,2.2.91,3.214,3.214,0,0,1,0,4.44Zm-3.83-.5a2.318,2.318,0,0,0,3.26,0A2.36,2.36,0,0,0,83.71,20a2.321,2.321,0,0,0-.67-1.72,2.318,2.318,0,0,0-3.26,0,2.543,2.543,0,0,0,0,3.44Z" fill="#fff" stroke="#fff" strokeMiterlimit={10} strokeWidth="0.2" />
      <path d="M85.58,23V17h.94l2.92,4.67h.03l-.03-1.16V17h.77v6h-.8l-3.05-4.89h-.03l.03,1.16V23Z" fill="#fff" stroke="#fff" strokeMiterlimit={10} strokeWidth="0.2" />
      <path d="M78.14,31.75A4.25,4.25,0,1,0,82.41,36,4.195,4.195,0,0,0,78.14,31.75Zm0,6.83A2.587,2.587,0,1,1,80.54,36,2.458,2.458,0,0,1,78.14,38.58Zm-9.32-6.83A4.25,4.25,0,1,0,73.09,36,4.195,4.195,0,0,0,68.82,31.75Zm0,6.83A2.587,2.587,0,1,1,71.22,36,2.458,2.458,0,0,1,68.82,38.58ZM57.74,33.06v1.8h4.32a3.8,3.8,0,0,1-.98,2.27,4.411,4.411,0,0,1-3.33,1.32,4.8,4.8,0,0,1,0-9.6A4.571,4.571,0,0,1,61,30.14l1.27-1.27a6.3,6.3,0,0,0-4.53-1.82,6.611,6.611,0,1,0,0,13.22,6.03,6.03,0,0,0,4.61-1.85,5.968,5.968,0,0,0,1.56-4.22,5.456,5.456,0,0,0-.1-1.13H57.74Zm45.31,1.4a3.946,3.946,0,0,0-3.64-2.71A4.038,4.038,0,0,0,95.4,36a4.159,4.159,0,0,0,4.22,4.25,4.214,4.214,0,0,0,3.54-1.88l-1.45-.97a2.419,2.419,0,0,1-2.09,1.18,2.163,2.163,0,0,1-2.06-1.29l5.69-2.35Zm-5.8,1.42a2.331,2.331,0,0,1,2.22-2.48,1.652,1.652,0,0,1,1.58.9ZM92.63,40H94.5V27.5H92.63Zm-3.06-7.3H89.5a2.94,2.94,0,0,0-2.24-.95,4.259,4.259,0,0,0,0,8.51,2.9,2.9,0,0,0,2.24-.97h.06v.61c0,1.63-.87,2.5-2.27,2.5a2.354,2.354,0,0,1-2.14-1.51l-1.63.68a4.053,4.053,0,0,0,3.77,2.51c2.19,0,4.04-1.29,4.04-4.43V32.01H89.56v.69Zm-2.15,5.88a2.584,2.584,0,0,1,0-5.15,2.4,2.4,0,0,1,2.27,2.59A2.365,2.365,0,0,1,87.42,38.58ZM111.81,27.5h-4.47V40h1.87V35.26h2.61a3.886,3.886,0,1,0-.01-7.76Zm.04,6.02H109.2V29.23h2.65a2.145,2.145,0,1,1,0,4.29Zm11.54-1.79a3.518,3.518,0,0,0-3.33,1.91l1.66.69a1.764,1.764,0,0,1,1.7-.92,1.8,1.8,0,0,1,1.96,1.61v.13a4.176,4.176,0,0,0-1.95-.48c-1.79,0-3.6.98-3.6,2.81a2.886,2.886,0,0,0,3.1,2.75,2.629,2.629,0,0,0,2.38-1.22h.06v.97h1.8V35.19C127.18,32.97,125.52,31.73,123.39,31.73Zm-.23,6.85c-.61,0-1.46-.31-1.46-1.06,0-.96,1.06-1.33,1.98-1.33a3.293,3.293,0,0,1,1.7.42A2.257,2.257,0,0,1,123.16,38.58ZM133.74,32l-2.14,5.42h-.06L129.32,32h-2.01l3.33,7.58-1.9,4.21h1.95L135.82,32Zm-16.8,8h1.87V27.5h-1.87Z" fill="#fff" />
      <path d="M20.44,17.54a2.012,2.012,0,0,0-.46,1.4V41.06a1.978,1.978,0,0,0,.46,1.4l.07.07L32.9,30.15v-.3L20.51,17.47Z" fill="url(#gp-a)" />
      <path d="M37.03,34.28,32.9,30.15v-.3l4.13-4.13.09.05,4.89,2.78c1.4.79,1.4,2.09,0,2.89l-4.89,2.78Z" fill="url(#gp-b)" />
      <path d="M37.12,34.22,32.9,30,20.44,42.46a1.622,1.622,0,0,0,2.08.06l14.6-8.3" fill="url(#gp-c)" />
      <path d="M37.12,25.78l-14.61-8.3a1.622,1.622,0,0,0-2.08.06L32.9,30Z" fill="url(#gp-d)" />
      <path d="M37.03,34.13,22.51,42.38a1.661,1.661,0,0,1-2,.01h0l-.07.07h0l.07.07h0a1.663,1.663,0,0,0,2-.01l14.61-8.3Z" opacity={0.2} />
      <path d="M20.44,42.32a2.012,2.012,0,0,1-.46-1.4v.15a1.978,1.978,0,0,0,.46,1.4l.07-.07Z" opacity={0.12} />
      <path d="M42.01,31.3l-4.99,2.83.09.09L42,31.44A1.758,1.758,0,0,0,43.05,30h0A1.819,1.819,0,0,1,42.01,31.3Z" opacity={0.12} />
      <path d="M22.51,17.62,42.01,28.7A1.869,1.869,0,0,1,43.06,30h0a1.745,1.745,0,0,0-1.05-1.44L22.51,17.48c-1.4-.79-2.54-.13-2.54,1.47v.15C19.97,17.49,21.12,16.83,22.51,17.62Z" fill="#fff" opacity={0.25} />
    </g>
  </svg>
</a>
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/about/page.tsx
git commit -m "fix(about): replace plain text app store links with SVG badge buttons"
```

---

## Task 8: Footer — Sanity Non-Profit Attribution

**Files:**
- Modify: `src/components/layout/Footer.tsx`

Astro footer has "Structured content powered by Sanity.io" at the bottom. Required by Sanity's non-profit plan terms.

- [ ] **Step 1: Read Footer.tsx**

Open `src/components/layout/Footer.tsx`.

- [ ] **Step 2: Add Sanity attribution**

After the copyright paragraph, add:

```tsx
<div className="mt-8">
  <div className="w-[50px] border-t border-white/20 mb-1" />
  <p className="text-white/40 text-xs">
    Structured content powered by{' '}
    <a
      href="https://www.sanity.io/"
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold hover:text-white/60 transition-colors"
    >
      Sanity.io
    </a>
  </p>
</div>
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Footer.tsx
git commit -m "feat(footer): add Sanity non-profit plan attribution"
```

---

## Task 9: Donate — iFrameResizer Auto-Height

**Files:**
- Modify: `src/app/donate/page.tsx`

Astro uses `iFrameResizer.min.js` loaded from `public/js/iFrameResizer.min.js` + calls `iFrameResize({...}, '#donation')` after iframe loads. Without it, the iframe has a fixed height that may clip or over-extend the form.

- [ ] **Step 1: Copy iFrameResizer script from reach-radio-web**

```bash
cp /Users/danielmccauley/Documents/Development/reach-radio-web/public/js/iFrameResizer.min.js /Users/danielmccauley/Documents/Development/reach-radio-nextjs/public/js/iFrameResizer.min.js
```

Verify the file was copied:
```bash
ls /Users/danielmccauley/Documents/Development/reach-radio-nextjs/public/js/
```
Expected: `iFrameResizer.min.js` present.

- [ ] **Step 2: Add script loading to donate page**

In `src/app/donate/page.tsx`, in the `handleLoad` function, add iFrameResizer call after the iframe loads:

```tsx
// Add this type declaration at top of file (outside component):
declare const iFrameResize: ((options: object, selector: string) => void) | undefined

// In handleLoad function, add after setLoaded(true):
if (typeof iFrameResize === 'function') {
  iFrameResize(
    { log: false, heightCalculationMethod: 'bodyOffset' },
    '#donation-iframe'
  )
}
```

Also add `id="donation-iframe"` to the `<iframe>` element and add the script tag:

```tsx
// Add id to iframe:
<iframe
  id="donation-iframe"
  ref={iframeRef}
  ...
/>

// Add Script component at the bottom of the return:
import Script from 'next/script'

// In JSX:
<Script src="/js/iFrameResizer.min.js" strategy="lazyOnload" />
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add public/js/iFrameResizer.min.js src/app/donate/page.tsx
git commit -m "feat(donate): add iFrameResizer for auto-height adjustment matching Astro implementation"
```

---

## Self-Review

**Spec coverage check:**

| Gap from analysis | Task |
|---|---|
| SSE RadioJar parsing wrong `json.song?.title` | Task 1 ✓ |
| Teacher photo not resolved in now playing | Task 2 ✓ |
| TodaySchedule shows past shows, no music breaks | Task 3 ✓ |
| Home schedule labeled "Today's Schedule" not "Playing Next" | Task 3 ✓ |
| RadioPlayer always vertical, no md horizontal | Task 4 ✓ |
| Privacy policy is a stub | Task 5 ✓ |
| About page missing OrganizationSchema | Task 6 ✓ |
| App Store buttons are plain text | Task 7 ✓ |
| Footer missing Sanity attribution | Task 8 ✓ |
| Donate iframe missing iFrameResizer | Task 9 ✓ |

**Intentionally excluded:**
- `/hyperview` endpoint — Hyperview is a different native app architecture not used by the Next.js target deployment
- Timezone parameter for schedule — Phoenix-centric user base; dynamic timezone detection would require client component overhead with minimal benefit
- Mobile nav hide during donation form focus — MobileNav in Next.js is always-rendered (not reactive to state), changing this requires state wiring; existing behavior (media bar hides) is sufficient

**Placeholder scan:** All steps contain concrete code. No TBDs, "similar to task N" patterns, or omitted implementations.

**Type consistency:**
- `teachersList` added in Task 2 Step 2 and consumed in Task 2 Step 3 — both use `{ name: string; photo: string }[]` ✓
- `siteSettingsQuery` added in Task 6 Step 2 and consumed in Task 6 Step 3 — return type matches fields selected ✓
- `OrganizationSchema` props defined in Task 6 Step 1 match all call sites ✓
