import { test, expect } from '@playwright/test'

test.describe('Teachers', () => {
  test('teachers page loads with grid', async ({ page }) => {
    await page.goto('/teachers')
    await expect(page.locator('h1', { hasText: 'Teachers' })).toBeVisible()
    await page.waitForSelector('a[href^="/teachers/"]', { timeout: 10000 })
    const cards = page.locator('a[href^="/teachers/"]')
    await expect(cards.first()).toBeVisible()
  })

  test('search page filters teachers and syncs URL', async ({ page }) => {
    await page.goto('/teachers/search')
    await page.waitForSelector('input[aria-label="Search teachers"]', { timeout: 10000 })

    const searchInput = page.locator('input[aria-label="Search teachers"]')
    await expect(searchInput).toBeVisible()

    await searchInput.fill('Jack')
    // Wait for debounce (300ms) + buffer
    await page.waitForTimeout(500)

    // URL updates to reflect the query
    await expect(page).toHaveURL(/\/teachers\/search\?q=Jack/)

    // Count label announces results
    const countLabel = page.locator('[aria-live="polite"]')
    await expect(countLabel).toContainText(/\d+ teachers? found/)

    // Clearing search restores full list
    await searchInput.fill('')
    await page.waitForTimeout(500)
    await expect(page).toHaveURL('/teachers/search')
  })

  test('teacher detail page loads', async ({ page }) => {
    await page.goto('/teachers')
    await page.waitForSelector('a[href^="/teachers/"]', { timeout: 10000 })
    const firstCard = page.locator('a[href^="/teachers/"]').first()
    await firstCard.click()
    await expect(page.locator('h1')).toBeVisible()
    // Breadcrumb link back to teachers list
    await expect(page.locator('a[href="/teachers"]').first()).toBeVisible()
  })
})
