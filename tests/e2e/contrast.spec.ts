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
  const opacityOf = (el: Element) => {
    let o = 1
    for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity)
    return o
  }
  const out: { text: string; ratio: number; need: number; selector: string }[] = []
  const dlg = document.querySelector('[role=dialog]')
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = (t.textContent ?? '').trim()
    const el = t.parentElement
    if (!text || !el) continue
    if (el.closest('[data-contrast-skip]')) continue
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0 || r.width <= 1 || r.height <= 1) continue // <=1px = sr-only
    if (dlg && !dlg.contains(el)) continue // dialog open: measure only inside it
    const opacity = opacityOf(el)
    if (opacity === 0) continue
    const bg = bgOf(el)
    const color = parse(cs.color)
    color[3] *= opacity // fold ancestor opacity into the foreground alpha
    const fg = over(color, bg)
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

// networkidle never fires here (long-lived streams), so wait on concrete state instead:
// the theme class on <html> and a visible content locator.
// Also waits for finite CSS transitions/animations: colors and opacity are measured
// via getComputedStyle, which returns mid-flight values while the theme swap fades in.
const themeApplied = async (page: Page, theme: 'light' | 'dark') => {
  await expect(page.locator('html')).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`))
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) {
      const running = document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? 0))
      if (running.length === 0) return
      await Promise.all(running.map((a) => a.finished.catch(() => undefined)))
    }
  })
}

// A scheduled card button: present in both the mobile list and desktop week layouts.
const scheduleCard = (page: Page) => page.locator('button[aria-label*=" to "]:visible').first()

const openScheduleTab = async (page: Page, theme: 'light' | 'dark') => {
  await page.goto(`/teachers?theme=${theme}`)
  await themeApplied(page, theme)
  const tab = page.getByRole('tab', { name: /schedule/i })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await expect(scheduleCard(page)).toBeVisible()
}

const PAGES = ['/', '/teachers', '/about', '/donate']

for (const theme of ['light', 'dark'] as const) {
  for (const path of PAGES) {
    test(`contrast ${theme} ${path}`, async ({ page }) => {
      await page.goto(`${path}?theme=${theme}`)
      await themeApplied(page, theme)
      await expect(page.locator('main h1').first()).toBeVisible()
      const fails = await page.evaluate(MEASURE)
      expect(fails, JSON.stringify(fails, null, 2)).toEqual([])
    })
  }

  test(`contrast ${theme} schedule tab and day picker`, async ({ page }) => {
    await openScheduleTab(page, theme)
    expect(await page.evaluate(MEASURE), 'schedule tab').toEqual([])
    // Day picker trigger exists only below the lg breakpoint (ScheduleTabView.tsx:92).
    await page.setViewportSize({ width: 390, height: 844 })
    const picker = page.locator('button[aria-haspopup=listbox]')
    await expect(picker).toBeVisible()
    await expect(scheduleCard(page)).toBeVisible()
    expect(await page.evaluate(MEASURE), 'schedule tab mobile').toEqual([])
    await picker.click()
    await page.waitForSelector('[role=dialog]')
    expect(await page.evaluate(MEASURE), 'day picker open').toEqual([])
  })

  test(`contrast ${theme} teacher modal from schedule`, async ({ page }) => {
    await openScheduleTab(page, theme)
    await scheduleCard(page).click()
    await page.waitForSelector('[role=dialog]')
    expect(await page.evaluate(MEASURE), 'teacher modal open').toEqual([])
  })
}
