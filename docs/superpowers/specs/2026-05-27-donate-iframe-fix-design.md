# Donate Page iframe Fix — Design Spec

**Date:** 2026-05-27  
**Scope:** Fix iFrameResizer and postMessage protocol on the donate page across both the Astro (reach-radio-web) and Next.js (reach-radio-nextjs) codebases.

---

## Problem Summary

The donation iframe (easyTithe/MinistryForms) depends on two browser-side protocols that are currently broken:

### 1. iFrameResizer broken on production (Astro)
The easyTithe custom injection loads the iFrameResizer companion script with the wrong path:
- **Injection uses:** `https://reach.radio/assets/js/iFrameResizer.contentWindow.min.js`
- **File actually lives at:** `https://reach.radio/js/iFrameResizer.contentWindow.min.js`

The 404 returns HTML, Chrome's ORB (Opaque Response Blocking) blocks it as a script, the companion script never executes, and iFrameResizer never resizes the iframe. The iframe stays at its hardcoded `min-height: 1300px` with ~480px of dead whitespace.

Confirmed via browser inspection:
- `iframe.style.height` is always `""` (never set by iFrameResizer)
- `data-iframe-height` attribute never added
- Console shows: `IFrame has not responded within 5 seconds`
- Network shows: `GET .../assets/js/iFrameResizer.contentWindow.min.js [net::ERR_BLOCKED_BY_ORB]`

### 2. Focus/blur postMessage blocked on Next.js dev (localhost:3001)
The easyTithe injection verifies parent origin before attaching focus/blur listeners:

```js
const ALLOWED_POTENTIAL_PARENTS = [
  'https://reach.radio',
  'https://reachradiotucson.com',
  'https://reach-radio-web.pages.dev',
  'http://localhost:4321'  // ← Astro dev port only
]
```

`http://localhost:3001` (Next.js dev) is not in the list. The `initParentInfo` message is rejected, listeners never attach, and the media bar never hides when the user focuses a form field.

---

## Architecture

### easyTithe Custom Injection (user updates in admin panel)

The injection is pasted into the easyTithe/MinistryForms admin. It:
1. Loads `iframeResizer.contentWindow.min.js` from the host domain
2. Listens for `initParentInfo` from allowlisted parent origins
3. Attaches focus/blur listeners that postMessage back to the parent

### Parent page (Astro / Next.js)

Both pages:
1. Load `iFrameResizer.min.js` (parent-side library)
2. Call `iFrameResize()` after iframe load
3. Send `initParentInfo` postMessage to the iframe (with retry)
4. Listen for `donationFormInputFocus` / `donationFormInputBlur` to hide/show the media bar

---

## Changes Required

### A. easyTithe Admin (manual user update)

Update the custom injection script:

1. **Fix script src path** — change `/assets/js/` to `/js/`:
   ```html
   <!-- BEFORE -->
   <script src="https://reach.radio/assets/js/iFrameResizer.contentWindow.min.js"></script>
   
   <!-- AFTER -->
   <script src="https://reach.radio/js/iFrameResizer.contentWindow.min.js"></script>
   ```

2. **Add Next.js dev origin to allowlist:**
   ```js
   const ALLOWED_POTENTIAL_PARENTS = [
     'https://reach.radio',
     'https://reachradiotucson.com',
     'https://reach-radio-web.pages.dev',
     'http://localhost:4321',
     'http://localhost:3001'   // ← add this
   ]
   ```

### B. reach-radio-web (Astro) — fixes production immediately

1. **Add `public/_headers`** to serve the companion script with CORS header (defense-in-depth; prevents future ORB issues if Chrome tightens policy):
   ```
   /js/iFrameResizer.contentWindow.min.js
     Access-Control-Allow-Origin: *
     Content-Type: application/javascript
   ```

2. **Reduce iframe min-height** from `1300px` to `900px` — actual form content is ~820px. Add `overflow: hidden` (already present). This reduces dead whitespace.

### C. reach-radio-nextjs (Next.js) — ensures parity when deployed

1. **Copy `iFrameResizer.contentWindow.min.js`** from `reach-radio-web/public/js/` to `reach-radio-nextjs/public/js/` — so the companion script is available when Next.js takes over the domain.

2. **Add CORS header in `next.config.ts`:**
   ```ts
   {
     source: '/js/iFrameResizer.contentWindow.min.js',
     headers: [
       { key: 'Access-Control-Allow-Origin', value: '*' },
       { key: 'Content-Type', value: 'application/javascript' },
     ],
   }
   ```

3. **Update `next.config.ts` CSP** — add `https://forms.ministryforms.net` to `script-src` since the iframe's scripts originate from there. Currently missing.

4. **Reduce iframe min-height** from `min-h-[1000px]` to `min-h-[900px]` in `donate/page.tsx` to match the corrected form height.

---

## What Does NOT Change

- The `initParentInfo` postMessage retry loop — correct and necessary (companion script needs time to load)
- The focus/blur message listener — correct, will work once easyTithe injection is updated
- The skeleton loader and error fallback — working correctly
- `iframeRef` — still needed for the postMessage retry
- Sandbox attributes — appropriate for the use case

---

## Future: When Next.js Takes Over reach.radio

When Next.js is deployed at `https://reach.radio`:

1. Update easyTithe injection `<script src>` to point to the new domain (or keep it at `https://reach.radio` if it's the same domain — no change needed)
2. Add the Next.js staging/prod domain to `ALLOWED_POTENTIAL_PARENTS` in easyTithe admin before cutover

---

## Success Criteria

- [ ] iFrameResizer resizes iframe to actual content height (no dead whitespace)
- [ ] `iframe.style.height` set dynamically by iFrameResizer (not stuck at CSS min-height)
- [ ] `data-iframe-height` attribute present on iframe after load
- [ ] Focus on form field hides media bar; blur restores it
- [ ] Console shows `Verified parent origin` and `Attached focus/blur listeners to N form elements`
- [ ] No ORB errors in network log
- [ ] Works on both `http://localhost:3001` (Next.js dev) and `https://reach.radio` (Astro prod)
