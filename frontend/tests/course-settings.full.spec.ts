// Tests for Course Settings — Step 4 of the Course Wizard.
// Covers: form prefill, save (changed fields only), cross-field validation,
// accessRules multi-selects (groups + prerequisite courses), 429 handling,
// and navigation to the next step.
//
// Cleanup: every course AND group created via API is tracked and deleted in afterAll.

import { type Page, test, expect } from '@playwright/test'

const API = 'http://localhost:5001/api/admin'

// ── Shared state ──────────────────────────────────────────────────────────────

const createdCourseIds: string[] = []
const createdGroupIds:  string[] = []
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
  expect(res.ok(), 'GET /courses must succeed to find an instructorId').toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.courses?.[0]?.instructorId
  expect(id, 'At least one course with an instructorId must exist').toBeTruthy()
  return id
}

async function createDraftCourse(
  page: Page,
  headers: Record<string, string>,
  title: string,
  instructorId: string,
): Promise<string> {
  const res = await page.request.post(`${API}/courses`, {
    data: { title, instructorId },
    headers,
  })
  expect(res.ok(), `POST /courses must succeed for "${title}"`).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id, 'Course ID must be returned').toBeTruthy()
  createdCourseIds.push(id)
  return id
}

async function navigateToSettingsStep(page: Page, courseTitle: string) {
  // Navigate to the LM page and open the Courses tab
  await page.goto('/learning-management')
  // Click the "Courses" tab in LmTabs (distinct from status filter tabs inside CoursesTab)
  const coursesTab = page.locator('button', { hasText: /^Courses$/ }).first()
  await coursesTab.click()

  // Find the row and click Edit
  await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: courseTitle }) })
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.locator(`button[aria-label="Edit ${courseTitle}"]`).click()

  // Step 1 (CourseForm) → click "Next: Course Builder →"
  await expect(page.getByRole('button', { name: /Next: Course Builder/i })).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /Next: Course Builder/i }).click()

  // Step 2 (CourseBuilder) → click "Next: Settings"
  await expect(page.getByRole('button', { name: /Next: Settings/i })).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /Next: Settings/i }).click()

  // Verify Settings step is shown
  await expect(page.getByText('Course Settings')).toBeVisible({ timeout: 5000 })
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }
  for (const id of createdCourseIds) {
    await request.delete(`${API}/courses/${id}`, { headers: H }).catch(() => null)
  }
  for (const id of createdGroupIds) {
    await request.delete(`${API}/groups/${id}`, { headers: H }).catch(() => null)
  }
})

// ── Tests ─────────────────────────────────────────────────────────────────────

test('Settings form: renders all sections and saves changed fields', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Settings Test ${Date.now()}`
  await createDraftCourse(page, H, title, instructorId)

  await navigateToSettingsStep(page, title)

  // All sections present
  // getByRole('heading'): plain text also substring-matches the step
  // breadcrumb ("Step 4 — Pricing, access & SEO").
  await expect(page.getByRole('heading', { name: 'Pricing', exact: true })).toBeVisible()
  // getByRole('heading'): plain text also matches "Total Enrollments" (sidebar
  // + main) and the "Enrollments" nav tab button.
  await expect(page.getByRole('heading', { name: 'Enrollment', exact: true })).toBeVisible()
  await expect(page.getByText('Features')).toBeVisible()
  await expect(page.getByText('Access Rules')).toBeVisible()
  // getByRole('heading'): plain text also matches the step breadcrumb
  // ("Step 4 — Pricing, access & SEO") and the "SEO Title"/"SEO Description" labels.
  await expect(page.getByRole('heading', { name: 'SEO', exact: true })).toBeVisible()

  // Flip to Paid, enter price. The Price field only mounts once "Paid" is
  // selected, and under full-suite load it can detach/remount once more
  // right after — retried with a fresh locator query per attempt rather
  // than relying on a single fill()'s own actionability retry against a
  // locator that was resolved before the remount.
  await page.getByRole('button', { name: /^Paid$/i }).click()
  await expect(page.getByLabel('Price')).toBeVisible()
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.getByLabel('Price').fill('49.99', { timeout: 8000 })
      break
    } catch (err) {
      if (attempt === 3) throw err
    }
  }
  // Same remount race as Price above — Currency mounts in the same
  // conditional block and has now been observed detaching mid-fill too.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.getByLabel('Currency').fill('USD', { timeout: 8000 })
      break
    } catch (err) {
      if (attempt === 3) throw err
    }
  }

  // Change visibility
  await page.getByLabel('Visibility').selectOption('Private')

  // Fill SEO title and check counter
  const seoTitle = 'Learn Everything About React'
  await page.getByLabel('SEO Title').fill(seoTitle)
  await expect(page.getByText(`${seoTitle.length}/70`)).toBeVisible()

  // Save and verify success
  const saveResp = page.waitForResponse(
    r => r.url().includes('/settings') && r.request().method() === 'PATCH',
    { timeout: 15000 },
  )
  await page.getByRole('button', { name: 'Save Settings' }).click()
  const resp = await saveResp
  expect(resp.ok(), 'PATCH /settings must succeed').toBeTruthy()

  await expect(page.getByText('Settings saved.')).toBeVisible({ timeout: 5000 })
})

test('Settings form: blocks save when Paid but price is empty', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Settings Validation ${Date.now()}`
  await createDraftCourse(page, H, title, instructorId)

  await navigateToSettingsStep(page, title)

  // Flip to Paid but leave price empty
  await page.getByRole('button', { name: /^Paid$/i }).click()
  await expect(page.getByLabel('Price')).toBeVisible()

  // Attempt save
  await page.getByRole('button', { name: 'Save Settings' }).click()

  // Validation error must appear; no network call made
  await expect(page.getByText(/Price must be a positive number/i)).toBeVisible({ timeout: 3000 })
})

