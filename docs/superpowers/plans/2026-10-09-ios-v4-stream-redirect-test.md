# iOS v4 Stream Redirect (Option B) Test Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decide, with evidence from iOS v4, whether redirecting `/api/audio-stream` on the new Next.js site to `https://reach-radio-web.pages.dev/api/audio-stream` (option B in `2026-10-09-stream-hosting-decision.md` §4b) gives uninterrupted playback, versus today's Vercel proxy that is cut every ~13 min.

**Architecture:** Add a DEBUG-only stream-URL override to the iOS app (on a branch/worktree, never `main`) so a test build can play any HTTPS stream URL regardless of Sanity/native-config/bridge. Serve the 307 from a local Next dev server behind the existing dev tunnel (Vercel preview URLs are SSO-protected). Run a control test (T0) on today's proxy, then B tests T1–T4 on simulator and a real device.

**Tech Stack:** Next.js 16 (`next.config.ts` `redirects()`), Swift/AVPlayer, `xcrun simctl`, `os.Logger` (subsystem `com.reachradio`, category `audio`), curl.

## Scope

- Target stack: **new Next.js site + new iOS app (v4)**. Android (future) is a follow-up: re-run T1–T3 using its ExoPlayer once it targets the new site. Not covered here.
- Live iOS v3.2 and live Android hardcode `reach-radio-web.pages.dev`; they are untouched by this plan.
- This plan writes tests and throwaway branches only. **No push, no deploy, no Sanity edit, no DNS change.** Merging the redirect to `main` is a separate decision after Task 8.

## Global Constraints

