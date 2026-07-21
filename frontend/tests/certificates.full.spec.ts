// Certificates tab (templates + issued certificates) + public verify page —
// end-to-end tests.
//
// No CERTIFICATES_CONTRACT.md exists in the repo (checked root/docs/git
// history) — endpoints/shapes were reverse-engineered from
// backend/src/{routes,controllers,services,validators}/certificates.*.js and
// verified live against a running server before this suite was written.
//
// §4.1 sequencing: templates/courses/certificates are created via REAL API
// calls before any dependent action (revoke/reissue/pdf) runs against them —
// never a fabricated id.
//
// Zero data-leak rule: every template/certificate/course created here is
// captured by its real returned id and cleaned up in afterAll. Certificates
// have no hard-delete endpoint (only revoke) — cleanup revokes them, mirrors
// the backend's own certificatesSmokeTest.js cleanup step.

import { readFileSync } from 'fs'
import { type Page, test, expect } from '@playwright/test'

const API = 'http://localhost:5001/api/admin'
const PUB = 'http://localhost:5001/api/public'

// ── Cleanup state ─────────────────────────────────────────────────────────────

let savedToken = ''
const createdTemplateIds:   string[] = []
const createdCertificateIds: string[] = []
const createdCourseIds:     string[] = []

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }

  for (const id of createdCertificateIds) {
    await request.post(`${API}/certificates/${id}/revoke`, { headers: H }).catch(() => null)
  }
  for (const id of createdTemplateIds) {
    await request.delete(`${API}/certificate-templates/${id}`, { headers: H }).catch(() => null)
  }
  for (const id of createdCourseIds) {
    await request.delete(`${API}/courses/${id}`, { headers: H }).catch(() => null)
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
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function getInstructorId(page: Page, H: Record<string, string>): Promise<string> {
  const res = await page.request.get(`${API}/lm/filter-options`, { headers: H })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.instructors?.[0]?.id
  expect(id, 'At least one INSTRUCTOR user must exist in the DB').toBeTruthy()
  return id
}

async function createFixtureCourse(
  page: Page, H: Record<string, string>, title: string, certificateEnabled = false,
): Promise<string> {
  const instructorId = await getInstructorId(page, H)
  const res = await page.request.post(`${API}/courses`, {
    data: { title, instructorId, category: 'Smoke', level: 'Beginner' },
    headers: H,
  })
  expect(res.ok(), `POST /courses must succeed for "${title}"`).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id, 'Course id must be returned').toBeTruthy()
  createdCourseIds.push(id)

  if (certificateEnabled) {
    const enable = await page.request.patch(`${API}/courses/${id}/settings`, {
      data: { certificateEnabled: true }, headers: H,
    })
    expect(enable.ok(), 'enabling certificates on the fixture course must succeed').toBeTruthy()
  }
  return id
}

async function createFixtureTemplate(
  page: Page, H: Record<string, string>, name: string, layout: Record<string, unknown> = {},
): Promise<string> {
  const res = await page.request.post(`${API}/certificate-templates`, { data: { name, layout }, headers: H })
  expect(res.ok(), `POST /certificate-templates must succeed for "${name}"`).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id, 'Template id must be returned').toBeTruthy()
  createdTemplateIds.push(id)
  return id
}

// Reads the admin token straight out of the prepared storageState file
// (tests/setup/.auth.json, written by auth.setup.ts) rather than depending
// on a previous test in this file having run first — the "no auth" describe
// block below needs a token for its own fixture setup via request-context
// calls, while the actual `page` it drives stays genuinely logged out.
function getTokenFromAuthFile(): string {
  const raw = JSON.parse(readFileSync('tests/setup/.auth.json', 'utf-8')) as {
    origins?: { localStorage?: { name: string; value: string }[] }[]
  }
  for (const origin of raw.origins ?? []) {
    const entry = origin.localStorage?.find((e) => e.name === 'mn_admin_token')
    if (entry) return entry.value
  }
  throw new Error('mn_admin_token not found in tests/setup/.auth.json — run the auth setup project first.')
}

async function issueCertificateViaApi(
  page: Page, H: Record<string, string>, userId: string, courseId: string, templateId?: string,
): Promise<{ id: string; verificationCode: string }> {
  const res = await page.request.post(`${API}/certificates`, {
    data: { userId, courseId, ...(templateId ? { templateId } : {}) }, headers: H,
  })
  expect(res.ok(), 'POST /certificates (issue) must succeed').toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id, 'Certificate id must be returned').toBeTruthy()
  createdCertificateIds.push(id)
  return { id, verificationCode: body.data.verificationCode }
}

