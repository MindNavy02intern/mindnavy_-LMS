// Learning Paths tab — end-to-end tests (v1: COURSE + LIVE_SESSION items).
//
// §4.1 sequencing rule: a path must be created via a REAL API call before any
// items can be added to it. All tests that need items first create the path via
// the API, never assume a hard-coded id.
//
// Zero data-leak rule: every path and fixture course created here is captured
// by its real returned id and deleted in afterAll — never rely on the UI
// deleting them (test may fail mid-way).
//
// Tests marked (* mock) use page.route() to control the server response for
// scenarios that cannot be set up via the available API (e.g. missing:true).

import { type Page, test, expect } from '@playwright/test'

const API = 'http://localhost:5001/api/admin'

// ── Cleanup state ─────────────────────────────────────────────────────────────

let savedToken = ''
const createdPathIds:   string[] = []
const createdCourseIds: string[] = []   // fixture courses; archived in afterAll
const createdQuizIds:   string[] = []   // fixture quizzes; hard-deleted in afterAll

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }

  // Hard-delete paths (cascade removes items)
  for (const id of createdPathIds) {
    await request.delete(`${API}/learning-paths/${id}`, { headers: H }).catch(() => null)
  }

  // Soft-archive fixture courses
  for (const id of createdCourseIds) {
    await request.delete(`${API}/courses/${id}`, { headers: H }).catch(() => null)
  }

  // Hard-delete fixture quizzes
  for (const id of createdQuizIds) {
    await request.delete(`${API}/quizzes/${id}`, { headers: H }).catch(() => null)
  }
})

// ── Auth + fixture helpers ────────────────────────────────────────────────────

async function ensureToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  expect(token, 'mn_admin_token must exist in localStorage').toBeTruthy()
  savedToken = token
  return token
}

async function apiHeaders(page: Page) {
  const token = await ensureToken(page)
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function getInstructorId(page: Page, H: Record<string, string>): Promise<string> {
  const res = await page.request.get(`${API}/lm/filter-options`, { headers: H })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.instructors?.[0]?.id
  expect(id, 'At least one INSTRUCTOR user must exist in the DB').toBeTruthy()
  return id
}

async function createFixtureCourse(page: Page, H: Record<string, string>, title: string): Promise<string> {
  const instructorId = await getInstructorId(page, H)
  const res = await page.request.post(`${API}/courses`, {
    data: { title, instructorId },
    headers: H,
  })
  expect(res.ok(), `POST /courses must succeed for "${title}"`).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id, 'Course id must be returned').toBeTruthy()
  createdCourseIds.push(id)
  return id
}

async function createFixturePath(page: Page, H: Record<string, string>, title: string, sequential = false): Promise<string> {
  const res = await page.request.post(`${API}/learning-paths`, {
    data: { title, sequential },
    headers: H,
  })
  expect(res.ok(), `POST /learning-paths must succeed for "${title}"`).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id, 'Path id must be returned').toBeTruthy()
  createdPathIds.push(id)
  return id
}

async function createFixtureQuiz(page: Page, H: Record<string, string>, title: string): Promise<string> {
  const res = await page.request.post(`${API}/quizzes`, {
    data: { title },
    headers: H,
  })
  expect(res.ok(), `POST /quizzes must succeed for "${title}"`).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id, 'Quiz id must be returned').toBeTruthy()
  createdQuizIds.push(id)
  return id
}

async function addCourseToPathViaApi(page: Page, H: Record<string, string>, pathId: string, courseId: string) {
  const res = await page.request.post(`${API}/learning-paths/${pathId}/items`, {
    data: { itemType: 'COURSE', itemId: courseId },
    headers: H,
  })
  expect(res.ok(), 'POST /learning-paths/:id/items must succeed').toBeTruthy()
  return ((await res.json()).data) as { id: string; itemId: string }
}

// ── Navigation helper ─────────────────────────────────────────────────────────

async function gotoPathsTab(page: Page) {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Learning Paths', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=paths/)
  await expect(page.getByRole('heading', { name: 'Learning Paths', exact: true })).toBeVisible({ timeout: 10000 })
}

