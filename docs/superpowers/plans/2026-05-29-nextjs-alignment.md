# Next.js 16 Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align reach-radio-nextjs with Next.js 16 best practices — fix deprecations, remove conflicting cache directives, and enable PPR.

**Architecture:** Three phases (correctness → PPR → verify). Many items from the original spec are already implemented (`use cache` in sanityFetch, `revalidateTag` in webhook route, `ViewTransition` on teacher cards + detail hero, Suspense boundaries on key pages). The remaining work is the middleware rename, removing legacy `revalidate` exports that conflict with `use cache`, and enabling PPR on pages that already have Suspense boundaries.

**Tech Stack:** Next.js 16.2.6, React 19.2.6, TypeScript, `next/cache` (`cacheTag`, `cacheLife`, `revalidateTag`)

---

## Phase 1 — Correctness

### Task 1: Rename middleware → proxy

Next.js 16 deprecated the `middleware` file convention. Build currently emits: `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`

**Files:**
- Delete: `src/middleware.ts`
- Create: `src/proxy.ts`

- [ ] **Step 1: Copy middleware.ts to proxy.ts**

Content of `src/proxy.ts` (identical logic, new file name):

```ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next()

  if (request.headers.get('mobile-app') === 'true') {
    response.cookies.set('mobile-app', 'true', {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      // Not httpOnly — BridgeInit.tsx needs to clear this when the bridge is absent
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

- [ ] **Step 2: Delete `src/middleware.ts`**

```bash
rm src/middleware.ts
```

- [ ] **Step 3: Build and confirm warning is gone**

```bash
npm run build 2>&1 | grep -i "middleware\|proxy\|warning"
```

Expected: no middleware deprecation warning.

- [ ] **Step 4: Commit**

```bash
git add src/proxy.ts src/middleware.ts
git commit -m "fix: rename middleware.ts to proxy.ts (Next.js 16 convention)"
```

---

### Task 2: Bump eslint-config-next

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update eslint-config-next**

```bash
npm install --save-dev eslint-config-next@16.2.6
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

Expected: exits 0, no new errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump eslint-config-next to 16.2.6"
```

---

### Task 3: Remove conflicting `revalidate` exports

Three pages use `export const revalidate = N` alongside `sanityFetch` which already has `'use cache'` + `cacheLife('days')`. The route-level `revalidate` is the old ISR API and conflicts with the function-level `use cache` directive. Removing it lets `use cache` be the single source of truth, with `revalidateTag` from the webhook as the invalidation mechanism.

**Files:**
- Modify: `src/app/teachers/page.tsx` — remove `export const revalidate = 3600`
- Modify: `src/app/teachers/[slug]/page.tsx` — remove `export const revalidate = 3600`
- Modify: `src/app/scheduled-list/page.tsx` — remove `export const revalidate = 86400`

- [ ] **Step 1: Remove from teachers/page.tsx**

In `src/app/teachers/page.tsx`, delete this line:

```ts
export const revalidate = 3600
```

- [ ] **Step 2: Remove from teachers/[slug]/page.tsx**

In `src/app/teachers/[slug]/page.tsx`, delete this line:

```ts
export const revalidate = 3600
```

- [ ] **Step 3: Remove from scheduled-list/page.tsx**

In `src/app/scheduled-list/page.tsx`, delete this line:

```ts
export const revalidate = 86400
```

- [ ] **Step 4: Build to confirm no breakage**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds, same route list as before.

- [ ] **Step 5: Commit**

```bash
git add src/app/teachers/page.tsx src/app/teachers/\[slug\]/page.tsx src/app/scheduled-list/page.tsx
git commit -m "fix: remove legacy revalidate exports — use cache handles caching"
```

---

## Phase 2 — PPR

### Task 4: Enable PPR globally

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add ppr to experimental block**

In `next.config.ts`, add `ppr: true` to the existing `experimental` object:

```ts
experimental: {
  ppr: true,
  serverComponentsHmrCache: true,
  viewTransition: true,
  useCache: true,
},
```

- [ ] **Step 2: Build to confirm PPR enabled**

```bash
npm run build 2>&1 | head -20
```

Expected: build succeeds. PPR doesn't change anything yet — no pages opt in until Task 5.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: enable PPR globally in next.config"
```

---

### Task 5: Opt pages into PPR

Three pages have Suspense boundaries and benefit from PPR — the static shell pre-renders at build time, Suspense holes stream in on request.

**Pages:**
- `src/app/page.tsx` — home: `<RadioPlayer>` and `<TodaySchedule>` already in Suspense
- `src/app/teachers/page.tsx` — `<RecommendedTeachers>` already in Suspense
- `src/app/scheduled-list/page.tsx` — full server-rendered page; PPR lets the shell be instant while schedule data streams

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/teachers/page.tsx`
- Modify: `src/app/scheduled-list/page.tsx`

- [ ] **Step 1: Add PPR opt-in to home page**

In `src/app/page.tsx`, add after the imports (before the `metadata` export):

```ts
export const experimental_ppr = true
```

- [ ] **Step 2: Add PPR opt-in to teachers page**

In `src/app/teachers/page.tsx`, add after the imports (before the `metadata` export):

```ts
export const experimental_ppr = true
```

- [ ] **Step 3: Add PPR opt-in to scheduled-list page**

In `src/app/scheduled-list/page.tsx`, add after the imports (before the `metadata` export):

```ts
export const experimental_ppr = true
```

- [ ] **Step 4: Build and check PPR routes appear**

```bash
npm run build 2>&1 | grep -E "PPR|◐|ppr"
```

Expected: PPR-enabled routes show `◐` symbol in the build output.

- [ ] **Step 5: Start dev server and manually verify home page loads**

```bash
npm run dev
```

Navigate to `http://localhost:3000`. Confirm:
- Page shell appears immediately (nav, layout visible)
- RadioPlayer and schedule stream in (may flash skeleton briefly)
- No hydration errors in browser console

- [ ] **Step 6: Verify teachers page**

Navigate to `http://localhost:3000/teachers`. Confirm:
- Teacher grid renders
- RecommendedTeachers section loads
- No console errors

- [ ] **Step 7: Verify scheduled-list page**

Navigate to `http://localhost:3000/scheduled-list`. Confirm:
- Schedule renders correctly
- No console errors

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx src/app/teachers/page.tsx src/app/scheduled-list/page.tsx
git commit -m "feat: opt home, teachers, and scheduled-list pages into PPR"
```

---

## Phase 3 — Final Verification

### Task 6: Full build + lint check

- [ ] **Step 1: Clean build**

```bash
rm -rf .next && npm run build 2>&1 | tail -30
```

Expected: clean build, no warnings, PPR routes show `◐`.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Run unit tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Confirm no middleware warning**

```bash
npm run build 2>&1 | grep -i middleware
```

Expected: no output (warning gone).
