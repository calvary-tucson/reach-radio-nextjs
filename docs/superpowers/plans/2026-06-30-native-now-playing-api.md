# Native Now-Playing API — Web Side Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the reach-radio-nextjs API to resolve teacher artwork and canonical name server-side, including `imageUrl` and `resolvedArtist` in SSE and poll responses. Native iOS clients (CarPlay, Watch) can display the correct teacher photo without replicating fuzzy-match logic. The web media bar also benefits: it prefers server-resolved values and falls back to client-side matching, preserving name normalization in both paths. Also update the now-playing media bar UI to use blur fill instead of cropping for non-square teacher photos.

**Architecture:** A new shared `teacherCache.ts` module caches the Sanity teacher list (1-hour in-process TTL via `sanityFetch`) and exposes `resolveArtist(artist)` — a bidirectional fuzzy match returning `{ imageUrl, resolvedArtist }`. The SSE and poll routes import this and append both fields to every event. `useNowPlaying.ts` is updated to prefer server-resolved values with client-side matching as fallback. The now-playing media bar gets a two-layer blur fill so teacher faces are never cropped.

**Tech Stack:** Next.js 16 / TypeScript strict / `sanityFetch` from `@/lib/sanity/client` / Tailwind CSS

## Global Constraints

- No new npm packages
- All API endpoints remain unauthenticated (matching existing behavior)
- Teacher photo URL format: Sanity CDN URL + `?w=420&fm=jpg` (width only, natural aspect ratio — iOS handles compositing)
- Matching algorithm mirrors `useNowPlaying.ts` exactly (bidirectional `includes`) so native and web resolve the same teacher
- `TeacherAvatar` component is NOT changed — blur fill only applies to the now-playing media bar
- `artist` field in SSE/poll payloads stays as raw Radiojar string (backward compat) — `resolvedArtist` is the canonical Sanity name

---

## Context: How Teacher Photos Work Today

`useNowPlaying.ts` fetches `/api/teachers-list` once, stores in Zustand, then on each SSE event fuzzy-matches `artist` against teacher names:

```ts
const match = teachersList.find((t) =>
  t.name.toLowerCase().includes(resolvedArtist.toLowerCase()) ||
  resolvedArtist.toLowerCase().includes(t.name.toLowerCase())
)
if (match) {
  image = match.photo.includes('?')
    ? `${match.photo}&w=420&fm=jpg`
    : `${match.photo}?w=420&fm=jpg`
  resolvedArtist = match.name  // canonical name
}
```

No match → falls back to `FALLBACK_OG_IMAGE` (Reach Radio logo, already square).

**Music gaps:** `TodaySchedule` is Sanity-driven and independent — it calculates gaps between teaching slots and inserts explicit "Music" filler rows. No connection to the stream metadata or this plan.

**The problem:** Native clients have no access to the teacher list or match logic — they need `imageUrl` and `resolvedArtist` pre-resolved in the SSE payload.

---

### Task 1: Server-side teacher cache + artist resolution

**Files:**
- Create: `src/lib/teacherCache.ts`

**Interfaces:**
- Produces: `resolveArtist(artist: string): Promise<ArtistResolution>`

- [ ] **Step 1: Create `src/lib/teacherCache.ts`**

