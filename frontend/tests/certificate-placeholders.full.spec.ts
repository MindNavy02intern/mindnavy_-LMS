// Certificate placeholder safety net — covers the {{bilal}}/{{frontend}}
// literal-text bug (mistyped free text instead of clicking a chip) and the
// two-layer fix for it:
//   1. Editor warning: LayoutEditor (CertificatesTab.tsx) flags any
//      {{token}}-shaped text in the body that isn't one of the 3 recognized
//      placeholders, as soon as it's typed.
//   2. Backend strip: certificatePdf.service.js's fillPlaceholders() removes
//      any leftover {{...}} pattern after substituting the known keys, so an
//      unrecognized placeholder that reaches a saved template (editor
//      bypassed, e.g. via direct API call) still never prints literally on
//      an issued PDF. This file's second test proves that end-to-end against
//      the real /pdf endpoint, not by re-reading the source.
//
// §4.1 sequencing: template → course → issue, each a real API call, id
// captured from the real response before the next step.
//
// Zero data-leak rule: every template/certificate/course created here is
// captured by its real returned id and cleaned up in afterAll (mirrors
// certificates.full.spec.ts).

import { inflateSync } from 'zlib'
import { type Page, test, expect } from '@playwright/test'

const API = 'http://localhost:5001/api/admin'

// ── Cleanup state ─────────────────────────────────────────────────────────────

let savedToken = ''
const createdTemplateIds:    string[] = []
const createdCertificateIds: string[] = []
const createdCourseIds:      string[] = []

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

// ── Auth + fixture helpers (duplicated from certificates.full.spec.ts —
// each spec file here is self-contained, no shared test-utils module) ──────────

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

async function createFixtureCourse(page: Page, H: Record<string, string>, title: string): Promise<string> {
  const instructorId = await getInstructorId(page, H)
  const res = await page.request.post(`${API}/courses`, {
    data: { title, instructorId, category: 'Smoke', level: 'Beginner' },
    headers: H,
  })
  expect(res.ok(), `POST /courses must succeed for "${title}"`).toBeTruthy()
  const id: string = (await res.json()).data?.id
  expect(id, 'Course id must be returned').toBeTruthy()
  createdCourseIds.push(id)

  const enable = await page.request.patch(`${API}/courses/${id}/settings`, {
    data: { certificateEnabled: true }, headers: H,
  })
  expect(enable.ok(), 'enabling certificates on the fixture course must succeed').toBeTruthy()
  return id
}

// Goes straight through the API — the point of this fixture is to prove the
// backend strips a bad placeholder even when the editor's warning never ran.
async function createFixtureTemplateWithBadPlaceholder(
  page: Page, H: Record<string, string>, name: string,
): Promise<string> {
  const res = await page.request.post(`${API}/certificate-templates`, {
    data: {
      name,
      layout: {
        body: 'Awarded to {{studentName}} for {{courseTitle}} — ref {{unknownTokenXYZ}} — issued {{date}}.',
      },
    },
    headers: H,
  })
  expect(res.ok(), `POST /certificate-templates must succeed for "${name}" (validator allows unknown {{}} syntax — that's exactly why the backend strip exists)`).toBeTruthy()
  const id: string = (await res.json()).data?.id
  expect(id, 'Template id must be returned').toBeTruthy()
  createdTemplateIds.push(id)
  return id
}

async function issueCertificateViaApi(
  page: Page, H: Record<string, string>, userId: string, courseId: string, templateId: string,
): Promise<{ id: string; studentName: string; courseTitle: string }> {
  const res = await page.request.post(`${API}/certificates`, {
    data: { userId, courseId, templateId }, headers: H,
  })
  expect(res.ok(), 'POST /certificates (issue) must succeed').toBeTruthy()
  const body = (await res.json()).data
  expect(body.id, 'Certificate id must be returned').toBeTruthy()
  createdCertificateIds.push(body.id)
  return { id: body.id, studentName: body.studentName, courseTitle: body.courseTitle }
}

