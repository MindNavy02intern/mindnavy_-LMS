import { type Page, test, expect } from '@playwright/test'

// Covers Phase 4 of the Instructor Dashboard (INSTRUCTOR_DASHBOARD_BLUEPRINT.docx
// Section 2.5 My Students, plus the task-spec-only Learning Paths visibility
// tab on My Courses). Same beforeAll/afterAll API-setup pattern as
// instructor-courses.full.spec.ts: an admin session creates the fixtures,
// the instructor logs in through the real UI for the actual assertions.

const ADMIN_API = 'http://localhost:5001/api/admin'
const INSTRUCTOR_AUTH_API = 'http://localhost:5001/api/instructor/auth'

let savedAdminToken: string | null = null
let instructorToken: string | null = null
let testInstructorId: string | null = null
let testLearnerId: string | null = null
let testCourseId: string | null = null
let testEnrollmentId: string | null = null
let testPathId: string | null = null

const stamp = Date.now()
const instructorEmail = `qa.instructor.students.${stamp}@example.com`
const instructorPassword = 'TestInstr123!'
const instructorFullName = `QA Instructor Students ${stamp}`
const learnerEmail = `qa.learner.students.${stamp}@example.com`
const learnerPassword = 'TestLearner123!'
const learnerFullName = `QA Learner Students ${stamp}`
const courseTitle = `QA Students Course ${stamp}`
const pathTitle = `QA Students Path ${stamp}`

async function loginAsInstructor(page: Page) {
  await page.goto('/instructor/login')
  await page.fill('#instructor-login-email', instructorEmail)
  await page.fill('#instructor-login-password', instructorPassword)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/instructor\/dashboard/)
}

test.beforeAll(async ({ browser, request }) => {
  // Admin token (reused pattern: read it out of an already-authenticated
  // admin browser context — see instructor-courses.full.spec.ts).
  const page = await browser.newPage()
  await page.goto('/instructors')
  savedAdminToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()

  const instructorResp = await request.post(`${ADMIN_API}/instructors`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { fullName: instructorFullName, email: instructorEmail, password: instructorPassword, status: 'ACTIVE' },
  })
  expect(instructorResp.status()).toBe(201)
  testInstructorId = (await instructorResp.json())?.data?.id ?? null
  expect(testInstructorId).toBeTruthy()

  const learnerResp = await request.post(`${ADMIN_API}/learners`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { fullName: learnerFullName, email: learnerEmail, password: learnerPassword, status: 'ACTIVE' },
  })
  expect(learnerResp.status()).toBe(201)
  testLearnerId = (await learnerResp.json())?.data?.id ?? null
  expect(testLearnerId).toBeTruthy()

  const instructorLoginResp = await request.post(`${INSTRUCTOR_AUTH_API}/login`, {
    data: { email: instructorEmail, password: instructorPassword },
  })
  expect(instructorLoginResp.status()).toBe(200)
  instructorToken = (await instructorLoginResp.json())?.token ?? null
  expect(instructorToken).toBeTruthy()

  const courseResp = await request.post('http://localhost:5001/api/instructor/courses', {
    headers: { Authorization: `Bearer ${instructorToken}` },
    data: { title: courseTitle },
  })
  expect(courseResp.status()).toBe(201)
  testCourseId = (await courseResp.json())?.data?.id ?? null
  expect(testCourseId).toBeTruthy()

  const enrollResp = await request.post(`${ADMIN_API}/enrollments`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { courseId: testCourseId, userId: testLearnerId },
  })
  expect(enrollResp.status()).toBe(201)
  testEnrollmentId = (await enrollResp.json())?.data?.id ?? null

  const pathResp = await request.post(`${ADMIN_API}/learning-paths`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { title: pathTitle },
  })
  expect(pathResp.status()).toBe(201)
  testPathId = (await pathResp.json())?.data?.id ?? null

  const itemResp = await request.post(`${ADMIN_API}/learning-paths/${testPathId}/items`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { itemType: 'COURSE', itemId: testCourseId },
  })
  expect(itemResp.status()).toBe(201)
})

