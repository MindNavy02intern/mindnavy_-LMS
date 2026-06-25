import { test, expect } from '@playwright/test'

test('Users page loads', async ({ page }) => {
  await page.goto('/users')
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()
})

test('Add User button exists', async ({ page }) => {
  await page.goto('/users')
  await expect(page.locator('text=Add User')).toBeVisible()
})

test('Search users works', async ({ page }) => {
  await page.goto('/users')
  await page.fill('input[placeholder*="Search"]', 'bilal')
  await page.waitForTimeout(500)
  await expect(page.locator('table')).toBeVisible()
})