async function gotoTemplatesSubTab(page: Page) {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Certificates', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=certificates/)
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Certificate Templates' })).toBeVisible({ timeout: 10000 })
}

// pdfkit Flate-compresses each content stream, and draws text as hex-encoded
// glyph runs split by kerning adjustments (e.g. `[<48454c4c4f> -20 <57>] TJ`)
// rather than literal parenthesized strings. This reconstructs the actual
// drawn text from a raw PDF buffer so the test can assert on it directly —
// no reliance on reading the source, no new PDF-parsing dependency.
function extractPdfText(buf: Buffer): string {
  const raw = buf.toString('latin1')
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let out = ''
  let m: RegExpExecArray | null
  while ((m = streamRe.exec(raw))) {
    let inflated: Buffer
    try { inflated = inflateSync(Buffer.from(m[1], 'latin1')) } catch { continue } // non-Flate stream (e.g. the QR PNG) — skip
    const decoded = inflated.toString('latin1')
    const hexRe = /<([0-9a-fA-F]+)>/g
    let hm: RegExpExecArray | null
    while ((hm = hexRe.exec(decoded))) out += Buffer.from(hm[1], 'hex').toString('latin1')
  }
  return out
}

// ── Tests ────────────────────────────────────────────────────────────────────

test('Template editor — unrecognized {{token}} warns immediately, valid chips never do', async ({ page }) => {
  await gotoTemplatesSubTab(page)
  await page.getByRole('button', { name: 'Create Template', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create Certificate Template' })).toBeVisible({ timeout: 5000 })

  const body = page.getByLabel('Certificate body')
  const unrecognizedWarnings = page.getByRole('alert').filter({ hasText: 'Unrecognized placeholder' })

  // Default body ships with only the 3 recognized placeholders — no warning.
  await expect(unrecognizedWarnings).toHaveCount(0)

  // Reproduce the actual bug: type free text instead of clicking a chip.
  await body.fill('Congrats {{bilal}} on finishing {{frontend}}.')

  await expect(unrecognizedWarnings).toHaveCount(2)
  await expect(unrecognizedWarnings.filter({ hasText: '{{bilal}}' }))
    .toContainText('{{studentName}}, {{courseTitle}}, {{date}}')
  await expect(unrecognizedWarnings.filter({ hasText: '{{frontend}}' })).toBeVisible()

  // Clicking the real chip instead removes that half of the warning.
  await body.fill('Congrats {{studentName}} on finishing {{frontend}}.')
  await expect(unrecognizedWarnings).toHaveCount(1)
  await expect(unrecognizedWarnings).toContainText('{{frontend}}')
})

test('PDF generation strips an unrecognized {{...}} placeholder even when it reaches the saved template directly via the API', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const userId = await getInstructorId(page, H)
  const courseTitle = `Cert Placeholder Course ${Date.now()}`
  const courseId = await createFixtureCourse(page, H, courseTitle)
  const templateId = await createFixtureTemplateWithBadPlaceholder(page, H, `Cert Placeholder Template ${Date.now()}`)
  const cert = await issueCertificateViaApi(page, H, userId, courseId, templateId)

  const pdfRes = await page.request.get(`${API}/certificates/${cert.id}/pdf`, { headers: H })
  expect(pdfRes.ok(), 'PDF must still render despite the bad placeholder in the template').toBeTruthy()

  const text = extractPdfText(await pdfRes.body())

  // Known placeholders substituted for real.
  expect(text, 'studentName must be substituted').toContain(cert.studentName)
  expect(text, 'courseTitle must be substituted').toContain(cert.courseTitle)
  // Literal text around the bad placeholder survives — only the token itself is gone.
  expect(text, 'text surrounding the bad placeholder must survive').toContain('ref')
  expect(text, 'text surrounding the bad placeholder must survive').toContain('issued')
  // The unrecognized placeholder never prints — neither its name nor raw {{ }} syntax.
  expect(text, 'unrecognized placeholder name must not print literally').not.toContain('unknownTokenXYZ')
  expect(text, 'no unresolved {{ }} syntax must ever reach a printed certificate').not.toContain('{{')
})
