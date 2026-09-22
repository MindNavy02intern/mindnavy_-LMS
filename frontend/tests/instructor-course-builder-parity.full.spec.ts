import { type Page, test, expect } from '@playwright/test'

// Covers the Instructor Course Builder full-parity rebuild: real thumbnail
// upload (sign->PUT->confirm, mocked storage like course-upload.full.spec.ts),
// the new Quiz step (create quiz + add a question, self-scoped), the
// Settings step (pricing/visibility/certificate), and the Preview step.
// Section/lesson CRUD and Submit are already covered by
// instructor-courses.full.spec.ts — not duplicated here.

const API = 'http://localhost:5001/api/admin'
const INSTR_API = 'http://localhost:5001/api/instructor'

let savedAdminToken: string | null = null
let testInstructorId: string | null = null
let testCourseId: string | null = null

const stamp = Date.now()
const testEmail = `qa.instructor.builder.${stamp}@example.com`
const testPassword = 'TestInstr123!'
const testFullName = `QA Instructor Builder ${stamp}`
const courseTitle = `QA Parity Course ${stamp}`

const MOCK_SIGN = {
  uploadUrl: 'https://mock-storage.example.com/upload/signed-url',
  path: 'course-id-test/uuid-1-thumbnail.jpg',
  kind: 'thumbnail',
  maxBytes: 5 * 1024 * 1024,
  expiresIn: 600,
}
const MOCK_CONFIRM = {
  url: 'https://mock-storage.example.com/thumbnails/course-id-test/thumb.jpg',
}

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

  // Seed a course directly via the real instructor API (same call the "Create
  // Course" button makes) so every test below starts from a known Draft.
  const loginResp = await request.post(`${INSTR_API}/auth/login`, {
    data: { email: testEmail, password: testPassword },
  })
  expect(loginResp.ok()).toBeTruthy()
  const instrToken = (await loginResp.json())?.token
  const courseResp = await request.post(`${INSTR_API}/courses`, {
    headers: { Authorization: `Bearer ${instrToken}` },
    data: { title: courseTitle },
  })
  expect(courseResp.status()).toBe(201)
  testCourseId = (await courseResp.json())?.data?.id ?? null
  expect(testCourseId).toBeTruthy()
})

test.afterAll(async ({ request }) => {
  if (testCourseId && savedAdminToken) {
    await request.delete(`${API}/courses/${testCourseId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
  if (testInstructorId && savedAdminToken) {
    await request.delete(`${API}/instructors/${testInstructorId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
})

test('Basic Info step — real file thumbnail upload (sign -> PUT -> confirm)', async ({ page }) => {
  await loginAsInstructor(page)
  await page.goto(`/instructor/courses/${testCourseId}/builder`)
  await page.click('text=1. Basic Info')

  await page.route('**/uploads/sign', route => route.fulfill({ json: { success: true, data: MOCK_SIGN } }))
  await page.route('**/mock-storage.example.com/**', async route => {
    if (route.request().method() === 'PUT') await route.fulfill({ status: 200, body: '' })
    else await route.continue()
  })
  await page.route('**/uploads/confirm', route => route.fulfill({ json: { success: true, data: MOCK_CONFIRM } }))

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake jpeg data') })

  await expect(page.locator('[data-testid="instr-thumbnail-done"]')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Thumbnail uploaded')).toBeVisible()
})

test('Quiz step — create quiz, add a question, self-scoped to this course', async ({ page }) => {
  await loginAsInstructor(page)
  await page.goto(`/instructor/courses/${testCourseId}/builder`)
  await page.click('text=3. Quiz')

  await page.click('text=+ Create Quiz')
  await page.fill('input[maxlength="200"]', 'Module 1 Quiz')

  const createResponse = page.waitForResponse(
    (res) => res.url().includes(`/courses/${testCourseId}/quizzes`) && res.request().method() === 'POST',
  )
  await page.click('text=Create Quiz')
  const res = await createResponse
  expect(res.status()).toBe(201)

  await expect(page.locator('text=Module 1 Quiz')).toBeVisible()
  await page.click('text=Manage')

  await page.click('text=+ Add Question')
  await page.getByLabel('True / False').click()
  await page.fill('textarea', 'Is Playwright a testing tool?')
  await page.getByRole('button', { name: 'True', exact: true }).click()

  const questionResponse = page.waitForResponse(
    (res) => res.url().includes('/questions') && res.request().method() === 'POST',
  )
  await page.click('text=Save Question')
  expect((await questionResponse).status()).toBe(201)

  await expect(page.locator('text=Is Playwright a testing tool?')).toBeVisible()
})

test('Settings step — switch to paid, save, and persist on reload', async ({ page }) => {
  await loginAsInstructor(page)
  await page.goto(`/instructor/courses/${testCourseId}/builder`)
  await page.click('text=4. Settings')

  await page.getByRole('button', { name: 'Paid', exact: true }).click()
  await page.fill('input[type="number"][min="0.01"]', '29.99')

  const saveResponse = page.waitForResponse(
    (res) => res.url().includes('/settings') && res.request().method() === 'PATCH',
  )
  await page.click('text=Save Settings')
  expect((await saveResponse).status()).toBe(200)
  await expect(page.locator('text=Settings saved.')).toBeVisible()

  await page.reload()
  await page.click('text=4. Settings')
  await expect(page.getByRole('button', { name: 'Paid', exact: true })).toBeVisible()
  await expect(page.locator('input[type="number"][min="0.01"]')).toHaveValue('29.99')
})

test('Preview step — renders course content read-only', async ({ page }) => {
  await loginAsInstructor(page)
  await page.goto(`/instructor/courses/${testCourseId}/builder`)
  await page.click('text=5. Preview')

  await expect(page.locator('text=Course Content')).toBeVisible()
  await expect(page.locator(`text=${courseTitle}`)).toBeVisible()
})
