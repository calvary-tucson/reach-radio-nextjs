import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('loads and shows radio player', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h2', { hasText: 'Playing Next' })).toBeVisible()
  })

  test('has correct page title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Listen.*Reach Radio/)
  })

  test('RadioStation JSON-LD present', async ({ page }) => {
    await page.goto('/')
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents()
    const radioStationJson = scripts.find((s) => s.includes('"RadioStation"'))
    expect(radioStationJson).toBeTruthy()
  })
})
