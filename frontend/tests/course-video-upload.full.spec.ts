import { test, expect, type Page } from '@playwright/test'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Tests for the video file upload UI (VideoUpload component inside LessonFormModal
// in CourseBuilder).  Requires USE_MOCK=false (real backend) but mocks network
// calls to storage via page.route().
//
// Contract: "Video Upload — Backend API"
// Backend: POST /api/admin/uploads/sign  → UploadSignResponse
//          POST /api/admin/uploads/confirm → UploadConfirmResponse
//          DELETE /api/admin/uploads?path=&kind=video → { deleted: true }
//
// Run with: npx playwright test course-video-upload.full --workers=1

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_SIGN = {
  uploadUrl: 'https://mock-storage.example.com/upload/video-signed-url',
  path: 'course-test/uuid-1-video.mp4',
  kind: 'video',
  maxBytes: 52428800, // 50 MB
  expiresIn: 600,
}

const MOCK_CONFIRM = {
  url: 'https://mock-storage.example.com/videos/course-test/video.mp4',
}

// ── Cleanup state (option c: self-cleaning tests) ─────────────────────────────
const createdCourseIds: string[] = []
let savedToken: string | null = null

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  for (const id of createdCourseIds) {
    await request.delete(
      `http://localhost:5001/api/admin/courses/${id}`,
      { headers: { Authorization: `Bearer ${savedToken}` } },
    ).catch(() => null)
  }
})

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Navigate to the Courses tab and return true, or skip if no courses exist. */
async function gotoCoursesTab(page: Page): Promise<boolean> {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/Showing \d+–\d+ of \d+ courses/)).toBeVisible({ timeout: 15000 })
  return true
}

/**
 * Shared setup: create a draft course + one section, land in Course Builder.
 * Returns false (and calls test.skip) if no instructors exist in the DB.
 * Root cause of previous skip-all: instructor options are populated by an async
 * useEffect (getLmFilterOptions). The old code checked option count immediately
 * after the heading appeared — before the API response arrived — so count was
 * always 0 and test.skip fired for every test. Fix: start watching for the
 * filter-options response BEFORE clicking Create Course, then await it before
 * checking instructor options.
 */
async function gotoCourseBuilderWithSection(page: Page, titlePrefix = 'VideoUpload Test'): Promise<boolean> {
  await gotoCoursesTab(page)

  if (!savedToken) {
    savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  }

  // Set up response watcher BEFORE clicking so we can't miss the response that
  // fires when CourseForm mounts and calls getLmFilterOptions().
  const filterRespPromise = page.waitForResponse(
    r => r.url().includes('/lm/filter-options'),
    { timeout: 10000 },
  )

  await page.getByRole('button', { name: 'Create Course', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Create Course' })).toBeVisible({ timeout: 5000 })

  // Await the response before checking options — eliminates the race condition.
  await filterRespPromise

  const titleInput = page.getByPlaceholder('e.g. Advanced Python Programming')
  const instructorSelect = page.locator('select:has(option:text-is("Select instructor…"))')

  const hasInstructor = await instructorSelect.locator('option').nth(1).count() > 0
  if (!hasInstructor) {
    test.skip(true, 'No instructors in DB — seed at least one and re-run.')
    return false
  }

  await titleInput.fill(`${titlePrefix} ${Date.now()}`)
  await instructorSelect.selectOption({ index: 1 })

  // Set up course-ID watcher before click so we don't miss the POST.
  const courseRespPromise = page.waitForResponse(
    r => r.url().includes('/api/admin/courses') && r.request().method() === 'POST' && r.ok(),
    { timeout: 15000 },
  )

  // Save draft + go to builder
  const [sectionsResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/sections') && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: /Next: Course Builder/ }).click(),
  ])
  expect(sectionsResp.ok()).toBeTruthy()

  const courseId = ((await (await courseRespPromise).json()) as { data?: { id?: string } }).data?.id
  if (courseId) createdCourseIds.push(courseId)

  await expect(page.getByRole('heading', { name: 'Course Builder' })).toBeVisible({ timeout: 10000 })

  // Add section
  await page.getByRole('button', { name: /Add Section/ }).last().click()
  await expect(page.getByLabel('New section title')).toBeVisible({ timeout: 3000 })
  const [postSection] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/sections') && r.request().method() === 'POST' && r.ok(), { timeout: 10000 }),
    (async () => {
      await page.getByLabel('New section title').fill(`Section ${Date.now()}`)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
    })(),
  ])
  expect(postSection.ok()).toBeTruthy()
  await page.waitForResponse(r => r.url().includes('/sections') && r.request().method() === 'GET' && r.ok(), { timeout: 10000 })

  return true
}

