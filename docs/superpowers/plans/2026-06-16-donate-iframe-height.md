# Donate Iframe Height Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the donation form iframe being too short on mobile by diagnosing why auto-resize fails and implementing a reliable height solution.

**Architecture:** iFrameResizer v4 requires its `contentWindow` script to run *inside* the iframe — which we cannot control since ministryforms.net is a third party. The plan: (1) confirm the root cause via debug logging, (2) fix the script-load race condition, (3) switch to a postMessage-based custom height listener for any messages the form sends, and (4) fall back to a responsive fixed height if the form sends no sizing messages.

**Tech Stack:** Next.js (App Router), React 19, iFrameResizer v4.3.5, `window.postMessage` API, Tailwind CSS

---

## Root Cause Summary

Three compounding issues:

1. **iFrameResizer content window script missing from iframe** — `iFrameResizer.min.js` (parent side) explicitly requires `iframeResizer.contentWindow.min.js` to be loaded *inside* the target frame. We own the parent page; ministryforms.net owns the iframe content. We cannot inject scripts into it.

2. **Script-load race condition** — The `<Script>` tag uses `strategy="afterInteractive"`, which loads the script *after* page hydration. If the iframe loads before that script is ready, `window.iFrameResize?.()` is undefined and silently does nothing.

3. **Fixed `min-h-[900px]` is too short on mobile** — Narrower viewports cause the form to reflow taller. 900px was set without testing across all screen sizes.

---

## File Structure

| File | Change |
|------|--------|
| `src/app/donate/page.tsx` | Main fix target: add debug logging, fix race, switch resize strategy |

---

### Task 1: Add Diagnostic Logging (Temporary)

**Purpose:** Confirm which messages (if any) the form sends, and confirm whether `iFrameResize` is available when the iframe loads.

**Files:**
- Modify: `src/app/donate/page.tsx`

- [ ] **Step 1: Add debug logging to `handleLoad` and the message listener**

Replace the `handleLoad` function and `handleMessage` listener in `src/app/donate/page.tsx` with the debug-augmented versions below. This is **temporary** — remove in Task 2.

```tsx
// In handleLoad:
function handleLoad() {
  if (timeoutRef.current) clearTimeout(timeoutRef.current)
  setLoaded(true)
  console.debug('[donate] iframe loaded. iFrameResize available:', typeof window.iFrameResize)
  window.iFrameResize?.(
    { log: true, heightCalculationMethod: 'bodyOffset' },
    '#donation-iframe'
  )
  // ... existing postMessage retry logic unchanged
}

// Replace handleMessage:
function handleMessage(event: MessageEvent) {
  // Log ALL messages from the form origin so we can see what they send
  if (event.origin === EXPECTED_ORIGIN) {
    console.debug('[donate] message from form:', JSON.stringify(event.data))
  }
  if (event.origin !== EXPECTED_ORIGIN) return
  if (event.data?.type === 'donationFormInputFocus') {
    setShowMediaBar(false)
  } else if (event.data?.type === 'donationFormInputBlur') {
    setShowMediaBar(true)
  }
}
```

- [ ] **Step 2: Open the donate page on a mobile viewport and check console**

```bash
# Start dev server if not running
npm run dev
# Open http://localhost:3000/donate in Chrome DevTools with mobile emulation (375px width)
```

In DevTools console, look for:
- `[donate] iframe loaded. iFrameResize available: function` → script loaded in time (race not the issue)
- `[donate] iframe loaded. iFrameResize available: undefined` → **race condition confirmed**
- `[donate] message from form: {...}` → form sends messages — note the message shape
- No message logs → **form sends nothing; must use fixed height**

- [ ] **Step 3: Note findings for Task 2**

Document in a comment at the top of page.tsx (remove before committing):
```tsx
// FINDINGS: [paste what console showed here]
```

---

### Task 2: Fix the Script-Load Race Condition

**Purpose:** Ensure `iFrameResize` is only called after BOTH the iframe and the iFrameResizer script have loaded, regardless of which loads first.

**Files:**
- Modify: `src/app/donate/page.tsx`

- [ ] **Step 1: Add `scriptReady` state and ref for `iframeLoaded`**

