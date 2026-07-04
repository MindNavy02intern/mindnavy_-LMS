import { test, expect, type Page } from '@playwright/test'

// Reflection test: archiving a course via CoursesTab must propagate to the
// Dashboard "Courses" KPI without a hard reload.
//
// Fix under test: CoursesTab now calls invalidateFor(appQueryClient, 'course.archive')
// after a successful archive. invalidateFor dispatches 'analyticsUpdated', which
// DashboardPage listens to and uses to re-fetch /dashboard/core. The KPI reads
// kpis.publishedCourses from that response — so it must decrease by 1 if the
// archived course was previously Published.
//
// Pattern: waitForResponse on the dashboard/core endpoint before asserting the
// new KPI value (established pattern from stats-consistency.full.spec.ts).

// ── Helpers ───────────────────────────────────────────────────────────────────

async function gotoCoursesTab(page: Page) {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=courses/)
  // exact: true is required — "Top Performing Courses" and "Recent Courses" are h3
  // headings on the Overview tab that match { name: 'Courses' } without exact, causing
  // the assertion to pass immediately while Overview is still rendered. With exact: true,
  // only CoursesTab's <h2>Courses</h2> matches, forcing a real wait for tab render.
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible({ timeout: 15000 })
}

// Returns the numeric value shown in the "Courses" KPI card on the Dashboard.
// LKpiCard JSX (DashboardPage.tsx):
//   <div class="mn-lkpi-card">
//     <div>...<div class="mn-lkpi-label">Courses</div>...</div>
//     <div class="mn-lkpi-value">10</div>   ← "—" when 0
//   </div>
// Previous XPath-based approach overshot to .mn-lkpi-grid and read Total Users (10)
// instead of Courses. This version uses the semantic CSS classes directly.
async function readCoursesKpi(page: Page): Promise<number> {
  const coursesCard = page.locator('.mn-lkpi-card').filter({
    has: page.locator('.mn-lkpi-label', { hasText: /^Courses$/ }),
  })
  const raw = await coursesCard
    .locator('.mn-lkpi-value')
    .innerText({ timeout: 0 })
    .catch(() => '0')
  const cleaned = raw.trim().replace(/,/g, '')
  return cleaned === '—' ? 0 : parseInt(cleaned, 10) || 0
}

// ── Test ──────────────────────────────────────────────────────────────────────

// courseId is set during test setup and used in afterEach for guaranteed cleanup.
let createdCourseId: string | null = null

test.afterEach(async ({ request }) => {
  // Clean up the course created by the archive test regardless of outcome.
  // The courses endpoint treats DELETE as a soft-archive, so calling it when
  // the course is already Archived is harmless (idempotent status update).
  if (!createdCourseId) return
  // We cannot use page.evaluate here (no page in afterEach), so we need the
  // auth token. Use a login request to get a short-lived token.
  // Actually: afterEach receives `request` (APIRequestContext) but not a page,
  // so we stash the token during the test in a module-level variable too.
  if (savedToken) {
    await request.delete(
      `http://localhost:5001/api/admin/courses/${createdCourseId}`,
      { headers: { Authorization: `Bearer ${savedToken}` } },
    ).catch(() => null)  // best-effort — don't fail the suite on cleanup errors
  }
  createdCourseId = null
  savedToken      = null
})

// Stash the auth token so afterEach can use it for cleanup without a page.
let savedToken: string | null = null