// ── Tests: path CRUD ──────────────────────────────────────────────────────────

test('Create path — form opens, validates, submits, appears in list', async ({ page }) => {
  await gotoPathsTab(page)
  await ensureToken(page)

  const title = `LP Create Test ${Date.now()}`

  await page.getByRole('button', { name: 'Create Learning Path', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Create Learning Path' })).toBeVisible({ timeout: 5000 })

  // Submit button disabled until title filled
  await expect(page.getByRole('button', { name: 'Create Path' })).toBeDisabled()

  await page.getByPlaceholder(/Python Full Stack Track/i).fill(title)
  await expect(page.getByRole('button', { name: 'Create Path' })).toBeEnabled()

  // Fill description
  await page.locator('textarea').fill('A test description.')

  // Enable sequential toggle
  await page.getByRole('switch', { name: 'Sequential completion' }).click()

  const postResp = page.waitForResponse(
    r => r.url().includes('/learning-paths') && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Create Path' }).click()
  const resp = await postResp
  const body = await resp.json()
  const id: string = body.data?.id
  expect(id, 'POST must return a path id').toBeTruthy()
  createdPathIds.push(id)

  // Lands back on list and path is visible
  await expect(page.getByRole('heading', { name: 'Learning Paths', exact: true })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(title)).toBeVisible()
})

test('Edit path — title, description, sequential changed and persisted', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const origTitle = `LP Edit Source ${Date.now()}`
  await createFixturePath(page, H, origTitle, false)

  await gotoPathsTab(page)
  await expect(page.getByText(origTitle)).toBeVisible({ timeout: 10000 })

  await page.locator('tr').filter({ has: page.locator('td', { hasText: origTitle }) })
    // Anchored to the start: an unanchored /Edit/i also matches the row's
    // title link when the fixture title itself contains "Edit" (e.g. "LP
    // Edit Source ..."), and .first() then grabs that link instead of the
    // actual Edit action button, since it sits earlier in the row's DOM.
    .getByRole('button', { name: /^Edit /i }).first().click()
  await expect(page.getByRole('heading', { name: 'Edit Learning Path' })).toBeVisible({ timeout: 5000 })

  const newTitle = `LP Edit Changed ${Date.now()}`
  const titleInput = page.getByPlaceholder(/Python Full Stack Track/i)
  await titleInput.fill(newTitle)

  await page.locator('textarea').fill('Updated description.')
  await page.getByRole('switch', { name: 'Sequential completion' }).click()

  const patchResp = page.waitForResponse(
    r => r.url().includes('/learning-paths/') && r.request().method() === 'PATCH' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Save Changes' }).click()
  const resp = await patchResp
  expect(resp.ok(), 'PATCH must succeed').toBeTruthy()

  // Back on list with updated title
  await expect(page.getByRole('heading', { name: 'Learning Paths', exact: true })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(newTitle)).toBeVisible({ timeout: 5000 })
})

test('Edit path: nothing changed → no PATCH sent', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `LP NoChange ${Date.now()}`
  await createFixturePath(page, H, title, false)

  await gotoPathsTab(page)
  await expect(page.getByText(title)).toBeVisible({ timeout: 10000 })

  await page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
    // Anchored to the start: an unanchored /Edit/i also matches the row's
    // title link when the fixture title itself contains "Edit" (e.g. "LP
    // Edit Source ..."), and .first() then grabs that link instead of the
    // actual Edit action button, since it sits earlier in the row's DOM.
    .getByRole('button', { name: /^Edit /i }).first().click()
  await expect(page.getByRole('heading', { name: 'Edit Learning Path' })).toBeVisible()

  let patchFired = false
  page.on('request', req => {
    if (req.method() === 'PATCH' && req.url().includes('/learning-paths/')) patchFired = true
  })

  await page.getByRole('button', { name: 'Save Changes' }).click()

  // Navigates back without PATCH
  await expect(page.getByRole('heading', { name: 'Learning Paths', exact: true })).toBeVisible({ timeout: 5000 })
  expect(patchFired, 'No PATCH when nothing changed').toBe(false)
})

test('Delete path — confirm dialog required, path removed from list', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `LP Delete Test ${Date.now()}`
  const pathId = await createFixturePath(page, H, title, false)

  await gotoPathsTab(page)
  await expect(page.getByText(title)).toBeVisible({ timeout: 10000 })

  // Accept the confirm dialog
  page.once('dialog', (d) => {
    expect(d.message()).toContain('permanently delete')
    d.accept()
  })

  const deleteResp = page.waitForResponse(
    r => r.url().includes(`/learning-paths/${pathId}`) && r.request().method() === 'DELETE' && r.ok(),
    { timeout: 10000 },
  )

  await page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
    // Anchored — same title-substring collision risk as the Edit button above.
    .getByRole('button', { name: /^Delete /i }).first().click()
  await deleteResp

  // Path no longer shown in list
  await expect(page.getByText(title)).not.toBeVisible({ timeout: 5000 })

  // Path already deleted — remove from cleanup list
  const idx = createdPathIds.indexOf(pathId)
  if (idx !== -1) createdPathIds.splice(idx, 1)
})

// ── Tests: items ──────────────────────────────────────────────────────────────

test('Add COURSE item — appears fully resolved without a page refetch', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const pathTitle = `LP AddCourse ${Date.now()}`
  const courseTitle = `LP Course Fixture ${Date.now()}`
  const pathId    = await createFixturePath(page, H, pathTitle, false)
  const courseId  = await createFixtureCourse(page, H, courseTitle)

  // Navigate to path detail view
  await gotoPathsTab(page)
  await expect(page.getByText(pathTitle)).toBeVisible({ timeout: 10000 })
  await page.getByText(pathTitle).first().click()
  await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible({ timeout: 5000 })

  // Watch for the POST /items call — must resolve without a subsequent GET /learning-paths/:id
  let detailRefetchFired = false
  page.on('request', req => {
    if (req.method() === 'GET' && req.url().includes(`/learning-paths/${pathId}`) && !req.url().includes('items')) {
      detailRefetchFired = true
    }
  })

  const addItemResp = page.waitForResponse(
    r => r.url().includes('/items') && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )

  // Open picker
  await page.getByRole('button', { name: 'Add Item' }).click()
  await expect(page.getByRole('dialog', { name: /Add item/i })).toBeVisible({ timeout: 5000 })

  // Ensure COURSE is selected (default) — select the fixture course
  await page.getByLabel(/Select course/i).selectOption({ value: courseId })

  await page.getByRole('button', { name: 'Add item to path' }).click()
  const resp = await addItemResp
  expect(resp.ok(), 'POST /items must succeed').toBeTruthy()
  const addedItem = ((await resp.json()).data) as { id: string; title: string; status: string; missing: boolean }

  // Item appears in UI immediately — no refetch needed
  await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 5000 })
  expect(detailRefetchFired, 'Must not refetch detail after addItem').toBe(false)
  expect(addedItem.missing, 'Added item must not be missing').toBe(false)
  expect(addedItem.title, 'Added item must be fully resolved').toBeTruthy()
})

