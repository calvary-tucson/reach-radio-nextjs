# Process Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bake the 7 process improvements from git-history analysis into the codebase and tooling so future sessions don't repeat the same failure patterns.

**Architecture:** Four independent areas: AGENTS.md rules, missing unit tests for stateful components, process templates for UI contracts and experimental features, and global CLAUDE.md process rules. Each task is self-contained; any order works.

**Tech Stack:** Vitest + @testing-library/react (jsdom), Markdown templates, AGENTS.md, CLAUDE.md

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `AGENTS.md` | Modify | Add a11y checklist + canonical scope name table |
| `tests/unit/audio-provider.test.tsx` | Create | AudioProvider play/pause/volume/mute sync tests |
| `tests/unit/sleep-timer-provider.test.tsx` | Create | SleepTimerProvider countdown, stop-at-zero, cleanup |
| `tests/unit/media-store-toggle-mute.test.ts` | Create | toggleMute / setMuted edge cases not in existing test |
| `.claude/templates/ui-contract.md` | Create | Template agents fill out before any UI implementation |
| `.claude/templates/experimental-feature.md` | Create | Checklist for enabling Next.js experimental flags |
| `~/.claude/CLAUDE.md` | Modify | Add subagent file-scope rule + verify-before-commit rule |

---

### Task 1: AGENTS.md — a11y checklist + canonical scopes

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Open current AGENTS.md**

Current content ends after `cursor-not-allowed` line. Append two new sections.

- [ ] **Step 2: Add a11y checklist section**

In `AGENTS.md`, after the existing UI Rules section, add:

```markdown
## A11y Rules (apply per component, not as a retrofit)

Every interactive component you write must satisfy all of these before committing:

- **Role:** `<div>` acting as button → `role="button"` and `tabIndex={0}`. Native `<button>` preferred.
- **Label:** Every icon-only button needs `aria-label`. Every form input needs `<label>` or `aria-label`.
- **Touch target:** Min `h-11 w-11` (44px) on mobile interactive elements.
- **Contrast:** Text must be `text-white/90` minimum on dark surfaces, `text-foreground` on light. Never `text-white/50` for readable content.
- **Focus visible:** Interactive elements need `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`.
- **Cursor:** `cursor-pointer` on all clickables. `cursor-not-allowed` on disabled.
- **Motion:** Wrap animations in `motion-safe:` variant. Never animate without this guard.

These are build-time rules, not review-time suggestions. If a full-review catches an a11y issue that's in this list, that's a process failure.
```

- [ ] **Step 3: Add canonical scope names section**

