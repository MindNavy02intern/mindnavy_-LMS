import { type Page, test, expect } from '@playwright/test'

// Covers Phase 2 of the Instructor Dashboard (INSTRUCTOR_DASHBOARD_BLUEPRINT.docx
// Section 2.1 Dashboard + 2.2 My Profile): the self-scoped stats/enrollment-trend/
// activity endpoints, and the profile view/edit + document upload flow.
//
// Same beforeAll pattern as instructor-auth.full.spec.ts: grab the admin bearer
// token from an already-authenticated page (the 'authenticated' Playwright
// project's storageState), use it via raw `request` calls to create a disposable
// instructor + a disposable Draft course, then drive the REAL instructor login/
// dashboard/profile UI through `page` with no admin storageState involved.

const API = 'http://localhost:5001/api/admin'

let savedAdminToken: string | null = null
let testInstructorId: string | null = null
let testCourseId: string | null = null

const stamp = Date.now()
const testEmail = `qa.instructor.dashboard.${stamp}@example.com`
const testPassword = 'TestInstr123!'
const testFullName = `QA Instructor Dashboard ${stamp}`

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
  const instructorBody = await instructorResp.json()
  testInstructorId = instructorBody?.data?.id ?? null
  expect(testInstructorId).toBeTruthy()

  // One disposable Draft course so the Dashboard's "My Draft Courses" KPI
  // and admin's own coursesCount have real, matching, non-zero data to
  // cross-check against (not just an all-zeros smoke test).
  const courseResp = await request.post(`${API}/courses`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { title: `QA Dashboard Test Course ${stamp}`, instructorId: testInstructorId, category: 'Testing' },
  })
  expect(courseResp.status()).toBe(201)
  const courseBody = await courseResp.json()
  testCourseId = courseBody?.data?.id ?? null
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

test('Dashboard shows real stats matching the admin side for the same instructor', async ({ page, request }) => {
  // What admin sees for this instructor — the source of truth being reused.
  const adminDetailResp = await request.get(`${API}/instructors/${testInstructorId}`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
  })
  const adminDetail = (await adminDetailResp.json()).data

  await loginAsInstructor(page)

  // My Draft Courses KPI should equal admin's coursesCount (1 Draft course,
  // 0 published) — same underlying Course rows, same instructorsService.
  await expect(page.locator('.mn-lkpi-card', { hasText: 'My Draft Courses' })).toContainText('1')
  expect(adminDetail.coursesCount).toBe(1)
  expect(adminDetail.publishedCoursesCount).toBe(0)
  await expect(page.locator('.mn-lkpi-card', { hasText: 'My Published Courses' })).toContainText('0')

  // Welcome header shows the real name (same AppUser row admin created).
  await expect(page.locator(`text=Welcome back, ${testFullName}`)).toBeVisible()
})

test('Edit profile -> save -> reload -> changes persisted', async ({ page }) => {
  await loginAsInstructor(page)
  await page.click('a[href="/instructor/profile"], [href="/instructor/profile"]')
  await expect(page).toHaveURL(/\/instructor\/profile/)

  const bio = `QA profile bio ${stamp}`
  const specialization = `QA Specialization ${stamp}`

  const bioField = page.locator('textarea')
  await bioField.fill(bio)

  const specializationField = page.locator('input').first()
  await specializationField.fill(specialization)

  const saveResponse = page.waitForResponse(
    (res) => res.url().includes('/api/instructor/profile') && res.request().method() === 'PATCH',
  )
  await page.click('text=Save Changes')
  const res = await saveResponse
  expect(res.status()).toBe(200)
  await expect(page.locator('text=Profile updated.')).toBeVisible()

  await page.reload()
  await expect(page.locator('textarea')).toHaveValue(bio)
  await expect(page.locator('input').first()).toHaveValue(specialization)
})

test('Edit profile rejects a forbidden field at the API level (defense in depth)', async ({ request }) => {
  // The UI never sends email/status/revenueShareBps — this proves the
  // backend rejects them even if a client bypassed the form entirely.
  const loginResp = await request.post('http://localhost:5001/api/instructor/auth/login', {
    data: { email: testEmail, password: testPassword },
  })
  const { token } = await loginResp.json()

  const resp = await request.patch('http://localhost:5001/api/instructor/profile', {
    headers: { Authorization: `Bearer ${token}` },
    data: { revenueShareBps: 9000 },
  })
  expect(resp.status()).toBe(400)
  const body = await resp.json()
  expect(body.message).toMatch(/revenueShareBps/i)
})

test('Upload a document -> appears in the list', async ({ page }) => {
  await loginAsInstructor(page)
  await page.goto('/instructor/profile')
  await page.click('text=Documents')
  await page.click('text=Upload Document')

  await page.setInputFiles('input[type="file"]', {
    name: 'qa-test-id.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test file content for Playwright upload'),
  })

  const confirmResponse = page.waitForResponse(
    (res) => res.url().includes('/api/instructor/profile/documents/confirm') && res.request().method() === 'POST',
  )
  await page.click('button:has-text("Upload"):not(:has-text("Document"))')
  const res = await confirmResponse
  expect(res.status()).toBe(201)

  await expect(page.locator('text=qa-test-id.pdf')).toBeVisible()
  await expect(page.locator('text=PENDING')).toBeVisible()
})

test('A second instructor never sees the first instructor’s dashboard/profile data', async ({ page, request }) => {
  // Real cross-instructor check: two distinct AppUsers, two distinct
  // sessions, confirm each one's self-scoped endpoints only ever return
  // their OWN data. There is no :id parameter anywhere on these routes for
  // one instructor to guess/pass another's id — this proves the scoping
  // that replaces such a parameter (req.instructor.id from the session)
  // actually produces two different payloads for two different sessions,
  // not that a guessed id is blocked (there's nothing to guess).
  const email2 = `qa.instructor.dashboard.b.${stamp}@example.com`
  const password2 = 'TestInstrB123!'
  const fullName2 = `QA Instructor Dashboard B ${stamp}`

  const create2 = await request.post(`${API}/instructors`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { fullName: fullName2, email: email2, password: password2, status: 'ACTIVE' },
  })
  const instructor2Id = (await create2.json())?.data?.id

  try {
    await loginAsInstructor(page) // logs in as instructor A (has 1 draft course)
    await expect(page.locator('.mn-lkpi-card', { hasText: 'My Draft Courses' })).toContainText('1')

    // Fresh context for instructor B — separate localStorage, no shared session.
    const context2 = await page.context().browser()!.newContext()
    const page2 = await context2.newPage()
    await page2.goto('/instructor/login')
    await page2.fill('#instructor-login-email', email2)
    await page2.fill('#instructor-login-password', password2)
    await page2.click('button[type="submit"]')
    await expect(page2).toHaveURL(/\/instructor\/dashboard/)

    // Instructor B has zero courses — must show 0, never A's 1.
    await expect(page2.locator('.mn-lkpi-card', { hasText: 'My Draft Courses' })).toContainText('0')
    await expect(page2.locator(`text=Welcome back, ${fullName2}`)).toBeVisible()
    await expect(page2.locator(`text=${testFullName}`)).not.toBeVisible()

    await page2.goto('/instructor/profile')
    await expect(page2.locator(`text=${email2}`)).toBeVisible()
    await expect(page2.locator(`text=${testEmail}`)).not.toBeVisible()

    await context2.close()
  } finally {
    if (instructor2Id) {
      await request.delete(`${API}/instructors/${instructor2Id}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
    }
  }
})
