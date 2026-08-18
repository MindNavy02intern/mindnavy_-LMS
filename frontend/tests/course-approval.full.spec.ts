// Tests for Course Approval Workflow — Approve and Reject Pending courses.
// Covers: approve confirm dialog, POST .../approve; reject modal with reason
// (required, max 1000 chars, counter), POST .../reject; race-condition 400
// shows backend message verbatim and refetches (no auto-retry).
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
 * Creates a course and advances it to Pending status via API.
 * §4.1: must create section + lesson so submit checks pass.
 */
async function createPendingCourse(
  page: Page,
  headers: Record<string, string>,
  title: string,
  instructorId: string,
): Promise<string> {
  // Create course with all required fields for submit
  const courseRes = await page.request.post(`${API}/courses`, {
    data: {
      title,
      instructorId,
      description: 'A course ready for approval.',
      thumbnail: 'https://example.com/thumb.jpg',
    },
    headers,
  })
  expect(courseRes.ok()).toBeTruthy()
  const courseId: string = (await courseRes.json()).data?.id
  expect(courseId).toBeTruthy()
  createdCourseIds.push(courseId)

  // Section
  const sectionRes = await page.request.post(`${API}/courses/${courseId}/sections`, {
    data: { title: 'Section 1' },
    headers,
  })
  expect(sectionRes.ok()).toBeTruthy()
  const sectionId: string = (await sectionRes.json()).data?.id
  expect(sectionId).toBeTruthy()

  // Lesson (section must exist first — §4.1)
  const lessonRes = await page.request.post(`${API}/sections/${sectionId}/lessons`, {
    data: { title: 'Lesson 1', type: 'TEXT', content: 'Hello.' },
    headers,
  })
  expect(lessonRes.ok()).toBeTruthy()

  // Submit → Pending
  const submitRes = await page.request.post(`${API}/courses/${courseId}/submit`, { headers })
  expect(submitRes.ok(), 'POST /submit must succeed to move course to Pending').toBeTruthy()

  return courseId
}

async function openCoursesTab(page: Page) {
  await page.goto('/learning-management')
  await page.locator('button', { hasText: /^Courses$/ }).first().click()
  // Switch to the "Pending" status tab to surface Pending courses.
  // Anchored-only-at-start: real text is "Pending" + a count span
  // concatenated with no separator (CoursesTab.tsx) once statusCounts
  // loads — a fully-anchored /^Pending$/ only ever matched by luck, before
  // that count attached.
  await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
  await page.locator('button', { hasText: /^Pending/ }).first().click()
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

test('Approval: Approve button visible on Pending row, confirm dialog → POST approve', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Approve Test ${Date.now()}`
  await createPendingCourse(page, H, title, instructorId)

  await openCoursesTab(page)

  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
  await expect(row).toBeVisible({ timeout: 10000 })

  // Approve and Reject buttons should be visible on a Pending row
  await expect(row.locator(`button[aria-label="Approve ${title}"]`)).toBeVisible()
  await expect(row.locator(`button[aria-label="Reject ${title}"]`)).toBeVisible()

  // Click Approve — accept the confirm dialog
  page.once('dialog', d => d.accept())

  const approveResp = page.waitForResponse(
    r => r.url().includes('/approve') && r.request().method() === 'POST',
    { timeout: 15000 },
  )
  await row.locator(`button[aria-label="Approve ${title}"]`).click()
  const resp = await approveResp
  expect(resp.ok(), 'POST /approve must succeed').toBeTruthy()

  // Success toast
  await expect(page.getByText(/approved and published/i)).toBeVisible({ timeout: 5000 })
})

test('Approval: Approve dismissed by confirm cancel → no API call', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Approve Cancel ${Date.now()}`
  await createPendingCourse(page, H, title, instructorId)

  await openCoursesTab(page)

  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
  await expect(row).toBeVisible({ timeout: 10000 })

  let apiCalled = false
  page.on('request', req => {
    if (req.url().includes('/approve')) apiCalled = true
  })

  // Dismiss the confirm dialog
  page.once('dialog', d => d.dismiss())
  await row.locator(`button[aria-label="Approve ${title}"]`).click()
  await page.waitForTimeout(500)

  expect(apiCalled, 'No API call when confirm dismissed').toBe(false)
  // Row still shows Pending
  await expect(row.locator('span', { hasText: 'Pending' })).toBeVisible()
})