```typescript
import { sanityFetch } from '@/lib/sanity/client'
import { teacherNamesAndPhotosQuery } from '@/lib/sanity/queries'

interface TeacherEntry {
  name: string
  photo: string | null  // GROQ photo.asset->url returns null when asset is unset
}

export interface ArtistResolution {
  imageUrl: string | null
  resolvedArtist: string | null
}

let cachedTeachers: TeacherEntry[] = []
let cacheTimestamp = 0
// Two caching layers:
//   in-process (1h) — avoids per-poll Data Cache lookups on warm instances
//   sanityFetch 'use cache' (days) — persists across Vercel cold starts via Vercel Data Cache
// Days is appropriate: teacher photos rarely change.
const CACHE_TTL_MS = 60 * 60 * 1000

// Deduplicates concurrent cache-miss fetches on cold starts (multiple SSE connections opening simultaneously).
let pendingFetch: Promise<TeacherEntry[]> | null = null

async function getTeachers(): Promise<TeacherEntry[]> {
  if (Date.now() - cacheTimestamp < CACHE_TTL_MS && cachedTeachers.length > 0) {
    return cachedTeachers
  }
  if (pendingFetch) return pendingFetch
  pendingFetch = (async () => {
    try {
      const teachers = await sanityFetch<TeacherEntry[]>(
        teacherNamesAndPhotosQuery,
        {},
        { tags: ['teachers'] }
      )
      if (teachers && teachers.length > 0) {
        cachedTeachers = teachers
        cacheTimestamp = Date.now()
      }
    } catch {
      // Return stale cache on error rather than breaking SSE
    }
    pendingFetch = null
    return cachedTeachers
  })()
  return pendingFetch
}

// Bidirectional substring match — mirrors useNowPlaying.ts client logic exactly.
// "Dr. John MacArthur" matches teacher "John MacArthur" (artist includes teacher name).
function matches(artist: string, teacherName: string): boolean {
  const a = artist.toLowerCase()
  const t = teacherName.toLowerCase()
  return t.includes(a) || a.includes(t)
}

export async function resolveArtist(artist: string): Promise<ArtistResolution> {
  if (!artist) return { imageUrl: null, resolvedArtist: null }
  const teachers = await getTeachers()
  const match = teachers.find((t) => matches(artist, t.name))
  // No match at all — not a teacher program
  if (!match) return { imageUrl: null, resolvedArtist: null }
  // Matched teacher but photo not set in Sanity — still return the canonical name
  if (!match.photo) return { imageUrl: null, resolvedArtist: match.name }
  const sep = match.photo.includes('?') ? '&' : '?'
  return {
    // w=420&fm=jpg — width only, natural aspect ratio preserved.
    // iOS composites into a square with blur fill (squareWithBlurFill in AudioStreamingManager).
    imageUrl: `${match.photo}${sep}w=420&fm=jpg`,
    resolvedArtist: match.name,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/teacherCache.ts
git commit -m "feat(api): add server-side teacher cache and artist resolution (imageUrl + resolvedArtist)"
```

---

### Task 2: Extend SSE route to emit `imageUrl` and `resolvedArtist`

**Files:**
- Modify: `src/app/api/stream-info-sse/route.ts`

**Interfaces:**
- Consumes: `resolveArtist(artist)` from `@/lib/teacherCache`
- Produces SSE payload: `{ title, artist, imageUrl: string | null, resolvedArtist: string | null }`

- [ ] **Step 1: Import and wire `resolveArtist` into the SSE poll function**

Add import at top of `src/app/api/stream-info-sse/route.ts`:

```typescript
import { resolveArtist } from '@/lib/teacherCache'
```

Replace the entire `poll()` function with:

