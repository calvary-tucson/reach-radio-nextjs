# Retro: dismissable banner and donate campaign card (2026-11-11)

## What was done
- Owner asked for a dismissable 106.7FM signal banner on the home page; ended with a reusable, date-windowed system: `HOME_BANNERS` (`src/lib/banners.ts`, `AnnouncementBanner`) and `DONATE_CAMPAIGNS` (`src/lib/donate/campaigns.ts`, `DonateCampaignCard`), sharing `src/lib/date-window.ts`. Both lists ship empty (owner: banner no longer needed now).
- Commits `e17ea4f`, `8ed17b6`, `3655683`, `56f54ce`, `3bc2dbf`, merged as `c56651b` and pushed to origin/main; Vercel deploy success, live `/` and `/donate` return 200 with nothing shown.

## What worked
- ui-mock gate: owner saw both mocks in the real stylesheet (dark and light) before code; no rework after approval.
- Per-id dated dismissal, native-app hiding via the existing `data-web-chrome` rule, 25 unit tests, tsc/eslint clean, real-page verification with a temporary sample entry that was reverted.
- Owner's questions ("reusable for the silent drive?", "donate page too?") each turned into a scoped Yes/No and a small follow-up commit.

## What did not
- First build was single-slot, banner-only; owner then asked for reuse, costing a `refactor` commit (8ed17b6) and a second pass (56f54ce). Recurrence ("yearly silent drive") was not asked up front.
- No `## UI mock adapter` existed, so each mock needed a throwaway route, a sandbox-off dev server and an Orca tab (3 Yes/No prompts); Playwright's Chromium is not installed, so Orca was the only render path.
- Push was complicated: local `main` in the main checkout was 52 commits behind origin with 1 unpushed docs commit and someone's staged `GO-TO-PRODUCTION.md` edit, so the plan needed a second Yes/No and a temporary unstage/restage.
- `package-lock.json` showed modified for the whole session (npm stripped `libc` fields); noticed only at retro.

## Root causes (blameless)
- No project adapter, so the ui-mock skill had nothing to point at.
- Nothing prompts "is this recurring or one-off?" when a request is event-flavored; and no check flags a stale local `main` before a push is requested.
- Local `main` checkout is used as a scratch area for WIP (staged edits), while the push rule requires merging there.

## Changes codified this turn
- `AGENTS.md`: added `## UI mock adapter` (scaffold, styles, theme param, dev, Orca verify, client-side date rule).
- Memory `feedback-banners-unique-dated-ids` (earlier this session): dated-id banner rule and `HOME_BANNERS` fields.
- `package-lock.json` restored to HEAD (noise).

## Enforcement map
| Lesson | Mechanism | Wired and live? |
|---|---|---|
| UI mocks use the adapter | `ui-mock` skill reads `## UI mock adapter` in AGENTS.md (imported by CLAUDE.md) | Text only; skill instruction, on this branch, not yet on main |
| Dates checked client-side on cached pages | Code comments + adapter line | Text only (no test fails if a server-side date check is added) |
| Dated-id banners | Memory + `AnnouncementBanner` tests (new id re-shows, window, link) | Tests live in `tests/unit/announcement-banner.test.tsx`, pass |
| Stale local main before push | Nothing | Not wired, see action item |

## Action items
- [ ] owner | main checkout `~/Documents/Development/reach-radio-nextjs` | before next push | decide on the staged `docs/superpowers/plans/GO-TO-PRODUCTION.md` edit (commit it or discard it) so main stays clean; copy of the diff at `$TMPDIR/go-to-production-staged.patch` may be gone, so do not rely on it
- [ ] me | this branch | next session | push the AGENTS.md adapter and this retro (docs-only, needs owner Yes/No push question) so the adapter is on main
- [ ] me | next push request | next push | run `git rev-list --count main..origin/main` in the main checkout and surface a stale main in the first push question, not after
- [ ] owner | Playwright MCP | when convenient | run `npx @playwright/mcp install-browser chrome-for-testing` so headless screenshots work without Orca, or confirm Orca-only is fine

## Pruned
- Nothing pruned: no rule or memory was contradicted; the AGENTS.md addition is about 10 lines of project config (not the always-loaded global budget).
