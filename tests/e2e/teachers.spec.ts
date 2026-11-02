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
    const countLabel = page.locator('p[aria-live="polite"]')
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

  test('switching teacher from the panel does not replay the panel enter animation', async ({ page }) => {
    await page.goto('/teachers')
    // The grid cards are plain links (full-page nav); the "Recommended" row uses
    // TeacherModalLink, which opens the side panel.
    const recommended = page.getByRole('region', { name: 'Recommended teachers' })
    await recommended.getByRole('button').first().click()
    const panel = page.getByRole('dialog', { name: 'Teacher profile' })
    await expect(panel).toBeVisible()

    // First open slides in.
    await expect.poll(() => panel.evaluate((el) => getComputedStyle(el).animationName)).toContain('slide-in')

    const firstHeading = (await panel.getByRole('heading', { level: 2 }).first().textContent())?.trim()
    const firstUrl = page.url()
    const related = panel.getByText('Also on Reach Radio').locator('xpath=following-sibling::div//button').first()
    await related.click()
    await expect(page).not.toHaveURL(firstUrl)
    await expect(panel.getByRole('heading', { level: 2 }).first()).not.toHaveText(firstHeading ?? '')

    // The chrome remounts with the per-slug page, so node identity is not
    // preserved; what matters is that the slide-in does not replay.
    const swapped = page.getByRole('dialog', { name: 'Teacher profile' })
    await expect(swapped).toBeVisible()
    expect(await swapped.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
    expect(await swapped.evaluate((el) => el.getAnimations().length)).toBe(0)
  })
})
