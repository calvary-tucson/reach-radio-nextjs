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
