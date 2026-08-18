import { test, expect } from '@playwright/test'

// System Settings module — full stack (Parts 1-4). Real backend throughout
// (no route mocking). See backend/contact md files/SYSTEM_SETTINGS_CONTRACT.md
// for the endpoint shapes.
//
// Run with: npx playwright test system-settings.full --workers=1
//
// CLEANUP NOTE: SystemSettings is a single shared row (same singleton
// pattern as FinanceSettings/CompetencySettings) — every admin sees the same
// data, so this suite must leave it exactly as it found it. beforeAll
// captures the full row via GET; afterAll PATCHes every scalar field back
// and explicitly restores maintenanceMode (enable/disable are dedicated
// endpoints, not covered by the generic PATCH), regardless of which tests
// ran or failed.

const API = 'http://localhost:5001/api/admin'

let savedToken: string | null = null
let original: Record<string, unknown> | null = null

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/settings')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()
  if (!savedToken) return

  const resp = await request.get(`${API}/system-settings`, { headers: { Authorization: `Bearer ${savedToken}` } })
  const body = await resp.json().catch(() => null)
  original = body?.data ?? null
})

test.afterAll(async ({ request }) => {
  if (!savedToken || !original) return
  const H = { Authorization: `Bearer ${savedToken}` }

  // Strip read-only/derived fields — everything else PATCHes straight back.
  const {
    id, createdAt, updatedAt, updatedById, lastBackupAt,
    smtpConfigured, storageConfigured, maintenanceMode,
    ...restorable
  } = original as Record<string, unknown>
  void id; void createdAt; void updatedAt; void updatedById; void lastBackupAt; void smtpConfigured; void storageConfigured

  await request.patch(`${API}/system-settings`, { headers: H, data: restorable }).catch(() => null)

  // Maintenance mode has its own endpoints — restore it explicitly to
  // whatever it originally was, independent of the generic PATCH above.
  if (maintenanceMode) {
    await request.post(`${API}/system-settings/maintenance/enable`, {
      headers: H,
      data: { message: original.maintenanceMessage ?? null, scheduledAt: original.scheduledMaintenanceAt ?? null },
    }).catch(() => null)
  } else {
    await request.post(`${API}/system-settings/maintenance/disable`, { headers: H }).catch(() => null)
  }
})

test('System Settings page loads with header and all tabs render', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/system-settings') && r.request().method() === 'GET' && r.ok(), { timeout: 15000 }),
    page.goto('/settings'),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByRole('heading', { name: 'System Settings' })).toBeVisible({ timeout: 10000 })

  // Scoped to <main> — "Notifications" also matches the topbar's
  // notification-bell icon button, which would otherwise strict-mode-violate.
  for (const label of [
    'General', 'Branding', 'Localization', 'Registration', 'Learning', 'Security',
    'Authentication', 'Notifications', 'Email Config', 'Storage', 'Media & Upload',
    'Automation', 'Maintenance', 'Backup & Restore', 'Feature Toggles', 'Domain & URL',
    'Mobile App', 'API & Developer', 'AI Features', 'Config Logs',
  ]) {
    await expect(page.getByRole('main').getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 10000 })
  }
})

test('General tab: update Platform Name → saved → Config Logs shows the change', async ({ page }) => {
  const stamp = Date.now()
  const newName = `QA MindNavy ${stamp}`

  await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/system-settings') && r.ok(), { timeout: 15000 }),
    page.goto('/settings?tab=general'),
  ])

  const nameInput = page.getByTestId('general-platform-name')
  await expect(nameInput).toBeVisible({ timeout: 10000 })
  await nameInput.fill(newName)

  const [patchResp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/system-settings') && r.request().method() === 'PATCH' && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Save General Settings' }).click(),
  ])
  expect(patchResp.ok()).toBeTruthy()
  await expect(page.getByText('General settings saved.')).toBeVisible({ timeout: 10000 })

  const [logsResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/system-settings/logs') && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Config Logs', exact: true }).click(),
  ])
  expect(logsResp.ok()).toBeTruthy()
  // Scoped to the log row for THIS change — "platformName" alone matches
  // every historical rename row (strict-mode violation with 3+ log entries).
  const logRow = page.locator('tr', { hasText: newName })
  await expect(logRow.getByText('platformName')).toBeVisible({ timeout: 10000 })
  await expect(logRow.getByText(newName)).toBeVisible({ timeout: 10000 })
})

