# Vercel cost audit, all projects (2026-11-05) and post-vacation plan

Follow-up to `vercel-usage-spike-2026-11.md`. Owner is on vacation 2026-11-06 to Friday 2026-11-13. **Decision: hold all deploys until the owner is back.**

Evidence labels: **Verified** = CLI output or code read. **Inferred** = reasoned, not measured.

## 0. Summary of everything (2026-11-05)

1. **Reach Radio fix:** SSE moved to Cloudflare Pages; Fluid memory fell from $0.78/day to $0.02 on a 9h partial day. Needs full-day recheck (Nov 6+).
2. **Usage:** $15.93 of the $20 credit used by Nov 5 (svelte $3.95, reach-radio $10.74, nextjs $1.23, prayer $0.01). Projection to Nov 24: about $24 to $25, so about $4 to $5 on-demand overage (Inferred). Spend Management budget was $5, **raised to $30 by owner 2026-11-05**; Pause Off, so alerts only, no outage.
3. **calvarytucson-nextjs:** about $1.2/month, not over budget. Risks listed in section 5.
4. **calvarytucson-svelte:** baseline cost driver (about $12 to $13/month). Log sample says `/api/live-stream-status`, `/api/YouTubeCoverImage`, `/manifest.json` and teachings pages are the real hits; search APIs not confirmed.
5. **Held (nothing deployed):** unpushed svelte branches `perf/cache-headers` and `perf/server-cost`; drop the 120s slow poll in 17587e61 before merge.
6. **Observability Plus:** "Included + $1.20/1M events", currently Off; decision was to enable after return.
7. **east-live finding:** east-live (Cloudflare-hosted) polls Vercel svelte `/api/live-stream-status`. Owner says the east-live and west-live code lives in **both** `calvarytucson-svelte` and `calvarytucson-nextjs` (which repo serves which page is not yet verified; confirm on Nov 13).
8. **New global rule (offload ladder):** see 8b. Config repo commit 32ad0c7.
9. **Owner items:** send "recheck usage" and Cloudflare peak daily requests tomorrow; rotate hardcoded YouTube key; do not release iOS v4; budget raise to $30 done; optionally add SMS alerts and enable Observability Plus.

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
10. DONE (code read 2026-11-05, see section 10): east-live/west-live pollers, interval, hidden-tab behavior and callers. Remaining: confirm which page `east-live.calvarytucson.com` actually frames and its poll code (external, not in either repo).
11. Offload candidates evaluated in section 10 (Pagefind, Sanity CDN, R2, firewall, Turnstile). Remaining: re-rank against Obs Plus data, and read the Sanity plan tier in the Manage dashboard.
12. Merge this docs branch (`calvary-tucson/vercel-usage-audit-reach`) to main and push (deploys reach.radio; owner chose to hold until Nov 13). Also commit the config repo offload-rule commit 32ad0c7 push if wanted, and run `retrospective` when the effort closes.
13. Work through the section 10 action list as changes to the held `perf/cache-headers` and `perf/server-cost` branches, not parallel branches.

## 10. Offload delta audit (2026-11-05, read-only)

Delta on sections 5 to 8b. Labels: **V** = read in code or on a primary doc page this session, **I** = inferred. No deploys, pushes or branches. Method: three read-only agents (svelte code, nextjs/prayer/reach-radio code, primary-doc research) plus direct greps. Conclusion first: **most savings are small (usage is about $15/month inside a $20 credit); the real levers are caching and quota hygiene, not moving hosts.**

### 10.1 `/api/live-stream-status` (top measured cost): header beats Worker

