---
name: run-reach-radio-nextjs
description: Build, run, and drive reach-radio-nextjs. Use when asked to start the app, run it, take a screenshot of its UI, verify a change works, or interact with the running app.
---

Next.js 16 / React 19 radio station web app. Drive it via the Playwright smoke driver at `scripts/smoke.mjs` — start the dev server first, then run the driver for screenshots.

All paths below are relative to the repo root (`reach-radio-nextjs/`).

## Prerequisites

Node.js 20+. All dependencies already in `node_modules` — no system packages needed.

```bash
npm install   # only needed after fresh clone or package changes
```

Required env vars live in `.env.local`. The file already exists with working values for Sanity (`SANITY_PROJECT_ID=bk05c6rl`, `SANITY_DATASET=production`). The remaining vars (`RECAPTCHA_SECRET_KEY`, `FORMSPREE_ENDPOINT`, `PUBLIC_RECAPTCHA_SITE_KEY`) have placeholder values — the app runs fine without real values for screenshot/smoke purposes.

## Run (agent path)

Start the dev server in the background, then run the smoke driver:

```bash
# Start dev server
npm run dev > /tmp/reach-radio-dev.log 2>&1 &
echo $! > /tmp/reach-radio-dev.pid

# Run driver — waits up to 60s for server, then screenshots home/teachers/about
node scripts/smoke.mjs
```

Screenshots land in `/tmp/reach-radio-shots/`:
- `home.png` — radio player, now-playing, media controls
- `teachers.png` — teacher list with recommended section
- `about.png` — station info, contact form, media bar

Stop the server: `kill $(cat /tmp/reach-radio-dev.pid)`

To screenshot a specific page in a one-off script (run from repo root):

```js
// save as /tmp/shot.mjs, then: node /tmp/shot.mjs
import { chromium } from '/path/to/reach-radio-nextjs/node_modules/playwright/index.mjs'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await (await browser.newContext()).newPage()
await page.goto('http://localhost:3000/teachers', { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForSelector('h1', { timeout: 20_000 })
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/shot.png' })
await browser.close()
```

## Run (human path)

```bash
npm run dev   # → http://localhost:3000, hot reload. Ctrl-C to stop.
```

`npm run dev:tunnel` also starts a Cloudflare tunnel for native WebView testing.

## Test

```bash
# Unit tests (vitest)
npm test

# E2E tests (Playwright — requires dev server running)
npx playwright test
```

**Known pre-existing failures (do not fix as part of unrelated PRs):**
- `home.spec.ts` — expects `h2` with "Today's Schedule" (removed from UI) and `RadioStation` as the first JSON-LD script (it's the second)
- `teachers.spec.ts` — search aria-live count text mismatch
- `bridge.spec.ts` — native postMessage bridge test flaky without native context
- Unit tests: ~22 failing in ThemeProvider and a few other component suites

6 e2e tests pass; 4 fail. 227 unit tests pass; 22 fail. All failures are pre-existing.

## Gotchas

- **Teachers page slow on first load** — Sanity CDN cold-start can take 10–30s. `waitUntil: 'networkidle'` will timeout. Use `domcontentloaded` + `waitForSelector('h1')` instead.
- **`@modal` parallel route** — `http://localhost:3000/teachers/[slug]` opens a modal overlay via Next.js parallel routes. The underlying teachers page stays mounted. Direct navigation to `/teachers/[slug]` without a referrer shows the panel full-screen.
- **Media bar always present** — once the audio context initializes (after first nav in a session), the `MediaBar` component at the bottom persists across route changes. Screenshots of non-home pages will show it.
- **`chromium-cli` not available on macOS** — the generic web-app pattern assumes Linux. Use this driver (`node driver.mjs`) instead.
- **Dev server port conflict** — if `EADDRINUSE: address already in use :::3000`, kill the old process: `pkill -f 'next dev'`

## Troubleshooting

- **`playwright/index.mjs not found`**: Run `npm install` — the driver resolves Playwright from repo `node_modules`.
- **First nav returns blank/loading screen**: Teachers/schedule pages wait for Sanity. Add `await page.waitForTimeout(3000)` before screenshot if `waitForSelector` fails.
- **`NEXT_PUBLIC_SITE_URL` missing warning in logs**: Non-fatal. Set it in `.env.local` if you need canonical URL generation to work locally (`NEXT_PUBLIC_SITE_URL=http://localhost:3000`).