Add these to the component, alongside the existing state:

```tsx
const [scriptReady, setScriptReady] = useState(false)
const iframeLoadedRef = useRef(false)
```

- [ ] **Step 2: Add `onLoad` to the Script tag and move `iFrameResize` call there**

Replace the `<Script>` tag at the bottom of the JSX:

```tsx
<Script
  src="/js/iFrameResizer.min.js"
  strategy="afterInteractive"
  onLoad={() => {
    setScriptReady(true)
    // If iframe already loaded before script was ready, call resize now
    if (iframeLoadedRef.current) {
      window.iFrameResize?.(
        { log: false, heightCalculationMethod: 'bodyOffset' },
        '#donation-iframe'
      )
    }
  }}
/>
```

- [ ] **Step 3: Update `handleLoad` to track iframe-loaded state and conditionally call resize**

```tsx
function handleLoad() {
  if (timeoutRef.current) clearTimeout(timeoutRef.current)
  setLoaded(true)
  iframeLoadedRef.current = true
  // Only call iFrameResize if the script has already loaded
  if (scriptReady) {
    window.iFrameResize?.(
      { log: false, heightCalculationMethod: 'bodyOffset' },
      '#donation-iframe'
    )
  }
  // existing postMessage retry logic — unchanged
  let remaining = 5
  function trySend() {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'initParentInfo', origin: window.location.origin },
        EXPECTED_ORIGIN
      )
    } catch (err) {
      console.warn('postMessage to donation form failed:', err)
    }
    if (--remaining > 0) {
      retryRef.current = setTimeout(trySend, 500)
    }
  }
  trySend()
}
```

- [ ] **Step 4: Remove temporary debug logging from Task 1**

Remove the `console.debug` lines added in Task 1. Keep the `console.warn` in `trySend`.

- [ ] **Step 5: Test in dev — confirm no console errors, iframe loads**

```bash
npm run dev
# Open http://localhost:3000/donate — iframe should render
# No errors in console
```

- [ ] **Step 6: Commit**

```bash
git add src/app/donate/page.tsx
git commit -m "fix(donate): resolve iFrameResize script-load race condition"
```

---

### Task 3: Add Custom postMessage Height Listener

**Purpose:** If ministryforms.net sends ANY height or resize message (even a non-iFrameResizer format), capture it and apply it to the iframe. This handles cases where the form has its own resize messaging that doesn't match iFrameResizer's protocol.

**Files:**
- Modify: `src/app/donate/page.tsx`

- [ ] **Step 1: Add `iframeHeight` state**

```tsx
const [iframeHeight, setIframeHeight] = useState<number | null>(null)
```

- [ ] **Step 2: Expand the `handleMessage` listener to capture height messages**

Update the `handleMessage` function (in the `useEffect` that adds the message listener):

```tsx
function handleMessage(event: MessageEvent) {
  if (event.origin !== EXPECTED_ORIGIN) return

  const data = event.data

  // Handle media bar visibility
  if (data?.type === 'donationFormInputFocus') {
    setShowMediaBar(false)
    return
  }
  if (data?.type === 'donationFormInputBlur') {
    setShowMediaBar(true)
    return
  }

  // Capture any height value the form sends
  // Common shapes: { height: 1234 }, { type: 'resize', height: 1234 },
  // iFrameResizer internal: [iFrameSizer]id:height:...
  const height =
    typeof data?.height === 'number'
      ? data.height
      : typeof data?.scrollHeight === 'number'
        ? data.scrollHeight
        : null

  if (height !== null && height > 0) {
    setIframeHeight(height)
  }

  // iFrameResizer v4 sends string messages like "[iFrameSizer]id:height:..."
  if (typeof data === 'string' && data.startsWith('[iFrameSizer]')) {
    const parts = data.split(':')
    // format: [iFrameSizer]id:height:width:...
    const h = parseInt(parts[1], 10)
    if (!isNaN(h) && h > 0) {
      setIframeHeight(h)
    }
  }
}
```

- [ ] **Step 3: Apply `iframeHeight` to the iframe style**

Update the `<iframe>` element's `className` and add an inline `style` prop:

