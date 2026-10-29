# Phase B and C — Cutover Script (reach.radio to Vercel)

Date: 2026-10-27. Companion to `2026-10-23-go-live-release-readiness.md` (§6 Phases B and C). Follow top to bottom. Each step says **who**, **what to do**, **expected result**, **if not, stop**. Paste the result of any "send back" line to Claude; Claude verifies with `curl`/`dig`.

## Status (updated 2026-10-27)

**Done**
- Docs: runbook, this script (local commit `43a256d`, not pushed). Earlier fixes pushed through `8abbb6b` (A2, A5, A6, theme hydration).
- Vercel CLI usable: logged in as `calvary-tucson`; default team set to `calvary-tucson-s-team` (`vercel switch`). Linked project already pointed at the right team; only account-level commands used the wrong default.
- B1/B2 (add four domains): done via `vercel api /v10/projects/prj_WDyZFddcaawGJGS3B1eyJkcz1hcr/domains -X POST -F name=<host> --scope calvary-tucson-s-team`. `vercel domains add` fails with 403 `domain_not_owned`; do not use it, never `domains buy`.
- TXT records added by owner; all four domains now `verified:true` (2026-10-27). Still serving Astro (`server: cloudflare`). Remaining below starts at item 1 (TXT item 2 is done). Before that they were `verified:false`. No traffic, DNS, env var, Sanity or webhook change has been made. reach.radio and reachradiotucson.com still serve Cloudflare Pages (Astro).

**TXT records to add in Cloudflare (additive; do not touch apex/www records)**

| Zone | Type | Name | Value |
|---|---|---|---|
| `reach.radio` | TXT | `_vercel` | `vc-domain-verify=reach.radio,b408ff59d7dbe791da1a` |
| `reach.radio` | TXT | `_vercel` | `vc-domain-verify=www.reach.radio,0d848425b4ae72bdd160` |
| `reachradiotucson.com` | TXT | `_vercel` | `vc-domain-verify=reachradiotucson.com,890586d96483dcdbd040` |
| `reachradiotucson.com` | TXT | `_vercel` | `vc-domain-verify=www.reachradiotucson.com,19c6cef7e9bf6b968249` |

Two separate TXT records per zone on the same `_vercel` name. Remove them to undo. Values come from Vercel; if verification fails, re-fetch with `vercel api /v9/projects/prj_WDyZFddcaawGJGS3B1eyJkcz1hcr/domains/<host> --scope calvary-tucson-s-team`.

**End state**: nameservers and DNS stay on Cloudflare; apex/`www` become DNS-only (grey) records to Vercel at cutover; audio stays on Cloudflare (`reach-radio-web.pages.dev`, later the Worker); Astro on pages.dev stays alive for live iOS v3.2 and Android.

**CURRENT STATUS as of 2026-10-28 evening (the table below is the old list; rows 1-5 are ALL DONE, do not redo them):** Part 0 done, TXT records added and domains verified, Phase B done, commits pushed. Only row 6 (cutover day) and row 7 (later phases) remain. **To run the cutover, jump to "Scripted path" at the bottom of this file.** The manual C1-C12 table above it is the fallback if the scripts fail.

**Remaining (old list, mostly done)**

| # | Who | Item |
|---|---|---|
| 1 | Owner | Part 0.1-0.3: export DNS for both zones, lower apex/`www` TTL to 5 min; answer 0.5 (Pages auto-deploy) |
| 2 | Owner | Add the four TXT records, reply "TXT added" |
| 3 | Claude | Verify domains via API and `dig`; before-snapshot (0.4); log it |
| 4 | Owner | B4 reCAPTCHA domains, B5 Sanity CORS, B6 webhook (vercel.app host first), B7 test edit |
| 5 | Owner | Push `43a256d` ("push" to Claude) |
| 6 | Both | Pick a cutover day; run Part C preconditions; C1-C12; B8/B9 (hostURL, `NEXT_PUBLIC_SITE_URL`) happen only here |
| 7 | Later | Phase D (48 h watch), E (iOS v4, real-device tests), F (audio Worker flip), G (Android, Astro sunset); D6 delete `/api/stream-info` after log check; A7, A8 owner checks |