test('Feature Toggles: toggle Marketplace → saved → reflected on next load', async ({ page, request }) => {
  const H = { Authorization: `Bearer ${savedToken}` }

  const before = await (await request.get(`${API}/system-settings`, { headers: H })).json()
  const beforeValue: boolean = before.data.marketplaceEnabled

  await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/system-settings') && r.ok(), { timeout: 15000 }),
    page.goto('/settings?tab=features'),
  ])

  await page.getByTestId('feature-toggle-marketplaceEnabled').click()

  const [patchResp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/system-settings') && r.request().method() === 'PATCH' && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Save Feature Toggles' }).click(),
  ])
  expect(patchResp.ok()).toBeTruthy()
  await expect(page.getByText('Feature toggles saved.')).toBeVisible({ timeout: 10000 })

  // Reflected immediately — assert the SERVER now holds the flipped value
  // (not a client-side optimistic guess), same "refetch and check the real
  // response" rule the rest of this test suite family follows.
  const after = await (await request.get(`${API}/system-settings`, { headers: H })).json()
  expect(after.data.marketplaceEnabled).toBe(!beforeValue)

  // Flip it back immediately so later tests in this file aren't affected by
  // ordering — afterAll is a final safety net, not the only cleanup.
  await request.patch(`${API}/system-settings`, { headers: H, data: { marketplaceEnabled: beforeValue } })
})

test('Email Config: Send Test Email returns a result without crashing', async ({ page }) => {
  await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/system-settings') && r.ok(), { timeout: 15000 }),
    page.goto('/settings?tab=email'),
  ])

  // The recipient input (EmailConfigTab.tsx:94, the 2nd of 2 type="email"
  // inputs on this tab) only shows a hint via its placeholder — its actual
  // value stays empty until filled. With this dev environment's contactEmail
  // also unset, an empty recipient hits the backend's NO_RECIPIENT 400 guard
  // (settings.service.js) instead of the graceful "SMTP not configured" 200
  // this test means to exercise — fill a real recipient, like an actual user would.
  await page.locator('input[type="email"]').last().fill('qa-test-email@example.com')

  const [testResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/system-settings/test-email') && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Send Test Email' }).click(),
  ])
  expect(testResp.ok()).toBeTruthy()
  const body = await testResp.json()
  expect(typeof body.success).toBe('boolean')
  // This environment has no SMTP_* env vars set — a false/"not configured"
  // result is the CORRECT outcome here, not a failure. The assertion is that
  // the endpoint responds cleanly either way (no 500, a real message shown).
  // .first(): the message legitimately renders twice — a toast AND the
  // persistent inline result box below the form both show it at once.
  await expect(page.getByText(body.message).first()).toBeVisible({ timeout: 10000 })
})

test('Maintenance: enable shows the banner, disable removes it', async ({ page }) => {
  await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/system-settings') && r.ok(), { timeout: 15000 }),
    page.goto('/settings?tab=maintenance'),
  ])

  const [enableResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/system-settings/maintenance/enable') && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Enable Now' }).click(),
  ])
  expect(enableResp.ok()).toBeTruthy()
  await expect(page.getByText('Maintenance mode is ON.')).toBeVisible({ timeout: 10000 })

  const [disableResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/system-settings/maintenance/disable') && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Disable' }).click(),
  ])
  expect(disableResp.ok()).toBeTruthy()
  await expect(page.getByText('Maintenance mode is ON.')).not.toBeVisible({ timeout: 10000 })
})

test('Backup & Restore: Create Backup downloads a JSON file', async ({ page }) => {
  await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/system-settings') && r.ok(), { timeout: 15000 }),
    page.goto('/settings?tab=backup'),
  ])

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.waitForResponse(r => r.url().includes('/system-settings/backup') && r.request().method() === 'POST' && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Create Backup' }).click(),
  ])

  expect(download.suggestedFilename()).toMatch(/^mindnavy-settings-backup-.*\.json$/)
  const path = await download.path()
  expect(path).toBeTruthy()
})