```markdown
## Canonical Commit Scopes

Use these exact scope names in conventional commits. PascalCase scopes are wrong. Undocumented scopes create noise in the git log.

| Scope | Covers |
|-------|--------|
| `bridge` | Native WebView bridge, BridgeInit, post-message, middleware cookie |
| `seo` | Metadata, JSON-LD schemas, sitemap, OG images, robots.txt |
| `teachers` | All teacher list/detail/search/modal components and routes |
| `schedule` | Schedule pages, cards, slots, week view |
| `theme` | ThemeProvider, ThemeToggle, light/dark variants |
| `modal` | ModalLayout, SheetChrome, TeacherPanelChrome, ModalContext |
| `player` | RadioPlayer, AudioProvider, MediaBar, volume, sleep timer UI |
| `sleep-timer` | SleepTimerProvider, SleepTimerSheet, timer store actions |
| `donate` | Donate page and iframe |
| `about` | About page, contact form, privacy policy |
| `layout` | Header, Footer, MobileNav, root layout |
| `api` | All `/app/api/*` routes |
| `global` | Shared primitives: BottomSheet, PassiveSearchBar, Breadcrumbs |
| `ppr` | PPR/cacheComponents/useCache configuration |
| `test` | Test files only — use when no source file is changed |

**A11y fixes belong to the component scope being fixed**, not a separate `a11y` scope.
Example: `fix(teachers): improve contrast on TeacherCard` not `fix(a11y): teachers contrast`.
```

- [ ] **Step 4: Run the project linter to confirm AGENTS.md didn't break anything**

```bash
npm run lint 2>&1 | tail -5
```

Expected: no errors (AGENTS.md isn't linted).

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): add a11y checklist and canonical commit scope table"
```

---

### Task 2: AudioProvider unit tests

**Files:**
- Create: `tests/unit/audio-provider.test.tsx`
- Reference: `src/components/AudioProvider.tsx`

The AudioProvider renders a hidden `<audio>` element and syncs three store slices to it: `isPlaying` → `play()`/`pause()`, `volume` → `audio.volume`, `isMuted` → `audio.muted`. It also fires store actions on audio element events.

- [ ] **Step 1: Create the test file**

`tests/unit/audio-provider.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { AudioProvider } from '@/components/AudioProvider'
import { useMediaStore } from '@/lib/store/media-store'

// jsdom does not implement HTMLMediaElement.play/pause — stub them
function stubAudioElement() {
  const play = vi.fn().mockResolvedValue(undefined)
  const pause = vi.fn()
  Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: play,
  })
  Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: pause,
  })
  return { play, pause }
}

describe('AudioProvider', () => {
  let play: ReturnType<typeof vi.fn>
  let pause: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset store to known defaults before each test
    useMediaStore.setState({
      isPlaying: false,
      isBuffering: false,
      isMuted: false,
      volume: 100,
      previousVolume: 100,
    })
    ;({ play, pause } = stubAudioElement())
    // Silence useNowPlaying's EventSource — not under test here
    vi.stubGlobal('EventSource', vi.fn(() => ({ onmessage: null, onerror: null, close: vi.fn() })))
  })

  it('renders a hidden audio element with the given streamUrl', () => {
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio')
    expect(audio).not.toBeNull()
    expect(audio!.src).toBe('https://stream.example.com/radio')
  })

  it('calls play() when isPlaying becomes true', async () => {
    render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    await act(async () => {
      useMediaStore.getState().setIsPlaying(true)
    })
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('calls pause() when isPlaying becomes false after being true', async () => {
    useMediaStore.setState({ isPlaying: true })
    render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    await act(async () => {
      useMediaStore.getState().setIsPlaying(false)
    })
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it('sets isPlaying false when play() rejects (e.g. NotAllowedError)', async () => {
    play.mockRejectedValue(new Error('NotAllowedError'))
    render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    await act(async () => {
      useMediaStore.getState().setIsPlaying(true)
    })
    await vi.waitFor(() => {
      expect(useMediaStore.getState().isPlaying).toBe(false)
    })
  })

  it('syncs volume prop: setVolume(50) → audio.volume = 0.5', () => {
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    act(() => {
      useMediaStore.getState().setVolume(50)
    })
    expect(audio.volume).toBeCloseTo(0.5)
  })

  it('syncs muted prop: setMuted(true) → audio.muted = true', () => {
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    act(() => {
      useMediaStore.getState().setMuted(true)
    })
    expect(audio.muted).toBe(true)
  })

  it('onLoadStart fires setIsBuffering(true)', () => {
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    act(() => {
      audio.dispatchEvent(new Event('loadstart'))
    })
    expect(useMediaStore.getState().isBuffering).toBe(true)
  })

  it('onPlaying fires setIsBuffering(false)', () => {
    useMediaStore.setState({ isBuffering: true })
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    act(() => {
      audio.dispatchEvent(new Event('playing'))
    })
    expect(useMediaStore.getState().isBuffering).toBe(false)
  })

  it('onError stops playback and clears buffering', () => {
    useMediaStore.setState({ isPlaying: true, isBuffering: true })
    const { container } = render(<AudioProvider streamUrl="https://stream.example.com/radio" />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    act(() => {
      audio.dispatchEvent(new Event('error'))
    })
    expect(useMediaStore.getState().isPlaying).toBe(false)
    expect(useMediaStore.getState().isBuffering).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/audio-provider.test.tsx
```

Expected: all 9 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/audio-provider.test.tsx
git commit -m "test(player): add AudioProvider unit tests — play/pause/volume/mute/events"
```

---

### Task 3: SleepTimerProvider unit tests

**Files:**
- Create: `tests/unit/sleep-timer-provider.test.tsx`
- Reference: `src/components/SleepTimerProvider.tsx`

SleepTimerProvider is a renderless `'use client'` component. It reads `sleepTimerActive` from the store, sets a 1s interval when active, decrements `remainingSleepSeconds` each tick, and calls `setIsPlaying(false)` + `setSleepTimerActive(false)` at 0.

- [ ] **Step 1: Create the test file**

`tests/unit/sleep-timer-provider.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { SleepTimerProvider } from '@/components/SleepTimerProvider'
import { useMediaStore } from '@/lib/store/media-store'

describe('SleepTimerProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useMediaStore.setState({
      isPlaying: true,
      sleepTimerActive: false,
      remainingSleepSeconds: 0,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders null — no DOM output', () => {
    const { container } = render(<SleepTimerProvider />)
    expect(container.firstChild).toBeNull()
  })

  it('does not start interval when timer is inactive', () => {
    const spy = vi.spyOn(globalThis, 'setInterval')
    render(<SleepTimerProvider />)
    expect(spy).not.toHaveBeenCalled()
  })

  it('decrements remainingSleepSeconds by 1 each second when active', () => {
    useMediaStore.getState().startSleepTimer(30)
    render(<SleepTimerProvider />)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(28)
  })

  it('stops playback and deactivates timer when countdown reaches 0', () => {
    useMediaStore.getState().startSleepTimer(2)
    render(<SleepTimerProvider />)

    act(() => { vi.advanceTimersByTime(2000) })

    expect(useMediaStore.getState().isPlaying).toBe(false)
    expect(useMediaStore.getState().sleepTimerActive).toBe(false)
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(0)
  })

  it('clears interval when sleepTimerActive goes false mid-countdown', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    useMediaStore.getState().startSleepTimer(30)
    render(<SleepTimerProvider />)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)

    act(() => { useMediaStore.getState().setSleepTimerActive(false) })

    expect(clearIntervalSpy).toHaveBeenCalled()

    // No further decrements after deactivation
    act(() => { vi.advanceTimersByTime(5000) })
    expect(useMediaStore.getState().remainingSleepSeconds).toBe(29)
  })

  it('clears interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    useMediaStore.getState().startSleepTimer(60)
    const { unmount } = render(<SleepTimerProvider />)
    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/sleep-timer-provider.test.tsx
```

Expected: all 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/sleep-timer-provider.test.tsx
git commit -m "test(sleep-timer): add SleepTimerProvider unit tests — countdown, stop, cleanup"
```

---

### Task 4: media-store toggleMute edge cases

**Files:**
- Create: `tests/unit/media-store-toggle-mute.test.ts`
- Reference: `src/lib/store/media-store.ts`
- Reference (existing): `tests/unit/media-store.test.ts` — do NOT modify it; add a separate file for new cases

The existing `media-store.test.ts` covers basic setters but misses `toggleMute` (mute/unmute cycle with previousVolume preservation) and `setMuted` idempotency.

- [ ] **Step 1: Create the test file**

`tests/unit/media-store-toggle-mute.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useMediaStore } from '@/lib/store/media-store'

describe('useMediaStore — toggleMute and setMuted', () => {
  beforeEach(() => {
    useMediaStore.setState({
      isPlaying: false,
      isBuffering: false,
      isMuted: false,
      volume: 80,
      previousVolume: 80,
    })
  })

  describe('toggleMute', () => {
    it('mutes: sets isMuted true, volume to 0, saves previousVolume', () => {
      useMediaStore.getState().toggleMute()
      const { isMuted, volume, previousVolume } = useMediaStore.getState()
      expect(isMuted).toBe(true)
      expect(volume).toBe(0)
      expect(previousVolume).toBe(80)
    })

    it('unmutes: restores previousVolume when toggled back', () => {
      useMediaStore.getState().toggleMute() // mute
      useMediaStore.getState().toggleMute() // unmute
      const { isMuted, volume } = useMediaStore.getState()
      expect(isMuted).toBe(false)
      expect(volume).toBe(80)
    })

    it('unmute with previousVolume 0 restores to 100 (guard against silent restore)', () => {
      useMediaStore.setState({ isMuted: true, volume: 0, previousVolume: 0 })
      useMediaStore.getState().toggleMute()
      expect(useMediaStore.getState().volume).toBe(100)
    })
  })

  describe('setMuted', () => {
    it('setMuted(true) from unmuted state mutes and saves volume', () => {
      useMediaStore.getState().setMuted(true)
      const { isMuted, volume, previousVolume } = useMediaStore.getState()
      expect(isMuted).toBe(true)
      expect(volume).toBe(0)
      expect(previousVolume).toBe(80)
    })

    it('setMuted(true) when already muted is idempotent — does not double-save previousVolume', () => {
      useMediaStore.setState({ isMuted: true, volume: 0, previousVolume: 80 })
      useMediaStore.getState().setMuted(true) // call again while already muted
      expect(useMediaStore.getState().previousVolume).toBe(80) // not 0
    })

    it('setMuted(false) from muted state restores previousVolume', () => {
      useMediaStore.setState({ isMuted: true, volume: 0, previousVolume: 60 })
      useMediaStore.getState().setMuted(false)
      expect(useMediaStore.getState().isMuted).toBe(false)
      expect(useMediaStore.getState().volume).toBe(60)
    })

    it('setMuted(false) when already unmuted is idempotent', () => {
      useMediaStore.getState().setMuted(false) // already unmuted
      expect(useMediaStore.getState().isMuted).toBe(false)
      expect(useMediaStore.getState().volume).toBe(80)
    })
  })

  describe('setVolume', () => {
    it('setVolume(0) sets isMuted true implicitly', () => {
      useMediaStore.getState().setVolume(0)
      expect(useMediaStore.getState().isMuted).toBe(true)
    })

    it('setVolume(50) sets isMuted false when was muted', () => {
      useMediaStore.setState({ isMuted: true })
      useMediaStore.getState().setVolume(50)
      expect(useMediaStore.getState().isMuted).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/media-store-toggle-mute.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 3: Run the full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/media-store-toggle-mute.test.ts
git commit -m "test(player): add toggleMute, setMuted, and setVolume edge case tests"
```

---

### Task 5: Process templates

**Files:**
- Create: `.claude/templates/ui-contract.md`
- Create: `.claude/templates/experimental-feature.md`

These templates are filled out by the agent (or you) before starting a multi-agent session on a new UI feature or enabling an experimental Next.js flag. They prevent the pattern of settling architecture mid-implementation.

- [ ] **Step 1: Create the .claude/templates directory if absent**

```bash
mkdir -p .claude/templates
```

- [ ] **Step 2: Create the UI contract template**

`.claude/templates/ui-contract.md`:

```markdown
# UI Contract: [Feature Name]

> Fill this out and get agreement BEFORE dispatching any implementation agents.
> This doc is the source of truth. Agents read it. Don't implement until it's complete.

## Component Hierarchy

```
[FeaturePage] (server)
  └─ [FeatureShell] (server — static shell for PPR)
       └─ [FeatureContent] (server — fetches data, wrapped in Suspense)
            └─ [FeatureClient] (client — if event handlers needed)
```

## State Ownership

| State | Lives in | Why |
|-------|----------|-----|
| e.g. selected tab | URL param | shareable, no JS needed |
| e.g. sheet open | Zustand modal store | cross-component, client-only |

## Mobile Layout (< md)

[Describe or ASCII-sketch the mobile layout]

## Desktop Layout (≥ md)

[Describe or ASCII-sketch the desktop layout]

## Routes Involved

| Route | Type | Notes |
|-------|------|-------|
| `/feature` | page | - |
| `/@modal/(...)feature` | intercepting route | opens as sheet |

## Data Sources

| Data | Sanity query | Cache strategy |
|------|-------------|----------------|
| e.g. teacher list | `teachersListQuery` | `use cache`, tag: `teachers` |

## Scope Name for Commits

`scope-name` (from AGENTS.md canonical scope table)

## Open Questions (resolve before implementing)

- [ ] Question 1
- [ ] Question 2

---

**Sign-off:** Do not begin implementation until all open questions are resolved and this doc is committed.
```

- [ ] **Step 3: Create the experimental feature checklist**

`.claude/templates/experimental-feature.md`:

```markdown
# Experimental Feature Checklist: [Flag Name]

> Complete this before enabling any `experimental.*` flag in `next.config.ts`.
> Experimental flags in Next.js 16 can break dynamic routes, middleware, and streaming.
> This checklist enforces a structured enable → test → benchmark → merge flow.

## Pre-flight

- [ ] Read the relevant Next.js 16 guide: `node_modules/next/dist/docs/[topic].md`
- [ ] Identify every route that will be affected (list them below)
- [ ] Confirm a rollback commit is ready (see Rollback section)
- [ ] Create a feature branch or worktree — do NOT enable directly on main

## Affected Routes

List every page, layout, API route, and middleware that may behave differently:

- `src/app/...`
- `src/app/api/...`

## Incompatibility Risk

| Risk | Mitigation |
|------|-----------|
| Dynamic routes with `force-dynamic` | Check each route — may need Suspense wrap |
| Middleware | Test cookie setting and redirects explicitly |
| Streaming / SSE | Verify SSE route still streams, not buffered |
| `revalidate` exports | Remove — incompatible with `use cache` |

## Rollback Commit

Before enabling, stage this rollback but do NOT commit it yet:

```bash
# In a separate terminal — keep this ready
git diff HEAD -- next.config.ts  # should show only the flag removal
```

## Benchmark (run before and after)

```bash
# Build and measure
npm run build 2>&1 | grep -E "(Route|Size|First Load)"
```

Paste before/after build output here.

## Test Checklist (run after enabling)

- [ ] `npx vitest run` — all unit tests pass
- [ ] `npx playwright test` — all E2E tests pass
- [ ] Home page loads and audio streams
- [ ] Teachers page loads with correct data
- [ ] Teacher detail modal opens
- [ ] SSE now-playing updates arrive (watch Network tab)
- [ ] Native bridge: `mobile-app` cookie sets on first load
- [ ] Sanity revalidate webhook fires correctly

## Merge Criteria

All checklist items above must be checked. If any fail: revert to the rollback commit, document what broke in this file, and open a new plan to address the incompatibility before re-enabling.
```

- [ ] **Step 4: Commit templates**

```bash
git add .claude/templates/
git commit -m "docs: add ui-contract and experimental-feature process templates"
```

---

### Task 6: Global CLAUDE.md — process rules

**Files:**
- Modify: `~/.claude/CLAUDE.md` (user-level global config)

Add two rules that address the "fix after feat same day" and "runaway subagent" patterns identified in the git analysis.

- [ ] **Step 1: Read the current global CLAUDE.md**

Read `~/.claude/CLAUDE.md` to find the correct insertion point (after "Do NOT" section or as a new "Process Guardrails" section).

- [ ] **Step 2: Add the Verify Before Claiming Done rule**

In the `## Workflow Preferences` section, add after the existing bullet points:

```markdown
- **Verify before claiming done.** After implementing any UI feature, open the browser and test the golden path before committing. Use `/verify` skill. A `fix:` commit in the same session as a `feat:` commit is a signal that the feature wasn't tested before closing. Aim for zero same-session fix commits.
```

- [ ] **Step 3: Add the Subagent File-Scope rule**

In the `## Subagent & Agent Preferences` section, add:

```markdown
- **Scope subagents to file lists, not feature descriptions.** When dispatching parallel implementation agents, give each agent an explicit list of files it is allowed to modify. If an agent needs to touch a file outside its list, it must stop and report back instead of making the change. This prevents runaway agents from reverting or overwriting work from sibling agents.
```

- [ ] **Step 4: Verify the edit is clean**

Read back the modified sections of `~/.claude/CLAUDE.md` to confirm no formatting was broken.

- [ ] **Step 5: Save memory about these rules**

These rules are now codified in CLAUDE.md, so no separate memory entry is needed. The CLAUDE.md is the authoritative source.

---

## Execution Order

Tasks 1–4 are fully independent — can run in parallel. Task 5 and 6 are also independent of 1–4. Suggested grouping for subagent dispatch:

- **Group A (parallel):** Tasks 1, 2, 3, 4
- **Group B (after A):** Task 5, 6

Run `npx vitest run` after Group A to confirm all tests pass before Group B.
