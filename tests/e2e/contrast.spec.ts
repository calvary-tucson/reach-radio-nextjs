import { expect, test, type Page } from '@playwright/test'

const MEASURE = () => {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })!
  // Canvas resolves any CSS color (oklch, color-mix, rgb) to RGBA. Do not regex rgb().
  const parse = (s: string): [number, number, number, number] => {
    cx.clearRect(0, 0, 1, 1)
    cx.fillStyle = '#000'
    cx.fillStyle = s
    cx.fillRect(0, 0, 1, 1)
    const d = cx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  }
  const over = (fg: number[], bg: number[]) => {
    const a = fg[3]
    return [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a))).concat(1)
  }
  const lum = ([r, g, b]: number[]) => {
    const f = (c: number) => {
      c /= 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const bgOf = (el: Element): number[] => {
    const layers: number[][] = []
    for (let n: Element | null = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c[3] > 0) layers.push(c)
      if (c[3] === 1) break
    }
    return layers.reverse().reduce((acc, l) => over(l, acc), [255, 255, 255, 1])
  }
  const out: { text: string; ratio: number; need: number; selector: string }[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = (t.textContent ?? '').trim()
    const el = t.parentElement
    if (!text || !el) continue
    if (el.closest('[data-contrast-skip]')) continue
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0 || r.width <= 1 || r.height <= 1) continue // <=1px = sr-only
    const dlg = document.querySelector('[role=dialog]')
    if (dlg && !dlg.contains(el)) continue // dialog open: measure only inside it
    const bg = bgOf(el)
    const fg = over(parse(cs.color), bg)
    const l1 = lum(fg)
    const l2 = lum(bg)
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    const px = parseFloat(cs.fontSize)
    const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700)
    const need = large ? 3 : 4.5
    if (ratio < need)
      out.push({
        text: text.slice(0, 40),
        ratio: Math.round(ratio * 100) / 100,
        need,
        selector: el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 3).join('.'),
      })
  }
  return out
}

// networkidle never fires here (long-lived streams), so wait for load plus a short settle.
const settle = async (page: Page) => {
  await page.waitForLoadState('load')
  await page.waitForTimeout(1500)
}

const PAGES =['/', '/teachers', '/about', '/donate']

for (const theme of ['light', 'dark'] as const) {
  for (const path of PAGES) {
    test(`contrast ${theme} ${path}`, async ({ page }) => {
      await page.goto(`${path}${path.includes('?') ? '&' : '?'}theme=${theme}`)
      await settle(page)
      const fails = await page.evaluate(MEASURE)
      expect(fails, JSON.stringify(fails, null, 2)).toEqual([])
    })
  }

  test(`contrast ${theme} schedule tab and day picker`, async ({ page }) => {
    await page.goto(`/teachers?theme=${theme}`)
    await page.getByRole('tab', { name: /schedule/i }).click()
    await settle(page)
    expect(await page.evaluate(MEASURE), 'schedule tab').toEqual([])
    // Day picker trigger exists only below the lg breakpoint (ScheduleTabView.tsx:92).
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(MEASURE), 'schedule tab mobile').toEqual([])
    await page.locator('button[aria-haspopup=listbox]').click()
    await page.waitForSelector('[role=dialog]')
    expect(await page.evaluate(MEASURE), 'day picker open').toEqual([])
  })

  test(`contrast ${theme} teacher modal from schedule`, async ({ page }) => {
    await page.goto(`/teachers?theme=${theme}`)
    await page.getByRole('tab', { name: /schedule/i }).click()
    await settle(page)
    await page.locator('button[aria-label*=" to "]:visible').first().click()
    await page.waitForSelector('[role=dialog]')
    expect(await page.evaluate(MEASURE), 'teacher modal open').toEqual([])
  })
}
