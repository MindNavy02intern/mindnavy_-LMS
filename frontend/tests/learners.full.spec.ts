import { type APIRequestContext, type Page, test, expect } from '@playwright/test'

// Learners module — full stack (Parts 1-9). Real backend throughout (no route
// mocking) — a disposable instructor + course + learner are created via the
// real API, same pattern as instructor-phase-b/-cd. See
// backend/contact md files/LEARNERS_CONTRACT.md for the endpoint shapes.
//
// Run with: npx playwright test learners.full --workers=1

const API = 'http://localhost:5001/api/admin'

let savedToken: string | null = null
let instructorId: string | null = null
let courseId: string | null = null
let courseTitle: string | null = null
let learnerId: string | null = null
let learnerName: string | null = null
let enrollmentId: string | null = null

// Second learner + course, dedicated to the bulk-enroll test so it doesn't
// collide with the single-enroll/suspend tests sharing learnerId/courseId.
let learnerId2: string | null = null
let learnerName2: string | null = null
let bulkCourseId: string | null = null
let bulkCourseTitle: string | null = null
let bulkEnrollmentId1: string | null = null
let bulkEnrollmentId2: string | null = null

// Enroll pickers (EnrollLearnerModal / BulkEnrollLearnersModal) only list
// Published courses. A bare POST /courses defaults to DRAFT, so tests must
// walk the real create -> section -> lesson -> submit -> approve sequence
// (frontend/CLAUDE.md §4.1) — same recipe proven in course-approval.full.spec.ts.
async function createPublishedCourse(
  request: APIRequestContext,
  token: string,
  title: string,
  instructorId: string,
): Promise<string | null> {
  const H = { Authorization: `Bearer ${token}` }
  const courseResp = await request.post(`${API}/courses`, {
    headers: H,
    data: { title, instructorId, description: 'A course for Learners QA.', thumbnail: 'https://example.com/thumb.jpg' },
  })
  const courseBody = await courseResp.json().catch(() => null)
  const id: string | null = courseBody?.data?.id ?? null
  if (!id) return null

  const sectionResp = await request.post(`${API}/courses/${id}/sections`, { headers: H, data: { title: 'Section 1' } })
  const sectionBody = await sectionResp.json().catch(() => null)
  const sectionId: string | null = sectionBody?.data?.id ?? null
  if (!sectionId) return id

  await request.post(`${API}/sections/${sectionId}/lessons`, {
    headers: H, data: { title: 'Lesson 1', type: 'TEXT', content: 'Hello.' },
  })
  await request.post(`${API}/courses/${id}/submit`, { headers: H })
  await request.post(`${API}/courses/${id}/approve`, { headers: H })
  return id
}

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/learners')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()
  if (!savedToken) return

  const stamp = Date.now()

  // A course needs an owning instructor — same disposable-instructor pattern
  // as instructor-phase-b (that test's own cleanup already proved this works).
  const instrResp = await request.post(`${API}/instructors`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: {
      fullName: `QA Learners Instructor ${stamp}`,
      email: `qa.learners.instructor.${stamp}@example.com`,
      password: 'Qatest!2345678',
      status: 'ACTIVE',
    },
  })
  const instrBody = await instrResp.json().catch(() => null)
  instructorId = instrBody?.data?.id ?? null
  if (!instructorId) return

  courseTitle = `QA Learners Course ${stamp}`
  courseId = await createPublishedCourse(request, savedToken, courseTitle, instructorId)

  learnerName = `QA Learner ${stamp}`
  const learnerResp = await request.post(`${API}/learners`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: {
      fullName: learnerName,
      email: `qa.learner.${stamp}@example.com`,
      password: 'Qatest!2345678',
      status: 'ACTIVE',
    },
  })
  const learnerBody = await learnerResp.json().catch(() => null)
  learnerId = learnerBody?.data?.id ?? null

  learnerName2 = `QA Learner Bulk ${stamp}`
  const learner2Resp = await request.post(`${API}/learners`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: {
      fullName: learnerName2,
      email: `qa.learner.bulk.${stamp}@example.com`,
      password: 'Qatest!2345678',
      status: 'ACTIVE',
    },
  })
  const learner2Body = await learner2Resp.json().catch(() => null)
  learnerId2 = learner2Body?.data?.id ?? null

  bulkCourseTitle = `QA Learners Bulk Course ${stamp}`
  bulkCourseId = await createPublishedCourse(request, savedToken, bulkCourseTitle, instructorId)
})

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  // Unenroll FIRST — deleteLearner 409s while any non-completed enrollment
  // exists, same rule as deleteInstructor + courses/live-sessions.
  if (learnerId && enrollmentId) {
    await request.delete(`${API}/learners/${learnerId}/enrollments/${enrollmentId}`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    }).catch(() => null)
  }
  if (learnerId && bulkEnrollmentId1) {
    await request.delete(`${API}/learners/${learnerId}/enrollments/${bulkEnrollmentId1}`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    }).catch(() => null)
  }
  if (learnerId) {
    await request.delete(`${API}/learners/${learnerId}`, { headers: { Authorization: `Bearer ${savedToken}` } }).catch(() => null)
  }
  if (learnerId2 && bulkEnrollmentId2) {
    await request.delete(`${API}/learners/${learnerId2}/enrollments/${bulkEnrollmentId2}`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    }).catch(() => null)
  }
  if (learnerId2) {
    await request.delete(`${API}/learners/${learnerId2}`, { headers: { Authorization: `Bearer ${savedToken}` } }).catch(() => null)
  }
  if (bulkCourseId) {
    await request.delete(`${API}/courses/${bulkCourseId}`, { headers: { Authorization: `Bearer ${savedToken}` } }).catch(() => null)
  }
  if (courseId) {
    await request.delete(`${API}/courses/${courseId}`, { headers: { Authorization: `Bearer ${savedToken}` } }).catch(() => null)
  }
  if (instructorId) {
    await request.delete(`${API}/instructors/${instructorId}`, { headers: { Authorization: `Bearer ${savedToken}` } }).catch(() => null)
  }
})

