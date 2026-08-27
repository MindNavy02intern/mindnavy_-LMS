import { type Page, test, expect } from '@playwright/test'

// Covers Phase 3 of the Instructor Dashboard (INSTRUCTOR_DASHBOARD_BLUEPRINT.docx
// Section 2.4 My Live Sessions): schedule (real Zoom meeting) -> edit -> cancel.
// Same beforeAll pattern as instructor-courses.full.spec.ts.

const API = 'http://localhost:5001/api/admin'

let savedAdminToken: string | null = null
let testInstructorId: string | null = null

const stamp = Date.now()
const testEmail = `qa.instructor.livesessions.${stamp}@example.com`
const testPassword = 'TestInstr123!'
const testFullName = `QA Instructor LiveSessions ${stamp}`
const sessionTitle = `QA Playwright Session ${stamp}`
const sessionTitleEdited = `${sessionTitle} (edited)`

async function loginAsInstructor(page: Page) {
  await page.goto('/instructor/login')
  await page.fill('#instructor-login-email', testEmail)
  await page.fill('#instructor-login-password', testPassword)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/instructor\/dashboard/)
}

function tomorrowLocalInputValue(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  if (testInstructorId && savedAdminToken) {
    await request.delete(`${API}/instructors/${testInstructorId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
})

test('Instructor schedules a session through the real UI -> appears in Upcoming (real Zoom meeting)', async ({ page }) => {
  await loginAsInstructor(page)
  await page.click('text=+ Schedule Session')

  await page.fill('input[maxlength="200"]', sessionTitle)
  await page.fill('input[type="datetime-local"]', tomorrowLocalInputValue())

  const createResponse = page.waitForResponse(
    (res) => res.url().endsWith('/api/instructor/live-sessions') && res.request().method() === 'POST',
  )
  await page.click('text=Schedule', { exact: true })
  const res = await createResponse
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body?.data?.joinUrl).toBeTruthy() // real Zoom join link, not a stub

  await expect(page.locator(`text=${sessionTitle}`)).toBeVisible()
})

test('Instructor edits the session -> changes persist', async ({ page }) => {
  await loginAsInstructor(page)
  await expect(page.locator(`text=${sessionTitle}`)).toBeVisible()

  const row = page.locator('tr', { hasText: sessionTitle })
  await row.getByText('Edit', { exact: true }).click()

  const titleInput = page.locator('input[maxlength="200"]')
  await titleInput.fill(sessionTitleEdited)

  const updateResponse = page.waitForResponse(
    (res) => /\/api\/instructor\/live-sessions\/[^/]+$/.test(res.url()) && res.request().method() === 'PATCH',
  )
  await page.click('text=Save Changes')
  expect((await updateResponse).status()).toBe(200)

  await expect(page.locator(`text=${sessionTitleEdited}`)).toBeVisible()

  await page.reload()
  await expect(page.locator(`text=${sessionTitleEdited}`)).toBeVisible()
})

test('Instructor cancels the session -> removed from the list', async ({ page }) => {
  await loginAsInstructor(page)
  await expect(page.locator(`text=${sessionTitleEdited}`)).toBeVisible()

  const row = page.locator('tr', { hasText: sessionTitleEdited })
  page.once('dialog', (d) => d.accept())
  const deleteResponse = page.waitForResponse(
    (res) => /\/api\/instructor\/live-sessions\/[^/]+$/.test(res.url()) && res.request().method() === 'DELETE',
  )
  await row.getByText('Cancel', { exact: true }).click()
  expect((await deleteResponse).status()).toBe(200)

  await expect(page.locator(`text=${sessionTitleEdited}`)).not.toBeVisible()
})
