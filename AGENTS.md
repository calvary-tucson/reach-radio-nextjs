<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# UI Rules

- **All buttons and clickable elements must have `cursor-pointer`** in their Tailwind className. Buttons do not get pointer cursor by default — always add it explicitly. Disabled buttons should also get `cursor-not-allowed`.

## A11y Rules (apply per component, not as a retrofit)

Every interactive component you write must satisfy all of these before committing:

- **Role:** `<div>` acting as button → `role="button"` and `tabIndex={0}`. Native `<button>` preferred.
- **Label:** Every icon-only button needs `aria-label`. Every form input needs `<label>` or `aria-label`.
- **Touch target:** Min `h-11 w-11` (44px) on mobile interactive elements.
- **Contrast:** Readable text is `text-white/60` minimum on dark surfaces (icons `text-white/50` minimum). On light use `light:text-gray-600` for all text (gray-500 is 4.39:1 on gray-100); `light:text-gray-500` only for icons (3:1) and nothing lighter. Brand green text needs `light:text-green-700`. Enforced by `tests/unit/contrast-classes.test.ts`.
- **Focus visible:** Interactive elements need `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`.
- **Cursor:** `cursor-pointer` on all clickables. `cursor-not-allowed` on disabled.
- **Motion:** Wrap animations in `motion-safe:` variant. Never animate without this guard.

These are build-time rules, not review-time suggestions. If a full-review catches an a11y issue that's in this list, that's a process failure.

## Canonical Commit Scopes

Use these exact scope names in conventional commits. PascalCase scopes are wrong. Undocumented scopes create noise in the git log.

| Scope | Covers |
|-------|--------|
| `bridge` | Native WebView bridge, BridgeInit, post-message, middleware cookie |
| `seo` | Metadata, JSON-LD schemas, sitemap, OG images, robots.txt |
| `teachers` | All teacher list/detail/search/modal components and routes |
| `schedule` | Schedule pages, cards, slots, week view |
| `theme` | ThemeProvider, ThemeToggle, light/dark variants |
| `modal` | ModalLayout, SheetChrome, TeacherPanelChrome, ModalContext |
| `player` | RadioPlayer, AudioProvider, MediaBar, volume, sleep timer UI |
| `sleep-timer` | SleepTimerProvider, SleepTimerSheet, timer store actions |
| `donate` | Donate page and iframe |
| `about` | About page, contact form, privacy policy |
| `layout` | Header, Footer, MobileNav, root layout |
| `api` | All `/app/api/*` routes |
| `global` | Shared primitives: BottomSheet, PassiveSearchBar, Breadcrumbs |
| `ppr` | PPR/cacheComponents/useCache configuration |
| `test` | Test files only — use when no source file is changed |

**A11y fixes belong to the component scope being fixed**, not a separate `a11y` scope.
Example: `fix(teachers): improve contrast on TeacherCard` not `fix(a11y): teachers contrast`.
<!-- END:nextjs-agent-rules -->

## UI mock adapter

Read by the `ui-mock` skill (added after the 2026-11-11 banner work needed an ad-hoc setup).

- `scaffold`: throwaway route `src/app/mock-<name>/page.tsx`; delete before committing. Not linked from the real site.
- `fixtures`: inline static data in the mock route; no Sanity or Doppler data needed.
- `styles`: `src/app/globals.css` (Tailwind v4 tokens, `light:`/`dark:` variants) plus `docs/design-system.md`. Reuse real class strings, e.g. the card `bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px]`.
- `catalog`: none (grep `src/components`).
- `theme`: dark default; force with `?theme=dark` or `?theme=light`.
- `dev`: `doppler run --project reach-radio-nextjs --config dev -- npx next dev -p 3100` (sandbox off, owner Yes/No); stop by PID.
- `verify`: Playwright MCP Chromium is not installed here, so open with `orca tab create --url http://localhost:3100/<route>?theme=dark` and capture with `orca screenshot --json` (both sandbox off, owner Yes/No). Show 390 and ~1100 wide frames side by side.
- Date-specific content: pages are cached (PPR), so check dates in a client component (`src/lib/date-window.ts`), never in the server render.
