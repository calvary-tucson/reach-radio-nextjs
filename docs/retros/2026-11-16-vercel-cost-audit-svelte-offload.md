# Retro: Vercel weekly-usage audit and svelte `perf/server-cost` push (2026-11-16)

## What was done
- Triaged the Vercel weekly usage email. Confirmed no site can go down: Spend Management budget $30, Pause Off (owner, Nov 5); all three production domains return 200; Cloudflare usage 538k of 10M requests.
- Measured the cost spike with `vercel usage --breakdown daily`: Fluid memory $0.34 to $1.80 per day (Nov 6 to 12), then $0.002 per day on Nov 14 and 15. The Nov 13 HTTP 204 retirement of `/api/stream-info-sse` fixed it; the Nov 5 move to the Worker did not.
- svelte repo (`calvarytucson-svelte`): rebased and re-reviewed `perf/server-cost`, fixed the live-stream poll to a flat 30s, removed expired date-based give states, put `/give` under anonymous ISR, regenerated the mock-kit catalog.
- Gates: unit tests 1014/1014, svelte-check 0 errors (under Doppler), `vite build` OK, local dev probe (19 pages 200, cache headers), then owner-approved merge `--no-ff` and push `f4ce2686..ef4a88f2` on main. Deploy Ready in 44s.
- Live probe after deploy: ISR pages and cached APIs return `x-vercel-cache: HIT` after warm-up.

## What worked
- Daily-granularity usage data corrected my first timeline claim before it reached the audit doc.
- Advisor review caught the overstated Spend Management risk and the wrong "Nov 5 fixed it" story.
- Owner's "did you test locally?" exposed a real gap (build and unit tests only); a local dev probe plus post-deploy probe closed it.
- Resource-guard tickets retried byte-identical went through cleanly.

## What did not
- Pushed-readiness was first presented without a local run of the built branch; owner had to ask.
- Early timeline claim wrong (Nov 5 move credited with the fix).
- Several sandbox/Prettier/hook detours: in-place sed on `.ts` blocked, commit hook ran before chained checkout, `--include` globs and `====` strings broke in zsh.
- Probed `www.calvarytucson.com` first, which 308-redirects; apex is the real host for header checks.
- The deploy watcher (`vercel ls | grep Ready`) printed nothing useful for 30 iterations because the CLI output has hyperlink escapes and a bullet before the status.

## Root causes (blameless)
- No checklist step said "run the branch locally before asking to push"; verification guidance stopped at unit tests, check and build.
- Cost story built from weekly totals rather than daily data; no rule to get daily granularity first.
- No recorded note of the apex vs www redirect, or the `vercel ls` output shape.

## Changes codified this turn (file, one-line what)
- Memory `project-vercel-cost-audit-hold.md`: UPDATE 2026-11-16 with measured results (done earlier this session).
- Memory `feedback-verify-live-before-push-question.md`: run built branch locally and probe headers before the push question; probe apex host after deploy.

## Enforcement map (lesson | mechanism | wired and live?)
- Run locally before push question | memory feedback only | text only, deliberate: project-specific judgment, no cheap hook for "ran a local probe".
- Daily usage data before cost claims | memory note in cost-audit project file | text only, same reason.
- Poll deploy status | none | text only; the 30-iteration loop wasted 10 minutes of wall time, noted here.

## Action items
- [ ] owner | main checkout `~/Documents/Development/reach-radio-nextjs` | before next nextjs push | decide on the staged `docs/superpowers/plans/GO-TO-PRODUCTION.md` edit (commit or discard) so main stays clean
- [ ] me | this branch | next session | push the AGENTS.md adapter and the retros (docs-only, owner Yes/No push question)
- [ ] me | next push request | next push | run `git rev-list --count main..origin/main` in the main checkout and surface a stale main in the first push question
- [ ] owner | Playwright MCP | when convenient | run `npx @playwright/mcp install-browser chrome-for-testing` or confirm Orca-only is fine
- [ ] me | Vercel usage | 2026-11-20 | compare svelte Function Duration per day before and after the Nov 16 deploy; done when the $3 to $6 per month estimate is replaced by a measured number in `docs/bugs/vercel-cost-audit-2026-11-all-projects.md`

