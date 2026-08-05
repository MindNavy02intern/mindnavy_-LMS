import { type Page, test, expect } from '@playwright/test'

// Covers tasks 110 (side panel) and 112 (bottom analytics section).
// A disposable instructor + course are created via the real API so the panel
// has a real pending-approval course to approve in Test 4 — the panel's
// GET /instructors/:id is the only endpoint it calls, so every assertion here
// reads off that one real response, never a fabricated value.

const API = 'http://localhost:5001/api/admin'

let savedToken: string | null = null
let instructorId: string | null = null
let instructorName: string | null = null
let courseId: string | null = null
let courseTitle: string | null = null

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/instructors')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()

  const stamp = Date.now()
  instructorName = `QA Panel Instructor ${stamp}`
  const instrResp = await request.post(`${API}/instructors`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: {
      fullName: instructorName,
      email: `qa.panel.instructor.${stamp}@example.com`,
      password: 'Qatest!2345678',
      status: 'ACTIVE',
    },
  })
  const instrBody = await instrResp.json().catch(() => null)
  instructorId = instrBody?.data?.id ?? null
  if (!instructorId) return

  courseTitle = `QA Panel Course ${stamp}`
  const courseResp = await request.post(`${API}/courses`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: { title: courseTitle, instructorId },
  })
  const courseBody = await courseResp.json().catch(() => null)
  courseId = courseBody?.data?.id ?? null
  if (!courseId) return

  // Draft → Pending, so it lands in this instructor's pendingApprovals.
  await request.post(`${API}/courses/${courseId}/submit`, {
    headers: { Authorization: `Bearer ${savedToken}` },
  })
})

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  // Archive first (DELETE /courses/:id is a soft archive) — deleteInstructor
  // 409s while it still owns any non-archived course, draft/pending/published alike.
  if (courseId) {
    await request.delete(`${API}/courses/${courseId}`, { headers: { Authorization: `Bearer ${savedToken}` } }).catch(() => null)
  }
  if (instructorId) {
    await request.delete(`${API}/instructors/${instructorId}`, { headers: { Authorization: `Bearer ${savedToken}` } }).catch(() => null)
  }
})

async function openPanelByDeepLink(page: Page) {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructors/${instructorId}`) && r.ok(), { timeout: 15000 }),
    page.goto(`/instructors?instructor=${instructorId}`),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText('Instructor Details')).toBeVisible({ timeout: 10000 })
  return (await resp.json()).data
}

test('Clicking View on an instructor opens the panel with ?instructor=<id> in the URL', async ({ page }) => {
  test.skip(!instructorId, 'Setup instructor was not created — backend may be unavailable')

  await page.goto('/instructors')
  await expect(page.getByText(/Showing \d+ to \d+ of \d+ instructors/)).toBeVisible({ timeout: 10000 })

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/instructors') && r.url().includes('search=') && r.ok(), { timeout: 15000 }),
    page.getByPlaceholder('Search instructors…').fill(instructorName as string),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText(instructorName as string)).toBeVisible({ timeout: 10000 })

  const [detailResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructors/${instructorId}`) && r.ok(), { timeout: 15000 }),
    page.getByLabel(`View ${instructorName}`).click(),
  ])
  expect(detailResp.ok()).toBeTruthy()
  await expect(page).toHaveURL(new RegExp(`[?&]instructor=${instructorId}`))
  await expect(page.getByText('Instructor Details')).toBeVisible({ timeout: 10000 })
})

test('Panel shows real stats — Courses, Students, and "—" for Rating/Revenue', async ({ page }) => {
  test.skip(!instructorId, 'Setup instructor was not created — backend may be unavailable')

  const detail = await openPanelByDeepLink(page)

  function statValue(label: string) {
    return page.getByRole('group', { name: `${label} stat` }).locator('[data-value]');
  }

  await expect(statValue('Courses')).toHaveText(String(detail.coursesCount));
  await expect(statValue('Students')).toHaveText(String(detail.studentsCount));

  // rating/revenue are always null per contract — never $0 or 0.0/5.
  expect(detail.rating).toBeNull()
  expect(detail.revenue).toBeNull()
  await expect(statValue('Rating')).toHaveText('—');
  await expect(statValue('Revenue')).toHaveText('—');
})

test('Performance chart renders exactly 12 data points', async ({ page }) => {
  test.skip(!instructorId, 'Setup instructor was not created — backend may be unavailable')

  const detail = await openPanelByDeepLink(page)
  expect(detail.performanceChart.labels).toHaveLength(12)
  expect(detail.performanceChart.enrollments).toHaveLength(12)

  const bars = page.getByRole('group', { name: 'Enrollments last 12 months' }).getByRole('img')
  await expect(bars).toHaveCount(12)
})

test('Approving a pending course removes it from the panel queue without a reload', async ({ page }) => {
  test.skip(!instructorId || !courseId, 'Setup instructor/course was not created — backend may be unavailable')

  await openPanelByDeepLink(page)
  await expect(page.getByText('Pending Course Approvals')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(courseTitle as string)).toBeVisible()

  page.once('dialog', dialog => dialog.accept())
  const [approveResp, panelResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/courses/${courseId}/approve`) && r.ok(), { timeout: 15000 }),
    page.waitForResponse(r => r.url().includes(`/instructors/${instructorId}`) && r.ok(), { timeout: 15000 }),
    page.getByTitle('Approve').click(),
  ])
  expect(approveResp.ok()).toBeTruthy()
  expect(panelResp.ok()).toBeTruthy()

  // No page.reload() — the panel re-fetched itself (fetchDetail()) after the
  // approve resolved. Scoped to the queue section, not the whole page: the
  // approved course still legitimately appears in the "Courses" list below
  // (now PUBLISHED) — the queue section itself disappears once it's the only
  // pending course, since InstructorSidePanel only renders it when non-empty.
  await expect(page.getByText('Pending Course Approvals')).not.toBeVisible({ timeout: 10000 })
})

test('Analytics section renders all 4 sections', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/instructors/analytics') && r.ok(), { timeout: 15000 }),
    page.goto('/instructors'),
  ])
  expect(resp.ok()).toBeTruthy()
  const analytics = (await resp.json()).data

  await expect(page.getByText('Instructor Distribution by Specialization')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Top Instructors')).toBeVisible()
  await expect(page.getByText('Courses by Status')).toBeVisible()
  await expect(page.getByText('Earnings Overview')).toBeVisible()

  // Contract v1: no Payment model exists, so this is always available:false —
  // assert the real empty state instead of a bar chart or zeroed data.
  expect(analytics.earningsOverview.available).toBe(false)
  await expect(page.getByText('Not available yet')).toBeVisible()
})
