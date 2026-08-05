import { type Page, test, expect } from '@playwright/test'

// All assertions run against the real backend — no mock flag in instructorsApi.ts.
// A disposable instructor is created via the real API in beforeAll (self-cleaning
// tests, option c) so the suspend test has a safe, real target that never leaves
// data behind. Counts are read from tabCounts/pagination, never hardcoded.

const API = 'http://localhost:5001/api/admin'

let savedToken: string | null = null
let testInstructorId: string | null = null
let testInstructorName: string | null = null

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/instructors')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()

  testInstructorName = `QA Instructor ${Date.now()}`
  const resp = await request.post(`${API}/instructors`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: {
      fullName: testInstructorName,
      email: `qa.instructor.${Date.now()}@example.com`,
      password: 'Qatest!2345678',
      status: 'ACTIVE',
    },
  })
  const body = await resp.json().catch(() => null)
  testInstructorId = body?.data?.id ?? null
})

test.afterAll(async ({ request }) => {
  if (!savedToken || !testInstructorId) return
  await request
    .delete(`${API}/instructors/${testInstructorId}`, { headers: { Authorization: `Bearer ${savedToken}` } })
    .catch(() => null)
})

async function gotoInstructors(page: Page) {
  await page.goto('/instructors')
  await expect(page.getByRole('heading', { name: 'Instructors', exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/Showing \d+ to \d+ of \d+ instructors/)).toBeVisible({ timeout: 10000 })
}

async function searchForTestInstructor(page: Page) {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/instructors') && r.url().includes('search=') && r.ok(), { timeout: 15000 }),
    page.getByPlaceholder('Search instructors…').fill(testInstructorName as string),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText(testInstructorName as string)).toBeVisible({ timeout: 10000 })
}

test('Instructors page loads, table shows real instructors, tabCounts badges visible', async ({ page }) => {
  await gotoInstructors(page)

  // At least one instructor row renders
  const rows = page.locator('table tbody tr')
  await expect(rows.first()).toBeVisible()

  // Tab badge counts come from the list response's tabCounts (global) — assert
  // the All Instructors tab shows a numeric badge, not that it equals any
  // hardcoded number (DB state varies run to run).
  await expect(page.getByRole('button', { name: /^All Instructors/ })).toContainText(/\d+/)
  await expect(page.getByRole('button', { name: /^Active/ })).toContainText(/\d+/)
  await expect(page.getByRole('button', { name: /^Suspended/ })).toContainText(/\d+/)
})

test('Search filters the table by real instructor name', async ({ page }) => {
  test.skip(!testInstructorId, 'Setup instructor was not created — backend may be unavailable')
  await gotoInstructors(page)
  await searchForTestInstructor(page)

  // Narrowed result set still reports a truthful pagination line
  await expect(page.getByText(/Showing \d+ to \d+ of \d+ instructors/)).toBeVisible()
})

test('Tab switching updates the ?tab= URL param and re-fetches', async ({ page }) => {
  await gotoInstructors(page)

  await page.getByRole('button', { name: /^Active/ }).click()
  await expect(page).toHaveURL(/[?&]tab=active/)
  await expect(page.getByText(/Showing \d+ to \d+ of \d+ instructors/)).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: /^Suspended/ }).click()
  await expect(page).toHaveURL(/[?&]tab=suspended/)
  await expect(page.getByText(/Showing \d+ to \d+ of \d+ instructors/)).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: /^Pending Approval/ }).click()
  await expect(page).toHaveURL(/[?&]tab=pending/)

  await page.getByRole('button', { name: /^All Instructors/ }).click()
  await expect(page).toHaveURL(/[?&]tab=all/)
})

test('Clicking View opens the side panel with ?instructor=<id> in the URL', async ({ page }) => {
  test.skip(!testInstructorId, 'Setup instructor was not created — backend may be unavailable')
  await gotoInstructors(page)
  await searchForTestInstructor(page)

  await page.getByLabel(`View ${testInstructorName}`).click()
  await expect(page).toHaveURL(new RegExp(`[?&]instructor=${testInstructorId}`))
  await expect(page.getByText('Instructor Details')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(testInstructorName as string).first()).toBeVisible()
})

test('Suspend action opens the reason modal, submits, and the status badge updates', async ({ page }) => {
  test.skip(!testInstructorId, 'Setup instructor was not created — backend may be unavailable')
  await gotoInstructors(page)
  await searchForTestInstructor(page)

  await page.getByLabel(`More actions for ${testInstructorName}`).click()
  await page.getByRole('button', { name: 'Suspend', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Suspend Instructor' })).toBeVisible({ timeout: 5000 })

  // Confirm is disabled/no-ops without a reason (≥3 chars per contract)
  await page.getByLabel('Suspension reason').fill('Automated QA suspension test')

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructors/${testInstructorId}/suspend`) && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Confirm Suspend' }).click(),
  ])
  expect(resp.ok()).toBeTruthy()

  // Row re-fetches and the status badge reflects the real backend state
  await expect(page.getByText(testInstructorName as string).first()).toBeVisible({ timeout: 10000 })
  const row = page.locator('tr', { has: page.getByText(testInstructorName as string) })
  await expect(row.getByText('suspended', { exact: true })).toBeVisible({ timeout: 10000 })
})
