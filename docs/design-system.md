# Reach Radio — Design System

Derived from the teachers pages (the most complete implementation). Apply these patterns site-wide.

---

## Color Palette

| Role | Value |
|---|---|
| Page background | `oklch(24% 0.05 280)` (`var(--color-brand-purple)`) |
| Card surface | `#1c2128` |
| Sheet / panel surface | `#0f1a0a` |
| Avatar fallback gradient | `from-[#2d4a1a] to-[#1a2d0f]` |
| Accent green | `#84b84f` (`var(--color-brand-green)`) |
| Green tint bg | `rgba(132,184,79,0.08)` – `rgba(132,184,79,0.15)` |
| Green tint border | `rgba(132,184,79,0.18)` – `rgba(132,184,79,0.3)` |
| Card border | `border-white/5` or `border-white/10` |
| Dividers | `border-white/6` or `border-white/8` |

### Text Opacity Scale

Step down through this scale: name → subtitle → label → secondary → placeholder → decorative.

`text-white` → `/80` → `/60` → `/55` → `/50` → `/45` → `/40` → `/35`

---

## Typography

| Use | Classes |
|---|---|
| Page `<h1>` | `text-[22px] md:text-4xl font-extrabold text-white tracking-tight` |
| Detail panel name | `text-[19px] md:text-[28px] font-extrabold tracking-tight` |
| Card name | `text-[13px] md:text-sm font-bold text-white leading-snug` |
| Card subtitle | `text-[11px] md:text-xs text-white/80` |
| Section label (allcaps) | `text-[10px] md:text-[12px] font-bold uppercase tracking-[0.08em] text-white/55` |
| Filter section label | `text-[10px] font-semibold uppercase tracking-widest text-white/60` |
| Body / result count | `text-sm text-white/60` |
| Empty state | `text-sm text-white/45 py-12` |

---

## Spacing & Layout

- **Page container:** `px-4 md:px-8 py-6 max-w-screen-xl mx-auto`
- **Panel inner padding:** `px-4 md:px-6`
- **Card grid:** `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[9px] md:gap-3`
- **Card content pad:** `px-[11px] md:px-3 pt-[9px] md:pt-3 pb-[11px] md:pb-3`
- **Section gap:** `mb-3` to `mb-6`, `space-y-4` between filter sections

---

## Border Radius

| Element | Radius |
|---|---|
| Cards (grid) | `rounded-[18px]` |
| List rows / inputs | `rounded-xl` |
| Bottom sheet | `rounded-t-2xl` (mobile), `rounded-l-2xl` (desktop) |
| Callout / stat boxes | `rounded-[12px]` |
| Chips / pills | `rounded-full` |
| Schedule time slots | `rounded-r-[8px]` (left accent bar, no left radius) |

---

## Core Surfaces

### Card (grid item)
```
bg-[#1c2128] border border-white/5 rounded-[18px] overflow-hidden
```

### List row
```
bg-white/5 border border-white/10 rounded-xl
```

### Accent callout
```
bg-[rgba(132,184,79,0.08)] border border-[rgba(132,184,79,0.18)] rounded-[12px]
```

### Divider
```html
<div className="h-px bg-white/6 mx-4 md:mx-6" />
```

---

## Components

### Chip / Filter Pill

Min 44px tap target. `aria-pressed` for toggles.

```
min-h-[44px] flex items-center rounded-full px-3 text-xs font-medium border transition-colors cursor-pointer
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50
```

Active (accent):
```
bg-[rgba(132,184,79,0.15)] border-[rgba(132,184,79,0.3)] text-[#84b84f]
```

Inactive:
```
bg-white/5 border-white/10 text-white/60 can-hover:hover:border-white/20 can-hover:hover:text-white/80
```

### Info Chip (badge/tag)

```tsx
// accent variant
bg-[rgba(132,184,79,0.1)] border border-[rgba(132,184,79,0.2)] text-[#84b84f]

// dim variant
bg-white/5 border border-white/10 text-white/50
```

Both: `inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold`

### Passive Search Bar (tappable, navigates to search page)

```
flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3
transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer
```

### Active Search Input

```
w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-2.5 text-sm text-white
placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20
```
Search icon left-inset (`left-3`), clear/spinner right-inset (`right-2`).

### Tabs (underline style)

```
px-4 py-2 text-sm font-semibold capitalize transition-colors cursor-pointer border-b-2 -mb-px
```
Active: `text-[#84b84f] border-[#84b84f]`
Inactive: `text-white/55 border-transparent hover:text-white/75`

Tab container: `flex gap-1 mb-5 border-b border-white/7`

### Primary CTA Button (inside panel)

Mobile (detail page, `md:hidden`) — solid green with tighter padding than desktop:
```
bg-[#84b84f] rounded-full px-4 py-2 text-sm font-bold text-[#0a1305]
hover:bg-[#96cc5e] transition-colors cursor-pointer
```

Desktop — solid green:
```
bg-[#84b84f] rounded-full px-5 py-2 text-sm font-bold text-[#0a1305]
hover:bg-[#96cc5e] transition-colors cursor-pointer
```

---

## Sheet / Modal Chrome

