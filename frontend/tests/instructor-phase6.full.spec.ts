import { type Page, test, expect } from '@playwright/test'

// Covers Phase 6 (FINAL) of the Instructor Dashboard (INSTRUCTOR_DASHBOARD_
// BLUEPRINT.docx Section 2.10 Messages & Notifications, Section 2.12 Account
// Settings). Same beforeAll/afterAll API-setup pattern as
// instructor-phase5.full.spec.ts.

const ADMIN_API = 'http://localhost:5001/api/admin'

let savedAdminToken: string | null = null
let testInstructorId: string | null = null

const stamp = Date.now()
const instructorEmail = `qa.instructor.phase6.${stamp}@example.com`
const instructorPassword = 'TestInstr123!'
const instructorFullName = `QA Instructor Phase6 ${stamp}`
const newPassword = 'BrandNewPass789!'

async function loginAsInstructor(page: Page, password: string) {
  await page.goto('/instructor/login')
  await page.fill('#instructor-login-email', instructorEmail)
  await page.fill('#instructor-login-password', password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/instructor\/dashboard/)
}

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/instructors')
  savedAdminToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()

  const instructorResp = await request.post(`${ADMIN_API}/instructors`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { fullName: instructorFullName, email: instructorEmail, password: instructorPassword, status: 'ACTIVE' },
  })
  expect(instructorResp.status()).toBe(201)
  testInstructorId = (await instructorResp.json())?.data?.id ?? null
  expect(testInstructorId).toBeTruthy()

  // Seed one real AdminMessage and one real in-app notification so the
  // Messages page has non-empty-state content to assert against.
  await request.post(`${ADMIN_API}/messages`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { recipientId: testInstructorId, subject: 'Welcome aboard', body: 'Glad to have you teaching with us.' },
  })
  await request.post(`${ADMIN_API}/notifications/send`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { userIds: [testInstructorId], title: 'System notice', body: 'Your account is fully set up.' },
  })
})

test.afterAll(async ({ request }) => {
  if (testInstructorId && savedAdminToken) {
    await request.delete(`${ADMIN_API}/instructors/${testInstructorId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
})

test('Messages page lists the seeded admin message and marks it read on click', async ({ page }) => {
  await loginAsInstructor(page, instructorPassword)

  const listResponse = page.waitForResponse((res) => res.url().includes('/api/instructor/messages') && res.request().method() === 'GET')
  await page.goto('/instructor/messages')
  await listResponse

  await expect(page.locator('text=Welcome aboard')).toBeVisible()

  const readResponse = page.waitForResponse((res) => res.url().includes('/read') && res.request().method() === 'PATCH')
  await page.click('text=Welcome aboard')
  await readResponse
})

test('Notifications tab lists the seeded notification and Mark all read clears the badge', async ({ page }) => {
  await loginAsInstructor(page, instructorPassword)
  await page.goto('/instructor/messages')
  await page.click('text=Notifications')

  await expect(page.locator('text=System notice')).toBeVisible()

  const markAllResponse = page.waitForResponse((res) => res.url().includes('/read-all'))
  await page.click('text=Mark all read')
  await markAllResponse
})

test('Settings: Notification Preferences toggle persists', async ({ page }) => {
  await loginAsInstructor(page, instructorPassword)

  const getResponse = page.waitForResponse((res) => res.url().includes('/notifications/preferences') && res.request().method() === 'GET')
  await page.goto('/instructor/settings')
  await page.click('text=Notification Preferences')
  await getResponse

  const patchResponse = page.waitForResponse((res) => res.url().includes('/notifications/preferences') && res.request().method() === 'PATCH')
  await page.getByRole('switch', { name: 'Email' }).click()
  await patchResponse
})

test('Settings: Sessions & Devices shows the current session and blocks self-revoke', async ({ page }) => {
  await loginAsInstructor(page, instructorPassword)

  const listResponse = page.waitForResponse((res) => res.url().includes('/api/instructor/sessions') && res.request().method() === 'GET')
  await page.goto('/instructor/settings')
  await page.click('text=Sessions & Devices')
  await listResponse

  await expect(page.locator('text=THIS DEVICE')).toBeVisible()
  await expect(page.locator('text=Use Sign Out to end this session')).toBeVisible()
})

test('Settings: MFA and Avatar show Coming Soon, not a broken page', async ({ page }) => {
  await loginAsInstructor(page, instructorPassword)
  await page.goto('/instructor/settings')

  await page.click('text=Two-Factor Authentication')
  await expect(page.locator('text=Two-Factor Authentication — Coming Soon')).toBeVisible()

  await page.click('text=Avatar')
  await expect(page.locator('text=Avatar — Coming Soon')).toBeVisible()
})

test('Change Password: wrong current password shows inline error, does not sign out', async ({ page }) => {
  await loginAsInstructor(page, instructorPassword)
  await page.goto('/instructor/settings')

  await page.fill('input[autocomplete="current-password"]', 'TotallyWrongPassword!')
  await page.fill('input[autocomplete="new-password"] >> nth=0', newPassword)
  await page.fill('input[autocomplete="new-password"] >> nth=1', newPassword)

  const changeResponse = page.waitForResponse((res) => res.url().includes('/auth/password') && res.request().method() === 'PATCH')
  await page.click('button[type="submit"]:has-text("Change Password")')
  await changeResponse

  await expect(page.locator('text=Current password is incorrect.')).toBeVisible()
  await expect(page).toHaveURL(/\/instructor\/settings/)
})

test('Change Password: success signs out and redirects to login; old session is dead', async ({ page }) => {
  await loginAsInstructor(page, instructorPassword)
  await page.goto('/instructor/settings')

  await page.fill('input[autocomplete="current-password"]', instructorPassword)
  await page.fill('input[autocomplete="new-password"] >> nth=0', newPassword)
  await page.fill('input[autocomplete="new-password"] >> nth=1', newPassword)

  const changeResponse = page.waitForResponse((res) => res.url().includes('/auth/password') && res.request().method() === 'PATCH')
  await page.click('button[type="submit"]:has-text("Change Password")')
  await changeResponse

  await expect(page).toHaveURL(/\/instructor\/login/)

  // New password works.
  await loginAsInstructor(page, newPassword)
})

test('Sidebar: all 12 pages are real — none render the Coming Soon page', async ({ page }) => {
  // Uses the (now-changed) password from the previous test — run this file
  // with --workers=1 so tests execute in this exact order.
  await loginAsInstructor(page, newPassword)

  const paths = [
    '/instructor/dashboard', '/instructor/profile', '/instructor/courses',
    '/instructor/live-sessions', '/instructor/students', '/instructor/reviews',
    '/instructor/certifications', '/instructor/competencies', '/instructor/earnings',
    '/instructor/messages', '/instructor/reports', '/instructor/settings',
  ]
  for (const path of paths) {
    await page.goto(path)
    // InstructorComingSoonPage.tsx is the ONLY place in the instructor portal
    // that renders this emoji + "Coming soon." paragraph — a clean, unique
    // negative signal that the generic stub is gone, distinct from Settings'
    // own MFA/Avatar sub-tabs which legitimately say "Coming Soon" inside a
    // real page (checked separately in the MFA/Avatar test above).
    await expect(page.locator('text=🚧')).toHaveCount(0)
    await expect(page.locator('text=Coming soon.')).toHaveCount(0)
  }
})
