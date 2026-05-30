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

## Open Questions (resolve before implementing)

- [ ] Question 1
- [ ] Question 2

---

**Sign-off:** Do not begin implementation until all open questions are resolved and this doc is committed.