// ── Navigation helpers ─────────────────────────────────────────────────────────

async function gotoCertificatesTab(page: Page) {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Certificates', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=certificates/)
  await expect(page.getByRole('heading', { name: 'Certificates', exact: true })).toBeVisible({ timeout: 10000 })
}

async function gotoTemplatesSubTab(page: Page) {
  await gotoCertificatesTab(page)
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Certificate Templates' })).toBeVisible({ timeout: 5000 })
}

// ── Tests: templates ──────────────────────────────────────────────────────────

test('Create template — layout saved, bad hex color rejected client-side', async ({ page }) => {
  await gotoTemplatesSubTab(page)
  await ensureToken(page)

  const name = `Cert Template ${Date.now()}`

  await page.getByRole('button', { name: 'Create Template', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create Certificate Template' })).toBeVisible({ timeout: 5000 })

  await page.getByPlaceholder(/Standard Completion Certificate/i).fill(name)

  // Insert a placeholder chip into the body — verify it lands in the textarea.
  const body = page.getByLabel('Certificate body')
  await body.fill('Awarded to ')
  await page.getByRole('button', { name: 'Insert Student Name placeholder' }).click()
  await expect(body).toHaveValue('Awarded to {{studentName}}')

  // Bad hex color — client-side validation blocks submit before any request.
  await page.getByLabel('Primary color', { exact: true }).fill('blue')
  let postFired = false
  page.on('request', req => { if (req.method() === 'POST' && req.url().includes('/certificate-templates')) postFired = true })
  await page.getByRole('button', { name: 'Create Template' }).click()
  await expect(page.getByRole('alert')).toContainText('Primary color must be a hex value', { timeout: 5000 })
  expect(postFired, 'Bad hex color must not reach the API').toBe(false)

  // Fix the color, submit for real.
  await page.getByLabel('Primary color', { exact: true }).fill('#123ABC')
  const postResp = page.waitForResponse(r => r.url().includes('/certificate-templates') && r.request().method() === 'POST' && r.ok(), { timeout: 10000 })
  await page.getByRole('button', { name: 'Create Template' }).click()
  const resp = await postResp
  const created = (await resp.json()).data
  createdTemplateIds.push(created.id)
  expect(created.layout.primaryColor).toBe('#123ABC')
  expect(created.layout.body).toBe('Awarded to {{studentName}}')

  await expect(page.getByRole('heading', { name: 'Certificate Templates' })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(name)).toBeVisible()
})

test('Edit template — PATCH body always carries the FULL layout, never a diff', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const name = `Cert Edit Test ${Date.now()}`
  const templateId = await createFixtureTemplate(page, H, name, {
    primaryColor: '#111111', accentColor: '#222222', signatureName: 'Dr. Original',
  })

  await gotoTemplatesSubTab(page)
  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: `Edit ${name}` }).click()
  await expect(page.getByRole('heading', { name: 'Edit Certificate Template' })).toBeVisible({ timeout: 5000 })

  // Change ONLY the certificate title — every other layout field stays as loaded.
  await page.getByLabel('Certificate title').fill('Retitled Certificate');

  let patchBody: Record<string, unknown> | undefined
  const patchResp = page.waitForResponse(async r => {
    if (r.url().includes(`/certificate-templates/${templateId}`) && r.request().method() === 'PATCH') {
      patchBody = r.request().postDataJSON()
      return true
    }
    return false
  }, { timeout: 10000 })
  await page.getByRole('button', { name: 'Save Changes' }).click()
  const resp = await patchResp
  expect(resp.ok(), 'PATCH must succeed').toBeTruthy()

  const layout = patchBody?.layout as Record<string, unknown> | undefined
  expect(layout, 'PATCH body must include layout at all').toBeTruthy()
  // Every layout key present, even ones the user never touched this save.
  for (const key of ['title', 'body', 'primaryColor', 'accentColor', 'signatureName', 'signatureTitle']) {
    expect(layout, `layout.${key} must be present in the PATCH body`).toHaveProperty(key)
  }
  expect(layout?.title).toBe('Retitled Certificate')
  expect(layout?.primaryColor).toBe('#111111') // unchanged field still sent
  expect(layout?.signatureName).toBe('Dr. Original') // unchanged field still sent
})

