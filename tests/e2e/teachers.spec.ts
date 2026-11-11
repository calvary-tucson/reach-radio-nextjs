import { test, expect, type Locator, type Page } from '@playwright/test'

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

  async function openPanel(page: Page) {
    await page.goto('/teachers')
    // The grid cards are plain links (full-page nav); the "Recommended" row uses
    // TeacherModalLink, which opens the side panel.
    const recommended = page.getByRole('region', { name: 'Recommended teachers' })
    await recommended.getByRole('button').first().click()
    const panel = page.getByRole('dialog', { name: 'Teacher profile' })
    await expect(panel).toBeVisible()
    return panel
  }

  async function swapTeacher(page: Page, panel: Locator) {
    const related = panel.getByText('Also on Reach Radio').locator('xpath=following-sibling::div//button').first()
    await related.click()
  }

  const visibleBack = (page: Page) => page.getByRole('button', { name: 'Back' }).filter({ visible: true })

  test('swapping teacher keeps the panel shell mounted, slides content and Back restores', async ({ page }) => {
    const panel = await openPanel(page)
    const shell = await panel.elementHandle()
    const firstHeading = (await panel.getByRole('heading', { level: 2 }).first().textContent())?.trim()
    const firstUrl = page.url()

    // Back is hidden (aria-hidden + inert) at the root.
    await expect(visibleBack(page)).toHaveCount(0)

    await page.evaluate(() => {
      const w = window as unknown as { __ghostSeen: boolean }
      w.__ghostSeen = false
      new MutationObserver(() => {
        if (document.querySelector('[data-panel-ghost]')) w.__ghostSeen = true
      }).observe(document.body, { childList: true, subtree: true })
    })
    await swapTeacher(page, panel)
    await expect(page).not.toHaveURL(firstUrl)
    await expect(panel.getByRole('heading', { level: 2 }).first()).not.toHaveText(firstHeading ?? '')

    // Same dialog node: the shell never remounts on a swap.
    expect(await shell!.evaluate((el) => el.isConnected)).toBe(true)
    expect(await page.getByRole('dialog', { name: 'Teacher profile' }).elementHandle().then((h) => h!.evaluate((el, s) => el === s, shell))).toBe(true)

    // With motion enabled a ghost of the outgoing content was shown during the slide.
    expect(await page.evaluate(() => (window as unknown as { __ghostSeen: boolean }).__ghostSeen)).toBe(true)

    // Back button appears (no aria-hidden) and no ghost remains after settling.
    await expect(visibleBack(page)).toHaveCount(1)
    await expect(page.locator('[data-panel-ghost]')).toHaveCount(0)

    // Back restores the URL and the first heading, then hides again at root.
    await visibleBack(page).first().click()
    await expect(page).toHaveURL(firstUrl)
    await expect(panel.getByRole('heading', { level: 2 }).first()).toHaveText(firstHeading ?? '')
    await expect(page.locator('[data-panel-ghost]')).toHaveCount(0)
    await expect(visibleBack(page)).toHaveCount(0)
    expect(await shell!.evaluate((el) => el.isConnected)).toBe(true)
  })

  test('reduced motion: swap completes with no ghost and no animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const panel = await openPanel(page)
    const firstHeading = (await panel.getByRole('heading', { level: 2 }).first().textContent())?.trim()
    await page.evaluate(() => {
      const w = window as unknown as { __ghostSeen: boolean }
      w.__ghostSeen = false
      new MutationObserver(() => {
        if (document.querySelector('[data-panel-ghost]')) w.__ghostSeen = true
      }).observe(document.body, { childList: true, subtree: true })
    })
    await swapTeacher(page, panel)
    await expect(panel.getByRole('heading', { level: 2 }).first()).not.toHaveText(firstHeading ?? '')
    expect(await page.evaluate(() => (window as unknown as { __ghostSeen: boolean }).__ghostSeen)).toBe(false)
    await expect(page.locator('[data-panel-ghost]')).toHaveCount(0)
  })

  test('swap resets scroll to the top; no animations replay after settling (swap and Back)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 420 })
    const panel = await openPanel(page)
    await expect(panel.getByText('Also on Reach Radio')).toBeVisible()
    const live = panel.locator('[data-panel-content]')
    const firstUrl = page.url()
    const scrolled = await live.evaluate((el) => { el.scrollTop = el.scrollHeight; return el.scrollTop })
    expect(scrolled).toBeGreaterThan(0)

    await swapTeacher(page, panel)
    await expect(page).not.toHaveURL(firstUrl)
    await expect(page.locator('[data-panel-ghost]')).toHaveCount(0)
    expect(await live.evaluate((el) => el.scrollTop)).toBe(0)
    // Nothing running on the dialog shell once settled (no replay from Next hide/un-hide).
    expect(await panel.evaluate((el) => el.getAnimations({ subtree: false }).filter((a) => a.playState === 'running').length)).toBe(0)

    await visibleBack(page).first().click()
    await expect(page).toHaveURL(firstUrl)
    await expect(page.locator('[data-panel-ghost]')).toHaveCount(0)
    expect(await panel.evaluate((el) => el.getAnimations({ subtree: false }).filter((a) => a.playState === 'running').length)).toBe(0)
  })

  test('mobile sheet sizes to its content (stage does not collapse the panel)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const panel = await openPanel(page)
    await expect(panel.getByRole('heading', { level: 2 }).first()).toBeVisible()
    const box = await panel.boundingBox()
    expect(box!.height).toBeGreaterThan(400)
  })
})
