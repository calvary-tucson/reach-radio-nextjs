# Next.js Upgrade — Version Comparison + Instant Navigations Adoption Plan

**Current:** `next@16.2.6`, `react@19.2.6`, `react-dom@19.2.6` (installed, per `package.json` / `node_modules/next/package.json`)
**Latest stable (npm, verified 2026-07-06):** `16.2.10`
**Latest preview:** `16.3.0-preview.5`
**Latest canary:** `16.3.0-canary.78`

Existing config already has: `reactCompiler: true`, `cacheComponents: true` (PPR Phase 2 done — see `2026-05-29-ppr-cache-components.md`). PPR Phase 3 (cache invalidation) is queued next in `GO-TO-PRODUCTION.md` Step 3, blocked on Vercel deploy (Step 2).

---

## Part 1 — Stable patch bump (16.2.6 → 16.2.10)

Not a migration, a patch bump. No breaking changes between patch releases in a minor line.

- [ ] `npm install next@16.2.10 react@latest react-dom@latest`
- [ ] `npm run build` — confirm all `◐` (PPR) routes unchanged
- [ ] `npm run lint && npx tsc --noEmit`
- [ ] Smoke-test locally (home, teachers list/detail, search sheet, donate)

Low risk. Do this regardless of the decision in Part 2.

---

## Part 2 — The actual decision: Next.js 16.3 "Instant Navigations"

This is the feature the user heard about. **It is Preview, not stable** (`npm install next@preview`, currently `16.3.0-preview.5`; canary is further ahead at `16.3.0-canary.78` and less stable still). Vercel has flagged known issues and has not set a stable-release date.

### What it does

Ships on top of the `cacheComponents` flag this project already has enabled:

- **Stream/Cache/Block model** — every route's data-fetch must be explicitly one of: `<Suspense>` (stream), `'use cache'` (cache), or `export const instant = false` (block, opt out). Un-annotated slow fetches become **dev-time errors**, not warnings.
- **Partial Prefetching** (`partialPrefetching: true`, new flag) — replaces "prefetch every link" with "prefetch one reusable shell per route," cached client-side and reused across links. Reduces prefetch request volume; per-link full prefetch still available via `<Link prefetch={true}>`.
- **Instant Insights** — new dev-overlay panel that flags any navigation that isn't instant, i.e. any route awaiting uncached data outside Suspense/`'use cache'`.
- **Navigation Inspector** — devtools panel to pause a navigation at the shell and inspect what was prefetched.
- **`instant()` Playwright helper** (`@next/playwright`) — asserts what must render before network response. Project already has `@playwright/test` — would need the companion `@next/playwright` package.
- **Agent skill** — Vercel ships `skills/next-cache-components-adoption` to walk an agent through adoption; relevant since this project's cacheComponents adoption was itself agent-driven (Phase 2/3 plans).

### Why it's relevant to this project specifically

- Already 100% bought into `cacheComponents` — this is the direct sequel to that work, not a tangent.
- Site is modal/sheet-heavy (`@modal/(...)teachers/[slug]`, search sheet, teacher panels) — exactly the kind of app where SPA-like instant navigation reads as a win, since users are clicking in and out of detail panels constantly.
- Pre-launch (no production traffic yet) is the cheapest possible time to eat Preview-channel risk — there's no live user experience to regress.

### Why it's risky right now

- **Preview channel, not stable.** No committed stable date. Known issues include Safari-specific dev-tooling bugs and Instant Insights false-negatives with Partial Prefetching + params access.
- **Triple-stacking experimental flags** — `reactCompiler` + `cacheComponents` + `partialPrefetching` simultaneously is a combination with no known production deployments yet (all three are experimental/new independently).
- **Instant Insights turns un-instant routes into dev errors.** Every route needs an explicit Stream/Cache/Block decision before this ships without noise — this is an audit task, not a config flip. Given PPR Phase 3 (per-slug cache tags) isn't even done yet, some routes likely aren't cache-tagged correctly today and would immediately flag.
- **Intercepting/parallel routes are undocumented territory.** The 16.3 blog post doesn't address how shells interact with `@modal/(...)teachers` style intercepted routes — this project's core navigation pattern. Needs hands-on verification, not an assumption it "just works."
- **Blocks the go-live sequence if it destabilizes anything** — `GO-TO-PRODUCTION.md` already has Phase 3 (cache invalidation) as a hard prerequisite for launch. Bolting an unrelated Preview-channel feature onto that critical path adds risk to the thing actually blocking launch.

### Recommendation

Do **not** fold this into the current go-live path. Sequence it as an explicit, separate, opt-in phase:

1. Finish `GO-TO-PRODUCTION.md` Steps 2–4 (Vercel deploy → PPR Phase 3 → go-live) on stable `16.2.10` — unrelated to Instant Navigations, no reason to block launch on a Preview feature.
2. After launch is stable, **trial Instant Navigations on a branch**, not `main`:
   - `npm install next@preview`
   - Enable `partialPrefetching: true` alongside existing `cacheComponents: true`
   - Run `npm run dev`, click through search sheet + teacher detail modal + teacher list, watch Instant Insights for un-instant routes
   - Specifically verify: does `@modal/(...)teachers/[slug]` intercepted route get its own shell, or does it inherit the parent list's shell incorrectly?
3. If it's stable in that trial and Vercel ships a stable `16.3.0` release, upgrade for real. Don't ship on Preview to production.
4. If adopting: install `@next/playwright`, add `instant()` assertions for the teacher-detail and search-sheet navigations as regression coverage (this project already has the Playwright infra to support it).

### Effort estimate if pursued

- Audit pass (Instant Insights sweep across all routes, decide Stream/Cache/Block per route): 0.5–1 day, scales with how many routes currently fetch uncached data outside Suspense.
- Intercepting-route verification (modal/search sheet shells): 0.5 day, unknown-territory risk buffer.
- Playwright `instant()` coverage: 0.5 day.
- Total: ~1.5–2 days, after launch, not blocking it.

---

## Summary table

| Path | Version | Channel | Risk | Verdict |
|---|---|---|---|---|
| Patch bump | 16.2.6 → 16.2.10 | stable | low | Do now, independent of everything else |
| Instant Navigations | 16.3.0-preview.5 | preview | medium-high (pre-stable, triple experimental stack, unverified with intercepted routes) | Trial post-launch on a branch, not on the critical path to go-live |