test('Delete template — confirm mentions surviving certificates, issued cert keeps working', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const userId = await getInstructorId(page, H)
  const courseTitle = `Cert TplDelete Course ${Date.now()}`
  const courseId = await createFixtureCourse(page, H, courseTitle, true)
  const tplName = `Cert TplDelete Template ${Date.now()}`
  const templateId = await createFixtureTemplate(page, H, tplName)
  const { id: certId } = await issueCertificateViaApi(page, H, userId, courseId, templateId)

  await gotoTemplatesSubTab(page)
  await expect(page.getByText(tplName)).toBeVisible({ timeout: 10000 })

  page.once('dialog', (d) => {
    expect(d.message()).toContain('Certificates already issued with this template will keep working with a default layout')
    d.accept()
  })
  const deleteResp = page.waitForResponse(
    r => r.url().includes(`/certificate-templates/${templateId}`) && r.request().method() === 'DELETE' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: `Delete ${tplName}` }).click()
  await deleteResp
  const idx = createdTemplateIds.indexOf(templateId)
  if (idx !== -1) createdTemplateIds.splice(idx, 1) // already deleted

  // Certificate survives with templateId nulled — PDF still renders (default layout).
  const certAfter = await page.request.get(`${API}/certificates?courseId=${courseId}`, { headers: H })
  const survivor = ((await certAfter.json()).data?.items ?? []).find((c: { id: string }) => c.id === certId)
  expect(survivor, 'certificate must survive template deletion').toBeTruthy()
  expect(survivor.templateId, 'templateId must be nulled').toBeNull()

  const pdfRes = await page.request.get(`${API}/certificates/${certId}/pdf`, { headers: H })
  expect(pdfRes.ok(), 'PDF must still render with the default layout').toBeTruthy()
})

// ── Tests: issue ──────────────────────────────────────────────────────────────

test('Issue certificate — success case, appears in the list', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const userId = await getInstructorId(page, H)
  const courseTitle = `Cert Issue Course ${Date.now()}`
  const courseId = await createFixtureCourse(page, H, courseTitle, true)

  await gotoCertificatesTab(page)
  await page.getByRole('button', { name: 'Issue Certificate', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Issue certificate' })
  await expect(dialog).toBeVisible({ timeout: 5000 })

  await dialog.getByLabel('Select user').selectOption(userId)
  await dialog.getByLabel('Select course').selectOption(courseId)

  const postResp = page.waitForResponse(r => r.url().includes('/certificates') && r.request().method() === 'POST' && r.ok(), { timeout: 10000 })
  await dialog.getByRole('button', { name: 'Issue Certificate' }).click()
  const resp = await postResp
  const cert = (await resp.json()).data
  createdCertificateIds.push(cert.id)
  expect(cert.status).toBe('active')

  await expect(dialog).not.toBeVisible({ timeout: 5000 })
  await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 5000 })
})

