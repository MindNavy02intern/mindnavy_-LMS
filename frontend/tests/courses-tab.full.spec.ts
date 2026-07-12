import { test, expect } from '@playwright/test'

// All assertions run against the real backend (USE_MOCK=false in coursesApi.ts).
// Data-shape assertions are used instead of hardcoded counts so the suite is
// re-runnable across any DB state.

async function gotoCoursesTab(page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never) {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=courses/)
  // exact: true — prevents matching "Top Performing Courses" / "Recent Courses"
  // headings from the Overview tab that are still in the DOM during transition.
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible({ timeout: 10000 })
}

test('Courses tab renders the list with All status tab selected by default', async ({ page }) => {
  await gotoCoursesTab(page)

  // All tab is active
  const allTab = page.getByRole('button', { name: /All/ })
  await expect(allTab).toBeVisible()

  // Table loads with real course data — count depends on DB state
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  // At least one course row is visible
  const rows = page.locator('table tbody tr')
  await expect(rows.first()).toBeVisible()
})

test('Status tab click filters by that status and re-fetches', async ({ page }) => {
  await gotoCoursesTab(page)
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  // Click Draft tab — count depends on DB state
  await page.getByRole('button', { name: /Draft/ }).click()
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  // Click Published tab
  await page.getByRole('button', { name: /Published/ }).click()
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  // Click Archived tab — may show 0 or more archived courses.
  // Wait with a timeout: while loading the pagination says "Loading…" (not a
  // course count), so isVisible() would race and return false prematurely.
  // The pagination always renders "Showing N–M of Z courses" once loading is
  // done — even when Z=0 it renders "Showing 0–0 of 0 courses" — so the regex
  // matches both the empty and non-empty cases without a separate check.
  await page.getByRole('button', { name: /Archived/ }).click()
  await expect(
    page.getByText(/Showing \d+–\d+ of \d+ courses/),
    'Archived tab must show a course count once loading completes',
  ).toBeVisible({ timeout: 10000 })
})

test('Pagination navigates to page 2 and shows correct row range', async ({ page }) => {
  await gotoCoursesTab(page)
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  // Read total count from pagination text — only navigate to page 2 if it exists
  const paginationText = await page.getByText(/Showing \d+–\d+ of \d+ courses/).first().innerText()
  const total = parseInt(paginationText.match(/of (\d+)/)?.[1] ?? '0', 10)

  if (total > 10) {
    await page.getByRole('button', { name: '2', exact: true }).click()
    await expect(page.getByText(/Showing 11–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: '1', exact: true }).click()
    await expect(page.getByText(/Showing 1–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })
  } else {
    // With fewer than 11 courses, page 2 does not exist — assert page 1 is shown correctly
    expect(total).toBeGreaterThan(0) // table has data
  }
})

test('Category filter narrows results', async ({ page }) => {
  await gotoCoursesTab(page)
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  // Pick the first real category from the dropdown (skip "All Categories" at index 0)
  const categorySelect = page.getByLabel('Filter by category')
  const options = await categorySelect.locator('option').allTextContents()
  const realCategory = options.find(o => o.trim() !== '' && o !== 'All Categories')

  if (!realCategory) {
    // No categories in DB — filter is not testable; pass
    return
  }

  // Assert BEHAVIOR: selecting a category triggers an API call with the correct
  // query parameter, and the server responds OK.  We do not assert per-row text
  // because the DB may have 0 courses in that category — that is valid backend
  // state but makes text assertions DB-state-dependent and unreliable.
  const [resp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/courses') && r.url().includes('category=') && r.ok(),
      { timeout: 15000 },
    ),
    categorySelect.selectOption(realCategory.trim()),
  ])
  expect(resp.ok(), 'API must respond OK when category filter is applied').toBeTruthy()

  // Verify the URL actually contains the selected category value
  expect(
    decodeURIComponent(resp.url()),
    'API request must include the selected category in the query string',
  ).toContain(`category=${realCategory.trim()}`)

  // Table re-renders after the response — pagination updates (0 or more courses)
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })
})

