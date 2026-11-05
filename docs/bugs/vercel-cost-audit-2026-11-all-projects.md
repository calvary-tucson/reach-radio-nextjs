# Vercel cost audit, all projects (2026-11-05) and post-vacation plan

Follow-up to `vercel-usage-spike-2026-11.md`. Owner is on vacation 2026-11-06 to Friday 2026-11-13. **Decision: hold all deploys until the owner is back.**

Evidence labels: **Verified** = CLI output or code read. **Inferred** = reasoned, not measured.

## 1. Billing facts (Verified)

- Team `calvary-tucson-s-team`, Pro. Billing period **Oct 24 to Nov 24** (API period start/end). $20 credit covers all metered usage; the $20 platform fee ($0.6452/day in `vercel usage` daily output) is separate and not credit usage.
- Spend Management (owner screenshot, 2026-11-05): budget **$5**, **Pause Off**, webhook Off. Hitting the budget only alerts (50/75/100%); it cannot take sites down. Vercel docs conflict on pause defaults, the dashboard is the truth.
- Cloudflare in front of Vercel: Vercel advises against it (loses firewall/bot visibility, cache issues). Always Online will not help against a Vercel 503.

## 2. Reach Radio fix result (partial)

- Fluid Provisioned Memory per day: Oct 29 $0.50, Oct 30 $1.98, Oct 31 $1.92, Nov 1 $2.75, Nov 2 $0.91, Nov 3 $0.76, Nov 4 $0.78, **Nov 5 $0.02 (partial day, about 9h)**.
- Fix (Cloudflare SSE) deployed about Nov 4 evening. **Not yet confirmed**: recheck `vercel usage` for Nov 5 and Nov 6 full days. Success = near $0.
- Cloudflare SSE stream lifetime: one `curl -N` stream stayed open the full 25 minutes (curl time cap, 200, exit 0). Cloudflare did not cut it.

## 3. Usage numbers (Verified, `vercel usage --group-by project`)

| Period | svelte | reach-radio | nextjs | prayer | Total usage |
|---|---|---|---|---|---|
| Aug 24 to Sep 23 | $12.04 | $0.23 | $0.77 | $0.02 | $13.07 |
| Sep 24 to Oct 23 | $13.13 | $0.24 | $1.25 | $0.03 | $14.65 |
| Oct 24 to Nov 5 (13 days) | $3.95 | $10.74 | $1.23 | $0.01 | $15.93 |

