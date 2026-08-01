import { test, expect } from '@playwright/test'

test.describe('Sleep timer countdown', () => {
  test('shows a clickable countdown overlay that cancels the timer', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Sleep timer', exact: true }).click()
    await page.getByRole('button', { name: '5m', exact: true }).click()

    const overlay = page.getByRole('dialog', { name: 'Sleep timer active' })
    await expect(overlay).toBeVisible()
    await expect(overlay.getByText(/^\d{2}:\d{2}$/)).toBeVisible()

    // Regression guard: the countdown overlay must sit above the album art
    // (z-10, absolute-positioned via next/image `fill`) in stacking order,
    // or this click times out with a pointer-interception error even though
    // the button is technically "visible" in the accessibility tree.
    await overlay.getByRole('button', { name: 'Cancel sleep timer' }).click()

    await expect(overlay).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Sleep timer', exact: true })).toBeVisible()
  })
})
