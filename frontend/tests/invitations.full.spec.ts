import { test, expect, type Page } from '@playwright/test'

function uid() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`
}

async function gotoInvitations(page: Page) {
  await page.goto('/users')
  await page.getByRole('button', { name: 'Invitations' }).click()
}

test.describe.serial('Invitation lifecycle', () => {
  const email = `invite.${uid()}@mindnavy.com`

  test('Send Invitation → verify appears in table', async ({ page }) => {
    await gotoInvitations(page)
    await page.getByRole('button', { name: 'Send Invitation', exact: true }).click()
    await page.getByPlaceholder('user@example.com').fill(email)
    const roleSelect = page.locator('select:has(option:text-is("Select a role…"))')
    await expect(async () => {
      expect(await roleSelect.locator('option').count()).toBeGreaterThan(1)
    }).toPass({ timeout: 10000 })
    // Must be one of the 4 system roles — backend invitations.service.js
    // rejects anything else with "Invalid role" (400). This dropdown lists
    // every Role record including custom test roles, so an arbitrary index
    // is unsafe once those accumulate.
    await roleSelect.selectOption({ label: 'Instructor' })
    const sendPromise = page.waitForResponse(resp => resp.url().includes('/invitations') && resp.request().method() === 'POST')
    await page.getByRole('button', { name: '✉ Send Invitation', exact: true }).click()
    const sendResp = await sendPromise
    expect(sendResp.ok()).toBeTruthy() // surface backend errors here, not as a confusing "row not found" later
    await gotoInvitations(page)
    await expect(page.locator('tr', { hasText: email })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: email })).toContainText('Pending')
  })

  test('Resend Invitation → verify success toast', async ({ page }) => {
    await gotoInvitations(page)
    const row = page.locator('tr', { hasText: email })
    await row.getByRole('button', { name: '✉ Resend', exact: true }).click()
    await expect(page.getByText(/resent/i)).toBeVisible({ timeout: 10000 })
  })

  test('Change Expiry → verify date updates', async ({ page }) => {
    await gotoInvitations(page)
    const row = page.locator('tr', { hasText: email })
    await row.getByRole('button', { name: 'Change Expiry', exact: true }).click()
    const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
    await row.locator('input[type="date"]').fill(future)
    await row.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(
      page.getByText(/expiry updated|date updated|saved/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('Cancel Invitation → verify status changes', async ({ page }) => {
    await gotoInvitations(page)
    const row = page.locator('tr', { hasText: email })
    await row.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByText('Cancel this invitation?')).toBeVisible()
    await row.getByRole('button', { name: 'Yes, cancel', exact: true }).click()
    await expect(page.getByText(/cancelled/i)).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: email })).toContainText('Revoked')
  })
})

test('Filter by Status → verify correct items shown', async ({ page }) => {
  await gotoInvitations(page)
  const statusFilter = page.locator('select:has(option:text-is("Revoked"))')
  await expect(statusFilter).toHaveCount(1)
  const listPromise = page.waitForResponse(resp => resp.url().includes('/invitations') && resp.request().method() === 'GET')
  await statusFilter.selectOption('pending')
  await listPromise
  await page.waitForTimeout(300)
  const rows = page.locator('tbody tr')
  const count = await rows.count()
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText('Pending')
  }
})
