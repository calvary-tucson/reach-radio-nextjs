# PPR Phase 3 — Cache Invalidation + Home Page PPR + Per-Slug Tags

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Phase 2 complete — `cacheComponents: true`, all target routes show `◐` in build output.
See: `docs/superpowers/plans/2026-05-29-ppr-cache-components.md`

**Goal:** Make the Phase 2 caching strategy actually work in production by:
1. Fixing the existing revalidate endpoint (it exists but has bugs — see Task 1)
2. Verifying home page PPR (already structured with Suspense — likely already done)
3. Upgrading to per-slug cache tags so a single teacher publish invalidates only that teacher's pages

**Why this matters:**
- Phase 2 set up `cacheTag('teachers')` etc. but the existing `/api/revalidate` has a broken `revalidateTag` call and a tag name mismatch — cache invalidation silently does nothing today.
- Per-slug tags prevent a thundering herd (all teacher pages refetched simultaneously) on every Sanity publish.

**Tech Stack:** Next.js 16.2.6, `cacheComponents: true`, Sanity webhooks, `next/cache` `revalidateTag()`

**Vercel env vars:** Confirmed set — `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_WEBHOOK_SECRET` (Task 1 renames this to `SANITY_REVALIDATE_SECRET` — see below), `FORMSPREE_ENDPOINT`, `PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`.

