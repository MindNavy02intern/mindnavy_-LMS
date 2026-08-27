import { type Page, test, expect } from '@playwright/test'

// Covers Phase 1 of the Instructor Dashboard (INSTRUCTOR_DASHBOARD_BLUEPRINT.docx
// Section 0): the instructor login endpoint, requireInstructorAuth middleware,
// and the frontend login -> protected route -> /me flow, end to end.
//
// beforeAll reuses the standard pattern from instructor-applications.full.spec.ts
// (and others): open a page on an already-authenticated route to read the admin
// bearer token out of localStorage, then drive setup via raw `request` calls
// rather than the UI. The actual thing under test — the instructor login UI at
// /instructor/login — is exercised for real through `page`, deliberately with
// NO storageState of its own: InstructorAuthContext reads a separate
// localStorage key (mn_instructor_token) from the admin session
// (mn_admin_token), so the preloaded admin storageState from the
// 'authenticated' Playwright project neither helps nor interferes with this
// test — confirmed by design in Section 5 of App.tsx's InstructorAuthProvider
// scoping.

const API = 'http://localhost:5001/api/admin'
const INSTRUCTOR_API = 'http://localhost:5001/api/instructor/auth'

let savedAdminToken: string | null = null
let testInstructorId: string | null = null

const stamp = Date.now()
const testEmail = `qa.instructor.auth.${stamp}@example.com`
const testPassword = 'TestInstr123!'
const testFullName = `QA Instructor Auth ${stamp}`

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/instructors')
  savedAdminToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()

  const resp = await request.post(`${API}/instructors`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: {
      fullName: testFullName,
      email: testEmail,
      password: testPassword,
      status: 'ACTIVE',
    },
  })
  expect(resp.status()).toBe(201)
  const body = await resp.json()
  testInstructorId = body?.data?.id ?? null
  expect(testInstructorId).toBeTruthy()
})

test.afterAll(async ({ request }) => {
  if (testInstructorId && savedAdminToken) {
    await request.delete(`${API}/instructors/${testInstructorId}`, {
      headers: { Authorization: `Bearer ${savedAdminToken}` },
    })
  }
})

async function readInstructorToken(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem('mn_instructor_token'))
}

test('Instructor login page loads with email/password fields', async ({ page }) => {
  await page.goto('/instructor/login')
  await expect(page.locator('#instructor-login-email')).toBeVisible()
  await expect(page.locator('#instructor-login-password')).toBeVisible()
})

test('Instructor logs in with valid credentials -> redirected to dashboard stub', async ({ page }) => {
  await page.goto('/instructor/login')

  const loginResponse = page.waitForResponse(
    (res) => res.url().includes(`${INSTRUCTOR_API}/login`) && res.request().method() === 'POST',
  )

  await page.fill('#instructor-login-email', testEmail)
  await page.fill('#instructor-login-password', testPassword)
  await page.click('button[type="submit"]')

  const res = await loginResponse
  expect(res.status()).toBe(200)

  await expect(page).toHaveURL(/\/instructor\/dashboard/)
  await expect(page.locator(`text=${testFullName}`)).toBeVisible()

  const token = await readInstructorToken(page)
  expect(token).toBeTruthy()
})

test('Instructor login with wrong password shows a generic error, no session stored', async ({ page }) => {
  await page.goto('/instructor/login')

  await page.fill('#instructor-login-email', testEmail)
  await page.fill('#instructor-login-password', 'ThisIsWrong123!')
  await page.click('button[type="submit"]')

  await expect(page.locator('.mn-alert-error')).toContainText(/invalid email or password/i)
  await expect(page).toHaveURL(/\/instructor\/login/)

  const token = await readInstructorToken(page)
  expect(token).toBeFalsy()
})

test('Unauthenticated visit to /instructor/dashboard redirects to /instructor/login', async ({ page }) => {
  await page.goto('/instructor/dashboard')
  await expect(page).toHaveURL(/\/instructor\/login/)
})

test('Instructor session survives a hard reload (GET /me restores it)', async ({ page }) => {
  await page.goto('/instructor/login')
  await page.fill('#instructor-login-email', testEmail)
  await page.fill('#instructor-login-password', testPassword)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/instructor\/dashboard/)

  await page.reload()
  await expect(page).toHaveURL(/\/instructor\/dashboard/)
  await expect(page.locator(`text=${testFullName}`)).toBeVisible()
})

test('Instructor logs out -> redirected to login, session cleared', async ({ page }) => {
  await page.goto('/instructor/login')
  await page.fill('#instructor-login-email', testEmail)
  await page.fill('#instructor-login-password', testPassword)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/instructor\/dashboard/)

  await page.click('text=Sign Out')
  await expect(page).toHaveURL(/\/instructor\/login/)

  const token = await readInstructorToken(page)
  expect(token).toBeFalsy()

  // Revisiting the dashboard directly must bounce back to login now.
  await page.goto('/instructor/dashboard')
  await expect(page).toHaveURL(/\/instructor\/login/)
})

test('A suspended instructor cannot log in', async ({ page, request }) => {
  expect(testInstructorId).toBeTruthy()
  expect(savedAdminToken).toBeTruthy()

  const suspendResp = await request.patch(`${API}/instructors/${testInstructorId}/suspend`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { reason: 'Playwright instructor-auth.full.spec.ts suspend-lockout coverage' },
  })
  expect(suspendResp.ok()).toBeTruthy()

  await page.goto('/instructor/login')
  await page.fill('#instructor-login-email', testEmail)
  await page.fill('#instructor-login-password', testPassword)
  await page.click('button[type="submit"]')

  await expect(page.locator('.mn-alert-error')).toContainText(/access denied/i)
  await expect(page).toHaveURL(/\/instructor\/login/)

  // Reactivate so afterAll's DELETE (which 409s while suspended-with-content
  // isn't the concern here, but a clean ACTIVE row is the tidier teardown
  // state) isn't left in a suspended state for the next run.
  await request.patch(`${API}/instructors/${testInstructorId}/reactivate`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: {},
  })
})