test.afterAll(async ({ request }) => {
  if (testPathId && savedAdminToken) {
    await request.delete(`${ADMIN_API}/learning-paths/${testPathId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
  if (testLearnerId && testEnrollmentId && savedAdminToken) {
    await request.delete(`${ADMIN_API}/learners/${testLearnerId}/enrollments/${testEnrollmentId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
  if (testCourseId && savedAdminToken) {
    await request.delete(`${ADMIN_API}/courses/${testCourseId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
  if (testLearnerId && savedAdminToken) {
    await request.delete(`${ADMIN_API}/learners/${testLearnerId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
  if (testInstructorId && savedAdminToken) {
    await request.delete(`${ADMIN_API}/instructors/${testInstructorId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
})

test('My Students lists a learner enrolled in the instructor\'s own course', async ({ page }) => {
  await loginAsInstructor(page)

  const listResponse = page.waitForResponse(
    (res) => res.url().includes('/api/instructor/students') && res.request().method() === 'GET' && !res.url().includes('/assessments') && !res.url().includes('/attendance'),
  )
  await page.goto('/instructor/students')
  await listResponse

  await expect(page.locator(`text=${learnerFullName}`)).toBeVisible()
  await expect(page.locator(`text=${courseTitle}`)).toBeVisible()
})

test('Course filter narrows the list to the selected course only', async ({ page }) => {
  await loginAsInstructor(page)
  await page.goto('/instructor/students')
  await expect(page.locator(`text=${learnerFullName}`)).toBeVisible()

  await page.selectOption('[aria-label="Filter by course"]', { label: courseTitle })
  await expect(page.locator(`text=${learnerFullName}`)).toBeVisible()

  // A course this instructor doesn't teach must never appear as an option
  // (server-side scoping, not just client-side hiding — see
  // instructorStudents.service.js listMyStudents).
  const options = await page.locator('[aria-label="Filter by course"] option').allTextContents()
  expect(options.filter((o) => o !== 'All my courses')).toEqual([courseTitle])
})

test('Side panel shows Courses/Assessments/Attendance tabs scoped to this instructor', async ({ page }) => {
  await loginAsInstructor(page)
  await page.goto('/instructor/students')
  await expect(page.locator(`text=${learnerFullName}`)).toBeVisible()

  const detailResponse = page.waitForResponse(
    (res) => res.url().includes('/api/instructor/students/') && res.request().method() === 'GET' && !res.url().includes('?'),
  )
  await page.click(`text=${learnerFullName}`)
  await detailResponse

  const panel = page.getByRole('dialog', { name: 'Student in My Course' })
  await expect(panel).toBeVisible()
  await expect(panel.locator(`text=${courseTitle}`)).toBeVisible()

  const assessmentsResponse = page.waitForResponse((res) => res.url().includes('/assessments'))
  await panel.locator('button', { hasText: 'assessments' }).click()
  await assessmentsResponse
  await expect(panel.locator('text=No quiz attempts on your courses yet.')).toBeVisible()

  const attendanceResponse = page.waitForResponse((res) => res.url().includes('/attendance'))
  await panel.locator('button', { hasText: 'attendance' }).click()
  await attendanceResponse
  await expect(panel.locator('text=No attendance records for your sessions yet.')).toBeVisible()

  await panel.getByRole('button', { name: 'Close' }).click()
  await expect(panel).not.toBeVisible()
})

test('Learning Paths tab on My Courses shows the path with the instructor\'s course highlighted', async ({ page }) => {
  await loginAsInstructor(page)

  const listResponse = page.waitForResponse((res) => res.url().includes('/api/instructor/learning-paths') && res.request().method() === 'GET')
  await page.goto('/instructor/courses')
  await page.click('text=Learning Paths')
  await listResponse

  await expect(page.locator(`text=${pathTitle}`)).toBeVisible()
  await expect(page.locator(`text=${courseTitle}`)).toBeVisible()

  const detailResponse = page.waitForResponse((res) => res.url().includes(`/api/instructor/learning-paths/${testPathId}`))
  await page.click(`text=${pathTitle}`)
  await detailResponse

  const modal = page.getByRole('dialog', { name: 'Learning path sequence' })
  await expect(modal).toBeVisible()
  await expect(modal.locator('text=YOUR COURSE')).toBeVisible()
})
