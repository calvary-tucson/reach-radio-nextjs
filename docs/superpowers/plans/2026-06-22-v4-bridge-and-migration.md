# v4 Bridge + Domain Migration Plan

Covers: web-side bridge changes, v4 native bridge contract, domain migration sequence.

---

## Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ | Done |
| 🔲 | Not started |
| ⚠️ | Blocker / risk |

---

## Architecture Snapshot

| | v3 (App Store) | v4 (in dev) |
|---|---|---|
| WebView URL | hardcoded `reach-radio-web.pages.dev` | fetched from `/api/native-config` |
| Audio stream | hardcoded `reach.radio/api/audio-stream` | fetched from `/api/native-config` |
| Bridge | Unpoly shim (Astro site) | `window.nativeBridge.*` (agnostic) |
| Config fetch | none | reach.radio → reachradiotucson.com → vercel.app |

---

## v3 compatibility

v3 WebView hardcodes `reach-radio-web.pages.dev` — the Astro/Cloudflare site.
v3 **never loads Next.js**. Domain migration doesn't affect v3's WebView at all.

The only thing Next.js provides for v3: `/api/audio-stream` (v3 audio hardcodes `reach.radio/api/audio-stream`). That endpoint already exists. ✅

**The Unpoly shim (`compat.ts`) and globalActions proxy (`proxy.ts`) in Next.js are dead code.**
v3 never loads Next.js so those shims never run for v3 users. They will be deleted.

**Constraint:** Keep Astro (`reach-radio-web.pages.dev`) alive until v3 install base is negligible.

---

## Web-side tasks

### Endpoints — already done

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/native-config` | ✅ | Returns `{ protocolVersion, streamUrl, hostURL, webUrl, minAppVersion }` |
| `GET /api/audio-stream` | ✅ | Proxies Radiojar stream |

**Env var fix needed:** Set `NEXT_PUBLIC_SITE_URL=https://reach.radio` in Vercel before domain migration. Currently falls back to `reach-radio-nextjs.vercel.app`, so `webUrl` in native-config returns wrong URL after DNS switch.

### Bridge changes

| Task | File | Status |
|---|---|---|
| T1: Delete `compat.ts` (Unpoly shim — dead code) | `src/lib/bridge/compat.ts` | ✅ |
| T2: Delete `proxy.ts` (globalActions — dead code) | `src/lib/bridge/proxy.ts` | ✅ |
| T3: Remove `initUnpolyShim` + `initBridgeProxy` imports/calls from BridgeInit | `src/components/bridge/BridgeInit.tsx` | ✅ |
| T4: Add `window.nativeBridge` TypeScript types | `src/lib/bridge/post-message.ts` | ✅ |
| T5: Add `window.nativeBridge` direct assign in BridgeInit | `src/components/bridge/BridgeInit.tsx` | ✅ |
| T6: Send `showMobileNav: true` on every route change | `src/components/bridge/BridgeInit.tsx` | ✅ |
| T7: Add `isBuffering` to MediaBar postMessage effect | `src/components/media-bar/MediaBar.tsx` | ✅ |

---

### T1–T3: Delete shims, clean BridgeInit

Delete `src/lib/bridge/compat.ts` and `src/lib/bridge/proxy.ts` entirely.

Remove from `BridgeInit.tsx`:
```ts
// DELETE these imports
import { initBridgeProxy } from '@/lib/bridge/proxy'
import { initUnpolyShim } from '@/lib/bridge/compat'

// DELETE these calls inside the one-time useEffect
initUnpolyShim(router)
initBridgeProxy(router)
```

Also remove the global `Window` type declarations that were in those files — they'll be stale.

---

### T4–T5: window.nativeBridge

v4 iOS waits for `{ loaded: true }` postMessage before calling any bridge methods.
Web defines the object directly — no stub injection, no queue, no `register()`.

**Types** — add to `src/lib/bridge/post-message.ts`:
```ts
declare global {
  interface Window {
    nativeBridge?: {
      navigate: (path: string) => void
      refresh: () => void
      getLocation: () => string
      setPlayState: (playing: boolean) => void
      setBuffering: (buffering: boolean) => void
    }
  }
}
```

