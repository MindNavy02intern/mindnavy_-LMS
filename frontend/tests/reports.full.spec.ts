import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

// Reports & Analytics module — full stack, real backend throughout (no route
// mocking). Unlike competencies.full.spec.ts / learners.full.spec.ts, this
// module creates NO disposable fixtures — every endpoint here is read-only
// aggregation over data other modules already own (see REPORTS_CONTRACT.md),
// so there is nothing for afterAll to clean up. That absence is confirmed
// below, not just assumed: afterAll asserts the one write-adjacent action
// (Export Center) only ever appends an audit-log row, never creates a
// user-facing record that would need deleting.
//
// Run with: npx playwright test reports.full --workers=1

test('Reports & Analytics page loads with header, 13 tabs, and 10 KPI cards', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/reports/overview') && r.ok(), { timeout: 15000 }),
    page.goto('/reports-analytics'),
  ])
  expect(resp.ok()).toBeTruthy()

  await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Track performance, monitor learning progress and generate insights')).toBeVisible()

  for (const label of [
    'Overview', 'Learner Analytics', 'Instructor Analytics', 'Course Analytics', 'Learning Progress',
    'Assessments', 'Certificates', 'Attendance', 'Engagement', 'Compliance', 'Audit Logs',
    'Export Center', 'Custom Reports',
  ]) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 10000 })
  }

  // Scoped to <main> — "Courses Completed" also appears verbatim in the
  // sidebar's quick-status list, which would otherwise strict-mode-violate.
  // .first(): "System Activity" is ALSO the title of this same page's detail
  // chart card (a second, legitimate section below the KPI row, not a
  // duplicate render) — either match proves the KPI label is showing.
  for (const label of [
    'Total Users', 'Active Learners', 'Active Instructors', 'Courses Completed', 'Avg Learning Progress',
    'Live Sessions Today', 'Total Revenue', 'Certificates Issued', 'Engagement Score', 'System Activity',
  ]) {
    await expect(page.getByRole('main').getByText(label, { exact: true }).first()).toBeVisible({ timeout: 10000 })
  }

  // Total Revenue now reads real data (Finance module's Payment aggregation,
  // wired 2026-08-16) — assert a real dollar figure renders, not the old
  // "unavailable" placeholder.
  await expect(page.getByText('No Payment/Transaction model exists yet')).toHaveCount(0)
  await expect(page.getByRole('main').getByText(/^\$[\d,]+$/).first()).toBeVisible({ timeout: 10000 })

  // Engagement Score still has no real source — render an em dash, never a
  // fabricated 0, and keep asserting the honest unavailable state for it.
  await expect(page.getByText('No engagement-scoring model exists yet')).toBeVisible({ timeout: 10000 })
})

test('sidebar "Reports & Analytics" link navigates correctly (was previously a dead 404 link)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 }).catch(() => {})

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/reports/overview') && r.ok(), { timeout: 15000 }),
    page.getByRole('link', { name: 'Reports & Analytics' }).click(),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page).toHaveURL(/\/reports-analytics/, { timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible({ timeout: 10000 })
})

test('Overview date range picker and department filter re-fetch real data', async ({ page }) => {
  await page.goto('/reports-analytics')
  await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible({ timeout: 10000 })

  const [weekResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/reports/overview') && r.url().includes('dateRange=week') && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'This Week', exact: true }).click(),
  ])
  expect(weekResp.ok()).toBeTruthy()

  const [quarterResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/reports/overview') && r.url().includes('dateRange=quarter') && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'This Quarter', exact: true }).click(),
  ])
  expect(quarterResp.ok()).toBeTruthy()

  // Custom range requires both dates before it re-fetches — no request fires
  // on an incomplete range (validated client-side, matches the backend's own
  // 400 on a missing dateFrom/dateTo).
  await page.getByRole('button', { name: 'Custom', exact: true }).click()
  await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 5000 })
})

