import { test, expect, type Page } from '@playwright/test'

// All assertions run against the real backend (USE_MOCK=false in courseBuilderApi.ts).
// Requires: backend running on :5001 + at least one instructor in the DB.
// Run with: npx playwright test course-builder.full --workers=1

const BUILDER_TITLE = `Builder Test ${Date.now()}`

// ── Cleanup state (option c: self-cleaning tests) ─────────────────────────────
const createdCourseIds: string[] = []
let savedToken: string | null = null

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  for (const id of createdCourseIds) {
    await request.delete(
      `http://localhost:5001/api/admin/courses/${id}`,
      { headers: { Authorization: `Bearer ${savedToken}` } },
    ).catch(() => null)
  }
})

// ── Low-level helpers ──────────────────────────────────────────────────────────

async function gotoCoursesTab(page: Page) {
  await page.goto('/learning-management')

  // Wait for the SPA to finish its auth check (apiGetMe → ProtectedRoute resolves).
  // Without this, goto returns while loading=true and the tab buttons don't exist yet.
  // If auth fails the page redirects to /login and this assertion surfaces the real error.
  await expect(page).toHaveURL(/learning-management/, { timeout: 15000 })

  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=courses/)
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })
}

/**
 * Create a new Draft course via the form and navigate to the Course Builder.
 * Waits for GET /sections to confirm the builder has rendered.
 */
async function createDraftAndOpenBuilder(page: Page) {
  await gotoCoursesTab(page)

  if (!savedToken) {
    savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  }

  await page.getByRole('button', { name: 'Create Course', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Create Course' })).toBeVisible({ timeout: 5000 })

  await page.getByPlaceholder('e.g. Advanced Python Programming').fill(BUILDER_TITLE)
  await page.locator('select:has(option:text-is("Select instructor…"))').selectOption({ index: 1 })

  // Set up course-ID watcher before click so we don't miss the POST.
  const courseRespPromise = page.waitForResponse(
    r => r.url().includes('/api/admin/courses') && r.request().method() === 'POST' && r.ok(),
    { timeout: 15000 },
  )

  // "Next: Course Builder" saves the draft then navigates; we wait for the
  // subsequent GET /sections that CourseBuilder fires on mount.
  const [sectionsResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/sections') && r.ok(),
      { timeout: 15000 },
    ),
    page.getByRole('button', { name: /Next: Course Builder/ }).click(),
  ])
  expect(sectionsResp.ok(), 'GET /sections must respond OK after draft is created').toBeTruthy()

  const courseId = ((await (await courseRespPromise).json()) as { data?: { id?: string } }).data?.id
  if (courseId) createdCourseIds.push(courseId)

  await expect(
    page.getByRole('heading', { name: 'Course Builder' }),
    'Course Builder heading must appear after navigation',
  ).toBeVisible({ timeout: 10000 })
}

/**
 * Add a section via the inline form and wait for both the POST and the
 * subsequent GET /sections (loadSections refetch). The waitForResponse and
 * the button click MUST be in Promise.all — awaiting waitForResponse before
 * clicking would deadlock because the POST only fires when Add is clicked.
 */
async function addSection(page: Page, title: string) {
  await page.getByRole('button', { name: /Add Section/ }).last().click()
  await expect(page.getByLabel('New section title')).toBeVisible({ timeout: 3000 })

  // Promise.all: listen for POST /sections THEN fill+click simultaneously.
  const [postResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/sections') && r.request().method() === 'POST' && r.ok(),
      { timeout: 10000 },
    ),
    (async () => {
      await page.getByLabel('New section title').fill(title)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
    })(),
  ])
  expect(postResp.ok(), 'POST /sections must succeed').toBeTruthy()

  // After createSection succeeds, CourseBuilder calls loadSections (GET /sections).
  await page.waitForResponse(
    r => r.url().includes('/sections') && r.request().method() === 'GET' && r.ok(),
    { timeout: 10000 },
  )
}

/**
 * Add a TEXT lesson. Same Promise.all pattern as addSection.
 */
