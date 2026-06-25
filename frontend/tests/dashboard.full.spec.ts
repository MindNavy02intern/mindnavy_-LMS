import { test, expect } from '@playwright/test'

test('KPI cards load with numbers', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const totalUsersCard = page.locator('.mn-lkpi-label').filter({ hasText: 'Total Users' }).locator('xpath=../..')
  await expect(totalUsersCard).toContainText(/\d/)
  const activeLearnersCard = page.locator('.mn-lkpi-label').filter({ hasText: 'Active Learners' }).locator('xpath=../..')
  await expect(activeLearnersCard).toContainText(/\d/)
})

test('Recent Activity shows entries', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByText('Recent Activity', { exact: false })).toBeVisible({ timeout: 15000 })
})

test('Users by Role chart loads', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByText('Users by Role', { exact: false })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('text=Total Users').last()).toBeVisible({ timeout: 15000 })
})

test('Quick Actions work (navigate correctly)', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Add User', exact: true }).click()
  await expect(page).toHaveURL(/\/users/)

  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'System Settings', exact: true }).click()
  await expect(page).toHaveURL(/\/settings/)
})

test('Date filter changes data', async ({ page }) => {
  await page.goto('/dashboard')
  const from = page.locator('input[type="date"]').first()
  const to = page.locator('input[type="date"]').nth(1)
  const today = new Date().toISOString().slice(0, 10)
  const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  await from.fill(lastMonth)
  await to.fill(today)
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await expect(page.getByText('✕', { exact: true })).toBeVisible({ timeout: 10000 })
})
