import { test, expect } from '@playwright/test'

test.describe('Not found', () => {
  test('unmatched path renders the 404 page and is noindex', async ({ page }) => {
    await page.goto('/not-a-page')
    await expect(page.getByText('This page could not be found')).toBeVisible()
    await expect(page.locator('meta[name="robots"][content="noindex"]')).not.toHaveCount(0)
  })

  test('teacher modal still opens and closes after soft navigation', async ({ page }) => {
    await page.goto('/teachers')
    await page.waitForSelector('a[href^="/teachers/"]', { timeout: 10000 })
    const card = page.locator('a[href^="/teachers/"]').first()
    const href = await card.getAttribute('href')
    await card.click()
    await expect(page).toHaveURL(href as string)
    await expect(page.getByRole('dialog', { name: 'Teacher profile' })).toBeVisible()
    await expect(page.getByText('This page could not be found')).toHaveCount(0)

    await page.goBack()
    await expect(page).toHaveURL('/teachers')
    await expect(page.getByRole('dialog', { name: 'Teacher profile' })).toHaveCount(0)
  })
})
