# Go-Live Release Readiness — Reach Radio (web + iOS + Android + audio)

Date: 2026-10-23. Purpose: one place to walk through every step of going live **without breaking anything**. Owner reviews item by item with Claude. Nothing here changes Sanity, DNS, Vercel env or the stores by itself.

Tags: **VERIFIED** = seen in code or a live response (date given). **INFERRED** = reasoned. **UNKNOWN** = needs dashboard or device.

Sources (not duplicated here, read for detail):
- `GO-TO-PRODUCTION.md` (master, has uncommitted owner edits)
- `2026-10-09-web-cutover-findings-and-checklist.md` (cutover checklist, audio gate §6)
- `2026-10-09-stream-hosting-decision.md` (§4d decisions, §4c client results)
- `2026-10-13-audio-stream-master-roadmap.md` (19 rows)
- `2026-10-14-audio-stream-worker.md`, `2026-10-14-stream-reach-radio-client-compat-tests.md`

---

## 1. Bottom line

- **Next.js site to prod (vercel.app): already live** (2026-08-04). Audio route is now a 307 to Cloudflare (pushed 2026-10-23, verified).
- **Next.js on `reach.radio`: not yet.** DNS held on purpose. Safe for the live apps (VERIFIED 2026-09-11) once the audio gate holds (it now does) and the config items in §6 are done.
- **iOS v4 to App Store: not ready.** Blocker: dev tunnel fallback in iOS repo; real-device tests not run; TestFlight status unknown.
- **Android to Play Store (Next.js version): far.** `main` still hardcodes pages.dev; migration branch diverged.
- **Live apps (iOS v3.2, Android) are untouched by any step here** as long as `reach-radio-web.pages.dev` stays alive. Never retire it.

---

## 2. Current state map

```text
 CLIENT                    HITS TODAY                          AFTER DNS SWITCH
 ------                    ----------                          ----------------
 Browser (reach.radio)     Astro on Cloudflare Pages           Next.js on Vercel   <- CHANGES
 iOS v3.2 (live)           pages.dev (web + audio)             pages.dev           (no change)
 Android (live)            pages.dev (web + audio)             pages.dev           (no change)
 iOS v4 (unreleased)       /api/native-config -> vercel.app,   reach.radio (Vercel)
                           then reach.radio, then
                           reachradiotucson.com
 iOS Watch app             reach.radio/api/audio-stream        307 -> pages.dev    (via Vercel redirect)
 Audio (all new clients)   Sanity radioAudioURL =              307 -> pages.dev -> Radiojar
                           reach.radio/api/audio-stream
 stream.reach.radio        Cloudflare Worker, live, unused     (target for later flip)
```

Facts (all VERIFIED unless tagged):
- Vercel prod alias: `https://reach-radio-nextjs.vercel.app`. Pro plan, 800 s max duration.
- `/api/audio-stream` on Vercel = 307 to `https://reach-radio-web.pages.dev/api/audio-stream` (config in `next.config.ts`, commit 9c749fc era; `route.ts` deleted). Post-push check 2026-10-23: 307, then 200 `audio/mpeg`. CSP `media-src` includes `stream.reach.radio`.
- Worker `https://stream.reach.radio/`: 200 `audio/mpeg`, `no-store`, no CORS header (not needed for `<audio src>`). Repo `~/Documents/Development/reach-radio-audio-stream-worker`.
- Decision 2026-10-13: Vercel never serves audio bytes. Rollback of the redirect = re-point it, never restore the proxy.
- `reach.radio` and `reachradiotucson.com`: proxied through Cloudflare today (VERIFIED `dig` 2026-10-09); no MX/DMARC records; TXT only `google-site-verification`.
- Repo: `main` pushed to f36a768, plus 1 local unpushed docs commit. `GO-TO-PRODUCTION.md` has uncommitted owner edits. Untracked: 2 PNGs, `test-results/`.

---

## 3. Client compatibility results (stream.reach.radio)

| Client | Result | Evidence |
|---|---|---|
| Web `<audio>` | PASS | 0 CSP violations, played 7.8 s, events loadstart to playing (2026-10-16) |
| iOS simulator, 5 min | PASS | `Pause radio` label held at 5 checkpoints, `TEST SUCCEEDED` (commit 70861aa, branch `test/stream-override`) |
| Android | **Compile-verified only** | `ConfigTest` passes, `assembleDebugAndroidTest` builds (branch `test/stream-reach-radio`, aa7edb1). Playback test never run (A2 pending: needs emulator/device) |
| iOS real device | **Not run** | T3 network flap, T4 lock screen / CarPlay / Control Center still pending |
| Worker multi-hour soak | **Not run** | Includes one `wrangler deploy` mid-stream |
| `pages.dev` 61 min hold | PASS | 61m40s, no cut (2026-10-14) |

