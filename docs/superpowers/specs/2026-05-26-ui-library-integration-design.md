# UI Library Integration — Design Spec

**Date:** 2026-05-26  
**Status:** Approved

## Goal

Bring the UI/UX library stack from `calvarytucson-nextjs` into `reach-radio-nextjs` to eliminate hand-rolled primitives, reduce inline SVG noise, and establish a consistent component foundation.

---

## Packages

### Runtime dependencies

| Package | Version (match calvary) | Purpose |
|---|---|---|
| `lucide-react` | `^1.7.0` | Icon set — replaces all non-nav inline SVGs |
| `@radix-ui/react-slider` | `^1.3.6` | Accessible slider for VolumeControl |
| `@radix-ui/react-tooltip` | `^1.2.8` | Tooltip primitives for player controls |
| `@radix-ui/react-slot` | `^1.2.4` | `asChild` composition for Button |
| `@radix-ui/react-dialog` | `^1.1.15` | Foundation primitive (no immediate rewrites) |
| `@radix-ui/react-tabs` | `^1.1.13` | Foundation primitive (no immediate rewrites) |
| `@radix-ui/react-dropdown-menu` | `^2.1.16` | Foundation primitive (no immediate rewrites) |
| `class-variance-authority` | `^0.7.1` | Typed variant system for Button |
| `sonner` | `^2.0.7` | Toast notifications |

### Dev dependencies

| Package | Purpose |
|---|---|
| `shadcn` | Component scaffolding CLI |
| `tw-animate-css` | Tailwind animation utilities |

---

## New files

### `src/components/ui/button.tsx`

CVA-based Button primitive with `asChild` support via `@radix-ui/react-slot`.

**Variants:**
- `variant`: `primary` (brand-green bg), `secondary` (gray-700 bg), `ghost` (transparent), `destructive` (red-600 bg)
- `size`: `sm`, `md`, `lg`

All variants include `cursor-pointer`; disabled state adds `cursor-not-allowed opacity-50`.

### `src/components/ui/slider.tsx`

Thin Radix Slider wrapper. White track/thumb for use on dark backgrounds (media bar). Accepts all `SliderPrimitive.Root` props via forwarded ref.

### `src/components/ui/tooltip.tsx`

Radix Tooltip wrapper with `TooltipProvider`, `Tooltip`, `TooltipTrigger`, and `TooltipContent` exported. Default side: `top`, delay: `500ms`. Dark bg (`bg-gray-800 text-white`) to match app theme.

### `src/components/ui/dialog.tsx`

Radix Dialog wrapper — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` exported. No immediate consumers; provides foundation for future feature work.

---

## Component changes

### `src/app/globals.css`

Add at top:
```css
@import 'tw-animate-css';
```

### `src/app/layout.tsx`

Add `<Toaster richColors position="top-center" />` from `sonner` inside the body.

### `src/components/home/VolumeControl.tsx`

- Replace `<input type="range">` with `<Slider>` from `src/components/ui/slider.tsx`
- Replace custom `VolumeIcon` SVG component with lucide icons: `VolumeX` (muted/0), `Volume` (1–33), `Volume1` (34–66), `Volume2` (67–100)
- Slider value: `[volume]`, `onValueChange: ([v]) => setVolume(v)`, `min=0 max=100`

### `src/components/home/SleepTimerButton.tsx`

- Replace clock SVG with lucide `Clock` icon (`w-5 h-5 text-white`)
- Wrap button in `<Tooltip>` with content "Sleep Timer"

### `src/components/home/SleepTimerSheet.tsx`

- Replace close button SVG with lucide `X` (`w-5 h-5`)
- No other changes — custom drag logic, animation, and portal stay as-is

### `src/components/media-bar/PlayPauseButton.tsx`

- Replace custom play SVG with lucide `Play` (`fill-white`)
- Replace custom pause SVG with lucide `Pause` (`fill-white`)
- Buffering spinner stays as-is

### `src/components/global/SearchInput.tsx`

- Replace search SVG with lucide `Search`
- Replace clear button SVG with lucide `X`

### `src/components/icons/ArrowLeftIcon.tsx`

- Delete file
- Update `src/app/teachers/[slug]/page.tsx` to import lucide `ArrowLeft` directly

### `src/components/about/ContactForm.tsx`

- Remove inline `{state.success && <p>...}` and `{state.error && <p>...}` elements
- On success: `toast.success('Message sent! We\'ll be in touch.')`
- On error: `toast.error(state.error)`
- Remove `errorRef` and `tabIndex`/`focus()` logic (sonner handles focus)
- Keep `state.success` check in `useEffect` for form reset

---

## What stays unchanged

- `MobileNav.tsx` — Google Material SVG icons preserved (visual identity)
- `SleepTimerSheet.tsx` drag logic — `useSheetDrag` hook untouched
- `SleepTimerSheet.tsx` portal/animation — CSS transitions stay
- Radix Dialog/Tabs/Dropdown — installed, no rewrites against them

---

## File count

- **New:** 4 (`button.tsx`, `slider.tsx`, `tooltip.tsx`, `dialog.tsx`)
- **Modified:** 9 (`globals.css`, `layout.tsx`, `VolumeControl.tsx`, `SleepTimerButton.tsx`, `SleepTimerSheet.tsx`, `PlayPauseButton.tsx`, `SearchInput.tsx`, `ContactForm.tsx`, `teachers/[slug]/page.tsx`)
- **Deleted:** 1 (`ArrowLeftIcon.tsx`)