- **Pollers (V):** svelte `main` `src/routes/live-stream-east/+page.svelte:35,296` `setInterval` 30s, no visibility handling, no backoff. Branch `perf/server-cost` adds `live-stream-poll.ts:3-9` (30s active, 120s when none) and pause-when-hidden (`+page.svelte:256-270`). nextjs `LiveStreamEastPlayer.tsx:47,189` polls 30s, keeps polling while the video plays (no stop path), pauses when hidden (`:260-284`), no backoff (`:219`). West-live: no code in either repo (comment only, `+layout.svelte:24`, `ChromeShell.tsx:14`). Service worker is NetworkOnly for it (nextjs `sw.ts:37-43`). An external east-live embed calling the endpoint is I.
- **Headers (V):** svelte `main` has no Cache-Control (`+server.ts:19-30`); the held branch adds `s-maxage=30, swr=60`. nextjs `route.ts:39` already sends `s-maxage=30, swr=60`.
- **Worker comparison (I, from V Cloudflare facts):** one tab polling every 30s is 2,880 requests/day, so about 35 always-open tabs fill the 100k/day Workers Free cap; Cache API hits still invoke the Worker and count (docs: developers.cloudflare.com/workers/platform/pricing, 2026-11-05). The Vercel CDN `s-maxage=30` hit costs no function duration. **Do not move this to a Worker.** Ship the header (already on `perf/cache-headers`).
- **Real remaining cost is YouTube quota, not Vercel (V code, I math):** svelte `youtube-live-status.ts:33-34` caches 10 min per warm instance; with no stream, `checkLiveStatus` runs `search.list` (100 units, `:51-76`) plus a 2-unit playlist check (`:113-157`), about 102 units per refresh, about 14.7k units/day for one warm instance against the 10k/day default. Errors are cached the full 10 min in svelte (`:74`) but only 45s in nextjs (`ERROR_CACHE_TTL_MS`, `youtube-live-status.ts:44`). Confirm real usage in Google Cloud console before changing. Fix on `perf/server-cost`: skip `search.list` outside service windows, or share the nextjs 45s error TTL; and the `s-maxage=30` header collapses instances.
- **Both east pages run SSR per view (V):** svelte `live-stream-east/+page.server.ts:11-26`, nextjs `live-stream-east/page.tsx:12` (`force-dynamic`) each call `resolveLiveStreamStatus` per load. Fetch the cached endpoint client-side or give the page a short ISR.
- **Rate limit rule is a no-op (V):** `checkLiveStreamRateLimit` fails open until a Vercel dashboard rule named `live-stream-status` exists (`+server.ts:16-19`; nextjs `route.ts:15-20`).
- Held-branch revision still stands: drop the 120s slow poll (section 8).

### 10.2 `/teachings/_app/...` as functions: cause CONFIRMED, and it is a user-facing bug (V, curl 2026-11-05)

- **Reproduced (V):** production `https://calvarytucson.com/teachings/topics` returns 200 with `href="../_app/immutable/assets/0.f7e03e9f.css"`. The trailing-slash URL `/teachings/topics/` also returns 200 (no redirect) with the **same** `../_app/...` href, which resolves to `/teachings/_app/...`. `GET /teachings/_app/immutable/entry/start.js` returns **302 to `/`** (the catch-all redirect), while `/_app/version.json` returns 200. So trailing-slash teachings URLs, including any crawler or shared link that has a slash, load without their CSS and JS, and each asset request runs a function. Cost and correctness bug. Not yet checked: which of the other nested ISR groups have the same shape.
- Below: the code chain that explains it (V code) and the fixes to test in a Vercel preview.

- V: `kit.paths` unset so `paths.relative` defaults true (relative `./_app` asset URLs, `render.js:98-100,149`); no `trailingSlash` setting (default never); `.vercel/output/config.json` has teachings rewrites with `?__pathname=` at indexes 205-244, `handle: filesystem` at 25, catch-all to `/fn` at 281-282; `[...redirects]/+server.ts:44-60` 302s any unmatched GET to `/`.
- I: a trailing-slash variant of a `/teachings/...` page resolves relative asset URLs one level shallow, misses the static `_app` files, falls to the function, and the catch-all redirects. Fixes to test in a Vercel preview: (a) `kit.paths.relative: false` in `svelte.config.js`; or (b) a trailing-slash 308 for `/teachings/:path*/` in `vercel.json`. Add to `perf/cache-headers` or `perf/server-cost` only after a preview confirms.

### 10.3 Large media: R2 is a non-finding (V)

- `calvarytucson-svelte/static` 3.7 MB total, `calvarytucson-nextjs/public` 1.8 MB (largest file 265 KB), `prayer-nextjs/public` 4 KB, `reach-radio-nextjs/public` 60 KB; no file over 1 MB in any. Media is served from Sanity CDN and YouTube. Skip R2.

### 10.4 Cloudflare-hosted sites and the shared 100k/day cap

