import { expect, test } from '@playwright/test'

test.describe('Frontend', () => {
  test('can go on homepage', async ({ page }) => {
    await page.goto('http://localhost:3000')

    await expect(page).toHaveTitle(/HYGE Content Platform/)

    const heading = page.locator('h1').first()

    await expect(heading).toHaveText('HYGE Content Platform')
  })
})