test('Issue with certificateEnabled=false — exact backend message + link to course settings', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const userId = await getInstructorId(page, H)
  const courseTitle = `Cert Disabled Course ${Date.now()}`
  const courseId = await createFixtureCourse(page, H, courseTitle, false) // certificates NOT enabled

  await gotoCertificatesTab(page)
  await page.getByRole('button', { name: 'Issue Certificate', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Issue certificate' })
  await expect(dialog).toBeVisible({ timeout: 5000 })

  await dialog.getByLabel('Select user').selectOption(userId)
  await dialog.getByLabel('Select course').selectOption(courseId)
  await dialog.getByRole('button', { name: 'Issue Certificate' }).click()

  await expect(dialog.getByRole('alert')).toContainText(
    'Certificates are not enabled for this course (enable them in course settings).', { timeout: 5000 },
  )
  const settingsLink = dialog.getByRole('button', { name: 'Go to course settings' })
  await expect(settingsLink).toBeVisible()
  await settingsLink.click()

  // One click lands directly on that course's Settings step.
  await expect(page).toHaveURL(/[?&]tab=courses/)
  await expect(page.getByRole('heading', { name: 'Course Settings' })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Issue completion certificates')).toBeVisible()
})

test('Issue duplicate (course,user) pair — exact message + Reissue shortcut', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const userId = await getInstructorId(page, H)
  const courseTitle = `Cert Dup Course ${Date.now()}`
  const courseId = await createFixtureCourse(page, H, courseTitle, true)
  const { id: existingCertId, verificationCode: oldCode } = await issueCertificateViaApi(page, H, userId, courseId)

  await gotoCertificatesTab(page)
  await page.getByRole('button', { name: 'Issue Certificate', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Issue certificate' })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await dialog.getByLabel('Select user').selectOption(userId)
  await dialog.getByLabel('Select course').selectOption(courseId)
  await dialog.getByRole('button', { name: 'Issue Certificate' }).click()

  await expect(dialog.getByRole('alert')).toContainText(
    'A certificate for this user and course already exists — reissue it instead.', { timeout: 5000 },
  )
  const reissueShortcut = dialog.getByRole('button', { name: 'Reissue', exact: true })
  await expect(reissueShortcut).toBeVisible({ timeout: 5000 })

  page.once('dialog', (d) => {
    expect(d.message()).toContain('This will generate a new certificate. The old QR code and any previously downloaded PDFs will no longer verify.')
    d.accept()
  })
  const reissueResp = page.waitForResponse(
    r => r.url().includes(`/certificates/${existingCertId}/reissue`) && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await reissueShortcut.click()
  const resp = await reissueResp
  const reissued = (await resp.json()).data
  expect(reissued.verificationCode).not.toBe(oldCode)
  await expect(dialog).not.toBeVisible({ timeout: 5000 })
})

// ── Tests: revoke ─────────────────────────────────────────────────────────────

test('Revoke certificate — succeeds, Revoke action disabled once already revoked', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const userId = await getInstructorId(page, H)
  const courseTitle = `Cert Revoke Course ${Date.now()}`
  const courseId = await createFixtureCourse(page, H, courseTitle, true)
  const { id: certId } = await issueCertificateViaApi(page, H, userId, courseId)

  await gotoCertificatesTab(page)
  await page.getByLabel('Filter by course').selectOption(courseId)
  await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 10000 })

  const revokeBtn = page.getByRole('button', { name: /Revoke certificate for/i })
  await expect(revokeBtn).toBeEnabled()

  page.once('dialog', (d) => d.accept())
  const revokeResp = page.waitForResponse(
    r => r.url().includes(`/certificates/${certId}/revoke`) && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await revokeBtn.click()
  await revokeResp

  // Status badge flips, and the SAME button is now disabled — UI never lets
  // a second click hit the backend's "already revoked" 400.
  await expect(page.getByText('revoked', { exact: true })).toBeVisible({ timeout: 5000 })
  await expect(revokeBtn).toBeDisabled()
})

// ── Tests: reissue ────────────────────────────────────────────────────────────

test('Reissue — confirm dialog states old QR/PDF stop working, new code differs from old', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const userId = await getInstructorId(page, H)
  const courseTitle = `Cert Reissue Course ${Date.now()}`
  const courseId = await createFixtureCourse(page, H, courseTitle, true)
  const { id: certId, verificationCode: oldCode } = await issueCertificateViaApi(page, H, userId, courseId)

  await gotoCertificatesTab(page)
  await page.getByLabel('Filter by course').selectOption(courseId)
  await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 10000 })

  let dialogMessage = ''
  page.once('dialog', (d) => { dialogMessage = d.message(); d.accept() })

  const reissueResp = page.waitForResponse(
    r => r.url().includes(`/certificates/${certId}/reissue`) && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: /Reissue certificate for/i }).click()
  const resp = await reissueResp

  expect(dialogMessage).toContain('This will generate a new certificate.')
  expect(dialogMessage).toContain('The old QR code and any previously downloaded PDFs will no longer verify.')

  const reissued = (await resp.json()).data
  expect(reissued.verificationCode, 'new code must differ from the old one').not.toBe(oldCode)
})

// ── Tests: PDF download ───────────────────────────────────────────────────────

test('PDF download — fetched with Bearer header (not a bare anchor), not a document navigation', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const userId = await getInstructorId(page, H)
  const courseTitle = `Cert PdfDownload Course ${Date.now()}`
  const courseId = await createFixtureCourse(page, H, courseTitle, true)
  const { id: certId } = await issueCertificateViaApi(page, H, userId, courseId)

  await gotoCertificatesTab(page)
  await page.getByLabel('Filter by course').selectOption(courseId)
  await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 10000 })

  const pdfRequest = page.waitForRequest(r => r.url().includes(`/certificates/${certId}/pdf`), { timeout: 10000 })
  await page.getByRole('button', { name: /Download PDF for/i }).click()
  const req = await pdfRequest

  expect(req.headers()['authorization'], 'PDF fetch must carry the Bearer token').toMatch(/^Bearer /)
  expect(req.resourceType(), 'must be a JS fetch, not a plain <a> document navigation').not.toBe('document')
})

