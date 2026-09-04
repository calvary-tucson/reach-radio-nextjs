// tests/e2e/donate.spec.ts
import { test, expect } from '@playwright/test'
import { PUSHPAY_GIVING_URL } from '@/lib/donate/cta'

test.describe('Donate', () => {
  // Locate by destination, not accessible name: on web, Header.tsx also
  // renders a "Donate" nav link to /donate on this same page, so
  // getByRole('link', { name: 'Donate' }) resolves to two elements and
  // throws under Playwright's strict mode. The exact href is unique to
  // the CTA in both web and in-app contexts.
  const ctaLocator = (page: import('@playwright/test').Page) =>
    page.locator(`a[href="${PUSHPAY_GIVING_URL}"]`)

  test('donate page renders with a keyboard-focusable CTA', async ({ page }) => {
    await page.goto('/donate')
    await expect(page.locator('h1', { hasText: 'Donate' })).toBeVisible()

    const cta = ctaLocator(page)
    await cta.focus()
    await expect(cta).toBeFocused()
  })

  test('donate CTA opens PushPay in a new tab on web', async ({ page }) => {
    await page.goto('/donate')
    const cta = ctaLocator(page)
    await expect(cta).toHaveAttribute('target', '_blank')
    await expect(cta).toHaveAttribute('href', /pushpay/i)
  })

  test('donate CTA omits target in-app', async ({ page, context }) => {
    await context.addCookies([{ name: 'mobile-app', value: 'true', url: 'http://localhost:3000' }])
    await page.goto('/donate')
    const cta = ctaLocator(page)
    await expect(cta).not.toHaveAttribute('target', '_blank')
  })

  test('thank-you page renders a Listen link back to home', async ({ page }) => {
    await page.goto('/donate/thank-you')
    // Scoped to main content: the persistent nav also has a "Listen" link
    // (bottom/primary nav), so an unscoped getByRole match resolves to two
    // elements under Playwright's strict mode.
    const listen = page.getByRole('main').getByRole('link', { name: 'Listen' })
    await expect(listen).toBeVisible()
    await expect(listen).toHaveAttribute('href', '/')
  })
})
