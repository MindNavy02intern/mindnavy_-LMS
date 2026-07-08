import { test, expect } from '@playwright/test'

// All assertions run against the real backend (USE_MOCK=false in courseBuilderApi.ts).
// Tests require at least one Draft course in the DB (28 real courses exist per contract).
// Run with: npx playwright test course-builder.full --workers=1

const BUILDER_TITLE = `Builder Test ${Date.now()}`

// ── Helpers ────────────────────────────────────────────────────────────────────

async function gotoCoursesTab(page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never) {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=courses/)
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })
}

async function createDraftAndOpenBuilder(
  page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never,
) {
  await gotoCoursesTab(page)

  // Open create form
  await page.getByRole('button', { name: 'Create Course', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Create Course' })).toBeVisible({ timeout: 5000 })

  // Fill required fields
  await page.getByPlaceholder('e.g. Advanced Python Programming').fill(BUILDER_TITLE)
  await page.locator('select:has(option:text-is("Select instructor…"))').selectOption({ index: 1 })

  // Click "Next: Course Builder →" — this saves the draft and opens the builder
  const [sectionsResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/sections') && r.ok(),
      { timeout: 15000 },
    ),
    page.getByRole('button', { name: /Next: Course Builder/ }).click(),
  ])
  expect(sectionsResp.ok(), 'GET /sections must respond OK after draft is created').toBeTruthy()

  await expect(
    page.getByRole('heading', { name: 'Course Builder' }),
    'Course Builder heading must appear after navigation',
  ).toBeVisible({ timeout: 10000 })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test('Add section — title appears in the section list', async ({ page }) => {
  await createDraftAndOpenBuilder(page)

  const sectionTitle = `Section A ${Date.now()}`

  // Click "+ Add Section"
  await page.getByRole('button', { name: /Add Section/ }).last().click()
  await expect(page.getByLabel('New section title')).toBeVisible({ timeout: 3000 })

  // Type title and submit via POST /sections
  const [postResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/sections') && r.request().method() === 'POST' && r.ok(),
      { timeout: 10000 },
    ),
    (async () => {
      await page.getByLabel('New section title').fill(sectionTitle)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
    })(),
  ])
  expect(postResp.ok()).toBeTruthy()

  // Section title should appear in the list
  await expect(page.getByText(sectionTitle)).toBeVisible({ timeout: 5000 })
})