test('PDF download on a revoked certificate — handled as an error state, no broken download', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const userId = await getInstructorId(page, H)
  const courseTitle = `Cert PdfRevoked Course ${Date.now()}`
  const courseId = await createFixtureCourse(page, H, courseTitle, true)
  const { id: certId } = await issueCertificateViaApi(page, H, userId, courseId)
  const revoke = await page.request.post(`${API}/certificates/${certId}/revoke`, { headers: H })
  expect(revoke.ok()).toBeTruthy()

  await gotoCertificatesTab(page)
  await page.getByLabel('Filter by course').selectOption(courseId)
  await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 10000 })

  let downloadFired = false
  page.on('download', () => { downloadFired = true })

  const pdfResp = page.waitForResponse(r => r.url().includes(`/certificates/${certId}/pdf`), { timeout: 10000 })
  await page.getByRole('button', { name: /Download PDF for/i }).click()
  const resp = await pdfResp
  expect(resp.status()).toBe(400)
  expect((resp.headers()['content-type'] ?? '')).toContain('application/json')

  // Error surfaced as a toast, never a browser download.
  await expect(page.getByText(/revoked/i)).toBeVisible({ timeout: 5000 })
  expect(downloadFired, 'a revoked cert must never trigger a real file download').toBe(false)
})

// ── Tests: public verify page (genuinely logged out) ────────────────────────────

test.describe('Public verify page (no auth)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  // Fixture setup for these two tests goes through request-context calls
  // authenticated with a token read straight from tests/setup/.auth.json —
  // never through `page`, which stays genuinely logged out throughout.
  async function issueFixtureCertificate(request: import('@playwright/test').APIRequestContext, title: string) {
    const H = { Authorization: `Bearer ${getTokenFromAuthFile()}` }
    const foRes = await request.get(`${API}/lm/filter-options`, { headers: H })
    const userId: string = (await foRes.json()).data?.instructors?.[0]?.id
    expect(userId, 'at least one INSTRUCTOR user must exist').toBeTruthy()

    const courseRes = await request.post(`${API}/courses`, {
      data: { title, instructorId: userId, category: 'Smoke', level: 'Beginner' }, headers: H,
    })
    const courseId: string = (await courseRes.json()).data.id
    createdCourseIds.push(courseId)
    await request.patch(`${API}/courses/${courseId}/settings`, { data: { certificateEnabled: true }, headers: H })

    const issueRes = await request.post(`${API}/certificates`, { data: { userId, courseId }, headers: H })
    const cert = (await issueRes.json()).data as { id: string; verificationCode: string; studentName: string; courseTitle: string }
    createdCertificateIds.push(cert.id)
    return { cert, H }
  }

  test('valid code — success state with student/course/date', async ({ page, request }) => {
    const { cert } = await issueFixtureCertificate(request, `Cert PublicVerify Course ${Date.now()}`)

    // No token in localStorage in this context — genuinely logged out.
    const token = await page.evaluate(() => localStorage.getItem('mn_admin_token'))
    expect(token, 'this context must have no admin token').toBeFalsy()

    await page.goto(`/verify/${cert.verificationCode}`)
    await expect(page.getByRole('heading', { name: 'Certificate Verified' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(cert.studentName)).toBeVisible()
    await expect(page.getByText(cert.courseTitle)).toBeVisible()

    // No login prompt, no admin chrome, anywhere on this page.
    await expect(page.getByRole('link', { name: /log ?in/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /log ?in/i })).toHaveCount(0)
  })

  test('revoked code — warning state, no certificate details', async ({ page, request }) => {
    const { cert, H } = await issueFixtureCertificate(request, `Cert PublicVerifyRevoked Course ${Date.now()}`)
    await request.post(`${API}/certificates/${cert.id}/revoke`, { headers: H })

    await page.goto(`/verify/${cert.verificationCode}`)
    await expect(page.getByRole('heading', { name: 'Certificate Revoked' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(cert.studentName)).not.toBeVisible()
  })

  test('unknown code — not-found state', async ({ page }) => {
    await page.goto(`/verify/${'0'.repeat(32)}`)
    await expect(page.getByRole('heading', { name: 'Certificate Not Found' })).toBeVisible({ timeout: 10000 })
  })

  test('malformed code — not-found state, no DB hit needed', async ({ page }) => {
    await page.goto('/verify/not-a-real-code')
    await expect(page.getByRole('heading', { name: 'Certificate Not Found' })).toBeVisible({ timeout: 10000 })
  })
})

// Sanity check that the public verify endpoint truly requires no auth at the
// API level too (belt-and-suspenders alongside the UI-level test above).
test('Public verify API — no Authorization header, always 200', async ({ request }) => {
  const res = await request.get(`${PUB}/certificates/verify/${'a'.repeat(32)}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(['valid', 'revoked', 'not_found']).toContain(body.data.status)
})
