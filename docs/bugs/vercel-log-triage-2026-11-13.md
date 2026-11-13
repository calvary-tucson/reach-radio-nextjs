# Vercel log error triage (CAL-203), 2026-11-13

Read-only. Project `reach-radio-nextjs`, scope `calvary-tucson-s-team`, production, last 1 day (pulled about 20:55 UTC Nov 13). Context: `docs/bugs/vercel-usage-spike-2026-11.md` 8h and 8i.

## Method and limits

- `vercel logs ... --level error --since 1d --limit 50 --json`: 2 rows.
- Same with `--status-code 4xx`, `--status-code 5xx`, `--level warning`: 0 rows each.
- `vercel logs` has no User Agent or duration. The dashboard Request Logs list view was checked only for `/api/stream-info-sse` (owner screenshot, see below); it shows no User Agent or duration, so every user-agent claim below is unverified.
- Prod `curl` checks at 20:56 UTC Nov 13.

- Owner check (dashboard error view, Nov 13): only the ads.txt rows appear. Matches the CLI result. Exact filter and time window were not captured.

- Owner later supplied a Request Logs screenshot filtered to `/api/stream-info-sse` (last day). Rows 3, 4 and 5 below come from it. Duration and User Agent are not visible in the list view.

## Table (ranked: cost, then user-facing, then bot noise)

| # | Route | Status | Message | UA (bot/human) | Runs function (cost)? | Evidence | State |
|---|-------|--------|---------|----------------|-----------------------|----------|-------|
| 1 | `POST /ads.txt` (host `reachradiotucson.com`) | 200 | `Expected the resume to render <div> in this slot but instead it rendered <__next_metadata_boundary__>` (digest 905131839) | Unverified. A POST to a text file is not browser behavior, so likely a bot or probe | Logged `source: serverless`, `cache: HIT`. Short-lived, no held-open time. Cost low but nonzero (2 rows) | `err.jsonl`: 2 rows, both 2026-11-13T12:08:01Z, deployment `dpl_BQ7gLyEBVjTgu5SKX6QMSMke3m2f` | Likely fixed. Static `public/ads.txt` shipped in 32f8e61 (on origin/main). Prod now: `GET /ads.txt` 200 `text/plain`, `POST /ads.txt` 405. Both error rows predate that check by about 9 h. Whether the fix deployed before 12:08Z is unverified, but no new error rows since |
| 2 | Any unmatched path, e.g. `/nope-xyz`, `/nope-xyz/a/b` | 200 (soft 404) | none logged (no error row, not in 4xx query) | Unverified (bots probing, e.g. `/wp-login.php`, are expected; not read) | No. `x-matched-path: /[...catchAll]`, `x-nextjs-prerender: 1`, `x-vercel-cache: HIT` on both paths. Served from cache, not a function | curl 2026-11-13 20:56Z | Open. Cause now documented: Next docs (`app/02-guides/streaming.md` "Status codes", `not-found.md` line 13) say streamed responses return 200 for `notFound()` because the status is sent with the first chunk. `src/app/[...catchAll]/page.tsx` calls `notFound()`, but the root layout/PPR shell streams first. Also the 404 page carries two robots metas, `noindex` and `index, follow` (conflicting; noindex wins in practice but unverified for crawlers) |
| 3 | `/api/stream-info-sse` (retired, returns 204) | 200 before the 204 deploy, 204 after | none | Not shown in list view | Held-open 200s were the cost. 204 hits are short | Owner screenshot (Request Logs, Request Path filter, last day, Nov 13 about 14:05 local): 232 hits in 1 d. Last `200` at Nov 13 13:16:33 (`reach.radio`). After that only two `204` rows at 13:20:38 (`reach.radio`, `reachradiotucson`), probably the push-verification curls (unconfirmed). Sparse `200`s earlier: Nov 12 23:30, 23:06; Nov 13 06:52, 07:23, 09:29 (`www.reachradiotucson`), 12:28, 12:33 | Clean since the 204 deploy: no real client reconnects seen in about 45 min. Probe curl at 21:04:47Z (UA `claude-triage-probe`) now seen: Nov 13 14:04:46.83 local, `GET 204`, `reach.radio` (second owner screenshot), so logging and the 204 both work. Confirm with the Nov 16-17 usage recheck |
| 4 | ~2 min cadence requests, `reach.radio`, Nov 12 about 22:14-22:41 local | 200 | none | Unverified (list view has no UA or duration) | Likely yes: `200` GETs on the SSE route. One client reconnecting about every 2 min: 22:14:49, 22:16:49, 22:18:16, 22:20:49, 22:22:50, 22:23:50, 22:24:50, 22:26:50, 22:27:50, 22:29:50, 22:31:49, 22:33:49, 22:35:50, 22:37:49, 22:39:49, 22:41:49 | Same owner screenshot | Row detail for Nov 12 22:29:50 (owner paste): `GET 200`, `reach.radio`, received pdx1, ran in iad1, Execution Duration 10m18s, Fluid 236 MB, deployment `dpl_BQ7gLyEBVjTgu5SKX6QMSMke3m2f`. The detail panel has NO User Agent field, so the client stays unidentified. The "2 min cadence" is request START times; each request lived about 10 min, so about 5 connections overlapped at once (multiple tabs or clients, or one client opening several). Same long-held 200 pattern as the Android row (11m32s, 229 MB), not a reconnect loop. Cost source confirmed, now retired by the 204. Client type unknown: stale old-JS tabs are most likely, owner's own testing not ruled out. Stopped after 22:41 |
| 5 | Bot probes: `/wp-content/themes/...`, `/fournisseurs`, `/assets/images/admin...` (1 hit each), `/.well-known/assetlinks...` (31 hits) | not seen | none | Unverified, look like probes | Unknown, likely cached catch-all | Path facet in the same screenshot | Not triaged. `assetlinks` (31) may be a real Android app link check: verify whether `/.well-known/assetlinks.json` exists |

Not found: any 5xx, any warning-level row, any user-facing 4xx. Zero real error spikes.

## Top 3 fixes

1. SSE retirement confirmed in the list view (no real 200 since 13:16 local). Still open: row detail (Duration, UA) for the Nov 12 22:29:50 2-min cadence client, then re-check `vercel usage --breakdown daily` for Fluid memory in 2-3 days. This is the only item tied to cost.
2. Make unmatched paths return a real 404: add `src/app/global-not-found.tsx` with `experimental.globalNotFound` (check `node_modules/next/dist/docs` for the flag first), or reject unknown paths in `src/proxy.ts`. Needs `next build` before push (see memory: route changes).
3. Remove the duplicate robots meta on the 404 page (`noindex` plus `index, follow`), folded into fix 2.

Decision (owner, Nov 13): fixes 2 and 3 on HOLD. Research: Next docs (`loading.md` "Status Codes") say a streamed `notFound()` returns 200 with Next's own `noindex` meta and "does not lead to indexation"; value is cosmetic. `15eca2e` added the catch-all because the `@modal` slot's own `[...catchAll]` returned a blank 200, and `tests/e2e/not-found.spec.ts` guards it. If ever revisited: prefer a `src/proxy.ts` allowlist (already runs on every non-API request, no new invocations; needs `next build`, `next start`, `curl -I` on all real routes, e2e). `global-not-found.tsx` is experimental, skips the root layout, and is untested with `@modal`/`cacheComponents`. Revisit only if Search Console flags soft 404s.

ads.txt needs no more work beyond watching for new `/ads.txt` error rows.