---

## 4. Risk register

| # | Risk | Severity | Status / mitigation |
|---|---|---|---|
| R1 | DNS switch moves audio to a 13-min-cut Vercel route | High | **Closed**: 307 redirect live (§2). Re-verify after DNS (§7 step C5) |
| R2 | Breaking live iOS v3.2 / Android | High | Not affected by DNS (VERIFIED code history 2026-09-11). Never touch pages.dev. Do not push to `reach-radio-web` casually: may reach live WebViews (auto-deploy UNKNOWN) |
| R3 | Cloudflare proxy left on (orange) after repoint | High | Breaks Vercel cert issuance. Set records DNS-only. Verify "Valid Configuration" + `server: Vercel` |
| R4 | Pages custom-domain binding conflicts with new record | High | Detach `reach.radio`, `www`, `reachradiotucson.com` + www from Pages project first. pages.dev stays |
| R5 | `NEXT_PUBLIC_SITE_URL` still vercel.app | Medium | Wrong canonicals, OG, JSON-LD, `webUrl` to iOS v4. Build-time: needs redeploy. Current value UNREAD |
| R6 | Webhook not registered / revalidate endpoint buggy | Medium | Step 3 tasks open (3 bugs). Site works but content stale until fixed. Schedule tag `schedule` never revalidated (fix: use `teachers`) |
| R7 | Soft 404 (unknown path returns 200 on Vercel) | Medium | Cause INFERRED: `@modal/[...catchAll]` returns null. SEO impact. Fix on preview, verify `curl` 404 |
| R8 | iOS v4 dev tunnel fallback in App Store build | High (blocks store) | Replace with `https://reach.radio` in iOS repo |
| R9 | iOS v4 untested on real device | High | T3/T4 pending; TestFlight status stale since 2026-06-19 |
| R10 | iOS v4: no `DidPlayToEnd` handler, silent stall gap | Low-Med | T0 showed ~13 s recovery via watchdog. Candidate ticket (roadmap 16). Mostly moot with Cloudflare (no 13-min cut) |
| R11 | Cloudflare free plan caps (100k req/day account-wide, 10 ms CPU) | Medium | ~810 req/day on audio today (~1%). Every Astro page view counts too. Over cap = stream down until 00:00 UTC. Workers Paid $5/mo is optional insurance (owner call) |
| R12 | Radiojar stream ID `g4d600bv6p5tv` hardcoded in 3 places | Low | Astro fn, Worker, `constants.ts`. Update all if it changes |
| R13 | `reachradiotucson.com` duplicate content | Medium | Decide: 301 to `reach.radio` or second canonical |
| R14 | Sanity `hostURL` stale (workers.dev) | Low | iOS v4 uses only if `webUrl` missing (never). Update anyway at cutover |
| R15 | Sanity `radioAudioURL` flip is global | Medium | One field drives web, Astro player, iOS v4. Flip only after Worker soak. Instant rollback = restore old value |
| R16 | Android build: `main` pages.dev, branch diverged | High (for Android release) | Not a go-live blocker for web/iOS. Separate project |
| R17 | Bot/relay traffic on stream (~12% of bytes) | Low | Decided: do nothing |
| R18 | Preview URLs SSO-gated | Info | AVPlayer cannot use previews; test via dev tunnel |

---

## 5. Open decisions (owner)

| # | Decision | My recommendation |
|---|---|---|
| D1 | DNS before or after iOS v4 submission? | **Before.** v4 tries vercel.app first, so it works either way, but reach.radio on Vercel makes the fallback chain meaningful and lets you test the final hosts in TestFlight |
| D2 | Real-device iOS pass required before submission? | **Yes** (T3, T4). Simulator cannot show lock screen/CarPlay/network handoff |
| D3 | `reachradiotucson.com`: 301 or second canonical | **301 to reach.radio** (no duplicate content). Keep it resolving for the v4 fallback chain, so it must still serve `/api/native-config` or redirect it (307/308 preserving path; AVPlayer/URLSession follow). Test the iOS config fetch against a 301 before choosing |
| D4 | Workers Paid ($5/mo) | Optional; worth it once audio listeners grow |
| D5 | Push the 1 local docs commit | Needs your yes |
| D6 | Delete `/api/stream-info` (no callers) | After Vercel log check |

