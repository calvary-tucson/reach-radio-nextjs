import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('loads and shows radio player', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h2', { hasText: "Today's Schedule" })).toBeVisible()
  })

  test('has correct page title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Listen.*Reach Radio/)
  })

  test('RadioStation JSON-LD present', async ({ page }) => {
    await page.goto('/')
    const ldJson = await page.locator('script[type="application/ld+json"]').first().textContent()
    expect(ldJson).toContain('"RadioStation"')
  })
})
