# showMediaBar Centralization — Proposal (decision doc, not an implementation plan)

**Status:** Awaiting decision. Do not implement without explicit sign-off — see Risk below.

## Why this exists

Code review handoff on the sleep-timer/media-bar work (commits 16c2c12..09452d8) flagged that `showMediaBar` visibility has no single owner. Its "first action in new session" instruction asked to *propose* a centralized derivation before any new sheet or page is added — this is that proposal, not an implementation.

Two same-day commits already show what happens without one:
- `be0fd18` changed `useHideMediaBarWhileOpen`'s restore-on-close from a captured snapshot to a pathname-derived value, to fix `/teachers/search` (a route with no `<ShowMediaBar/>` mount) staying hidden after a sheet closed.
- `b94af59` reverted that: pathname-derivation stomped legitimate non-route-driven state (RadioPlayer's scroll observer, donate page's form-focus toggle) on every sheet close. It fixed `/teachers/search` a different way (mounted `<ShowMediaBar/>` there) and reintroduced capture/restore, adding `openStandaloneSheetCount` so `BridgeInit`'s route effect wouldn't race an open sheet.

Both fixes were individually reasonable and both broke something the other one relied on. That's the signature of a value with no single source of truth.

## Current owners (5, confirmed by reading each file)

| # | Owner | File | What it does |
|---|---|---|---|
| 1 | Route effect | `src/components/bridge/BridgeInit.tsx:172-179` | On pathname change, sets `showMediaBar = pathname !== '/' && !isTeacherDetailPath(pathname)`. Skipped while `useModalStore.isOpen` or `openStandaloneSheetCount > 0`. |
| 2 | Focus/blur handler | `src/components/bridge/BridgeInit.tsx:223-253` | Hides on input focusin, restores a captured pre-focus value on focusout. Skipped while a modal is open or focus target is inside `[aria-modal="true"]`. |
| 3 | `useHideMediaBarWhileOpen` | `src/lib/hooks/useHideMediaBarWhileOpen.ts` | Used by `ModalLayout`, `SleepTimerSheet`, `ScheduleTabView`'s day-picker sheet. Captures pre-open value, hides, restores captured value on close; increments/decrements `openStandaloneSheetCount`. |
| 4 | `<ShowMediaBar/>` | `src/components/media-bar/ShowMediaBar.tsx` | Mounted on `about`, `about/privacy-policy`, `donate`, `teachers/[slug]`, `teachers`, `teachers/search` pages. Sets `true` on mount — exists because owner #1's pathname formula doesn't cover every route correctly on its own. |
| 5a | RadioPlayer scroll observer | `src/components/home/RadioPlayer.tsx:37-56` | IntersectionObserver on the home page's player card — hides when the card is in view, shows once scrolled past. |
| 5b | Donate page iframe focus | `src/app/donate/page.tsx:32-56` | Own `setShowMediaBar(true)` on mount, hides/shows in response to `postMessage` events from the embedded MinistryForms iframe (`donationFormInputFocus`/`Blur`). |

Every one of these calls `useMediaStore.getState().setShowMediaBar(v)` directly — the store has one flat boolean with no concept of "who set this and why," so any two owners racing is a silent last-write-wins.

## Proposed model: base × suppressors

Replace the flat boolean with two pieces of state, and derive the public value:

```ts
interface MediaState {
  mediaBarBase: boolean       // "would the bar be visible here, ignoring transient overlays"
  mediaBarSuppressors: number // count of active suppressors (sheets, focused inputs)
  // showMediaBar becomes a derived getter: mediaBarBase && mediaBarSuppressors === 0
}
```

- **`mediaBarBase`** is written by whichever page-level source knows the *intended* state: owner #1's route effect writes the default on navigation; RadioPlayer's scroll observer (5a) and the donate page's iframe handler (5b) override it while active; `<ShowMediaBar/>` (owner #4) becomes redundant once the route effect's formula is trusted — see Migration note below.
- **`mediaBarSuppressors`** replaces `openStandaloneSheetCount` and *also* covers the focus/blur suppression (owner #2) and the modal-open suppression that owner #3 currently handles via capture/restore. Every "hide while X is true" caller becomes `increment` on mount/open, `decrement` on unmount/close — no captured snapshot to go stale or race.
- **One subscriber** (in `BridgeInit`) watches the derived value and calls `postMessageToNative`. Nothing else calls `postMessageToNative({ showMediaBar: ... })` directly.

Why this fixes the actual bug class: capture/restore snapshots a point-in-time value and replays it later, which is wrong the instant something legitimate changes the base *while* suppressed (exactly what happened between `be0fd18` and `b94af59`). Suppressor counting never snapshots — `mediaBarBase` keeps being written by its real owner the whole time, and unsuppression just re-reads whatever it currently is.

`showMobileNav` is a simpler derived value (`!isTeacherDetailPath(pathname)`, no page-owned overrides) and doesn't need this treatment — leave `BridgeInit`'s existing pathname-effect handling for it as-is.

## What this does NOT change

- `isTeacherDetailPath` stays the routing predicate it already is.
- The five owners' *page-level intent* (route default, scroll observer, iframe focus, sheet suppression) doesn't move — only how they compose.

## Risk — why this isn't implemented in this pass

Centralizing this changes the *shape and sequence* of `postMessageToNative` payloads: today some posts bundle `showMobileNav` with `showMediaBar`, some post `showMediaBar` alone (RadioPlayer, donate page), some skip both while a sheet/modal is open. A single derived subscriber would very likely change which payloads fire on which transitions, and possibly their batching.

The native bridge contract (`reference-bridge-contract.md` in project memory) was verified field-by-field with the native dev on 2026-06-25, and per project memory the app is mid go-to-production: Step 1 (bridge fixes) is done pending manual QA, native repos are sitting on bridge-testing branches awaiting store submission. Changing native-visible payload behavior right before that QA pass is a bad trade — any regression surfaces on a device, not in this test suite, and there's no fast local way to verify parity with native's current expectations.

**Recommendation:** hold this until after the pending manual QA + store submission, then implement behind the existing unit test suite (which already exercises every owner's postMessage payload) plus a manual native-device smoke pass before merging.

## Decision needed

1. Proceed now anyway (not recommended — see Risk), or
2. Defer to a follow-up plan after native QA/store submission clears, or
3. Reject this model in favor of something narrower (e.g., just replacing `openStandaloneSheetCount` + capture/restore with the suppressor-count part, leaving `mediaBarBase` composition alone for now).

Once a direction is picked, the next step is a full `superpowers:writing-plans` task breakdown (file-by-file, TDD steps) — not written here since it depends on which option is chosen.
