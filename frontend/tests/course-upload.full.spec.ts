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

// Navigate to the edit form for the first available course.
// Tests that need a real courseId for the upload flow must call this.
async function gotoEditForm(page: Page) {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible({ timeout: 15000 })

  // Wait for the data fetch to complete — CoursesTab only renders the pagination
  // text ("Showing N–M of Z courses") once loading=false, so this is the earliest
  // moment at which actual data rows (with Edit buttons) are in the DOM.
  // Checking isVisible() before this point returns false because skeleton rows
  // have no buttons, which previously caused all 6 tests to skip incorrectly.
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 15000 })

  const firstEditBtn = page.locator('table tbody tr').first()
    .getByRole('button', { name: /Edit/i })

  // isVisible() is safe here because loading is confirmed done above.
  const hasEditBtn = await firstEditBtn.isVisible().catch(() => false)
  if (!hasEditBtn) {
    test.skip(true, 'No courses in DB — seed at least one course and re-run.')
    return false
  }
  await firstEditBtn.click()
  await expect(page.getByRole('heading', { name: /Edit Course|Create Course/i })).toBeVisible({ timeout: 10000 })
  return true
}

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
