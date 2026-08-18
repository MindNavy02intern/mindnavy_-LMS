// Tests for Course Submit — Step 6 of the Course Wizard.
// Covers: POST /courses/:id/submit, SUBMIT_CHECKS_FAILED errors[] rendering,
// wrong-state 400, success → Pending status, non-Draft guard.
//
// §4.1 sequencing: submit backend requires title + description + thumbnail +
// at least 1 section with 1 lesson. Setup creates all of these via real API
// before navigating to the submit step.
//
// Cleanup: all created courses are deleted in afterAll.

import { type Page, test, expect } from '@playwright/test'

const API = 'http://localhost:5001/api/admin'

const createdCourseIds: string[] = []
let savedToken = ''

async function getAuthHeaders(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  expect(token, 'mn_admin_token must exist in localStorage').toBeTruthy()
  savedToken = token
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function getInstructorId(page: Page, headers: Record<string, string>): Promise<string> {
  const res = await page.request.get(`${API}/courses?limit=1`, { headers })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.courses?.[0]?.instructorId
  expect(id, 'At least one course with an instructorId must exist').toBeTruthy()
  return id
}

/**
 * Creates a course that satisfies all submit readiness checks:
 * title + description + thumbnail + 1 section + 1 lesson.
 * Returns the courseId. (§4.1: all steps must complete before UI submit.)
 */
async function createReadyCourse(
  page: Page,
  headers: Record<string, string>,
  title: string,
  instructorId: string,
): Promise<string> {
  // 1. Create course with required fields
  const courseRes = await page.request.post(`${API}/courses`, {
    data: {
      title,
      instructorId,
      description: 'A test course description for submit testing.',
      thumbnail: 'https://example.com/thumb.jpg',
    },
    headers,
  })
  expect(courseRes.ok(), 'POST /courses must succeed').toBeTruthy()
  const courseBody = await courseRes.json()
  const courseId: string = courseBody.data?.id
  expect(courseId).toBeTruthy()
  createdCourseIds.push(courseId)

  // 2. Create section (must exist before lesson — §4.1)
  const sectionRes = await page.request.post(`${API}/courses/${courseId}/sections`, {
    data: { title: 'Section 1' },
    headers,
  })
  expect(sectionRes.ok(), 'POST /courses/:id/sections must succeed').toBeTruthy()
  const sectionBody = await sectionRes.json()
  const sectionId: string = sectionBody.data?.id
  expect(sectionId).toBeTruthy()

  // 3. Create lesson (section must already exist in DB — §4.1)
  const lessonRes = await page.request.post(`${API}/sections/${sectionId}/lessons`, {
    data: { title: 'Lesson 1', type: 'TEXT', content: 'Hello world.' },
    headers,
  })
  expect(lessonRes.ok(), 'POST /sections/:id/lessons must succeed').toBeTruthy()

  return courseId
}

/** Creates a minimal draft (no description/thumbnail/sections) — will fail submit checks. */
async function createBareCourse(
  page: Page,
  headers: Record<string, string>,
  title: string,
  instructorId: string,
): Promise<string> {
  const res = await page.request.post(`${API}/courses`, {
    data: { title, instructorId },
    headers,
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id).toBeTruthy()
  createdCourseIds.push(id)
  return id
}

async function navigateToSubmitStep(page: Page, courseTitle: string) {
  await page.goto('/learning-management')
  await page.locator('button', { hasText: /^Courses$/ }).first().click()
  await expect(page.locator('table')).toBeVisible({ timeout: 10000 })

  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: courseTitle }) })
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.locator(`button[aria-label="Edit ${courseTitle}"]`).click()

  await page.getByRole('button', { name: /Next: Course Builder/i }).click()
  await page.getByRole('button', { name: /Next: Settings/i }).click()
  await expect(page.getByText('Course Settings')).toBeVisible({ timeout: 5000 })

  // Settings → Preview (no changes so no PATCH)
  await page.getByRole('button', { name: /Next: Preview/i }).click()
  await expect(page.getByText('Course Preview')).toBeVisible({ timeout: 5000 })

  // Preview → Submit
  await page.getByRole('button', { name: /Next: Submit/i }).click()
  // getByRole('heading'): plain text also matches the "Submit for Review" button.
  // Two valid landing headings depending on course status (CourseSubmit.tsx):
  // Draft courses render "Submit for Review" (the real form); non-Draft
  // courses render "Submit Course" (the status-guard view) — both mean we've
  // successfully arrived at the Submit step.
  await expect(page.getByRole('heading', { name: /^Submit (for Review|Course)$/ })).toBeVisible({ timeout: 5000 })
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }
  for (const id of createdCourseIds) {
    await request.delete(`${API}/courses/${id}`, { headers: H }).catch(() => null)
  }
})

