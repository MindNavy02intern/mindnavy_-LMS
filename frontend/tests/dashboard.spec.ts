import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard')
})

test('Dashboard loads', async ({ page }) => {
  await expect(page.locator('h1.mn-db-welcome-title')).toBeVisible()
})

test('Total Users KPI shows', async ({ page }) => {
  await expect(page.locator('.mn-lkpi-label').filter({ hasText: 'Total Users' }).first()).toBeVisible()
})

test('Sidebar navigation works', async ({ page }) => {
  await page.click('text=User Management')
  await expect(page).toHaveURL(/users/)
})
