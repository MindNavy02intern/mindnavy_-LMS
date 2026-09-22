import { type Page, test, expect } from '@playwright/test'

// Covers Phase 3 of the Instructor Dashboard (INSTRUCTOR_DASHBOARD_BLUEPRINT.docx
// Section 2.3 My Courses): create -> author (section+lesson) -> submit ->
// admin approves -> instructor sees Published. Same beforeAll pattern as
// instructor-dashboard.full.spec.ts.

const API = 'http://localhost:5001/api/admin'

let savedAdminToken: string | null = null
let testInstructorId: string | null = null
let testCourseId: string | null = null

const stamp = Date.now()
const testEmail = `qa.instructor.courses.${stamp}@example.com`
const testPassword = 'TestInstr123!'
const testFullName = `QA Instructor Courses ${stamp}`
const courseTitle = `QA Playwright Course ${stamp}`

async function loginAsInstructor(page: Page) {
  await page.goto('/instructor/login')
  await page.fill('#instructor-login-email', testEmail)
  await page.fill('#instructor-login-password', testPassword)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/instructor\/dashboard/)
}

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/instructors')
  savedAdminToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()

  const instructorResp = await request.post(`${API}/instructors`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { fullName: testFullName, email: testEmail, password: testPassword, status: 'ACTIVE' },
  })
  expect(instructorResp.status()).toBe(201)
  testInstructorId = (await instructorResp.json())?.data?.id ?? null
  expect(testInstructorId).toBeTruthy()
})

test.afterAll(async ({ request }) => {
  if (testCourseId && savedAdminToken) {
    await request.delete(`${API}/courses/${testCourseId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
  if (testInstructorId && savedAdminToken) {
    await request.delete(`${API}/instructors/${testInstructorId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
})

test('Instructor creates a course through the real UI -> appears in Draft', async ({ page }) => {
  await loginAsInstructor(page)
  await page.click('text=+ Create Course')

  await page.fill('input[maxlength="200"]', courseTitle)

  const createResponse = page.waitForResponse(
    (res) => res.url().includes('/api/instructor/courses') && res.request().method() === 'POST',
  )
  await page.click('text=Create & Continue')
  const res = await createResponse
  expect(res.status()).toBe(201)
  const body = await res.json()
  testCourseId = body?.data?.id ?? null
  expect(testCourseId).toBeTruthy()

  // Create redirects straight into the builder.
  await expect(page).toHaveURL(/\/instructor\/courses\/.+\/builder/)

  await page.goto('/instructor/courses')
  await expect(page.locator(`text=${courseTitle}`)).toBeVisible()
})

test('Instructor adds a section and a lesson', async ({ page }) => {
  expect(testCourseId).toBeTruthy()
  await loginAsInstructor(page)
  await page.goto(`/instructor/courses/${testCourseId}/builder`)
  await page.click('text=2. Content')

  await page.fill('input[placeholder="New section title…"]', 'Section 1')
  const sectionResponse = page.waitForResponse(
    (res) => res.url().includes('/sections') && res.request().method() === 'POST',
  )
  await page.click('text=+ Add Section')
  expect((await sectionResponse).status()).toBe(201)

  await expect(page.locator('text=+ Add Lesson')).toBeVisible()
  await page.click('text=+ Add Lesson')
  await page.fill('input[maxlength="200"]', 'Lesson 1')
  await page.fill('textarea[maxlength="20000"]', 'Hello from Playwright.')

  const lessonResponse = page.waitForResponse(
    (res) => res.url().includes('/lessons') && res.request().method() === 'POST',
  )
  await page.getByRole('dialog', { name: 'Lesson' }).getByText('Save', { exact: true }).click()
  expect((await lessonResponse).status()).toBe(201)

  await expect(page.locator('text=Lesson 1')).toBeVisible()
})

test('Instructor submits for review -> moves to Pending Approval; admin approves -> instructor sees Published', async ({ page, request }) => {
  expect(testCourseId).toBeTruthy()

  // Submit requires title+description+thumbnail+section+lesson — set the
  // remaining readiness fields directly via the real update endpoint first
  // (already covered by the Basic Info form in the builder; done here via
  // API for test speed, same real PATCH the Save Draft button calls).
  await loginAsInstructor(page)
  const token = await page.evaluate(() => localStorage.getItem('mn_instructor_token'))
  await request.patch(`http://localhost:5001/api/instructor/courses/${testCourseId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { description: 'A Playwright test course.', thumbnail: 'https://example.com/thumb.png' },
  })

  await page.goto(`/instructor/courses/${testCourseId}/builder`)
  await page.click('text=6. Submit')
  const submitResponse = page.waitForResponse(
    (res) => res.url().includes('/submit') && res.request().method() === 'POST',
  )
  page.once('dialog', (d) => d.accept())
  await page.click('text=Submit for Review')
  expect((await submitResponse).status()).toBe(200)

  await expect(page).toHaveURL(/\/instructor\/courses$/)
  await page.click('text=Pending Approval')
  await expect(page.locator(`text=${courseTitle}`)).toBeVisible()

  // Admin approves via the existing, unmodified admin endpoint.
  const approveResp = await request.post(`${API}/courses/${testCourseId}/approve`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
  })
  expect(approveResp.ok()).toBeTruthy()

  await page.reload()
  await page.click('text=Published')
  await expect(page.locator(`text=${courseTitle}`)).toBeVisible()
})
