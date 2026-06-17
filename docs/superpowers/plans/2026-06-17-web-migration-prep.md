# Web Migration Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `reach-radio-nextjs` so it can serve as the iOS/Android webview host, and remove dead routes from `reach-radio-web`.

**Architecture:** The `native-config` API endpoint is updated to read `hostURL` from Sanity instead of hardcoding it. All bridge globals (`globalState`, `globalActions`, `up.*`) are already implemented and verified functional. Dead Astro routes (`/speakers`, `/hyperview`) are removed. The parity checklist is completed manually via the `dev.calvarytucson.com` Cloudflare tunnel.

**Tech Stack:** Next.js 15, TypeScript, Sanity, Astro (for dead route removal only)

## Global Constraints

- TypeScript strict mode — no `any` in public APIs
- `appSettingsQuery` GROQ field list is the only place to add new Sanity fields
- `APP_SETTINGS_ID = 'a2939b52-e844-45f4-ba97-c335991cea4b'` — do not change
- `FALLBACK_HOST_URL` must equal `'https://reach-radio-nextjs.vercel.app'`
- `Cache-Control: public, max-age=300` must remain on `native-config` response
- Never remove `webUrl` field from response without confirming old iOS/Android builds no longer in use (keep both `webUrl` and `hostURL` during transition)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/constants.ts` | Modify | Add `FALLBACK_HOST_URL` |
| `src/lib/sanity/queries.ts` | Modify | Add `hostURL` to `appSettingsQuery` |
| `src/app/api/native-config/route.ts` | Modify | Return `hostURL` from Sanity |
| `src/lib/bridge/compat.ts` | Verify only | `up.history.location` + `up.reload()` shims |
| `src/lib/bridge/proxy.ts` | Verify only | `globalState` + `globalActions` globals |
| `reach-radio-web/src/pages/speakers/` | Delete | Dead route |
| `reach-radio-web/src/pages/hyperview/` | Delete | Dead route |
| `reach-radio-web/src/pages/sitemap.xml.ts` | Modify | Remove deleted routes |

---

## Task 1: Add `hostURL` to `native-config` endpoint

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/sanity/queries.ts:94-96`
- Modify: `src/app/api/native-config/route.ts`

**Interfaces:**
- Produces: `GET /api/native-config` returns `{ protocolVersion, streamUrl, hostURL, webUrl, minAppVersion }` — `hostURL` sourced from Sanity `appSettings.hostURL`, fallback to `FALLBACK_HOST_URL`

- [ ] **Step 1: Add `FALLBACK_HOST_URL` to constants**

In `src/lib/constants.ts`, add after `FALLBACK_STREAM_URL`:

```typescript
export const FALLBACK_HOST_URL = 'https://reach-radio-nextjs.vercel.app'
```

- [ ] **Step 2: Add `hostURL` to `appSettingsQuery`**

In `src/lib/sanity/queries.ts`, find `appSettingsQuery` (line ~94). Change:

```typescript
export const appSettingsQuery = `
  *[_type == "appSettings" && _id == $id][0] { radioAudioURL }
`
```

To:

```typescript
export const appSettingsQuery = `
  *[_type == "appSettings" && _id == $id][0] { radioAudioURL, hostURL }
`
```

- [ ] **Step 3: Update `native-config` route**

Replace entire `src/app/api/native-config/route.ts` with:

```typescript
import { sanityFetch } from '@/lib/sanity/client'
import { appSettingsQuery, APP_SETTINGS_ID } from '@/lib/sanity/queries'
import { FALLBACK_STREAM_URL, FALLBACK_HOST_URL } from '@/lib/constants'

export async function GET(): Promise<Response> {
  const settings = await sanityFetch<{ radioAudioURL: string; hostURL: string }>(
    appSettingsQuery,
    { id: APP_SETTINGS_ID },
    { tags: ['appSettings'] }
  ).catch(() => null)

  return Response.json(
    {
      protocolVersion: 1,
      streamUrl: settings?.radioAudioURL ?? FALLBACK_STREAM_URL,
      hostURL: settings?.hostURL ?? FALLBACK_HOST_URL,
      webUrl: settings?.hostURL ?? FALLBACK_HOST_URL,
      minAppVersion: { ios: '1.0.0', android: '1.0.0' },
    },
    {
      headers: { 'Cache-Control': 'public, max-age=300' },
    }
  )
}
```

Note: `webUrl` kept as alias of `hostURL` so older app builds (which read `webUrl`) still work during transition.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Start dev server and test endpoint**

```bash
npm run dev
```

In a second terminal:

```bash
curl http://localhost:3000/api/native-config | jq .
```