**Mobile:** bottom sheet
- `fixed inset-0 flex items-end` backdrop (`role="presentation"`, click-outside dismisses)
- Panel: `max-h-[92dvh] rounded-t-2xl border border-white/[0.08] bg-[#0f1a0a]`
- Drag handle + X button in header
- Swipe-to-dismiss via touch events
- Scroll area: `flex-1 min-h-0 overflow-y-auto pb-20` (pb-20 clears mobile nav)
- Entry: `animate-[modal-slide-up_0.2s_cubic-bezier(0.32,0.72,0,1)]`
- Exit: `animate-[modal-slide-down_0.15s_ease-in_forwards]`

**Desktop (md+):** right panel
- `md:h-full md:w-[480px] md:rounded-none md:rounded-l-2xl md:border-y-0 md:border-r-0 md:border-l`
- X button top-right, no drag handle
- Entry: `animate-[panel-slide-in_0.25s_cubic-bezier(0.32,0.72,0,1)]`
- Exit: `animate-[panel-slide-out_0.15s_ease-in_forwards]`

### Detail Panel Content Layout

1. Decorative banner (`h-[100px] md:h-[180px]`, dark green gradient + stripe + radial glow)
2. Avatar overlapping banner (`mt-[-88px]` on both breakpoints), beside primary CTA
3. Name (`font-extrabold`) + subtitle (`text-white/50`)
4. Info chips row
5. Secondary links row (ghost pills)
6. `h-px bg-white/6` divider
7. Allcaps section label + schedule rows

---

## Horizontal Scroll + Fade Mask

Used on recommended items, filter chips, day tabs — any horizontal scroller:

```tsx
// Scroll container
className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

// Fade mask overlay (mobile only, inside a relative parent)
<div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[oklch(24%_0.05_280)] to-transparent md:hidden" />
```

---

## Avatar

Sizes: `xs(24)` `sm(38)` `md(48)` `lg(72)` `xl(80)` `2xl(128)` `3xl(176)` px

Shapes: `circle` (`rounded-full`) or `rounded` (size-scaled radius)

Variants:
- Plain: fixed width/height box
- `ring`: `box-shadow: 0 0 0 3px #111318, 0 0 0 5px rgba(132,184,79,0.35)` (green glow + dark separator)
- `fill`: `absolute inset-0`, fills a `relative aspect-square` parent

Fallback (no photo): initials centered, `text-[rgba(132,184,79,0.8)] font-bold`, on `from-[#2d4a1a] to-[#1a2d0f]` gradient.

---

## Interactive States

| Pattern | Classes |
|---|---|
| Card hover (scale) | `motion-safe:hover:scale-[1.03] transition-all duration-200` |
| Row / surface hover | `hover:bg-white/10 hover:border-white/20 transition-colors` |
| All clickables | `cursor-pointer` — explicit, always |
| Disabled | `cursor-not-allowed` |

---

## Stagger Entry Animation

Apply `--stagger-i` to indexed items (cards, list rows):

```tsx
style={{ '--stagger-i': index } as React.CSSProperties}
```

CSS applies `animation-delay: calc(var(--stagger-i, 0) * 35ms)` on `.teacher-card` class.

---

## Loading States

Skeleton: `h-[N]px rounded-xl bg-white/5 animate-pulse` on placeholder blocks.
Container: `aria-busy="true"`.

---

## Accessibility Checklist

| Pattern | Implementation |
|---|---|
| Interactive label | `aria-label` with full context on wrapper elements |
| Decorative icons | `aria-hidden="true"` — universal rule |
| Toggle buttons | `aria-pressed` |
| Tab UI | `role="tablist"` + `role="tab"` + `aria-selected` |
| Live regions | `aria-live="polite" aria-atomic="true"` on dynamic result counts |
| Loading | `aria-busy="true"` on skeleton containers |
| Filter groups | `role="group" aria-label="..."` |
| Modal backdrop | `role="presentation"` |
| Skip link | `sr-only focus:not-sr-only` in root layout |
| Keyboard dismiss | Sheet drag handle responds to Enter / Space |
| Focus rings | Cards: `ring-2 ring-white`. Chips: `ring-white/50`. Inputs: `ring-white/20` |
| Motion | All animations prefixed `motion-safe:` |
| Touch targets | `min-h-[44px]` on all tappable chips / buttons |

---

## View Transitions

- Shared-element on avatar: `<ViewTransition name="item-{slug}" />`
- Forward nav hint on card links: `transitionTypes={['nav-forward']}`
- Panel enter/exit: CSS keyframes `modal-slide-up/down` + `panel-slide-in/out`

---

## Quick Token Reference

```
Card:       bg-[#1c2128] border border-white/5 rounded-[18px]
Row:        bg-white/5 border border-white/10 rounded-xl
Callout:    bg-[rgba(132,184,79,0.08)] border border-[rgba(132,184,79,0.18)] rounded-[12px]
Chip:       rounded-full min-h-[44px] — accent or dim variant
Section:    text-[10px] font-bold uppercase tracking-[0.08em] text-white/55
Focus:      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
Motion:     motion-safe: prefix on all animations
Cursor:     cursor-pointer on every interactive element
```
