# Audio Stream — Master Roadmap

Decision (2026-10-13): Vercel never serves the audio stream; Cloudflare only. B redirect now, standalone Worker later, run in parallel with the legacy `pages.dev` Astro function until the published apps are retired. Detail: `2026-10-09-stream-hosting-decision.md` §4d. Gate before DNS cutover: `2026-10-09-web-cutover-findings-and-checklist.md` §6 "Audio gate".

Features are dropped only when the user says so.

| # | Item | Source | Depends on | Status | Subplan |
|---|---|---|---|---|---|
| 1 | B redirect on the new site (307 → pages.dev, CSP `media-src`) | decision §4b/§4d | — | Built on `test/stream-redirect-b` (369b14a); local 307 verify pending user dev server | `2026-10-09-ios-v4-stream-redirect-test.md` |
| 2 | iOS v4 stream override + soak harness | test plan Tasks 3–4 | — | Override committed (f16966e); soak UI test uncommitted | same |
| 3 | T0 control (Vercel proxy cut) | test plan Task 5 | 2 | Done 2026-10-12 | same |
| 4 | T1 cold start/prefetch through the 307 | test plan Task 6 | 1, 2 | Done 2026-10-14 (decision §4c) | same |
| 5 | T2 ≥60 min soak, T3 network flap, T4 system integration (real device) | test plan Task 7 | 4 | T2 skipped by user decision 2026-10-14 (simulator soak aborted at 33 min when the dev server on :3000 went away, not a stream failure; `pages.dev` already held 61m40s via item 6). T3, T4 pending, user-run on real device | same |
| 6 | 60-min `pages.dev` max-session curl | test plan Task 1 step 3 | — | Done 2026-10-14: held 61m40s, 59.3 MB, no cut (run 1 stalled at 14m11s inside sandbox proxy, see decision §4d) | same |
| 7 | Land B on `main` and delete `route.ts` (same change) | decision §4d | 1, 4 | Committed locally on `main` 0fb8718 (redirect + CSP, `route.ts` removed, config test); not pushed; local 307 curl and deploy-time 307 check pending | none yet |
| 8 | Cutover audio gate in cutover checklist | cutover checklist §6 | 7 | Recorded | cutover checklist |
| 9 | Worker repo `reach-radio-audio-stream-worker` (passthrough, no Icy-MetaData, clear timeout, `no-store`) | decision §4d | 6 | Not started | `2026-10-14-audio-stream-worker.md` |
| 10 | Multi-hour Worker soak incl. one `wrangler deploy` mid-stream | decision §4d | 9 | Not started | `2026-10-14-audio-stream-worker.md` |
| 11 | Flip Sanity `radioAudioURL` to `stream.reach.radio`, re-point redirect, CSP `media-src` (user edits Sanity) | decision §4d | 10 | Not started | `2026-10-14-audio-stream-worker.md` |
| 12 | Long-term ownership and sunset plan for the legacy `pages.dev` Astro project (retire when published Android/iOS 3.2 and Watch/v4 hardcodes are gone) | decision §7b | — | Unwritten | none yet |
| 13 | Delete `/api/stream-info` after a Vercel log check (no callers found) | decision §4d | log check | Pending | none yet |
| 14 | Sanity `radioAudioURL` field: description + https validation (studio `appSettings`) | decision §4d | — | Not requested | none yet |
| 15 | Web player `onEnded`/`onStalled` handlers | decision §4b | — | Not started | none yet |
| 16 | iOS ticket: no `DidPlayToEnd` handler, no stalled-state UI in the ~13 s gap, retry-counter reset unverified | T0 result | — | Not filed | none yet |
| 17 | Shared Radiojar poll cache for `stream-info-sse` (~33 req/s upstream at 1000 listeners) | decision §4d | growth | Deferred | none yet |
| 18 | Housekeeping: delete `/tmp/cf-token` and revoke the Cloudflare read-only token | session | — | `/tmp/cf-token` deleted 2026-10-14; token revoke dropped by user decision 2026-10-14 (token stays live) | — |
