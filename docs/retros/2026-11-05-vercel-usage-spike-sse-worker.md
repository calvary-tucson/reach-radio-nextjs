# Retro: Vercel usage spike, now-playing SSE moved to Cloudflare (2026-11-05)

## What was done
- Vercel email: $15 of $20 credit used. Root cause: `/api/stream-info-sse` holds each tab's request open 10-12 min; Fluid compute bills provisioned memory for that time ($9.54 of $15.7).
- Moved now-playing SSE to Cloudflare in two hops: `pages.dev` (`a374daf`, hardening `2b384e2`..`b515a1a`), then the standalone stream Worker `stream.reach.radio` (worker commits `9114d27`, `f225ea4`, `2965db5`; web repoint `c1aee86`).
- Measured stream lifetime on Cloudflare: 25 min held, twice (pages.dev 75 events; worker 74 events). Prod check after push: CSP ok, one SSE connection, no console errors, 0 hits on the Vercel route in 10 min.
- Docs: `docs/bugs/vercel-usage-spike-2026-11.md`, plan `2026-11-05-stream-worker-now-playing-sse.md`, roadmap row 20.

## Addendum (same day): web audio on the Worker
- `46e0145` points the web player at `https://stream.reach.radio/`, web-only (native config and Sanity untouched, Phase F gate stands). Local and prod checks passed (128 s, no errors). Details: bug doc 8c, 8d.
- Process note: the first dev-server attempt ran in the sandbox (Doppler TLS failure, EMFILE, 404) and needed a sandbox-off Yes/No; the recipe is already in memory `reference-dev-server-doppler-worktree.md`.

## What worked
- Measuring before deciding (25 min hold) replaced a wrong review claim ("Cloudflare closes on a timeout") with evidence.
- Four-reviewer full review caught the teacher-photo race, unvalidated payload and stale docs before push (`2b384e2`, `8c05251`).
- Push as fast-forward from the worktree (`HEAD:main`) avoided shipping unapproved local-only `b101551`.
- Independent re-run of worker tests (25/25) and tsc instead of trusting the child's report.

## What did not
- Same-session fixes after `feat`: `5126170` (backoff reset), `9258642` (fallback title), `8c05251`, `2b384e2`. Review found them, so the process caught them, but the first SSE port had no jitter, validation or title mapping.
- Repoint left `use-now-playing.test.ts:60` red (old pages.dev regex) until the test run.
- Misread: 3 SSE connections per 77 s looked like an app bug; cause was Orca's embedded browser firing `visibilitychange` about every 20 s.
- Vercel CLI wrong-scope errors (right scope `calvary-tucson-s-team`); first push answer garbled and needed a re-ask; child's first red run used bare `rg-run` after cwd reset and ran no tests.
- Cost drop itself not yet proven (needs 1-2 days of usage data).

## Root causes (blameless)
- No checklist for "port an endpoint to another host": wire-format hardening (jitter, validation, fallback title), CSP, and tests that assert the old URL are discovered ad hoc.
- Orca's browser visibility behavior is undocumented in project docs, so reconnect noise looked like a bug.
- Vercel scope not recorded anywhere; found by trial.
- Child dispatch prompts did not say "cd explicitly before rg-run" (cwd resets between calls).

## Changes codified this turn
- `docs/bugs/vercel-usage-spike-2026-11.md`: section 8b (worker cutover), recipes already include dev-server and Vercel notes.
- Plan Task 3 steps 1-4 marked done; roadmap row 20 status fixed.
- Memory: `project-audio-stream-cloudflare-not-vercel.md` updated with cutover state, Vercel scope, Orca visibilitychange note.
- No global rule or skill change: each lesson is first occurrence and project-specific (see Pruned).

## Action items (owner | tracked in | due | done when)
1. owner | this file | 2026-11-13 (owner returns; moved from Nov 7) | `vercel usage --scope calvary-tucson-s-team --breakdown daily` shows Fluid Provisioned Memory for Nov 6-12 sharply lower than about $0.78/day; result added to the bug doc.
2. owner | plan Task 3 step 5, roadmap row 20 | before iOS v4 ships | `NowPlayingService.swift` points at `https://stream.reach.radio/api/stream-info-sse`.
3. DONE 2026-11-05: Worker repo pushed (`2965db5`, then `2965db5..240ab5a` with teacher resolution).
4. owner | bug doc 8d | after the Nov 13 cost check | Yes/No decided on disabling the old Vercel SSE route (204 or tiny `maxDuration`).
5. me | bug doc section 8 | after iOS v4 and stale tabs gone | Vercel SSE route retired, `pages.dev` removed from `media-src` plan reviewed.

## Pruned
- Roadmap row 20 stale status ("not deployed") replaced. Nothing removed from always-loaded config; none added.