// ── Tests ─────────────────────────────────────────────────────────────────────

test('Submit: successfully submits a ready course → shows success + Pending', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Submit Ready ${Date.now()}`
  await createReadyCourse(page, H, title, instructorId)

  await navigateToSubmitStep(page, title)

  const submitResp = page.waitForResponse(
    r => r.url().includes('/submit') && r.request().method() === 'POST',
    { timeout: 15000 },
  )
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Submit for Review' }).click()
  const resp = await submitResp
  expect(resp.ok(), 'POST /submit must return 200').toBeTruthy()

  // Success state visible
  await expect(page.getByText('Submitted for Review!')).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: 'Back to Courses' })).toBeVisible()
})

test('Submit: SUBMIT_CHECKS_FAILED → renders full errors[] list', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Submit Bare ${Date.now()}`
  // Bare course: no description, no thumbnail, no sections
  await createBareCourse(page, H, title, instructorId)

  await navigateToSubmitStep(page, title)

  const submitResp = page.waitForResponse(
    r => r.url().includes('/submit') && r.request().method() === 'POST',
    { timeout: 15000 },
  )
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Submit for Review' }).click()
  const resp = await submitResp
  expect(resp.status(), 'Bare course should return 400').toBe(400)

  // All readiness errors must render in the list
  await expect(page.getByText('Course is not ready to submit')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(/Course needs a description/i)).toBeVisible()
  await expect(page.getByText(/Course needs a thumbnail/i)).toBeVisible()
  await expect(page.getByText(/Course needs at least one section/i)).toBeVisible()
})

test('Submit: course otherwise ready but has an empty attached quiz → blocked with quiz-specific error', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Submit EmptyQuiz ${Date.now()}`
  const courseId = await createReadyCourse(page, H, title, instructorId)

  // Attach a quiz with zero questions to this course (§4.1: course must exist first)
  const quizTitle = `Submit Guard Quiz ${Date.now()}`
  const quizRes = await page.request.post(`${API}/quizzes`, {
    data: { title: quizTitle, courseId },
    headers: H,
  })
  expect(quizRes.ok(), 'POST /quizzes must succeed').toBeTruthy()

  await navigateToSubmitStep(page, title)

  const submitResp = page.waitForResponse(
    r => r.url().includes('/submit') && r.request().method() === 'POST',
    { timeout: 15000 },
  )
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Submit for Review' }).click()
  const resp = await submitResp
  expect(resp.status(), 'Course with an empty quiz should return 400').toBe(400)

  await expect(page.getByText('Course is not ready to submit')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(`Quiz "${quizTitle}" has no questions.`)).toBeVisible()
})

test('Submit: non-Draft course shows status guard (no submit button)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Submit NonDraft ${Date.now()}`
  const courseId = await createReadyCourse(page, H, title, instructorId)

  // Submit the course via API to move it to Pending
  const submitApiResp = await page.request.post(`${API}/courses/${courseId}/submit`, { headers: H })
  expect(submitApiResp.ok(), 'API submit must succeed').toBeTruthy()

  // Navigate to the submit step via UI
  await navigateToSubmitStep(page, title)

  // The "Submit for Review" button should NOT be visible
  await expect(page.getByRole('button', { name: 'Submit for Review' })).not.toBeVisible({ timeout: 3000 })
  // A guard message should appear
  await expect(page.getByText(/already pending/i)).toBeVisible({ timeout: 3000 })
})

