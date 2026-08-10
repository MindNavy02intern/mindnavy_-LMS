// Scheduled Reports (Export Center tab, "Scheduled Reports" section) — full
// stack, real backend throughout (no route mocking). Unlike the rest of
// reports.full.spec.ts (100% read-only), this is the module's one real CRUD
// surface: create → pause → resume → edit → delete, plus the hourly
// background sweep isn't exercised here (it's a server-side setInterval, not
// something a UI test can wait an hour for) — only the schedule-definition
// CRUD the UI actually owns.
//
// Cleanup: the created scheduled report's id is captured and deleted in
// afterAll as a safety net (the lifecycle test also deletes it itself via
// the UI — afterAll only matters if an earlier assertion throws first).
//
// Run with: npx playwright test reports-schedule.full --workers=1

import { type Page, test, expect } from '@playwright/test'

const API = 'http://localhost:5001/api/admin'
let createdId = ''
let savedToken = ''

async function getAuthHeaders(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  expect(token, 'mn_admin_token must exist in localStorage').toBeTruthy()
  savedToken = token
  return { Authorization: `Bearer ${token}` }
}

test.afterAll(async ({ request }) => {
  if (!savedToken || !createdId) return
  await request.delete(`${API}/reports/scheduled/${createdId}`, { headers: { Authorization: `Bearer ${savedToken}` } }).catch(() => null)
})

test('header "Schedule Report" button navigates to Export Center\'s Scheduled Reports section', async ({ page }) => {
  await page.goto('/reports-analytics')
  await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'Schedule Report' }).click()
  await expect(page).toHaveURL(/tab=export/, { timeout: 10000 })
  await expect(page.getByText('Scheduled Reports', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: 'New Schedule' })).toBeVisible({ timeout: 10000 })
})

test('Scheduled Reports: full lifecycle — create, pause, resume, edit, delete', async ({ page }) => {
  await getAuthHeaders(page)
  const name = `Weekly Learners ${Date.now()}`
  const renamedName = `${name} (renamed)`

  await page.goto('/reports-analytics?tab=export')
  await expect(page.getByRole('button', { name: 'New Schedule' })).toBeVisible({ timeout: 10000 })

  // ── Create ──────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'New Schedule' }).click()
  const createDialog = page.getByRole('dialog', { name: 'Schedule Report' })
  await expect(createDialog).toBeVisible({ timeout: 5000 })

  await createDialog.getByPlaceholder('e.g. Weekly Learner Progress').fill(name)
  await createDialog.getByPlaceholder('name@company.com').fill('qa@mindnavy.test')
  await createDialog.getByRole('button', { name: 'Add' }).click()
  await expect(createDialog.getByText('qa@mindnavy.test')).toBeVisible({ timeout: 5000 })

  const [createResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/reports/scheduled') && r.request().method() === 'POST' && r.ok(), { timeout: 15000 }),
    createDialog.getByRole('button', { name: 'Save' }).click(),
  ])
  expect(createResp.ok()).toBeTruthy()
  const created = (await createResp.json()).data
  createdId = created.id
  expect(created.status).toBe('ACTIVE')

  await expect(createDialog).not.toBeVisible({ timeout: 5000 })
  const row = page.locator('tr', { hasText: name })
  await expect(row).toBeVisible({ timeout: 10000 })
  await expect(row.getByText('Active', { exact: true })).toBeVisible({ timeout: 10000 })

  // ── Pause ───────────────────────────────────────────────────────────────
  const [pauseResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/reports/scheduled/${createdId}/pause`) && r.ok(), { timeout: 15000 }),
    row.getByRole('button', { name: 'Pause' }).click(),
  ])
  expect(pauseResp.ok()).toBeTruthy()
  await expect(row.getByText('Paused', { exact: true })).toBeVisible({ timeout: 10000 })

  // ── Resume ──────────────────────────────────────────────────────────────
  const [resumeResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/reports/scheduled/${createdId}/resume`) && r.ok(), { timeout: 15000 }),
    row.getByRole('button', { name: 'Resume' }).click(),
  ])
  expect(resumeResp.ok()).toBeTruthy()
  await expect(row.getByText('Active', { exact: true })).toBeVisible({ timeout: 10000 })

  // ── Edit (rename) ───────────────────────────────────────────────────────
  await row.getByRole('button', { name: 'Edit' }).click()
  const editDialog = page.getByRole('dialog', { name: 'Edit Scheduled Report' })
  await expect(editDialog).toBeVisible({ timeout: 5000 })
  await expect(editDialog.getByPlaceholder('e.g. Weekly Learner Progress')).toHaveValue(name)

  await editDialog.getByPlaceholder('e.g. Weekly Learner Progress').fill(renamedName)
  const [updateResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/reports/scheduled/${createdId}`) && r.request().method() === 'PATCH' && r.ok(), { timeout: 15000 }),
    editDialog.getByRole('button', { name: 'Save' }).click(),
  ])
  expect(updateResp.ok()).toBeTruthy()
  const renamedRow = page.locator('tr', { hasText: renamedName })
  await expect(renamedRow).toBeVisible({ timeout: 10000 })

  // ── Delete ──────────────────────────────────────────────────────────────
  page.once('dialog', d => d.accept())
  const [deleteResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/reports/scheduled/${createdId}`) && r.request().method() === 'DELETE' && r.ok(), { timeout: 15000 }),
    renamedRow.getByRole('button', { name: 'Delete' }).click(),
  ])
  expect(deleteResp.ok()).toBeTruthy()
  await expect(page.locator('tr', { hasText: renamedName })).toHaveCount(0, { timeout: 10000 })
  createdId = '' // already deleted — afterAll has nothing left to clean up
})
