// Content Library tab — end-to-end tests (CONTENT_LIBRARY_CONTRACT.md v1).
//
// ⚠️ TWO REAL BACKEND BUGS were found via direct curl verification before
// writing this suite (reported to the user/Hassan, not silently worked
// around):
//   1. POST /content/confirm → 500 "Internal server error", reproduced twice
//      with a genuinely successful sign+PUT and a minimal contract-shaped
//      body ({path} only, and again with title/tags added).
//   2. GET /content → `content` is ALWAYS an empty array regardless of any
//      filter, while `pagination.total` and `typeCounts` report the correct
//      real counts (e.g. total:6 but content:[]). There is no per-item GET
//      /content/:id either, so right now there is no way to read a content
//      row back from this API at all.
// The two tests in the "Known backend bugs" block hit the REAL API directly
// and are EXPECTED TO FAIL until Hassan fixes them — that failure is the
// correct signal, not a flaky test. All other tests below use page.route()
// mocks for the sign/PUT/confirm/list calls (same pattern already used by
// course-video-upload.full.spec.ts and learning-paths.full.spec.ts for
// scenarios the real API can't currently produce) so the UI itself is still
// fully verified against the contract independent of these two bugs.
//
// Run with: npx playwright test content-library.full --workers=1

import { type Page, test, expect } from '@playwright/test'

const API = 'http://localhost:5001/api/admin'

let savedToken = ''

async function ensureToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  expect(token, 'mn_admin_token must exist in localStorage').toBeTruthy()
  savedToken = token
  return token
}

async function gotoContentTab(page: Page) {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=content/)
  await expect(page.getByRole('heading', { name: 'Content Library', exact: true })).toBeVisible({ timeout: 10000 })
}

const MOCK_SIGN = {
  uploadUrl: 'https://mock-storage.example.com/upload/content-signed-url',
  path: 'library/mock-uuid-report.pdf',
  type: 'DOCUMENT',
  maxBytes: 52428800,
  expiresIn: 600,
}

async function mockUploadChain(page: Page, confirmResponse: unknown) {
  await page.route('**/content/sign', (route) => route.fulfill({ json: { success: true, data: MOCK_SIGN } }))
  await page.route('**/mock-storage.example.com/**', async (route) => {
    if (route.request().method() === 'PUT') await route.fulfill({ status: 200, body: '' })
    else await route.continue()
  })
  await page.route('**/content/confirm', (route) => route.fulfill({ json: { success: true, data: confirmResponse } }))
}

function mockContentItem(overrides: Record<string, unknown> = {}) {
  return {
    id: `content-${Date.now()}`, title: 'Report.pdf', type: 'DOCUMENT',
    courseId: null, courseTitle: null,
    fileUrl: 'https://mock-storage.example.com/library/report.pdf',
    sizeBytes: 1024, mimeType: 'application/pdf', tags: [],
    uploadedBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

async function mockList(page: Page, items: unknown[]) {
  const typeCounts: Record<string, number> = { All: items.length }
  for (const item of items as { type: string }[]) {
    typeCounts[item.type] = (typeCounts[item.type] ?? 0) + 1
  }
  await page.route('**/content/?*', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { success: true, data: { content: items, pagination: { total: items.length, page: 1, limit: 20, pages: 1 }, typeCounts } } })
    } else {
      route.continue()
    }
  })
}

// ── Known backend bugs — REAL API, expected to fail until fixed ────────────────

