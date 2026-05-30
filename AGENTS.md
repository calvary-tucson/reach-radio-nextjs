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
- **Contrast:** Text must be `text-white/90` minimum on dark surfaces, `text-foreground` on light. Never `text-white/50` for readable content.
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