/**
 * Create a draft course, open the Course Builder, add a section, add a
 * VIDEO_URL lesson, then open edit on that lesson and switch to the Upload File
 * tab.  Returns false and marks the test skipped if no instructors exist.
 */
async function gotoVideoLessonUploadTab(page: Page): Promise<boolean> {
  const ok = await gotoCourseBuilderWithSection(page)
  if (!ok) return false

  // Add VIDEO_URL lesson
  // /i: the per-section button's aria-label is "Add lesson to <section title>"
  // (sentence-case, matching this codebase's convention for per-item labels)
  // — a case-sensitive regex against "Add Lesson" never matches it.
  await page.getByRole('button', { name: /Add Lesson/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Add Lesson' })).toBeVisible({ timeout: 3000 })

  const lessonTitle = `Video Lesson ${Date.now()}`
  const [postLesson] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/lessons') && r.request().method() === 'POST' && r.ok(), { timeout: 10000 }),
    (async () => {
      await page.getByLabel('Lesson title').fill(lessonTitle)
      await page.getByRole('button', { name: 'Video URL' }).click()
      // exact: true — non-exact also matches the "Video URL type" selector button.
      await page.getByLabel('Video URL', { exact: true }).fill('https://example.com/placeholder.mp4')
      // exact: true — non-exact also matches the per-section trigger button
      // (aria-label "Add lesson to <section title>", substring-contains "Add Lesson").
      await page.getByRole('button', { name: 'Add Lesson', exact: true }).click()
    })(),
  ])
  expect(postLesson.ok()).toBeTruthy()
  await page.waitForResponse(r => r.url().includes('/sections') && r.request().method() === 'GET' && r.ok(), { timeout: 10000 })

  // Open edit on the lesson
  await page.getByRole('button', { name: `Edit lesson ${lessonTitle}` }).click()
  await expect(page.getByRole('heading', { name: 'Edit Lesson' })).toBeVisible({ timeout: 5000 })

  // Switch to Upload File tab
  await page.getByRole('button', { name: 'Upload File', exact: true }).click()
  await expect(page.locator('[data-testid="video-upload-drop-zone"]')).toBeVisible({ timeout: 3000 })

  return true
}

async function setupVideoUploadMocks(page: Page, signData = MOCK_SIGN) {
  await page.route('**/uploads/sign', route =>
    route.fulfill({ json: { success: true, data: signData } })
  )
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

// ── Edit-mode type-change gate ────────────────────────────────────────────────

test('Edit mode TEXT→VIDEO_URL gates Upload File until type is saved, then unlocks', async ({ page }) => {
  // Create a TEXT lesson in the builder
  const ok = await gotoCourseBuilderWithSection(page, 'TypeChange Test')
  if (!ok) return

  // /i: the per-section button's aria-label is "Add lesson to <section title>"
  // (sentence-case, matching this codebase's convention for per-item labels)
  // — a case-sensitive regex against "Add Lesson" never matches it.
  await page.getByRole('button', { name: /Add Lesson/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Add Lesson' })).toBeVisible({ timeout: 3000 })

  const lessonTitle = `Text Lesson ${Date.now()}`
  const [postLesson] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/lessons') && r.request().method() === 'POST' && r.ok(),
      { timeout: 10000 },
    ),
    (async () => {
      await page.getByLabel('Lesson title').fill(lessonTitle)
      // Leave type as Text (default)
      // exact: true — non-exact also matches the per-section trigger button
      // (aria-label "Add lesson to <section title>", substring-contains "Add Lesson").
      await page.getByRole('button', { name: 'Add Lesson', exact: true }).click()
    })(),
  ])
  expect(postLesson.ok()).toBeTruthy()
  await page.waitForResponse(
    r => r.url().includes('/sections') && r.request().method() === 'GET' && r.ok(),
    { timeout: 10000 },
  )

  // Open Edit Lesson for the TEXT lesson
  await page.getByRole('button', { name: `Edit lesson ${lessonTitle}` }).click()
  await expect(page.getByRole('heading', { name: 'Edit Lesson' })).toBeVisible({ timeout: 5000 })

  // Switch type to Video URL
  await page.getByRole('button', { name: 'Video URL' }).click()

  // Switch to Upload File tab
  await page.getByRole('button', { name: 'Upload File', exact: true }).click()

  // Upload must be gated with the "save type first" message
  await expect(
    page.locator('[data-testid="video-upload-disabled"]'),
    'Upload File must show disabled state before type-change is saved',
  ).toBeVisible({ timeout: 3000 })
  await expect(
    page.getByText('Save the lesson as Video URL type first'),
    'Must show the specific type-change gate message',
  ).toBeVisible()

  // Save Changes — skips URL validation (upload mode), saves type change only
  const [patchResp] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/lessons') && r.request().method() === 'PATCH' && r.ok(),
      { timeout: 10000 },
    ),
    page.getByRole('button', { name: 'Save Changes' }).click(),
  ])
  expect(patchResp.ok()).toBeTruthy()

  // Modal must STAY OPEN (option a) — user can upload without re-opening
  await expect(
    page.getByRole('heading', { name: 'Edit Lesson' }),
    'Modal must remain open after type-change save',
  ).toBeVisible({ timeout: 5000 })

  // Upload File must now be unlocked
  await expect(
    page.locator('[data-testid="video-upload-drop-zone"]'),
    'Drop zone must appear once the type change is saved',
  ).toBeVisible({ timeout: 5000 })
})

