import { test, expect } from '@playwright/test'

test('Login page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('Login with valid credentials', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[type="email"]', 'mindnavy@gmail.com')
  await page.fill('input[type="password"]', '12345@1234')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/dashboard/)
})

test('Login with wrong password shows error', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[type="email"]', 'mindnavy@gmail.com')
  await page.fill('input[type="password"]', 'wrongpassword')
  await page.click('button[type="submit"]')
  await expect(page.locator('text=Invalid')).toBeVisible()
})