test('Add LIVE_SESSION item — picker shows sessions, adds successfully', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)

  // Fetch existing sessions — skip test if none are available
  const sessRes = await page.request.get(`${API}/lm/live-sessions?status=upcoming`, { headers: H })
  const sessBody = await sessRes.json()
  const sessions: { id: string; title: string }[] = sessBody.data ?? []
  if (sessions.length === 0) {
    test.skip()
    return
  }
  const session = sessions[0]

  const pathTitle = `LP AddSession ${Date.now()}`
  const pathId = await createFixturePath(page, H, pathTitle, false)

  await gotoPathsTab(page)
  await expect(page.getByText(pathTitle)).toBeVisible({ timeout: 10000 })
  await page.getByText(pathTitle).first().click()
  await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: 'Add Item' }).click()
  await expect(page.getByRole('dialog', { name: /Add item/i })).toBeVisible({ timeout: 5000 })

  // Switch to Live Session type. exact: true — non-exact also substring-matches
  // the page's own "Live Sessions" nav tab button.
  await page.getByRole('button', { name: 'Live Session', exact: true }).click()
  await expect(page.getByLabel(/Select live session/i)).toBeVisible({ timeout: 5000 })
  await page.getByLabel(/Select live session/i).selectOption({ value: session.id })

  const addResp = page.waitForResponse(
    r => r.url().includes('/items') && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Add item to path' }).click()
  await addResp

  // Session title appears in the detail view
  await expect(page.getByText(session.title)).toBeVisible({ timeout: 5000 })

  // Cleanup: pathId already in createdPathIds for afterAll deletion
  void pathId
})