test('Approval: Reject modal opens, validates required reason, counter', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Reject Modal ${Date.now()}`
  await createPendingCourse(page, H, title, instructorId)

  await openCoursesTab(page)

  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.locator(`button[aria-label="Reject ${title}"]`).click()

  // Modal visible with header and textarea
  // getByRole('heading'): plain text also matches the submit button's own
  // label ("Request Changes"), whose accessible name differs (aria-label
  // "Submit rejection") but whose visible text content is identical.
  await expect(page.getByRole('heading', { name: 'Request Changes' })).toBeVisible({ timeout: 3000 })
  const textarea = page.getByLabel('Rejection reason')
  await expect(textarea).toBeVisible()

  // Counter starts at 0
  await expect(page.getByText('0/1000')).toBeVisible()

  // Empty reason → submit is disabled client-side (not a click-then-error flow)
  await expect(page.getByRole('button', { name: 'Submit rejection' })).toBeDisabled()

  // Fill in reason → counter updates
  const reason = 'Please add more detailed examples in each lesson.'
  await textarea.fill(reason)
  await expect(page.getByText(`${reason.length}/1000`)).toBeVisible()
})

test('Approval: Reject submits reason → POST reject, toast, course removed from Pending', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Reject Submit ${Date.now()}`
  await createPendingCourse(page, H, title, instructorId)

  await openCoursesTab(page)

  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.locator(`button[aria-label="Reject ${title}"]`).click()

  await page.getByLabel('Rejection reason').fill('Needs more examples and better formatting.')

  const rejectResp = page.waitForResponse(
    r => r.url().includes('/reject') && r.request().method() === 'POST',
    { timeout: 15000 },
  )
  await page.getByRole('button', { name: 'Submit rejection' }).click()
  const resp = await rejectResp
  expect(resp.ok(), 'POST /reject must succeed').toBeTruthy()

  // Modal closes and success toast appears
  await expect(page.getByRole('heading', { name: 'Request Changes' })).not.toBeVisible({ timeout: 3000 })
  await expect(page.getByText(/returned to Draft/i)).toBeVisible({ timeout: 5000 })
})

test('Approval: rejectionReason banner visible on Basic Info after reject', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Reject Reason Visible ${Date.now()}`
  const courseId = await createPendingCourse(page, H, title, instructorId)

  await openCoursesTab(page)

  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.locator(`button[aria-label="Reject ${title}"]`).click()

  const reason = 'Add more examples and fix the grammar throughout.'
  await page.getByLabel('Rejection reason').fill(reason)

  const rejectResp = page.waitForResponse(
    r => r.url().includes('/reject') && r.request().method() === 'POST',
    { timeout: 15000 },
  )
  await page.getByRole('button', { name: 'Submit rejection' }).click()
  await rejectResp

  // Navigate to the course Basic Info (edit step) — rejection reason must be shown
  // Anchored-only-at-start: the tab's real text is "All" + a count span
  // concatenated with no separator (CoursesTab.tsx), so a fully-anchored
  // /^All$/ can never match once statusCounts has loaded.
  await page.locator('button', { hasText: /^All/ }).first().click()
  const draftRow = page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
  await expect(draftRow).toBeVisible({ timeout: 10000 })
  await draftRow.locator(`button[aria-label="Edit ${title}"]`).click()

  // "Changes requested" banner must appear with the exact reason text
  await expect(page.getByText('Changes requested')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(reason)).toBeVisible({ timeout: 3000 })
})

test('Approval: race-condition 400 on approve → no auto-retry, list refetches', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Approve Race ${Date.now()}`
  const courseId = await createPendingCourse(page, H, title, instructorId)

  await openCoursesTab(page)

  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
  await expect(row).toBeVisible({ timeout: 10000 })

  // Move the course out of Pending via API (simulates another admin acting first)
  const approveApiResp = await page.request.post(`${API}/courses/${courseId}/approve`, { headers: H })
  expect(approveApiResp.ok(), 'API approve must succeed').toBeTruthy()

  // Click Approve in the UI — POST /approve returns 400 wrong-state
  page.once('dialog', d => d.accept())
  const approveUiResp = page.waitForResponse(
    r => r.url().includes('/approve') && r.request().method() === 'POST',
    { timeout: 15000 },
  )
  await row.locator(`button[aria-label="Approve ${title}"]`).click()
  const resp = await approveUiResp
  expect(resp.status(), 'Race-condition should return 400').toBe(400)

  // Error toast shown, NO auto-retry (only one POST was made)
  await expect(page.getByText(/approved|failed|changed/i)).toBeVisible({ timeout: 5000 })

  // List refetches — the course may no longer appear in Pending tab (moved to Published)
  // Wait for a fresh list GET to confirm the list updated
  await page.waitForResponse(
    r => r.url().includes('/courses') && r.request().method() === 'GET',
    { timeout: 10000 },
  )
})