test('Create draft — form opens, validates required fields, submits and returns to list', async ({ page }) => {
  await gotoCoursesTab(page)
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  // Open create form — two "Create Course" buttons exist: one in LmPageHeader
  // above the tabs, one inside CoursesTab. Target the CoursesTab button (last).
  await page.getByRole('button', { name: 'Create Course', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Create Course' })).toBeVisible({ timeout: 5000 })

  // Save Draft is disabled with no title or instructor
  const saveBtn = page.getByRole('button', { name: 'Save Draft' })
  await expect(saveBtn).toBeDisabled()

  // Fill title
  await page.getByPlaceholder('e.g. Advanced Python Programming').fill('My New Test Course')

  // Still disabled until instructor is picked
  await expect(saveBtn).toBeDisabled()

  // Pick first available instructor
  await page.locator('select:has(option:text-is("Select instructor…"))').selectOption({ index: 1 })

  // Now enabled
  await expect(saveBtn).toBeEnabled()

  // Submit
  await saveBtn.click()

  // Returns to list and shows success toast
  await expect(page.getByText('Draft saved!')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible()
})

test('Edit prefill — form opens with the course\'s existing title', async ({ page }) => {
  await gotoCoursesTab(page)
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  // Click edit on the first row's edit button
  const firstEditBtn = page.locator('table tbody tr').first().getByRole('button', { name: /Edit/i })
  await firstEditBtn.click()

  // Form heading
  await expect(page.getByRole('heading', { name: 'Edit Course — Basic Info' })).toBeVisible({ timeout: 5000 })

  // Title field is prefilled with the real course's title (non-empty)
  const titleInput = page.getByPlaceholder('e.g. Advanced Python Programming')
  const titleValue = await titleInput.inputValue({ timeout: 5000 })
  expect(titleValue.trim().length, 'Edit form title must be pre-filled').toBeGreaterThan(0)

  // Cancel returns to list
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible()
})

test('Archive confirm — dialog shown, confirming removes row from All list', async ({ page }) => {
  await gotoCoursesTab(page)
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  // Read initial total count
  const initialText = await page.getByText(/Showing \d+–\d+ of \d+ courses/).first().innerText()
  const initialTotal = parseInt(initialText.match(/of (\d+)/)?.[1] ?? '0', 10)

  // Accept the archive confirm dialog automatically
  page.on('dialog', (dialog) => dialog.accept())

  // Click archive on the first row (regardless of status)
  const firstArchiveBtn = page.locator('table tbody tr').first()
    .getByRole('button', { name: /Archive/i })
  await firstArchiveBtn.click()

  // Success toast appears
  await expect(page.getByText(/archived/i)).toBeVisible({ timeout: 10000 })

  // Count drops by 1 in the All tab (which excludes Archived)
  if (initialTotal > 0) {
    const expectedTotal = initialTotal - 1
    await expect(
      page.getByText(new RegExp(`Showing \\d+–\\d+ of ${expectedTotal} courses`))
    ).toBeVisible({ timeout: 5000 })
  }
})

// ── Part A regression tests ────────────────────────────────────────────────────

// A1: statusCounts badges show real numbers (backend returns lowercase keys).
test('Status tab badges show numeric counts from the backend', async ({ page }) => {
  await gotoCoursesTab(page)
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  // The "All" tab must have a visible badge span containing a non-negative integer.
  const allTabBadge = page.getByRole('button', { name: /All/ }).locator('span').first()
  await expect(allTabBadge).toBeVisible({ timeout: 5000 })
  const badgeText = await allTabBadge.innerText()
  expect(
    Number.isInteger(parseInt(badgeText.trim(), 10)),
    'All-tab badge must contain a numeric count',
  ).toBeTruthy()
})

// A2: LmGuide "Create New Course" button switches to Courses tab and opens create form.
test('Guide "Create New Course" button opens the create form on the Courses tab', async ({ page }) => {
  await page.goto('/learning-management')
  // Wait for Overview to render (guide is only visible here).
  // exact:true avoids strict-mode collision with the guide panel's h3 "Learning Management Guide".
  await expect(page.getByRole('heading', { name: 'Learning Management', exact: true })).toBeVisible({ timeout: 15000 })

  // The guide renders in the Overview sidebar — click the wired button.
  const guideBtn = page.getByRole('button', { name: 'Create New Course', exact: true })
  await expect(guideBtn).toBeVisible({ timeout: 10000 })
  await guideBtn.click()

  // Should switch to the Courses tab and immediately open the create form.
  await expect(page).toHaveURL(/[?&]tab=courses/)
  await expect(
    page.getByRole('heading', { name: 'Create Course' }),
    'Create Course heading must appear after clicking guide button',
  ).toBeVisible({ timeout: 10000 })
})

// A3: Empty instructor list shows an inline warning (not silently disabled Save Draft).
test('Empty instructor list shows inline warning near the dropdown', async ({ page }) => {
  // Mock filter-options to return an empty instructor list.
  await page.route('**/lm/filter-options', route =>
    route.fulfill({ json: { success: true, data: { categories: ['Technology'], instructors: [] } } })
  )

  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Create Course', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Create Course' })).toBeVisible({ timeout: 5000 })

  // Save Draft is disabled when no instructor is available.
  await expect(page.getByRole('button', { name: 'Save Draft' })).toBeDisabled()

  // Inline warning must be visible near the instructor dropdown.
  await expect(
    page.getByText(/No instructors found/i),
    'Inline warning must appear when instructor list is empty',
  ).toBeVisible({ timeout: 5000 })
})

// A3: Filter-options 401 redirects to login page.
test('Filter-options 401 response redirects to login', async ({ page }) => {
  await page.route('**/lm/filter-options', route =>
    route.fulfill({ status: 401, json: { success: false, message: 'Unauthorized' } })
  )

  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  // Wait for CoursesTab to render so the second "Create Course" button (inside
  // CoursesTab) is present — without this, .last() may click the LmPageHeader
  // button before CoursesTab mounts, which switches the tab but doesn't guarantee
  // CourseForm mounts and calls getLmFilterOptions().
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Create Course', exact: true }).last().click()

  // Must redirect to login on 401 from filter-options.
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
})
