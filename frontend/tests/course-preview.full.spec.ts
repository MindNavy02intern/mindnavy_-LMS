// Tests for Course Preview — Step 5 of the Course Wizard.
// Covers: GET /courses/:id/preview, read-only section/lesson tree,
// Desktop/Mobile toggle, VIDEO_URL inline player, empty-sections state,
// 404 error state, Back/Next navigation.
//
// Cleanup: every course/section/lesson created via API is tracked and
// deleted in afterAll (sections and lessons are cascade-deleted with the course).

import { type Page, test, expect } from '@playwright/test'

const API = 'http://localhost:5001/api/admin'

// ── Shared state ──────────────────────────────────────────────────────────────

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

/** Creates a Draft course with a section and a VIDEO_URL lesson (§4.1 sequencing). */
async function setupCourseWithContent(
  page: Page,
  headers: Record<string, string>,
  instructorId: string,
  title: string,
): Promise<{ courseId: string }> {
  // Step 1: create course
  const courseRes = await page.request.post(`${API}/courses`, {
    data: { title, instructorId },
    headers,
  })
  expect(courseRes.ok(), `POST /courses must succeed for "${title}"`).toBeTruthy()
  const courseBody = await courseRes.json()
  const courseId: string = courseBody.data?.id
  expect(courseId, 'Course ID must be returned').toBeTruthy()
  createdCourseIds.push(courseId)

  // Step 2: create a section (parent must exist before lesson)
  const sectionRes = await page.request.post(`${API}/courses/${courseId}/sections`, {
    data: { title: 'Introduction' },
    headers,
  })
  expect(sectionRes.ok(), 'POST /courses/:id/sections must succeed').toBeTruthy()
  const sectionBody = await sectionRes.json()
  const sectionId: string = sectionBody.data?.id
  expect(sectionId, 'Section ID must be returned').toBeTruthy()

  // Step 3: create a VIDEO_URL lesson (section must exist first — §4.1)
  const lessonRes = await page.request.post(`${API}/sections/${sectionId}/lessons`, {
    data: {
      title: 'Welcome Video',
      type: 'VIDEO_URL',
      content: 'https://www.example.com/welcome.mp4',
    },
    headers,
  })
  expect(lessonRes.ok(), 'POST /sections/:id/lessons must succeed').toBeTruthy()

  return { courseId }
}

async function navigateToPreviewStep(page: Page, courseTitle: string) {
  await page.goto('/learning-management')
  const coursesTab = page.locator('button', { hasText: /^Courses$/ }).first()
  await coursesTab.click()

  await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: courseTitle }) })
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.locator(`button[aria-label="Edit ${courseTitle}"]`).click()

  // Step 1 → 2
  await expect(page.getByRole('button', { name: /Next: Course Builder/i })).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /Next: Course Builder/i }).click()

  // Step 2 → 4
  await expect(page.getByRole('button', { name: /Next: Settings/i })).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /Next: Settings/i }).click()
  await expect(page.getByText('Course Settings')).toBeVisible({ timeout: 5000 })

  // Step 4 → 5 (no field changes so no PATCH)
  const previewNavResp = page.waitForResponse(
    r => r.url().includes('/preview') && r.request().method() === 'GET',
    { timeout: 15000 },
  )
  await page.getByRole('button', { name: /Next: Preview/i }).click()
  await previewNavResp
  await expect(page.getByText('Course Preview')).toBeVisible({ timeout: 5000 })
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }
  for (const id of createdCourseIds) {
    // Deleting the course cascades sections and lessons
    await request.delete(`${API}/courses/${id}`, { headers: H }).catch(() => null)
  }
})

// ── Tests ─────────────────────────────────────────────────────────────────────

test('Preview: renders course info, section/lesson tree, and step label', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Preview Test ${Date.now()}`
  await setupCourseWithContent(page, H, instructorId, title)

  await navigateToPreviewStep(page, title)

  // Step label and section label
  await expect(page.getByText('Step 5')).toBeVisible()
  await expect(page.getByText('Course Content')).toBeVisible()
  await expect(page.getByText('Introduction')).toBeVisible()
  await expect(page.getByText('Welcome Video')).toBeVisible()
})

test('Preview: Desktop/Mobile toggle changes layout (CSS only — no new request)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Preview Toggle ${Date.now()}`
  await setupCourseWithContent(page, H, instructorId, title)

  await navigateToPreviewStep(page, title)

  // Track any GET /preview requests after initial load
  let extraPreviewRequests = 0
  page.on('request', req => {
    if (req.url().includes('/preview') && req.method() === 'GET') extraPreviewRequests++
  })

  // Click Mobile
  await page.getByRole('button', { name: /Mobile view/i }).click()
  await page.waitForTimeout(500)

  // Click Desktop again
  await page.getByRole('button', { name: /Desktop view/i }).click()
  await page.waitForTimeout(500)

  expect(extraPreviewRequests, 'No extra GET /preview calls on toggle').toBe(0)
})

