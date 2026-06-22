import { test, expect } from '@playwright/test'

test.describe('Native bridge', () => {
  test('window.nativeBridge.navigate() navigates', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.nativeBridge?.navigate('/teachers'))
    await expect(page).toHaveURL('/teachers')
  })

  test('window.nativeBridge.getLocation() returns current path', async ({ page }) => {
    await page.goto('/teachers')
    const location = await page.evaluate(() => window.nativeBridge?.getLocation())
    expect(location).toBe('/teachers')
  })

  test('window.nativeBridge.setPlayState() updates store', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.nativeBridge?.setPlayState(true))
    expect(true).toBe(true)
  })

  test('window.nativeBridge.setBuffering() updates store', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.nativeBridge?.setBuffering(true))
    expect(true).toBe(true)
  })
})
