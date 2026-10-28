# iOS: point stream fallback URLs at the Cloudflare Worker (`stream.reach.radio`)

Date: 2026-10-28. Repo: `~/Documents/Development/reach-radio-native-ios` (separate repo; branch from local `main`). Parent session: reach-radio-nextjs go-live. Related: `2026-10-23-go-live-release-readiness.md`, `2026-10-27-phase-b-c-cutover-script.md`, `2026-10-09-stream-hosting-decision.md` §4d.

## Why
Two hardcoded stream URLs in unreleased iOS code point at `https://reach.radio/api/audio-stream`. After the Next.js cutover that is a Vercel 307 to the legacy Astro audio function. Neither is in the stores (v4 and the Watch app are unreleased), so no live user is affected. Pointing both at the Worker (`https://stream.reach.radio/`, 200 `audio/mpeg`, verified 2026-10-28) removes v4's and the Watch's dependency on the Vercel redirect and Astro.

## Runtime coupling (read before editing)
- `AppConfig.fallbackStreamURL` seeds `currentStreamURL`; at runtime the bridge overrides it with the site's `streamUrl`, which comes from Sanity `radioAudioURL` (today `https://reach.radio/api/audio-stream`).
- `notifyBridgeReady()` -> `prefetchPlayerIfNeeded()` (`AudioStreamingManager.swift:283`) pre-builds an AVPlayer for `currentStreamURL` and sets `playerURL`. `play()` compares the requested url to `playerURL` and, on mismatch, tears the player down and rebuilds (lines ~531-551).
- So fallback != Sanity URL is safe (wasted prefetch, slightly slower first tap) but not free. The clean end state is both on the Worker, which happens at the Phase F flip (Sanity `radioAudioURL` -> `https://stream.reach.radio/`). That flip is gated on the Android A2 playback test because Astro also reads `radioAudioURL`.
- **Therefore: implement and test the change now, but do not merge it into the v4 release branch until the Phase F flip is decided with the parent session** (or the owner explicitly accepts the wasted prefetch). Say so in the report.

## Scope (explicit file allowlist, nothing else)
1. `Reach Radio Native/Config/AppConfig.swift:10` `fallbackStreamURL` -> `"https://stream.reach.radio/"`
2. `ReachRadioWatch Watch App/WatchAudioPlayer.swift:10` `watchStandaloneStreamURL` -> `URL(string: "https://stream.reach.radio/")!`; update the "kept in sync manually" comment only if now wrong
3. `CLAUDE.md:125` doc line showing `fallbackStreamURL`
4. `Reach Radio NativeTests/Reach_Radio_NativeTests.swift`, only if a test relied on a literal `https://reach.radio/api/audio-stream` being equal to the fallback (see step 3). Most literals (`streamUrl` JSON fixtures around lines ~441-985) are decoding fixtures: leave them. For the `urlA`/`urlB` prefetch match/mismatch tests (~984, 1287, 1309): if `urlA` stood in for "same as fallback", replace it with `AppConfig.fallbackStreamURL`. Report every swap with the reason.

Do NOT touch: `configURLs`, `fallbackWebURL`, `appBoundHosts`, `WKAppBoundDomains` (Worker is audio-only, not WebView navigation), the dirty `.claude/` and `docs/` files in the main checkout. Anything outside the allowlist: stop and report.

## Steps
1. Create worktree/branch `chore/stream-url-worker` from local `main`. Confirm the two constants and line numbers. Read `prefetchPlayerIfNeeded` and the `play()` mismatch path; confirm the coupling above. If a mismatch can cause anything worse than a rebuild, stop and report.
2. Edit the allowlisted lines. `git diff` must show only those hunks.
3. `grep -rn "reach.radio/api/audio-stream"` excluding `.git`, `.claude`, `docs`. Classify each hit (fixture vs. fallback-equality). Report all.
4. Build and run the FULL test suite for the main app, and compile the Watch target. Scheme/destination: see `CLAUDE.md` and `.claude/skills/run-reach-radio-native-ios`. If xcodebuild is sandbox-blocked, do not degrade: emit `WAITING ON owner` with the exact `!` command.
5. Commit locally: `fix(config): point stream fallback at stream.reach.radio` (plain `git add <paths>`, `git commit -m ... -- <paths>`; no amend/reset, no push, no hook skipping).
6. Report: commit hash, diff, full test result, list of test-literal swaps, and the merge-gating note above.

## Owner-only
- Real-device iOS playback of `https://stream.reach.radio/` in the v4 build (T3): foreground, background, lock screen.
- CarPlay playback (T4) if available.
- Watch standalone playback when that app is next worked on.
- Do not submit v4 to App Store Connect until T3 passes.

## Rollback
`git revert <commit>`. The old URL keeps working through the Vercel 307 until the Phase F flip, and nothing shipped depends on it.

## Sub-session rules
- Never show the owner a known-bad result: self-review diff and test output first.
- Heavy builds: max 2 at once (16 GB Mac). On `RESOURCE GUARD:` denial wait 2-3 min and retry; never work around it.
- Memory safety: tests use existing fixtures; no large-file scripts.
- Every turn ends `DONE <commit/path>` or `WAITING ON <who>: <exact ask>`. The instant a wait or finish occurs, `SendMessage` the parent session (find its bare name via `ListAgents`).