**Assign** — in BridgeInit one-time useEffect (after shim calls are removed):
```ts
useEffect(() => {
  window.nativeBridge = {
    navigate: (path: string) => router.push(path),
    refresh: () => router.refresh(),
    getLocation: () => pathname,
    setPlayState: (playing: boolean) => useMediaStore.getState().setIsPlaying(playing),
    setBuffering: (buffering: boolean) => useMediaStore.getState().setIsBuffering(buffering),
  }

  const handleOnline = () => postMessageToNative({ offline: false })
  const handleOffline = () => postMessageToNative({ offline: true })
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}, [router, pathname])
```

`pathname` from `usePathname()` — already in BridgeInit.
`useMediaStore.getState()` — zustand getState() is safe outside React.

Note: `nativeBridge.getLocation()` returns current `pathname`. Since this closes over `pathname`
from the useEffect dep, it stays current — effect re-runs on route change.

---

### T6: showMobileNav on route change

In BridgeInit route change effect:
```ts
useEffect(() => {
  postMessageToNative({ location: pathname })
  postMessageToNative({ showMediaBar: pathname !== '/' })
  postMessageToNative({ showMobileNav: true })  // ← add
}, [pathname])
```

Restores native nav bar after navigation (keyboard hide on prev page would have hidden it).

---

### T7: isBuffering in MediaBar

`MediaBar.tsx` sends `{ isPlaying, title, artist, image }` but not `isBuffering`.
In native mode, `AudioProvider` is not rendered — `isBuffering` state comes from
iOS calling `window.nativeBridge.setBuffering()`.

Add to MediaBar:
```ts
const isBuffering = useMediaStore((s) => s.isBuffering)
// in useEffect:
postMessageToNative({ isPlaying, isBuffering, title, artist, image })
// deps: [isPlaying, isBuffering, title, artist, image]
```

---

## Migration sequence

```
Fix iOS dev tunnel → Web bridge changes → Set SITE_URL env var →
Deploy Next.js → Migrate domains → Ship v4 to App Store → (eventually) Retire Astro
```

| Step | Action | Blocker? |
|---|---|---|
| 1 | Fix iOS v4 dev tunnel → real fallback URL | ⚠️ Blocks App Store submission |
| 2 | Implement Tasks T1–T7 above | Must be live before v4 ships |
| 3 | Set `NEXT_PUBLIC_SITE_URL=https://reach.radio` in Vercel env | Before domain migration |
| 4 | Deploy Next.js to Vercel production | |
| 5 | Migrate `reach.radio` DNS to Vercel | v3 audio stream survives (endpoint exists) |
| 6 | Migrate `reachradiotucson.com` DNS to Vercel | Fixes second fallback in v4 config chain |
| 7 | Ship v4 to App Store | |
| 8 | Monitor v3 installs → retire Astro when negligible | |

---

## Risks

| Risk | Severity | Fix |
|---|---|---|
| Dev tunnel as v4 absolute fallback | ⚠️ Critical | Replace with `https://reach.radio` before App Store submission |
| `NEXT_PUBLIC_SITE_URL` not set → `webUrl` returns vercel.app | Medium | Set in Vercel env before Step 5 |
| `reachradiotucson.com` still on Astro after reach.radio migrates | Low | Second fallback 404s → falls through to vercel.app. Acceptable until Step 6. |
| Config cached 5 min after URL switch | Low | Max 5 min stale window during migration |

---

## postMessage field audit

| Field | Type | Sender | Status |
|---|---|---|---|
| `protocolVersion` | `1` | `post-message.ts` (always prepended) | ✅ |
| `loaded` | bool | `BridgeInit` on mount | ✅ |
| `streamUrl` | string | `BridgeInit` on mount | ✅ |
| `location` | string | `BridgeInit` on route change | ✅ |
| `showMediaBar` | bool | `BridgeInit` on route change + keyboard focus | ✅ |
| `showMobileNav` | bool | `BridgeInit` on route change (T6) | ✅ |
| `isPlaying` | bool | `MediaBar` on state change | ✅ |
| `isBuffering` | bool | `MediaBar` on state change (T7) | ✅ |
| `title` | string | `MediaBar` on state change | ✅ |
| `artist` | string | `MediaBar` on state change | ✅ |
| `image` | string | `MediaBar` on state change | ✅ |
| `offline` | bool | `BridgeInit` online/offline events | ✅ |
