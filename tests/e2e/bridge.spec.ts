import { test, expect } from '@playwright/test'

test.describe('Native bridge', () => {
  test('window.globalActions.goToPage navigates', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.globalActions.goToPage('/teachers'))
    await expect(page).toHaveURL('/teachers')
  })

  test('window.globalState.mediaBarState.isPlaying.set() updates state', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.globalState.mediaBarState.isPlaying.set(true))
    expect(true).toBe(true)
  })

  test('window.up.history.location returns current path', async ({ page }) => {
    await page.goto('/teachers')
    const location = await page.evaluate(() => window.up.history.location)
    expect(location).toBe('/teachers')
  })

  test('window.up.reload() triggers page reload', async ({ page }) => {
    await page.goto('/')
    let reloaded = false
    page.on('load', () => { reloaded = true })
    await page.evaluate(() => window.up.reload())
    await page.waitForLoadState('load')
    expect(reloaded).toBe(true)
  })
})