Note: B1/B2 below are already done; ignore the "add" instructions in them.

**Baseline DNS (owner screenshots 2026-10-28), restore values for §R:**

| Zone | Name | Type | Content | Proxy | TTL |
|---|---|---|---|---|---|
| `reach.radio` | `@` | CNAME | `reach-radio-web.pages.dev` | Proxied | Auto |
| `reach.radio` | `www` | CNAME | `reach-radio-web.pages.dev` | Proxied | Auto |
| `reachradiotucson.com` | `@` | CNAME | `reach-radio-web.pages.dev` | Proxied | Auto |
| `reachradiotucson.com` | `www` | CNAME | `reach-radio-web.pages.dev` | Proxied | Auto |

- 0.1 done: owner confirmed the screenshots are every record in both zones (no MX or other records), so this table plus the TXT/Worker rows below is the full baseline.
- 0.3 done: Auto = 300 s, no TTL change needed.
- Untouched at cutover: `stream.reach.radio` (Worker custom domain, Proxied), `google-site-verification` TXT records, `_vercel` TXT records. Any MX/other records not seen in screenshots: confirm via export.
- Apex/`www` rows are Pages-managed (info icon), so they cannot be edited while attached: C1 (detach) then C2/C3 (add Vercel records). Do C2 within 1-2 min of C1; the sites are unresolved in between.

Rules for the whole script:
- Stop at the first unexpected result. Do not improvise. Rollback is in §R.
- `reach-radio-web.pages.dev` is never touched, edited, or detached.
- Nameservers stay on Cloudflare. Never move them.
- Vercel-bound DNS records are **DNS only (grey cloud)**, never Proxied.
- Claude does not change Sanity, Vercel env, DNS or Cloudflare. Owner does every dashboard step.

Hosts: `reach.radio`, `www.reach.radio`, `reachradiotucson.com`, `www.reachradiotucson.com`.
Vercel project: `calvary-tucson-s-team / reach-radio-nextjs`. Vercel CLI is not logged in for this team on this machine; use the dashboard.

---

## Part 0 — Before you start (one day ahead is best)

| # | Who | Do | Expected | Send back |
|---|---|---|---|---|
| 0.1 | Owner | Cloudflare dashboard, zone `reach.radio`, DNS, Records. Export (DNS > Records > Export) or screenshot **every** record. Repeat for `reachradiotucson.com`. Save files somewhere durable | Two files or screenshots | "saved" (this is the rollback) |
| 0.2 | Owner | Note for each record: type, name, content, proxy status (orange/grey), TTL | Notes match export | n/a |
| 0.3 | Owner | Set TTL of the apex and `www` records to 5 min (or Auto if already low) | TTL shows 5 min | "TTL set at HH:MM" |
| 0.4 | Claude | From this machine, `dig +short <host>` and `curl -sI https://<host>/` for all four hosts as a before-snapshot | `server: cloudflare` on all four | Claude records it in the runbook |
| 0.5 | Owner | Cloudflare dashboard, Workers and Pages, project `reach-radio-web`, Settings, Builds: is production auto-deploy from `master` on? | yes or no | answer (runbook A7) |

---

## Part B — Vercel config (public sees nothing change)

