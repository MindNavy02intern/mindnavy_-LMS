import { test, expect } from '@playwright/test'

// Widgets are wired to lmApi.ts, which currently serves mock data (USE_MOCK=true
// in services/lmApi.ts) shaped like the real LM Overview API contract. These
// tests assert structure, layout, and tab switching; see lm-overview.full.spec.ts
// for assertions against the specific mock data values.

test('Learning Management page renders inside the shared AdminLayout with KPI cards', async ({ page }) => {
  await page.goto('/learning-management')

  await expect(page.getByRole('heading', { name: 'Learning Management', exact: true })).toBeVisible({ timeout: 15000 })

  // The page uses the shared AdminLayout chrome (not a standalone sidebar/header) —
  // confirm the real "Learning Management" nav link is present and marked active.
  const navLink = page.locator('aside').getByRole('link', { name: 'Learning Management', exact: true })
  await expect(navLink).toBeVisible()
  await expect(navLink).toHaveAttribute('aria-current', 'page')

  // KPI cards (mock data from lmApi.ts) — values picked to be unique on the page
  // ("256" also appears in the donut chart's center label, so avoid it here).
  await expect(page.getByText('Total Courses').first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('12,584', { exact: true })).toBeVisible()
  await expect(page.getByText('Certificates Issued')).toBeVisible()
})

test('Tabs switch active state and content area updates', async ({ page }) => {
  await page.goto('/learning-management')

  const overviewTab = page.getByRole('button', { name: 'Overview', exact: true })
  const coursesTab = page.getByRole('button', { name: 'Courses', exact: true })

  // Overview is active by default — its content (Recent Courses table) is shown
  await expect(page.getByRole('heading', { name: 'Recent Courses' })).toBeVisible()
  await expect(page.getByText('Courses content coming soon')).not.toBeVisible()

  await coursesTab.click()
  await expect(page).toHaveURL(/[?&]tab=courses/)
  await expect(page.getByText('Courses content coming soon')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent Courses' })).not.toBeVisible()

  await overviewTab.click()
  await expect(page).toHaveURL(/[?&]tab=overview/)
  await expect(page.getByRole('heading', { name: 'Recent Courses' })).toBeVisible()
  await expect(page.getByText('Courses content coming soon')).not.toBeVisible()
})

test('Recent Courses table renders the wired course rows with pagination', async ({ page }) => {
  await page.goto('/learning-management')

  const table = page.locator('table')
  await expect(table).toBeVisible()
  for (const header of ['Course Title', 'Instructor', 'Category', 'Level', 'Enrolled Students', 'Progress', 'Status', 'Actions']) {
    await expect(table.getByRole('columnheader', { name: header })).toBeVisible()
  }

  // Default mock dataset: 25 courses, page size 10 — see buildMockCourses() in lmApi.ts
  await expect(page.getByText('Showing 1 to 10 of 25 courses')).toBeVisible({ timeout: 10000 })
  await expect(table.getByRole('row')).toHaveCount(11) // 1 header row + 10 data rows
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