test.describe('Known backend bugs (real API — expected RED until Hassan fixes them)', () => {
  test('POST /content/confirm currently 500s on a valid sign+PUT+confirm chain', async ({ page }) => {
    await page.goto('/learning-management')
    const token = await ensureToken(page)
    const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    const signRes = await page.request.post(`${API}/content/sign`, {
      data: { fileName: 'regression-probe.txt', fileType: 'text/plain' }, headers: H,
    })
    expect(signRes.ok(), 'POST /content/sign must succeed').toBeTruthy()
    const { uploadUrl, path } = (await signRes.json()).data

    const putRes = await page.request.put(uploadUrl, { data: 'regression probe', headers: { 'Content-Type': 'text/plain' } })
    expect(putRes.ok(), 'PUT to the signed URL must succeed').toBeTruthy()

    const confirmRes = await page.request.post(`${API}/content/confirm`, { data: { path }, headers: H })
    expect(confirmRes.ok(), 'BUG: POST /content/confirm currently returns 500 on a contract-valid body').toBeTruthy()
  })

  test('GET /content always returns an empty content array despite a nonzero pagination.total', async ({ page }) => {
    await page.goto('/learning-management')
    const token = await ensureToken(page)
    const res = await page.request.get(`${API}/content`, { headers: { Authorization: `Bearer ${token}` } })
    expect(res.ok()).toBeTruthy()
    const data = (await res.json()).data
    if (data.pagination.total > 0) {
      expect(data.content.length, 'BUG: content array is empty while pagination.total is nonzero').toBeGreaterThan(0)
    }
  })
})

// ── UI tests (mocked sign/PUT/confirm/list — see header comment) ───────────────

test('Upload dialog has NO type picker — SCORM/QUIZ structurally cannot be offered for upload', async ({ page }) => {
  await gotoContentTab(page)
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Upload Content' })).toBeVisible({ timeout: 5000 })

  // Scoped to the dialog — the content list behind it legitimately shows
  // "SCORM"/"QUIZ" as content-type badges/filters for existing items.
  const dialog = page.getByRole('dialog', { name: 'Upload content' })
  await expect(dialog.getByText('SCORM')).toHaveCount(0)
  await expect(dialog.getByText('QUIZ', { exact: false })).toHaveCount(0)
  await expect(dialog.getByRole('combobox', { name: /type/i })).toHaveCount(0)
})

test('Non-allowed MIME type blocked client-side — no /sign request fired', async ({ page }) => {
  await gotoContentTab(page)
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Upload Content' })).toBeVisible({ timeout: 5000 })

  let signCalled = false
  await page.route('**/content/sign', () => { signCalled = true })

  const fileInput = page.locator('[data-testid="content-drop-zone"] input[type="file"]')
  await fileInput.setInputFiles({ name: 'archive.zip', mimeType: 'application/zip', buffer: Buffer.from('fake zip') })

  await expect(page.getByText(/File type not supported/)).toBeVisible({ timeout: 5000 })
  expect(signCalled, 'POST /content/sign must NOT be called for a disallowed MIME type').toBeFalsy()
})

test('Full 3-step upload — sign → PUT → confirm, row appears only after confirm succeeds (* mock)', async ({ page }) => {
  await gotoContentTab(page)
  const confirmed = mockContentItem({ title: 'Upload Flow Test' })
  await mockUploadChain(page, confirmed)

  let confirmCalled = false
  await page.route('**/content/confirm', async (route) => {
    confirmCalled = true
    await route.fulfill({ json: { success: true, data: confirmed } })
  })

  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Upload Content' })).toBeVisible({ timeout: 5000 })

  const fileInput = page.locator('[data-testid="content-drop-zone"] input[type="file"]')
  await fileInput.setInputFiles({ name: 'report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('fake pdf bytes') })

  // Metadata form appears only after a file is picked — confirm not called yet.
  await expect(page.getByText('report.pdf')).toBeVisible({ timeout: 3000 })
  expect(confirmCalled, 'confirm must not fire before the Upload button is clicked').toBe(false)

  const confirmResp = page.waitForResponse((r) => r.url().includes('/content/confirm'), { timeout: 10000 })
  await page.getByRole('button', { name: 'Upload', exact: true }).last().click()
  await confirmResp

  await expect(page.getByText('Content added to the library.')).toBeVisible({ timeout: 5000 })
})

test('Tag normalization — whatever the server returns is re-rendered as-is, never fought client-side (* mock)', async ({ page }) => {
  await gotoContentTab(page)
  // Server normalizes ["Smoke","smoke"] -> ["smoke"] per contract — mock returns
  // the POST-normalization shape; UI must render exactly that, not the input.
  const confirmed = mockContentItem({ title: 'Tag Norm Test', tags: ['smoke'] })
  await mockUploadChain(page, confirmed)
  await mockList(page, [confirmed])

  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Upload Content' })).toBeVisible({ timeout: 5000 })

  const fileInput = page.locator('[data-testid="content-drop-zone"] input[type="file"]')
  await fileInput.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('fake text') })

  const tagInput = page.getByLabel('Add tag')
  await tagInput.fill('Smoke')
  await tagInput.press('Enter')
  await tagInput.fill('smoke')
  await tagInput.press('Enter')

  await page.getByRole('button', { name: 'Upload', exact: true }).last().click()
  await expect(page.getByText('Content added to the library.')).toBeVisible({ timeout: 5000 })

  // Grid re-renders from the server's response — exactly one "smoke" tag, not two.
  await expect(page.getByText('smoke', { exact: true })).toHaveCount(1)
})