| # | Who | Do | Expected | If not |
|---|---|---|---|---|
| B1 | Owner | Vercel dashboard > `reach-radio-nextjs` > Settings > Domains > Add: `reach.radio`. Choose **no redirect** for now (apex as primary). Repeat for `www.reach.radio` | Domains listed, status **Invalid Configuration** (DNS not pointed yet). This is expected | If Vercel says the domain is on another project/account, stop and send the message |
| B2 | Owner | Add `reachradiotucson.com` and `www.reachradiotucson.com` the same way | Same | same |
| B3 | Owner | Note the DNS target Vercel shows for each (A `76.76.21.21` or CNAME `cname.vercel-dns.com`, or a project-specific value) | Written down | If Vercel shows different values, use those, not the ones in this doc |
| B4 | Owner | **DONE 2026-10-27, no change needed.** Site key `6LeUsLMr…rqaJ0` (matches the key shipped by the Vercel site) already lists `reach.radio`, `reachradiotucson.com`, `localhost`, `reach-radio-nextjs.vercel.app`; subdomains covered | n/a | n/a |
| B5 | n/a | **NOT NEEDED (decided 2026-10-27).** No CORS step: all Sanity queries run server-side (`src/lib/sanity/client.ts`, server-only `SANITY_PROJECT_ID`; no `'use client'` file imports the client), images load from `cdn.sanity.io`. The Reach Radio project is `bk05c6rl` (not `l5km0p6r`, which is the Calvary Tucson project) | n/a | n/a |
| B6 | Owner | Sanity manage > project `bk05c6rl` > API > Webhooks > Create (no webhooks existed on 2026-10-27). Name `Reach Radio Next.js revalidate`; URL `https://reach-radio-nextjs.vercel.app/api/revalidate` (switch to `https://reach.radio/api/revalidate` at C10); dataset `production`; trigger create/update/delete; drafts off; POST; header `x-webhook-secret` = value of `SANITY_WEBHOOK_SECRET` (never paste in chat; if Vercel hides it, set a new random value in Vercel Production, redeploy, use the same in Sanity). Filter `_type in ["teacher", "schedule", "siteSettings", "appSettings"]`; projection `{ _type, _updatedAt }` (route rejects `_updatedAt` older than 5 min) | Webhook saved | disable webhook |
| B7 | Owner | Publish a trivial edit in Sanity, then watch the Vercel site | Page shows the change within a minute; webhook log shows 200 | Send the webhook log status |
| B8 | Owner | Sanity: set `appSettings.hostURL` to `https://reach.radio` **at cutover (Part C step C9)**, not now | n/a | n/a |
| B9 | Owner | **Do not** change `NEXT_PUBLIC_SITE_URL` yet (Part C step C7) | n/a | n/a |

Part B done when: 4 domains listed in Vercel (invalid is fine), reCAPTCHA and CORS saved, webhook delivers 200 against the vercel.app host.

---

## Part C — Cutover day

### Preconditions (all must be true)
- [ ] Part 0 and Part B done; DNS export saved (0.1)
- [ ] You are free for the next hour; low-traffic time (late evening Arizona)
- [ ] Claude confirms right now: `curl -sI https://reach-radio-nextjs.vercel.app/api/audio-stream` gives 307 to `reach-radio-web.pages.dev`
- [ ] Claude confirms `https://reach-radio-nextjs.vercel.app/` is 200 and the latest commit's deploy is live

### Steps

