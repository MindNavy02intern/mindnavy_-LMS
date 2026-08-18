// Enrollments tab — end-to-end tests (ENROLLMENTS_CONTRACT.md v1).
// Rides the EXISTING course_enrollments table — verified live against the
// real backend before writing this suite (GET /enrollments returned real
// rows with statusCounts.All capitalized, matching the contract exactly).
//
// §4.1: a course must exist (via a real API call) before a learner can be
// enrolled into it. Every fixture course created here is captured by its
// real returned id and archived in afterAll — never assumed.
//
// Run with: npx playwright test enrollments.full --workers=1

import { type Page, test, expect } from '@playwright/test'

const API = 'http://localhost:5001/api/admin'

let savedToken = ''
const createdCourseIds: string[] = []
const createdEnrollmentIds: string[] = []
let createdLearnerId: string | null = null

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }
  for (const id of createdEnrollmentIds) {
    await request.delete(`${API}/enrollments/${id}`, { headers: H }).catch(() => null)
  }
  for (const id of createdCourseIds) {
    await request.delete(`${API}/courses/${id}`, { headers: H }).catch(() => null)
  }
  // Unenroll first — deleteLearner 409s while any non-completed enrollment
  // still exists (same rule as deleteInstructor).
  if (createdLearnerId) {
    const listResp = await request.get(`${API}/learners/${createdLearnerId}/enrollments`, { headers: H }).catch(() => null)
    const listBody = await listResp?.json().catch(() => null)
    for (const e of listBody?.data?.enrollments ?? []) {
      await request.delete(`${API}/learners/${createdLearnerId}/enrollments/${e.id}`, { headers: H }).catch(() => null)
    }
    await request.delete(`${API}/learners/${createdLearnerId}`, { headers: H }).catch(() => null)
  }
})

async function ensureToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  expect(token, 'mn_admin_token must exist in localStorage').toBeTruthy()
  savedToken = token
  return token
}

async function apiHeaders(page: Page) {
  const token = await ensureToken(page)
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function getInstructorId(page: Page, H: Record<string, string>): Promise<string> {
  const res = await page.request.get(`${API}/users?role=instructor&limit=1`, { headers: H })
  const body = await res.json()
  const id: string = body.users?.[0]?.id
  expect(id, 'At least one INSTRUCTOR user must exist').toBeTruthy()
  return id
}

// A dedicated fixture, not "whatever learner happens to be first" — an
// existing/accumulated learner can carry unrelated enrollment history from
// other test runs sharing this dev DB, which breaks exact-name/row-count
// assertions here in ways that have nothing to do with this file's own flow.
async function getLearner(page: Page, H: Record<string, string>): Promise<{ id: string; name: string }> {
  if (createdLearnerId) {
    const res = await page.request.get(`${API}/learners/${createdLearnerId}`, { headers: H })
    const body = await res.json()
    return { id: createdLearnerId, name: body.data?.fullName }
  }
  const stamp = Date.now()
  const name = `Enroll Fixture Learner ${stamp}`
  const res = await page.request.post(`${API}/learners`, {
    data: { fullName: name, email: `enroll.fixture.${stamp}@example.com`, password: 'Qatest!2345678', status: 'ACTIVE' },
    headers: H,
  })
  expect(res.ok(), 'POST /learners must succeed').toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id, 'Learner id must be returned').toBeTruthy()
  createdLearnerId = id
  return { id, name }
}

async function createFixtureCourse(page: Page, H: Record<string, string>, title: string): Promise<{ id: string }> {
  const instructorId = await getInstructorId(page, H)
  const res = await page.request.post(`${API}/courses`, { data: { title, instructorId }, headers: H })
  expect(res.ok(), `POST /courses must succeed for "${title}"`).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id).toBeTruthy()
  createdCourseIds.push(id)
  return { id }
}

