# Color Contrast Audit (WCAG 2.2 AA), reach-radio-nextjs

Date: 2026-11-01. Scope: all of `src/` (pages, schedule, teachers, modals/sheets, tabs, media bar, layout, global, ui, error pages, OG images).
Trigger: owner report that light-theme schedule "music" entries (esp. times) are unreadable.

## Method

- Grepped every text color class in `src/**/*.tsx|css` (`text-white/N`, `light:text-gray-N`, `text-[#84b84f]`, `light:text-green-N`, placeholders, inline styles).
- Resolved real colors: Tailwind 4.2.4 oklch gray/green/amber scale; `--color-brand-purple` = oklch(24% .04 130) = `rgb(25,35,14)` (dark page); `brand-gray` oklch(30% .02 280); modal/dialog `gray-800`; sheets `#0f1a0a`; light page `white`; light rows `gray-50`/`gray-100`.
- Computed WCAG relative-luminance ratios, alpha-white blended onto the actual surface each class sits on.
- Thresholds: 4.5:1 normal text, 3:1 large text (>=24px, or >=18.66px bold) and non-text UI (icons, focus rings). All failing text here is under 18px, so none gets the 3:1 allowance.
- Then measured in a real browser (see "Browser verification" below). The fix plan adds the same measurement as an automated test.

## Summary

| Tier | Meaning | Findings |
|---|---|---|
| 1 | Hard fail, text or icon far below threshold | 32 sites in 15 files |
| 2 | Fails only on `gray-100`/`gray-200` surfaces (4.39 / 3.91) | 6 sites in 5 files |
| 3 | Non-text and image issues | 2 sites |
| 4 | Passes WCAG but breaks the repo's own stricter AGENTS.md rule | owner decision, no fix proposed |

Biggest single finding: **`text-[#84b84f]` (brand green) has no light variant in 7 places. It is 2.1 to 2.35:1 on light backgrounds.** Active "on air" show time, "Today" markers, active chips. The owner's report was the tip of this.

## Key ratios

Light theme (text on surface):

| Text | on white | on gray-50 | on gray-100 |
|---|---|---|---|
| gray-300 | 1.47 | 1.41 | 1.34 |
| gray-400 | 2.60 | 2.49 | 2.36 |
| gray-500 | 4.84 | 4.63 | **4.39** |
| gray-600 | 7.56 | 7.23 | 6.87 |
| #84b84f (brand green) | 2.35 | 2.25 | 2.13 |
| green-600 `#69953C` | 3.52 | | |
| green-700 `#4F712D` | 5.63 | | 4.78 (on green-100) |

Dark theme, `text-white/N` on each surface (page / row `white/5` / modal gray-800 / sheet `#0f1a0a` / media bar brand-gray):

| N | page | row | gray-800 | sheet | media bar |
|---|---|---|---|---|---|
| 20 | 1.91 | 1.91 | n/a | n/a | n/a |
| 25 | 2.27 | 2.24 | n/a | n/a | n/a |
| 30 | 2.70 | 2.64 | n/a | n/a | n/a |
| 40 | 3.74 | 3.58 | 3.63 | 3.82 | 3.52 |
| 50 | 5.06 | 4.74 | 4.81 | 5.27 | 4.64 |
| 55 | 5.83 | 5.38 | 5.51 | 6.09 | 5.28 |
| 60 | 6.67 | 6.08 | 6.22 | 6.99 | 5.96 |
| 70 | 8.58 | 7.71 | 7.96 | 9.14 | 7.51 |

Others: white on `amber-500` 2.13; brand green on dark page 6.95; `#0a1305` on green button 8.08 (fine); tooltip white on gray-800 14.67 (fine); focus ring green-700 on white 4.95 (fine); footer dark gray-400 on brand-gray 5.24 (fine).

## Tier 1: hard fails

L = light theme, D = dark theme. "Fix" is the proposed class.

