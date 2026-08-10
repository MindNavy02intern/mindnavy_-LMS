import { test, expect } from '@playwright/test'

// Notifications module — full stack (Parts 1-4). Real backend throughout (no
// route mocking) — a disposable learner is created via the real API, same
// pattern as competencies.full.spec.ts. See
// backend/contact md files/NOTIFICATIONS_CONTRACT.md for endpoint shapes.
//
// Run with: npx playwright test notifications.full --workers=1
//
// SAFETY NOTE: the Announcement test deliberately uses audience=CUSTOM
// targeting only the disposable QA learner created in beforeAll — NOT
// audience=ALL. "Send Now" triggers a real email attempt (capped at 50
// recipients per NOTIFICATIONS_CONTRACT.md decision #4); scoping to one
// throwaway @example.com address keeps this test from emailing real users
// even if SMTP happens to be configured in this environment.
//
// CLEANUP ORDER: automation → template (NotificationAutomation.templateId has
// no onDelete:Cascade, so the template 409s while the automation still
// references it) → announcement (delete is unguarded) → learner. NotificationLog
// rows created by the send-notification/announcement-send tests are left in
// place — same "append-only history, not a leaked entity" reasoning as
// competencies.full.spec.ts leaving SkillAssessment rows behind.

const API = 'http://localhost:5001/api/admin'

let savedToken: string | null = null
let learnerId: string | null = null
let learnerName: string | null = null
let learnerEmail: string | null = null
let templateId: string | null = null
let templateName: string | null = null
let automationId: string | null = null
let announcementId: string | null = null

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/notifications')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()
  if (!savedToken) return

  const stamp = Date.now()
  learnerName = `QA Notifications Learner ${stamp}`
  learnerEmail = `qa.notifications.learner.${stamp}@example.com`
  const learnerResp = await request.post(`${API}/learners`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: {
      fullName: learnerName,
      email: learnerEmail,
      password: 'Qatest!2345678',
      status: 'ACTIVE',
    },
  })
  const learnerBody = await learnerResp.json().catch(() => null)
  learnerId = learnerBody?.data?.id ?? null
})

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }

  if (automationId) {
    await request.delete(`${API}/notifications/automations/${automationId}`, { headers: H }).catch(() => null)
  }
  if (templateId) {
    await request.delete(`${API}/notifications/templates/${templateId}`, { headers: H }).catch(() => null)
  }
  if (announcementId) {
    await request.delete(`${API}/notifications/announcements/${announcementId}`, { headers: H }).catch(() => null)
  }
  if (learnerId) {
    await request.delete(`${API}/learners/${learnerId}`, { headers: H }).catch(() => null)
  }
})

test('Notifications page loads with header, stats cards and tabs', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/notifications/stats') && r.ok(), { timeout: 15000 }),
    page.goto('/notifications'),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Sent (this month)')).toBeVisible({ timeout: 10000 })
  for (const label of ['Dashboard', 'In-App', 'Announcements', 'Templates', 'Automations', 'Emergency Alerts']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 10000 })
  }
})

