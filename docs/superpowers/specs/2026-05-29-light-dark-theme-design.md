# Light/Dark Theme — Design Spec

**Date:** 2026-05-29  
**Status:** Approved  

---

## Overview

Add light and dark theme support to reach-radio-nextjs. The app is currently dark-first; dark mode is the existing design. Light mode is new. Users can choose Light, Dark, or System. A `?theme=` URL param overrides the active theme for testing (works in all environments).

---

## Approach

**Dual custom variant strategy** — both `light:` and `dark:` variants configured in Tailwind v4:

```css
/* globals.css */
@custom-variant dark (&:where(.dark, .dark *));
@custom-variant light (&:where(.light, .light *));
```

- `<html class="dark">` = dark mode
- `<html class="light">` = light mode
- Shadcn components (`/ui/*`) use `dark:` variants internally — untouched, work as designed
- Custom components keep existing dark classes as base, add `light:` overrides only

**Why not conventional (light default + `dark:` variants)?**  
The app has 57 files of working dark markup. Inverting to light-default would require rewriting every file. The dual-variant approach preserves all existing markup and only adds `light:` prefixes for light-mode overrides.

---

## Color Palette

### Light mode overrides (`light:` prefix)

| Token | Dark (base, current) | Light override |
|---|---|---|
| Body background | `bg-[var(--color-brand-purple)]` | `light:bg-white` |
| Header/Nav background | `bg-gray-800` | `light:bg-white` |
| Footer/MediaBar background | `bg-[var(--color-brand-gray)]` | `light:bg-gray-100` |
| Card/surface | `bg-white/5` | `light:bg-gray-50` |
| Surface hover | `bg-white/10` | `light:bg-gray-100` |
| Text primary | `text-white` | `light:text-gray-900` |
| Text secondary | `text-white/60` | `light:text-gray-500` |
| Text muted | `text-white/40` | `light:text-gray-400` |
| Text faint | `text-white/50` | `light:text-gray-400` |
| Text dim | `text-white/80` | `light:text-gray-700` |
| Borders | `border-white/10` | `light:border-gray-200` |
| Header border | `border-green-500/20` | `light:border-gray-200` |
| Input background | `bg-gray-700/50` | `light:bg-gray-100` |
| Input text | (inherits white) | `light:text-gray-900` |
| Green accent | `#84B84F` / `bg-[var(--color-brand-green)]` | unchanged |
| Bottom nav border | `border-green-500` | `light:border-green-600` |

Shadcn components (`button`, `dialog`, `tooltip`, `slider`, `breadcrumb`, `skeleton`) — no changes. They already handle their own dark/light states via `dark:` variants.

---

## Architecture

### New files

**`src/components/theme/ThemeProvider.tsx`** — `'use client'`  
Runtime theme controller. Responsibilities:
- On mount: read `?theme=light|dark|system` URL param
  - If present: set `theme` cookie (1-year, SameSite=Lax), apply class immediately
- Read `theme` cookie (via `document.cookie`)
- If cookie = `system` or absent: listen to `window.matchMedia('(prefers-color-scheme: dark)')`, apply `dark` or `light` class accordingly, update on change
- Apply `dark` or `light` class to `document.documentElement`
- Export `useTheme()` hook returning `{ theme, setTheme }` for ThemeToggle

**`src/components/theme/ThemeToggle.tsx`** — `'use client'`  
User-facing control placed in the site footer. Three options: Light / Dark / System. On selection: calls `setTheme()` from `useTheme()`, which sets cookie and applies class immediately. Shows active indicator on current selection. Uses sun/moon/monitor icons (lucide-react, already a dep).

**`src/app/api/theme/route.ts`**  
`POST { theme: 'light' | 'dark' | 'system' }` — sets `theme` cookie on the response. Used as a fallback server-side cookie setter if needed. ThemeToggle primarily sets cookies client-side for instant response; this route is available for server-action patterns.

### Modified files

**`src/app/layout.tsx`**  
- Import `ThemeProvider`, wrap body children
- Read `theme` cookie from request `headers()` server-side
- Resolve initial class: cookie=`dark` → `"dark"`, cookie=`light` → `"light"`, cookie=`system`/absent → `""` (client resolves)
- Set `<html className={initialThemeClass}>` to eliminate flash of wrong theme

**`src/app/globals.css`**  
Add dual custom variant declarations after `@import "tailwindcss"`.

**`src/components/layout/Footer.tsx`**  
Add `<ThemeToggle />` component.

**All custom components with hardcoded dark colors** (~57 files)  
Add `light:` override classes per the palette table above. This is mechanical and safe — no dark classes removed, only light overrides added.

---

## Theme Resolution Order

Highest priority first:

1. `?theme=` URL param → sets cookie, overrides everything
2. `theme` cookie → persists across sessions (1-year expiry)
3. Native app context → always `dark` (see below)
4. `prefers-color-scheme` media query → used when cookie = `system` or absent
5. Fallback default → `dark` (app is dark-first)

### Native app default

The mobile native app (iOS/Android webview) expects dark theme. When `isMobileApp` is true (detected via `mobile-app` header/cookie in `layout.tsx`):

- Server resolves initial class as `"dark"` regardless of system preference
- `ThemeProvider` detects `document.body.dataset.app === 'true'` and skips `prefers-color-scheme` media query — defaults to dark if no cookie is set
- `ThemeToggle` is not rendered in mobile app context (footer is hidden in app mode)
- A `?theme=` URL param still works in app context for dev testing

---

## SSR Flash Prevention

Server reads `theme` cookie from request headers and sets initial `className` on `<html>` before sending HTML. For mobile app requests with no cookie, server defaults to `"dark"`. Client `ThemeProvider` hydrates and takes over. Result: zero flash on page load for returning users. First-time web visitors (no cookie) get system preference handled client-side — one paint cycle, acceptable.

---

## ThemeToggle UI

Placed in footer. Three buttons in a pill/segmented control:
- ☀ Light
- ☾ Dark  
- ⊙ System

Active state: green accent underline or filled background. Accessible labels. `cursor-pointer` on all buttons per project UI rules.

---

## URL Param Behavior

`?theme=light`, `?theme=dark`, `?theme=system`

- Works in all environments (dev + prod)
- Sets `theme` cookie on load — param only needs to be present once
- Useful for sharing theme previews or support debugging
- `ThemeProvider` reads `useSearchParams()` on mount

---

## Out of Scope

- Per-page theme overrides
- High-contrast / accessibility modes
- Animated theme transition
- Theme sync across browser tabs (can be added later via storage event)
