# Experimental Feature Checklist: [Flag Name]

> Complete this before enabling any `experimental.*` flag in `next.config.ts`.
> Experimental flags in Next.js 16 can break dynamic routes, middleware, and streaming.
> This checklist enforces a structured enable → test → benchmark → merge flow.

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

Before enabling, stage this rollback but do NOT commit it yet:

```bash
# In a separate terminal — keep this ready
git diff HEAD -- next.config.ts  # should show only the flag removal
```

## Benchmark (run before and after)

```bash
# Build and measure
npm run build 2>&1 | grep -E "(Route|Size|First Load)"
```

Paste before/after build output here.

## Test Checklist (run after enabling)

- [ ] `npx vitest run` — all unit tests pass
- [ ] `npx playwright test` — all E2E tests pass
- [ ] Home page loads and audio streams
- [ ] Teachers page loads with correct data
- [ ] Teacher detail modal opens
- [ ] SSE now-playing updates arrive (watch Network tab)
- [ ] Native bridge: `mobile-app` cookie sets on first load
- [ ] Sanity revalidate webhook fires correctly

## Merge Criteria

All checklist items above must be checked. If any fail: revert to the rollback commit, document what broke in this file, and open a new plan to address the incompatibility before re-enabling.