| # | Who | Do | Expected | If not |
|---|---|---|---|---|
| C1 | Owner | Cloudflare > Workers and Pages > `reach-radio-web` > Custom domains: remove `reach.radio`, `www.reach.radio`, `reachradiotucson.com`, `www.reachradiotucson.com`. **Leave the `pages.dev` default domain.** | Custom domains list is empty or only pages.dev | If removal also deletes DNS records, that is fine: we re-add them in C2. Take a screenshot first |
| C2 | Owner | Cloudflare DNS, `reach.radio`: edit/create apex and `www` records to the Vercel target from B3. Proxy status: **DNS only (grey)**. TTL 5 min | Two records, grey cloud | If the cloud is orange, click to grey before saving |
| C3 | Owner | Same for `reachradiotucson.com` apex and `www`. **D3 REVISED 2026-10-28: Option B. Do NOT set any redirect; `reachradiotucson.com` and `www` serve the full site, canonicals point to `reach.radio`. Redirect is deferred (readiness doc §13). DNS target for all four hosts: CNAME `32eebd4ba8fac32a.vercel-dns-016.com`, grey, TTL 5 min.** (Superseded text: Decision D3: if the plan is a 301 to `reach.radio`, still point DNS to Vercel and set the redirect in Vercel Domains: `reachradiotucson.com` > Redirect to `reach.radio`, 308/301.) | Same | Same |
| C4 | Claude | `dig +short` all four hosts; `curl -sI https://<host>/` | Vercel IPs / `server: Vercel`, valid cert. May take 1-5 min; Vercel needs to issue the cert | If still `cloudflare` after 10 min, stop; check C2 grey cloud and the TTL |
| C5 | Owner | Vercel Domains page | All four show **Valid Configuration** with certificate issued | If "Invalid", send the message Vercel shows |
| C6 | Claude | Smoke test `https://reach.radio`: `/`, `/donate`, `/teachers`, `/about`, `/about/privacy-policy`, `/api/native-config`, `/sitemap.xml`, `/robots.txt`, `/not-a-page` (expect 404 page content + noindex; HTTP 200 is expected), `/api/audio-stream` (expect 307 to pages.dev, then 200 `audio/mpeg`) | All as listed | Any red: go to §R |
| C7 | Owner | Vercel > Settings > Environment Variables > Production: edit `NEXT_PUBLIC_SITE_URL` to `https://reach.radio`, then Deployments > latest > Redeploy (build-time var needs a rebuild) | New deploy Ready | n/a |
| C8 | Claude | `curl https://reach.radio/api/native-config`: `webUrl` = `https://reach.radio`; home canonical and `og:url` = `https://reach.radio` | Yes | If still vercel.app, redeploy did not pick up the var; recheck C7 |
| C9 | Owner | Sanity: set `appSettings.hostURL` to `https://reach.radio` | Saved + published | n/a |
| C10 | Owner | Sanity webhook: change URL to `https://reach.radio/api/revalidate`; publish a trivial edit | Site updates, webhook log 200 | Revert URL to the vercel.app host |
| C11 | Owner | Desktop browser at `https://reach.radio`: press play, wait 30 s; now-playing text updates; submit the contact form once | Audio plays; form sends; no console errors | Go to §R if audio is dead |
| C12 | Owner | Live apps: open iOS v3.2 and the Android app, play radio, open Teachers | Both work as before (they use pages.dev) | If not, send details; do not touch pages.dev. Expected unaffected |

Cutover is done when C5 to C12 are green.

### After (first 48 hours)
- Search Console: add `reach.radio`, submit `https://reach.radio/sitemap.xml`; watch for 404s.
- Vercel usage page: function invocations and transfer; no spike.
- Restore DNS TTL to normal after 48 h.

---

## §R Rollback

| Symptom | Do | Time |
|---|---|---|
| `reach.radio` broken or wrong site | Cloudflare DNS: restore records from the 0.1 export (original values and proxy state); re-add the four custom domains to the Pages project `reach-radio-web` | TTL (5 min if lowered) |
| Audio dead on web | Sanity `appSettings.radioAudioURL` unchanged by this script; if needed set it to `https://reach-radio-web.pages.dev/api/audio-stream`. Never restore a Vercel audio proxy | minutes |
| Wrong canonicals / `webUrl` | Set `NEXT_PUBLIC_SITE_URL` back to `https://reach-radio-nextjs.vercel.app`, redeploy | 5 min |
| Bad Vercel deploy | Vercel Deployments: promote previous deploy | 1 min |
| Webhook failing | Point it back at the vercel.app host or disable it | 1 min |

Never in rollback: delete or redirect `reach-radio-web.pages.dev`.

---

## Claude verification commands (reference)

```
dig +short reach.radio www.reach.radio reachradiotucson.com www.reachradiotucson.com
curl -sI https://reach.radio/ | head -5
curl -sI https://reach.radio/api/audio-stream | head -6
curl -s https://reach.radio/api/native-config
curl -s https://reach.radio/ | grep -oE '<link rel="canonical"[^>]*>'
```
Network calls from the sandbox need `allowed_domains` for each host.

## Scripted path (added 2026-10-28; use this instead of the manual dashboard steps C1-C3)

Files: `scripts/cutover/cf_cutover.py` (Cloudflare), `scripts/cutover/verify.sh` (read-only checks). Token: env `CF_API_TOKEN` (`claude-cutover-dns`: DNS Edit on both zones + Pages Edit, expires 2026-11-28; never saved to a file). Backup JSON: `.cutover-backup/cf-snapshot.json` (uncommitted).