```tsx
<iframe
  id="donation-iframe"
  ref={iframeRef}
  src={DONATE_URL}
  title="Donation Form"
  tabIndex={0}
  onLoad={handleLoad}
  onError={handleError}
  sandbox="allow-scripts allow-forms allow-popups"
  style={iframeHeight ? { height: `${iframeHeight}px` } : undefined}
  className={`w-full min-h-[900px] border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${loaded ? 'block' : 'hidden'}`}
/>
```

The `style` height overrides the CSS `min-h` when a measured height is available.

- [ ] **Step 4: Test — verify height adjusts if form sends messages**

```bash
npm run dev
# Open http://localhost:3000/donate with mobile emulation
# Fill out first form field — see if height changes
# If iframeHeight state is set, iframe height should reflect it
```

- [ ] **Step 5: Commit**

```bash
git add src/app/donate/page.tsx
git commit -m "fix(donate): listen for height postMessages from form iframe"
```

---

### Task 4: Responsive Min-Height Fallback

**Purpose:** If neither iFrameResizer nor custom postMessage produces a height (ministryforms.net sends nothing), use a responsive `min-h` that's tall enough on mobile. This is the last-resort safety net.

**Files:**
- Modify: `src/app/donate/page.tsx`

- [ ] **Step 1: Measure actual mobile form height**

Open `https://forms.ministryforms.net/viewForm.aspx?formid=32b9c82a-1472-4180-b023-73b42532b63e&direct-link=true&embed=false` directly in Chrome DevTools with:
- iPhone 15 Pro (390px viewport)
- Samsung Galaxy S20 (412px viewport)

Scroll to bottom, note the full page height (DevTools → Elements → `<body>` → computed height, or `document.body.scrollHeight` in console).

- [ ] **Step 2: Update iframe `min-h` with mobile-first responsive values**

Based on measured heights, update the iframe `className`. Example (adjust numbers to match measurements):

```tsx
className={`w-full min-h-[1400px] md:min-h-[1100px] lg:min-h-[900px] border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${loaded ? 'block' : 'hidden'}`}
```

- Also update the skeleton loader div to use the same responsive height:

```tsx
<div
  role="status"
  aria-label="Loading donation form..."
  className="animate-pulse flex flex-col gap-4 min-h-[1400px] md:min-h-[1100px] lg:min-h-[900px] bg-[#1c2128] light:bg-gray-50 border border-white/5 light:border-gray-200 rounded-[18px] p-4"
>
```

- [ ] **Step 3: Test on mobile viewport**

```bash
npm run dev
# Open http://localhost:3000/donate
# Test with Chrome DevTools mobile emulation at 375px, 390px, 412px
# Entire form should be visible without scrolling inside the iframe
# The iframe container should expand to show all content
```

- [ ] **Step 4: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/donate/page.tsx
git commit -m "fix(donate): increase responsive iframe min-height for mobile"
```

---

## Decision Tree After Task 1 Diagnostics

Use this after running Task 1 to decide which subsequent tasks apply:

| Console shows | Action |
|---------------|--------|
| `iFrameResize available: undefined` | Task 2 is critical (race condition) |
| `iFrameResize available: function` | Task 2 still helpful to make it robust |
| Form sends `[iFrameSizer]` string messages | iFrameResizer IS running in their frame — Task 2 fix will work |
| Form sends `{ height: N }` or `{ scrollHeight: N }` | Task 3 custom listener will capture it |
| No messages at all | Task 4 (responsive min-height) is the only fix |
| Form sends unknown message shape | Log `JSON.stringify(event.data)` and adapt Task 3 regex |

---

## Self-Review

**Spec coverage:**
- ✅ Diagnose root cause (Task 1)
- ✅ Fix script race condition (Task 2)
- ✅ Capture form's own resize messages (Task 3)
- ✅ Responsive min-height fallback (Task 4)
- ✅ Skeleton loader height matches iframe height (Task 4, Step 2)

**Placeholder scan:** No TBD/TODO in plan body. Step 1 of Task 4 requires manual measurement — that's intentional since the height depends on the actual form content and can't be hardcoded here.

**Type consistency:** `iframeHeight: number | null` used consistently across Task 3 steps. `iframeLoadedRef: React.MutableRefObject<boolean>` consistent.