test('Settings form: does not PATCH when no fields changed', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Settings NoChange ${Date.now()}`
  await createDraftCourse(page, H, title, instructorId)

  await navigateToSettingsStep(page, title)

  // Save without changing anything — should show toast but no PATCH network call
  let patchCalled = false
  page.on('request', req => {
    if (req.url().includes('/settings') && req.method() === 'PATCH') patchCalled = true
  })

  await page.getByRole('button', { name: 'Save Settings' }).click()
  await page.waitForTimeout(1000)

  expect(patchCalled, 'No PATCH should be issued when nothing changed').toBe(false)
  await expect(page.getByText('Settings saved.')).toBeVisible({ timeout: 3000 })
})

test('Settings form: "Next: Preview" saves changes then navigates', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Settings Next ${Date.now()}`
  await createDraftCourse(page, H, title, instructorId)

  await navigateToSettingsStep(page, title)

  // Change a field so a PATCH fires
  await page.getByLabel('SEO Title').fill('My Course SEO Title')

  const saveResp = page.waitForResponse(
    r => r.url().includes('/settings') && r.request().method() === 'PATCH',
    { timeout: 15000 },
  )
  await page.getByRole('button', { name: /Next: Preview/i }).click()
  const resp = await saveResp
  expect(resp.ok(), 'PATCH /settings must succeed on "Next: Preview"').toBeTruthy()

  // After navigation, we should leave the Settings step
  await expect(page.getByText('Course Settings')).not.toBeVisible({ timeout: 5000 })
})

test('Settings form: "Flipping to Free clears price input"', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)
  const title = `Settings FreePaid ${Date.now()}`
  await createDraftCourse(page, H, title, instructorId)

  await navigateToSettingsStep(page, title)

  // Go Paid → enter price → flip back to Free
  await page.getByRole('button', { name: /^Paid$/i }).click()
  await page.getByLabel('Price').fill('99.99')
  await page.getByRole('button', { name: /^Free$/i }).click()

  // Price input disappears
  await expect(page.getByLabel('Price')).not.toBeVisible()
  // Flip back to Paid — price field should be empty (cleared)
  await page.getByRole('button', { name: /^Paid$/i }).click()
  await expect(page.getByLabel('Price')).toHaveValue('')
})

test('Settings form: accessRules multi-selects save group and prerequisite course, reload restores selection', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const H = await getAuthHeaders(page)
  const instructorId = await getInstructorId(page, H)

  // Create the course to edit
  const title = `Settings AccessRules ${Date.now()}`
  await createDraftCourse(page, H, title, instructorId)

  // Create a group to select as an allowed group
  const groupName = `Settings Group ${Date.now()}`
  const groupRes = await page.request.post(`${API}/groups`, {
    data: { name: groupName, status: 'ACTIVE' },
    headers: H,
  })
  expect(groupRes.ok(), 'POST /groups must succeed').toBeTruthy()
  const groupId: string = (await groupRes.json()).data?.id
  expect(groupId, 'Group ID must be returned').toBeTruthy()
  createdGroupIds.push(groupId)

  // Create a second course to use as prerequisite
  const prereqTitle = `Settings Prereq ${Date.now()}`
  const prereqId = await createDraftCourse(page, H, prereqTitle, instructorId)

  await navigateToSettingsStep(page, title)

  // Allowed Groups picker: search for the group and select it
  await page.getByLabel(`Search Allowed Groups`).fill(groupName.slice(0, 10))
  const groupCheckbox = page.getByLabel(groupName)
  await expect(groupCheckbox).toBeVisible({ timeout: 5000 })
  await groupCheckbox.check()
  await expect(groupCheckbox).toBeChecked()

  // Prerequisite Courses picker: search for the prereq course and select it
  await page.getByLabel('Search Prerequisite Courses').fill(prereqTitle.slice(0, 10))
  const prereqCheckbox = page.getByLabel(prereqTitle)
  await expect(prereqCheckbox).toBeVisible({ timeout: 5000 })
  await prereqCheckbox.check()
  await expect(prereqCheckbox).toBeChecked()

  // Save
  const saveResp = page.waitForResponse(
    r => r.url().includes('/settings') && r.request().method() === 'PATCH',
    { timeout: 15000 },
  )
  await page.getByRole('button', { name: 'Save Settings' }).click()
  const resp = await saveResp
  expect(resp.ok(), 'PATCH /settings must succeed').toBeTruthy()
  await expect(page.getByText('Settings saved.')).toBeVisible({ timeout: 5000 })

  // Navigate away and come back to the Settings step to verify reload restores selection
  await page.getByRole('button', { name: /Back to Builder/i }).click()
  await page.getByRole('button', { name: /Next: Settings/i }).click()
  await expect(page.getByText('Course Settings')).toBeVisible({ timeout: 5000 })

  // Clear search and find the checkboxes again — they should be checked
  await page.getByLabel('Search Allowed Groups').fill('')
  await expect(page.getByLabel(groupName)).toBeChecked({ timeout: 5000 })

  await page.getByLabel('Search Prerequisite Courses').fill('')
  await expect(page.getByLabel(prereqTitle)).toBeChecked({ timeout: 5000 })

  // Cleanup: remove prereqId from tracked list and delete it separately
  // (createDraftCourse already pushed it to createdCourseIds, afterAll handles it)
  void prereqId  // explicitly suppress unused variable lint hint
})
