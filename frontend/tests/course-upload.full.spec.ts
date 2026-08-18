import { test, expect, type Page } from '@playwright/test'

// Tests for the Phase 1 thumbnail upload UI (ThumbnailUpload component inside
// CourseForm).  Requires USE_MOCK=false (real backend) but mocks network
// calls to the storage provider via page.route() so no real file storage is
// needed.  All API calls to the Express backend are also mocked so the suite
// runs without a configured storage bucket.
//
// Contract: "Course Builder + Uploads — API Contract v1"
// Backend: POST /api/admin/uploads/sign  → UploadSignResponse
//          POST /api/admin/uploads/confirm → UploadConfirmResponse
//          DELETE /api/admin/uploads?path= → { deleted: true }
// XHR PUT → signed uploadUrl (Supabase / external storage)

const API = 'http://localhost:5001/api/admin'
const createdCourseIds: string[] = []
let savedToken = ''

// ── Shared fixtures ───────────────────────────────────────────────────────────

const MOCK_SIGN = {
  uploadUrl: 'https://mock-storage.example.com/upload/signed-url',
  path: 'course-id-test/uuid-1-thumbnail.jpg',
  kind: 'thumbnail',
  maxBytes: 5 * 1024 * 1024,
  expiresIn: 600,
};

const MOCK_SIGN_2 = {
  ...MOCK_SIGN,
  path: 'course-id-test/uuid-2-thumbnail.jpg',
};

const MOCK_CONFIRM = {
  url: 'https://mock-storage.example.com/thumbnails/course-id-test/thumb.jpg',
};

// Navigate to the edit form for a dedicated fixture course created fresh here
// — never "whichever course is first in the table". Every test below assumes
// the course starts at the idle/empty thumbnail drop zone, but the table is
// shared with the rest of the suite and sorted by updatedAt desc, so grabbing
// the first row broke as soon as some other file's fixture (many of which set
// a real thumbnail, e.g. instructor-panel-analytics.full.spec.ts) became the
// most recently updated course — this test then hit the already-uploaded
// "Replace/Remove" UI instead of a raw <input type="file">, and every test
// hung for the full 30s timeout waiting on setInputFiles to find an input
// that was never rendered in that state.
async function gotoEditForm(page: Page) {
  // Must navigate before reading localStorage — evaluate() on a fresh
  // about:blank page throws SecurityError (Chromium restriction).
  await page.goto('/dashboard')
  const token = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  expect(token, 'mn_admin_token must exist in localStorage').toBeTruthy()
  savedToken = token
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const filterRes = await page.request.get(`${API}/lm/filter-options`, { headers: H })
  expect(filterRes.ok()).toBeTruthy()
  const instructorId: string = (await filterRes.json()).data?.instructors?.[0]?.id
  expect(instructorId, 'At least one INSTRUCTOR user must exist in the DB').toBeTruthy()

  const title = `Upload Fixture ${Date.now()}`
  const courseRes = await page.request.post(`${API}/courses`, { data: { title, instructorId }, headers: H })
  expect(courseRes.ok(), 'POST /courses must succeed').toBeTruthy()
  const courseId: string = (await courseRes.json()).data?.id
  expect(courseId, 'Course id must be returned').toBeTruthy()
  createdCourseIds.push(courseId)

  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible({ timeout: 15000 })

  const searchResp = page.waitForResponse(r => r.url().includes('/courses') && r.url().includes('search=') && r.ok(), { timeout: 15000 })
  await page.getByPlaceholder('Search courses…').fill(title)
  await searchResp

  const row = page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  await expect(page.getByRole('heading', { name: /Edit Course|Create Course/i })).toBeVisible({ timeout: 10000 })
  return true
}

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }
  for (const id of createdCourseIds) {
    await request.delete(`${API}/courses/${id}`, { headers: H }).catch(() => null)
  }
})

// Set up the standard upload API mocks (sign → PUT → confirm).
// Returns a cleanup handle so individual tests can override specific routes.
async function setupUploadMocks(page: Page, signData = MOCK_SIGN) {
  await page.route('**/uploads/sign', route =>
    route.fulfill({ json: { success: true, data: signData } })
  )
  // The PUT goes to the mock storage domain from the sign response
  await page.route('**/mock-storage.example.com/**', async route => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ status: 200, body: '' })
    } else {
      await route.continue()
    }
  })
  await page.route('**/uploads/confirm', route =>
    route.fulfill({ json: { success: true, data: MOCK_CONFIRM } })
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('Type rejection — non-image file blocked client-side, no API request', async ({ page }) => {
  const ok = await gotoEditForm(page)
  if (!ok) return

  let signCalled = false
  await page.route('**/uploads/sign', () => { signCalled = true })

  // Try to upload a PDF (not in ALLOWED_MIME)
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'contract.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('fake pdf content'),
  })

  // Inline error message should appear immediately (no network needed).
  // Use the exact error string — not the static hint "JPEG · PNG · WebP · max …"
  // which also contains those words and would cause a strict-mode violation.
  await expect(
    page.getByText('Only JPEG, PNG, and WebP images are accepted.', { exact: true }),
    'Type-rejection error message must appear',
  ).toBeVisible({ timeout: 5000 })

  // Confirm no sign request was made
  expect(signCalled, 'POST /uploads/sign must NOT be called for invalid type').toBeFalsy()
})

