import { test, expect } from '@playwright/test'

// Verifies that navigating directly to /roles-permissions?tab=<key> lands on
// the correct tab without clicking — the URL is the single source of truth.

test('Deep link ?tab=roles renders LMS Roles tab directly', async ({ page }) => {
  await page.goto('/roles-permissions?tab=roles')
  await expect(page).toHaveURL(/[?&]tab=roles/)
  // LMS Roles tab renders the roles table toolbar (search input)
  await expect(page.getByPlaceholder('Search roles...')).toBeVisible({ timeout: 15000 })
})

test('Deep link ?tab=templates renders Role Templates tab directly', async ({ page }) => {
  await page.goto('/roles-permissions?tab=templates')
  await expect(page).toHaveURL(/[?&]tab=templates/)
  await expect(page.getByRole('button', { name: 'Create Template', exact: true })).toBeVisible({ timeout: 15000 })
})

test('Deep link ?tab=assignments renders User Role Assignments tab directly', async ({ page }) => {
  await page.goto('/roles-permissions?tab=assignments')
  await expect(page).toHaveURL(/[?&]tab=assignments/)
  await expect(page.getByPlaceholder('Search by name or email...')).toBeVisible({ timeout: 15000 })
})

test('Deep link ?tab=policies renders Access Policies tab directly', async ({ page }) => {
  await page.goto('/roles-permissions?tab=policies')
  await expect(page).toHaveURL(/[?&]tab=policies/)
  await expect(page.getByRole('button', { name: 'Create Policy', exact: true })).toBeVisible({ timeout: 15000 })
})
