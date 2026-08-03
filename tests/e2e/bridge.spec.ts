import { test, expect } from '@playwright/test'

declare global {
  interface Window {
    __nativeMessages: Record<string, unknown>[]
  }
}

function dispatchNativeCommand(page: import('@playwright/test').Page, detail: Record<string, unknown>) {
  return page.evaluate((d) => {
    window.dispatchEvent(new CustomEvent('nativeCommand', { detail: d }))
  }, detail)
}

function mockNativeBridge(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    window.__nativeMessages = []
    window.webkit = {
      messageHandlers: {
        messageHandler: {
          postMessage: (msg: string) => {
            window.__nativeMessages.push(JSON.parse(msg))
          },
        },
      },
    }
  })
}

function nativeMessages(page: import('@playwright/test').Page) {
  return page.evaluate(() => window.__nativeMessages)
}

test.describe('Native bridge', () => {
  test('nativeCommand navigate dispatches router.push', async ({ page }) => {
    await mockNativeBridge(page)
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'navigate', path: '/teachers' })
    await expect(page).toHaveURL('/teachers')
  })

  test('nativeCommand setPlayState updates media store', async ({ page }) => {
    await mockNativeBridge(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Play radio' })).toBeVisible()
    await dispatchNativeCommand(page, { type: 'setPlayState', playing: true })
    await expect(page.getByRole('button', { name: 'Pause radio' })).toBeVisible()
  })

  test('nativeCommand setBuffering updates media store', async ({ page }) => {
    await mockNativeBridge(page)
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'setBuffering', buffering: true })
    // Two PlayPauseButtons can render at once (RadioPlayer's + the global
    // MediaBar's) — scope to RadioPlayer's region to avoid a strict-mode
    // violation from the duplicate role/name.
    await expect(
      page.getByRole('region', { name: 'Radio player' }).getByRole('status', { name: 'Buffering' })
    ).toBeVisible()
  })

  test('nativeCommand refresh calls router.refresh', async ({ page }) => {
    await mockNativeBridge(page)
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'refresh' })
    // refreshComplete fires from a useTransition completion effect after the
    // RSC refetch resolves, not synchronously with the command — poll for it.
    // Default 5s timeout is too tight in dev mode (Turbopack HMR overhead
    // pushes the RSC round-trip past it); give it more room.
    await expect.poll(async () => {
      const messages = await nativeMessages(page)
      return messages.some((m) => m.refreshComplete === true)
    }, { timeout: 15000 }).toBe(true)
  })

  test('nativeCommand openSleepTimerSheet opens the sleep timer sheet', async ({ page }) => {
    await mockNativeBridge(page)
    await page.goto('/')
    await dispatchNativeCommand(page, { type: 'openSleepTimerSheet' })
    await expect(page.getByRole('dialog', { name: 'Sleep timer' })).toBeVisible()
  })
})