test('Size rejection — file > 5 MB blocked client-side, no API request', async ({ page }) => {
  const ok = await gotoEditForm(page)
  if (!ok) return

  let signCalled = false
  await page.route('**/uploads/sign', () => { signCalled = true })

  // 6 MB JPEG — exceeds CLIENT_MAX_BYTES (5 MB)
  const bigBuffer = Buffer.alloc(6 * 1024 * 1024)
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'huge.jpg',
    mimeType: 'image/jpeg',
    buffer: bigBuffer,
  })

  // Use the exact error string — not the static hint "… max 5.0 MB" in the drop
  // zone which also contains "5.0 MB" and would cause a strict-mode violation.
  await expect(
    page.getByText('File must be smaller than 5.0 MB.', { exact: true }),
    'Size-rejection error message must appear',
  ).toBeVisible({ timeout: 5000 })

  expect(signCalled, 'POST /uploads/sign must NOT be called for oversized file').toBeFalsy()
})

test('Successful thumbnail flow — sign → PUT → confirm → preview visible', async ({ page }) => {
  const ok = await gotoEditForm(page)
  if (!ok) return

  await setupUploadMocks(page)

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fake jpeg data'),
  })

  // After successful confirm, the preview image should appear
  await expect(
    page.locator('[data-testid="thumbnail-done"]'),
    'Thumbnail done state must appear after successful upload',
  ).toBeVisible({ timeout: 15000 })

  await expect(
    page.getByText('Thumbnail uploaded'),
  ).toBeVisible()
})

test('Progress bar renders during file transfer', async ({ page }) => {
  const ok = await gotoEditForm(page)
  if (!ok) return

  // Sign completes immediately; PUT is held for a short delay
  await page.route('**/uploads/sign', route =>
    route.fulfill({ json: { success: true, data: MOCK_SIGN } })
  )
  await page.route('**/mock-storage.example.com/**', async route => {
    if (route.request().method() === 'PUT') {
      // Small delay so the uploading state is observable
      await new Promise(r => setTimeout(r, 400))
      await route.fulfill({ status: 200, body: '' })
    } else {
      await route.continue()
    }
  })
  await page.route('**/uploads/confirm', route =>
    route.fulfill({ json: { success: true, data: MOCK_CONFIRM } })
  )

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fake jpeg data'),
  })

  // The uploading container must appear while transfer is in progress
  await expect(
    page.locator('[data-testid="thumbnail-uploading"]'),
    'Uploading state must appear during transfer',
  ).toBeVisible({ timeout: 5000 })

  // The ARIA progressbar must be rendered
  await expect(
    page.getByRole('progressbar'),
    'progressbar role must be present during upload',
  ).toBeVisible()

  // Wait for completion
  await expect(page.locator('[data-testid="thumbnail-done"]')).toBeVisible({ timeout: 15000 })
})

test('Cancel mid-upload resets UI to idle drop zone', async ({ page }) => {
  const ok = await gotoEditForm(page)
  if (!ok) return

  // Sign responds immediately
  await page.route('**/uploads/sign', route =>
    route.fulfill({ json: { success: true, data: MOCK_SIGN } })
  )

  // PUT never completes — holds while we click Cancel
  let routeHeld = true
  await page.route('**/mock-storage.example.com/**', async route => {
    if (route.request().method() !== 'PUT') { await route.continue(); return }
    while (routeHeld) await new Promise(r => setTimeout(r, 50))
    await route.fulfill({ status: 200, body: '' }).catch(() => null)
  })

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fake jpeg data'),
  })

  // Scope Cancel to the uploading widget — there may be another "Cancel" button
  // elsewhere on the page (e.g. the CourseForm's Cancel action), which would
  // cause a strict-mode violation on an unscoped getByRole.
  const uploadingWidget = page.locator('[data-testid="thumbnail-uploading"]')
  const cancelBtn = uploadingWidget.getByRole('button', { name: 'Cancel', exact: true })
  await expect(cancelBtn, 'Cancel button must appear during upload').toBeVisible({ timeout: 10000 })

  // Click cancel
  await cancelBtn.click()
  routeHeld = false // unblock the held route (cleanup)

  // Drop zone must be restored
  await expect(
    page.locator('[data-testid="thumbnail-drop-zone"]'),
    'Drop zone must be restored after cancel',
  ).toBeVisible({ timeout: 5000 })
})

test('Replace thumbnail deletes old storage path', async ({ page }) => {
  const ok = await gotoEditForm(page)
  if (!ok) return

  const deletedPaths: string[] = []

  // First upload — sign returns path 1
  await setupUploadMocks(page, MOCK_SIGN)
  await page.route('**/uploads?**', async route => {
    if (route.request().method() === 'DELETE') {
      const url = new URL(route.request().url())
      deletedPaths.push(decodeURIComponent(url.searchParams.get('path') ?? ''))
      await route.fulfill({ json: { success: true, data: { deleted: true } } })
    } else {
      await route.continue()
    }
  })

  const fileInput = page.locator('input[type="file"]')

  // Upload first thumbnail
  await fileInput.setInputFiles({
    name: 'first.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('first image'),
  })
  await expect(page.locator('[data-testid="thumbnail-done"]')).toBeVisible({ timeout: 15000 })

  // Click Replace to go back to idle
  await page.getByRole('button', { name: /Replace/i }).click()
  await expect(page.locator('[data-testid="thumbnail-drop-zone"]')).toBeVisible({ timeout: 5000 })

  // Second upload — sign returns path 2
  await page.route('**/uploads/sign', route =>
    route.fulfill({ json: { success: true, data: MOCK_SIGN_2 } })
  )

  await fileInput.setInputFiles({
    name: 'second.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('second image'),
  })
  await expect(page.locator('[data-testid="thumbnail-done"]')).toBeVisible({ timeout: 15000 })

  // The first uploaded path must have been sent to DELETE
  await page.waitForTimeout(500) // allow the best-effort delete to fire
  expect(
    deletedPaths,
    'DELETE must be called with the first uploaded path when replacing',
  ).toContain(MOCK_SIGN.path)
})