- Normal baseline is about $0.45/day, mostly svelte (Function Duration about half of svelte's bill: $6.48 and $7.31 in prior months).
- **Projection to Nov 24:** $15.93 + about 18.6 days x $0.45 = about $24 to $25, so about **$4 to $5 over the credit**, billed on demand automatically. Inferred. The overage is from the SSE spike, not normal usage.
- calvarytucson-nextjs: about $1.2/month, almost all Deployment Storage ($0.69), Function Storage ($0.34), Build CPU ($0.14). Not traffic. Not over budget.

## 4. Svelte request sample (Verified, directional only)

Method: `vercel logs -p calvarytucson-svelte --environment production --json`, 12 short windows over about 40h, 493 requests (307 serverless). Counts requests, not duration or dollars. The CLI caps at 50 lines per call, so this is a biased sample.

Serverless MISS counts: `/api/live-stream-status` 82 (top, never cached), `/api/YouTubeCoverImage` 32 (MISS despite s-maxage=120), `/teachings/_app/...` 36 (odd: looks like asset paths hitting a function, possible bug), `/teachings/topics` 31, `/teachings/[teaching]` 27, `/teachings/pcl-radio` 20, `/manifest.json` 17.

**Correction:** the code audit ranked `teachings-search` (3000-doc Sanity pull per keystroke) as the biggest lever. The sample does **not** show search APIs at all. Treat that ranking as unconfirmed.

## 5. Code audit findings (Inferred from code, no per-route measurement)

### calvarytucson-svelte (SvelteKit, adapter-vercel nodejs22, legacy Function Duration, single `__root__` function)

1. `src/routes/api/live-stream-status/+server.ts:19-30`: no Cache-Control. Client polls every 30s in `src/routes/live-stream-east/+page.svelte:35,296`, even when status is 'none'. Confirmed by sample. Fix: `s-maxage=30, stale-while-revalidate=60`; poll 120s when none, pause when `document.hidden`.
2. `src/routes/manifest.json/+server.ts` and `src/routes/sitemap.xml/+server.ts`: uncached Sanity queries (1 and 9) per call, no cache headers. Manifest confirmed by sample.
3. `src/routes/+layout.ts:20-37`: Sanity siteSettings query on every SSR request, `useCdn:false`. Fix: `useCdn:true`.
4. Marketing pages (about, connect, give, what-we-believe, who-we-are, podcasts, times-and-locations, schedule-a-tour, careers, know-god, join-the-servant-team, mobile-app) are SSR per request. Fix: ANONYMOUS_ISR_CONFIG per group, never in `src/routes/+layout.server.ts` (would cover /access).
5. `src/hooks.server.ts:95-316`: Descope auth block runs for every `/api` path when auth cookies present. Fix: scope to `/access` and authed APIs.
6. Search APIs uncached (`teachings-search` memoize 10 min; others s-maxage=300). Not confirmed by sample.
7. ISR: expiration 86400s rewrites every visited path daily; sitemap lists every slug (crawlers write ISR). Raise expiry only after adding missing `TYPE_TO_PATHS` entries (`sanity-revalidate.ts:92-93`: siteSettings, bulletin, career, timesAndLocation, conference, hotTopic, questionAndAnswer) or those pages go stale.
8. Low: `split:true` in adapter options; function region to match Sanity.
9. **Security, not cost:** hardcoded YouTube API key at `src/routes/api/YouTubeCoverImage/+server.ts:7`. Owner to rotate. Also confirm `.vercel/` is gitignored (ISR bypass token is written under it).

### calvarytucson-nextjs (Next 16)

- Low repo-side risk now. No SSE, Vercel image optimization bypassed (custom Sanity loader `src/lib/sanity/sanity-loader.ts`), crons run in GitHub Actions.
- Dashboard levers (unverified, not visible in repo): lower deployment retention, limit preview builds (no `vercel.json`, no ignoreCommand).
- Dev-only routes compiled into prod: `src/app/(prototype)/dev/**` (35 pages), `src/app/api/dev/*` (19 routes).
- Before traffic moves here: 10 `*/search/route.ts` with no Cache-Control, `video/[id]` and `youtube/[id]` ISR with unbounded IDs (`generateStaticParams` presence unverified), `force-dynamic` public pages (`/search`, `/prayer`, `/about/search`), commented "no-op until configured" rate-limit rule for `/api/live-stream-status` (`route.ts:15-20`), `proxy.ts` matcher catch-all for percent-escaped paths.

## 6. Observability Plus (Verified from docs, last updated 2026-07-06)

- $1.20 per 1M events, usage-based, no base fee. "Event" not defined on the page; no Pro free allowance stated. Owner role only. Team-level toggle with per-project exclusion. Enable: Team Billing settings > Observability Plus, or `vercel buy addon observability-plus`.
- Adds path/route breakdown for functions, ISR revalidation data, CDN requests by path, 30-day retention. Backfill not stated (assume none). Disabling mid-cycle loses existing data.
- Owner screenshot of Billing > Add-Ons (2026-11-05, Verified): Observability Plus shows "Included + $1.20/1M events", toggle currently **Off**. Speed Insights Plus ($10/mo per project + $6.50/100k events) and Web Analytics Plus ($10/mo + $3/100k) are separate paid add-ons, also Off. Do not enable those two for this audit.
- Decision: **do not enable before vacation**. Enable on svelte only after return.

## 7. Cloudflare free-cap risk (open)

`reach-radio-web.pages.dev` now carries Next.js SSE traffic, the `/api/audio-stream` redirect target, and the Android and iOS v3 site on one 100k requests/day free account cap (error 1027 when exceeded). Daily count not yet read (needs signed-in Cloudflare dashboard, Workers & Pages > Analytics). Workers Paid is $5/mo, 10M requests. Owner chose: check counts first.

## 8. Held work (nothing deployed)

- An implementer was dispatched to prepare unpushed branches in `~/Documents/Development/calvarytucson-svelte`: `perf/cache-headers` (header-only) and `perf/server-cost` (stacked: search memoize, Descope scoping, root layout CDN, live-stream poll, marketing ISR). **Not pushed, not deployed.** Check branch state with `git branch` there; re-review before any merge, because the sample reordered priorities.
- **Implementer finished (local commits only, nothing pushed, from main 36e6bf87).** Self-reported: `npm run check` 0 errors, unit tests 998 (A) and 1029 (B) pass, build exit 0, local curl checks pass. Re-review before merge.
  - `perf/cache-headers`: f68e5a9a (new `guardSetCookieCaching` in `src/hooks.server.ts`, beyond the brief: rewrites responses that set cookies to `private, no-store` so a cached Set-Cookie cannot leak), 2e615450 (search APIs, non-empty `q`, s-maxage 300), 924c326e (live-stream-status 30s, sitemap 3600, manifest 86400).
  - `perf/server-cost` (stacked): f773b240 (teachings-search memo 10 min), 7900ff05 (Descope only for `/access*`, `/api/user-`, `/api/prayer-`, `/api/descope/`, `/api/access-`; public API URLs no longer redirect to login when logged out), 9a74abe2 (siteSettings via Sanity CDN, can lag CMS edits), 17587e61 (poll 30s live/upcoming, 120s none, pause hidden: a stream going live may take up to about 150s to show), e1eb7ae4 (anonymous ISR on 10 marketing pages plus what-we-believe/*; `give` skipped because of its date-based giving state; those pages only refresh on the 24h expiry).
  - Review flags: prettier reformatted events-search, ministries-search, manifest and `+layout.ts`, inflating diffs (consider splitting formatting from logic); one inline python script was used for the search-route edits against the rules; ISR bypass-token env var not verified; ISR behavior only provable on a Vercel deploy; `give` and anything using cookies or dates must stay out of ISR.
  - **Revise before merge:** drop the 120s slow poll in 17587e61. With `s-maxage=30` on `live-stream-status` the CDN already caps origin calls at about one per 30s however many tabs are open, so the slower client poll saves almost nothing and only delays "stream is live" by up to about 150s for open tabs. Keep the 30s poll plus pause-when-hidden. Also check the server-side 10-minute per-instance cache in `src/lib/server/youtube-live-status.ts` (already adds minutes of detection lag).
  - Priority note: the log sample (section 4) confirms live-stream-status and manifest as real costs and does not confirm the search APIs. Deploy header commits first, watch, then the rest one at a time.
- Do not release iOS v4 while away (still calls the Vercel SSE route).

## 8b. east-live finding and offload research (2026-11-05)

- **east-live (Verified in browser):** `east-live.calvarytucson.com` is a Cloudflare-hosted page. Loaded, it showed the "Recent Teaching (Recorded)" fallback video plus schedule, and it called `https://calvarytucson.com/api/live-stream-status` (HTTP 200), the svelte endpoint on Vercel. So every open east-live tab adds to the top uncached svelte hit. Polling interval not measured; its poll code location is unconfirmed.
- **Where the code lives (owner: "in both svelte and nextjs"):** `calvarytucson-nextjs` has the `/live-stream-east` page (plan `docs/superpowers/plans/2026-08-19-live-stream-east-page.md`) and `next.config.ts:93-108` allows framing only by `https://east-live.calvarytucson.com` (`frame-ancestors`), so east-live frames that page. svelte has its own `src/routes/live-stream-east`. Which one east-live actually frames today (Inferred: whichever serves `calvarytucson.com`, currently svelte) and what west-live is: not verified.
- **Nov 13 action:** find who calls `/api/live-stream-status`; the `s-maxage=30` header fix covers all callers, so deploy it first. Consider serving that status from a Cloudflare Worker with a short cache.
- **New global rule (offload ladder):** `~/.claude/CLAUDE.md` stub plus full text in `~/.claude/docs/claude-md-reference.md` "Offload ladder": static, CDN headers, free CDNs, Cloudflare Worker for streams/polls/media, GH Actions crons. Free Cloudflare tiers are cliffs (100k requests/day error 1027, Images 5,000 transforms/month, KV 1,000 writes/day).
- **Unverified offload candidates to check on Nov 13:** Pagefind static search index instead of the uncached search APIs, client-side Sanity API-CDN GROQ, R2 for large media, Vercel firewall rules for crawlers writing ISR pages, Turnstile.
- **Whole-app moves are not recommended now:** svelte `adapter-cloudflare` has no ISR equivalent; Next 16 on OpenNext conflicts with PPR cache interception and lacks Node Middleware.

## 9. Pick-up checklist for Nov 13

1. `vercel usage --from 2026-11-05 --breakdown daily`: confirm Reach Radio Fluid memory about $0 each day and svelte per-day vs $0.45 baseline (Sunday Nov 8 and Nov 15 spikes).
2. Check Spend Management spend and whether any budget alerts fired (budget $5 unless raised).
3. Read the Cloudflare daily request peak; buy Workers Paid ($5) if near 50k/day.
4. Enable Observability Plus on svelte only; after 1 to 2 days, rank routes by function duration and ISR revalidation.
5. Investigate `/teachings/_app/...` serverless hits and why ISR pages `/teachings/topics`, `/teachings/pcl-radio`, `/teachings/[teaching]` run as functions.
6. Re-review the held svelte branches against measured data, then deploy header changes first, other changes one at a time with watch time.
7. Set Deployment Retention and preview-build limits on calvarytucson-nextjs; plan the Next.js search cache headers and dev-route exclusion.
8. Plan the standalone Worker (`stream.reach.radio`) and repoint iOS v4 `NowPlayingService.swift` before it ships.
9. Owner: rotate the YouTube API key (item 5.9).
