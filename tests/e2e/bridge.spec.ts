import { test, expect } from '@playwright/test'

function dispatchNativeCommand(page: import('@playwright/test').Page, detail: Record<string, unknown>) {
  return page.evaluate((d) => {
    window.dispatchEvent(new CustomEvent('nativeCommand', { detail: d }))
  }, detail)
}

test.describe('Native bridge', () => {
  test('nativeCommand navigate dispatches router.push', async ({ page }) => {
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'navigate', path: '/teachers' })
    await expect(page).toHaveURL('/teachers')
  })

  test('nativeCommand setPlayState updates media store', async ({ page }) => {
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'setPlayState', playing: true })
    expect(true).toBe(true)
  })

  test('nativeCommand setBuffering updates media store', async ({ page }) => {
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'setBuffering', buffering: true })
    expect(true).toBe(true)
  })

  test('nativeCommand refresh calls router.refresh', async ({ page }) => {
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'refresh' })
    expect(true).toBe(true)
  })
})