- **Corrected after `astro.config.mjs` and `dist/_routes.json` check (V):** no `functions/` folder does not mean static. `prayer-astro-unpoly` (`output: 'server'`) and `reach-radio-web` (`output: 'server'`, plus API routes `audio-stream.ts`, `stream-info-sse.ts`, `stream-info.ts`) run every non-excluded request through a Pages Function; `_routes.json` excludes only `/_astro/*` and a few static files, so **every page view counts toward the 100k/day cap** (static-asset exclusions are free). `bridgehome-web` is `output: 'static'` with the Cloudflare adapter; its `_routes.json` still includes `/*` minus a handful of pages (`/about`, `/contact`, `/services` and similar), so `/` and unlisted paths still invoke the Worker (I: confirm whether `dist/_worker.js` serves them from prerendered output). `truth-quest-htmx`: a Worker with static assets (`src/index.ts`), so every non-asset request hits the Worker. `reach-radio-audio-stream-worker`: Worker on custom domain `stream.reach.radio`. Net: reach-radio-web v3 page views (the legacy app site for Android/iOS v3) plus SSE connects plus audio redirects share one cap; measure before adding anything.
- **No `wrangler.toml` contains `account_id` (V grep), so whether these share one Cloudflare account is unverified.** Check with `wrangler whoami` / the dashboard. If shared, every new Worker request adds to the same 100k/day; Static asset requests are free and unlimited (V, Workers pricing page). Buy Workers Paid ($5) or split accounts before adding any polled endpoint. Do not add the live-status poll there.

### 10.5 Candidates tested against this stack

- **Pagefind: technically fits, not yet justified.** Node API `createIndex` / `addCustomRecord({url, content, language})` / `writeFiles` indexes records with no HTML pages; no server component (V: pagefind.app/docs/node-api, /docs, 2026-11-05). Incremental indexing and index size not documented (could not verify); plan would be Sanity webhook to GitHub Action to rebuild the index, deploy static files. But the 2026-11-05 log sample did not show search APIs as a cost (section 4), and `perf/cache-headers` plus `teachings-search` memoization already cut them. **Defer** until Obs Plus data shows search routes in the top duration list.
- **Client-side Sanity API-CDN GROQ: not recommended now.** Official Free and Growth quotas: 1M API CDN requests, 250k API requests, 100 GB bandwidth per month; Free and Growth Trial hard-cap with HTTP 402 `plan_limit_reached` until the 1st (V: sanity.io/pricing, sanity.io/docs/platform-management/plans-and-payments). Moving traffic from Vercel to browsers lands on that cap and a 402 takes pages down. Our tier is not visible: read Manage dashboard, Plan, before any such move. (A community post cites 100k API requests on Free; official pages say 250k, use official.) `useCdn:true` for server reads is **a conflict, not a safe win**: the next-sanity README rule of thumb is `true` for static generation and webhook responders, yet its own comment says `false` guarantees no stale content with ISR, and other Sanity and community pages recommend `false` for tag-based revalidation because the API CDN can re-cache old content after `revalidateTag` (search results 2026-11-05, README and sanity.io/docs/nextjs/caching-and-revalidation-in-nextjs; not resolved against our version). Keep `useCdn:false` for any client on an ISR or revalidation path (nextjs `client.ts:16-21,33-39` is already `false`; leave it). The held svelte commit 9a74abe2 (`useCdn:true` for siteSettings under 24h ISR) has the same stale risk: confirm after a publish that the webhook revalidation shows the new value before merging.
- **Cloudflare Images: non-finding.** nextjs bypasses Vercel image optimization via the Sanity loader (`next.config.ts` custom `sanity-loader.ts`, V). svelte `YouTubeCoverImage` returns a URL rather than an image; replacing playlist covers with a stored cover video id and `https://i.ytimg.com/vi/<id>/hqdefault.jpg` removes the per-view API call and quota cost (V code `YouTubeCoverImage.svelte:19-29`, `WhatsNew.svelte:67-82`, four cards on home, each fetches on mount; I that ytimg is reliable).
- **Turnstile: fits forms, not crawlers.** Free: 20 widgets per account, unlimited challenges (V: developers.cloudflare.com/turnstile/plans, 2026-11-05). Use for contact/prayer submit forms only.
- **Vercel Firewall for ISR crawlers: yes, no host move needed.** Bot Protection and AI Bots rulesets are on all plans, off by default; WAF Rate Limiting on all plans, Pro 40 rules, from $0.50 per 1M allowed requests; OWASP set is Enterprise only (V: vercel.com/docs/vercel-firewall/vercel-waf/managed-rulesets, /rate-limiting, vercel.com/pricing). ISR reads about $0.40 per 1M, writes about $4 per 1M, unchanged regenerations write nothing, `new Date()` or `Math.random()` in output causes writes (V: vercel.com/docs/incremental-static-regeneration/limits-and-pricing, vercel.com/pricing). Do: create the `live-stream-status` rate rule, enable AI Bots deny, then check Obs Plus ISR write counts before tuning.
- **Cloudflare proxy in front of Vercel:** keep the rule. Vercel's wording is softer than "advises against" (V: vercel.com/kb/guide/can-i-use-a-proxy-on-top-of-my-vercel-deployment): "we recommend connecting directly where possible"; Bot Protection does not work behind a proxy; start with external caching disabled; Full (strict) SSL. The owner rule stands, no gain justifies the loss.
- **Fluid compute: unmeasured lever.** svelte is on legacy Function Duration (about half its bill). Fluid bills Active CPU (I/O wait free) plus provisioned memory, default for new projects since 2025-04-23 (V: vercel.com/docs/fluid-compute, /functions/usage-and-pricing). Whether `adapter-vercel` nodejs22 on this project can switch, and the saving, are **I / could not verify**. Candidate dashboard toggle to test on a preview after Obs Plus baseline; note reach-radio's SSE cost came from Fluid provisioned memory, so Fluid is not free of risk for long-held connections (none remain on svelte).
- **GitHub Actions crons:** free on public repos, about $12/month included compute on private Free (V: docs.github.com billing page). Fine for static JSON refresh; scheduled timing not guaranteed (not verified), so not for the live-stream detector.