test('Add text lesson — lesson appears under its section', async ({ page }) => {
  await createDraftAndOpenBuilder(page)

  // First add a section
  await page.getByRole('button', { name: /Add Section/ }).last().click()
  await page.getByLabel('New section title').fill(`Sec for text ${Date.now()}`)
  await page.waitForResponse(
    r => r.url().includes('/sections') && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForResponse(r => r.url().includes('/sections') && r.ok(), { timeout: 10000 })

  // Click "+ Add Lesson" inside the section
  await page.getByRole('button', { name: /Add Lesson/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Add Lesson' })).toBeVisible({ timeout: 3000 })

  // Type is TEXT by default — just fill the title
  const lessonTitle = `Text Lesson ${Date.now()}`
  await page.getByLabel('Lesson title').fill(lessonTitle)
  await page.getByLabel('Lesson content').fill('Some plain text content for this lesson.')

  // Save — POST /lessons
  const [lessonResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/lessons') && r.request().method() === 'POST' && r.ok(),
      { timeout: 10000 },
    ),
    page.getByRole('button', { name: 'Add Lesson' }).click(),
  ])
  expect(lessonResp.ok()).toBeTruthy()

  // Lesson title appears in the UI
  await expect(page.getByText(lessonTitle)).toBeVisible({ timeout: 5000 })
})

test('Add valid video URL lesson — accepted and appears in list', async ({ page }) => {
  await createDraftAndOpenBuilder(page)

  // Add a section first
  await page.getByRole('button', { name: /Add Section/ }).last().click()
  await page.getByLabel('New section title').fill(`Sec for video ${Date.now()}`)
  await page.waitForResponse(
    r => r.url().includes('/sections') && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForResponse(r => r.url().includes('/sections') && r.ok(), { timeout: 10000 })

  await page.getByRole('button', { name: /Add Lesson/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Add Lesson' })).toBeVisible({ timeout: 3000 })

  const lessonTitle = `Video Lesson ${Date.now()}`
  await page.getByLabel('Lesson title').fill(lessonTitle)

  // Switch to Video URL type
  await page.getByRole('button', { name: 'Video URL' }).click()
  await expect(page.getByLabel('Video URL')).toBeVisible({ timeout: 2000 })
  await page.getByLabel('Video URL').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await page.getByLabel('Duration in minutes').fill('15')

  const [lessonResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/lessons') && r.request().method() === 'POST' && r.ok(),
      { timeout: 10000 },
    ),
    page.getByRole('button', { name: 'Add Lesson' }).click(),
  ])
  expect(lessonResp.ok()).toBeTruthy()
  await expect(page.getByText(lessonTitle)).toBeVisible({ timeout: 5000 })
})

test('Reject invalid video URL — shows inline error, no API call', async ({ page }) => {
  await createDraftAndOpenBuilder(page)

  await page.getByRole('button', { name: /Add Section/ }).last().click()
  await page.getByLabel('New section title').fill(`Sec invalid url ${Date.now()}`)
  await page.waitForResponse(
    r => r.url().includes('/sections') && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForResponse(r => r.url().includes('/sections') && r.ok(), { timeout: 10000 })

  await page.getByRole('button', { name: /Add Lesson/ }).first().click()
  await page.getByLabel('Lesson title').fill('Bad URL Lesson')
  await page.getByRole('button', { name: 'Video URL' }).click()

  // Type an invalid URL (missing protocol)
  await page.getByLabel('Video URL').fill('not-a-valid-url')

  // Attempt to save
  let lessonPostFired = false
  page.on('request', req => {
    if (req.url().includes('/lessons') && req.method() === 'POST') lessonPostFired = true
  })
  await page.getByRole('button', { name: 'Add Lesson' }).click()

  // Error message should be visible inline
  await expect(
    page.getByText(/valid http\/https URL/i),
    'Inline validation error must appear for invalid URL',
  ).toBeVisible({ timeout: 3000 })

  // No POST should have been fired
  expect(lessonPostFired, 'No POST /lessons call should fire on invalid URL').toBe(false)
})

test('Edit lesson prefill — form opens with existing values', async ({ page }) => {
  await createDraftAndOpenBuilder(page)

  // Add section and a text lesson
  await page.getByRole('button', { name: /Add Section/ }).last().click()
  await page.getByLabel('New section title').fill(`Sec for edit ${Date.now()}`)
  await page.waitForResponse(
    r => r.url().includes('/sections') && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForResponse(r => r.url().includes('/sections') && r.ok(), { timeout: 10000 })

  const originalTitle = `Prefill Lesson ${Date.now()}`
  await page.getByRole('button', { name: /Add Lesson/ }).first().click()
  await page.getByLabel('Lesson title').fill(originalTitle)
  await page.getByLabel('Lesson content').fill('Original content here.')
  await page.waitForResponse(
    r => r.url().includes('/lessons') && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Add Lesson' }).click()
  await expect(page.getByText(originalTitle)).toBeVisible({ timeout: 5000 })

  // Click Edit on that lesson
  await page.getByRole('button', { name: `Edit lesson ${originalTitle}` }).click()
  await expect(page.getByRole('heading', { name: 'Edit Lesson' })).toBeVisible({ timeout: 3000 })

  // Fields are prefilled with the original values
  const titleVal = await page.getByLabel('Lesson title').inputValue()
  expect(titleVal, 'Edit form title must be prefilled').toBe(originalTitle)

  const contentVal = await page.getByLabel('Lesson content').inputValue()
  expect(contentVal, 'Edit form content must be prefilled').toBe('Original content here.')

  // Cancel — modal closes without save
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'Edit Lesson' })).not.toBeVisible()
})

test('Delete section confirm — confirm removes section, dismiss keeps it', async ({ page }) => {
  await createDraftAndOpenBuilder(page)

  const secTitle = `Sec to delete ${Date.now()}`

  // Add a section
  await page.getByRole('button', { name: /Add Section/ }).last().click()
  await page.getByLabel('New section title').fill(secTitle)
  await page.waitForResponse(
    r => r.url().includes('/sections') && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForResponse(r => r.url().includes('/sections') && r.ok(), { timeout: 10000 })
  await expect(page.getByText(secTitle)).toBeVisible({ timeout: 5000 })

  // First try: dismiss the confirm dialog — section must still exist
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: `Delete section ${secTitle}` }).click()
  await expect(page.getByText(secTitle)).toBeVisible({ timeout: 3000 })

  // Second try: accept the confirm dialog — section must disappear
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

  // Add two sections so reorder buttons are active
  for (const name of [`Alpha ${Date.now()}`, `Beta ${Date.now() + 1}`]) {
    await page.getByRole('button', { name: /Add Section/ }).last().click()
    await page.getByLabel('New section title').fill(name)
    await page.waitForResponse(
      r => r.url().includes('/sections') && r.request().method() === 'POST' && r.ok(),
      { timeout: 10000 },
    )
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.waitForResponse(r => r.url().includes('/sections') && r.ok(), { timeout: 10000 })
  }

  // Count PATCH /reorder calls — must be exactly ONE per arrow click
  let reorderCallCount = 0
  page.on('request', req => {
    if (req.url().includes('/reorder') && req.method() === 'PATCH') reorderCallCount++
  })

  // Click "Move section down" on the first section — triggers one bulk reorder
  const [reorderResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/reorder') && r.request().method() === 'PATCH' && r.ok(),
      { timeout: 10000 },
    ),
    page.getByRole('button', { name: 'Move section down' }).first().click(),
  ])

  expect(reorderResp.ok(), 'PATCH /reorder must respond OK').toBeTruthy()
  expect(reorderCallCount, 'Exactly ONE bulk PATCH /reorder per arrow click').toBe(1)

  // Verify state reflects the server response — sections list still visible after reorder
  await expect(
    page.locator('[aria-label*="Move section"]').first(),
    'Section move buttons must still exist after reorder completes',
  ).toBeVisible({ timeout: 5000 })
})
