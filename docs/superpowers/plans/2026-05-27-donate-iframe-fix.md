# Donate Page iframe Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix iFrameResizer auto-resize and media bar focus/blur protocol on the donation iframe — broken by a wrong path in the easyTithe injection and missing CORS headers.

**Architecture:** Two-repo code fix (Astro → deploy → then easyTithe admin update → then Next.js). The easyTithe custom injection loads the iFrameResizer companion script from a hardcoded URL (`/assets/js/…`) that 404s because the file lives at `/js/…`. Fix: add CORS header + correct path. Next.js gets the companion script too so it's ready when it takes over the domain.

**Tech Stack:** Astro 5 / Cloudflare Pages (`_headers` file), Next.js 16 (`next.config.ts` headers), easyTithe admin (manual HTML paste)

---

## File Map

| File | Repo | Action |
|---|---|---|
| `public/_headers` | reach-radio-web | Create — CORS header for companion script |
| `src/pages/donate/index.astro` | reach-radio-web | Modify — reduce min-height 1300→900px |
| `public/js/iFrameResizer.contentWindow.min.js` | reach-radio-nextjs | Create — copy from reach-radio-web |
| `next.config.ts` | reach-radio-nextjs | Modify — CORS header route + CSP fix |
| `src/app/donate/page.tsx` | reach-radio-nextjs | Modify — reduce min-h 1000→900px |
| easyTithe admin injection | easyTithe | Manual — fix script src path + add localhost:3001 |

---

## Task 1: Add CORS header to Astro companion script (reach-radio-web)

**Files:**
- Create: `reach-radio-web/public/_headers`

- [ ] **Step 1: Verify the file is missing**

```bash
ls /Users/danielmccauley/Documents/Development/reach-radio-web/public/_headers
```

Expected: `No such file or directory`

- [ ] **Step 2: Confirm companion script exists at the correct path**

```bash
ls /Users/danielmccauley/Documents/Development/reach-radio-web/public/js/iFrameResizer.contentWindow.min.js
```

Expected: file listed (not an error). This confirms the path is `/js/`, not `/assets/js/`.

- [ ] **Step 3: Create `public/_headers`**

```
/js/iFrameResizer.contentWindow.min.js
  Access-Control-Allow-Origin: *
  Content-Type: application/javascript
```

File path: `/Users/danielmccauley/Documents/Development/reach-radio-web/public/_headers`

- [ ] **Step 4: Commit**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-web
git add public/_headers
git commit -m "fix(donate): add CORS header to iFrameResizer companion script"
```

---

## Task 2: Reduce iframe min-height in Astro donate page

**Files:**
- Modify: `reach-radio-web/src/pages/donate/index.astro:70`

The form content is ~820px tall. 1300px leaves ~480px of dead whitespace. 900px gives 80px breathing room above the media bar.

- [ ] **Step 1: Update iframe min-height**

In `reach-radio-web/src/pages/donate/index.astro`, change line 70:

```astro
<!-- BEFORE -->
<iframe
  id='donation'
  style='width: 1px; min-width: 100%; min-height: 1300px;'

<!-- AFTER -->
<iframe
  id='donation'
  style='width: 1px; min-width: 100%; min-height: 900px;'
```

- [ ] **Step 2: Commit**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-web
git add src/pages/donate/index.astro
git commit -m "fix(donate): reduce iframe min-height from 1300px to 900px"
```

---

## Task 3: Deploy reach-radio-web to Cloudflare Pages

The easyTithe admin update must happen AFTER these changes are live. Deploy now.

- [ ] **Step 1: Push to main (triggers Cloudflare Pages deploy)**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-web
git push origin main
```

- [ ] **Step 2: Wait for deploy and verify CORS header is live**

After Cloudflare deploy completes (~1-2 min), run:

```bash
curl -I https://reach.radio/js/iFrameResizer.contentWindow.min.js
```

Expected output includes:
```
HTTP/2 200
content-type: application/javascript
access-control-allow-origin: *
```

Do NOT proceed to Task 4 until this curl returns `access-control-allow-origin: *`.

---

## Task 4: Update easyTithe admin injection (manual step)

> **This is a manual step.** Log into the easyTithe/MinistryForms admin panel and update the custom HTML injection for the Reach Radio donation form.

- [ ] **Step 1: Log into easyTithe admin and find the custom injection**

Navigate to the donation form's custom code/injection settings.

- [ ] **Step 2: Fix the companion script path**

Change the `<script src>` from the wrong path to the correct one:

```html
<!-- BEFORE (wrong path — causes 404 → ORB block) -->
<script src="https://reach.radio/assets/js/iFrameResizer.contentWindow.min.js"></script>

<!-- AFTER (correct path) -->
<script src="https://reach.radio/js/iFrameResizer.contentWindow.min.js"></script>
```

- [ ] **Step 3: Add localhost:3001 to the allowed origins**

In the same injection script, update `ALLOWED_POTENTIAL_PARENTS`:

```js
// BEFORE
const ALLOWED_POTENTIAL_PARENTS = [
  'https://reach.radio',
  'https://reachradiotucson.com',
  'https://reach-radio-web.pages.dev',
  'http://localhost:4321'
]

// AFTER
const ALLOWED_POTENTIAL_PARENTS = [
  'https://reach.radio',
  'https://reachradiotucson.com',
  'https://reach-radio-web.pages.dev',
  'http://localhost:4321',
  'http://localhost:3001'
]
```

- [ ] **Step 4: Save and publish the injection**

- [ ] **Step 5: Verify on production**

Open `https://reach.radio/donate` in a browser with DevTools open. After the iframe loads, check the console:

Expected console output:
```
Verified parent origin: https://reach.radio
Attached focus/blur listeners to 7 form elements.
```