---

## 6. Ordered go-live runbook

Rule for every step: **verify, then proceed; rollback noted; stop on any red.**
Legend: **O** = owner only (dashboards, Sanity, stores, device). **C** = Claude can do. **O+C** = together.

### Phase A — Prep (no user-visible change)

| Step | Who | Action | Verify | Rollback |
|---|---|---|---|---|
| A1 | C | Push local docs commit | `git status` clean of ahead | n/a (needs your yes) |
| A2 | O+C | Read Vercel env: is `NEXT_PUBLIC_SITE_URL` set in Production? | **DONE 2026-10-27**: set (created 111 d ago, value encrypted). Live build emits `https://reach-radio-nextjs.vercel.app` in `/api/native-config` `webUrl`, canonical and `og:url`, so the value is the vercel.app host | n/a |
| A3 | O | Record ALL current DNS records for both domains (screenshot/export from Cloudflare) | saved file | this IS the rollback |
| A4 | O | Lower TTL to 300 s, one day ahead | Cloudflare shows 5 min | restore TTL |
| A5 | C | **DONE 2026-10-27 (15eca2e, pushed)**. Fix soft 404 on a branch/preview (explicit not-found for unmatched paths; keep modal close working) | `curl -s -o /dev/null -w %{http_code}` on preview returns 404; modals still open/close; unit+e2e green | revert commit |
| A6 | C | **DONE 2026-10-27**: `/api/revalidate` was already fixed in code (revalidateTag 'max', tag map, timingSafeEqual, replay window; the "3 bugs" in GO-TO-PRODUCTION are stale). `schedule` tag fixed in efbb2a8 (pushed). Per-slug tags skipped: `teachers` tag already covers all teacher pages. Original scope: fix `/api/revalidate` (3 bugs), per-slug tags, `schedule` tag to `teachers` | unit tests; manual POST with secret returns ok | revert commit |
| A7 | O | Cloudflare dashboard: check whether Pages auto-deploys `reach-radio-web` master (UNKNOWN) | note answer | n/a |
| A8 | O | On-device check: live apps send `mobile-app` on every request (UNKNOWN) | capture | n/a |

### Phase B — Vercel config (still no DNS change)

| Step | Who | Action | Verify | Rollback |
|---|---|---|---|---|
| B1 | O | Set `NEXT_PUBLIC_SITE_URL=https://reach.radio` in Vercel Production. **Do this at cutover time, not before**: until DNS moves, reach.radio still serves Astro, so canonical/OG on the Vercel site would point at the old site and v4 would get a `webUrl` that is not this site | env listed | remove var, redeploy |
| B2 | C | Redeploy prod (needed: build-time var) | `/api/native-config` `webUrl` = `https://reach.radio`; page canonical + OG use reach.radio | unset var, redeploy |
| B3 | C (done 2026-10-27) | Add `reach.radio`, `www.reach.radio`, `reachradiotucson.com`, `www.reachradiotucson.com` in Vercel (DNS unchanged yet; they show "invalid configuration", expected). Done via project-level API; each needs a `_vercel` TXT record to verify (see cutover script "Status") | domains listed, `verified:false` until TXT added | remove domains |
| B4 | O | Add reCAPTCHA domains and Sanity CORS origins for `reach.radio` | contact form works on preview/prod later | remove |
| B5 | O | Update Sanity `appSettings.hostURL` to `https://reach.radio` | query shows new value | restore old value |
| B6 | O | Register Sanity webhook to `https://reach.radio/api/revalidate` (needs live host, so can only be tested after Phase C; may register to vercel.app first) | webhook delivers 200 | disable webhook |

### Phase C — DNS cutover (low-traffic hours)

Preconditions (all must be true, tick each):
- [ ] A3 DNS records saved
- [ ] Prod `/api/audio-stream` returns 307 to pages.dev (re-curl same day)
- [ ] B1/B2 done
- [ ] Soft 404 fix deployed (A5), or knowingly accepted
- [ ] You are available for the next hour

