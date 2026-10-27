import { test, expect } from '@playwright/test'

for (const theme of ['light', 'dark', 'system'] as const) {
  test(`no hydration warning with saved theme=${theme}`, async ({ page, context }) => {
    await context.addCookies([{ name: 'theme', value: theme, url: 'http://localhost:3000' }])
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.goto('/')
    await page.waitForSelector('[role="group"][aria-label="Color theme"]', { state: 'attached' })
    await page.waitForTimeout(1000)
    const labels = { light: 'Light', dark: 'Dark', system: 'System' }
    await expect(
      page.locator('[role="group"][aria-label="Color theme"] button[aria-pressed="true"]')
    ).toHaveText(labels[theme])
    expect(errors.filter((e) => /hydrat|didn't match/i.test(e))).toEqual([])
  })
}
