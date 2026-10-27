# Phase B and C — Cutover Script (reach.radio to Vercel)

Date: 2026-10-27. Companion to `2026-10-23-go-live-release-readiness.md` (§6 Phases B and C). Follow top to bottom. Each step says **who**, **what to do**, **expected result**, **if not, stop**. Paste the result of any "send back" line to Claude; Claude verifies with `curl`/`dig`.

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
| B4 | Owner | Google reCAPTCHA admin: add `reach.radio` and `www.reach.radio` to the site key's domains. Do not remove existing | Domains saved | n/a |
| B5 | Owner | Sanity manage > API > CORS origins (project `l5km0p6r` or the project this site uses; check Vercel env `SANITY_PROJECT_ID`): add `https://reach.radio` and `https://www.reach.radio`, no credentials | Saved | n/a |
| B6 | Owner | Sanity manage > API > Webhooks: add/edit the webhook to POST `https://reach-radio-nextjs.vercel.app/api/revalidate` (switch to `reach.radio` after cutover), header `x-webhook-secret` = value of `SANITY_WEBHOOK_SECRET`, projection `{_type, _updatedAt}`, trigger on create/update/delete. **Never paste the secret in chat** | Webhook saved | n/a |
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
| C3 | Owner | Same for `reachradiotucson.com` apex and `www`. (Decision D3: if the plan is a 301 to `reach.radio`, still point DNS to Vercel and set the redirect in Vercel Domains: `reachradiotucson.com` > Redirect to `reach.radio`, 308/301.) | Same | Same |
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