```typescript
async function poll() {
  if (cancelled) return
  try {
    const res = await fetch(RADIOJAR_URL, {
      signal: AbortSignal.any([
        AbortSignal.timeout(5_000),
        abortController.signal,
      ]),
    })
    const text = await res.text()
    const stripped = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '')
    const json = JSON.parse(stripped) as { title?: string; artist?: string }
    const title = json.title || 'Reach Radio'
    const artist = json.artist || ''
    const { imageUrl, resolvedArtist } = await resolveArtist(artist)
    consecutiveFailures = 0
    if (!cancelled) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ title, artist, imageUrl, resolvedArtist })}\n\n`)
      )
    }
    schedulePoll(30_000)
  } catch {
    if (!cancelled) {
      consecutiveFailures++
      const delay = Math.min(30_000 * Math.pow(2, consecutiveFailures - 1), MAX_POLL_BACKOFF_MS)
      schedulePoll(delay)
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Smoke test locally**

```bash
npm run dev
# In another terminal:
curl -N http://localhost:3000/api/stream-info-sse
```

Expected: `data: {"title":"...","artist":"...","imageUrl":"https://cdn.sanity.io/...","resolvedArtist":"John MacArthur"}` (or `"imageUrl":null,"resolvedArtist":null` during music)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stream-info-sse/route.ts
git commit -m "feat(api): emit imageUrl and resolvedArtist in stream-info-sse payload"
```

---

### Task 3: Extend poll route to return `imageUrl` and `resolvedArtist`

**Files:**
- Modify: `src/app/api/stream-info/route.ts`

- [ ] **Step 1: Replace full file content**

```typescript
import { createRateLimiter } from '@/lib/rate-limit'
import { RADIOJAR_URL } from '@/lib/constants'
import { resolveArtist } from '@/lib/teacherCache'

const limiter = createRateLimiter({ windowMs: 60_000, max: 30 })

export async function GET(request: Request): Promise<Response> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const result = limiter.check(ip)
  if (!result.success) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter),
        'Content-Type': 'text/plain',
      },
    })
  }

  try {
    const res = await fetch(RADIOJAR_URL, {
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 0 },
    })
    const text = await res.text()
    // Robust JSONP strip — handles named callback and whitespace variations
    const stripped = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '')
    const json = JSON.parse(stripped) as { title?: string; artist?: string }

    const title = json.title || 'Reach Radio'
    const artist = json.artist || ''
    const { imageUrl, resolvedArtist } = await resolveArtist(artist)

    return Response.json({ title, artist, streamTitle: title, streamArtist: artist, imageUrl, resolvedArtist })
  } catch {
    return Response.json(
      { title: 'Reach Radio', artist: '', streamTitle: 'Reach Radio', streamArtist: '', imageUrl: null, resolvedArtist: null },
      { status: 200 }
    )
  }
}
```

- [ ] **Step 2: TypeScript check + smoke test**

```bash
npx tsc --noEmit
curl http://localhost:3000/api/stream-info
```

Expected: `{"title":"...","artist":"...","streamTitle":"...","streamArtist":"...","imageUrl":"...","resolvedArtist":"..."}`

- [ ] **Step 3: Deploy to Vercel**

```bash
git add src/app/api/stream-info/route.ts
git commit -m "feat(api): include imageUrl and resolvedArtist in stream-info poll response"
git push
```

Verify on production:
```bash
curl https://reach-radio-nextjs.vercel.app/api/stream-info
```

---

### Task 4: Blur fill in now-playing media bar

Teacher photos have varying aspect ratios. The media bar currently uses `object-cover` which crops faces. Replace with a two-layer blur fill: blurred background fills the square, sharp image sits `object-contain` centered on top. Works correctly with square fallback logo too (contain with square = same as cover).

**Files:**
- Modify: `src/components/media-bar/NowPlayingInfo.tsx`

**Note:** `TeacherAvatar` is NOT changed — it uses circle/rounded shapes where blur fill looks wrong.

- [ ] **Step 1: Replace the image wrapper in `NowPlayingInfo.tsx`**

```tsx
// Before:
      <div className="w-12 h-12 relative overflow-hidden rounded-md flex-shrink-0">
        <Image
          src={image}
          alt={artist ? `${title} — ${artist}` : (title ?? 'Album art')}
          fill
          sizes="48px"
          className="object-cover"
        />
      </div>

// After:
      <div className="w-12 h-12 relative overflow-hidden rounded-md flex-shrink-0">
        {/* Decorative blurred background — aria-hidden, scale-110 hides blur edge softness.
            Uses a low-res variant (?w=48) to avoid a full-size duplicate network request. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-110 blur-md"
          style={{ backgroundImage: `url(${image.replace('w=420', 'w=48')})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        {/* Sharp image centered, object-contain so faces are never cropped.
            `fill` injects position:absolute — `relative` would be redundant, omit it. */}
        <Image
          src={image}
          alt={artist ? `${title} — ${artist}` : (title ?? 'Album art')}
          fill
          sizes="48px"
          className="object-contain z-10"
        />
      </div>
