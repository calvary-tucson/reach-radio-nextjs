---
name: source-faithful-porting
description: Use when porting components from reach-radio-web (Astro 5) to reach-radio-nextjs (Next.js). Ensures visual fidelity by requiring direct source file reading before any code is written.
---

# Source-Faithful Porting

## Overview

Port components from reach-radio-web (Astro 5) to reach-radio-nextjs with **exact visual fidelity**. The core discipline: read the actual rendering source file, not summaries, not plan snippets, not agent paraphrases.

**Announce at start:** "I'm using the source-faithful-porting skill to port [component] from reach-radio-web."

## The Iron Rule

```
NEVER write a single line of JSX without first reading the actual source rendering file.
```

**No exceptions:**
- Not "I remember what it looked like"
- Not "The plan describes it"
- Not "The agent summarized it"
- Not "The query tells me enough"
- Read. The. File.

## Source File Discovery

Astro uses an Island/Content split pattern. You MUST follow the import chain:

```
Page (index.astro)
  └→ *Island.astro (data fetcher — DO NOT COPY THIS)
       └→ *Content.astro (actual rendering — COPY THIS)
```

### Steps

1. **Read the page file** that includes the component (e.g., `src/pages/index.astro`)
2. **Find the import** for the Island component
3. **Read the Island file** — find the Content import inside it
4. **Read the Content file** — THIS is your source of truth for markup and styling
5. If no Island/Content split, the component itself IS the rendering file

## Porting Checklist (Per Component)

**REQUIRED: Use TodoWrite to create a todo for EACH item below.**

- [ ] Read the actual rendering source file (Content.astro or component .astro)
- [ ] Document the layout structure (grid columns, flex direction, spacing)
- [ ] Document all CSS classes and visual treatments (gradients, borders, shadows, opacity)
- [ ] Document conditional rendering and empty states
- [ ] Translate markup to JSX (see Translation Reference below)
- [ ] Compare output JSX class-by-class against source
- [ ] Verify responsive breakpoints match (sm, md, lg, xl)

## Translation Reference

| Astro | Next.js (React 19) |
|---|---|
| `class=` | `className=` |
| `class:list={[...]}` | `cn(...)` from `@/lib/utils` |
| `{#if condition}` | `{condition && ...}` |
| `{#each items as item}` | `items.map(item => ...)` |
| `<img>` | `<Image>` from `next/image` (with `sizes` prop) |
| `<a href="/...">` | `<Link href="/...">` from `next/link` |
| `<a href="https://...">` | `<a target="_blank" rel="noopener noreferrer">` |
| `server:defer` | `<Suspense fallback={<Skeleton />}>` |
| `<slot />` | `{children}` |
| `set:html={raw}` | Use prose styling or structured rendering |
| `transition:name` | CSS View Transitions (if enabled) |
| Astro Actions | Next.js Server Actions (`'use server'`) |
| `client:load` | `'use client'` component |
| `client:visible` | `'use client'` + intersection observer |
| `import.meta.env.PUBLIC_*` | `process.env.NEXT_PUBLIC_*` |
| `import.meta.env.*` (private) | `process.env.*` |
| `.astro` component (no client) | React Server Component (default) |
| `.astro` component (with client) | `'use client'` React component |

## Red Flags — STOP and Re-read Source

- You're writing classes from memory
- You're guessing at grid column counts
- You're using different spacing than the source
- You haven't seen the source file's empty state handling
- You're "improving" the design instead of matching it
- An agent summarized the source instead of you reading it directly

## Common Mistakes

### Trusting plan snippets over source files
- **Problem:** Plans contain approximations, not exact markup
- **Fix:** Plans tell you WHAT to build; source files tell you HOW it looks

### Reading the Island instead of the Content file
- **Problem:** Island files contain data fetching, not rendering markup
- **Fix:** Always follow imports to the Content.astro file

### "Improving" while porting
- **Problem:** Adding design changes during porting creates drift
- **Fix:** Match source FIRST. Improve in a separate commit AFTER verification.

### Delegating source reading to agents
- **Problem:** Agent summaries lose visual details (exact classes, spacing, conditional logic)
- **Fix:** Read rendering files yourself. Use agents only for finding file paths.

## Project Paths

| Project | Root Path |
|---|---|
| Astro source | `/Users/danielmccauley/Documents/Development/reach-radio-web/` |
| Next.js target | `/Users/danielmccauley/Documents/Development/reach-radio-nextjs/` |

## reach-radio-web Structure

```
src/
  pages/          — Astro pages (about/, donate/, speakers/, teachers/, etc.)
  components/
    global/       — shared components (nav, footer, etc.)
    page/         — page-specific components
    pages/        — page section components
  layouts/        — Astro layouts
  utils/          — utility functions
```

## Verification

After porting each component:
1. `npx tsc --noEmit` — type safety
2. `npm run lint` — code quality
3. Visual comparison — open reach-radio-web and reach-radio-nextjs side-by-side
4. Check mobile viewport (375px) and desktop (1280px) at minimum