| ID | File:line | Element | Now | Ratio | Fix |
|---|---|---|---|---|---|
| T1-01 | `teachers/ScheduleCardList.tsx:42` | Music gap time range (owner report) | L `gray-300`, D `white/20` | L 1.41, D 1.9 | L `gray-600`, D `white/60` |
| T1-02 | `ScheduleCardList.tsx:41` | "♪ Music" label | L `gray-400`, D `white/25` | L 2.49, D 2.3 | L `gray-600`, D `white/70` |
| T1-03 | `ScheduleCardList.tsx:88` | Duration chip (on gray-100 / white/6) | L `gray-400`, D `white/30` | L 2.36, D 2.6 | L `gray-600`, D `white/60` |
| T1-04 | `ScheduleCardList.tsx:20` | "No shows scheduled" | L `gray-400` | L 2.60 | L `gray-600` |
| T1-05 | `ScheduleCardList.tsx:80` | Active (on air) time | `#84b84f`, no light variant | L 2.13 to 2.25 | add `light:text-green-700` |
| T1-06 | `ScheduleCardList.tsx:87` | Active duration chip text on green tint | `#84b84f`, no light variant | L ~1.9 | add `light:text-green-700` |
| T1-07 | `teachers/ScheduleWeekCards.tsx:38` | Today day header | `#84b84f`, no light variant | L 2.35 | add `light:text-green-700` |
| T1-08 | `ScheduleWeekCards.tsx:39` | Other day headers (11px bold) | L `gray-400`, D `white/40` | L 2.60, D 3.7 | L `gray-600`, D `white/60` |
| T1-09 | `teachers/ScheduleTabView.tsx:116` | Day-picker section label (modal/tab) | L `gray-400`, D `white/40` | L 2.6, D 3.6 | L `gray-600`, D `white/60` |
| T1-10 | `ScheduleTabView.tsx:101` | Chevron icon (3:1 rule) | L `gray-400`, D `white/50` | L 2.60 | L `gray-500`, D `white/60` |
| T1-11 | `ScheduleTabView.tsx:138` | Selected-day check icon | `#84b84f`, no light variant | L 2.35 (<3) | add `light:text-green-700` |
| T1-12 | `ScheduleTabView.tsx:143` | "Today" label (text-xs) | `#84b84f`, no light variant | L 2.35 | add `light:text-green-700` |
| T1-13 | `teachers/TeachersClientView.tsx:43` | Active tab label (Teachers / Schedule tabs) | L `green-600` | L 3.52 | L `green-700` (keep border green-600) |
| T1-14 | `TeachersClientView.tsx:58` | Teacher count (12px) | L `gray-400`, D `white/50` | L 2.60 | L `gray-600`, D `white/60` |
| T1-15 | `TeachersClientView.tsx:61` | "No teachers found" | L `gray-400`, D `white/50` | L 2.60 | L `gray-600`, D `white/70` |
| T1-16 | `teachers/TeacherSortControl.tsx:48` | Sort button text (interactive!) | L `gray-400` | L 2.60 | L `gray-600` |
| T1-17 | `teachers/TeacherSearchClient.tsx:65` | Active filter chip text | `#84b84f`, no light variant | L ~2.0 | add `light:text-green-700` |
| T1-18 | `TeacherSearchClient.tsx:141` | Empty-results message | L `gray-400` | L 2.60 | L `gray-600` |
| T1-19 | `TeacherSearchClient.tsx:135` | Result chevron icon | `white/20`, **no light variant** (white on white) | D 1.9, L ~1.1 | `white/50 light:text-gray-500` |
| T1-20 | `global/Pagination.tsx:43` | Ellipsis | L `gray-400` | L 2.60 | L `gray-600` |
| T1-21 | `teachers/TeacherSearchBar.tsx:59` | Search icon | L `gray-400`, D `white/40` | L 2.60 | L `gray-500`, D `white/50` |
| T1-22 | `TeacherSearchBar.tsx:75` | Input placeholder (text) | L `gray-400`, D `white/40` | L 2.60, D 3.6 | L `gray-500` (4.84 on white), D `white/60` |
| T1-23 | `TeacherSearchBar.tsx:83` | Clear (X) icon button | L `gray-400` | L 2.60 | L `gray-500` |
| T1-24 | `teachers/RecommendedTeachers.tsx:52` | Arrow icon | L `gray-400`, D `white/50` | L 2.60 | L `gray-500`, D `white/60` |
| T1-25 | `app/about/page.tsx:203` | Privacy row chevron | L `gray-400`, D `white/40` | L 2.60, D 3.6 (icon passes 3:1 in dark) | L `gray-500`, D `white/50` |
| T1-26 | `global/Breadcrumbs.tsx:63` | Separator (decorative, aria-hidden) | L `gray-400` | L 2.60 | L `gray-500` (consistency, low priority) |
| T1-27 | `global/PassiveSearchBar.tsx:97` | Placeholder-style text | L `gray-500`, D `white/40` | D 3.5 | D `white/60`; L verify surface, use `gray-600` |
| T1-28 | `global/PassiveSearchBar.tsx:91` | Search icon | D `white/40` | D 3.5 (passes 3:1) | D `white/50` for consistency |
| T1-29 | `app/teachers/error.tsx:8` | Error digest (mono, xs) | D `white/40` | D 3.7 | D `white/60` |
| T1-30 | `app/teachers/search/error.tsx:8` | Error digest | D `white/40` | D 3.7 | D `white/60` |
| T1-31 | `app/teachers/[slug]/error.tsx:8` | Error digest | D `white/40` | D 3.7 | D `white/60` |

