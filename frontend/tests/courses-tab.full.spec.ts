import { test, expect } from '@playwright/test'

// All assertions run against USE_MOCK=true data from coursesApi.ts.
// Mock dataset: 12 Published, 8 Draft, 5 Pending, 4 Archived = 29 total.
// "All" tab shows 25 (excludes Archived). Default page 1 shows first 10 of 25.
// First 10 rows of the "All" view are the first 10 non-archived courses from
// buildMockCourses(): courses 1–10 (Published), sorted by position in the array.

async function gotoCoursesTab(page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never) {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible({ timeout: 10000 })
}

test('Courses tab renders the list with All status tab selected by default', async ({ page }) => {
  await gotoCoursesTab(page)

  // All tab is active and shows count 25
  const allTab = page.getByRole('button', { name: /All/ })
  await expect(allTab).toBeVisible()

  // Table loads with courses (not the "Courses content coming soon" placeholder)
  await expect(page.getByText('Showing 1–10 of 25 courses')).toBeVisible({ timeout: 10000 })

  // First course title visible
  await expect(page.getByText('Advanced Python Programming')).toBeVisible()
})

test('Status tab click filters by that status and re-fetches', async ({ page }) => {
  await gotoCoursesTab(page)
  await expect(page.getByText('Showing 1–10 of 25 courses')).toBeVisible({ timeout: 10000 })

  // Click Draft tab
  await page.getByRole('button', { name: /Draft/ }).click()
  await expect(page.getByText('Showing 1–8 of 8 courses')).toBeVisible({ timeout: 10000 })

  // Click Published tab
  await page.getByRole('button', { name: /Published/ }).click()
  await expect(page.getByText('Showing 1–10 of 12 courses')).toBeVisible({ timeout: 10000 })

  // Click Archived tab — should show only the 4 archived courses
  await page.getByRole('button', { name: /Archived/ }).click()
  await expect(page.getByText('Showing 1–4 of 4 courses')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Legacy PHP Development')).toBeVisible()
})

test('Pagination navigates to page 2 and shows correct row range', async ({ page }) => {
  await gotoCoursesTab(page)
  await expect(page.getByText('Showing 1–10 of 25 courses')).toBeVisible({ timeout: 10000 })

  // Navigate to page 2
  await page.getByRole('button', { name: '2', exact: true }).click()
  await expect(page.getByText('Showing 11–20 of 25 courses')).toBeVisible({ timeout: 10000 })

  // Navigate back to page 1
  await page.getByRole('button', { name: '1', exact: true }).click()
  await expect(page.getByText('Showing 1–10 of 25 courses')).toBeVisible({ timeout: 10000 })
})

test('Category filter narrows results', async ({ page }) => {
  await gotoCoursesTab(page)
  await expect(page.getByText('Showing 1–10 of 25 courses')).toBeVisible({ timeout: 10000 })

  await page.getByLabel('Filter by category').selectOption('Technology')
  await expect(page.getByText(/Showing 1–\d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  // All visible rows should have category Technology
  const categoryCells = page.locator('table tbody tr td:nth-child(3)')
  const count = await categoryCells.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    await expect(categoryCells.nth(i)).toHaveText('Technology')
  }
})

test('Create draft — form opens, validates required fields, submits and returns to list', async ({ page }) => {
  await gotoCoursesTab(page)
  await expect(page.getByText('Showing 1–10 of 25 courses')).toBeVisible({ timeout: 10000 })

  // Open create form — two "Create Course" buttons exist: one in the shared
  // LmPageHeader above the tabs, one inside CoursesTab itself. Target the
  // CoursesTab button (last in DOM order).
  await page.getByRole('button', { name: 'Create Course', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Create Course' })).toBeVisible({ timeout: 5000 })

  // Save Draft is disabled with no title or instructor
  const saveBtn = page.getByRole('button', { name: 'Save Draft' })
  await expect(saveBtn).toBeDisabled()

  // Fill title
  await page.getByPlaceholder('e.g. Advanced Python Programming').fill('My New Test Course')

  // Still disabled until instructor is picked
  await expect(saveBtn).toBeDisabled()

  // Pick instructor
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
  await expect(page.getByText('Showing 1–10 of 25 courses')).toBeVisible({ timeout: 10000 })

  // Click edit on the first row's edit button
  const firstEditBtn = page.locator('table tbody tr').first().getByRole('button', { name: /Edit/i })
  await firstEditBtn.click()

  // Form heading
  await expect(page.getByRole('heading', { name: 'Edit Course — Basic Info' })).toBeVisible({ timeout: 5000 })

  // Title field is prefilled (first mock course = 'Advanced Python Programming')
  const titleInput = page.getByPlaceholder('e.g. Advanced Python Programming')
  await expect(titleInput).toHaveValue('Advanced Python Programming', { timeout: 5000 })

  // Cancel returns to list
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible()
})

test('Archive confirm — dialog shown, confirming removes row from All list', async ({ page }) => {
  await gotoCoursesTab(page)
  await expect(page.getByText('Showing 1–10 of 25 courses')).toBeVisible({ timeout: 10000 })

  // Accept the archive confirm dialog automatically
  page.on('dialog', (dialog) => dialog.accept())

  // Click archive on the first Published row (Advanced Python Programming)
  const firstArchiveBtn = page.locator('table tbody tr').first()
    .getByRole('button', { name: /Archive/i })
  await firstArchiveBtn.click()

  // Success toast appears
  await expect(page.getByText(/archived/i)).toBeVisible({ timeout: 10000 })

  // Count drops by 1 (All: 25 → 24)
  await expect(page.getByText('Showing 1–10 of 24 courses')).toBeVisible({ timeout: 5000 })
})
