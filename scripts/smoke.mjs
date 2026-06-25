#!/usr/bin/env node
/**
 * Smoke driver for reach-radio-nextjs.
 * Run from repo root: node scripts/smoke.mjs [--port 3000]
 *
 * Screenshots land in /tmp/reach-radio-shots/
 */

import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = '/tmp/reach-radio-shots'
const PORT = process.argv.includes('--port')
  ? process.argv[process.argv.indexOf('--port') + 1]
  : '3000'
const BASE = `http://localhost:${PORT}`

const { chromium } = await import(`${ROOT}/node_modules/playwright/index.mjs`)

mkdirSync(SHOTS, { recursive: true })

// Poll until dev server responds (max 60s)
console.log(`Waiting for dev server at ${BASE}...`)
const deadline = Date.now() + 60_000
while (Date.now() < deadline) {
  try {
    const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(2000) })
    if (res.status < 500) break
  } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 1000))
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()

const snap = async (path, name, waitSel) => {
  const url = `${BASE}${path}`
  console.log(`  → ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  if (waitSel) await page.waitForSelector(waitSel, { timeout: 20_000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const dest = `${SHOTS}/${name}.png`
  await page.screenshot({ path: dest })
  console.log(`    ✓ ${dest}`)
}

await snap('/',         'home',     'img')
await snap('/teachers', 'teachers', 'h1')
await snap('/about',    'about',    'h1')

await browser.close()
console.log('\nSmoke done. Screenshots:', SHOTS)
