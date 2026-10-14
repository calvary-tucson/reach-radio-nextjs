# stream.reach.radio Client Compatibility Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the deployed Worker `https://stream.reach.radio/` plays in the web player, the Android app and the iOS app, with no production change (no Sanity flip, no redirect re-point, no push).

**Architecture:** Three independent tracks. Web: allow the host in CSP `media-src` (the only blocker found), then drive a real page in a browser. Android: a throwaway branch that swaps the hardcoded `Config.AUDIO_STREAM_URL` plus an instrumented ExoPlayer test. iOS: make the existing override soak test fail when playback drops, then run it against the Worker. Results are recorded in the decision doc and roadmap.

**Tech Stack:** Next.js 16 (`next.config.ts`), Vitest, Playwright MCP, Kotlin / Media3 1.6.1 / AndroidJUnit4, Swift XCUITest, `xcodebuild`.

## Global Constraints

- Worker is live: `curl` on 2026-10-14 returned HTTP/2 200, `content-type: audio/mpeg`, `cache-control: no-store`, `server: cloudflare`; 201,875 bytes in 8 s. Sandbox needs `stream.reach.radio` in `allowed_domains` for any `curl` to it.
- The Worker sends no `Access-Control-Allow-Origin`. The web player (`src/components/AudioProvider.tsx`) uses a plain `<audio src>` with no `crossOrigin`, no `AudioContext`, no `fetch` of the stream, so CSP `media-src` is sufficient. If Task W2 shows otherwise, STOP and report: the fix is an ACAO header in `~/Documents/Development/reach-radio-audio-stream-worker/src/handler.ts`, not here.
- No push, no deploy, no Sanity change, no DNS change. Local commits only (conventional commits; canonical scopes from `AGENTS.md`).
- Do NOT change the `/api/audio-stream` redirect destination in `next.config.ts` (it stays `https://reach-radio-web.pages.dev/api/audio-stream`). Re-pointing it is roadmap item 11, gated on the Worker soak. This plan covers only the CSP half of Worker plan Task 4 Step 1; when that task runs, skip its CSP edit.
- Android `main` stays on `pages.dev` by decision. All Android work is on throwaway branch `test/stream-reach-radio`, never merged.
- iOS work is in worktree `~/Documents/Development/reach-radio-native-ios-stream-override` on branch `test/stream-override`, never merged.
- Dev server (`reach-radio-nextjs`) is currently down (Doppler fallback-file error). Steps needing it are marked **USER**.
- Every **USER** step is an exact `! <command>`; the sandbox blocks emulators, Xcode and Gradle device runs.
- TypeScript strict, no `any`. Tailwind/UI rules do not apply (no UI change).

## File Structure

- `reach-radio-nextjs/next.config.ts`: add host to CSP `media-src`.
- `reach-radio-nextjs/tests/unit/next-config-audio-stream.test.ts`: add one CSP assertion.
- `reach-radio-native-android/app/src/main/java/com/goodbarber/reachradio/Config.kt`: swap URL (throwaway branch).
- `reach-radio-native-android/app/src/test/java/com/goodbarber/reachradio/ConfigTest.kt`: update expectation (throwaway branch).
- `reach-radio-native-android/app/src/androidTest/java/com/goodbarber/reachradio/audio/StreamReachRadioTest.kt`: new instrumented test (throwaway branch).
- `reach-radio-native-ios-stream-override/Reach Radio NativeUITests/StreamOverrideSoakUITests.swift`: add hard assertion.
- `reach-radio-nextjs/docs/superpowers/plans/2026-10-09-stream-hosting-decision.md` (§4c) and `2026-10-13-audio-stream-master-roadmap.md`: results.

---

### Task W1: Allow `stream.reach.radio` in CSP `media-src` (TDD)

**Files:**
- Modify: `reach-radio-nextjs/next.config.ts:37`
- Test: `reach-radio-nextjs/tests/unit/next-config-audio-stream.test.ts`