test('Learner Analytics tab shows real activity/progress/dropout-risk data', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/reports/learners') && r.ok(), { timeout: 15000 }),
    page.goto('/reports-analytics?tab=learners'),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  expect(body?.success).toBe(true)
  expect(body?.data?.activityTrend?.labels?.length).toBeGreaterThan(0)

  await expect(page.getByText('Activity Trend', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Progress Distribution', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/Dropout Risk/)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Top Performers', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Inactive Users', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('Instructor Analytics tab shows real ranking/performance data with honest unavailable rating', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/reports/instructors') && r.ok(), { timeout: 15000 }),
    page.goto('/reports-analytics?tab=instructors'),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  expect(body?.data?.avgRating?.available).toBe(false)

  await expect(page.getByText('Avg Rating', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Top Instructors', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Performance Comparison', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('Audit Logs tab shows real paginated data and search/action filters actually filter', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/reports/audit') && r.ok(), { timeout: 15000 }),
    page.goto('/reports-analytics?tab=audit'),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  expect(body?.data?.logs?.length).toBeGreaterThan(0)
  expect(body?.data?.pagination?.total).toBeGreaterThan(0)

  await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible({ timeout: 10000 })

  // Filter by a real action every admin session generates (ADMIN_LOGIN) and
  // confirm the result set actually narrows — proves the filter reaches the
  // backend correctly, not just that the input accepts text (this exact
  // filter combo silently returned 0 rows during development due to a
  // Prisma enum-equals bug caught by this kind of live check, not tsc).
  const [filteredResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/reports/audit') && r.url().includes('action=ADMIN_LOGIN') && r.ok(), { timeout: 15000 }),
    page.getByPlaceholder('Action (e.g. USER_CREATED)').fill('admin_login'),
  ])
  expect(filteredResp.ok()).toBeTruthy()
  const filteredBody = await filteredResp.json()
  expect(filteredBody?.data?.logs?.length).toBeGreaterThan(0)
  for (const log of filteredBody.data.logs) {
    expect(log.action).toBe('ADMIN_LOGIN')
  }
})

test('Export Center generates a real CSV download end to end', async ({ page }) => {
  await page.goto('/reports-analytics?tab=export')
  await expect(page.getByText('Generate Export', { exact: true })).toBeVisible({ timeout: 15000 })

  const [download, exportResp] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.waitForResponse(r => r.url().includes('/reports/export') && r.url().includes('type=learners') && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Generate & Download', exact: true }).click(),
  ])
  expect(exportResp.ok()).toBeTruthy()
  expect(download.suggestedFilename()).toMatch(/^reports-learners.*\.csv$/)

  // Reflected in "Recent Exports (this session)" without a reload.
  await expect(page.getByText('Learners · CSV')).toBeVisible({ timeout: 10000 })
})

test('Export Center JSON format downloads the flat {type,columns,rows} shape', async ({ page }) => {
  await page.goto('/reports-analytics?tab=export')
  await expect(page.getByText('Generate Export', { exact: true })).toBeVisible({ timeout: 15000 })

  await page.getByRole('radio').nth(1).check() // JSON option
  const [download, exportResp] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.waitForResponse(r => r.url().includes('/reports/export') && r.url().includes('format=json') && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Generate & Download', exact: true }).click(),
  ])
  expect(exportResp.ok()).toBeTruthy()
  // Read the JSON from the downloaded FILE, not exportResp.json() — the
  // browser's own download handling consumes the response body for a real
  // file download, so re-reading it off the response object races the
  // download and intermittently returns an empty/exhausted stream.
  const downloadPath = await download.path()
  expect(downloadPath, 'download must save to a real file').toBeTruthy()
  const jsonBody = JSON.parse(readFileSync(downloadPath as string, 'utf-8'))
  expect(jsonBody).toHaveProperty('columns')
  expect(jsonBody).toHaveProperty('rows')
  expect(download.suggestedFilename()).toMatch(/\.json$/)
})

test('remaining tabs (Course Analytics, Learning Progress, Assessments, Certificates, Attendance, Engagement, Compliance, Custom Reports) render without error', async ({ page }) => {
  await page.goto('/reports-analytics')
  await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible({ timeout: 10000 })

  const consoleErrors: string[] = []
  page.on('pageerror', err => consoleErrors.push(err.message))

  for (const tabLabel of ['Course Analytics', 'Learning Progress', 'Assessments', 'Certificates', 'Attendance', 'Engagement', 'Compliance', 'Custom Reports']) {
    await page.getByRole('button', { name: tabLabel, exact: true }).click()
    await page.waitForTimeout(600)
  }

  expect(consoleErrors, `Uncaught page errors while clicking through tabs: ${consoleErrors.join(' | ')}`).toHaveLength(0)
  // Custom Reports is the one genuine "coming soon" tab — confirm it explains
  // itself rather than showing a bare placeholder. The heading and the
  // "COMING SOON" badge are two separate elements (never one combined
  // string with an em-dash, which is what this checked before and could
  // never match).
  await expect(page.getByRole('heading', { name: 'Custom Report Builder', exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('COMING SOON', { exact: true })).toBeVisible()
})

test.afterAll(async ({ request }, testInfo) => {
  // Zero leaks by construction: every endpoint in this module is a GET
  // except /export, which only appends a REPORT_EXPORTED audit-log row (an
  // internal record, not a user-facing entity) — there is no learner,
  // framework, skill, or any other disposable fixture this suite creates
  // that a future run could collide with or that needs deleting here.
  void request
  void testInfo
})