| Step | Command (from repo root) | Writes? |
|---|---|---|
| Pre-check | `python3 -I scripts/cutover/cf_cutover.py snapshot`; Vercel home 200; `/api/audio-stream` 307; live hosts 200 | no |
| Dry run | `python3 -I scripts/cutover/cf_cutover.py cutover` (no `--apply`) | no |
| C1-C3 | `python3 -I scripts/cutover/cf_cutover.py cutover --apply` (per host: detach from Pages, then PUT record to CNAME `32eebd4ba8fac32a.vercel-dns-016.com`, grey, TTL 300; stops on first failure) | YES, owner "go" first |
| C4 | `scripts/cutover/verify.sh dns` (Vercel IPs, `server: Vercel`, valid cert; 1-5 min, if still Cloudflare after 10 min stop) | no |
| C5 | Vercel domains show valid: `vercel api /v6/domains/<host>/config?projectIdOrName=prj_WDyZFddcaawGJGS3B1eyJkcz1hcr&teamId=team_ScWb7I5wN1e1PtCCk2xTwGwA` expect `misconfigured:false` | no |
| C6 | `scripts/cutover/verify.sh smoke` (both hosts, 9 URLs + audio 307) | no |
| C7 | Vercel Production env `NEXT_PUBLIC_SITE_URL=https://reach.radio`, then redeploy | YES, owner "go" |
| C8 | `scripts/cutover/verify.sh canon` (`webUrl`, canonical, `og:url` = `https://reach.radio` on BOTH hosts) | no |
| C9 | Sanity CLI (authed, sees `bk05c6rl`): set `appSettings.hostURL` = `https://reach.radio`; confirm the doc id read-only first | YES, owner "go" |
| C10 | Owner: Sanity webhook URL to `https://reach.radio/api/revalidate`, publish a trivial edit, check 200 in webhook log | owner |
| C11, C12 | Owner: play audio 30 s on reach.radio; open live iOS v3.2 and Android apps | owner |

**Rollback (scripted):** `python3 -I scripts/cutover/cf_cutover.py rollback --apply` (restores the 4 proxied CNAMEs to `reach-radio-web.pages.dev` TTL auto, then re-attaches the 4 Pages domains). About 5 min. Other rollbacks in §R still apply.

**Known risks:** (1) each host has a 1-5 min gap between Pages detach and Vercel cert; (2) Cloudflare may refuse to edit a Pages-managed record right after detach (script stops; run rollback); (3) D3 = Option B, so do NOT add a redirect on `reachradiotucson.com` (readiness doc §13).

**Baselines to compare after cutover (Cloudflare analytics, 24 h before cutover):** `reach.radio` 442 of 2,824 requests were 504 (16%); `reachradiotucson.com` 874 of 7,253 (12%). Traffic about 120 req/h on `reach.radio`, about 265 req/h on `reachradiotucson.com`. Quietest hours Arizona: 1 am, 10 pm, 9 am, noon, 7 pm. Bot spike 3-4 am.

**After cutover (do not forget):**
1. Delete the `claude-cutover-dns` Cloudflare token (it was pasted into a chat transcript).
2. Vercel Firewall: add a rate-limit custom rule on `/api/*`, look at the bot protection ruleset, check Spend Management. Reason: apex/`www` are grey (Vercel docs, 2026-09-18, advise against a proxy in front), so Cloudflare no longer absorbs bot traffic and Vercel bills what it serves.
3. 48 h watch (Phase D): Vercel 504 rate vs the baselines above, `/api/stream-info-sse` usage and memory (earlier OOM history), function usage and bandwidth.
4. D3 revisit: readiness doc §13 (temporary 307 redirect first, after the iOS config test and a clean 48 h).
5. Later phases: D6 log check then delete `/api/stream-info`; iOS v4 device tests T3/T4; Phase F audio flip; Phase G Android and Astro sunset.

### Exact values for C7 and C9 (added 2026-10-28)