async function gotoEnrollmentsTab(page: Page) {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Enrollments', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=enrollments/)
  await expect(page.getByRole('heading', { name: 'Enrollments', exact: true })).toBeVisible({ timeout: 10000 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('Enroll flow — dialog validates, submits, appears with NOT_STARTED / 0% progress', async ({ page }) => {
  await gotoEnrollmentsTab(page)
  const H = await apiHeaders(page)
  const learner = await getLearner(page, H)
  const courseTitle = `Enroll Test Course ${Date.now()}`
  const course = await createFixtureCourse(page, H, courseTitle)

  await page.getByRole('button', { name: 'Enroll Learner', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Enroll Learner' })).toBeVisible({ timeout: 5000 })

  // Submit disabled until both selected
  await expect(page.getByRole('button', { name: 'Enroll', exact: true })).toBeDisabled()

  // exact: true — non-exact "Learner"/"Course" also substring-matches the
  // dialog's own aria-label ("Enroll learner"), which strict-mode-violates
  // or resolves to the wrong element.
  await page.getByLabel('Learner', { exact: true }).selectOption({ value: learner.id })
  await page.getByLabel('Course', { exact: true }).selectOption({ value: course.id })
  await expect(page.getByRole('button', { name: 'Enroll', exact: true })).toBeEnabled()

  const postResp = page.waitForResponse(
    (r) => r.url().includes('/enrollments') && r.request().method() === 'POST',
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Enroll', exact: true }).click()
  const resp = await postResp
  expect(resp.ok(), 'POST /enrollments must succeed').toBeTruthy()
  const body = await resp.json()
  const id: string = body.data?.id
  expect(id, 'POST must return an enrollment id').toBeTruthy()
  createdEnrollmentIds.push(id)

  await expect(page.getByRole('heading', { name: 'Enrollments', exact: true })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(learner.name)).toBeVisible({ timeout: 5000 })
  // Scoped to this learner's row, exact match — every "X0%" progress value
  // in the list (100%, 50%, 40%, …) substring-matches a bare "0%".
  const row = page.locator('tr', { hasText: learner.name })
  await expect(row.getByText('0%', { exact: true })).toBeVisible()
})

test('Already enrolled — real backend 400 shown next to the submit button, not a toast', async ({ page }) => {
  await gotoEnrollmentsTab(page)
  const H = await apiHeaders(page)
  const learner = await getLearner(page, H)
  const courseTitle = `Dup Enroll Course ${Date.now()}`
  const course = await createFixtureCourse(page, H, courseTitle)

  // Enroll once via the real API directly (fixture setup, not the assertion under test).
  const firstRes = await page.request.post(`${API}/enrollments`, {
    data: { courseId: course.id, userId: learner.id }, headers: H,
  })
  expect(firstRes.ok()).toBeTruthy()
  const firstId: string = (await firstRes.json()).data?.id
  createdEnrollmentIds.push(firstId)

  // gotoEnrollmentsTab() already does its own page.goto('/learning-management')
  // — an extra one immediately before it fires two full browser navigations
  // back to back, and the button click below then races whichever one the
  // page happens to still be settling from.
  await gotoEnrollmentsTab(page)
  await page.getByRole('button', { name: 'Enroll Learner', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Enroll Learner' })).toBeVisible({ timeout: 5000 })
  // exact: true — non-exact "Learner"/"Course" also substring-matches the
  // dialog's own aria-label ("Enroll learner"), which strict-mode-violates
  // or resolves to the wrong element.
  await page.getByLabel('Learner', { exact: true }).selectOption({ value: learner.id })
  await page.getByLabel('Course', { exact: true }).selectOption({ value: course.id })

  await page.getByRole('button', { name: 'Enroll', exact: true }).click()

  // Exact backend message rendered inside the dialog, right above the submit button.
  const dialog = page.getByRole('dialog', { name: 'Enroll learner' })
  await expect(dialog.getByRole('alert')).toBeVisible({ timeout: 5000 })
  await expect(dialog.getByRole('button', { name: 'Enroll', exact: true })).toBeVisible()
})

test('Course full — exact "Course is full" backend message shown next to submit (* mock)', async ({ page }) => {
  await gotoEnrollmentsTab(page)
  const H = await apiHeaders(page)
  const learner = await getLearner(page, H)
  const courseTitle = `Full Course Test ${Date.now()}`
  const course = await createFixtureCourse(page, H, courseTitle)

  await page.route('**/enrollments/', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 400, json: { success: false, message: 'Course is full: its enrollment limit has been reached.' } })
    } else {
      route.continue()
    }
  })

  await page.getByRole('button', { name: 'Enroll Learner', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Enroll Learner' })).toBeVisible({ timeout: 5000 })
  // exact: true — non-exact "Learner"/"Course" also substring-matches the
  // dialog's own aria-label ("Enroll learner"), which strict-mode-violates
  // or resolves to the wrong element.
  await page.getByLabel('Learner', { exact: true }).selectOption({ value: learner.id })
  await page.getByLabel('Course', { exact: true }).selectOption({ value: course.id })
  await page.getByRole('button', { name: 'Enroll', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Enroll learner' })
  await expect(dialog.getByRole('alert')).toContainText('Course is full: its enrollment limit has been reached.', { timeout: 5000 })
})

test('Status change — PATCH sends {status} ONLY, progress never in the request body', async ({ page }) => {
  await gotoEnrollmentsTab(page)
  const H = await apiHeaders(page)
  const learner = await getLearner(page, H)
  const courseTitle = `Status Change Course ${Date.now()}`
  const course = await createFixtureCourse(page, H, courseTitle)

  const enrollRes = await page.request.post(`${API}/enrollments`, {
    data: { courseId: course.id, userId: learner.id }, headers: H,
  })
  expect(enrollRes.ok()).toBeTruthy()
  const enrollmentId: string = (await enrollRes.json()).data?.id
  createdEnrollmentIds.push(enrollmentId)

  // gotoEnrollmentsTab() already does its own page.goto('/learning-management')
  // — an extra one immediately before it fires two full browser navigations
  // back to back, and the button click below then races whichever one the
  // page happens to still be settling from.
  await gotoEnrollmentsTab(page)
  // Scoped to this test's own row (learner + course title) — the dedicated
  // fixture learner accumulates one enrollment per test across this file, so
  // by this point a bare getByLabel('Status for <learner>') matches every
  // one of that learner's rows, not just this one.
  const row = page.locator('tr', { hasText: learner.name }).filter({ hasText: courseTitle })
  await expect(row).toBeVisible({ timeout: 10000 })

  let capturedBody: unknown = null
  page.on('request', (req) => {
    if (req.method() === 'PATCH' && req.url().includes(`/enrollments/${enrollmentId}`)) {
      capturedBody = req.postDataJSON()
    }
  })

  const patchResp = page.waitForResponse(
    (r) => r.url().includes(`/enrollments/${enrollmentId}`) && r.request().method() === 'PATCH',
    { timeout: 10000 },
  )
  await row.getByLabel(`Status for ${learner.name}`).selectOption('COMPLETED')
  const resp = await patchResp
  expect(resp.ok(), 'PATCH must succeed').toBeTruthy()

  expect(capturedBody, 'PATCH body must have been captured').toBeTruthy()
  expect(Object.keys(capturedBody as object)).toEqual(['status'])
  expect((capturedBody as { status: string }).status).toBe('COMPLETED')

  // A native <select>'s <option> children are never "visible" while the
  // dropdown is closed — every row's status select has its own "Completed"
  // option regardless of what's currently selected, so getByText here just
  // matched invisible option elements. Check the select's actual value instead.
  await expect(row.getByLabel(`Status for ${learner.name}`)).toHaveValue('COMPLETED')
})

test('Unenroll — DELETE fires, confirm dialog stays neutral (never mentions certificates)', async ({ page }) => {
  await gotoEnrollmentsTab(page)
  const H = await apiHeaders(page)
  const learner = await getLearner(page, H)
  const course = await createFixtureCourse(page, H, `Unenroll Course ${Date.now()}`)

  const enrollRes = await page.request.post(`${API}/enrollments`, {
    data: { courseId: course.id, userId: learner.id }, headers: H,
  })
  expect(enrollRes.ok()).toBeTruthy()
  const enrollmentId: string = (await enrollRes.json()).data?.id

  // gotoEnrollmentsTab() already does its own page.goto('/learning-management')
  // — an extra one immediately before it fires two full browser navigations
  // back to back, and the button click below then races whichever one the
  // page happens to still be settling from.
  await gotoEnrollmentsTab(page)
  await expect(page.getByText(learner.name).first()).toBeVisible({ timeout: 10000 })

  let dialogMessage = ''
  page.once('dialog', (d) => { dialogMessage = d.message(); d.accept() })

  const deleteResp = page.waitForResponse(
    (r) => r.url().includes(`/enrollments/${enrollmentId}`) && r.request().method() === 'DELETE',
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: `Unenroll ${learner.name}` }).first().click()
  const resp = await deleteResp
  expect(resp.ok()).toBeTruthy()

  expect(dialogMessage.toLowerCase()).not.toContain('certificate')
})

test('Status chips share filters except status — "All" count matches list total', async ({ page }) => {
  await gotoEnrollmentsTab(page)
  await expect(page.getByRole('button', { name: /^All \(\d+\)$/ })).toBeVisible({ timeout: 10000 })
})
