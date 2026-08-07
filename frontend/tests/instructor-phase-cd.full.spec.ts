import { type Page, test, expect } from '@playwright/test'

// Phase C+D: Instructor Reviews tab + Certifications tab + Suspension History
// (real endpoint — already shipped, see InstructorSuspensionHistory.tsx).
// Real backend throughout (no route mocking) — a disposable instructor is
// created via the real API, matching the pattern in instructor-phase-b.
//
// NOTE: Reviews + Certifications are NOT in INSTRUCTORS_CONTRACT.md v1 (both
// documented there as deliberate [planned] gaps — "decision for Hassan, not a
// bug"). Shipped anyway at the user's explicit direction 2026-08-07.
//
// Run with: npx playwright test instructor-phase-cd.full --workers=1

const API = 'http://localhost:5001/api/admin'

let savedToken: string | null = null
let instructorId: string | null = null
let instructorName: string | null = null
let certificationId: string | null = null
let uploadedCertName: string | null = null

const detailUrlRe = () => new RegExp(`/instructors/${instructorId}(\\?|$)`)

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/instructors')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()
  if (!savedToken) return

  const stamp = Date.now()
  instructorName = `QA Phase CD Instructor ${stamp}`
  const instrResp = await request.post(`${API}/instructors`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: {
      fullName: instructorName,
      email: `qa.phasecd.instructor.${stamp}@example.com`,
      password: 'Qatest!2345678',
      status: 'ACTIVE',
    },
  })
  const instrBody = await instrResp.json().catch(() => null)
  instructorId = instrBody?.data?.id ?? null
})

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  // Certification cleanup first — zero leaks in the list even though
  // deleteInstructor doesn't require it (certifications don't block archive).
  if (certificationId && instructorId) {
    await request.delete(`${API}/instructors/${instructorId}/certifications/${certificationId}`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    }).catch(() => null)
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

test('Reviews tab loads and shows the empty state', async ({ page }) => {
  test.skip(!instructorId, 'Setup instructor was not created — backend may be unavailable')

  await openPanel(page)

  const [reviewsResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructors/${instructorId}/reviews`) && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Reviews', exact: true }).click(),
  ])
  expect(reviewsResp.ok()).toBeTruthy()

  // A freshly-created instructor has no reviews — the empty state renders.
  await expect(page.getByText('No reviews yet.')).toBeVisible({ timeout: 10000 })
})

test('Uploading a certification then verifying it shows VERIFIED', async ({ page }) => {
  test.skip(!instructorId, 'Setup instructor was not created — backend may be unavailable')

  await openPanel(page)
  await page.getByRole('button', { name: 'Certifications', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Upload Certification' })).toBeVisible({ timeout: 10000 })

  // Empty state before the first upload.
  await expect(page.getByText('No certifications uploaded yet.')).toBeVisible({ timeout: 10000 })

  uploadedCertName = `QA Phase CD Cert ${Date.now()}`

  await page.getByRole('button', { name: 'Upload Certification' }).click()
  await expect(page.getByRole('heading', { name: 'Upload Certification' })).toBeVisible({ timeout: 5000 })

  await page.getByLabel('Certification name').fill(uploadedCertName)
  await page.getByLabel('Certification type').selectOption('TEACHING')
  await page.getByLabel('Certification issuer').fill('QA Testing Board')
  await page.getByLabel('Certification file').setInputFiles({
    name: `${uploadedCertName}.pdf`,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 fake pdf content for Phase CD QA'),
  })

  const [signResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructors/${instructorId}/certifications/sign`), { timeout: 15000 }),
    page.getByRole('button', { name: 'Upload', exact: true }).click(),
  ])

  // 503 = storage bucket not provisioned in this environment — not a frontend
  // bug (same contract as instructor documents storage).
  test.skip(signResp.status() === 503, 'Certification storage bucket not configured in this environment')
  expect(signResp.ok()).toBeTruthy()

  await expect(page.getByText(uploadedCertName)).toBeVisible({ timeout: 20000 })

  const listResp = await page.request.get(`${API}/instructors/${instructorId}/certifications`, {
    headers: { Authorization: `Bearer ${savedToken}` },
  })
  const listBody = await listResp.json().catch(() => null)
  const match = (listBody?.data?.certifications ?? []).find((c: { name: string; id: string }) => c.name === uploadedCertName)
  certificationId = match?.id ?? null
  expect(certificationId, 'Uploaded certification must be findable via GET /certifications').toBeTruthy()

  const row = page.locator('tr', { has: page.getByText(uploadedCertName) })
  await expect(row.getByText('PENDING', { exact: true })).toBeVisible({ timeout: 10000 })

  const [verifyResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/certifications/${certificationId}/verify`) && r.ok(), { timeout: 15000 }),
    row.getByTitle('Verify').click(),
  ])
  expect(verifyResp.ok()).toBeTruthy()

  await expect(row.getByText('VERIFIED', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('Suspension history shows an entry after a suspend action', async ({ page }) => {
  test.skip(!instructorId, 'Setup instructor was not created — backend may be unavailable')

  await openPanel(page)
  await page.getByRole('button', { name: 'Suspend', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Suspend Instructor' })).toBeVisible({ timeout: 5000 })

  await page.getByLabel('Violation type').selectOption('POLICY')
  await page.getByLabel('Suspension reason').fill('Automated Phase CD QA suspension test — suspension history check')

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructors/${instructorId}/suspend`) && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Confirm Suspend' }).click(),
  ])
  expect(resp.ok()).toBeTruthy()

  // Reads GET /instructors/:id/suspension-history (real endpoint, already
  // shipped — see INSTRUCTORS_CONTRACT.md "Extended 2026-08-06").
  await expect(page.getByText('SUSPENDED', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Policy Violation')).toBeVisible({ timeout: 10000 })
})
