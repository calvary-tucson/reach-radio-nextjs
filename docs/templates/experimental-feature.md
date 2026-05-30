# Experimental Feature Checklist: [Flag Name]

> Complete this before enabling any `experimental.*` flag in `next.config.ts`.
> Experimental flags in Next.js 16 can break dynamic routes, middleware, and streaming.
> This checklist enforces a structured enable → test → benchmark → merge flow.

## Existing Active Flags

This project already enables these experimental flags. **Any new flag must be tested for interaction with all of these:**

| Flag | Enabled since | Risk if combined |
|------|--------------|-----------------|
| `cacheComponents` | v1 rollout | May double-cache components using `use cache` |
| `reactCompiler` | opt-in | Can reorder effects — test all timers and subscriptions |
| `viewTransition` | opt-in | Interferes with some streaming patterns |

## Pre-flight

- [ ] Read the relevant Next.js 16 guide: `node_modules/next/dist/docs/[topic].md`
- [ ] Identify every route that will be affected (list them below)
- [ ] Confirm a rollback commit is ready (see Rollback section)
- [ ] Create a feature branch or worktree — do NOT enable directly on main

## Affected Routes

List every page, layout, API route, and middleware that may behave differently:

- `src/app/...`
- `src/app/api/...`

## Incompatibility Risk

| Risk | Mitigation |
|------|-----------|
| Dynamic routes with `force-dynamic` | Check each route — may need Suspense wrap |
| Middleware | Test cookie setting and redirects explicitly |
| Streaming / SSE | Verify SSE route still streams, not buffered |
| `revalidate` exports | Remove — incompatible with `use cache` |

## Rollback Commit

Before enabling, create a rollback commit on a separate branch so it can be applied instantly under pressure:

```bash
# 1. Note your current commit SHA
git rev-parse HEAD

# 2. If flag was added in the same commit, revert it:
git revert HEAD --no-edit

# 3. If the flag was added separately, cherry-pick just the revert:
git diff <sha-before-flag> <sha-after-flag> -- next.config.ts | git apply -R

# 4. To apply rollback immediately (emergency):
git checkout main -- next.config.ts && npm run build
```

**Verify rollback is ready before enabling the flag.**

## Benchmark (run before and after)

```bash
# Build and measure
npm run build 2>&1 | grep -E "(Route|Size|First Load)"
```

Paste before/after build output here.

### Pass/Fail Threshold

| Metric | Baseline | Max allowed regression |
|--------|---------|------------------------|
| First Load JS (main route) | ___ kB | +5 kB |
| Build time | ___ s | +20% |
| Route count | ___ | 0 (no routes should disappear) |

If any metric exceeds its threshold: **do not merge — investigate before proceeding.**

## Test Checklist (run after enabling)

- [ ] `npx vitest run` — all unit tests pass
- [ ] `npx playwright test` — all E2E tests pass
- [ ] Home page loads and audio streams
- [ ] Teachers page loads with correct data
- [ ] Teacher detail modal opens
- [ ] SSE now-playing updates arrive (watch Network tab)
- [ ] Native bridge: `mobile-app` cookie sets on first load
- [ ] Sanity revalidate webhook fires correctly
- [ ] API routes that use `x-webhook-secret` auth — verify header is still validated (curl with and without header)
- [ ] SSE route streams chunked: open Network tab → SSE endpoint → confirm "Transfer-Encoding: chunked" and data arrives incrementally, not buffered
- [ ] Native bridge: `mobile-app` cookie persists across page navigations (test in WebView or simulate via `document.cookie`)

## Merge Criteria

All checklist items above must be checked. If any fail: revert to the rollback commit, document what broke in this file, and open a new plan to address the incompatibility before re-enabling.
