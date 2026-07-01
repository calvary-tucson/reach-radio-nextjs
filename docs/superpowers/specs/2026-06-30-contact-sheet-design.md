# Contact Sheet — Design Spec

**Date:** 2026-06-30  
**Status:** Approved

## Summary

Add a contact sheet triggered by the Contact button in the header. Clicking Contact opens an overlay with the contact form — no page navigation required. The sheet follows the same mobile/desktop behavior as `SheetChrome`: full-height bottom sheet on mobile, centered modal on desktop.

---

## Architecture

Self-contained sheet component using `SheetChrome` + `ModalProvider` with local state. No new route required — unlike the teachers/search modals, contact does not need deep-linkable URLs.

**Pattern:** mirrors `SleepTimerSheet` (local `useState` open/close in the trigger component, sheet component accepts `open`/`onClose` props).

---

## Components

### 1. `ContactSheet` (new)

**File:** `src/components/about/ContactSheet.tsx`

**Props:**
```typescript
interface ContactSheetProps {
  open: boolean
  onClose: () => void
}
```

**Behavior:**
- Portal-rendered via `createPortal` to `document.body`
- Backdrop: `fixed inset-0 z-[70] bg-black/80` with fade-in/fade-out animations matching `@modal/layout.tsx`
- Sheet content: `ModalProvider` wrapping `SheetChrome title="Contact Us" autoFocusInput`
- `SheetChrome` provides: drag handle (mobile), close button, title, enter/exit animations, focus trap
- Handles Escape key (`keydown` listener while open)
- Handles body scroll lock (`overflow: hidden` while open)
- Close sequence: set `isClosing=true` → wait `EXIT_DURATION` ms → call `onClose()` → reset `isClosing`
- On form success: `handleDismiss()` called → sheet closes after animation, toast remains visible

**Mobile:** full-height sheet (`h-[100dvh]`), slides up from bottom, drag-to-dismiss  
**Desktop (`sm:`):** centered modal, `max-w-2xl`, `max-h-[90dvh]`, rounded corners

### 2. `ContactForm` (modified)

**File:** `src/components/about/ContactForm.tsx`

**Change:** add optional `onSuccess?: () => void` prop.

In the `state.success` `useEffect`:
```typescript
useEffect(() => {
  if (state.success) {
    formRef.current?.reset()
    toast.success("Message sent! We'll be in touch.")
    onSuccess?.()
  }
}, [state.success, onSuccess])
```

- About page: passes no `onSuccess` (existing behavior unchanged — form resets, toast fires, sheet stays as-is on about page)
- ContactSheet: passes `handleDismiss` so the sheet closes on success

**Form width:** Remove `max-w-lg` from the form's className when rendered in the sheet. Since `ContactForm` is shared, this is handled by making the constraint conditional or removing it from the component and letting the parent constrain width. Simplest: remove `max-w-lg` from `ContactForm` and add it back in `about/page.tsx` as a wrapper `<div className="max-w-lg">`.

### 3. `Header.tsx` (modified)

**File:** `src/components/layout/Header.tsx`

Replace:
```tsx
<Link href="/about#aboutGotQuestions">Contact</Link>
```
With:
```tsx
<button
  type="button"
  onClick={() => setContactOpen(true)}
  className="... cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
>
  Contact
</button>
<ContactSheet open={contactOpen} onClose={() => setContactOpen(false)} />
```

Add `useState(false)` for `contactOpen`.

### 4. `MobileHeader.tsx` (modified)

**File:** `src/components/layout/MobileHeader.tsx`

Same change as Header.tsx — replace Contact `<Link>` with button + `ContactSheet`.

---

## State Flow

```
User clicks Contact button
  → setContactOpen(true)
  → ContactSheet renders portal (backdrop + SheetChrome)
  → autoFocusInput focuses name field
  → User fills form and submits
  → Server action runs
  → state.success = true
  → toast.success fires
  → onSuccess() → handleDismiss()
  → isClosing = true → exit animation plays
  → after EXIT_DURATION → onClose() → contactOpen = false
  → portal unmounts
```

---

## Accessibility

- `SheetChrome` provides `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (title)
- Focus trap via `useFocusTrap` (already in SheetChrome)
- Escape key handled at ContactSheet level
- On close: focus returns to Contact button (SheetChrome/BottomSheet pattern — the trigger element is stored in a ref before the sheet opens and restored on close; ContactSheet should do the same)
- Drag handle mobile-only (`sm:hidden`)
- All form fields keep existing labels and ARIA attributes

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/about/ContactSheet.tsx` | New |
| `src/components/about/ContactForm.tsx` | Add `onSuccess?` prop, move `max-w-lg` out |
| `src/app/about/page.tsx` | Wrap `<ContactForm>` in `<div className="max-w-lg">` |
| `src/components/layout/Header.tsx` | Link → button + ContactSheet |
| `src/components/layout/MobileHeader.tsx` | Link → button + ContactSheet |

---

## Out of Scope

- No route change for contact (`/about#aboutGotQuestions` anchor can stay for direct links)
- No new server action — reuses existing `submitContact`
- No analytics events
- About page "Got Questions?" section stays as-is (form remains on page)