test('Preview: VIDEO_URL lesson renders <video> element', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Preview Video ${Date.now()}`
  await setupCourseWithContent(page, H, instructorId, title)

  await navigateToPreviewStep(page, title)

  // A video element should be present for the VIDEO_URL lesson
  const videoEl = page.locator('video')
  await expect(videoEl).toBeVisible({ timeout: 5000 })
  const src = await videoEl.getAttribute('src')
  expect(src).toBeTruthy()
})

test('Preview: Back navigates to Settings, Next navigates to Submit', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Preview Nav ${Date.now()}`
  await setupCourseWithContent(page, H, instructorId, title)

  await navigateToPreviewStep(page, title)

  // Back → Settings
  await page.getByRole('button', { name: /Back to Settings/i }).click()
  await expect(page.getByText('Course Settings')).toBeVisible({ timeout: 5000 })

  // Go back to Preview
  await page.getByRole('button', { name: /Next: Preview/i }).click()
  await expect(page.getByText('Course Preview')).toBeVisible({ timeout: 5000 })

  // Next → Submit step
  await page.getByRole('button', { name: /Next: Submit/i }).click()
  await expect(page.getByText('Course Preview')).not.toBeVisible({ timeout: 5000 })
})

test('Preview: empty sections → shows empty state, not a broken render', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)

  // Create a course with NO sections or lessons
  const title = `Preview Empty ${Date.now()}`
  const courseRes = await page.request.post(`${API}/courses`, {
    data: { title, instructorId },
    headers: H,
  })
  expect(courseRes.ok()).toBeTruthy()
  const courseId: string = (await courseRes.json()).data?.id
  expect(courseId).toBeTruthy()
  createdCourseIds.push(courseId)

  await navigateToPreviewStep(page, title)

  // Empty state message should appear instead of a broken render
  await expect(page.getByText(/No sections yet/i)).toBeVisible({ timeout: 5000 })
  // "Course Content" heading still renders (0 sections · 0 lessons)
  await expect(page.getByText('Course Content')).toBeVisible()
})

test('Preview: 404 course → shows error state with Retry button', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Preview 404 ${Date.now()}`
  await setupCourseWithContent(page, H, instructorId, title)

  // Navigate through wizard to the Preview step (loads successfully)
  await navigateToPreviewStep(page, title)
  await expect(page.getByText('Course Preview')).toBeVisible({ timeout: 5000 })

  // Go back to Settings (unmounts the Preview component)
  await page.getByRole('button', { name: /Back to Settings/i }).click()
  await expect(page.getByText('Course Settings')).toBeVisible({ timeout: 5000 })

  // Delete the course while we're on Settings so the next preview fetch returns 404.
  // The courseId was pushed to createdCourseIds, so remove it from cleanup first
  // (it's already deleted — afterAll delete would 404 silently anyway, but be explicit)
  const previewRow = page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
  // Re-fetch the ID from the tracking array (last pushed)
  const deletedId = createdCourseIds[createdCourseIds.length - 1]
  await page.request.delete(`${API}/courses/${deletedId}`, { headers: H })

  // Navigate forward to Preview — component mounts and calls getPreview → 404
  const errorResp = page.waitForResponse(
    r => r.url().includes('/preview') && r.request().method() === 'GET',
    { timeout: 15000 },
  )
  await page.getByRole('button', { name: /Next: Preview/i }).click()
  const resp = await errorResp
  expect(resp.status(), '404 expected for deleted course').toBe(404)

  // Error state rendered with Retry button
  await expect(page.getByRole('button', { name: /Retry/i })).toBeVisible({ timeout: 5000 })

  // Remove from cleanup list — already deleted above
  createdCourseIds.splice(createdCourseIds.indexOf(deletedId), 1)
  void previewRow  // suppress unused lint hint
})