### 10.6 More small findings (V unless marked)

- svelte: `more/+server.ts:4` and `ministries/preview/+server.ts:4` (301s), plus the short-link map at `[...redirects]/+server.ts:15-42`, are functions; move to `vercel.json` redirects. `api/cron/unpublish-cms-cron` is deprecated and its workflow is `workflow_dispatch` only; confirm and delete.
- nextjs: `api/youtube/playlist/[id]/route.ts:5-10` is uncached, unauthenticated, takes an arbitrary playlist id and uses `cache:'no-store'` (`lib/youtube.ts:112`), no caller in src: a quota-abuse path; delete or cache and allowlist. 10 uncached `*/search` routes already in section 5. `teachings/topics/[topic]/page.tsx:208` and `series/[series]/page.tsx:224` set `revalidate=3600` but read `searchParams`, so they render per request (I: ISR is silently defeated). `video/[id]`, `youtube/[id]` have revalidate 3600 and no `generateStaticParams` (V). `results/og/route.tsx` sends no Cache-Control (I).
- reach-radio-nextjs: `/api/stream-info` has no callers in src, tests or e2e (V; dead or native-only, I). `/api/teachers-list` has no Cache-Control and is called on every page load by `useNowPlaying.ts:17` (V; cached only inside `sanityFetch`). Resolved (V, `git merge-base --is-ancestor`): the Cloudflare SSE cutover `c1aee86` is in `origin/main`, whose tip is `46e0145` (web audio on the Worker); the local `main` checkout at b101551 is just stale, so its same-origin SSE in `useNowPlaying.ts:39` is not what is live. Run `git pull` there before the next audit.
- prayer-nextjs: clean (two routes, rate limited, no polling).
- calvarytucson-nextjs `public/` and dev routes: unchanged from section 5.

### 10.7 Action list (all as changes to the held branches or dashboard, nothing deployed)

1. **Fix the confirmed trailing-slash `/teachings/*` asset bug (10.2)**: preview-test `kit.paths.relative:false` (preferred) or a `/teachings/:path*/` trailing-slash 308 in `vercel.json`, then ship with the header commits.
2. Ship `perf/cache-headers` (covers every `/api/live-stream-status` caller, svelte `main` has no header).
3. On `perf/server-cost`: drop the 120s poll; share the 45s error TTL and add service-window gating to `search.list` (if quota is truly over 10k/day, Sunday live detection can fail: a correctness risk; svelte and nextjs may share one Google key and quota, check in Cloud console); stop SSR-per-view on the east page.
4. Dashboard: create the `live-stream-status` rate rule, enable AI Bots deny, enable Obs Plus on svelte, check Google Cloud YouTube quota usage, read the Sanity plan tier, confirm the Cloudflare account (`wrangler whoami`) and daily request peak.
5. nextjs: delete or cache-and-allowlist `api/youtube/playlist/[id]`; fix `searchParams` ISR defeat on topics/series; add `generateStaticParams` or accept dynamic for video/youtube ids; keep `useCdn:false` on ISR paths (10.5 conflict).
6. Move the 301 function routes to `vercel.json`.
7. Defer: Pagefind, client-side Sanity GROQ, Fluid test, R2, Images, any host move.