| T1-32 | `ScheduleCardList.tsx:87` | Active duration chip text on green tint, **dark theme** (found by browser measurement; class grep rated it 5.3) | D `#84b84f` on tint over row | D 4.40 | D `text-[#a3d46a]` (9.4 on dark), keep `light:text-green-700` |

## Tier 2: gray-500 on gray-100 (4.39, fails 4.5)

| ID | File:line | Element | Now | Fix |
|---|---|---|---|---|
| T2-01 | `layout/Footer.tsx:9` | Footer headings (xs, on `gray-100`) | L `gray-500` | L `gray-600` |
| T2-02 | `layout/Footer.tsx:30` | Footer small text (xs) | L `gray-500` | L `gray-600` |
| T2-03 | `media-bar/NowPlayingInfo.tsx:34` | Artist line in media bar (xs, on `gray-100`) | L `gray-500` | L `gray-600` |
| T2-04 | `teachers/primitives/TeacherInfoChip.tsx:12` | "dim" chip (on `gray-100`), also D `white/50` = 4.67 on chip | L `gray-500`, D `white/50` | L `gray-600`, D `white/60` |
| T2-05 | `ScheduleCardList.tsx:80` | Non-active show time (10px compact; hover bg `gray-100`) | L `gray-500` | L `gray-600`; keep 10px size unless owner approves a size bump |
| T2-06 | `theme/ThemeToggle.tsx:35` | Footer theme toggle labels "Dark" / "System" (inactive, on `gray-100`), measured 4.39 | L `gray-500` | L `gray-600` |

## Tier 3: non-text and images

| ID | File:line | Issue | Fix |
|---|---|---|---|
| T3-01 | `media-bar/SleepTimerIndicator.tsx:28` | White moon icon on `amber-500`: 2.13 (<3). Light mode already uses `gray-900` (passes). | `text-gray-900` in both themes |
| T3-02 | `app/teachers/[slug]/opengraph-image.tsx:98` (and `app/opengraph-image.tsx:47`) | Share-card text `rgba(255,255,255,0.45)` / `0.6`; images of text fall under 1.4.3 | raise to `0.7` / `0.8` |

## Modals, sheets, tabs, other non-obvious areas: result

Reviewed explicitly: `@modal/layout.tsx`, `SheetChrome`, `TeacherPanelChrome`, `BottomSheet`, `ui/dialog`, `SleepTimerSheet`, `TeacherSearchSheetContent`, tab bar (`TeachersClientView`, `ScheduleTabView`), media bar, footer, headers, mobile nav, theme toggle, contact form, error boundaries, skeleton, tooltip, slider.