```

- [ ] **Step 2: Verify locally**

```bash
npm run dev
```

Open `http://localhost:3000`, trigger audio play so the media bar appears with a teacher photo. Confirm:
- Blurred background fills the 48×48 square
- Sharp image centered on top, face not cropped
- Square fallback logo renders correctly (object-contain + square = no visual change)

- [ ] **Step 3: Commit and push**

```bash
git add src/components/media-bar/NowPlayingInfo.tsx
git commit -m "feat(player): blur fill for now-playing artwork — preserves teacher faces on non-square images"
git push
```

---

### Task 5: Update web client to prefer server-resolved values

`useNowPlaying.ts` currently ignores `imageUrl`/`resolvedArtist` in SSE payloads and does its own client-side matching. Update it to prefer server values when present, fall back to client-side matching when null (music gaps, cache miss, unmatched artist). This eliminates a redundant client matching pass and ensures web and native display the same teacher name.

**Files:**
- Modify: `src/hooks/useNowPlaying.ts`

**Note:** The `/api/teachers-list` fetch and `useTeachersStore` population are NOT removed — client-side matching stays as the fallback path.

- [ ] **Step 1: Update `es.onmessage` handler in `useNowPlaying.ts`**

```typescript
// Before:
          const data = raw as { title?: string; artist?: string }

          const { teachersList } = useTeachersStore.getState()

          let image = FALLBACK_OG_IMAGE
          let resolvedArtist = data.artist ?? useMediaStore.getState().artist

          if (resolvedArtist && teachersList.length > 0) {
            const match = teachersList.find((t) =>
              t.name.toLowerCase().includes(resolvedArtist.toLowerCase()) ||
              resolvedArtist.toLowerCase().includes(t.name.toLowerCase())
            )
            if (match) {
              image = match.photo.includes('?')
                ? `${match.photo}&w=420&fm=jpg`
                : `${match.photo}?w=420&fm=jpg`
              resolvedArtist = match.name
            }
          }

// After:
          const data = raw as {
            title?: string
            artist?: string
            imageUrl?: string | null
            resolvedArtist?: string | null
          }

          const { teachersList } = useTeachersStore.getState()

          let image = FALLBACK_OG_IMAGE
          let resolvedArtist = data.artist ?? useMediaStore.getState().artist

          if (data.imageUrl && data.resolvedArtist) {
            // Server resolved both — use directly, skip redundant client match
            image = data.imageUrl
            resolvedArtist = data.resolvedArtist
          } else if (resolvedArtist && teachersList.length > 0) {
            // Fallback: client-side match (music gaps, null imageUrl, unmatched artist)
            const match = teachersList.find((t) =>
              t.name.toLowerCase().includes(resolvedArtist.toLowerCase()) ||
              resolvedArtist.toLowerCase().includes(t.name.toLowerCase())
            )
            if (match) {
              image = match.photo.includes('?')
                ? `${match.photo}&w=420&fm=jpg`
                : `${match.photo}?w=420&fm=jpg`
              resolvedArtist = match.name
            }
          }
```

- [ ] **Step 2: Verify locally**

```bash
npm run dev
```

Open `http://localhost:3000`, trigger play. Confirm media bar shows canonical teacher name (e.g. "John MacArthur" not "Dr. John MacArthur") and correct photo. During music: Reach Radio logo, raw song title + artist.

- [ ] **Step 3: Commit and push**

```bash
git add src/hooks/useNowPlaying.ts
git commit -m "feat(player): consume server-resolved imageUrl and resolvedArtist from SSE payload"
git push
```