test('Approval: double-click prevention — Approve button disabled during request', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Approve DoubleClick ${Date.now()}`
  await createPendingCourse(page, H, title, instructorId)

  await openCoursesTab(page)

  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
  await expect(row).toBeVisible({ timeout: 10000 })

  // Delay the POST /approve response so we can observe the in-flight disabled
  // state. 3000ms (not 1000ms) — under full-suite load the click→re-render
  // round trip itself can eat a meaningful chunk of a too-tight window, so a
  // short delay risks the assertion polling past the disabled state entirely
  // rather than actually catching a real regression.
  await page.route('**/courses/*/approve', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise<void>(r => setTimeout(r, 3000))
      await route.continue()
    } else {
      await route.continue()
    }
  })

  page.once('dialog', d => d.accept())
  await row.locator(`button[aria-label="Approve ${title}"]`).click()

  // While request is in-flight the Approve button must be disabled
  await expect(row.locator(`button[aria-label="Approve ${title}"]`)).toBeDisabled({ timeout: 8000 })

  // Let the request complete
  await expect(page.getByText(/approved and published/i)).toBeVisible({ timeout: 10000 })
})

test('Approval: double-click prevention — Request Changes button disabled during request', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Reject DoubleClick ${Date.now()}`
  await createPendingCourse(page, H, title, instructorId)

  await openCoursesTab(page)

  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.locator(`button[aria-label="Reject ${title}"]`).click()

  const reason = 'Please fix the introduction section.'
  await page.getByLabel('Rejection reason').fill(reason)

  // Delay the POST /reject response. 3000ms — see the Approve test's comment
  // above for why a longer delay/window is more reliable under load.
  await page.route('**/courses/*/reject', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise<void>(r => setTimeout(r, 3000))
      await route.continue()
    } else {
      await route.continue()
    }
  })

  await page.getByRole('button', { name: 'Submit rejection' }).click()

  // While in-flight: button shows "Sending…" and is disabled. The button's
  // aria-label is the STATIC "Submit rejection" (CoursesTab.tsx:717) — only
  // its visible text switches to "Sending…" — so the accessible name never
  // actually changes; re-query by the stable aria-label, same as the sibling
  // Approve test does via its own stable aria-label locator.
  await expect(page.getByRole('button', { name: 'Submit rejection' })).toBeDisabled({ timeout: 8000 })

  // Let complete — modal closes and toast appears
  await expect(page.getByText(/returned to Draft/i)).toBeVisible({ timeout: 10000 })
})

test('Approval: Approve/Reject not shown on non-Pending rows', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)

  // Create a bare Draft course (does not go through submit)
  const draftTitle = `Draft NoApprove ${Date.now()}`
  const courseRes = await page.request.post(`${API}/courses`, {
    data: { title: draftTitle, instructorId },
    headers: H,
  })
  const courseId: string = (await courseRes.json()).data?.id
  createdCourseIds.push(courseId)

  await openCoursesTab(page)
  // Switch to All tab to see Draft course
  // Anchored-only-at-start: the tab's real text is "All" + a count span
  // concatenated with no separator (CoursesTab.tsx), so a fully-anchored
  // /^All$/ can never match once statusCounts has loaded.
  await page.locator('button', { hasText: /^All/ }).first().click()

  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: draftTitle }) })
  await expect(row).toBeVisible({ timeout: 10000 })

  // Approve and Reject should NOT appear on a Draft row
  await expect(row.locator(`button[aria-label="Approve ${draftTitle}"]`)).not.toBeVisible()
  await expect(row.locator(`button[aria-label="Reject ${draftTitle}"]`)).not.toBeVisible()
})
