import { test as setup } from '@playwright/test'

setup('authenticate', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[type="email"]', 'mindnavy@gmail.com')
  await page.fill('input[type="password"]', 'Mindnavy@12345678')
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard/)
  await page.context().storageState({
    path: 'tests/setup/.auth.json',
  })
})
