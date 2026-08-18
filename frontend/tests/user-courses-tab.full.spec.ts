import { type APIRequestContext, type Page, test, expect } from '@playwright/test'

// User Details Drawer — Courses tab (DEFERRED_ITEMS.md Users item, Fix 1).
// Real backend throughout — a disposable instructor + published course +
// learner-role user are created via the real API, same pattern as
// learners.full.spec.ts's createPublishedCourse helper.
//
// Run with: npx playwright test user-courses-tab.full --workers=1

const API = 'http://localhost:5001/api/admin'

let savedToken: string | null = null
let instructorId: string | null = null
let courseId: string | null = null
let courseTitle: string | null = null
let learnerUserId: string | null = null
let learnerEmail: string | null = null
let nonLearnerUserId: string | null = null
let nonLearnerEmail: string | null = null
let enrollmentId: string | null = null

async function createPublishedCourse(
  request: APIRequestContext,
  token: string,
  title: string,
  ownerId: string,
): Promise<string | null> {
  const H = { Authorization: `Bearer ${token}` }
  const courseResp = await request.post(`${API}/courses`, {
    headers: H,
    data: { title, instructorId: ownerId, description: 'A course for Users QA.', thumbnail: 'https://example.com/thumb.jpg' },
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
  await page.goto('/users')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }
  const stamp = Date.now()

  const instrResp = await request.post(`${API}/instructors`, {
    headers: H,
    data: {
      fullName: `QA Users Instructor ${stamp}`,
      email: `qa.users.instructor.${stamp}@example.com`,
      password: 'Qatest!2345678',
      status: 'ACTIVE',
    },
  })
  const instrBody = await instrResp.json().catch(() => null)
  instructorId = instrBody?.data?.id ?? null
  if (!instructorId) return

  courseTitle = `QA Users Course ${stamp}`
  courseId = await createPublishedCourse(request, savedToken, courseTitle, instructorId)

  learnerEmail = `qa.users.learner.${stamp}@example.com`
  const learnerResp = await request.post(`${API}/users`, {
    headers: H,
    data: { fullName: `QA Users Learner ${stamp}`, email: learnerEmail, password: 'Qatest!2345678', role: 'LEARNER', status: 'ACTIVE' },
  })
  const learnerBody = await learnerResp.json().catch(() => null)
  learnerUserId = learnerBody?.user?.id ?? null

  // A non-learner (instructor-role AppUser row) to prove the Assign button
  // is gated — the backend enroll path 404s for anything but role=LEARNER.
  nonLearnerEmail = `qa.users.nonlearner.${stamp}@example.com`
  const nonLearnerResp = await request.post(`${API}/users`, {
    headers: H,
    data: { fullName: `QA Users Manager ${stamp}`, email: nonLearnerEmail, password: 'Qatest!2345678', role: 'MANAGER', status: 'ACTIVE' },
  })
  const nonLearnerBody = await nonLearnerResp.json().catch(() => null)
  nonLearnerUserId = nonLearnerBody?.user?.id ?? null
})

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }
  // Unenroll first — same "no delete while enrolled" ordering rule as Learners.
  if (learnerUserId && enrollmentId) {
    await request.delete(`${API}/users/${learnerUserId}/courses/${enrollmentId}`, { headers: H }).catch(() => null)
  }
  if (learnerUserId) {
    await request.delete(`${API}/users/${learnerUserId}`, { headers: H }).catch(() => null)
    await request.delete(`${API}/users/${learnerUserId}/permanent`, { headers: H }).catch(() => null)
  }
  if (nonLearnerUserId) {
    await request.delete(`${API}/users/${nonLearnerUserId}`, { headers: H }).catch(() => null)
    await request.delete(`${API}/users/${nonLearnerUserId}/permanent`, { headers: H }).catch(() => null)
  }
  if (courseId) await request.delete(`${API}/courses/${courseId}`, { headers: H }).catch(() => null)
  if (instructorId) await request.delete(`${API}/instructors/${instructorId}`, { headers: H }).catch(() => null)
})

async function openDrawerFor(page: Page, email: string) {
  await page.goto('/users')
  const row = page.locator('tr', { hasText: email })
  await row.locator('button[title="View"]').click()
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
}

test('Non-learner user sees a disabled Assign Course button', async ({ page }) => {
  test.skip(!nonLearnerUserId || !nonLearnerEmail, 'Setup user was not created — backend may be unavailable')
  await openDrawerFor(page, nonLearnerEmail as string)
  await expect(page.getByText('No courses enrolled yet')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: '+ Assign Course' })).toBeDisabled()
})

test('Assigning a course to a learner shows it in the Courses tab', async ({ page }) => {
  test.skip(!learnerUserId || !courseId, 'Setup learner/course was not created — backend may be unavailable')

  await openDrawerFor(page, learnerEmail as string)
  await expect(page.getByRole('button', { name: '+ Assign Course' })).toBeEnabled()
  await page.getByRole('button', { name: '+ Assign Course' }).click()
  await expect(page.getByRole('heading', { name: 'Enroll in Course' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('Course', { exact: true }).selectOption({ label: courseTitle as string })

  const [enrollResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/learners/${learnerUserId}/enrollments`) && r.request().method() === 'POST', { timeout: 15000 }),
    page.getByLabel('Enroll in Course').getByRole('button', { name: 'Enroll', exact: true }).click(),
  ])
  expect(enrollResp.ok()).toBeTruthy()

  // Capture the real enrollment id for cleanup (afterAll never fabricates one).
  const listResp = await page.request.get(`${API}/users/${learnerUserId}/courses`, {
    headers: { Authorization: `Bearer ${savedToken}` },
  })
  const listBody = await listResp.json().catch(() => null)
  const match = (listBody?.courses ?? []).find((c: { courseId: string; enrollmentId: string }) => c.courseId === courseId)
  enrollmentId = match?.enrollmentId ?? null
  expect(enrollmentId, 'Enrollment must be findable via GET /users/:id/courses').toBeTruthy()

  await expect(page.getByText(courseTitle as string)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Not Started')).toBeVisible()
})

test('Unenrolling removes the course from the Courses tab', async ({ page }) => {
  test.skip(!learnerUserId || !enrollmentId, 'Depends on the assign test having run and captured a real enrollmentId')

  page.once('dialog', dialog => dialog.accept())
  await openDrawerFor(page, learnerEmail as string)
  await expect(page.getByText(courseTitle as string)).toBeVisible({ timeout: 10000 })

  const [unenrollResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/users/${learnerUserId}/courses/${enrollmentId}`) && r.request().method() === 'DELETE', { timeout: 15000 }),
    page.getByRole('button', { name: 'Unenroll' }).click(),
  ])
  expect(unenrollResp.ok()).toBeTruthy()
  enrollmentId = null // already gone — afterAll shouldn't try again
  await expect(page.getByText('No courses enrolled yet')).toBeVisible({ timeout: 10000 })
})