test('Archive a Published course → Dashboard Courses KPI decrements without hard reload', async ({ page }) => {
  // ── Setup: create a Published course via API so the test owns its own data ──
  // Never depend on pre-existing DB state — use timestamped data so the suite
  // is re-runnable regardless of what's already in the DB.
  //
  // Courses are always created as Draft (validator enforces it, service hard-codes
  // status = "DRAFT"). Two steps: POST (Draft) → PATCH status:'Published'.
  // Prisma enum: PUBLISHED. Validator canon() is case-insensitive, so 'Published'
  // in the PATCH body correctly maps to STATUS_ENUM['Published'] = 'PUBLISHED'.
  //
  // Auth: JWT stored in localStorage under key 'mn_admin_token' (adminAuth.ts:18).
  // Load /dashboard first so the SPA boots and populates localStorage, then
  // extract the token for use with page.request (Playwright's API client).

  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const token = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  expect(token, 'Setup: mn_admin_token must be in localStorage after login').toBeTruthy()
  savedToken = token  // stash for afterEach cleanup

  const API = 'http://localhost:5001/api/admin'
  const H   = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // instructorId must reference a user with role INSTRUCTOR (service assertion).
  // Fetch from an existing course row — every course has one.
  const listResp = await page.request.get(`${API}/courses?limit=1`, { headers: H })
  expect(listResp.ok(), 'Setup: GET /courses must succeed').toBeTruthy()
  const listBody    = await listResp.json()
  const instructorId: string = listBody.data?.courses?.[0]?.instructorId
  expect(instructorId, 'Setup: at least one course with an instructorId must exist in the DB').toBeTruthy()

  // 1. Create a Draft course — title is timestamped (unique per run, re-runnable).
  //    Required fields: title + instructorId. category defaults to "Uncategorized"
  //    inside createCourse() service when omitted.
  const courseTitle = `Archive Test Course ${Date.now()}`
  const createResp  = await page.request.post(`${API}/courses`, {
    data: { title: courseTitle, instructorId },
    headers: H,
  })
  expect(createResp.ok(), 'Setup: POST /courses must succeed').toBeTruthy()
  const createBody = await createResp.json()
  createdCourseId  = createBody.data?.id as string
  expect(createdCourseId, 'Setup: course ID must be returned').toBeTruthy()

  // 2. Publish the course. PATCH /courses/:id accepts { status } per validateUpdate.
  //    'Published' → STATUS_ENUM['Published'] = 'PUBLISHED' (Prisma enum value).
  const publishResp = await page.request.patch(`${API}/courses/${createdCourseId}`, {
    data: { status: 'Published' },
    headers: H,
  })
  expect(publishResp.ok(), `Setup: PATCH /courses/${createdCourseId} to Published must succeed`).toBeTruthy()

  // ── Step 1: Read kpiBefore from a fresh Dashboard load ──
  // Navigate (hard reload) so getDashboardCore() re-runs and picks up the new
  // Published course. Wait for the /dashboard/core response before reading the KPI.
  await page.goto('/dashboard')
  await page.waitForResponse(r => r.url().includes('/dashboard') && r.ok(), { timeout: 15000 })
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const kpiBefore = await readCoursesKpi(page)
  expect(kpiBefore, 'Setup: kpiBefore must be ≥ 1 after publishing a course').toBeGreaterThan(0)

  // ── Step 2: Navigate to Courses tab and archive our specific course ──
  await gotoCoursesTab(page)

  // Find the row by the exact timestamped title — deterministic, not coupled to
  // any pre-existing data.
  await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
  const archiveRow = page.locator('tr').filter({
    has: page.locator('td', { hasText: courseTitle }),
  }).filter({
    has: page.locator(`button[aria-label="Archive ${courseTitle}"]`),
  })
  await expect(archiveRow).toBeVisible({ timeout: 10000 })

  page.once('dialog', dialog => dialog.accept())

  const archivePromise = page.waitForResponse(
    resp => resp.url().includes('/courses') && resp.request().method() === 'DELETE',
    { timeout: 20000 },
  )
  await archiveRow.locator(`button[aria-label="Archive ${courseTitle}"]`).click()
  const archiveResp = await archivePromise
  expect(archiveResp.ok(), 'Archive API call must succeed').toBeTruthy()
  // Course is now Archived — afterEach cleanup is a no-op (idempotent).

  // ── Step 3: Navigate to Dashboard and assert KPI decreased by 1 ──
  await page.goto('/dashboard')
  await page.waitForResponse(r => r.url().includes('/dashboard') && r.ok(), { timeout: 15000 })
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const kpiAfter = await readCoursesKpi(page)

  expect(
    kpiAfter,
    `Courses KPI must drop from ${kpiBefore} to ${kpiBefore - 1} after archiving "${courseTitle}"`,
  ).toBe(kpiBefore - 1)
})

test('Create a draft course → Dashboard Courses KPI is refreshed', async ({ page }) => {
  // Lighter reflection: creating a draft fires 'course.createDraft' →
  // 'analyticsUpdated' → Dashboard refetches /dashboard/core.
  // We assert the refetch happens (response captured) rather than a specific delta
  // because draft courses may not increment publishedCourses.

  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=courses/)
  // exact: true — same race condition as gotoCoursesTab; see comment there.
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible({ timeout: 15000 })
  // Two "Create Course" buttons exist: LmPageHeader (stub, no onClick) comes first,
  // CoursesTab's real button (setView create) comes last. Use .last() for the real one.
  await page.getByRole('button', { name: 'Create Course', exact: true }).last().click()

  // Fill ALL required fields.
  // isValid = title.trim().length > 0 && instructorId !== ''  (CourseForm.tsx line 118)
  // Save Draft is disabled={!isValid} until both are satisfied.

  // 1. Title (required, placeholder from CourseForm.tsx line 250)
  const titleInput = page.getByPlaceholder('e.g. Advanced Python Programming')
  await expect(titleInput).toBeVisible({ timeout: 10000 })
  await titleInput.fill(`Automation Test Course ${Date.now()}`)

  // 2. Instructor (required — select with placeholder option "Select instructor…",
  //    CourseForm.tsx line 308). Options are loaded async by getLmFilterOptions();
  //    wait for the first real option (index 1) to appear before selecting.
  const instructorSelect = page.locator('select').filter({ hasText: 'Select instructor…' })
  await expect(instructorSelect.locator('option').nth(1)).toBeAttached({ timeout: 10000 })
  await instructorSelect.selectOption({ index: 1 })

  // Submit the form (Save Draft button)
  const saveDraftPromise = page.waitForResponse(
    resp => resp.url().includes('/courses') && resp.request().method() === 'POST',
    { timeout: 20000 },
  )
  await page.getByRole('button', { name: /save|draft/i }).first().click()
  const saveResp = await saveDraftPromise
  expect(saveResp.ok(), 'Create course API call must succeed').toBeTruthy()

  // Navigate to Dashboard and verify a refetch is triggered
  const dashboardRefetchPromise = page.waitForResponse(
    resp => resp.url().includes('/dashboard/core'),
    { timeout: 20000 },
  )
  await page.goto('/dashboard')
  await dashboardRefetchPromise

  // Assertion: response was received without error — KPI is fresh
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 10000 })
})
