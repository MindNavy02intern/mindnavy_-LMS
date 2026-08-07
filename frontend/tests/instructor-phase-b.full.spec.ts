import { type Page, test, expect } from '@playwright/test'

// Phase B: Instructor Courses tab + Suspension & Compliance + Instructor
// Documents. Real backend throughout (no route mocking) — a disposable
// instructor + course are created via the real API so every assertion here
// reads off real responses, matching the pattern in instructor-panel-analytics
// and instructors.full.spec.ts.
//
// Run with: npx playwright test instructor-phase-b.full --workers=1

const API = 'http://localhost:5001/api/admin'

let savedToken: string | null = null
let instructorId: string | null = null
let instructorName: string | null = null
let courseId: string | null = null
let courseTitle: string | null = null
let documentId: string | null = null
let uploadedFileName: string | null = null

const detailUrlRe = () => new RegExp(`/instructors/${instructorId}(\\?|$)`)

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/instructors')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()
  if (!savedToken) return

  const stamp = Date.now()
  instructorName = `QA Phase B Instructor ${stamp}`
  const instrResp = await request.post(`${API}/instructors`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: {
      fullName: instructorName,
      email: `qa.phaseb.instructor.${stamp}@example.com`,
      password: 'Qatest!2345678',
      status: 'ACTIVE',
    },
  })
  const instrBody = await instrResp.json().catch(() => null)
  instructorId = instrBody?.data?.id ?? null
  if (!instructorId) return

  courseTitle = `QA Phase B Course ${stamp}`
  const courseResp = await request.post(`${API}/courses`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: { title: courseTitle, instructorId },
  })
  const courseBody = await courseResp.json().catch(() => null)
  courseId = courseBody?.data?.id ?? null
  if (!courseId) return

  // Draft -> Pending, so it lands under the Courses tab's Pending sub-tab.
  await request.post(`${API}/courses/${courseId}/submit`, {
    headers: { Authorization: `Bearer ${savedToken}` },
  })
})

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  // Document cleanup first (soft-archive) — not required for instructor
  // delete, but leaves zero visible leaks in the docs list.
  if (documentId && instructorId) {
    await request.delete(`${API}/instructors/${instructorId}/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    }).catch(() => null)
  }
  // Archive the course regardless of its current status (Draft/Pending/
  // Published) — deleteInstructor 409s while it still owns any non-archived
  // course.
  if (courseId) {
    await request.delete(`${API}/courses/${courseId}`, { headers: { Authorization: `Bearer ${savedToken}` } }).catch(() => null)
  }
  if (instructorId) {
    await request.delete(`${API}/instructors/${instructorId}`, { headers: { Authorization: `Bearer ${savedToken}` } }).catch(() => null)
  }
})

async function openPanel(page: Page) {
  const [resp] = await Promise.all([
    page.waitForResponse(r => detailUrlRe().test(r.url()) && r.ok(), { timeout: 15000 }),
    page.goto(`/instructors?instructor=${instructorId}`),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText('Instructor Details')).toBeVisible({ timeout: 10000 })
}

test('Courses tab loads the instructor\'s courses', async ({ page }) => {
  test.skip(!instructorId || !courseId, 'Setup instructor/course was not created — backend may be unavailable')

  await openPanel(page)

  const [coursesResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/courses') && r.url().includes(`instructor=${instructorId}`) && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Courses', exact: true }).click(),
  ])
  expect(coursesResp.ok()).toBeTruthy()

  await expect(page.getByText(courseTitle as string)).toBeVisible({ timeout: 10000 })
  const row = page.locator('tr', { has: page.getByText(courseTitle as string) })
  await expect(row.getByText('PENDING', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('Approving a pending course changes its status to Published', async ({ page }) => {
  test.skip(!instructorId || !courseId, 'Setup instructor/course was not created — backend may be unavailable')

  await openPanel(page)
  await page.getByRole('button', { name: 'Courses', exact: true }).click()
  await expect(page.getByText(courseTitle as string)).toBeVisible({ timeout: 10000 })

  const row = page.locator('tr', { has: page.getByText(courseTitle as string) })
  await expect(row.getByText('PENDING', { exact: true })).toBeVisible({ timeout: 10000 })

  page.once('dialog', dialog => dialog.accept())
  const [approveResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/courses/${courseId}/approve`) && r.ok(), { timeout: 15000 }),
    row.getByTitle('Approve').click(),
  ])
  expect(approveResp.ok()).toBeTruthy()

  await expect(row.getByText('PUBLISHED', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('Suspending an instructor with violation type + reason updates the status badge', async ({ page }) => {
  test.skip(!instructorId, 'Setup instructor was not created — backend may be unavailable')

  await openPanel(page)
  await page.getByRole('button', { name: 'Suspend', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Suspend Instructor' })).toBeVisible({ timeout: 5000 })

  await page.getByLabel('Violation type').selectOption('POLICY')
  await page.getByLabel('Suspension reason').fill('Automated Phase B QA suspension test — repeated policy violations')

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructors/${instructorId}/suspend`) && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Confirm Suspend' }).click(),
  ])
  expect(resp.ok()).toBeTruthy()

  // Status badge flips immediately from the PATCH response — no reload.
  await expect(page.getByText('suspended', { exact: true })).toBeVisible({ timeout: 10000 })
  // Suspension History section reflects the new entry.
  await expect(page.getByText('SUSPENDED', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('Reactivating a suspended instructor returns the status to active', async ({ page }) => {
  test.skip(!instructorId, 'Setup instructor was not created — backend may be unavailable')

  await openPanel(page)
  await expect(page.getByText('suspended', { exact: true })).toBeVisible({ timeout: 10000 })

  page.once('dialog', dialog => dialog.accept())
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructors/${instructorId}/reactivate`) && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Reactivate', exact: true }).click(),
  ])
  expect(resp.ok()).toBeTruthy()

  await expect(page.getByText('active', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('REACTIVATED', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('Uploading a document adds it to the Documents list', async ({ page }) => {
  test.skip(!instructorId, 'Setup instructor was not created — backend may be unavailable')

  await openPanel(page)
  await page.getByRole('button', { name: 'Documents', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Upload Document' })).toBeVisible({ timeout: 10000 })

  uploadedFileName = `qa-phase-b-${Date.now()}.pdf`

  await page.getByRole('button', { name: 'Upload Document' }).click()
  await expect(page.getByRole('heading', { name: 'Upload Document' })).toBeVisible({ timeout: 5000 })

  await page.getByLabel('Document file').setInputFiles({
    name: uploadedFileName,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 fake pdf content for Phase B QA'),
  })
  await page.getByLabel('Document type').selectOption('IDENTITY')

  const [signResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructors/${instructorId}/documents/sign`), { timeout: 15000 }),
    page.getByRole('button', { name: 'Upload', exact: true }).click(),
  ])

  // 503 = storage bucket not provisioned in this environment (contract:
  // "Document storage is not configured yet.") — not a frontend bug.
  test.skip(signResp.status() === 503, 'Document storage bucket not configured in this environment')
  expect(signResp.ok()).toBeTruthy()

  await expect(page.getByText(uploadedFileName)).toBeVisible({ timeout: 20000 })

  const listResp = await page.request.get(`${API}/instructors/${instructorId}/documents`, {
    headers: { Authorization: `Bearer ${savedToken}` },
  })
  const listBody = await listResp.json().catch(() => null)
  const match = (listBody?.data?.documents ?? []).find((d: { fileName: string; id: string }) => d.fileName === uploadedFileName)
  documentId = match?.id ?? null
  expect(documentId, 'Uploaded document must be findable via GET /documents').toBeTruthy()
})

test('Verifying a document changes its status to VERIFIED', async ({ page }) => {
  test.skip(!instructorId || !documentId || !uploadedFileName, 'Upload test did not produce a document — storage may be unavailable')

  await openPanel(page)
  await page.getByRole('button', { name: 'Documents', exact: true }).click()
  await expect(page.getByText(uploadedFileName as string)).toBeVisible({ timeout: 10000 })

  const row = page.locator('tr', { has: page.getByText(uploadedFileName as string) })
  await expect(row.getByText('PENDING', { exact: true })).toBeVisible({ timeout: 10000 })

  const [verifyResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/documents/${documentId}/verify`) && r.ok(), { timeout: 15000 }),
    row.getByTitle('Verify').click(),
  ])
  expect(verifyResp.ok()).toBeTruthy()

  await expect(row.getByText('VERIFIED', { exact: true })).toBeVisible({ timeout: 10000 })
})
