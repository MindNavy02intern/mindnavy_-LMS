import { type Page, test, expect } from '@playwright/test'

// Covers task 106: the 7 stats cards above the Instructors tabs
// (GET /api/admin/instructors/stats). Values are cross-checked against the
// real API response, never hardcoded (contract: "one datum, one owner").
// A disposable instructor is created via the real API so the suspend
// reflection test has a safe target that never leaves data behind.

const API = 'http://localhost:5001/api/admin'

const CARD_LABELS = [
  'Total Instructors',
  'Active Instructors',
  'Suspended Instructors',
  'Pending Approval',
  'Courses Published',
  'Total Revenue',
  'Avg. Rating',
]

let savedToken: string | null = null
let testInstructorId: string | null = null
let testInstructorName: string | null = null

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/instructors')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()

  testInstructorName = `QA Stats Instructor ${Date.now()}`
  const resp = await request.post(`${API}/instructors`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: {
      fullName: testInstructorName,
      email: `qa.stats.instructor.${Date.now()}@example.com`,
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

function cardValue(page: Page, label: string) {
  return page.getByRole('group', { name: `${label} stat card` }).locator('[data-value]')
}

async function gotoInstructorsAndWaitForStats(page: Page) {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/instructors/stats') && r.ok(), { timeout: 15000 }),
    page.goto('/instructors'),
  ])
  await expect(page.getByRole('heading', { name: 'Instructors', exact: true })).toBeVisible({ timeout: 10000 })
  return (await resp.json()).data as {
    totalInstructors: { value: number | null }
    activeInstructors: { value: number | null }
    suspendedInstructors: { value: number | null; changePercent: number | null }
    totalRevenue: { available: boolean }
    avgRating: { available: boolean }
  }
}

test('Stats cards render above the tabs with real values from /instructors/stats', async ({ page }) => {
  const apiStats = await gotoInstructorsAndWaitForStats(page)

  for (const label of CARD_LABELS) {
    await expect(page.getByRole('group', { name: `${label} stat card` })).toBeVisible()
  }

  // One datum, one owner: the card shows the exact number the API returned,
  // not a client-side recomputation.
  await expect(cardValue(page, 'Total Instructors')).toHaveText(String(apiStats.totalInstructors.value))
  await expect(cardValue(page, 'Active Instructors')).toHaveText(String(apiStats.activeInstructors.value))
})

test('Unavailable metrics render — never $0 or 0.0/5', async ({ page }) => {
  const apiStats = await gotoInstructorsAndWaitForStats(page)

  // Contract v1: no Payment or Review model exists, so these are always
  // available:false. Assert the dash, and guard the assumption against a
  // future backend change silently making the test meaningless.
  expect(apiStats.totalRevenue.available).toBe(false)
  expect(apiStats.avgRating.available).toBe(false)

  await expect(cardValue(page, 'Total Revenue')).toHaveText('—')
  await expect(cardValue(page, 'Avg. Rating')).toHaveText('—')
})

test('Suspending an instructor updates the Suspended Instructors card without a hard reload', async ({ page }) => {
  test.skip(!testInstructorId, 'Setup instructor was not created — backend may be unavailable')

  await gotoInstructorsAndWaitForStats(page)
  const beforeText = await cardValue(page, 'Suspended Instructors').innerText()
  const before = Number(beforeText)

  // Search for the disposable instructor and suspend it through the real UI flow.
  const [searchResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/instructors') && r.url().includes('search=') && r.ok(), { timeout: 15000 }),
    page.getByPlaceholder('Search instructors…').fill(testInstructorName as string),
  ])
  expect(searchResp.ok()).toBeTruthy()
  await expect(page.getByText(testInstructorName as string)).toBeVisible({ timeout: 10000 })

  await page.getByLabel(`More actions for ${testInstructorName}`).click()
  await page.getByRole('button', { name: 'Suspend', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Suspend Instructor' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('Suspension reason').fill('Automated QA suspension test (stats reflection)')

  const [suspendResp, statsResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructors/${testInstructorId}/suspend`) && r.ok(), { timeout: 15000 }),
    page.waitForResponse(r => r.url().includes('/instructors/stats') && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Confirm Suspend' }).click(),
  ])
  expect(suspendResp.ok()).toBeTruthy()
  expect(statsResp.ok()).toBeTruthy()

  // No page.reload() anywhere above — the card refetched itself via the
  // analyticsUpdated bridge that invalidateFor('instructor.suspend') fires.
  await expect(cardValue(page, 'Suspended Instructors')).toHaveText(String(before + 1))
})
