// Regression tests for Course Basic Info — Step 1 of the Course Wizard (edit mode).
//
// KEY REGRESSION: "Next: Course Builder →" in edit mode previously navigated
// immediately without sending a PATCH, silently discarding all unsaved changes.
// Fix: edit mode now builds a diff patch (same as "Save Draft") and sends
// PATCH /courses/:id before navigating. Nothing-changed → skips PATCH.
//
// Cleanup: all courses created via API are deleted in afterAll.

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

async function createDraftCourse(
  page: Page,
  headers: Record<string, string>,
  title: string,
  instructorId: string,
): Promise<string> {
  const res = await page.request.post(`${API}/courses`, {
    data: { title, instructorId },
    headers,
  })
  expect(res.ok(), `POST /courses must succeed for "${title}"`).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id, 'Course ID must be returned').toBeTruthy()
  createdCourseIds.push(id)
  return id
}

async function navigateToBasicInfoEdit(page: Page, courseTitle: string) {
  await page.goto('/learning-management')
  await page.locator('button', { hasText: /^Courses$/ }).first().click()
  await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: courseTitle }) })
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.locator(`button[aria-label="Edit ${courseTitle}"]`).click()
  await expect(page.getByRole('button', { name: /Next: Course Builder/i })).toBeVisible({ timeout: 5000 })
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

test('Basic Info edit: "Next: Course Builder" sends PATCH then navigates (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `BasicInfo Regression ${Date.now()}`
  const courseId = await createDraftCourse(page, H, title, instructorId)

  await navigateToBasicInfoEdit(page, title)

  // Type a description (previously lost when clicking "Next: Course Builder")
  const description = `Regression description ${Date.now()}`
  await page.locator('textarea[placeholder*="course description"]').fill(description)

  // "Next: Course Builder →" must PATCH before navigating
  const patchResp = page.waitForResponse(
    r => r.url().includes(`/courses/${courseId}`) && r.request().method() === 'PATCH',
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: /Next: Course Builder/i }).click()
  const resp = await patchResp
  expect(resp.ok(), 'PATCH /courses/:id must succeed').toBeTruthy()

  // Builder appears — confirms no error during save + navigation
  await expect(page.getByRole('button', { name: /Next: Settings/i })).toBeVisible({ timeout: 5000 })

  // Verify description actually persisted in the DB
  const courseResp = await page.request.get(`${API}/courses/${courseId}`, { headers: H })
  expect(courseResp.ok()).toBeTruthy()
  const body = await courseResp.json()
  expect(body.data.description, 'description must be in DB after Next: Course Builder').toBe(description)
})

test('Basic Info edit: nothing changed → no PATCH, navigate immediately', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `BasicInfo NoChange ${Date.now()}`
  await createDraftCourse(page, H, title, instructorId)

  await navigateToBasicInfoEdit(page, title)

  let patchFired = false
  page.on('request', req => {
    if (req.method() === 'PATCH' && req.url().includes('/courses/')) patchFired = true
  })

  // Click Next without changing anything
  await page.getByRole('button', { name: /Next: Course Builder/i }).click()

  await expect(page.getByRole('button', { name: /Next: Settings/i })).toBeVisible({ timeout: 5000 })
  expect(patchFired, 'No PATCH when nothing changed').toBe(false)
})

test('Basic Info edit: "Save Draft" button still saves and returns to list', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `BasicInfo SaveDraft ${Date.now()}`
  const courseId = await createDraftCourse(page, H, title, instructorId)

  await navigateToBasicInfoEdit(page, title)

  const subtitle = `Subtitle ${Date.now()}`
  await page.locator('input[placeholder="Short description shown in cards"]').fill(subtitle)

  const patchResp = page.waitForResponse(
    r => r.url().includes(`/courses/${courseId}`) && r.request().method() === 'PATCH',
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Save Draft' }).click()
  const resp = await patchResp
  expect(resp.ok(), 'PATCH must succeed via Save Draft').toBeTruthy()

  // Navigates back to course list (not builder)
  await expect(page.locator('table')).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /Next: Course Builder/i })).not.toBeVisible()
})