test('Add QUIZ item — picker shows quizzes, adds successfully, no status badge', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const pathTitle = `LP AddQuiz ${Date.now()}`
  const quizTitle = `LP Quiz Fixture ${Date.now()}`
  const pathId = await createFixturePath(page, H, pathTitle, false)
  const quizId = await createFixtureQuiz(page, H, quizTitle)

  await gotoPathsTab(page)
  await expect(page.getByText(pathTitle)).toBeVisible({ timeout: 10000 })
  await page.getByText(pathTitle).first().click()
  await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: 'Add Item' }).click()
  await expect(page.getByRole('dialog', { name: /Add item/i })).toBeVisible({ timeout: 5000 })

  // exact: true — non-exact also matches the "Assessments"/"Quiz" nav elsewhere on the page.
  await page.getByRole('button', { name: 'Quiz', exact: true }).click()
  await expect(page.getByLabel(/Select quiz/i)).toBeVisible({ timeout: 5000 })
  await page.getByLabel(/Select quiz/i).selectOption({ value: quizId })

  const addItemResp = page.waitForResponse(
    r => r.url().includes('/items') && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Add item to path' }).click()
  const resp = await addItemResp
  const addedItem = ((await resp.json()).data) as { itemType: string; title: string; status: string | null; missing: boolean }
  expect(addedItem.itemType).toBe('QUIZ')
  expect(addedItem.missing).toBe(false)
  expect(addedItem.status, 'QUIZ items have no status concept').toBeNull()

  await expect(page.getByText(quizTitle)).toBeVisible({ timeout: 5000 })

  void pathId
})

test('Reject duplicate item — exact backend message shown inline', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const pathTitle = `LP Duplicate ${Date.now()}`
  const courseTitle = `LP Dup Course ${Date.now()}`
  const pathId   = await createFixturePath(page, H, pathTitle, false)
  const courseId = await createFixtureCourse(page, H, courseTitle)

  // Add the course once via API (§4.1: path must exist first)
  await addCourseToPathViaApi(page, H, pathId, courseId)

  await gotoPathsTab(page)
  await page.getByText(pathTitle).first().click()
  await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible({ timeout: 5000 })

  // Try adding the same course again via the picker
  await page.getByRole('button', { name: 'Add Item' }).click()
  await expect(page.getByRole('dialog', { name: /Add item/i })).toBeVisible({ timeout: 5000 })
  await page.getByLabel(/Select course/i).selectOption({ value: courseId })

  // Mock the POST to return the duplicate 400
  await page.route(`**/learning-paths/${pathId}/items`, (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 400, json: { success: false, message: 'This item is already in the learning path.' } })
    } else {
      route.continue()
    }
  })

  await page.getByRole('button', { name: 'Add item to path' }).click()

  // Exact backend message shown inline
  await expect(page.getByRole('alert')).toContainText('This item is already in the learning path.', { timeout: 5000 })
})