- iOS repo: `~/Documents/Development/reach-radio-native-ios`. Another session does App Store work there (uncommitted user files). **Work only in a git worktree** on branch `test/stream-override`; never touch `main` or the user's dirty files.
- Next.js repo: `~/Documents/Development/reach-radio-nextjs`. Use worktree/branch `test/stream-redirect-b`. Do **not** touch or commit `docs/superpowers/plans/GO-TO-PRODUCTION.md` (user's uncommitted edits).
- Simulator: iPhone 17 Pro `BFA525FE-F8B9-40E2-8A18-2CBB7615FF8D` (iOS 26.5). Scheme `Reach Radio Native Debug`. Bundle `com.goodbarber.reachradio`. Derived data `/tmp/reach-radio-build`.
- Sandbox-blocked commands (`xcodebuild`, `simctl`, device runs, signing): give the user the exact `! <cmd>`; do not fall back to a degraded path.
- Git for subagents: plain `git add <paths>` / `git commit -m "..." -- <paths>` standalone; no amend/reset; no inline python scripts.
- Pass criterion for EVERY test: the log line `play() — creating new AVPlayer … for '<test url>'` shows the test URL, including after each retry (proves override applies on cold start, prefetch and retry).
- Commit scopes: iOS repo uses its own conventions; Next.js repo uses `api` (redirect) and `docs`.

## Verified facts this plan relies on (2026-10-09)

- Preview URL `https://reach-radio-nextjs-gd2tyhzmv-calvary-tucson-s-team.vercel.app/api/audio-stream` → **302 to `vercel.com/sso-api`**. AVPlayer cannot log in, so previews are unusable as the test host.
- Prod alias `https://reach-radio-nextjs.vercel.app` is public (200). It serves today's proxy (`maxDuration = 780`), so it is the T0 control host.
- Nothing in the iOS repo references `vercel.app/api/audio-stream` (grep of `*.swift`, `*.md`, `*.plist` empty).
- iOS has `AVPlayerItemFailedToPlayToEndTime` observer + `maxRetries = 5`, backoff `min(3·2^n, 30)s`, 8s stall watchdog. **No handler for `AVPlayerItemDidPlayToEndTime`** (case-insensitive grep found none; the only `.ended` is at `AudioStreamingManager.swift:1117`, unrelated). If Vercel's 780s cut is a clean end-of-stream, v4 may stop silently with no retry. T0 measures this.
- Stream URL paths that must all honor the override: initial `currentStreamURL` (`AudioStreamingManager.swift:66`), `updateStreamURL` (`:668`, fed by native-config and bridge `ContentView.swift:535-538`), `play(url:)` (`:507`), prefetch (`:285`) and `restartStream` (`:1230`) both read `currentStreamURL`.
- Apple Watch app hardcodes the `reach.radio` stream URL: **not covered**; post-cutover check only (see Task 8).
- Option B dependency risk: it ties the new site's audio to the **old** `reach-radio-web.pages.dev` deployment. User decision (2026-10-09): old pages.dev stays up; fine with that, but it now needs a **long-term ownership plan** (Cloudflare Pages project updates, maintenance, dependency/Astro upgrades, monitoring, who deploys). Not in scope here; tracked as a follow-up item in Task 8. If the old Astro project is ever deleted, v4 and web audio break.

## File Structure

| Repo | File | Change |
|---|---|---|
| nextjs (branch `test/stream-redirect-b`) | `next.config.ts` | add `redirects()` entry; add pages.dev to CSP `media-src` |
| ios (worktree `test/stream-override`) | `Reach Radio Native/Audio/AudioStreamingManager.swift` | DEBUG override helper + 3 call sites |
| ios | `Reach Radio NativeTests/AudioStreamingManagerStreamOverrideTests.swift` | new unit test |
| nextjs (main) | `docs/superpowers/plans/2026-10-09-stream-hosting-decision.md` | append results (Task 8) |

---

### Task 1: Preconditions, control data, host setup (read-only)

**Files:** none modified.

- [ ] **Step 1: Confirm clean worktree starting points**

Run: `cd ~/Documents/Development/reach-radio-native-ios && git worktree list && git branch --show-current`
Expected: only the main checkout listed. Do not modify it.

- [ ] **Step 2: Confirm the 307 target streams**

Run: `curl -sI --max-time 15 https://reach-radio-web.pages.dev/api/audio-stream | head -8`
Expected: `HTTP/2 200`, `content-type: audio/mpeg`.

- [ ] **Step 3: Measure pages.dev max session length (unknown #1)**

User runs in a spare terminal (public GET, ~60 min, discards audio):
`! curl -s -o /dev/null --max-time 3600 -w 'closed after %{time_total}s, %{size_download} bytes, http %{http_code}\n' https://reach-radio-web.pages.dev/api/audio-stream`
Record the line. If it closes under ~30 min, B fails regardless of iOS behavior; note it for Task 8.

- [ ] **Step 4: Confirm dev tunnel ownership**

Run: `lsof -iTCP -sTCP:LISTEN -P | grep -E 'node|next' | head` and `pgrep -fl cloudflared`.
Per memory: user runs the dev server in a dedicated session behind `dev.calvarytucson.com`. Check what is on which port first; do not start a second server on the user's port. If none is running, ask the user to start one from the worktree created in Task 2 (`! cd <worktree> && npm run dev`).

- [ ] **Step 5: Confirm tunnel is public HTTPS and not SSO-gated**

Run: `curl -sI --max-time 10 https://dev.calvarytucson.com/api/native-config | head -5`
Expected: 200. If not 200, stop and ask the user (fallbacks: Vercel protection-bypass token as `?x-vercel-protection-bypass=<secret>` on the preview URL, generated by the user in Vercel project settings; or shipping the redirect to prod, which is a push needing explicit permission).

---

### Task 2: Next.js branch with option B redirect + CSP

**Files:**
- Modify: `next.config.ts` (in worktree `test/stream-redirect-b`)

- [ ] **Step 1: Create worktree**

Run: `cd ~/Documents/Development/reach-radio-nextjs && git worktree add ../reach-radio-nextjs-redirect-b -b test/stream-redirect-b`
Then `cd ../reach-radio-nextjs-redirect-b && npm ci` (or symlink-free install per repo norm).

- [ ] **Step 2: Add redirect**

In `next.config.ts`, replace the `redirects()` body with:

```ts
  async redirects() {
    return [
      { source: '/speakers/:slug*', destination: '/teachers/:slug*', permanent: true },
      {
        source: '/api/audio-stream',
        destination: 'https://reach-radio-web.pages.dev/api/audio-stream',
        permanent: false,
      },
    ]
  },
```

Keep `src/app/api/audio-stream/route.ts` untouched for rollback.

- [ ] **Step 3: Add pages.dev to CSP media-src (browser path; INFERRED to be required for a redirect hop)**

Change the `media-src` line to:

```ts
              "media-src 'self' https://*.radiojar.com https://reach.radio https://reach-radio-web.pages.dev",
```

- [ ] **Step 4: Verify the redirect locally**

Run the dev server from the worktree (user-owned port, see Task 1 step 4), then:
`curl -sI http://localhost:<port>/api/audio-stream | head -5`
Expected: `HTTP/1.1 307 Temporary Redirect` and `location: https://reach-radio-web.pages.dev/api/audio-stream`.
Then through the tunnel: `curl -sI https://dev.calvarytucson.com/api/audio-stream | head -5` — same expectation.

- [ ] **Step 5: Lint/type check and commit on the branch**

Run: `npx tsc --noEmit && npm run lint`
Expected: pass.
```bash
git add next.config.ts
git commit -m "test(api): redirect /api/audio-stream to pages.dev for iOS option B trial" -- next.config.ts
```
Do not push. Do not merge.

---

### Task 3: iOS DEBUG stream override (TDD)

**Files:**
- Modify: `Reach Radio Native/Audio/AudioStreamingManager.swift:66, :507, :668`
- Test: `Reach Radio NativeTests/AudioStreamingManagerStreamOverrideTests.swift`

**Interfaces:**
- Produces: `static func effectiveStreamURL(_ url: String) -> String` on `AudioStreamingManager`. In DEBUG, returns `UserDefaults.standard.string(forKey: "streamURLOverride")` when it starts with `https://`; otherwise returns `url`. In Release always returns `url`.

- [ ] **Step 1: Create worktree**

Run: `cd ~/Documents/Development/reach-radio-native-ios && git worktree add ../reach-radio-native-ios-stream-override -b test/stream-override main`
All following steps run inside `../reach-radio-native-ios-stream-override`.

- [ ] **Step 2: Write the failing test**

Create `Reach Radio NativeTests/AudioStreamingManagerStreamOverrideTests.swift`:

```swift
import XCTest
@testable import Reach_Radio

final class AudioStreamingManagerStreamOverrideTests: XCTestCase {
    private let key = "streamURLOverride"

    override func tearDown() {
        UserDefaults.standard.removeObject(forKey: key)
        super.tearDown()
    }

    func testNoOverrideReturnsInput() {
        UserDefaults.standard.removeObject(forKey: key)
        XCTAssertEqual(AudioStreamingManager.effectiveStreamURL("https://a.test/s"), "https://a.test/s")
    }

    func testHttpsOverrideWinsInDebug() {
        UserDefaults.standard.set("https://b.test/s", forKey: key)
        XCTAssertEqual(AudioStreamingManager.effectiveStreamURL("https://a.test/s"), "https://b.test/s")
    }

    func testNonHttpsOverrideIgnored() {
        UserDefaults.standard.set("http://b.test/s", forKey: key)
        XCTAssertEqual(AudioStreamingManager.effectiveStreamURL("https://a.test/s"), "https://a.test/s")
    }
}
```

If the module name differs, check an existing file's import (`head -12 "Reach Radio NativeTests/AudioStreamingManagerPlaybackTests.swift"`) and match it.

- [ ] **Step 3: Run test, expect failure**

User runs (sandbox blocks xcodebuild test):
`! cd ~/Documents/Development/reach-radio-native-ios-stream-override && xcodebuild test -scheme "Reach Radio Native Debug" -destination "platform=iOS Simulator,id=BFA525FE-F8B9-40E2-8A18-2CBB7615FF8D" -derivedDataPath /tmp/reach-radio-build -only-testing:"Reach Radio NativeTests/AudioStreamingManagerStreamOverrideTests" 2>&1 | grep -E "error:|Test Case|TEST" | tail -15`
Expected: compile error `type 'AudioStreamingManager' has no member 'effectiveStreamURL'`.

- [ ] **Step 4: Implement**

In `AudioStreamingManager.swift`, add inside the class (near `updateStreamURL`):

```swift
    /// Test-only (DEBUG): `-streamURLOverride https://…` launch argument (simctl / Xcode scheme
    /// arguments land in UserDefaults) replaces every stream URL the app would play.
    /// Release builds always return the input.
    static func effectiveStreamURL(_ url: String) -> String {
        #if DEBUG
        if let override = UserDefaults.standard.string(forKey: "streamURLOverride"),
           override.hasPrefix("https://") {
            audioLogger.error("⚠️ stream override active: '\(url)' → '\(override)'")
            return override
        }
        #endif
        return url
    }
```

Apply at three sites:
1. Line 66: `var currentStreamURL: String = AudioStreamingManager.effectiveStreamURL(AppConfig.fallbackStreamURL)`
2. `updateStreamURL`: `currentStreamURL = Self.effectiveStreamURL(url)`
3. `play(url:)` — rename the parameter and shadow at the top:

```swift
    func play(url requestedURL: String) {
        let url = Self.effectiveStreamURL(requestedURL)
        playRequestedAt = Date()
```
(call sites use the `url:` label and need no change).

- [ ] **Step 5: Run test, expect pass; build Debug**

Re-run the Step 3 command. Expected: 3 tests pass. Then run the existing playback suite: add `-only-testing:"Reach Radio NativeTests/AudioStreamingManagerPlaybackTests"`; expected unchanged pass.

- [ ] **Step 6: Commit on the branch**

```bash
git add "Reach Radio Native/Audio/AudioStreamingManager.swift" "Reach Radio NativeTests/AudioStreamingManagerStreamOverrideTests.swift"
git commit -m "test: add DEBUG-only streamURLOverride launch argument" -- "Reach Radio Native/Audio/AudioStreamingManager.swift" "Reach Radio NativeTests/AudioStreamingManagerStreamOverrideTests.swift"
```
Never merge to `main`.

---

### Task 4: Build + log harness

**Files:** none (use the iOS run skill's `smoke.sh` as reference only).

- [ ] **Step 1: Build, install on simulator (user runs)**

`! cd ~/Documents/Development/reach-radio-native-ios-stream-override && xcodebuild -scheme "Reach Radio Native Debug" -destination "platform=iOS Simulator,id=BFA525FE-F8B9-40E2-8A18-2CBB7615FF8D" -configuration Debug -derivedDataPath /tmp/reach-radio-build build 2>&1 | grep -E "BUILD|error:" | tail -3`
Then: `! xcrun simctl boot BFA525FE-F8B9-40E2-8A18-2CBB7615FF8D; open -a Simulator; xcrun simctl install BFA525FE-F8B9-40E2-8A18-2CBB7615FF8D "/tmp/reach-radio-build/Build/Products/Debug-iphonesimulator/Reach Radio.app"`

- [ ] **Step 2: Start the log stream in a second terminal (user runs; keep it open and save to a file)**

`! xcrun simctl spawn BFA525FE-F8B9-40E2-8A18-2CBB7615FF8D log stream --level debug --predicate 'subsystem == "com.reachradio" AND category == "audio"' | tee /tmp/ios-audio-$(date +%H%M).log`

- [ ] **Step 3: Launch helper**

Launch command template (replace `<URL>`):
`! xcrun simctl terminate BFA525FE-F8B9-40E2-8A18-2CBB7615FF8D com.goodbarber.reachradio; xcrun simctl launch BFA525FE-F8B9-40E2-8A18-2CBB7615FF8D com.goodbarber.reachradio -streamURLOverride "<URL>"`
Then tap play in the Simulator window (or use the XCUITest id `mediaBarPlayPauseButton`). The app loads the new site via native-config (`webUrl` on vercel.app), which provides the media bar.

---

### Task 5: T0 control — today's Vercel proxy

**Goal:** quantify the current ~13 min cut and what v4 does.

- [ ] **Step 1:** Launch with `<URL>` = `https://reach-radio-nextjs.vercel.app/api/audio-stream`. Press play. Record wall-clock start time.
- [ ] **Step 2:** Keep the app foregrounded and playing ~15 min. Watch the log for: `playerItemFailed — scheduling retry`, any stall watchdog line, or silence.
- [ ] **Step 3: Record results** (fill in during execution):
  - Time of cut: ____ (expect ~13:00)
  - Log shows retry? yes/no. Audio resumed automatically? yes/no. Gap length: ____ s
  - If audio silently stopped with **no** retry log: clean EOF is unhandled in v4 (no `AVPlayerItemDidPlayToEndTime` handler). That is a real bug independent of option B; file it for the iOS repo.
- [ ] **Step 4:** Confirm the log line `play() — creating new AVPlayer … for 'https://reach-radio-nextjs.vercel.app/api/audio-stream'` (proves the override path works).

---

### Task 6: T1 cold start through the 307 (simulator)

- [ ] **Step 1:** With the Task 2 dev server + tunnel running, launch with `<URL>` = `https://dev.calvarytucson.com/api/audio-stream`.
- [ ] **Step 2:** Press play. **Pass:** audio audible within 10 s; log shows `creating new AVPlayer (cold start) for 'https://dev.calvarytucson.com/api/audio-stream'`; no `playerItemFailed`; the dev server console shows `GET /api/audio-stream 307`.
- [ ] **Step 3:** Also test the prefetch path: terminate, relaunch with the same argument, wait 5 s before pressing play. Log should show `🔄 prefetch — pre-creating AVPlayer for 'https://dev.calvarytucson.com/…'`.
- [ ] **Step 4: Fail handling.** If AVPlayer errors, capture the log `error` text and the NSError code. Candidates: redirect not followed for live streams, ATS, or cross-host redirect refused. Record and stop B; go to Task 8 with outcome FAIL.

---

### Task 7: T2 soak, T3 network flap, T4 system integration

Run T2 on simulator first, then T2–T4 on a real device (user's job: signing, install, device log via Console.app filtered `subsystem:com.reachradio category:audio`, or Xcode device console). Device launch arg: add `-streamURLOverride https://dev.calvarytucson.com/api/audio-stream` under Product > Scheme > Edit Scheme > Run > Arguments. The dev tunnel must stay up for the entire run.

- [ ] **T2 soak (≥60 min, both foregrounded and screen-locked).** Pass: no cut at 13 min; continuous audio to 60 min or the pages.dev limit measured in Task 1 step 3. Record when and how it ends and whether v4 reconnects (log `retry n/5`).
- [ ] **T3 network flap (device).** (a) Airplane mode 30 s then off. (b) Wi-Fi → cellular switch mid-play. Pass: playback recovers within ~45 s; the retry log line shows the **tunnel URL**, and the dev server logs a new `GET /api/audio-stream 307` (redirect re-followed on reconnect).
- [ ] **T4 system integration (device).** Lock-screen play/pause, Control Center now-playing, sleep timer expiry, CarPlay if available, background → foreground. Pass: no regression vs T0 behavior.

---

### Task 8: Record results, decide, clean up

**Files:**
- Modify: `docs/superpowers/plans/2026-10-09-stream-hosting-decision.md` (nextjs `main`; append a "§4c iOS v4 test results" section)

- [ ] **Step 1: Append results.** Table of T0–T4 with pass/fail, measured values (pages.dev session length, T0 cut time and recovery, redirect-follow evidence). Add: SSO-gated previews finding (302 to `vercel.com/sso-api`), the DEBUG-override technique, and the missing `DidPlayToEndTime` handler finding (if T0 confirms). Add the pages.dev dependency risk.
- [ ] **Step 2: Decision gate (user decides).**
  - T1–T3 pass and pages.dev lasts ≥ 60 min → recommend merging the redirect + CSP to `main` (push needs explicit permission) and re-testing Watch after cutover (hardcoded `reach.radio` URL).
  - Redirect fails or pages.dev caps short → go to option A (proxied stream subdomain) or E (client reconnect), per the decision doc.
  - T0 silent stop → separate iOS fix ticket regardless.
- [ ] **Step 2b: Follow-up (needs its own plan).** If B is chosen, write a long-term plan for the Cloudflare Pages `reach-radio-web` project: what must stay (only `/api/audio-stream` is needed by the new stack; the live iOS v3.2 and Android also still depend on the whole site), update/maintenance cadence, Astro/dependency upgrades, deploy trigger (UNKNOWN: whether Cloudflare auto-deploys `master`), monitoring/alerts, owner, and the retirement path once old apps are gone. Alternative to weigh in that plan: move only the stream endpoint to a small standalone Cloudflare Worker so the full Astro site can eventually retire.
- [ ] **Step 3: Commit docs only**

```bash
git add docs/superpowers/plans/2026-10-09-stream-hosting-decision.md
git commit -m "docs: record iOS v4 stream redirect test results" -- docs/superpowers/plans/2026-10-09-stream-hosting-decision.md
```
- [ ] **Step 4: Cleanup (ask before deleting).** Offer to remove worktrees `../reach-radio-nextjs-redirect-b` and `../reach-radio-native-ios-stream-override` and branches after the user confirms results are saved. Never delete unmerged work without asking.

---

## Self-review

- Spec coverage: redirect-following (T1), reconnect through redirect (T3), real device (Task 7), control (T0), pages.dev session cap (Task 1), CSP (Task 2), rollback (route kept, branch unmerged), Watch (Task 8 gate), Android scoped as follow-up.
- Type consistency: `effectiveStreamURL(_:)` used identically in tests and three call sites; override key `streamURLOverride` identical in code, tests and launch args.
- Not covered by design: browser CSP verification (web path; see decision doc §4b), Vercel config-redirect-vs-function behavior (requires a deploy; the dev server only proves the 307 response, not Vercel's edge handling).

## Execution handoff

CLI:
```
cd ~/Documents/Development/reach-radio-nextjs && claude "Execute docs/superpowers/plans/2026-10-09-ios-v4-stream-redirect-test.md using superpowers:subagent-driven-development. Stop and give me ! commands for anything the sandbox blocks. No push, no deploy."
```

In-session:
```
Execute docs/superpowers/plans/2026-10-09-ios-v4-stream-redirect-test.md using superpowers:subagent-driven-development. Work only in the two worktrees it names. Give me exact ! commands for xcodebuild/simctl/device steps. No push, no deploy, no Sanity or DNS changes.
```