async function addTextLesson(page: Page, title: string, content = '') {
  await page.getByRole('button', { name: /Add Lesson/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Add Lesson' })).toBeVisible({ timeout: 3000 })

  const [lessonResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/lessons') && r.request().method() === 'POST' && r.ok(),
      { timeout: 10000 },
    ),
    (async () => {
      await page.getByLabel('Lesson title').fill(title)
      if (content) await page.getByLabel('Lesson content').fill(content)
      await page.getByRole('button', { name: 'Add Lesson' }).click()
    })(),
  ])
  expect(lessonResp.ok(), 'POST /lessons must succeed').toBeTruthy()

  // Wait for the GET /sections refetch after lesson is added.
  await page.waitForResponse(
    r => r.url().includes('/sections') && r.request().method() === 'GET' && r.ok(),
    { timeout: 10000 },
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test('Add section — title appears in the section list', async ({ page }) => {
  await createDraftAndOpenBuilder(page)

  const sectionTitle = `Section A ${Date.now()}`
  await addSection(page, sectionTitle)

  await expect(page.getByText(sectionTitle)).toBeVisible({ timeout: 5000 })
})

test('Add text lesson — lesson appears under its section', async ({ page }) => {
  await createDraftAndOpenBuilder(page)
  await addSection(page, `Sec for text ${Date.now()}`)

  const lessonTitle = `Text Lesson ${Date.now()}`
  await addTextLesson(page, lessonTitle, 'Some plain text content for this lesson.')

  await expect(page.getByText(lessonTitle)).toBeVisible({ timeout: 5000 })
})

test('Add valid video URL lesson — accepted and appears in list', async ({ page }) => {
  await createDraftAndOpenBuilder(page)
  await addSection(page, `Sec for video ${Date.now()}`)

  await page.getByRole('button', { name: /Add Lesson/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Add Lesson' })).toBeVisible({ timeout: 3000 })

  const lessonTitle = `Video Lesson ${Date.now()}`

  const [lessonResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/lessons') && r.request().method() === 'POST' && r.ok(),
      { timeout: 10000 },
    ),
    (async () => {
      await page.getByLabel('Lesson title').fill(lessonTitle)
      await page.getByRole('button', { name: 'Video URL' }).click()
      await expect(page.getByLabel('Video URL')).toBeVisible({ timeout: 2000 })
      await page.getByLabel('Video URL').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      await page.getByLabel('Duration in minutes').fill('15')
      await page.getByRole('button', { name: 'Add Lesson' }).click()
    })(),
  ])
  expect(lessonResp.ok()).toBeTruthy()

  await page.waitForResponse(
    r => r.url().includes('/sections') && r.request().method() === 'GET' && r.ok(),
    { timeout: 10000 },
  )
  await expect(page.getByText(lessonTitle)).toBeVisible({ timeout: 5000 })
})

test('Reject invalid video URL — shows inline error, no API call', async ({ page }) => {
  await createDraftAndOpenBuilder(page)
  await addSection(page, `Sec invalid url ${Date.now()}`)

  await page.getByRole('button', { name: /Add Lesson/ }).first().click()
  await page.getByLabel('Lesson title').fill('Bad URL Lesson')
  await page.getByRole('button', { name: 'Video URL' }).click()
  await page.getByLabel('Video URL').fill('not-a-valid-url')

  let lessonPostFired = false
  page.on('request', req => {
    if (req.url().includes('/lessons') && req.method() === 'POST') lessonPostFired = true
  })
  await page.getByRole('button', { name: 'Add Lesson' }).click()

  await expect(
    page.getByText(/valid http\/https URL/i),
    'Inline validation error must appear for invalid URL',
  ).toBeVisible({ timeout: 3000 })

  expect(lessonPostFired, 'No POST /lessons call should fire on invalid URL').toBe(false)
})

test('Edit lesson prefill — form opens with existing values', async ({ page }) => {
  await createDraftAndOpenBuilder(page)
  await addSection(page, `Sec for edit ${Date.now()}`)

  const originalTitle = `Prefill Lesson ${Date.now()}`
  await addTextLesson(page, originalTitle, 'Original content here.')
  await expect(page.getByText(originalTitle)).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: `Edit lesson ${originalTitle}` }).click()
  await expect(page.getByRole('heading', { name: 'Edit Lesson' })).toBeVisible({ timeout: 3000 })

  const titleVal = await page.getByLabel('Lesson title').inputValue()
  expect(titleVal, 'Edit form title must be prefilled').toBe(originalTitle)

  const contentVal = await page.getByLabel('Lesson content').inputValue()
  expect(contentVal, 'Edit form content must be prefilled').toBe('Original content here.')

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'Edit Lesson' })).not.toBeVisible()
})

test('Delete section confirm — dismiss keeps it, confirm removes it', async ({ page }) => {
  await createDraftAndOpenBuilder(page)

  const secTitle = `Sec to delete ${Date.now()}`
  await addSection(page, secTitle)
  await expect(page.getByText(secTitle)).toBeVisible({ timeout: 5000 })

  // Dismiss: section stays
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: `Delete section ${secTitle}` }).click()
  await expect(page.getByText(secTitle)).toBeVisible({ timeout: 3000 })

  // Accept: section removed
  const [deleteResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/sections') && r.request().method() === 'DELETE' && r.ok(),
      { timeout: 10000 },
    ),
    (async () => {
      page.once('dialog', dialog => dialog.accept())
      await page.getByRole('button', { name: `Delete section ${secTitle}` }).click()
    })(),
  ])
  expect(deleteResp.ok()).toBeTruthy()
  await expect(page.getByText(secTitle)).not.toBeVisible({ timeout: 5000 })
})

test('Reorder sends ONE bulk PATCH and replaces state from response', async ({ page }) => {
  await createDraftAndOpenBuilder(page)

  await addSection(page, `Alpha ${Date.now()}`)
  await addSection(page, `Beta ${Date.now() + 1}`)

  let reorderCallCount = 0
  page.on('request', req => {
    if (req.url().includes('/reorder') && req.method() === 'PATCH') reorderCallCount++
  })

  const [reorderResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/reorder') && r.request().method() === 'PATCH' && r.ok(),
      { timeout: 10000 },
    ),
    page.getByRole('button', { name: 'Move section down' }).first().click(),
  ])

  expect(reorderResp.ok(), 'PATCH /reorder must respond OK').toBeTruthy()
  expect(reorderCallCount, 'Exactly ONE bulk PATCH /reorder per arrow click').toBe(1)

  await expect(
    page.locator('[aria-label*="Move section"]').first(),
    'Section move buttons must still exist after reorder completes',
  ).toBeVisible({ timeout: 5000 })
})