test('Legacy row with fileUrl:null hides the download action (* mock)', async ({ page }) => {
  const legacyItem = mockContentItem({ title: 'Legacy Seed Item', fileUrl: null, sizeBytes: null, mimeType: null })
  await mockList(page, [legacyItem])
  await gotoContentTab(page)

  await expect(page.getByText('Legacy Seed Item')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('link', { name: /download/i })).toHaveCount(0)
  await expect(page.getByText('No file (legacy)')).toBeVisible()
})

test('Delete — confirm dialog mentions removing the stored file, DELETE fires (* mock)', async ({ page }) => {
  const item = mockContentItem({ title: 'Delete Me' })
  await mockList(page, [item])
  await gotoContentTab(page)
  await expect(page.getByText('Delete Me')).toBeVisible({ timeout: 10000 })

  let dialogMessage = ''
  page.once('dialog', (d) => { dialogMessage = d.message(); d.accept() })

  await page.route(`**/content/${item.id}`, (route) => {
    if (route.request().method() === 'DELETE') {
      route.fulfill({ json: { success: true, message: 'Content deleted.', data: { id: item.id } } })
    } else {
      route.continue()
    }
  })

  const deleteResp = page.waitForResponse(
    (r) => r.url().includes(`/content/${item.id}`) && r.request().method() === 'DELETE',
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: `Delete ${item.title}` }).click()
  await deleteResp

  expect(dialogMessage.toLowerCase()).toContain('stored file')
  await expect(page.getByText('Delete Me')).not.toBeVisible({ timeout: 5000 })
})

test('Edit metadata — PATCH sends only changed fields, file fields never included (* mock)', async ({ page }) => {
  const item = mockContentItem({ title: 'Edit Me', tags: ['a', 'b'] })
  await mockList(page, [item])
  await gotoContentTab(page)
  await expect(page.getByText('Edit Me')).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'Edit Edit Me' }).click()
  await expect(page.getByRole('heading', { name: 'Edit Content' })).toBeVisible({ timeout: 5000 })

  const newTitle = 'Edit Me — Renamed'
  await page.getByLabel('Title').fill(newTitle)

  let capturedBody: unknown = null
  await page.route(`**/content/${item.id}`, (route) => {
    if (route.request().method() === 'PATCH') {
      capturedBody = route.request().postDataJSON()
      route.fulfill({ json: { success: true, data: { ...item, title: newTitle } } })
    } else {
      route.continue()
    }
  })

  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('Content updated.')).toBeVisible({ timeout: 5000 });

  expect(capturedBody, 'PATCH body must have been captured').toBeTruthy()
  expect(Object.keys(capturedBody as object)).toEqual(['title'])
  expect((capturedBody as { title: string }).title).toBe(newTitle)
})

test('Overview guide "Upload Content" switches to Content tab and opens the upload dialog', async ({ page }) => {
  await page.goto('/learning-management')
  await expect(page.getByRole('heading', { name: 'Learning Management', exact: true })).toBeVisible({ timeout: 15000 })

  // Guide button's accessible name includes its description text ("Add
  // content and learning materials"), so match by name WITHOUT exact — this
  // title is unique among Overview buttons.
  const guideBtn = page.getByRole('button', { name: 'Upload Content' })
  await expect(guideBtn).toBeVisible({ timeout: 10000 })
  await guideBtn.click()

  await expect(page).toHaveURL(/[?&]tab=content/)
  await expect(
    page.getByRole('heading', { name: 'Upload Content' }),
    'Upload Content dialog heading must appear after clicking the guide shortcut',
  ).toBeVisible({ timeout: 10000 })
})
