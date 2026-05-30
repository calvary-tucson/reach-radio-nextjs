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

**Vercel env vars:** Confirmed set — `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_WEBHOOK_SECRET`, `FORMSPREE_ENDPOINT`, `PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`. No action needed.

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

## Task 1: Fix existing revalidate endpoint

`src/app/api/revalidate/route.ts` already exists but has 3 bugs:

**Bug 1 — Invalid `revalidateTag` call**
```ts
revalidateTag(tag, 'days')  // ❌ revalidateTag takes 1 arg. 'days' is silently ignored.
```
Fix: `revalidateTag(tag)` — `cacheLife` is set in `sanityFetch`, not here.

**Bug 2 — Tag name mismatch**
Current TAG_MAP:
```ts
{ teacher: 'teachers', schedule: 'schedule', settings: 'settings', appSettings: 'settings' }
```
Problems:
- `settings` → `'settings'` but codebase uses `'siteSettings'` tag — revalidation does nothing
- `appSettings` → `'settings'` but codebase uses `'appSettings'` tag — same
- No fallback for unknown `_type` values

**Bug 3 — Weak authentication**
Current: plain `x-webhook-secret` header string comparison.
Better: Sanity's HMAC signature via `@sanity/webhook` (the official package, resistant to timing attacks).

**Files:**
- Modify: `src/app/api/revalidate/route.ts`

- [ ] **Step 1: Audit actual Sanity document type names**

Before touching the TAG_MAP, verify what `_type` values Sanity actually sends:

```bash
# In Sanity Studio or via CLI — check actual schema type names
npx sanity@latest documents query '*[defined(_type)]{ _type }' | sort -u | head -30
```

Or in Sanity GROQ playground:
```groq
array::unique(*[]._type)
```

Expected types to verify: `teacher`, `schedule`, `scheduledShow`, `siteSettings`, `appSettings`. Confirm names match before setting TAG_MAP.

- [ ] **Step 2: Install `@sanity/webhook`**

```bash
npm install @sanity/webhook
```

- [ ] **Step 3: Rewrite the route**

```ts
import { type NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook'

const SANITY_WEBHOOK_SECRET = process.env.SANITY_WEBHOOK_SECRET

// Verify these _type values match actual Sanity schema types (see Task 1 Step 1)
const TAG_MAP: Record<string, string[]> = {
  teacher:       ['teachers'],
  schedule:      ['schedule'],
  scheduledShow: ['schedule'],
  siteSettings:  ['siteSettings'],
  appSettings:   ['appSettings'],
}

export async function POST(req: NextRequest) {
  if (!SANITY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const body = await req.text()
  const signature = req.headers.get(SIGNATURE_HEADER_NAME)

  if (!signature || !isValidSignature(body, signature, SANITY_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { _type?: string; slug?: { current?: string } }
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { _type, slug } = payload
  const tags = _type ? TAG_MAP[_type] : undefined

  if (tags) {
    for (const tag of tags) {
      revalidateTag(tag)
    }
    // Per-slug invalidation for teacher publishes
    if (_type === 'teacher' && slug?.current) {
      revalidateTag(`teacher-${slug.current}`)
    }
    return NextResponse.json({ revalidated: true, type: _type, tags })
  }

  // Unknown type — revalidate everything as safe fallback
  for (const tagList of Object.values(TAG_MAP)) {
    for (const tag of tagList) {
      revalidateTag(tag)
    }
  }
  return NextResponse.json({ revalidated: true, type: _type, reason: 'unknown type — full revalidation' })
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "revalidate"
```

Expected: no errors.

- [ ] **Step 5: Configure Sanity webhook (manual step — do after Vercel deploy)**

In Sanity dashboard (sanity.io → project → API → Webhooks):
- URL: `https://reach.radio/api/revalidate`
- HTTP method: POST
- Trigger on: create, update, delete
- Projection (send minimal payload):
  ```groq
  { _type, "slug": slug }
  ```
- Secret: value of `SANITY_WEBHOOK_SECRET` from Vercel env

> **Note:** Register this webhook only after the Vercel production deploy is live. The Sanity dashboard webhook must point at the live URL.

- [ ] **Step 6: Test webhook end-to-end**

After Vercel deploy, publish any teacher in Sanity Studio. Confirm:
- Sanity dashboard shows webhook delivery success (green)
- Teacher page content updates within a few seconds

For local testing with a tunneled URL (ngrok etc.):
```bash
# Simulate a valid Sanity webhook — use their signing utility
node -e "
const { signPayload } = require('@sanity/webhook')
const secret = process.env.SANITY_WEBHOOK_SECRET
const payload = JSON.stringify({ _type: 'teacher', slug: { current: 'john-ankerberg' } })
console.log(signPayload(payload, secret))
"
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/revalidate/route.ts
git commit -m "fix: repair revalidate endpoint — HMAC auth, correct tag names, per-slug invalidation"
```

---

## Task 2: Verify home page PPR

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

```bash
rm -rf .next && npm run build 2>&1 | tee /tmp/ppr-phase3-build.log
```

- [ ] **Step 2: Check PPR routes**

```bash
grep -E "◐|PPR" /tmp/ppr-phase3-build.log
```

Expected: `/` and all Phase 2 routes show `◐`.

- [ ] **Step 3: Check for errors**

```bash
grep -iE "error|uncached data|outside.*suspense" /tmp/ppr-phase3-build.log
```

Expected: no errors.

- [ ] **Step 4: Lint + type check**

```bash
npm run lint && npx tsc --noEmit
```

Expected: both exit 0.

---

## Phase 3 Completion Checklist

- [ ] Revalidate endpoint fixed (HMAC auth, correct tag names, per-slug support)
- [ ] Sanity document `_type` values verified against TAG_MAP
- [ ] Home page `/` shows `◐` in build output
- [ ] Per-slug tags on teacher detail pages (page + modal)
- [ ] Sanity dashboard webhook configured pointing at `https://reach.radio/api/revalidate`
- [ ] End-to-end webhook test passed (publish in Studio → page updates)
- [ ] `native-config` `webUrl` updated to `reach.radio` (at go-live)
- [ ] No regressions in Phase 2 routes
- [ ] Build + lint + tsc all pass