Expected output shape:
```json
{
  "protocolVersion": 1,
  "streamUrl": "https://...",
  "hostURL": "https://...",
  "webUrl": "https://...",
  "minAppVersion": { "ios": "1.0.0", "android": "1.0.0" }
}
```

`hostURL` must not be `"https://reach-radio-web.pages.dev"` — if it is, `appSettings.hostURL` in Sanity is still stale (update it in Sanity Studio to `https://reach-radio-nextjs.vercel.app`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants.ts src/lib/sanity/queries.ts src/app/api/native-config/route.ts
git commit -m "feat(api): return hostURL from Sanity in native-config endpoint"
```

---

## Task 2: Verify bridge protocol globals

No code changes expected. This task confirms all globals iOS/Android call are present in Next.js.

**Files:**
- Verify: `src/lib/bridge/compat.ts`
- Verify: `src/lib/bridge/proxy.ts`
- Verify: `src/components/bridge/BridgeInit.tsx`

- [ ] **Step 1: Confirm shim file exports expected functions**

Open `src/lib/bridge/compat.ts`. Verify:
- `initUnpolyShim()` sets `window.up.history.location` (getter returning `window.location.pathname`)
- `initUnpolyShim()` sets `window.up.reload` (calls `window.location.reload()`)

- [ ] **Step 2: Confirm proxy file exports expected functions**

Open `src/lib/bridge/proxy.ts`. Verify:
- `window.globalState.mediaBarState.isPlaying.set(v)` calls `useMediaStore.getState().setIsPlaying(v)`
- `window.globalState.mediaBarState.isBuffering.set(v)` calls `useMediaStore.getState().setIsBuffering(v)`
- `window.globalActions.goToPage(path)` calls `router.push(path)`

- [ ] **Step 3: Confirm BridgeInit is mounted in root layout**

Open `src/app/layout.tsx`. Confirm `<BridgeInit />` is rendered inside the layout body. If absent, add it.

- [ ] **Step 4: Manual bridge test via browser console**

With dev server running, open `http://localhost:3000` in Chrome. Open DevTools console. Run each line and confirm no errors:

```javascript
// Should return current pathname (e.g. "/")
up.history.location

// Should reload the page
// up.reload()

// Should set isPlaying in media store (check React DevTools or network)
window.globalState.mediaBarState.isPlaying.set(true)
window.globalState.mediaBarState.isPlaying.set(false)

// Should navigate to /about
window.globalActions.goToPage('/about')

// Navigate back
window.globalActions.goToPage('/')
```

- [ ] **Step 5: Confirm native app detection**

In browser console on `http://localhost:3000`:

```javascript
// Simulate iOS bridge
window.webkit = { messageHandlers: { messageHandler: { postMessage: () => {} } } }

// Reload page — BridgeInit should detect bridge and set mobile-app cookie
// Check Application → Cookies in DevTools: mobile-app=true should appear
```

- [ ] **Step 6: No commit needed** — verification only. Note any failures and create fix tasks before proceeding to Task 3.

---

## Task 3: Parity verification — pages and mobile UX

**Prerequisites:** Cloudflare tunnel `dev.calvarytucson.com` must be running, pointed at `localhost:3000`. iOS Simulator must be available.

This task verifies each page works correctly in Next.js when loaded inside the iOS WebView via the tunnel URL.

- [ ] **Step 1: Configure tunnel**

Ensure `dev.calvarytucson.com` Cloudflare tunnel points to `http://localhost:3000`. Start Next.js dev server:

```bash
npm run dev
```

- [ ] **Step 2: Verify home page (`/`)**

Load `https://dev.calvarytucson.com/` in iOS Simulator Safari and in the Reach Radio iOS app (temporarily set webview URL to tunnel).

Check:
- [ ] RadioPlayer renders with album art
- [ ] Play/Pause button works
- [ ] SleepTimerButton (clock icon) opens SleepTimerSheet bottom drawer
- [ ] TodaySchedule renders today's schedule slots
- [ ] Media bar appears when scrolling past RadioPlayer
- [ ] Media bar disappears when RadioPlayer is visible

- [ ] **Step 3: Verify `/about` page**

- [ ] Content renders
- [ ] Contact form submits (check network tab — should POST to server action)
- [ ] Spam protection active (submit empty form — should be rejected)

- [ ] **Step 4: Verify `/donate` page**

- [ ] Ministry donation iframe renders inside the page frame
- [ ] No console errors
- [ ] No layout overflow on 375px width

- [ ] **Step 5: Verify `/teachers` page**

- [ ] Teacher grid renders with photos
- [ ] Search bar opens search modal when tapped
- [ ] Teachers tab → Schedule tab switch works (tabs visible, content switches)
- [ ] Teacher card tap opens teacher panel/modal
- [ ] Teacher detail page (`/teachers/[slug]`) loads correctly via panel navigation

- [ ] **Step 6: Verify `/scheduled-list` page**

- [ ] Full week schedule renders grouped by day
- [ ] Each slot links to correct `/teachers/[slug]`
- [ ] Breadcrumb renders and navigates home

- [ ] **Step 7: Verify mobile-specific UX in iOS Simulator**

Load app in iOS Simulator with webview pointed at tunnel:
- [ ] Pull-to-refresh triggers `up.reload()` shim (page reloads)
- [ ] Native bottom nav "Listen" → loads `/`, "About" → loads `/about`, "Donate" → loads `/donate`, "Teachers" → loads `/teachers`
- [ ] Tapping a form field hides native nav bar and media bar (check `showMobileNav: false` postMessage)
- [ ] Blurring form field restores native nav bar

- [ ] **Step 8: Log any failures**

Create a `docs/parity-gaps.md` file listing any failures with description. If no failures, note "All checks passed."

- [ ] **Step 9: No commit for verification** — commit `docs/parity-gaps.md` if gaps found

```bash
git add docs/parity-gaps.md
git commit -m "docs: parity verification results"
```

---

## Task 4: Fix parity gaps (if any found in Task 3)

**Files:** Varies by gap found.

This task is conditional — only execute if Task 3 found failures. For each failure in `docs/parity-gaps.md`:

- [ ] **Step 1: Fix the gap** — implement the minimum code change that fixes the specific failure. Do not refactor unrelated code.

- [ ] **Step 2: Re-run the specific check** from Task 3 that failed. Confirm it now passes.

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit each fix separately**

```bash
git add <changed files>
git commit -m "fix(<scope>): <description of what was broken>"
```

Use commit scopes from `AGENTS.md`: `bridge`, `teachers`, `schedule`, `player`, `sleep-timer`, `donate`, `about`, `layout`, `api`.

---

## Task 5: Remove dead routes from `reach-radio-web`

**Working directory for this task:** `/Users/danielmccauley/Documents/Development/reach-radio-web`

**Files:**
- Delete: `src/pages/speakers/` (entire directory)
- Delete: `src/pages/hyperview/` (entire directory)
- Modify: `src/pages/sitemap.xml.ts` — remove any references to `/speakers` or `/hyperview`

- [ ] **Step 1: Confirm nothing links to `/speakers`**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-web
grep -r "speakers" src --include="*.astro" --include="*.ts" --include="*.js" | grep -v "src/pages/speakers" | grep -v "sitemap"
```

Expected: zero matches (or only comments). If any navigation link found, investigate before deleting.

- [ ] **Step 2: Confirm nothing links to `/hyperview`**

```bash
grep -r "hyperview" src --include="*.astro" --include="*.ts" --include="*.js" | grep -v "src/pages/hyperview" | grep -v "sitemap"
```

Expected: zero matches.

- [ ] **Step 3: Delete `/speakers` directory**

```bash
rm -rf src/pages/speakers
```

- [ ] **Step 4: Delete `/hyperview` directory**

```bash
rm -rf src/pages/hyperview
```

- [ ] **Step 5: Remove from sitemap**

Open `src/pages/sitemap.xml.ts`. Remove any entries referencing `/speakers` or `/hyperview`.

- [ ] **Step 6: Build to confirm no broken imports**

```bash
npm run build
```

Expected: build succeeds with no errors about missing files.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove dead /speakers and /hyperview routes"
```

---

## Task 6: Update Sanity `appSettings.hostURL` for migration

This task is a Sanity Studio content update, not a code change.

- [ ] **Step 1: Open Sanity Studio** for the Reach Radio project (project ID `bk05c6rl`)

- [ ] **Step 2: Find `appSettings` document** — ID `a2939b52-e844-45f4-ba97-c335991cea4b`

- [ ] **Step 3: Set `hostURL`**

For staging: set to `https://reach-radio-nextjs.vercel.app`
For local tunnel testing: set to `https://dev.calvarytucson.com`

- [ ] **Step 4: Publish the document**

- [ ] **Step 5: Verify via curl**

```bash
curl https://reach.radio/api/native-config | jq '.hostURL'
```

Expected: `"https://reach-radio-nextjs.vercel.app"` (or whichever value you set)

Note: `reach.radio` must already point to the Next.js Vercel deployment for this to work. If DNS is not yet pointed, test against the Vercel preview URL directly:

```bash
curl https://reach-radio-nextjs.vercel.app/api/native-config | jq '.hostURL'
```
