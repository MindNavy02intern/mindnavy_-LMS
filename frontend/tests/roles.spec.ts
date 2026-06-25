import { test, expect } from '@playwright/test'

test('Roles page loads', async ({ page }) => {
  await page.goto('/roles-permissions')
  await expect(page.getByRole('heading', { name: 'Roles & Permissions' })).toBeVisible()
})

test('Create Role button exists', async ({ page }) => {
  await page.goto('/roles-permissions')
  await expect(page.locator('text=Create Role')).toBeVisible()
})
