# Drag-to-Dismiss — Unified System Design

**Date:** 2026-06-15  
**Scope:** `useSheetDrag`, `DragHandle`, `BottomSheet`, `SheetChrome`, `TeacherPanelChrome`, `ModalSkeleton`

---

## Problem

Three sheet surfaces all use `useSheetDrag` but wire it inconsistently:

| Surface | Touch | Mouse | Desktop guard | Semantic handle | Animation compat |
|---|---|---|---|---|---|
| `BottomSheet` | ✅ | ✅ | n/a | ❌ div | ✅ (transition) |
| `SheetChrome` | ✅ | ❌ | n/a | ✅ button | ✅ (fixed today) |
| `TeacherPanelChrome` | ✅ | ❌ | ❌ no tablet swipe | ✅ button | ✅ (fixed today) |
| `ModalSkeleton` | ❌ | ❌ | n/a | ❌ cosmetic only | — |

Additional gaps:
- Drag handle visible on pure-mouse desktop — wrong affordance
- `TeacherPanelChrome` on tablet (md+) shows side panel but offers no swipe-to-dismiss
- `ModalSkeleton` renders pill with zero drag wiring

---

## Goals

1. Single shared `DragHandle` component — one source of truth for the pill affordance
2. `useSheetDrag` supports both y-axis (bottom sheet) and x-axis (side panel) dismissal
3. Drag handle hidden on non-touch devices, shown on any-touch devices (including hybrids like Surface)
4. `TeacherPanelChrome` gets swipe-right on tablet, swipe-down on mobile
5. `ModalSkeleton` wired with real drag handlers

---

## `touch:` Tailwind Variant

Add to `src/app/globals.css` alongside existing `light:`/`dark:` variants:

```css
@custom-variant touch (@media (any-pointer: coarse));
```

`any-pointer: coarse` (not `pointer: coarse`) ensures hybrid devices (Surface with Type Cover, touchscreen laptops) show the handle even when the primary input is a trackpad/mouse.

| Device | Shows handle |
|---|---|
| iPhone / Android | ✅ |
| iPad (any mode) | ✅ |
| Surface + keyboard | ✅ |
| Surface tablet mode | ✅ |
| Touchscreen laptop | ✅ |
| Desktop mouse only | ❌ |
| Laptop trackpad only | ❌ |

---

## `useSheetDrag` — Add `axis` Option

**File:** `src/lib/hooks/useSheetDrag.ts`

Add `axis?: 'y' | 'x'` to `UseSheetDragOptions` (default `'y'`).

### y-axis (unchanged behavior)
- Tracks `deltaY`, clamps to positive (downward only)
- Dismiss animation: `translateY(100%)`
- Snap-back: `translateY(0)`

### x-axis (new)
- Tracks `deltaX`, clamps to positive (rightward only — LTR dismiss)
- Direction guard: the tablet drag zone gets `touch-action: pan-y`. This tells the browser to own vertical panning natively (so a downward swipe scrolls without any JS involvement) while passing horizontal swipes to our handlers. No manual `deltaX > deltaY` check needed — the browser enforces the direction boundary at the platform level.
- Dismiss animation: `translateX(100%)`
- Snap-back: `translateX(0)`
- Opacity fade same as y-axis

Both axes set `style.animation = 'none'` on drag start (today's fix — prevents CSS keyframe fill from blocking inline transform).

`onMouseDown` is kept. On hybrid devices, the handle is visible (`any-pointer: coarse`) and the user may mouse-drag it.

---

## `DragHandle` Component

**File:** `src/components/global/DragHandle.tsx` (new)

```ts
interface DragHandleProps {
  drag: ReturnType<typeof useSheetDrag>
  onDismiss: () => void
  className?: string
}
```

Always a `<button>`:
- `aria-label="Close"`
- `onKeyDown`: dismiss on `Enter` / `Space`
- `onTouchStart`, `onTouchMove`, `onTouchEnd`, `onMouseDown` from `drag`
- `touch-none cursor-grab active:cursor-grabbing`
- Renders `hidden touch:flex justify-center` — invisible on pure-mouse devices, flex on any-touch

Visual: horizontal pill `h-1 w-10 rounded-full bg-white/30 light:bg-gray-300`.

---

## Surface Changes

### `BottomSheet`

- Replace bare `div` drag zone → `DragHandle`
- No other changes. Self-contained, portal-based, CSS transitions — already works.

### `SheetChrome`

- Replace `button` drag zone → `DragHandle`
- `DragHandle` brings `onMouseDown` and touch-visibility guard automatically
- No structural changes

### `TeacherPanelChrome`

Two separate drag contexts, same `contentRef`. Only one active at a time (CSS hides the other).

**Mobile (`md:hidden`):**  
Replace existing drag handle `button` → `DragHandle`, axis `'y'`.

**Tablet (`hidden touch:md:flex`):**  
New invisible drag zone spanning the top header area of the side panel. Touch handlers only (no `onMouseDown` — desktop mouse users dismiss via X). Uses a second `useSheetDrag` call with `axis: 'x'` on the same `contentRef`.

```
const mobileDrag = useSheetDrag({ onDismiss, contentRef, axis: 'y' })
const tabletDrag = useSheetDrag({ onDismiss, contentRef, axis: 'x' })
```

The tablet zone sits in the header row alongside the desktop X button. Height `h-11` minimum (44px touch target). No visual indicator needed — the swipe affordance on a side panel is conventional on iOS/Android.

### `ModalSkeleton`

- Add `useRef<HTMLDivElement>(null)` on the content div
- Wire `useSheetDrag({ onDismiss, contentRef: skeletonRef, axis: 'y' })`
- Replace cosmetic pill div → `DragHandle`
- Skeleton uses keyframe animation (`MODAL_ENTER_ANIMATION`) — `style.animation = 'none'` on drag start handles this correctly

---

## Files Changed

| File | Change |
|---|---|
| `src/app/globals.css` | Add `@custom-variant touch` |
| `src/lib/hooks/useSheetDrag.ts` | Add `axis?: 'y' \| 'x'`, direction guard for x |
| `src/components/global/DragHandle.tsx` | New component |
| `src/components/global/BottomSheet.tsx` | Use `DragHandle` |
| `src/components/modals/chrome/SheetChrome.tsx` | Use `DragHandle` |
| `src/components/modals/chrome/TeacherPanelChrome.tsx` | `DragHandle` mobile + x-axis tablet zone |
| `src/app/@modal/layout.tsx` | Wire `ModalSkeleton` drag |

---

## Out of Scope

- Dragging the `ModalSkeleton` desktop close button (X covers it)
- Horizontal swipe on `BottomSheet` or `SheetChrome` (always bottom sheets, y only)
- Velocity tuning — existing thresholds (`DISMISS_THRESHOLD = 120`, `VELOCITY_THRESHOLD = 0.5`) carry over unchanged
