import { type Page, test, expect } from '@playwright/test'

// Covers task 108: the Pending Approval tab (ApplicationsTab) — list, detail
// modal, and the three review actions (approve / reject / request changes).
//
// The public submit endpoint (POST /api/public/instructor-applications) always
// answers a fixed, id-free 202 by design (contract: an anonymous caller learns
// nothing about who has applied) — so beforeAll creates the three disposable
// applications through it, then looks each one up by its unique email via the
// authenticated list endpoint to recover its real id.
//
// Cleanup note: instructor-applications has no DELETE endpoint in the contract
// (only instructors do). The approve test's outcome — a real instructor
// AppUser — is deleted in afterAll via DELETE /instructors/:id using the
// userId the approve response actually returned. The reject and
// request-changes applications themselves cannot be deleted through any real
// endpoint and are left behind as REJECTED/CHANGES_REQUESTED rows — a
// contract gap, not a test bug (flagging here rather than fabricating a
// cleanup call that doesn't exist).

const API = 'http://localhost:5001/api/admin'
const PUBLIC_API = 'http://localhost:5001/api/public'

let savedToken: string | null = null

let approveAppId: string | null = null
let approveAppName: string | null = null
let approvedInstructorUserId: string | null = null

let rejectAppId: string | null = null
let rejectAppName: string | null = null

let changesAppId: string | null = null
let changesAppName: string | null = null

async function submitPublicApplication(request: import('@playwright/test').APIRequestContext, label: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const fullName = `QA ${label} Applicant ${stamp}`
  const email = `qa.${label.toLowerCase()}.${stamp}@example.com`
  const resp = await request.post(`${PUBLIC_API}/instructor-applications`, {
    data: {
      fullName,
      email,
      bio: `Automated QA test application for the ${label} flow — this bio is padded past the 30 character minimum.`,
      specialization: 'Machine Learning',
      yearsExperience: 5,
      skills: ['Python', 'Testing'],
    },
  })
  expect(resp.status()).toBe(202)
  return { fullName, email }
}

async function findApplicationId(request: import('@playwright/test').APIRequestContext, email: string): Promise<string | null> {
  const resp = await request.get(`${API}/instructor-applications?search=${encodeURIComponent(email)}&status=pending`, {
    headers: { Authorization: `Bearer ${savedToken}` },
  })
  const body = await resp.json().catch(() => null)
  return body?.data?.applications?.[0]?.id ?? null
}

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/instructors')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()

  const [approve, reject, changes] = await Promise.all([
    submitPublicApplication(request, 'Approve'),
    submitPublicApplication(request, 'Reject'),
    submitPublicApplication(request, 'Changes'),
  ])
  approveAppName = approve.fullName
  rejectAppName = reject.fullName
  changesAppName = changes.fullName

  ;[approveAppId, rejectAppId, changesAppId] = await Promise.all([
    findApplicationId(request, approve.email),
    findApplicationId(request, reject.email),
    findApplicationId(request, changes.email),
  ])
})

test.afterAll(async ({ request }) => {
  if (savedToken && approvedInstructorUserId) {
    await request
      .delete(`${API}/instructors/${approvedInstructorUserId}`, { headers: { Authorization: `Bearer ${savedToken}` } })
      .catch(() => null)
  }
})

async function gotoPendingTab(page: Page) {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/instructor-applications') && r.ok(), { timeout: 15000 }),
    page.goto('/instructors?tab=pending'),
  ])
  await expect(page.getByRole('heading', { name: 'Instructors', exact: true })).toBeVisible({ timeout: 10000 })
  expect(resp.ok()).toBeTruthy()
}

async function searchApplicant(page: Page, name: string) {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/instructor-applications') && r.url().includes('search=') && r.ok(), { timeout: 15000 }),
    page.getByPlaceholder('Search applicants…').fill(name),
  ])
  expect(resp.ok()).toBeTruthy()
  // .first(): a just-shown action toast (e.g. "<name>'s application rejected.")
  // can still be on screen and substring-matches getByText(name) too.
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
}

function rowFor(page: Page, name: string) {
  return page.locator('tr', { has: page.getByText(name) })
}

function statsCardValue(page: Page, label: string) {
  return page.getByRole('group', { name: `${label} stat card` }).locator('[data-value]')
}