| Step | Who | Action | Verify | Rollback |
|---|---|---|---|---|
| C1 | O | Detach `reach.radio`, `www`, `reachradiotucson.com`, `www` from Cloudflare Pages custom domains. **pages.dev untouched** | Pages project lists only pages.dev | re-add custom domains |
| C2 | O | In Cloudflare DNS, replace apex + `www` records with Vercel target (A `76.76.21.21` or CNAME `cname.vercel-dns.com`), proxy = **DNS only (grey)**. Nameservers stay on Cloudflare | `dig +short reach.radio` returns Vercel IP | restore saved records (A3), wait TTL |
| C3 | O | Same for `reachradiotucson.com` (or the 301 per D3) | same | same |
| C4 | O+C | Vercel shows "Valid Configuration" + cert issued; `curl -sI https://reach.radio/` shows `server: Vercel` | both | rollback as C2 |
| C5 | C | Smoke: `/`, `/donate`, `/teachers`, `/about`, `/about/privacy-policy`, `/api/native-config`, `/api/audio-stream` (307 then 200 `audio/mpeg`), `/sitemap.xml`, `/robots.txt`, `/not-a-page` (404) | each expected code | rollback as C2 |
| C6 | C | Confirm `reach-radio-web.pages.dev` unchanged (200, same title) | curl | n/a |
| C7 | O | Play radio in a desktop browser on `reach.radio` | audio plays, now-playing updates | rollback as C2 |
| C8 | O | Smoke live iOS v3.2 and live Android: open app, play radio | works (they use pages.dev) | rollback as C2 |

### Phase D — Post-cutover (first 48 h)

| Step | Who | Action | Verify |
|---|---|---|---|
| D1 | O | Publish a trivial change in Sanity | page updates on reach.radio (webhook e2e) |
| D2 | O | Contact form submit + reCAPTCHA | email received |
| D3 | O | Submit new sitemap in Search Console; watch 404s | none unexpected |
| D4 | O | Vercel usage page: function invocations, transfer | no spike |
| D5 | O | Restore TTL to normal after 48 h | n/a |

### Phase E — iOS v4 to the App Store (separate repo, `~/Documents/Development/reach-radio-native-ios`)

| Step | Who | Action | Verify |
|---|---|---|---|
| E1 | O+C | Check TestFlight / App Store Connect state (stale since 2026-06-19) | note build number + status |
| E2 | C | Replace dev tunnel fallback with `https://reach.radio` (plan marks it as App Store blocker). Also confirm Watch hardcode `reach.radio/api/audio-stream` still works through the 307 | grep shows no tunnel host in Release config |
| E3 | O+C | Release-configuration build (not Debug) on a real device | launches, fetches `/api/native-config`, loads site |
| E4 | O | Real-device T3: toggle airplane mode / wifi-cellular handoff while playing | recovers or shows sane state |
| E5 | O | Real-device T4: lock screen controls, Control Center, CarPlay if available, Watch playback | each works |
| E6 | O | TestFlight run for several days incl. a few testers | no crash reports |
| E7 | O | App Store submission (v4.0, includes `WKAppBoundDomains` for all three hosts, VERIFIED present) | review passes |
| E8 | O | After release: check v3 users updating, v3.2 stays functional on pages.dev | OK |

### Phase F — Audio Worker flip (independent, after C)

| Step | Who | Action | Verify | Rollback |
|---|---|---|---|---|
| F1 | O+C | Multi-hour soak of `https://stream.reach.radio/` (curl, sleep-guarded, bounded memory), with one `wrangler deploy` mid-stream | bytes flow whole run; reconnect behaviour noted | n/a |
| F2 | O+C | Android playback test A2 on emulator/device (branch `test/stream-reach-radio`) | READY and position over 5 s | n/a |
| F3 | O | Flip Sanity `radioAudioURL` to `https://stream.reach.radio/` | web player + iOS v4 play; Astro desktop player plays | restore old URL in Sanity (instant) |
| F4 | C | Re-point Vercel redirect to the Worker (keep it forever: Watch app + iOS v4 `fallbackStreamURL` hardcode `reach.radio/api/audio-stream`) | 307 to `stream.reach.radio` | revert redirect to pages.dev |

### Phase G — Later / not blocking

- Android: separate project. Needs rebase or merge of `bridge-testing-recovered`, June P0s, then URL switch. Live Android untouched until a release.
- Astro sunset: only when published Android, iOS v3.2 and any Watch/v4 hardcodes are gone. Plan unwritten (roadmap 12).
- Housekeeping: delete `/api/stream-info` (roadmap 13), Sanity `radioAudioURL` description/validation (14), web player `onEnded`/`onStalled` (15), iOS ticket (16), shared Radiojar poll cache (17).

---

## 7. "Do not break" freeze list