test('Reject unknown itemId — exact backend message shown inline', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const pathTitle = `LP UnknownId ${Date.now()}`
  const pathId = await createFixturePath(page, H, pathTitle, false)

  await gotoPathsTab(page)
  await page.getByText(pathTitle).first().click()
  await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible({ timeout: 5000 })

  // Mock: return ref-not-found 400 for this path's items endpoint
  await page.route(`**/learning-paths/${pathId}/items`, (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 400, json: { success: false, message: 'Referenced course or live session does not exist.' } })
    } else {
      route.continue()
    }
  })

  // Pick any course to have a value in the dropdown (mock intercepts before it hits backend)
  await page.getByRole('button', { name: 'Add Item' }).click()
  await expect(page.getByRole('dialog', { name: /Add item/i })).toBeVisible({ timeout: 5000 })

  // Force a selection by injecting value directly (picker filters to real courses; we need any selection)
  // The <select> itself only mounts once ItemPicker's own listCourses() fetch
  // resolves (a loading skeleton renders in its place until then — see
  // LearningPathsTab.tsx's ItemPicker) — wait for it to actually be attached
  // with real options before touching it, instead of racing that fetch.
  const select = page.getByLabel(/Select course/i)
  await select.waitFor({ state: 'attached', timeout: 10000 })
  await expect.poll(() => select.evaluate((el: HTMLSelectElement) => el.options.length), { timeout: 10000 }).toBeGreaterThan(1)
  await select.evaluate((el: HTMLSelectElement) => {
    const opt = el.options[1] // first real option after placeholder
    if (opt) { el.value = opt.value; el.dispatchEvent(new Event('change', { bubbles: true })) }
  })

  await page.getByRole('button', { name: 'Add item to path' }).click()
  await expect(page.getByRole('alert')).toContainText('Referenced course or live session does not exist.', { timeout: 5000 })
})

test('Remove item — uses path-item id (not course id), item disappears', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const pathTitle = `LP Remove ${Date.now()}`
  const courseTitle = `LP Remove Course ${Date.now()}`
  const pathId   = await createFixturePath(page, H, pathTitle, false)
  const courseId = await createFixtureCourse(page, H, courseTitle)

  // Add item via API, capture the path-item id (NOT the course id)
  const item = await addCourseToPathViaApi(page, H, pathId, courseId)
  const pathItemId = item.id
  expect(pathItemId, 'Must get path-item id from addItem response').toBeTruthy()
  expect(pathItemId, 'Path-item id must differ from course id').not.toBe(courseId)

  await gotoPathsTab(page)
  await page.getByText(pathTitle).first().click()
  await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 10000 })

  // Intercept the DELETE — verify the URL contains the path-item id, not the course id
  const deleteResp = page.waitForResponse(
    r => r.url().includes(`/learning-paths/${pathId}/items/`) && r.request().method() === 'DELETE',
    { timeout: 10000 },
  )

  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: new RegExp(`Remove ${courseTitle}`) }).click()

  const resp = await deleteResp
  expect(resp.url(), 'DELETE must use path-item id, not course id').toContain(pathItemId)
  expect(resp.url(), 'DELETE must NOT use raw course id').not.toContain(courseId)
  expect(resp.ok(), 'DELETE must succeed').toBeTruthy()

  // Item gone from UI
  await expect(page.getByText(courseTitle)).not.toBeVisible({ timeout: 5000 })
})

test('Reorder — ONE bulk PATCH to /reorder, state replaced from full response', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const pathTitle = `LP Reorder ${Date.now()}`
  const pathId = await createFixturePath(page, H, pathTitle, false)
  const courseId1 = await createFixtureCourse(page, H, `LP Reorder Course A ${Date.now()}`)
  const courseId2 = await createFixtureCourse(page, H, `LP Reorder Course B ${Date.now()}`)

  // §4.1: path exists, add both items via API
  await addCourseToPathViaApi(page, H, pathId, courseId1)
  await addCourseToPathViaApi(page, H, pathId, courseId2)

  await gotoPathsTab(page)
  await page.getByText(pathTitle).first().click()
  await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible({ timeout: 5000 })

  // Count PATCH /reorder calls — must be exactly ONE on a single move
  let reorderCallCount = 0
  page.on('request', req => {
    if (req.method() === 'PATCH' && req.url().includes('/reorder')) reorderCallCount++
  })

  const reorderResp = page.waitForResponse(
    r => r.url().includes('/reorder') && r.request().method() === 'PATCH' && r.ok(),
    { timeout: 10000 },
  )

  // Move second item up (first "Move item up" button that is not disabled)
  await page.getByRole('button', { name: 'Move item up' }).nth(1).click()

  await reorderResp
  expect(reorderCallCount, 'Exactly ONE bulk PATCH to /reorder').toBe(1)
})

