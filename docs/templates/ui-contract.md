# UI Contract: [Feature Name]

> Fill this out and get agreement BEFORE dispatching any implementation agents.
> This doc is the source of truth. Agents read it. Don't implement until it's complete.

## Component Hierarchy

```
[FeaturePage] (server)
  └─ [FeatureShell] (server — static shell for PPR)
       └─ [FeatureContent] (server — fetches data, wrapped in Suspense)
            └─ [FeatureClient] (client — if event handlers needed)
```

## State Ownership

| State | Lives in | Why |
|-------|----------|-----|
| e.g. selected tab | URL param | shareable, no JS needed |
| e.g. sheet open | Zustand modal store | cross-component, client-only |

## Mobile Layout (< md)

[Describe or ASCII-sketch the mobile layout]

## Desktop Layout (≥ md)

[Describe or ASCII-sketch the desktop layout]

## Routes Involved

| Route | Type | Notes |
|-------|------|-------|
| `/feature` | page | - |
| `/@modal/(...)feature` | intercepting route | opens as sheet |

## Data Sources

| Data | Sanity query | Cache strategy |
|------|-------------|----------------|
| e.g. teacher list | `teachersListQuery` | `use cache`, tag: `teachers` |

## Scope Name for Commits

`scope-name` (from AGENTS.md canonical scope table)

## A11y Requirements

> These are build-time requirements (from AGENTS.md), not review-time suggestions.

- [ ] Every `<div>` acting as button has `role="button"` + `tabIndex={0}` (or use native `<button>`)
- [ ] Every icon-only button has `aria-label`
- [ ] Every form input has `<label>` or `aria-label`
- [ ] Mobile interactive elements: min `h-11 w-11` (44px touch target)
- [ ] Text on dark surfaces: `text-white/90` minimum — never `text-white/50` for readable content
- [ ] All interactive elements: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`
- [ ] All clickables: `cursor-pointer`. Disabled: `cursor-not-allowed`
- [ ] All animations wrapped in `motion-safe:` variant

## Loading & Error States

| Component | Suspense fallback | Error boundary? | Notes |
|-----------|------------------|-----------------|-------|
| e.g. FeatureContent | `<FeatureSkeleton />` | Yes — `<FeatureErrorBoundary />` | - |

- Use `use cache` + Suspense for server components that fetch data
- Wrap client boundaries in `<ErrorBoundary>` from `react-error-boundary`

## Caching & Revalidation

| Component | `use cache`? | Sanity revalidate tag | TTL |
|-----------|-------------|----------------------|-----|
| e.g. FeatureContent | Yes | e.g. `teachers` | - |

- Does this feature require a **new tag in `TAG_MAP`** in `src/app/api/revalidate/route.ts`?
  - [ ] Yes — add it before implementing
  - [ ] No — existing tags cover it

## Open Questions (resolve before implementing)

- [ ] Does this feature need a new Sanity revalidation tag in TAG_MAP?
- [ ] Question 1
- [ ] Question 2

---

**Sign-off:** Do not begin implementation until all open questions are resolved and this doc is committed.
