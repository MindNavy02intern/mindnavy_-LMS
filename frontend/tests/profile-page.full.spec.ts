import { test, expect } from '@playwright/test'

// Profile Page self-service (DEFERRED_ITEMS.md Users item, Fix 3).
//
// Change Password intentionally does NOT exercise a real successful
// submission here: the backend revokes every AdminSession on a password
// change (same rule resetAdminPassword already applies), including the one
// baked into tests/setup/.auth.json. Since the whole suite is run
// --workers=1 against ONE shared admin login snapshot, actually completing
// a change-password flow would invalidate that snapshot's token and 401
// every test that runs after this file. This file covers the Edit Profile
// success path (harmless — no session impact) and the Change Password
// validation/error paths only (weak password, mismatch, wrong current
// password) — none of which touch a real passwordHash or session.
//
// Run with: npx playwright test profile-page.full --workers=1

test('Edit Profile: update name/phone/bio and see it reflected', async ({ page }) => {
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'Edit Profile' }).click()

  const stamp = Date.now()
  const newBio = `QA bio ${stamp}`
  const newPhone = `+1555${stamp.toString().slice(-7)}`

  await page.getByLabel('Phone').fill(newPhone)
  await page.getByLabel('Bio').fill(newBio)

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/me') && r.request().method() === 'PATCH', { timeout: 15000 }),
    page.getByRole('button', { name: 'Save Changes' }).click(),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText('Profile updated.')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(newPhone)).toBeVisible()
  await expect(page.getByText(newBio)).toBeVisible()

  // Reload — GET /me must reflect the same fields (auth.middleware's whitelist
  // includes phone/bio, not just the write path).
  await page.reload()
  await expect(page.getByText(newPhone)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(newBio)).toBeVisible()
})

test('Change Password: rejects a weak new password client-side', async ({ page }) => {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Change Password' }).click()
  await page.getByLabel('Current Password').fill('whatever-current')
  await page.getByLabel('New Password').fill('short1A!')
  await page.getByLabel('Confirm New Password').fill('short1A!')
  await page.getByRole('button', { name: 'Change Password', exact: true }).last().click()
  await expect(page.getByText(/at least 12 characters/i)).toBeVisible({ timeout: 5000 })
})

test('Change Password: rejects mismatched confirmation', async ({ page }) => {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Change Password' }).click()
  await page.getByLabel('Current Password').fill('whatever-current')
  await page.getByLabel('New Password').fill('ValidPass123!ABC')
  await page.getByLabel('Confirm New Password').fill('ValidPass123!XYZ')
  await page.getByRole('button', { name: 'Change Password', exact: true }).last().click()
  await expect(page.getByText('Passwords do not match.')).toBeVisible({ timeout: 5000 })
})

test('Change Password: backend rejects an incorrect current password', async ({ page }) => {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Change Password' }).click()
  await page.getByLabel('Current Password').fill('definitely-the-wrong-password')
  await page.getByLabel('New Password').fill('ValidPass123!ABC')
  await page.getByLabel('Confirm New Password').fill('ValidPass123!ABC')

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/change-password') && r.request().method() === 'POST', { timeout: 15000 }),
    page.getByRole('button', { name: 'Change Password', exact: true }).last().click(),
  ])
  // A wrong current password fails BEFORE any passwordHash/session write —
  // safe to exercise for real against the shared admin account.
  expect(resp.status()).toBe(400)
  await expect(page.getByText('Current password is incorrect.')).toBeVisible({ timeout: 10000 })
})