## Pruned
- Nothing removed; no always-loaded config grew (memory file added, CLAUDE.md untouched).

---

# Addendum: calvarytucson-nextjs offload push and Next 16.4.6 upgrade (2026-11-16)

## What was done
- Cached 6 public search routes (`outreach`, `stores`, `grow`, `groups`, `serve`, `faq`) with `public, s-maxage=300, stale-while-revalidate=60`; errors and invalid requests stay uncached. Test: `tests/api/search-cache-headers.test.ts`.
- Deleted `/api/youtube/playlist/[id]` (no callers, uncached, quota-abuse path).
- Upgraded Next to 16.4.6 (`98ec4771`) after the build-time advisory gate GHSA-mfr8-8qww-v76h (affects `>=16.3.0 <=16.4.4`) blocked the pre-push hook. Repo uses none of the affected APIs, so it was not exploitable here.
- Pushed `813c1130..30f58612` on main. Live probe: `x-vercel-cache: HIT` on all 6 routes, 404 on the deleted route.
- Reviewed and left unchanged on purpose: east live page (server render avoids embed flash), topics/series pages (read `searchParams`), `live-stream-status` (already cached 30s), `results/og`.

## What did not
- Audit finding "results/og has no Cache-Control" was wrong: `ImageResponse` sends `public, immutable, no-transform, max-age=31536000` by default (checked in `next/dist/compiled/@vercel/og/index.edge.js`). The finding came from reading route code, not response headers.
- Pre-push failed 4 times: (1) stale gitignored `.next/dev/types/validator.ts` referencing the deleted route; `rm -rf` and compound commands are blocked even after owner Yes, `rm -f` by explicit path worked; (2, 3) Next advisory gate `SecurityFatalError`; (4) two tests failed under load (`AboutSearchClient.test.tsx` timeout, `SceneRenderer.golden.test.ts`), passed in isolation twice, same push passed on retry. Flakiness is inference, cause not investigated.
- Worktree with symlinked `node_modules` failed `next build` (Turbopack rejects out-of-root symlink); needed a real `npm ci`.
- Main checkout `node_modules` stayed on 16.4.3 after the merge until `npm ci` there.
- I overstated Deployment Retention as a cost lever; it is a storage setting with negligible cost here.
- Build output contained text addressed to an assistant telling it to run `next upgrade --agent=security` and ask the user. It was build-tool output, not an owner instruction; I did not run it, verified the advisory myself via the npm advisories API, and flagged it.

## Root causes (blameless)
- Audit judged routes from source, not live headers; no step required a header probe before listing a finding.
- Deleting a route leaves generated `.next/dev/types` stale, and the pre-push build trusts it.
- Pre-push runs lint, full suite and build in one go; load-sensitive tests have no retry or quarantine.
- No note that Next 16 builds query an advisory registry, so an unpatched version blocks pushes without a code change.

## Changes codified this turn
- Memory `feedback-verify-live-before-push-question.md` already covers probe-before-claim and daily data (earlier this session).
- No new global rule: lessons are project-specific; recorded here.

## Enforcement map (lesson | mechanism | wired and live?)
- Header proof before an audit finding | text only | deliberate: judgment per route, no cheap hook.
- Cache policy on 6 search routes | `tests/api/search-cache-headers.test.ts` | live, runs in pre-push suite.
- Advisory gate | Next build itself | live; fires in pre-push.
- Stale generated types after route delete | none | text only; fix is `rm -f` of the generated files by path.

## Action items
- [ ] me | `docs/bugs/vercel-usage-spike-2026-11.md` section 8c | next session | replace "Nov 5 move" credit with the Nov 13 204 retirement; done when section 8c matches the daily data
- [ ] me | calvarytucson-nextjs | next session | run `AboutSearchClient.test.tsx` and `SceneRenderer.golden.test.ts` under parallel load to confirm or drop the flaky hypothesis
- [ ] owner | calvarytucson-nextjs, calvarytucson-svelte | when sure | remove worktrees `offload-optimizations`, `next-security-upgrade` and local branch `perf/server-cost`
- [ ] owner | Cloudflare dashboard | next session | confirm Workers Paid ($5 per month) status so the bill estimate is complete