- Never redirect, delete or repoint `reach-radio-web.pages.dev`.
- Never push to `reach-radio-web` without checking the auto-deploy answer (A7).
- Never restore a Vercel audio proxy. Audio is Cloudflare only.
- Never change `/api/native-config` `protocolVersion` or bridge message shapes without a native-side check.
- Never move `reach.radio` nameservers off Cloudflare (Worker custom domain needs them).
- Never leave Vercel-bound records on proxied (orange).
- No `studio publish`-style shortcuts here, and no Sanity writes without your explicit action.

---

## 8. Rollback cheat sheet

| What went wrong | Fix | Time |
|---|---|---|
| reach.radio broken after DNS | Restore saved records from A3 (grey or orange as before), re-attach Pages custom domains | TTL (5 min if lowered) |
| Audio dead on web/v4 | Sanity `radioAudioURL` back to `https://reach.radio/api/audio-stream`; or revert Vercel redirect to pages.dev | minutes |
| Wrong canonicals/OG | Fix `NEXT_PUBLIC_SITE_URL`, redeploy | 5 min |
| Bad Vercel deploy | Vercel dashboard: promote previous deployment | 1 min |
| Stale content | Manually POST `/api/revalidate` or redeploy; check webhook log | minutes |

---

## 9. Known unknowns

| Unknown | Resolve by |
|---|---|
| Current `NEXT_PUBLIC_SITE_URL` in Vercel | A2 |
| Pages auto-deploy of `reach-radio-web` | A7 |
| Live apps send `mobile-app` header on every request | A8 |
| TestFlight / App Store Connect state of v4 | E1 |
| Sanity webhook current config | B6 |
| 307 free of Vercel billing | Vercel usage page after cutover (INFERRED free) |
| AVPlayer/ExoPlayer on cellular, CarPlay through the redirect | E4/E5 |
| Cause of soft 404 | A5 on preview |

---

## 10. Review order for our walkthrough

1. §2 state map: confirm it matches your mental model.
2. §5 decisions D1 to D6: answer each.
3. Phase A to B: tick off, I do the C-items.
4. Phase C: dry run on paper first, execute together.
5. Phase E and F: schedule after C settles.

## 11. Execution handoff

CLI:
```
cd ~/Documents/Development/reach-radio-nextjs && claude "Read docs/superpowers/plans/2026-10-23-go-live-release-readiness.md. Walk me through it item by item, starting with section 5 decisions. Do not change Sanity, DNS, Vercel env, or push without my explicit approval."
```
In-session:
```
Read docs/superpowers/plans/2026-10-23-go-live-release-readiness.md and walk me through it item by item, starting with section 5. Stop and ask before any Sanity write, Vercel env change, DNS change, or push.
```

## 12. Progress log

- 2026-10-27: D1-D6 accepted as recommended. Pushed d263a79, efbb2a8, 15eca2e. A2, A5, A6 done. A5 caveat: HTTP status stays 200 for unmatched paths (Next streaming limit; prod already does this for `/teachers/zzz-nope`), page shows 404 content plus `noindex`, so `curl` 404 check in §6 C5 should be read as "404 page content + noindex", not status 404. ThemeToggle hydration mismatch fixed (`8abbb6b`, pushed).
- 2026-10-27 (later): Phase C cutover script written: `2026-10-27-phase-b-c-cutover-script.md` (`43a256d`, local, not pushed). Vercel CLI works after `vercel login` as `calvary-tucson`; global default team was wrong (`calvary-tucsons-projects`), fixed with `vercel switch calvary-tucson-s-team`. B3 done: four domains registered on `reach-radio-nextjs` via `vercel api` project endpoint (`vercel domains add` gives 403 `domain_not_owned`; it is the team-level/buy path, not used). All four `verified:false`, waiting on TXT records. No DNS, env, Sanity or webhook change made. Next: owner Part 0 (DNS export, TTL), four TXT records, B4-B7.
- 2026-10-27 (evening): owner added the four `_vercel` TXT records. All four domains `verified:true` in Vercel. Live check after: all four still `HTTP 200`, `server: cloudflare` (Astro), unchanged. A7 answered by wrangler: `reach-radio-web` is Git-connected, production deploys from `master` (last 5 days ago), so auto-deploy is ON. Wrangler login is OAuth with `zone (read)` only, no DNS write; `stream.reach.radio` was created by the Worker `custom_domain = true` route, which cannot add TXT or repoint records. DNS stays a dashboard task (or a scoped API token). Open: DNS export backup (0.1) not confirmed, TTL (0.3) not done, B4-B7.
