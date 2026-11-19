# Offload and resource-use design (2026-11-05)

Status: design approved by owner 2026-11-05. No code until Nov 13; every change is owner-gated.
Related: `docs/bugs/vercel-cost-audit-2026-11-all-projects.md` (section 10 is the delta audit, 10.7 the action list), reference doc "Offload ladder and resource inventory" (claude-code-config).

## Goal
Use the resources we already own before building anything that spends Vercel. Equal weight on reliability and headroom, user-facing speed, and cost. Honest scale: baseline Vercel usage is about $15/month inside a $20 credit; the measured ceiling for svelte Function Duration savings is about $6 to $7/month. No unmeasured saving is claimed.

## Decisions (owner)
- Approach A now: headers first, existing accounts only (Vercel, Cloudflare Free, Sanity, GitHub, AWS, YouTube).
- Approach B (Upstash free shared cache) only on trigger.
- Approach C (move status and search to Cloudflare Workers) parked.
- No paid services until measured need ("we already pay $20 to Vercel no matter what"). Workers stay on the free tier; Workers Paid only if the measured daily peak nears the 100k requests/day account cap.
- Targets: live status and polling, YouTube Data API, search, fonts/images/crawlers.

## Researched this session (primary docs, read by subagent; not re-checked by me)
- Vercel Runtime Cache (vercel.com/docs/caching/runtime-cache, 2026-08-28): regional, ephemeral, 2 MB item, LRU eviction; Pro bills against the $20 credit then $0.40 to $0.64 per 1M reads, $4 to $6.40 per 1M writes. Fit: maybe. SvelteKit nodejs22 support unverified.
- Vercel Global Config, formerly Edge Config (vercel.com/docs/global-config/global-config-limits, 2026-07-29): 1 MB store; writes propagate up to 10 s. Fit: rarely-changed flags only, not polling.
- Upstash Redis free (upstash.com/pricing): 500K commands/month (about 16K/day), 250 MB, 1 database. Latency from Vercel unverified; behavior at cap unverified.
- Fonts: `next/font` self-hosts at build time (nextjs.org docs, 2026-05-27); SvelteKit via `@fontsource` is standard practice, not verified from a primary page.

## Change list (ordered)
| # | Workload | Change | Gate |
|---|---|---|---|
| 1 | Live status | `Cache-Control: s-maxage=N, stale-while-revalidate=M` on `live-stream-status`, shipped with `perf/cache-headers` | Existing branch review |
| 2 | YouTube | Read quota in Google Cloud console; replace per-request `search.list` with shared TTL; thumbnails via `i.ytimg.com`; align error cache (svelte 10 min, nextjs 45 s) | Quota number first |
| 3 | Search | Cache headers plus memoization; no Pagefind until per-route data shows search in the top duration lines | Per-route data |
| 4 | Fonts | NON-FINDING (checked 2026-11-05): calvarytucson-nextjs already uses `next/font` (`src/app/layout.tsx`); calvarytucson-svelte loads no web fonts (no `@font-face`, no Google Fonts links in `src/`, `static/`, `app.html`). Only third-party script host seen: `cdn.jsdelivr.net` in nextjs `src/lib/csp.ts:11`, not investigated. | None |
| 5 | Images | Sanity custom loader so Sanity images skip Vercel optimization | 10.7 list |
| 6 | Crawlers | AI Bots deny and a rate rule on ISR paths (dashboard) | Owner Yes/No per setting |
| 7 | Trailing-slash `_app` bug | `kit.paths.relative:false` or 308 in `vercel.json` | 10.7 list |

## Triggers
- B (Upstash): YouTube console shows more than 50% of the daily quota used, or the same-key upstream call rate stays high after item 1 ships. Measure: `search.list` calls/day. Upstash sits only behind the cache-miss path (one key refreshed every 30 s is about 5,800 commands/day, within 16K/day; never in front of a polled path, since 35 tabs polling is about 100k reads/day, an inference not a measurement).
- C (Cloudflare move): daily Workers peak read and under 50% of 100k, and the account of each site confirmed. The cap is shared with the audio stream, SSE and the Android/iOS v3 site.

## Measurement and tests
- Before and after: `vercel usage --group-by project` (Edge Requests, Function Duration), Cloudflare daily request peak, YouTube console units, Sanity usage.
- Checks: `curl -I` for cache headers and hits; network-tab check that fonts load from our domain; firewall rules checked in the dashboard.

## Open unknowns (read before relying)
Cloudflare account identity per site, Sanity plan tier, YouTube quota in use, Fluid compute on svelte nodejs22, SvelteKit Runtime Cache support, Upstash latency and cap behavior.

## Out of scope
Whole-app migration, Upstash and Workers Paid beyond the triggers, new media hosting.

Offload check: none, spec only; no route, poll or stream is changed by this document.