**Interfaces:**
- Produces: CSP header `media-src` containing `https://stream.reach.radio`.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('next.config audio stream', ...)` block in `tests/unit/next-config-audio-stream.test.ts`, before its closing `})`:

```ts
  it('allows the stream.reach.radio Worker host in CSP media-src', async () => {
    const headers = await nextConfig.headers?.()
    const csp = headers
      ?.flatMap((h) => h.headers)
      .find((h) => h.key === 'Content-Security-Policy')?.value
    expect(csp).toMatch(/media-src[^;]*https:\/\/stream\.reach\.radio/)
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/next-config-audio-stream.test.ts`
Expected: 1 FAIL (the new test), 2 pass.

- [ ] **Step 3: Implement**

In `next.config.ts`, change the `media-src` line to:

```ts
              "media-src 'self' https://*.radiojar.com https://reach.radio https://reach-radio-web.pages.dev https://stream.reach.radio",
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/unit/next-config-audio-stream.test.ts && npx tsc --noEmit`
Expected: 3 passed, tsc exits 0. (If tsc reports stale `.next/dev/types/validator.ts`, delete only that generated file and re-run.)

- [ ] **Step 5: Commit**

```bash
git add next.config.ts tests/unit/next-config-audio-stream.test.ts
git commit -m "feat(api): allow stream.reach.radio in CSP media-src" -- next.config.ts tests/unit/next-config-audio-stream.test.ts
```

---

### Task W2: Browser check on the real page (USER starts dev server)

**Files:** none modified. Output is a recorded result.

**Interfaces:**
- Consumes: Task W1 CSP; the real `<audio>` element rendered by `AudioProvider` (`src/components/AudioProvider.tsx`).

- [ ] **Step 1 (USER): start the dev server with the new config**

```
! cd ~/Documents/Development/reach-radio-nextjs && doppler run -- npm run dev
```
(Use your usual Doppler start command if different. Must be restarted so `next.config.ts` is re-read.) Tell the agent the port.

- [ ] **Step 2: Confirm the served CSP includes the host**

Run: `curl -sI http://localhost:3000/ | grep -i content-security-policy | grep -o "media-src[^;]*"`
Expected: output contains `https://stream.reach.radio`.

- [ ] **Step 3: Exercise the real page's audio element (Playwright MCP, desktop viewport so `AudioProvider` renders)**

Navigate to `http://localhost:3000/`, then `browser_evaluate`:

```js
async () => {
  const violations = []
  document.addEventListener('securitypolicyviolation', (e) => violations.push(e.blockedURI + ' ' + e.violatedDirective))
  const el = document.querySelector('audio')
  if (!el) return { error: 'no audio element on page' }
  el.src = 'https://stream.reach.radio/'
  const events = []
  ;['loadstart', 'loadeddata', 'canplay', 'playing', 'error', 'stalled'].forEach((n) =>
    el.addEventListener(n, () => events.push(n)))
  try { await el.play() } catch (e) { events.push('play-rejected:' + e.name) }
  await new Promise((r) => setTimeout(r, 8000))
  const out = { events, violations, readyState: el.readyState, currentTime: el.currentTime, errorCode: el.error?.code ?? null }
  el.pause(); el.removeAttribute('src'); el.load()
  return out
}
```

Pass: `violations` is `[]`, `events` includes `playing`, `currentTime` > 2, `errorCode` is `null`.
Fail with a CORS-style `error` and no CSP violation: STOP, report (see Global Constraints: ACAO fix belongs in the Worker repo).
Note: browsers may reject `play()` without a user gesture (`play-rejected:NotAllowedError`); if so, click the page's own Play control once, then re-run the snippet.

- [ ] **Step 4: Record result**

Append a dated line under §4c of `docs/superpowers/plans/2026-10-09-stream-hosting-decision.md`: `Web (localhost, <date>): stream.reach.radio <PASS|FAIL>; violations=<n>, currentTime=<s>`. Commit:

```bash
git add docs/superpowers/plans/2026-10-09-stream-hosting-decision.md
git commit -m "docs: record web player result for stream.reach.radio" -- docs/superpowers/plans/2026-10-09-stream-hosting-decision.md
```

---

### Task A1: Android swap and instrumented stream test

**Files (repo `~/Documents/Development/reach-radio-native-android`, branch `test/stream-reach-radio`):**
- Modify: `app/src/main/java/com/goodbarber/reachradio/Config.kt:6`
- Modify: `app/src/test/java/com/goodbarber/reachradio/ConfigTest.kt:14`
- Create: `app/src/androidTest/java/com/goodbarber/reachradio/audio/StreamReachRadioTest.kt`

**Interfaces:**
- Consumes: `Config.AUDIO_STREAM_URL` (read by `audio/PlaybackService.kt:63,227`); Media3 `ExoPlayer` 1.6.1.
- Produces: instrumented test `StreamReachRadioTest.playsStreamFromConfigUrl`.

- [ ] **Step 1: Create the throwaway branch**

```bash
cd ~/Documents/Development/reach-radio-native-android
git switch -c test/stream-reach-radio
```
Expected: `Switched to a new branch 'test/stream-reach-radio'`.

- [ ] **Step 2: Update the unit test first (failing)**

In `ConfigTest.kt`, replace the line asserting the audio stream URL with:

```kotlin
        assertThat(Config.AUDIO_STREAM_URL).isEqualTo("https://stream.reach.radio/")
```

Run: `./gradlew :app:testDebugUnitTest --tests '*ConfigTest*'`
Expected: FAIL (still the `pages.dev` URL).

- [ ] **Step 3: Swap the URL**

In `Config.kt` replace line 6 with:

```kotlin
    const val AUDIO_STREAM_URL = "https://stream.reach.radio/"
```

Run: `./gradlew :app:testDebugUnitTest --tests '*ConfigTest*'`
Expected: PASS.

- [ ] **Step 4: Write the instrumented stream test**

`app/src/androidTest/java/com/goodbarber/reachradio/audio/StreamReachRadioTest.kt`:

```kotlin
package com.goodbarber.reachradio.audio

import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.goodbarber.reachradio.Config
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.atomic.AtomicReference

/** Plays Config.AUDIO_STREAM_URL with the same ExoPlayer stack the app uses and checks audio advances. */
@UnstableApi
@RunWith(AndroidJUnit4::class)
class StreamReachRadioTest {

    @Test
    fun playsStreamFromConfigUrl() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val playerRef = AtomicReference<ExoPlayer>()
        val errorRef = AtomicReference<String?>(null)

        instrumentation.runOnMainSync {
            val player = ExoPlayer.Builder(context).build()
            player.addListener(object : Player.Listener {
                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    errorRef.set(error.errorCodeName)
                }
            })
            player.setMediaItem(MediaItem.fromUri(Config.AUDIO_STREAM_URL))
            player.prepare()
            player.play()
            playerRef.set(player)
        }

        var positionMs = 0L
        var state = Player.STATE_IDLE
        val deadline = System.currentTimeMillis() + 30_000
        while (System.currentTimeMillis() < deadline && errorRef.get() == null) {
            instrumentation.runOnMainSync {
                positionMs = playerRef.get().currentPosition
                state = playerRef.get().playbackState
            }
            if (state == Player.STATE_READY && positionMs > 5_000) break
            Thread.sleep(500)
        }
        instrumentation.runOnMainSync { playerRef.get().release() }

        assertThat(errorRef.get()).isNull()
        assertThat(state).isEqualTo(Player.STATE_READY)
        assertThat(positionMs).isGreaterThan(5_000L)
    }
}
```

- [ ] **Step 5: Compile the test APK (no device needed)**

Run: `./gradlew :app:assembleDebugAndroidTest`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/com/goodbarber/reachradio/Config.kt app/src/test/java/com/goodbarber/reachradio/ConfigTest.kt app/src/androidTest/java/com/goodbarber/reachradio/audio/StreamReachRadioTest.kt
git commit -m "test: point AUDIO_STREAM_URL at stream.reach.radio and add stream playback test" -- app/src/main/java/com/goodbarber/reachradio/Config.kt app/src/test/java/com/goodbarber/reachradio/ConfigTest.kt app/src/androidTest/java/com/goodbarber/reachradio/audio/StreamReachRadioTest.kt
```

---

### Task A2: Run the Android test (USER; no emulator or device exists yet)

**Files:** none. As of 2026-10-14, `emulator -list-avds` is empty and `adb devices` shows no device.

- [ ] **Step 1 (USER): provide a target.** Either plug in a physical Android device with USB debugging on (`! ~/Library/Android/sdk/platform-tools/adb devices` must list it), or create an emulator:

```
! uname -m
! ~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager "system-images;android-35;google_apis;arm64-v8a"
! ~/Library/Android/sdk/cmdline-tools/latest/bin/avdmanager create avd -n reach_test -k "system-images;android-35;google_apis;arm64-v8a" -d pixel_7
! ~/Library/Android/sdk/emulator/emulator -avd reach_test -no-snapshot
```
(`uname -m` prints `arm64` on Apple Silicon; on `x86_64` use `x86_64` in place of `arm64-v8a`. If `cmdline-tools` is missing, install it in Android Studio → SDK Manager → SDK Tools.)

- [ ] **Step 2 (USER): run only the new test**

```
! cd ~/Documents/Development/reach-radio-native-android && ./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.goodbarber.reachradio.audio.StreamReachRadioTest
```
Pass: `BUILD SUCCESSFUL`, 1 test, 0 failed. Fail output names the `errorCodeName` (for example `ERROR_CODE_IO_NETWORK_CONNECTION_FAILED`).

- [ ] **Step 3: Record** the result in decision doc §4c (`Android (<device/emulator>, <date>): PASS|FAIL <errorCodeName>`), docs-only local commit in `reach-radio-nextjs`:

```bash
git add docs/superpowers/plans/2026-10-09-stream-hosting-decision.md
git commit -m "docs: record Android result for stream.reach.radio" -- docs/superpowers/plans/2026-10-09-stream-hosting-decision.md
```

---

### Task I1: Make the iOS soak test fail when playback drops

**Why:** on 2026-10-14 the soak reported `** TEST SUCCEEDED **` after 33 minutes of `label=Play radio`. The loop only logs the label.

**Files (worktree `~/Documents/Development/reach-radio-native-ios-stream-override`, branch `test/stream-override`):**
- Modify: `Reach Radio NativeUITests/StreamOverrideSoakUITests.swift:91-94`
- Add to git: the same file (currently untracked)

- [ ] **Step 1: Add the assertion in the heartbeat block**

Replace lines 91-94 with:

```swift
            if elapsed >= nextHeartbeat {
                let label = playButton.label
                stamp("HOLD elapsed=\(Int(elapsed))s state=\(app.state.rawValue) label=\(label)")
                XCTAssertTrue(label.lowercased().contains("pause"),
                              "Playback dropped at \(Int(elapsed))s: button label is '\(label)', expected 'Pause'")
                nextHeartbeat += 60
            }
```

(`continueAfterFailure = true` is already set, so the soak keeps running and every dropped minute is reported, but the test now ends `** TEST FAILED **`.)

- [ ] **Step 2: Commit**

```bash
cd ~/Documents/Development/reach-radio-native-ios-stream-override
git add "Reach Radio NativeUITests/StreamOverrideSoakUITests.swift"
git commit -m "test: add soak harness and fail when playback drops" -- "Reach Radio NativeUITests/StreamOverrideSoakUITests.swift"
```

---

### Task I2: Run the iOS test against the Worker (USER)

**Files:** none.

- [ ] **Step 1 (USER): 5-minute run**

```
! cd ~/Documents/Development/reach-radio-native-ios-stream-override && TEST_RUNNER_STREAM_URL=https://stream.reach.radio/ TEST_RUNNER_SOAK_SECONDS=300 xcodebuild test -project "Reach Radio.xcodeproj" -scheme "Reach Radio Native Debug" -destination "platform=iOS Simulator,id=BFA525FE-F8B9-40E2-8A18-2CBB7615FF8D" -parallel-testing-enabled NO -derivedDataPath /tmp/reach-radio-build -only-testing:"Reach Radio NativeUITests/StreamOverrideSoakUITests" 2>&1 | grep -E 'SOAK-MARKER|error:|TEST (SUCCEEDED|FAILED)'
```
Pass: `PLAY_STATE ... flipped=true`, five `HOLD` lines each `label=Pause radio`, `** TEST SUCCEEDED **`.
Fail: any `label=Play radio` HOLD line or `** TEST FAILED **`.

- [ ] **Step 2 (USER, optional second terminal): audio log**

```
! xcrun simctl spawn booted log stream --level debug --predicate 'subsystem == "com.reachradio" AND category == "audio"'
```
Expected: `stream override active: ... → 'https://stream.reach.radio/'` then `timeControlStatus → playing`.

- [ ] **Step 3: Record** the result in decision doc §4c (`iOS sim 5 min (<date>): PASS|FAIL`) and commit in `reach-radio-nextjs`:

```bash
git add docs/superpowers/plans/2026-10-09-stream-hosting-decision.md
git commit -m "docs: record iOS result for stream.reach.radio" -- docs/superpowers/plans/2026-10-09-stream-hosting-decision.md
```

---

### Task R: Roadmap close-out

**Files:** Modify `docs/superpowers/plans/2026-10-13-audio-stream-master-roadmap.md`.

- [ ] **Step 1:** Set row 19 (added when this plan was saved) status to the three results (web, Android, iOS), and note that Android `main` hardcodes `pages.dev` so it cannot use the Worker without a release.
- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-10-13-audio-stream-master-roadmap.md
git commit -m "docs: record stream.reach.radio client compatibility results" -- docs/superpowers/plans/2026-10-13-audio-stream-master-roadmap.md
```

## Self-Review

- Coverage: web (W1 CSP, W2 real page, CORS risk gated), Android (A1 code, A2 run incl. missing emulator), iOS (I1 hard assertion, I2 run), results (decision doc §4c, roadmap).
- Placeholders: none; `<date>`/`<device>` in recorded lines are filled at record time.
- Names consistent: `Config.AUDIO_STREAM_URL`, `StreamReachRadioTest.playsStreamFromConfigUrl`, branch `test/stream-reach-radio`, worktree `test/stream-override`.
- Out of scope, recorded in roadmap: Worker ACAO header (only if W2 demands it), Watch app hardcode (`reach.radio/api/audio-stream`), T3/T4 on a real device, Android release carrying the new URL.