> **2026-08-05 update:** Task 1 below was rewritten. The original version (installing `@sanity/webhook` and describing 3 specific bugs) predated several since-shipped fixes to this endpoint and no longer matched current code — see
> `docs/superpowers/specs/2026-08-05-sanity-webhook-signature-migration-design.md` for the full
> investigation and cross-repo design (this migration also applies to calvarytucson-nextjs and
> calvarytucson-svelte, tracked in their own repos' plans). Tasks 2 and 4 were independently
> verified already complete via unrelated commits and need no action — see their updated notes
> below.

---

## Production Context — Do This Phase Before Going Live

Phase 3 is a **hard prerequisite for production launch**. The full go-live sequence is:

```
Native bridge fixes → Vercel deploy → Phase 3 (this plan) → Update native-config webUrl → Switch native apps to Next.js URL
```

### Why Phase 3 blocks go-live

- The revalidate endpoint must be fixed and tested **before** switching native apps to the Next.js URL. Content editors will publish on day one — stale caches are a regression vs. the current Astro site (no caching layer).
- The production webhook URL (`https://reach.radio/api/revalidate`) can only be registered in Sanity dashboard after Vercel deploy is live with a stable domain.

### Go-live sequence detail

**Step A — Native bridge fixes** (separate plan: `docs/superpowers/plans/2026-05-29-native-webview-bridge-fixes.md`)
1. Fix audio stream proxy (AbortSignal.timeout kills stream after 10s)
2. Add middleware for native detection
3. Fix 4 BridgeInit.tsx gaps (splash dismiss, showMediaBar, focusin/focusout, streamUrl)
4. `/api/native-config` already exists — verify it works
- iOS constraint: keep Astro at `reach-radio-web.pages.dev` alive indefinitely — iOS audio stream is hardcoded there

**Step B — Vercel deploy**
- Migrate hosting from Cloudflare Pages → Vercel
- Vercel required for `cacheComponents` (PPR) — Cloudflare Pages does not support Next.js PPR
- Env vars: already confirmed set in Vercel ✓
- Confirm `◐` routes work in Vercel preview deployment before going live

**Step C — This plan (Phase 3)**
- Fix revalidate endpoint bugs
- Register Sanity webhook pointing at production Vercel URL
- Verify per-slug tags and home page PPR

**Step D — Update `native-config` webUrl**
- `src/app/api/native-config/route.ts` currently returns `webUrl: 'https://reach-radio-web.pages.dev'`
- Change to `webUrl: 'https://reach.radio'` before switching native apps
- Android uses this field for deep-link routing — wrong value = broken nav

**Step E — Switch native apps**
- Update hardcoded URL in iOS (Swift/WKWebView) and Android (Kotlin/WebView) from `reach-radio-web.pages.dev` to `reach.radio`
- Confirm with `docs/native-webview-bridge.md`

---

## File Map

| File | Change |
|---|---|
| `src/app/api/revalidate/route.ts` | Fix 3 bugs (invalid revalidateTag call, tag name mismatch, weak auth) |
| `src/app/api/native-config/route.ts` | Update `webUrl` to `reach.radio` before go-live (Step D) |
| `src/app/page.tsx` | Verify `◐` in build — already has Suspense boundaries, likely no code change needed |
| `src/app/teachers/[slug]/page.tsx` | Add `cacheTag(\`teacher-${slug}\`)` alongside `cacheTag('teachers')` |
| `src/app/@modal/(...)teachers/[slug]/page.tsx` | Same per-slug tag addition |

---

## Task 1: Migrate revalidate endpoint to @sanity/webhook signature auth + fix schedule-tag gap

> Rewritten 2026-08-05. Full rationale and cross-repo design:
> `docs/superpowers/specs/2026-08-05-sanity-webhook-signature-migration-design.md`. The original
> Task 1 (3 "bugs": invalid `revalidateTag` args, tag-name mismatch, weak auth) no longer applies —
> `src/app/api/revalidate/route.ts` already uses `revalidateTag(tag, 'max')` (the correct 2-arg
> form per `node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md`) and already
> has `timingSafeEqual` + replay-window auth. What actually needs fixing:
>
> 1. **Real bug:** Sanity has no `schedule` document type — schedule data is a field on the
>    `teacher` document (confirmed via `src/lib/sanity/queries.ts` GROQ:
>    `_type == "teacher" && count(schedule...)`). `TodaySchedule.tsx` (home page) caches under tag
>    `'schedule'`, but nothing ever calls `revalidateTag('schedule')` — editing a teacher's
>    schedule in Sanity never invalidates the home page's schedule cache. The new TAG_MAP below
>    deliberately drops the old `schedule: 'teachers'` entry (Sanity never sends a `_type: 'schedule'`
>    document, so that entry was dead code) and instead has `_type: 'teacher'` revalidate both
>    `'teachers'` and `'schedule'` tags — that's the actual fix.
> 2. **Design upgrade:** swap the shared-secret comparison for `@sanity/webhook`'s HMAC signature
>    verification (`isValidSignature`), matching the design doc's cross-repo decision. Replace the
>    payload-`_updatedAt`-based replay check with one derived from the signature's own embedded
>    timestamp (`decodeSignatureHeader`) — more robust, doesn't depend on the Sanity GROQ
>    projection shape.
> 3. Rename env var `SANITY_WEBHOOK_SECRET` → `SANITY_REVALIDATE_SECRET` (Vercel + Sanity
>    dashboard), to match the other two Sanity-backed projects.

**Files:**
- Modify: `src/app/api/revalidate/route.ts`
- Modify: `tests/unit/api-revalidate.test.ts`
- Modify: `package.json` (add `@sanity/webhook` dependency)

- [ ] **Step 1: Install `@sanity/webhook`**

```bash
npm install @sanity/webhook
```

- [ ] **Step 2: Write the failing tests**

Replace the full contents of `tests/unit/api-revalidate.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { encodeSignatureHeader, SIGNATURE_HEADER_NAME } from '@sanity/webhook'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

const SECRET = 'test-secret'

async function signedRequest(
  body: unknown,
  opts: { secret?: string; timestamp?: number } = {}
): Promise<Request> {
  const rawBody = JSON.stringify(body)
  const timestamp = opts.timestamp ?? Date.now()
  const signature = await encodeSignatureHeader(rawBody, timestamp, opts.secret ?? SECRET)
  return new Request('http://localhost/api/revalidate', {
    method: 'POST',
    headers: { [SIGNATURE_HEADER_NAME]: signature },
    body: rawBody,
  })
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    process.env.SANITY_REVALIDATE_SECRET = SECRET
  })

  it('returns 401 when signature header is missing', async () => {
    const { POST } = await import('@/app/api/revalidate/route')
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      body: JSON.stringify({ _type: 'teacher' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when signature does not match the secret', async () => {
    const { POST } = await import('@/app/api/revalidate/route')
    const req = await signedRequest({ _type: 'teacher' }, { secret: 'wrong-secret' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when the signature timestamp is older than the replay window', async () => {
    const { POST } = await import('@/app/api/revalidate/route')
    const req = await signedRequest({ _type: 'teacher' }, { timestamp: Date.now() - 6 * 60_000 })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('revalidates both "teachers" and "schedule" tags for teacher documents', async () => {
    const { revalidateTag } = await import('next/cache')
    const { POST } = await import('@/app/api/revalidate/route')
    const req = await signedRequest({ _type: 'teacher' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith('teachers', 'max')
    expect(revalidateTag).toHaveBeenCalledWith('schedule', 'max')
  })

  it('revalidates "appSettings" for appSettings documents', async () => {
    const { revalidateTag } = await import('next/cache')
    const { POST } = await import('@/app/api/revalidate/route')
    const req = await signedRequest({ _type: 'appSettings' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith('appSettings', 'max')
  })

  it('returns revalidated: false for unknown document type', async () => {
    const { POST } = await import('@/app/api/revalidate/route')
    const req = await signedRequest({ _type: 'unknownType' })
    const res = await POST(req)
    const body = await res.json()
    expect(body.revalidated).toBe(false)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npx vitest run tests/unit/api-revalidate.test.ts
```

Expected: FAIL — current route still reads `x-webhook-secret` and has no `schedule` tag entry, so the new signature-based and schedule-tag assertions won't pass.

- [ ] **Step 4: Rewrite the route**

Replace the full contents of `src/app/api/revalidate/route.ts`:

```ts
import { revalidateTag } from 'next/cache'
import { isValidSignature, decodeSignatureHeader, SIGNATURE_HEADER_NAME } from '@sanity/webhook'

const TAG_MAP: Record<string, string[]> = {
  teacher: ['teachers', 'schedule'],
  siteSettings: ['siteSettings'],
  appSettings: ['appSettings'],
}

const REPLAY_WINDOW_MS = 5 * 60_000

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.SANITY_REVALIDATE_SECRET
  const signature = req.headers.get(SIGNATURE_HEADER_NAME)

  if (!secret || !signature) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawBody = await req.text()

  if (!(await isValidSignature(rawBody, signature, secret))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { timestamp } = decodeSignatureHeader(signature)
  if (Date.now() - timestamp > REPLAY_WINDOW_MS) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { _type?: string }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tags = body._type ? TAG_MAP[body._type] : undefined

  if (tags) {
    for (const tag of tags) {
      revalidateTag(tag, 'max')
    }
    return Response.json({ revalidated: true, tags })
  }

  return Response.json({ revalidated: false, reason: 'unknown document type' })
}
```

Note: `decodeSignatureHeader` is only reached after `isValidSignature` has already succeeded, so its internal parsing of the signature header cannot throw here — `isValidSignature` returns `false` (rather than throwing) for any malformed signature, and that path already returned 401 above.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run tests/unit/api-revalidate.test.ts
```

Expected: PASS, all 6 tests.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -i revalidate
```

Expected: no errors.

- [ ] **Step 7: Rename the Vercel env var**

```bash
vercel env rm SANITY_WEBHOOK_SECRET production --yes
vercel env rm SANITY_WEBHOOK_SECRET preview --yes
vercel env add SANITY_REVALIDATE_SECRET production
vercel env add SANITY_REVALIDATE_SECRET preview
```

Use the same secret value that was in `SANITY_WEBHOOK_SECRET` (fetch it from Doppler's `dev`
config if not otherwise on hand: `doppler secrets get SANITY_WEBHOOK_SECRET --plain`).

- [ ] **Step 8: Commit**

```bash
git add src/app/api/revalidate/route.ts tests/unit/api-revalidate.test.ts package.json package-lock.json
git commit -m "fix(api): migrate revalidate endpoint to @sanity/webhook signature auth, fix schedule-tag gap"
```

- [ ] **Step 9: Configure Sanity webhook (manual step — do after Vercel deploy of this change)**

In Sanity dashboard (sanity.io → project → API → Webhooks), find the existing webhook that sends
the `x-webhook-secret` custom header (it must already exist — that's the header the pre-migration
code was reading) and update it:
- Remove the custom `x-webhook-secret` header from its configuration entirely
- Set the native "Secret" field to the same value now in `SANITY_REVALIDATE_SECRET` — Sanity
  computes the `sanity-webhook-signature` header itself once this is set; no custom headers or
  query params are needed
- URL: `https://reach-radio-nextjs.vercel.app/api/revalidate` (interim — `reach.radio` DNS isn't
  live yet; update this URL once it is, per Phase 3's own go-live sequence, Step D/E)
- HTTP method: POST
- Trigger on: create, update, delete
- Projection (send minimal payload):
  ```groq
  { _type }
  ```

- [ ] **Step 10: Test webhook end-to-end**

After Vercel deploy, publish any teacher in Sanity Studio. Confirm:
- Sanity dashboard shows webhook delivery success (green)
- Teacher page content updates within a few seconds
- Home page's "Today's schedule" also updates if the teacher's schedule changed (this is the bug
  this task fixed — verify it specifically, not just the teacher page)

---

## Task 2: Verify home page PPR

> **Already verified complete, 2026-08-05** — ran `doppler run -- npm run build`, confirmed `/`
> shows `◐` in the build output. No code change needed; skip straight to Task 3.

`src/app/page.tsx` is already a synchronous shell with `<Suspense>` around `<RadioPlayer />` and `<TodaySchedule />`. This task is likely already complete — verify before touching anything.

**Files:**
- Read: `src/app/page.tsx` (do NOT modify unless build check fails)

- [ ] **Step 1: Check build output**

```bash
npm run build 2>&1 | grep -E "◐|○|λ" | grep -E "^.*/$"
```

Expected: `/` shows `◐` (PPR). If it already does, this task is done — skip to Task 3.

- [ ] **Step 2: If `/` shows `λ` (dynamic) — investigate**

Run:
```bash
npm run build 2>&1 | grep -A2 "/"
```

If the home page is dynamic, find what's forcing it outside a Suspense boundary:
- `connection()` calls at page level
- `headers()` or `cookies()` at page level
- Any `sanityFetch` call not inside a Suspense-wrapped async component

Apply same Suspense extraction pattern as Phase 2.

- [ ] **Step 3: Commit only if changes were needed**

```bash
git add src/app/page.tsx
git commit -m "fix: add Suspense boundaries to home page for PPR"
```

---

## Task 3: Per-slug cache tags on teacher detail pages

Currently `getTeacher` and `ModalTeacherContent` tag with `cacheTag('teachers')` only. Add `cacheTag(\`teacher-${slug}\`)` so the revalidate endpoint can invalidate single-teacher pages without busting the entire teachers cache.

**Files:**
- Modify: `src/app/teachers/[slug]/page.tsx`
- Modify: `src/app/@modal/(...)teachers/[slug]/page.tsx`

- [ ] **Step 1: Update `getTeacher` in teachers/[slug]/page.tsx**

```ts
const getTeacher = cache(async (slug: string): Promise<TeacherDetail | null> => {
  return sanityFetch<TeacherDetail | null>(
    teacherDetailQuery,
    { slug },
    { tags: ['teachers', `teacher-${slug}`] }
  )
})
```

Also update the `highlightedTeachersQuery` fetch inside `TeacherContent`:
```ts
sanityFetch<TeacherSummary[]>(
  highlightedTeachersQuery,
  { slugs: [...HIGHLIGHTED_TEACHER_SLUGS] },
  { tags: ['teachers', `teacher-${slug}`] }
)
```

- [ ] **Step 2: Update `ModalTeacherContent` in @modal/(...)teachers/[slug]/page.tsx**

Same pattern — add `` `teacher-${slug}` `` to both fetches.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "teachers/\[slug\]|modal"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/teachers/[slug]/page.tsx" "src/app/@modal/(...)teachers/[slug]/page.tsx"
git commit -m "perf: add per-slug cache tags to teacher detail pages"
```

---

## Task 4: Update native-config webUrl (do at go-live, not before)

> **Already verified complete** — `src/app/api/native-config/route.ts` uses the `SITE_URL`
> constant (`src/lib/constants.ts`, defaulting to `https://reach-radio-nextjs.vercel.app` via
> `NEXT_PUBLIC_SITE_URL`), not a hardcoded Astro URL. Fixed in commit `b6b4c88` ("use SITE_URL for
> webUrl so native apps always reach the Next.js deployment"). No action needed now; at actual
> go-live (Step D), setting `NEXT_PUBLIC_SITE_URL=https://reach.radio` in Vercel env accomplishes
> the same goal this task originally described — no code change required.

> **Timing:** Do this as part of Step D in the go-live sequence — after Vercel is live, before switching native app URLs. Doing it early would break the existing Android app which reads this endpoint from the Astro site.

**File:**
- Modify: `src/app/api/native-config/route.ts`

- [ ] **Step 1: Update webUrl**

Change:
```ts
webUrl: 'https://reach-radio-web.pages.dev',
```
To:
```ts
webUrl: 'https://reach.radio',
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/native-config/route.ts
git commit -m "fix: update native-config webUrl to production domain"
```

---

## Task 5: Full build + regression verification

- [ ] **Step 1: Clean build**

Local builds need Sanity/Formspree/reCAPTCHA env vars from Doppler (`SANITY_PROJECT_ID` etc. are
not in a committed `.env` file — this repo pulls secrets via `doppler run`):

```bash
rm -rf .next && doppler run -- npm run build 2>&1 | tee "$TMPDIR/ppr-phase3-build.log"
```

- [ ] **Step 2: Check PPR routes**

```bash
grep -E "◐|PPR" "$TMPDIR/ppr-phase3-build.log"
```

Expected: `/` and all Phase 2 routes show `◐`.

- [ ] **Step 3: Check for errors**

```bash
grep -iE "error|uncached data|outside.*suspense" "$TMPDIR/ppr-phase3-build.log"
```

Expected: no errors.

- [ ] **Step 4: Lint + type check**

```bash
npm run lint && npx tsc --noEmit
```

Expected: both exit 0.

---

## Phase 3 Completion Checklist

- [ ] Revalidate endpoint migrated to `@sanity/webhook` signature auth; schedule-tag gap fixed
- [ ] Env var renamed `SANITY_WEBHOOK_SECRET` → `SANITY_REVALIDATE_SECRET` (Vercel + Sanity dashboard)
- [x] Home page `/` shows `◐` in build output (verified 2026-08-05, no change needed)
- [ ] Per-slug tags on teacher detail pages (page + modal)
- [ ] Sanity dashboard webhook configured pointing at `https://reach-radio-nextjs.vercel.app/api/revalidate` (interim URL — update to `reach.radio` once DNS is live)
- [ ] End-to-end webhook test passed (publish in Studio → both teacher page AND home page schedule update)
- [x] `native-config` `webUrl` already uses `SITE_URL` constant (verified 2026-08-05, no change needed — set `NEXT_PUBLIC_SITE_URL=https://reach.radio` at go-live instead)
- [ ] No regressions in Phase 2 routes
- [ ] Build + lint + tsc all pass
