import { test, expect, type Page } from '@playwright/test'

/** Records every class value `<html>` ever has, so a dark-then-light flash is caught. */
async function logHtmlClasses(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __htmlClasses: string[] }
    w.__htmlClasses = []
    new MutationObserver(() => w.__htmlClasses.push(document.documentElement.className)).observe(document, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    })
  })
}

const seen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __htmlClasses: string[] }).__htmlClasses)

test.describe('system = light', () => {
  test.use({ colorScheme: 'light' })

  test('web visitor gets light with no dark flash', async ({ page }) => {
    await logHtmlClasses(page)
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\blight\b/)
    expect((await seen(page)).some((c) => /\bdark\b/.test(c))).toBe(false)
  })

  test('saved dark beats system light', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'theme', value: 'dark', url: baseURL! }])
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  })

  test('native app (mobile-app cookie) stays dark, even with a saved light cookie', async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: 'mobile-app', value: 'true', url: baseURL! },
      { name: 'theme', value: 'light', url: baseURL! },
    ])
    await logHtmlClasses(page)
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    await expect(page.locator('html')).toHaveClass(/\bnative-app\b/)
    expect((await seen(page)).some((c) => /\blight\b/.test(c))).toBe(false)
    await expect(page.getByRole('button', { name: 'Toggle color theme' })).toHaveCount(0)
  })

  test('native app (iOS-style injected window.inNativeApp, no cookie) stays dark', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'theme', value: 'light', url: baseURL! }])
    await page.addInitScript(() => {
      ;(window as unknown as { inNativeApp: boolean }).inNativeApp = true
    })
    await logHtmlClasses(page)
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    expect((await seen(page)).some((c) => /\blight\b/.test(c))).toBe(false)
  })
})

test.describe('system = dark', () => {
  test.use({ colorScheme: 'dark' })

  test('web visitor gets dark', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  })
})

test.describe('system = no preference', () => {
  test.use({ colorScheme: 'no-preference' })

  test('web visitor gets dark', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  })
})