test('Create Template creates a template and it appears in the Templates tab', async ({ page }) => {
  const stamp = Date.now()
  templateName = `QA Template ${stamp}`

  await page.goto('/notifications?tab=templates')
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: '+ Create Template' }).click()
  await expect(page.getByRole('heading', { name: 'Create Template' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('Name *').fill(templateName)
  await page.getByLabel(/Body \*/).fill('Hello {{studentName}}, welcome!')

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/notifications/templates') && r.request().method() === 'POST', { timeout: 15000 }),
    page.locator('form button[type="submit"]').click(),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  templateId = body?.data?.id ?? null
  expect(templateId, 'Created template must return a real id').toBeTruthy()

  await expect(page.getByText(templateName)).toBeVisible({ timeout: 10000 })
})

test('Create Announcement sends to a scoped custom audience and appears in the list', async ({ page }) => {
  test.skip(!learnerId, 'QA learner was not created in beforeAll')
  const stamp = Date.now()
  const title = `QA Announcement ${stamp}`

  await page.goto('/notifications?tab=announcements')
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: '+ Create Announcement' }).click()
  await expect(page.getByRole('heading', { name: 'Create Announcement' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('Title *').fill(title)
  await page.getByLabel('Body *').fill('This is a QA test announcement.')
  await page.getByLabel('Audience').selectOption('CUSTOM')

  await page.getByLabel('Users *').fill(learnerName as string)
  await expect(page.getByText(learnerEmail as string)).toBeVisible({ timeout: 10000 })
  await page.getByText(learnerEmail as string).click()

  const [createResp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/notifications/announcements') && r.request().method() === 'POST', { timeout: 15000 }),
    page.getByRole('button', { name: 'Send Announcement' }).click(),
  ])
  expect(createResp.ok()).toBeTruthy()
  const createBody = await createResp.json()
  announcementId = createBody?.data?.id ?? null
  expect(announcementId, 'Created announcement must return a real id').toBeTruthy()

  await expect(page.getByText(title)).toBeVisible({ timeout: 10000 })
})

test('Create Automation appears in the Automations tab, pause it, and status changes', async ({ page }) => {
  test.skip(!templateId, 'Template was not created in the earlier test')
  const stamp = Date.now()
  const automationName = `QA Automation ${stamp}`

  await page.goto('/notifications?tab=automation')
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: '+ Create Automation' }).first().click()
  await expect(page.getByRole('heading', { name: 'Create Automation' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('Name *').fill(automationName)
  await page.getByLabel('Template *').selectOption(templateId as string)

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/notifications/automations') && r.request().method() === 'POST', { timeout: 15000 }),
    page.locator('form button[type="submit"]').click(),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  automationId = body?.data?.id ?? null
  expect(automationId, 'Created automation must return a real id').toBeTruthy()

  const row = page.locator('tr', { hasText: automationName })
  await expect(row).toBeVisible({ timeout: 10000 })
  await expect(row.getByText('ACTIVE', { exact: true })).toBeVisible({ timeout: 10000 })

  const [pauseResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/notifications/automations/${automationId}/pause`) && r.ok(), { timeout: 15000 }),
    row.getByLabel('Pause').click(),
  ])
  expect(pauseResp.ok()).toBeTruthy()
  await expect(row.getByText('PAUSED', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('Send Notification to a real user appears in Delivery Logs', async ({ page }) => {
  test.skip(!learnerId, 'QA learner was not created in beforeAll')
  const stamp = Date.now()
  const title = `QA In-App Alert ${stamp}`

  await page.goto('/notifications?tab=inapp')
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: '+ Send Notification' }).click()
  await expect(page.getByRole('heading', { name: 'Send Notification' })).toBeVisible({ timeout: 5000 })

  await page.getByLabel('Recipients *').fill(learnerName as string)
  await expect(page.getByText(learnerEmail as string)).toBeVisible({ timeout: 10000 })
  await page.getByText(learnerEmail as string).click()
  await page.getByLabel('Title *').fill(title)
  await page.getByLabel('Body *').fill('This is a QA test in-app notification.')

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/notifications/send') && r.request().method() === 'POST', { timeout: 15000 }),
    // Scoped to the modal's <form> — the page header also has a "Send
    // Notification" button with the same accessible name.
    page.locator('form button[type="submit"]').click(),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  expect(body?.data?.sentCount, 'Send must report at least one recipient').toBeGreaterThan(0)

  const [logsResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/notifications/logs') && r.ok(), { timeout: 15000 }),
    page.goto('/notifications?tab=logs'),
  ])
  expect(logsResp.ok()).toBeTruthy()
  await expect(page.getByText(title)).toBeVisible({ timeout: 10000 })
})
