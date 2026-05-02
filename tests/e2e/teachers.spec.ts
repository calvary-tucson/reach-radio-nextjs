import { test, expect } from '@playwright/test'

test.describe('Teachers', () => {
  test('teachers page loads with grid', async ({ page }) => {
    await page.goto('/teachers')
    await expect(page.locator('h1', { hasText: 'Teachers' })).toBeVisible()
    await page.waitForSelector('a[href^="/teachers/"]', { timeout: 10000 })
    const cards = page.locator('a[href^="/teachers/"]')
    await expect(cards.first()).toBeVisible()
  })

  test('search returns results', async ({ page }) => {
    await page.goto('/teachers')
    await page.fill('input[name="q"]', 'John')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/teachers\/search\?q=John/)
  })

  test('teacher detail page loads', async ({ page }) => {
    await page.goto('/teachers')
    await page.waitForSelector('a[href^="/teachers/"]', { timeout: 10000 })
    const firstCard = page.locator('a[href^="/teachers/"]').first()
    await firstCard.click()
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('a', { hasText: '← Teachers' })).toBeVisible()
  })
})