test('Create mode shows "save lesson first" — no upload available', async ({ page }) => {
  // Self-contained: create a fresh course + section so this test never depends
  // on pre-existing DB data (which caused the previous test.skip to fire).
  const ok = await gotoCourseBuilderWithSection(page, 'CreateMode Test')
  if (!ok) return

  // Open "Add Lesson" in create mode (no lessonId — lesson has not been saved yet)
  // /i: the per-section button's aria-label is "Add lesson to <section title>"
  // (sentence-case, matching this codebase's convention for per-item labels)
  // — a case-sensitive regex against "Add Lesson" never matches it.
  await page.getByRole('button', { name: /Add Lesson/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Add Lesson' })).toBeVisible({ timeout: 3000 })
  await page.getByRole('button', { name: 'Video URL' }).click()

  // Switch to Upload File tab in create mode
  await page.getByRole('button', { name: 'Upload File', exact: true }).click()

  // The disabled state must show "save lesson first" notice
  await expect(
    page.locator('[data-testid="video-upload-disabled"]'),
    'Create mode must show disabled video upload state',
  ).toBeVisible({ timeout: 3000 })
  // CourseBuilder passes VideoUpload a more specific disabled message than
  // the component's generic fallback ("Save lesson first to enable file upload").
  await expect(page.getByText(/Save the lesson as Video URL type first/i)).toBeVisible()
})

test('Type rejection — non-video file blocked client-side, no sign request', async ({ page }) => {
  const ok = await gotoVideoLessonUploadTab(page)
  if (!ok) return

  let signCalled = false
  await page.route('**/uploads/sign', () => { signCalled = true })

  const fileInput = page.locator('[data-testid="video-upload-drop-zone"] input[type="file"]')
  await fileInput.setInputFiles({
    name: 'document.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('fake pdf'),
  })

  await expect(
    page.getByText('Only MP4, WebM, and MOV video files are accepted.', { exact: true }),
    'Type-rejection error must appear',
  ).toBeVisible({ timeout: 5000 })

  expect(signCalled, 'POST /uploads/sign must NOT be called for invalid type').toBeFalsy()
})

test('Size rejection — file > 50 MB blocked client-side, no sign request', async ({ page }) => {
  const ok = await gotoVideoLessonUploadTab(page)
  if (!ok) return

  let signCalled = false
  await page.route('**/uploads/sign', () => { signCalled = true })

  // 51 MB — setInputFiles rejects an inline buffer over 50MB ("write it to a
  // file and pass its path instead"), so write it to a real temp file.
  const bigFilePath = join(tmpdir(), `huge-${Date.now()}.mp4`)
  writeFileSync(bigFilePath, Buffer.alloc(51 * 1024 * 1024))
  const fileInput = page.locator('[data-testid="video-upload-drop-zone"] input[type="file"]')
  try {
    await fileInput.setInputFiles(bigFilePath)
  } finally {
    unlinkSync(bigFilePath)
  }

  await expect(
    page.getByText('File must be smaller than 50.0 MB.', { exact: true }),
    'Size-rejection error must appear',
  ).toBeVisible({ timeout: 5000 })

  expect(signCalled, 'POST /uploads/sign must NOT be called for oversized file').toBeFalsy()
})

test('Successful video upload — sign → PUT → confirm → done state visible', async ({ page }) => {
  const ok = await gotoVideoLessonUploadTab(page)
  if (!ok) return

  await setupVideoUploadMocks(page)

  const fileInput = page.locator('[data-testid="video-upload-drop-zone"] input[type="file"]')
  await fileInput.setInputFiles({
    name: 'lecture.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('fake mp4 data'),
  })

  await expect(
    page.locator('[data-testid="video-upload-done"]'),
    'Done state must appear after successful upload',
  ).toBeVisible({ timeout: 15000 })

  await expect(page.getByText('Video uploaded')).toBeVisible()
})

test('Progress bar renders during video transfer', async ({ page }) => {
  const ok = await gotoVideoLessonUploadTab(page)
  if (!ok) return

  await page.route('**/uploads/sign', route =>
    route.fulfill({ json: { success: true, data: MOCK_SIGN } })
  )
  await page.route('**/mock-storage.example.com/**', async route => {
    if (route.request().method() === 'PUT') {
      await new Promise(r => setTimeout(r, 400)) // hold for a moment
      await route.fulfill({ status: 200, body: '' })
    } else {
      await route.continue()
    }
  })
  await page.route('**/uploads/confirm', route =>
    route.fulfill({ json: { success: true, data: MOCK_CONFIRM } })
  )

  const fileInput = page.locator('[data-testid="video-upload-drop-zone"] input[type="file"]')
  await fileInput.setInputFiles({
    name: 'lecture.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('fake mp4 data'),
  })

  await expect(
    page.locator('[data-testid="video-upload-uploading"]'),
    'Uploading state must appear during transfer',
  ).toBeVisible({ timeout: 5000 })

  await expect(
    page.getByRole('progressbar'),
    'progressbar role must be present during upload',
  ).toBeVisible()

  await expect(page.locator('[data-testid="video-upload-done"]')).toBeVisible({ timeout: 15000 })
})

test('Cancel mid-upload resets UI to drop zone', async ({ page }) => {
  const ok = await gotoVideoLessonUploadTab(page)
  if (!ok) return

  await page.route('**/uploads/sign', route =>
    route.fulfill({ json: { success: true, data: MOCK_SIGN } })
  )

  let routeHeld = true
  await page.route('**/mock-storage.example.com/**', async route => {
    if (route.request().method() !== 'PUT') { await route.continue(); return }
    while (routeHeld) await new Promise(r => setTimeout(r, 50))
    await route.fulfill({ status: 200, body: '' }).catch(() => null)
  })

  const fileInput = page.locator('[data-testid="video-upload-drop-zone"] input[type="file"]')
  await fileInput.setInputFiles({
    name: 'lecture.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('fake mp4'),
  })

  const uploadingWidget = page.locator('[data-testid="video-upload-uploading"]')
  const cancelBtn = uploadingWidget.getByRole('button', { name: 'Cancel', exact: true })
  await expect(cancelBtn, 'Cancel button must appear during upload').toBeVisible({ timeout: 10000 })

  await cancelBtn.click()
  routeHeld = false

  await expect(
    page.locator('[data-testid="video-upload-drop-zone"]'),
    'Drop zone must be restored after cancel',
  ).toBeVisible({ timeout: 5000 })
})

test('Save Lesson button is disabled while video upload is in progress', async ({ page }) => {
  const ok = await gotoVideoLessonUploadTab(page)
  if (!ok) return

  await page.route('**/uploads/sign', route =>
    route.fulfill({ json: { success: true, data: MOCK_SIGN } })
  )

  // Hold PUT so the upload stays in progress
  let routeHeld = true
  await page.route('**/mock-storage.example.com/**', async route => {
    if (route.request().method() !== 'PUT') { await route.continue(); return }
    while (routeHeld) await new Promise(r => setTimeout(r, 50))
    await route.fulfill({ status: 200, body: '' }).catch(() => null)
  })

  const fileInput = page.locator('[data-testid="video-upload-drop-zone"] input[type="file"]')
  await fileInput.setInputFiles({
    name: 'lecture.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('fake mp4'),
  })

  await expect(
    page.locator('[data-testid="video-upload-uploading"]'),
    'Upload must be in progress',
  ).toBeVisible({ timeout: 5000 })

  // The Save Changes button in the modal footer must be disabled during upload.
  await expect(
    page.getByRole('button', { name: 'Save Changes' }),
    'Save Changes must be disabled while upload is in progress',
  ).toBeDisabled()

  routeHeld = false // cleanup
})