test('Submit: "Save as Draft" navigates back to course list', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Submit SaveDraft ${Date.now()}`
  await createBareCourse(page, H, title, instructorId)

  await navigateToSubmitStep(page, title)

  await page.getByRole('button', { name: 'Save as Draft' }).click()

  // Should return to the Courses list
  await expect(page.locator('table')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Submit for Review')).not.toBeVisible()
})

test('Submit: wrong-state 400 → shows exact backend message inline (not errors[] list)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Submit WrongState ${Date.now()}`
  const courseId = await createReadyCourse(page, H, title, instructorId)

  // Navigate to submit step while course is still Draft — submit button visible
  await navigateToSubmitStep(page, title)
  await expect(page.getByRole('button', { name: 'Submit for Review' })).toBeVisible({ timeout: 5000 })

  // Move course to Pending via API while UI React state still shows Draft
  await page.request.post(`${API}/courses/${courseId}/submit`, { headers: H })

  // Click Submit in the UI — POST /submit returns 400 wrong-state (no errors[] array)
  const submitResp = page.waitForResponse(
    r => r.url().includes('/submit') && r.request().method() === 'POST',
    { timeout: 15000 },
  )
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Submit for Review' }).click()
  const resp = await submitResp
  expect(resp.status(), 'Wrong-state should return 400').toBe(400)
  const body = await resp.json()
  expect(body.message, 'Backend must return a message for wrong-state').toBeTruthy()

  // Exact backend message must appear inline (sets submitMsg, not submitErrors)
  await expect(page.getByText(body.message)).toBeVisible({ timeout: 5000 })
  // The SUBMIT_CHECKS_FAILED errors list must NOT appear
  await expect(page.getByText('Course is not ready to submit')).not.toBeVisible()
})

test('Submit: button is disabled during in-flight request (double-submit prevented)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Submit DoubleClick ${Date.now()}`
  await createReadyCourse(page, H, title, instructorId)

  await navigateToSubmitStep(page, title)

  // Delay the POST /submit response so we can observe the in-flight disabled
  // state. 3000ms (not 1000ms) — under full-suite load the click→re-render
  // round trip can eat a meaningful chunk of a too-tight window, so a short
  // delay risks the assertion polling past the disabled state entirely
  // rather than actually catching a real regression.
  await page.route('**/courses/*/submit', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise<void>(r => setTimeout(r, 3000))
      await route.continue()
    } else {
      await route.continue()
    }
  })

  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Submit for Review' }).click()

  // While request is in flight the button must be disabled and show "Submitting…".
  // aria-label="Submit for Review" (CourseSubmit.tsx:255) is static — only the
  // visible text switches to "Submitting…" — so the accessible name never
  // actually changes; re-query by the stable aria-label instead.
  await expect(page.getByRole('button', { name: 'Submit for Review' })).toBeDisabled({ timeout: 8000 })

  // Let the request complete and verify success
  await expect(page.getByText('Submitted for Review!')).toBeVisible({ timeout: 10000 })
})

test('Submit: courses list shows Pending badge after submit without hard reload (invalidation)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Submit Invalidation ${Date.now()}`
  await createReadyCourse(page, H, title, instructorId)

  await navigateToSubmitStep(page, title)

  const submitResp = page.waitForResponse(
    r => r.url().includes('/submit') && r.request().method() === 'POST',
    { timeout: 15000 },
  )
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Submit for Review' }).click()
  await submitResp

  await expect(page.getByText('Submitted for Review!')).toBeVisible({ timeout: 5000 })

  // Click "Back to Courses" — view switches to list via React state (no page.reload())
  await page.getByRole('button', { name: 'Back to Courses' }).click()
  await expect(page.locator('table')).toBeVisible({ timeout: 5000 })

  // Find the row for our submitted course — invalidateFor() must have triggered a refetch
  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
  await expect(row).toBeVisible({ timeout: 10000 })

  // Status badge must show "Pending" — no hard reload, pure query invalidation
  await expect(row.getByText(/Pending/i)).toBeVisible({ timeout: 5000 })
})