async function openPanel(page: Page) {
  const [resp] = await Promise.all([
    page.waitForResponse(r => new RegExp(`/learners/${learnerId}(\\?|$)`).test(r.url()) && r.ok(), { timeout: 15000 }),
    page.goto(`/learners?learner=${learnerId}`),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText('Learner Details')).toBeVisible({ timeout: 10000 })
}

test('Learners page loads with header, stats and table', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/learners?') && r.ok(), { timeout: 15000 }),
    page.goto('/learners'),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByRole('heading', { name: 'Learners' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Total Learners')).toBeVisible({ timeout: 10000 })
})

test('Tab switching updates the URL and refetches the table', async ({ page }) => {
  await page.goto('/learners')
  await expect(page.getByRole('heading', { name: 'Learners' })).toBeVisible({ timeout: 10000 })

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/learners?') && r.url().includes('tab=active') && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Active', exact: true }).click(),
  ])
  expect(resp.ok()).toBeTruthy()
  expect(page.url()).toContain('tab=active')
})

test('Panel deep-link (?learner=<id>) opens the side panel directly', async ({ page }) => {
  test.skip(!learnerId, 'Setup learner was not created — backend may be unavailable')
  await openPanel(page)
  await expect(page.getByText(learnerName as string)).toBeVisible({ timeout: 10000 })
})

test('Enrolling a learner in a course makes it appear in the Courses tab', async ({ page }) => {
  test.skip(!learnerId || !courseId, 'Setup learner/course was not created — backend may be unavailable')

  await openPanel(page)
  await page.getByRole('button', { name: 'Enroll', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Enroll in Course' })).toBeVisible({ timeout: 5000 })

  await page.getByLabel('Course').selectOption({ label: courseTitle as string })

  const [enrollResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/learners/${learnerId}/enrollments`) && r.request().method() === 'POST', { timeout: 15000 }),
    page.getByRole('button', { name: 'Enroll', exact: true }).click(),
  ])
  expect(enrollResp.ok()).toBeTruthy()

  // Capture the real enrollment id for cleanup (afterAll never fabricates one).
  const listResp = await page.request.get(`${API}/learners/${learnerId}/enrollments`, {
    headers: { Authorization: `Bearer ${savedToken}` },
  })
  const listBody = await listResp.json().catch(() => null)
  const match = (listBody?.data?.enrollments ?? []).find((e: { courseId: string; id: string }) => e.courseId === courseId)
  enrollmentId = match?.id ?? null
  expect(enrollmentId, 'Enrollment must be findable via GET /enrollments').toBeTruthy()

  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page.getByText(courseTitle as string)).toBeVisible({ timeout: 10000 })
})

test('Unenrolling a learner removes it from the Courses tab', async ({ page }) => {
  test.skip(!learnerId || !enrollmentId, 'Depends on the enroll test having run and captured a real enrollmentId')

  page.once('dialog', dialog => dialog.accept())
  await openPanel(page)
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page.getByText(courseTitle as string)).toBeVisible({ timeout: 10000 })

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/learners/${learnerId}/enrollments/${enrollmentId}`) && r.request().method() === 'DELETE', { timeout: 15000 }),
    page.getByRole('button', { name: `Unenroll from ${courseTitle}` }).click(),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText(courseTitle as string)).not.toBeVisible({ timeout: 10000 })

  // Already gone server-side — afterAll's own delete call is now a no-op
  // fallback (.catch(() => null) already tolerates a 404 here).
  enrollmentId = null
})

