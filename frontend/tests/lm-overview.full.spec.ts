import { test, expect } from '@playwright/test'

// Covers the Learning Management Overview widgets wired to lmApi.ts.
// USE_MOCK=true in services/lmApi.ts, so these assertions are written against
// the specific mock data shapes/values defined there (buildMockCourses(),
// MOCK_STATS, MOCK_DISTRIBUTION, etc.) rather than the eventual live backend.

test('KPI cards render mock stats with positive, negative, and no-data growth', async ({ page }) => {
  await page.goto('/learning-management')

  // "Total Courses" also appears as the donut chart's center caption (same exact
  // text, in a *different* card). page.getByText(...).first() depends on DOM
  // order between two separate widgets to disambiguate, which is fragile —
  // scope to the KPI grid itself (the only 6-column grid on the page) instead,
  // so the donut's caption is structurally excluded rather than out-ranked.
  const kpiGrid = page.locator('[class*="grid-cols-6"]')
  const totalCoursesCard = kpiGrid.getByText('Total Courses', { exact: true }).locator('xpath=..')
  await expect(totalCoursesCard.getByText('256', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(totalCoursesCard.locator('[class*="text-green-600"]').first()).toBeVisible()

  const completionCard = page.getByText('Avg. Completion Rate', { exact: true }).locator('xpath=..')
  await expect(completionCard.getByText('68.4%')).toBeVisible()
  await expect(completionCard.locator('[class*="text-red-600"]').first()).toBeVisible()

  const certificatesCard = page.getByText('Certificates Issued', { exact: true }).locator('xpath=..')
  await expect(certificatesCard.getByText('— vs last month')).toBeVisible()
})

test('Distribution donut uses the API total rather than recomputing from items', async ({ page }) => {
  await page.goto('/learning-management')

  const card = page.getByText('Course Distribution by Category').locator('xpath=..')
  await expect(card.getByText('256', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(card.getByText('Technology')).toBeVisible()
  await expect(card.getByText('(38.3%)')).toBeVisible()
})

test('Progress range selector re-fetches a different dataset', async ({ page }) => {
  await page.goto('/learning-management')

  await expect(page.getByText('Jun 10')).toBeVisible({ timeout: 10000 }) // default "month" range

  const select = page.getByLabel('Progress range')
  await select.selectOption('week')
  await expect(select).toHaveValue('week')
  await expect(page.getByText('Jun 10')).not.toBeVisible()

  await select.selectOption('year')
  await expect(select).toHaveValue('year')
  await expect(page.getByText('Jun 10')).not.toBeVisible()
})

// Default 1280px viewport leaves this 3-column row (Distribution/Progress/
// TopCourses) too narrow for the title column — confirmed via boundingBox()
// the title collapsed to literal 0px width there. TopCourses.tsx now has a
// min-width floor so it can't fully collapse, but a realistic desktop width
// is still the right viewport for asserting this widget's content is visible.
test.describe(() => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test('Top Performing Courses lists the top 5 mock courses only', async ({ page }) => {
    await page.goto('/learning-management')

    const card = page.getByText('Top Performing Courses').locator('xpath=../..')
    await expect(card.getByText('Complete React Developer')).toBeVisible({ timeout: 10000 })
    await expect(card.getByText('92%')).toBeVisible()
    await expect(card.getByText('1,245 Enrolled')).toBeVisible()
    // limit=5 — the 6th-ranked mock course must not appear
    await expect(card.getByText('Advanced Node.js')).not.toBeVisible()
  })
})

test('Content Statistics panel renders mock counts', async ({ page }) => {
  await page.goto('/learning-management')

  const card = page.getByText('Content Statistics').locator('xpath=..')
  await expect(card.getByText('1,245')).toBeVisible({ timeout: 10000 })
  await expect(card.getByText('Video Lessons')).toBeVisible()
  await expect(card.getByText('642')).toBeVisible()
})

test('Courses table paginates through the mock dataset', async ({ page }) => {
  await page.goto('/learning-management')

  await expect(page.getByText('Showing 1 to 10 of 25 courses')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Advanced Python Programming')).toBeVisible()

  await page.getByRole('button', { name: '2', exact: true }).click()
  await expect(page.getByText('Showing 11 to 20 of 25 courses')).toBeVisible({ timeout: 10000 })

  await page.getByLabel('Rows per page').selectOption('25')
  await expect(page.getByText('Showing 1 to 25 of 25 courses')).toBeVisible({ timeout: 10000 })
})

test('Courses table category filter re-fetches and resets to page 1', async ({ page }) => {
  await page.goto('/learning-management')
  await expect(page.getByText('Showing 1 to 10 of 25 courses')).toBeVisible({ timeout: 10000 })

  await page.getByLabel('Filter by category').selectOption('Design')
  await expect(page.getByText(/Showing 1 to \d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  const categoryCells = page.locator('table tbody tr td:nth-child(3)')
  const count = await categoryCells.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    await expect(categoryCells.nth(i)).toHaveText('Design')
  }
})

test('Courses table instructor filter passes the instructor id back to the API', async ({ page }) => {
  await page.goto('/learning-management')
  await expect(page.getByText('Showing 1 to 10 of 25 courses')).toBeVisible({ timeout: 10000 })

  await page.getByLabel('Filter by instructor').selectOption({ label: 'Sarah Johnson' })
  await expect(page.getByText(/Showing 1 to \d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })

  const instructorCells = page.locator('table tbody tr td:nth-child(2)')
  const count = await instructorCells.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    await expect(instructorCells.nth(i)).toContainText('Sarah Johnson')
  }
})

test('Recent Activities converts createdAt timestamps to relative time', async ({ page }) => {
  await page.goto('/learning-management')

  const card = page.getByText('Recent Activities', { exact: true }).locator('xpath=../..')
  await expect(card.getByText("New course 'Advanced Python' created")).toBeVisible({ timeout: 10000 })
  await expect(card.getByText(/by Sarah Johnson · \d+ hours? ago/)).toBeVisible()
  await expect(card.getByText('Certificate issued to 12 students')).toBeVisible()
})

test('Upcoming Live Sessions only shows sessions with status=upcoming', async ({ page }) => {
  await page.goto('/learning-management')

  const card = page.getByText('Upcoming Live Sessions').locator('xpath=../..')
  await expect(card.getByText('UI/UX Workshop Q&A')).toBeVisible({ timeout: 10000 })
  await expect(card.getByText('React Patterns Deep Dive')).toBeVisible()
  await expect(card.getByText('Marketing Strategy Recap')).not.toBeVisible() // status: ended
})