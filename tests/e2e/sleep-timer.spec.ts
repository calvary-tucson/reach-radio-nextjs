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

  test('media bar shows a sleep timer indicator once the player scrolls out of view', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Sleep timer', exact: true }).click()
    await page.getByRole('button', { name: '5m', exact: true }).click()

    // Wait for BottomSheet's close animation to finish: it holds
    // `document.body.style.overflow = 'hidden'` until ~280ms after close and
    // then calls `triggerRef.current?.focus()` (no preventScroll), which
    // scrolls the trigger back into view. Scrolling before this settles races
    // with that focus-restore and the scroll gets partially reverted.
    await expect(page.getByRole('dialog', { name: 'Sleep timer', exact: true })).not.toBeVisible()

    // Scroll the on-page player out of view so RadioPlayer's IntersectionObserver
    // flips showMediaBar to true and the bottom MediaBar takes over.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    const indicator = page.getByRole('region', { name: 'Media player' }).getByRole('button', { name: /sleep timer active/i })
    await expect(indicator).toBeVisible()

    await indicator.click()
    const sheet = page.getByRole('dialog', { name: 'Sleep timer', exact: true })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('button', { name: /pause/i })).toBeVisible()
  })
})