test('Bulk Enroll (More Actions) enrolls multiple learners in one course', async ({ page }) => {
  test.skip(!learnerId || !learnerId2 || !bulkCourseId, 'Setup learners/course were not created — backend may be unavailable')

  await page.goto('/learners')
  await expect(page.getByRole('heading', { name: 'Learners' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'More Actions', exact: true }).click()
  await page.getByRole('button', { name: 'Bulk Enroll', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bulk Enroll Learners' })).toBeVisible({ timeout: 5000 })

  // Add both learners via the search-and-add picker.
  const search = page.getByLabel('Search learners');
  await search.fill(learnerName as string)
  await expect(page.getByText(learnerName as string)).toBeVisible({ timeout: 10000 })
  await page.getByText(learnerName as string).click()

  await search.fill(learnerName2 as string)
  await expect(page.getByText(learnerName2 as string)).toBeVisible({ timeout: 10000 })
  await page.getByText(learnerName2 as string).click()

  await page.getByLabel('Course').selectOption({ label: bulkCourseTitle as string })

  const [bulkResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/learners/bulk-enroll') && r.request().method() === 'POST', { timeout: 15000 }),
    page.getByRole('button', { name: /^Enroll/ }).click(),
  ])
  expect(bulkResp.ok()).toBeTruthy()
  const bulkBody = await bulkResp.json()
  expect(bulkBody?.data?.enrolledCount).toBe(2)

  // Capture the real enrollment ids for cleanup (never fabricated).
  const list1 = await page.request.get(`${API}/learners/${learnerId}/enrollments`, { headers: { Authorization: `Bearer ${savedToken}` } })
  const list1Body = await list1.json().catch(() => null)
  bulkEnrollmentId1 = (list1Body?.data?.enrollments ?? []).find((e: { courseId: string; id: string }) => e.courseId === bulkCourseId)?.id ?? null
  expect(bulkEnrollmentId1).toBeTruthy()

  const list2 = await page.request.get(`${API}/learners/${learnerId2}/enrollments`, { headers: { Authorization: `Bearer ${savedToken}` } })
  const list2Body = await list2.json().catch(() => null)
  bulkEnrollmentId2 = (list2Body?.data?.enrollments ?? []).find((e: { courseId: string; id: string }) => e.courseId === bulkCourseId)?.id ?? null
  expect(bulkEnrollmentId2).toBeTruthy()
})

test('Suspending a learner updates the status badge and suspension history', async ({ page }) => {
  test.skip(!learnerId, 'Setup learner was not created — backend may be unavailable')

  await openPanel(page)
  await page.getByRole('button', { name: 'Suspend', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Suspend Learner' })).toBeVisible({ timeout: 5000 })

  await page.getByLabel('Violation type').selectOption('POLICY')
  await page.getByLabel('Suspension reason').fill('Automated Learners QA suspension test — suspension history check')

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/learners/${learnerId}/suspend`) && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Confirm Suspend' }).click(),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText('suspended', { exact: true })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'More', exact: true }).click()
  await expect(page.getByText('SUSPENDED', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Policy Violation')).toBeVisible({ timeout: 10000 })

  // Reactivate so a leftover-suspended row doesn't skew stats for whoever
  // runs the suite next — not strictly cleanup (afterAll deletes the row
  // regardless) but keeps intermediate runs honest if this test is re-run
  // standalone against a shared dev DB.
  page.once('dialog', dialog => dialog.accept())
  await Promise.all([
    page.waitForResponse(r => r.url().includes(`/learners/${learnerId}/reactivate`) && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Reactivate', exact: true }).click(),
  ])
})

test('Bottom analytics charts render', async ({ page }) => {
  await page.goto('/learners')
  await expect(page.getByRole('heading', { name: 'Learners' })).toBeVisible({ timeout: 10000 })

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/learners/analytics') && r.ok(), { timeout: 15000 }),
    page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)),
  ])
  expect(resp.ok()).toBeTruthy()

  await expect(page.getByText('Learners by Program')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Progress Overview')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Enrollment Trend')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Learner Engagement')).toBeVisible({ timeout: 10000 })
  // At least one recharts SVG actually mounted, not just the card shells.
  await expect(page.locator('.recharts-wrapper').first()).toBeVisible({ timeout: 10000 })
})