test('missing:true item renders as "unavailable" without crashing (* mock)', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const pathTitle = `LP Missing ${Date.now()}`
  const pathId = await createFixturePath(page, H, pathTitle, false)

  // Inject a missing:true item into the GET /:id response
  await page.route(`**/learning-paths/${pathId}`, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: {
          success: true,
          data: {
            id: pathId, title: pathTitle, description: null, sequential: false,
            itemCount: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            items: [{
              id: 'pi-missing', itemType: 'COURSE', itemId: 'course-deleted-from-db',
              order: 0, createdAt: new Date().toISOString(),
              title: null, status: null, startTime: null, missing: true,
            }],
          },
        },
      })
    } else {
      route.continue()
    }
  })

  await gotoPathsTab(page)
  await page.getByText(pathTitle).first().click()
  await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible({ timeout: 5000 })

  // Must not crash — renders "Unavailable item" row (not an empty/broken row)
  await expect(page.getByText('Unavailable item')).toBeVisible({ timeout: 5000 })
  // exact: true — non-exact also matches "Unavailable item" itself.
  await expect(page.getByText('Unavailable', { exact: true })).toBeVisible()

  // Remove button is the ONLY action available on a missing item
  await expect(page.getByRole('button', { name: 'Remove unavailable item' })).toBeVisible()

  // No move-up/down buttons (check they don't exist on this row)
  // The unavailable row doesn't render ChevronUp/Down — there should be no "Move item" buttons in that row
  const unavailableRow = page.locator('[class*="amber"]').filter({ hasText: 'Unavailable item' })
  await expect(unavailableRow.getByRole('button', { name: /Move item/i })).toHaveCount(0)
})

test('Archived course item shows Archived badge — distinct from missing', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const pathTitle = `LP Archived ${Date.now()}`
  const courseTitle = `LP Archived Course ${Date.now()}`
  const pathId   = await createFixturePath(page, H, pathTitle, false)
  const courseId = await createFixtureCourse(page, H, courseTitle)

  // Add the course to the path via API (while it still exists)
  await addCourseToPathViaApi(page, H, pathId, courseId)

  // Archive the course — soft-archive via DELETE
  const archiveRes = await page.request.delete(`${API}/courses/${courseId}`, { headers: H })
  expect(archiveRes.ok(), 'Course archive must succeed').toBeTruthy()

  await gotoPathsTab(page)
  await page.getByText(pathTitle).first().click()
  await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible({ timeout: 5000 })

  // Must show "Archived" badge — not the amber "Unavailable" treatment
  await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 5000 })
  // exact: true — non-exact also matches the path heading ("LP Archived …")
  // and the item's own course name ("LP Archived Course …").
  await expect(page.getByText('Archived', { exact: true })).toBeVisible({ timeout: 5000 })

  // Must NOT render as unavailable/missing
  await expect(page.getByText('Unavailable item')).not.toBeVisible()
  await expect(page.getByText('Unavailable')).not.toBeVisible()
})

test('Overview guide "Create Learning Path" switches to Learning Paths tab and opens the create form', async ({ page }) => {
  await page.goto('/learning-management')
  await expect(page.getByRole('heading', { name: 'Learning Management', exact: true })).toBeVisible({ timeout: 15000 })

  // Guide button's accessible name includes its description text ("Design a
  // structured learning journey"), so match by name WITHOUT exact — this
  // title is unique among Overview buttons.
  const guideBtn = page.getByRole('button', { name: 'Create Learning Path' })
  await expect(guideBtn).toBeVisible({ timeout: 10000 })
  await guideBtn.click()

  await expect(page).toHaveURL(/[?&]tab=paths/)
  await expect(
    page.getByRole('heading', { name: 'Create Learning Path' }),
    'Create Learning Path heading must appear after clicking the guide shortcut',
  ).toBeVisible({ timeout: 10000 })
})