- **Pass:** modal/sheet surfaces and close buttons (icon `gray-500` on white 4.84, on `gray-200` 3.91, both >= 3:1); dialog description `white/60` / `gray-500` on gray-800 / white; sleep timer sheet; contact form labels and inputs; mobile header/header icons (`slate-300` dark); tooltip; error boundary text; focus rings; green buttons (`#0a1305` on green 8.08).
- **Fail (listed above):** tab active label (T1-13), tab/sheet day-picker label and icons (T1-09..12), media bar artist (T2-03), footer (T2-01/02), sleep timer icon (T3-01), search inputs (T1-21..23), filter chips (T1-17).
- **Hover/active states not separately measured** beyond `gray-100` hover (T2-05). The in-browser check in the plan covers resting state only; hover needs a manual pass.

## Tier 4: passes WCAG, breaks repo rule (owner decision)

AGENTS.md says "text must be `text-white/90` minimum on dark, never `text-white/50`". Current usage: `/50` x6 (all pass 4.6 to 5.3 but borderline), `/55` x5, `/60` x11, `/70` x5, `/75` x2, `/80` x16. All of `/55` and up pass AA with margin (5.3 to 9.3). `/50` passes barely. Recommendation: keep WCAG as the gate, change the AGENTS.md rule to "dark text: `white/60` minimum, `/50` allowed only for icons, never below". Enforcing literal `/90` would flatten the visual hierarchy. The plan bumps the `/50` text uses to `/60` as a safety margin. Nothing else.

## Browser verification (2026-11-01)

Headless Chromium against production `reach.radio` (same code as local `main` for these files), light and dark via `?theme=`. Desktop 1280x900 and mobile 390x844. Walked every visible text node, resolved real computed colors through a canvas (handles Tailwind v4 `oklch`), blended translucent backgrounds, computed WCAG ratios. Pages: home, teachers, teachers Schedule tab, about, donate; plus, on mobile, day-picker sheet open, after picking Wednesday (music rows), teacher modal open, search sheet open.

Result: **every audited number matched the browser to the second decimal** (music time 1.41, music label 2.49, duration chip 2.36, brand green 2.35 / 2.17 / 1.95, tab label 3.52, count 2.60, footer 4.39).

| Page | Light fails (text nodes) | Dark fails |
|---|---|---|
| Home | 7 (footer + media bar only) | 0 |
| Teachers | 9 | 1 (search placeholder 3.58) |
| Teachers, Schedule tab | 47 (desktop), 25 (mobile) | 35 (desktop), 15 (mobile) |
| About, Donate | 7 (footer + media bar only) | 0 |

- **Site-wide in light, every page:** footer ("Appearance", "Dark", "System", "Sanity.io") and the media bar artist line are `gray-500` on `gray-100` = 4.39. Same 7 nodes on every page. Fixed by T2-01 to T2-04, T2-06.
- **Dark theme is clean** on home, about, donate. Dark failures are confined to the schedule tab and the search placeholder.
- **Modals and sheets:** the day-picker sheet adds "Pick a day" (light 2.6, dark 3.8) and "Today" (light 2.35). The teacher modal and search sheet added no failures of their own. Sleep timer sheet and hover states were not opened.
- **New from the browser, not in the class grep:** T1-32 (dark green chip 4.40) and T2-06 (theme toggle). Both are now in the tables above.
- **False positives to ignore:** the "(opens in new tab)" footer text is visually hidden (`sr-only`, 1px box). The measurer also ignores sheet overlays, so page text under an open sheet is still counted. Both are handled in the plan's e2e helper (skip elements with a clipped 1px box; measure only inside `[role=dialog]` when one is open).
- **Scratch tooling:** measurement scripts lived in the sandbox temp dir, not in the repo. The plan's Task 6 turns the same logic into a committed e2e test.

## Not verified / limits

- Real-browser measurement covered the pages above only. Not opened: sleep timer sheet, hover/focus states.
- `TeacherAvatar` fallback initials (`rgba(132,184,79,.8)`): 4.95 on dark; light-mode surface not confirmed.
- Hover/focus/pressed color variants; native app webview chrome; Donate iframe (third-party content); Sanity rich text colors (typography plugin defaults, not inspected).
- Ratios for alpha blends use the nominal surface color. Photos behind text (none found) would need per-image checks.
- Disabled controls are exempt from WCAG and were not flagged.

## Fixes count

40 findings (32 + 6 + 2) across 23 files, some lines with 2 edits, plus one regression guard test and one in-browser contrast check.
