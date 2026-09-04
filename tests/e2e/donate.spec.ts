// tests/e2e/donate.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Donate', () => {
  // Locate by destination, not accessible name: on web, Header.tsx also
  // renders a "Donate" nav link to /donate on this same page, so
  // getByRole('link', { name: 'Donate' }) resolves to two elements and
  // throws under Playwright's strict mode. The href prefix is unique to
  // the CTA in both web and in-app contexts.
  const ctaLocator = (page: import('@playwright/test').Page) =>
    page.locator('a[href^="https://pushpay.com"]')

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

  test('Follow on Facebook is hidden on web, shown in-app', async ({ page, context }) => {
    await page.goto('/donate/thank-you')
    await expect(page.getByRole('link', { name: /Follow on Facebook/ })).toHaveCount(0)

    await context.addCookies([{ name: 'mobile-app', value: 'true', url: 'http://localhost:3000' }])
    await page.goto('/donate/thank-you')
    await expect(page.getByRole('link', { name: /Follow on Facebook/ })).toBeVisible()
  })

  test('Listen closes the opener tab when one exists', async ({ page }) => {
    await page.addInitScript(() => {
      // simulates a tab opened via window.open/target=_blank
      window.opener = {}
      window.close = () => {
        // @ts-expect-error test shim
        window.__closeCalled = true
      }
    })
    await page.goto('/donate/thank-you')
    await page.getByRole('button', { name: 'Listen' }).click()
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __closeCalled?: boolean }).__closeCalled))
      .toBe(true)
  })

  test('Listen falls back to a plain link when window.close() is refused', async ({ page }) => {
    await page.addInitScript(() => {
      window.opener = {}
      // simulates the browser silently refusing to close
      window.close = () => {}
    })
    await page.goto('/donate/thank-you')
    await page.getByRole('button', { name: 'Listen' }).click()
    await expect(page.getByRole('link', { name: 'Listen' })).toBeVisible({ timeout: 1000 })
  })
})
