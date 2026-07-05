import { test, expect } from '@playwright/test'

// Widgets are wired to lmApi.ts with USE_MOCK=false — these tests assert
// structure, layout, and tab switching against the real backend.
// Data-value assertions use shape checks (not hardcoded mock values) so the
// suite is re-runnable across any DB state.

test('Learning Management page renders inside the shared AdminLayout with KPI cards', async ({ page }) => {
  await page.goto('/learning-management')

  await expect(page.getByRole('heading', { name: 'Learning Management', exact: true })).toBeVisible({ timeout: 15000 })

  // The page uses the shared AdminLayout chrome (not a standalone sidebar/header) —
  // confirm the real "Learning Management" nav link is present and marked active.
  const navLink = page.locator('aside').getByRole('link', { name: 'Learning Management', exact: true })
  await expect(navLink).toBeVisible()
  await expect(navLink).toHaveAttribute('aria-current', 'page')

  // KPI card labels are visible (values are backend-dependent and not hardcoded)
  await expect(page.getByText('Total Courses').first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Certificates Issued')).toBeVisible()
})

test('Tabs switch active state and content area updates', async ({ page }) => {
  await page.goto('/learning-management')

  const overviewTab = page.getByRole('button', { name: 'Overview', exact: true })
  const coursesTab  = page.getByRole('button', { name: 'Courses',  exact: true })

  // Overview is active by default — its content (Recent Courses table) is shown
  await expect(page.getByRole('heading', { name: 'Recent Courses' })).toBeVisible()
  // CoursesTab heading is NOT visible while on Overview
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).not.toBeVisible()

  // Switch to Courses tab — URL updates and CoursesTab renders its list heading
  await coursesTab.click()
  await expect(page).toHaveURL(/[?&]tab=courses/)
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('heading', { name: 'Recent Courses' })).not.toBeVisible()

  // Switch back to Overview
  await overviewTab.click()
  await expect(page).toHaveURL(/[?&]tab=overview/)
  await expect(page.getByRole('heading', { name: 'Recent Courses' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).not.toBeVisible()
})

test('Recent Courses table renders the wired course rows with pagination', async ({ page }) => {
  await page.goto('/learning-management')

  const table = page.locator('table')
  await expect(table).toBeVisible()
  for (const header of ['Course Title', 'Instructor', 'Category', 'Level', 'Enrolled Students', 'Progress', 'Status', 'Actions']) {
    await expect(table.getByRole('columnheader', { name: header })).toBeVisible()
  }

  // Row count depends on DB state — assert shape, not a hardcoded total
  await expect(page.getByText(/Showing 1 to \d+ of \d+ courses/)).toBeVisible({ timeout: 10000 })
  // At least the header row must exist; data row count depends on DB
  await expect(table.getByRole('row').first()).toBeVisible()
})

test('Right panel widgets render', async ({ page }) => {
  await page.goto('/learning-management')

  await expect(page.getByRole('heading', { name: 'Learning Management Guide' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Content Statistics' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'Recent Activities' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'Upcoming Live Sessions' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Course Distribution by Category')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Learning Progress Overview')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Top Performing Courses')).toBeVisible({ timeout: 10000 })
})
