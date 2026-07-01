# Search Teachers Sheet — UX Improvements

**Date:** 2026-06-29  
**Scope:** `SheetChrome`, `TeacherSearchClient`, `TeachersSearchSheetPage`

## Problems

1. Sheet on mobile occupies only 85dvh — too short to show meaningful results
2. Day + Sort filters each occupy a full labeled section, pushing results too far below the search bar
3. Auto-focus on search input fails: `Suspense` delays input mounting past the fixed 250ms timer, so the dialog container gets focused instead (visible as a white border with no keyboard)
4. `--safe-top` padding applies unconditionally in `SheetChrome`, adding unwanted space on mobile web where `dvh` already excludes the notch

---

## Fix 1 — Sheet Height

**File:** `src/components/modals/chrome/SheetChrome.tsx`

Change mobile height class from `h-[85dvh]` to `h-[100dvh]`. Keep `rounded-t-2xl`. Remove `max-h-[90dvh]` from the mobile class list — it is superseded by `h-[100dvh]` and would only add confusion. The `sm:max-h-[90dvh]` constraint stays for desktop.

---

## Fix 2 — Safe-Top Gating

**Files:** `src/components/modals/chrome/SheetChrome.tsx`, `src/app/globals.css`

`--safe-top` is `env(safe-area-inset-top, 0px)`. On mobile web, `100dvh` already begins below the notch — adding `paddingTop: var(--safe-top)` pushes content down unnecessarily. In the native WebView, the view is full-bleed so the inset is required.

**Change:** Remove `paddingTop: 'var(--safe-top)'` from the `SheetChrome` inline `style` prop. Add a CSS rule to `globals.css` that targets only the native context:

```css
html.native-app .sheet-chrome-dialog {
  padding-top: var(--safe-top);
}
```

Add class `sheet-chrome-dialog` to the inner `role="dialog"` div in `SheetChrome`.

`paddingBottom: 'var(--safe-bottom)'` remains inline — the home indicator appears on mobile web too, so it's correct to always apply it.

---

## Fix 3 — Filter Layout Compaction

**Files:** `src/components/teachers/TeacherSearchClient.tsx`, `src/app/@modal/(...)teachers/search/page.tsx`

### New layout (mobile, inside the sheet scroll area)

```
Row 1: [🔍 Search input ........................] [Sort ▾ / Clear all]
Row 2: [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun] →→→ fade scrim
```

### Sort control (Row 1 trailing element)

- Single trailing button that toggles through sort options on repeated press: none → A–Z → Z–A → Most on air → none
- Label reflects current state: "Sort" (inactive) or active label ("A–Z", "Z–A", "Most on air")
- Icon: `ArrowUpDown` from lucide when inactive; no icon when active (label alone)
- When any filter is active (query, sort, or days), "Clear all" text link replaces the sort button — tapping it clears everything and the sort button returns

### Day chips (Row 2)

- `overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`
- Full row width — not shared with sort control
- Fade scrim on right end (`pointer-events-none absolute right-0 w-12 bg-gradient-to-l from-[oklch(24%_0.05_280)] to-transparent`)
- Chips: 44px min-height, same active/inactive styles as current

### Section labels

Both "Day" and "Sort" section labels removed entirely.

### Results gap

Results appear directly after row 2 with a small count label — no empty vertical space between filters and results.

---

## Fix 4 — Autofocus via MutationObserver

**File:** `src/components/modals/chrome/SheetChrome.tsx`

Replace the fixed `setTimeout(250ms)` focus logic with a `MutationObserver` that watches `contentRef` for an `input` to be inserted into the subtree. On first `input` found, call `.focus()` and disconnect. A 2000ms fallback `setTimeout` focuses `contentRef` itself if no input appears (graceful degradation).

```ts
// pseudocode
const observer = new MutationObserver(() => {
  const input = contentRef.current?.querySelector<HTMLElement>('input, textarea')
  if (input) { observer.disconnect(); clearTimeout(fallback); input.focus() }
})
observer.observe(contentRef.current, { childList: true, subtree: true })
const fallback = setTimeout(() => { observer.disconnect(); contentRef.current?.focus() }, 2000)
```

Only active when `autoFocusInput` is true. Observer and fallback both cleaned up in `useEffect` return.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/modals/chrome/SheetChrome.tsx` | Height `85dvh→100dvh`, remove `paddingTop` inline style, add `sheet-chrome-dialog` class, replace focus timer with `MutationObserver` |
| `src/app/globals.css` | Add `html.native-app .sheet-chrome-dialog { padding-top: var(--safe-top); }` |
| `src/components/teachers/TeacherSearchClient.tsx` | Remove section labels, add sort toggle button, restructure into 2-row layout |
| `src/app/@modal/(...)teachers/search/page.tsx` | Minor layout adjustments if needed for new filter structure |

---

## Out of Scope

- Desktop (`sm:` breakpoint) layout — unchanged
- Teacher panel sheet (`TeacherPanelChrome`) — not affected
- Sleep timer sheet — not affected
