import { test, expect } from '@playwright/test'

test.describe('Teachers', () => {
  test('teachers page loads with grid', async ({ page }) => {
    await page.goto('/teachers')
    await expect(page.locator('h1', { hasText: 'Teachers' })).toBeVisible()
    await page.waitForSelector('a[href^="/teachers/"]', { timeout: 10000 })
    const cards = page.locator('a[href^="/teachers/"]')
    await expect(cards.first()).toBeVisible()
  })

  test('live search filters teachers without page navigation', async ({ page }) => {
    await page.goto('/teachers')
    await page.waitForSelector('a[href^="/teachers/"]', { timeout: 10000 })

    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeVisible()

    await searchInput.fill('Jack')
    // Wait for debounce (200ms) + buffer
    await page.waitForTimeout(400)

    // URL updates without navigation
    await expect(page).toHaveURL(/\/teachers\?q=Jack/)

    // Count label updates
    const countLabel = page.locator('[aria-live="polite"]')
    await expect(countLabel).toContainText('of')

    // Clearing search restores all teachers
    await searchInput.fill('')
    await page.waitForTimeout(400)
    await expect(page).toHaveURL('/teachers')
  })

  test('/teachers/search redirects to /teachers preserving query', async ({ page }) => {
    await page.goto('/teachers/search?q=john')
    await expect(page).toHaveURL(/\/teachers\?q=john/)
  })

  test('teacher detail page loads', async ({ page }) => {
    await page.goto('/teachers')
    await page.waitForSelector('a[href^="/teachers/"]', { timeout: 10000 })
    const firstCard = page.locator('a[href^="/teachers/"]').first()
    await firstCard.click()
    await expect(page.locator('h1')).toBeVisible()
    // Back link navigates to /teachers
    await expect(page.locator('a[href="/teachers"]').first()).toBeVisible()
  })
})
