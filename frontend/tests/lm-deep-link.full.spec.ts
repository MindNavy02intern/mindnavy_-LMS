import { test, expect } from '@playwright/test'

// Verifies that navigating directly to /learning-management?tab=<key> lands
// on the correct tab without clicking — the URL is the single source of truth.

test('Deep link ?tab=courses renders Courses tab directly', async ({ page }) => {
  await page.goto('/learning-management?tab=courses')
  await expect(page).toHaveURL(/[?&]tab=courses/)
  await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible({ timeout: 15000 })
})

test('Deep link ?tab=overview renders Overview tab directly', async ({ page }) => {
  await page.goto('/learning-management?tab=overview')
  await expect(page).toHaveURL(/[?&]tab=overview/)
  await expect(page.getByRole('heading', { name: 'Recent Courses' })).toBeVisible({ timeout: 15000 })
})
