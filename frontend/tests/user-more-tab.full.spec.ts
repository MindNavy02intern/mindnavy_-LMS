import { type Page, test, expect } from '@playwright/test'

// User Details Drawer — More tab, all 6 tiles (DEFERRED_ITEMS.md Users item,
// Fix 2). Real backend throughout — a disposable user is created via the
// real API. Devices & Sessions shows AppUserSession (not TrustedDevice/
// AdminUser's own devices — see UserMoreTab.tsx's header comment), so a
// freshly-created user legitimately has zero sessions until they actually
// log in, which this admin-console suite cannot simulate.
//
// Run with: npx playwright test user-more-tab.full --workers=1

const API = 'http://localhost:5001/api/admin'

let savedToken: string | null = null
let userId: string | null = null
let userEmail: string | null = null

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/users')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()
  if (!savedToken) return

  const stamp = Date.now()
  userEmail = `qa.users.moretab.${stamp}@example.com`
  const resp = await request.post(`${API}/users`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: { fullName: `QA More Tab User ${stamp}`, email: userEmail, password: 'Qatest!2345678', role: 'LEARNER', status: 'ACTIVE' },
  })
  const body = await resp.json().catch(() => null)
  userId = body?.user?.id ?? null
})

test.afterAll(async ({ request }) => {
  if (!savedToken || !userId) return
  const H = { Authorization: `Bearer ${savedToken}` }
  await request.delete(`${API}/users/${userId}`, { headers: H }).catch(() => null)
  await request.delete(`${API}/users/${userId}/permanent`, { headers: H }).catch(() => null)
})

async function openMoreTile(page: Page, tileName: string) {
  await page.goto('/users')
  const row = page.locator('tr', { hasText: userEmail as string })
  await row.locator('button[title="View"]').click()
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: tileName }).click()
}

test('Competencies tile shows empty state for an unassessed user', async ({ page }) => {
  test.skip(!userId, 'Setup user was not created — backend may be unavailable')
  await openMoreTile(page, 'Competencies')
  await expect(page.getByText('No competencies assessed yet')).toBeVisible({ timeout: 10000 })
})

test('Security Logs tile shows the user-creation audit entry', async ({ page }) => {
  test.skip(!userId, 'Setup user was not created — backend may be unavailable')
  await openMoreTile(page, 'Security Logs')
  // createUser dual-writes details.userId -> the indexed targetUserId column,
  // so GET /reports/audit?userId=<id> finds it even though the ADMIN, not
  // this user, performed the action.
  await expect(page.getByText(/USER CREATED/i)).toBeVisible({ timeout: 10000 })
})

test('Devices & Sessions tile shows empty state for a user who never logged in', async ({ page }) => {
  test.skip(!userId, 'Setup user was not created — backend may be unavailable')
  await openMoreTile(page, 'Devices & Sessions')
  await expect(page.getByText('No login sessions found')).toBeVisible({ timeout: 10000 })
})

test('Notes tile: add a note, see it listed, then delete it', async ({ page }) => {
  test.skip(!userId, 'Setup user was not created — backend may be unavailable')
  await openMoreTile(page, 'Notes')
  await expect(page.getByText('No notes yet')).toBeVisible({ timeout: 10000 })

  const noteText = `QA note ${Date.now()}`
  await page.getByPlaceholder('Add an internal note about this user…').fill(noteText)
  const [addResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/users/${userId}/notes`) && r.request().method() === 'POST', { timeout: 15000 }),
    page.getByRole('button', { name: 'Add Note' }).click(),
  ])
  expect(addResp.ok()).toBeTruthy()
  await expect(page.getByText(noteText)).toBeVisible({ timeout: 10000 })

  const [deleteResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/users/${userId}/notes/`) && r.request().method() === 'DELETE', { timeout: 15000 }),
    page.getByRole('button', { name: 'Delete' }).click(),
  ])
  expect(deleteResp.ok()).toBeTruthy()
  await expect(page.getByText(noteText)).not.toBeVisible({ timeout: 10000 })
  await expect(page.getByText('No notes yet')).toBeVisible({ timeout: 10000 })
})

test('Preferences tile: toggling Email and saving persists on reload', async ({ page }) => {
  test.skip(!userId, 'Setup user was not created — backend may be unavailable')
  await openMoreTile(page, 'Preferences')

  const emailSwitch = page.getByRole('switch', { name: 'Email' })
  await expect(emailSwitch).toHaveAttribute('aria-checked', 'true', { timeout: 10000 })
  await emailSwitch.click()
  await expect(emailSwitch).toHaveAttribute('aria-checked', 'false')

  const [saveResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/notifications/preferences/${userId}`) && r.request().method() === 'PATCH', { timeout: 15000 }),
    page.getByRole('button', { name: 'Save' }).click(),
  ])
  expect(saveResp.ok()).toBeTruthy()
  await expect(page.getByText('Preferences updated.')).toBeVisible({ timeout: 10000 })

  // Reload the tile fresh — reflects the real DB value, not local state.
  await openMoreTile(page, 'Preferences')
  await expect(page.getByRole('switch', { name: 'Email' })).toHaveAttribute('aria-checked', 'false', { timeout: 10000 })
})

test('Consent & Privacy tile: export downloads JSON and deletion request sends', async ({ page }) => {
  test.skip(!userId, 'Setup user was not created — backend may be unavailable')
  await openMoreTile(page, 'Consent & Privacy')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export User Data (JSON)' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain(userId as string)

  await page.getByRole('button', { name: 'Request Account Deletion' }).click()
  await expect(page.getByRole('heading', { name: 'Request Account Deletion' })).toBeVisible({ timeout: 5000 })
  const [reqResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/users/${userId}/request-deletion`) && r.request().method() === 'POST', { timeout: 15000 }),
    page.getByRole('button', { name: 'Send Request' }).click(),
  ])
  expect(reqResp.ok()).toBeTruthy()
  await expect(page.getByText(/deletion request sent/i)).toBeVisible({ timeout: 10000 })
})