- **Cold start for a fresh session:** the Cloudflare token is NOT saved anywhere (only pasted in the 2026-10-28 chat). If it is gone or expired, the owner makes a new one: Cloudflare profile > API Tokens > Create Custom Token, `Zone / DNS / Edit` on `reach.radio` + `reachradiotucson.com`, `Account / Cloudflare Pages / Edit`, short expiry. Then `export CF_API_TOKEN=...` in the shell that runs the script. Cloudflare account id `0a8e48b3e091dedab060a87d59d8218c`.
- **Run order sanity check before `--apply`:** `snapshot` must show 4 CNAMEs to `reach-radio-web.pages.dev` (proxied) and 4 Pages domains. If it shows anything else, someone already changed DNS: stop and compare with the baseline table above.
- **C7 (Vercel env):** project `prj_WDyZFddcaawGJGS3B1eyJkcz1hcr`, team `team_ScWb7I5wN1e1PtCCk2xTwGwA` (scope `calvary-tucson-s-team`). Set Production `NEXT_PUBLIC_SITE_URL` to `https://reach.radio` (dashboard, or `vercel env rm` then `vercel env add NEXT_PUBLIC_SITE_URL production`), then redeploy the latest production deployment. The var is build-time, so a redeploy is required. Previous value: `https://reach-radio-nextjs.vercel.app` (rollback value).
- **C9 (Sanity):** project `bk05c6rl`, dataset `production`, document `appSettings` id `a2939b52-e844-45f4-ba97-c335991cea4b`. **Current `hostURL` = `https://reach-radio.webapp-0a8.workers.dev/` (rollback value).** Set to `https://reach.radio`. `radioAudioURL` stays `https://reach.radio/api/audio-stream` (Phase F changes it later, not now).
- Read it back: `sanity documents query --project-id bk05c6rl --dataset production '*[_type=="appSettings"]{_id,hostURL,radioAudioURL}'`

### Decision 2026-10-28: SKIP C9 (Sanity `appSettings.hostURL`) at cutover; do it at Phase E

- **Do NOT change `hostURL` during the cutover.** Leave it at `https://reach-radio.webapp-0a8.workers.dev/` (the old Astro workers.dev site, still returns 200; value untouched since 2024-10-16). Treat B8 and the C9 row above as deferred.
- **Why safe:** `hostURL` is only returned by Next.js `/api/native-config` (`src/app/api/native-config/route.ts:16`). iOS v4 (unreleased) reads `webUrl` first and uses `hostURL` only if `webUrl` is missing (`Reach_Radio_NativeApp.swift:70`); `webUrl` comes from `NEXT_PUBLIC_SITE_URL` (C7). Native git history: no store build reads it. iOS config fetch was added in `627803f` on 2026-06-17 and the store build candidate `3fbf6e0` (2025-04-04) predates it; Android has never referenced `native-config`, `hostURL`, `webUrl` or `workers.dev`. Caveat: neither repo has release tags, so the store build is inferred; owner can confirm via App Store Connect "Date submitted" (before 2026-06-17 proves it).
- **When to do it:** at Phase E, before iOS v4 is submitted: set `hostURL` to `https://reach.radio` (doc id `a2939b52-e844-45f4-ba97-c335991cea4b`, project `bk05c6rl`, dataset `production`). Rollback value: `https://reach-radio.webapp-0a8.workers.dev/`. Do it earlier if the workers.dev site is ever retired.
- **The real store-app dependency in this cutover** is not `hostURL`. iOS store build `3fbf6e0` loads `https://reach-radio-web.pages.dev/` (`ContentView.swift:200`) and streams `https://reach.radio/api/audio-stream` (line 207). After cutover that stream URL is a Vercel 307 to `pages.dev`. Verify with C6 (307 then 200 `audio/mpeg`) and C12 (play in the live iOS and Android apps).


## Final audit additions (2026-10-28)
- Before running `cutover --apply`: owner audits Cloudflare Rules on both zones (see readiness doc section 14, item 1). Grey records bypass them.
- Donate is a plain Pushpay link, no iframe: no CSP change needed.
- `verify.sh smoke` also checks pages.dev unchanged (C6).
- After 48 h clean: restore TTL (D5), delete both tokens, D1 webhook test, D2 contact form test, Search Console for both hosts.
- C9 skipped (Phase E). R13 resolved by D3 Option B.