Expected network: no `ERR_BLOCKED_BY_ORB` for `iFrameResizer.contentWindow.min.js`

Expected behavior: iframe height no longer locked at 900px CSS floor — `iframe.style.height` set dynamically. Verify in DevTools:
```js
document.querySelector('#donation').style.height // should be e.g. "823px" not ""
```

---

## Task 5: Copy companion script to reach-radio-nextjs

**Files:**
- Create: `reach-radio-nextjs/public/js/iFrameResizer.contentWindow.min.js`

When Next.js takes over `reach.radio`, the easyTithe injection still loads the companion script from that domain. It needs to be present.

- [ ] **Step 1: Verify source file exists**

```bash
ls /Users/danielmccauley/Documents/Development/reach-radio-web/public/js/iFrameResizer.contentWindow.min.js
```

- [ ] **Step 2: Copy to Next.js repo**

```bash
cp /Users/danielmccauley/Documents/Development/reach-radio-web/public/js/iFrameResizer.contentWindow.min.js \
   /Users/danielmccauley/Documents/Development/reach-radio-nextjs/public/js/iFrameResizer.contentWindow.min.js
```

- [ ] **Step 3: Verify it's there**

```bash
ls /Users/danielmccauley/Documents/Development/reach-radio-nextjs/public/js/
```

Expected: both `iFrameResizer.min.js` and `iFrameResizer.contentWindow.min.js` listed.

- [ ] **Step 4: Commit**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs
git add public/js/iFrameResizer.contentWindow.min.js
git commit -m "feat(donate): add iFrameResizer contentWindow companion script"
```

---

## Task 6: Add CORS header and CSP fix to Next.js

**Files:**
- Modify: `reach-radio-nextjs/next.config.ts`

Two changes:
1. CORS header for `/js/iFrameResizer.contentWindow.min.js` — needed when Next.js is at reach.radio
2. CSP `script-src` — currently missing `https://forms.ministryforms.net` which the iframe's scripts load from

- [ ] **Step 1: Read current next.config.ts to confirm the headers() block**

Current `headers()` has a single catch-all `'/(.*)'` rule. We add a specific route before it.

- [ ] **Step 2: Add CORS header route and fix CSP in `next.config.ts`**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsHmrCache: true,
    viewTransition: true,
    useCache: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/js/iFrameResizer.contentWindow.min.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Content-Type', value: 'application/javascript' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://forms.ministryforms.net",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' cdn.sanity.io data: blob: https://www.google.com",
              "media-src 'self' https://*.radiojar.com https://reach.radio",
              "connect-src 'self' api.sanity.io cdn.sanity.io *.radiojar.com https://formspree.io https://www.google.com",
              "font-src 'self'",
              "object-src 'none'",
              "frame-src https://forms.ministryforms.net",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self' https://formspree.io",
            ].join('; '),
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/speakers/:slug*', destination: '/teachers/:slug*', permanent: true },
      { source: '/teachers/search', destination: '/teachers', permanent: false },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 3: Verify header is served locally**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs
curl -I http://localhost:3001/js/iFrameResizer.contentWindow.min.js
```

Expected:
```
HTTP/1.1 200 OK
content-type: application/javascript
access-control-allow-origin: *
```

- [ ] **Step 4: Commit**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs
git add next.config.ts
git commit -m "fix(donate): add CORS header for companion script + add ministryforms to CSP script-src"
```

---

## Task 7: Reduce iframe min-height in Next.js donate page

**Files:**
- Modify: `reach-radio-nextjs/src/app/donate/page.tsx:106`

- [ ] **Step 1: Update min-height class**

In `src/app/donate/page.tsx`, line 106, update the iframe className:

```tsx
// BEFORE
className={`w-full min-h-[1000px] border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${loaded ? 'block' : 'hidden'}`}

// AFTER
className={`w-full min-h-[900px] border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${loaded ? 'block' : 'hidden'}`}
```

- [ ] **Step 2: Also update the skeleton height to match**

On line 88, update skeleton height from `h-[1000px]` to `h-[900px]`:

```tsx
// BEFORE
<div role="status" aria-label="Loading donation form..." className="animate-pulse flex flex-col gap-4 h-[1000px] bg-black rounded p-4">

// AFTER
<div role="status" aria-label="Loading donation form..." className="animate-pulse flex flex-col gap-4 h-[900px] bg-black rounded p-4">
```

- [ ] **Step 3: Load donate page in browser and confirm no dead whitespace**

Navigate to `http://localhost:3001/donate`. Scroll to the bottom of the form. The footer should follow immediately below the form content with minimal gap.

- [ ] **Step 4: Commit**

```bash
cd /Users/danielmccauley/Documents/Development/reach-radio-nextjs
git add src/app/donate/page.tsx
git commit -m "fix(donate): reduce iframe and skeleton min-height from 1000px to 900px"
```

---

## Task 8: End-to-end verification on localhost:3001

After easyTithe admin update (Task 4) is live:

- [ ] **Step 1: Open DevTools on `http://localhost:3001/donate`**

- [ ] **Step 2: Check console after page load**

Expected:
```
Verified parent origin: http://localhost:3001
Attached focus/blur listeners to 7 form elements.
```

- [ ] **Step 3: Verify iFrameResizer set height**

In browser console:
```js
document.getElementById('donation-iframe').style.height
// expected: e.g. "823px" — NOT ""
```

- [ ] **Step 4: Test media bar hide/show**

Click into the First Name field in the donation form. The media bar at the bottom should slide/hide. Click outside → media bar returns.

- [ ] **Step 5: Check network tab — no ORB errors**

Network tab filter: `iFrameResizer`. Should show:
- `iFrameResizer.min.js` — 200
- `iFrameResizer.contentWindow.min.js` — 200 (loaded by iframe from localhost:3001)
