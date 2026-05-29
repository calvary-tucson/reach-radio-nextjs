# Next.js 16 Alignment — Design Spec

**Date:** 2026-05-29  
**Project:** reach-radio-nextjs  
**Goal:** Align with Next.js 16 best practices across three phases — correctness, performance (PPR), and UX.

---

## Architecture Overview

Shift from "each page is fully static or fully dynamic" to "each page has a static shell with dynamic holes."

```
Current:                     Target (PPR):
────────────────             ─────────────────────────────
Page (dynamic)          →    Static shell (instant SSG)
  └─ entire page               ├─ Nav, layout, content
     re-evaluates               └─ <Suspense> dynamic holes
     on every request               ├─ Live stream bar
                                    ├─ Now playing widget
                                    └─ Sleep timer (client-only)
```

Both web and mobile webview users benefit equally: faster static shells, correct dynamic content streamed in.

---

## Phase 1 — Correctness

Prerequisites for PPR. All changes are mechanical.

### 1. Rename `middleware.ts` → `proxy.ts`

`src/middleware.ts` → `src/proxy.ts`

Next.js 16 deprecated the `middleware` file convention in favor of `proxy`. Logic is identical — mobile-app cookie detection and setting. No behavior change.

### 2. Bump `eslint-config-next`

`16.2.4 → 16.2.6` to match the installed Next.js version.

### 3. Audit experimental flags

Check if `viewTransition` and `useCache` have graduated to stable in Next.js 16 by reading the Next.js 16 changelog/docs. If stable, move out of `experimental: {}`. `serverComponentsHmrCache` stays experimental.

### 4. Migrate `unstable_cache` → `use cache`

`src/lib/sanity/client.ts` uses `unstable_cache`. Migrate to:

- `'use cache'` directive at the function level
- `cacheTag('sanity')` for invalidation targeting
- `cacheLife('hours')` for revalidation window

This is the caching primitive PPR depends on for correct behavior.

### 5. Align revalidation route

`/api/revalidate/route.ts` currently calls `revalidatePath`. Change to `revalidateTag('sanity')` to align with the new cache tagging strategy. Coarser but correct — invalidates all Sanity-tagged cache entries on webhook trigger.

---

## Phase 2 — Partial Pre-rendering (PPR)

### Enable PPR

Add to `next.config.ts`:
```ts
experimental: {
  ppr: true,
  // ...existing flags
}
```

Opt in per-route with:
```ts
export const experimental_ppr = true
```

### Route breakdown

| Route | Static shell | Dynamic hole | PPR needed |
|---|---|---|---|
| `/` | Layout, hero, schedule list | Live stream bar, now playing | Yes |
| `/teachers` | Teacher grid | None | No (fully static) |
| `/teachers/[slug]` | Bio, episode list, all content | None | No (fully static) |
| `/scheduled-list` | Page chrome | Schedule data (changes daily) | Yes |
| `/about` | Full page | None | No |
| `/donate` | Full page | None | No |
| `/sleep-timer` | N/A | Full client page | No |

### Suspense boundaries

Wrap dynamic components in `<Suspense fallback={<Skeleton />}>`. Use existing skeleton components as fallbacks — they are already present in the codebase.

Dynamic components that become Suspense leaves:
- Live stream bar / now playing widget (home page)
- Schedule data fetcher (scheduled-list page)

### Sanity fetch caching

All Sanity data fetches:
- Add `'use cache'` directive
- Tag with `cacheTag('sanity')`
- Set `cacheLife('hours')` (or `'days'` for teacher bios)

### Mobile bridge compatibility

`BridgeInit.tsx` reads the `mobile-app` cookie set by the proxy (server-side). PPR static shells render server-side, so the cookie is available at shell render time. No bridge changes required.

---

## Phase 3 — UX

### View Transitions

`viewTransition: true` already enabled. Next.js 16 handles client-side navigation transitions automatically. Work required:

- Add `viewTransitionName` CSS to teacher cards and teacher detail page header
- Enables shared-element transition: card thumbnail → detail hero image
- Opt-in per element, not global

### SSE live stream

`/api/stream-info-sse` provides live "now playing" data. With PPR:
- The SSE consumer component lives inside a `<Suspense>` hole on the home page
- Stream in after static shell — no API changes needed
- Ensure SSE client component is the Suspense leaf, not a wrapper

### `@modal` parallel route

Parallel routes are PPR-compatible. The modal slot renders independently. Existing structure is correct — no changes.

### `/sleep-timer`

Fully client-driven. Already isolated in `SleepTimerClient.tsx`. Leave as-is.

---

## Testing Strategy

| Phase | Verification |
|---|---|
| Phase 1 | `npm run build` passes with zero deprecation warnings; `npm run lint` clean |
| Phase 2 | `next-browser ppr lock` to verify static shells; mobile bridge cookie check |
| Phase 3 | View transition smoke test on teacher card → detail navigation |