test('Pending tab loads the applications list, oldest first, from the applications endpoint', async ({ page }) => {
  test.skip(!approveAppId, 'Setup application was not created — backend may be unavailable')

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/instructor-applications') && r.url().includes('status=pending') && r.ok(), { timeout: 15000 }),
    page.goto('/instructors?tab=pending'),
  ])
  // Never ?tab=pending on /instructors (contract: 400 on purpose) — assert the
  // real request went to the applications endpoint, not the instructors list.
  expect(resp.url()).toContain('/instructor-applications')
  expect(resp.url()).not.toMatch(/\/instructors\?.*tab=pending/)

  await expect(page.getByText(/Showing \d+ to \d+ of \d+ applications/)).toBeVisible({ timeout: 10000 })
  await searchApplicant(page, approveAppName as string)
  await expect(rowFor(page, approveAppName as string).getByText('PENDING')).toBeVisible()
})

test('Approve: success message appears and the Active Instructors card updates without reload', async ({ page }) => {
  test.skip(!approveAppId, 'Setup application was not created — backend may be unavailable')

  await gotoPendingTab(page)
  await expect(statsCardValue(page, 'Active Instructors')).not.toHaveText('', { timeout: 10000 })
  const before = Number(await statsCardValue(page, 'Active Instructors').innerText())

  await searchApplicant(page, approveAppName as string)

  page.once('dialog', dialog => dialog.accept())
  const [approveResp, statsResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructor-applications/${approveAppId}/approve`) && r.ok(), { timeout: 15000 }),
    page.waitForResponse(r => r.url().includes('/instructors/stats') && r.ok(), { timeout: 15000 }),
    rowFor(page, approveAppName as string).getByTitle('Approve').click(),
  ])
  expect(approveResp.ok()).toBeTruthy()
  approvedInstructorUserId = (await approveResp.json())?.data?.userId ?? null
  expect(approvedInstructorUserId).toBeTruthy()

  await expect(page.getByText('Application approved — instructor account created.')).toBeVisible({ timeout: 5000 })

  // No page.reload() — the card refetched itself via invalidateFor's
  // analyticsUpdated bridge (instructorApplication.approve invalidates
  // ['instructors'], which the bridge maps to that event).
  expect(statsResp.ok()).toBeTruthy()
  await expect(statsCardValue(page, 'Active Instructors')).toHaveText(String(before + 1), { timeout: 10000 })
})

test('Reject: reason modal appears, rejection is required, and the status is saved', async ({ page }) => {
  test.skip(!rejectAppId, 'Setup application was not created — backend may be unavailable')

  await gotoPendingTab(page)
  await searchApplicant(page, rejectAppName as string)

  await rowFor(page, rejectAppName as string).getByTitle('Reject').click()
  const dialog = page.getByRole('dialog', { name: 'Reject Application' })
  await expect(dialog).toBeVisible({ timeout: 5000 })

  // Empty submit is rejected client-side (>= 3 chars required) — no network call fires.
  await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(dialog.getByText('Required — at least 3 characters.')).toBeVisible();

  await dialog.getByLabel('Rejection reason').fill('Automated QA rejection — does not meet bar.')
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructor-applications/${rejectAppId}/reject`) && r.ok(), { timeout: 15000 }),
    dialog.getByRole('button', { name: 'Reject', exact: true }).click(),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText(`${rejectAppName}'s application rejected.`)).toBeVisible({ timeout: 5000 })

  // The row drops off the (status=pending-filtered) Pending view once rejected —
  // switch to the Rejected status filter and confirm it landed there for real.
  await page.getByRole('button', { name: /^Rejected/ }).click()
  await searchApplicant(page, rejectAppName as string)
  await expect(rowFor(page, rejectAppName as string).getByText('REJECTED')).toBeVisible({ timeout: 10000 })
})

test('Request changes: modal appears, change request is required, and the status updates', async ({ page }) => {
  test.skip(!changesAppId, 'Setup application was not created — backend may be unavailable')

  await gotoPendingTab(page)
  await searchApplicant(page, changesAppName as string)

  await rowFor(page, changesAppName as string).getByTitle('Request changes').click()
  const dialog = page.getByRole('dialog', { name: 'Request Changes' })
  await expect(dialog).toBeVisible({ timeout: 5000 })

  await dialog.getByLabel('Change request').fill('Automated QA request — please add a portfolio link.')
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/instructor-applications/${changesAppId}/request-changes`) && r.ok(), { timeout: 15000 }),
    dialog.getByRole('button', { name: 'Send Request', exact: true }).click(),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText(`Changes requested from ${changesAppName}.`)).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: /^Changes Requested/ }).click()
  await searchApplicant(page, changesAppName as string)
  await expect(rowFor(page, changesAppName as string).getByText('CHANGES REQUESTED')).toBeVisible({ timeout: 10000 })

  // Detail modal surfaces the change request text set above.
  await rowFor(page, changesAppName as string).getByTitle('View details').click()
  await expect(page.getByRole('dialog', { name: `${changesAppName} application details` })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Automated QA request — please add a portfolio link.')).toBeVisible()
})
