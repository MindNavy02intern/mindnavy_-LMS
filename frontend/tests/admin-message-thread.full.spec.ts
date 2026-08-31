import { type Page, test, expect } from '@playwright/test'

// Covers the admin-side reply loop: admin sends a message, instructor replies
// (seeded directly via the instructor API — the instructor-side reply UI is
// covered by instructor-phase6.full.spec.ts), and this file verifies the
// admin can see + read + reply to that thread from the topbar Messages panel
// (AdminLayout.tsx MessagesPanel -> MessageThreadModal).
//
// Tests depend on order (unread check, then read, then reply-back) — run
// with --workers=1, same convention as instructor-phase6.full.spec.ts.

const ADMIN_API = 'http://localhost:5001/api/admin'
const INSTRUCTOR_API = 'http://localhost:5001/api/instructor'

let savedAdminToken: string | null = null
let testInstructorId: string | null = null
let seededMessageId: string | null = null

const stamp = Date.now()
const instructorEmail = `qa.instructor.msgthread.${stamp}@example.com`
const instructorPassword = 'TestInstr123!'
const instructorFullName = `QA Instructor MsgThread ${stamp}`
const instructorReplyBody = 'Thanks, got it — will follow up shortly.'

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/dashboard')
  savedAdminToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()

  const instructorResp = await request.post(`${ADMIN_API}/instructors`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { fullName: instructorFullName, email: instructorEmail, password: instructorPassword, status: 'ACTIVE' },
  })
  expect(instructorResp.status()).toBe(201)
  testInstructorId = (await instructorResp.json())?.data?.id ?? null
  expect(testInstructorId).toBeTruthy()

  const sendResp = await request.post(`${ADMIN_API}/messages`, {
    headers: { Authorization: `Bearer ${savedAdminToken}` },
    data: { recipientId: testInstructorId, subject: 'Thread QA subject', body: 'Original message body for thread test.' },
  })
  expect(sendResp.status()).toBe(201)
  seededMessageId = (await sendResp.json())?.adminMessage?.id ?? null
  expect(seededMessageId).toBeTruthy()

  const loginResp = await request.post(`${INSTRUCTOR_API}/auth/login`, {
    data: { email: instructorEmail, password: instructorPassword },
  })
  expect(loginResp.ok()).toBeTruthy()
  const instructorToken = (await loginResp.json())?.token ?? null
  expect(instructorToken).toBeTruthy()

  const replyResp = await request.post(`${INSTRUCTOR_API}/messages/reply`, {
    headers: { Authorization: `Bearer ${instructorToken}` },
    data: { originalMessageId: seededMessageId, body: instructorReplyBody },
  })
  expect(replyResp.ok()).toBeTruthy()
})

test.afterAll(async ({ request }) => {
  if (testInstructorId && savedAdminToken) {
    await request.delete(`${ADMIN_API}/instructors/${testInstructorId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
})

async function openMessagesPanel(page: Page) {
  const listResponse = page.waitForResponse((res) => res.url().includes('/api/admin/messages?') && res.request().method() === 'GET')
  await page.goto('/dashboard')
  await listResponse
  await page.click('button[aria-label="Messages"]')
}

test('Topbar Messages panel shows the instructor reply as "1 new reply"', async ({ page }) => {
  await openMessagesPanel(page)
  await expect(page.locator('text=Thread QA subject')).toBeVisible()
  await expect(page.locator('text=1 new reply')).toBeVisible()
})

test('Opening the thread shows both sides of the conversation and clears the unread badge', async ({ page }) => {
  await openMessagesPanel(page)

  const threadResponse = page.waitForResponse((res) => res.url().includes(`/messages/${seededMessageId}/thread`) && res.request().method() === 'GET')
  await page.click('text=Thread QA subject')
  await threadResponse

  await expect(page.locator('text=Original message body for thread test.')).toBeVisible()
  await expect(page.locator(`text=${instructorReplyBody}`)).toBeVisible()

  await page.click('button[aria-label="Close thread"]')
  await openMessagesPanel(page)
  await expect(page.locator('text=1 new reply')).toHaveCount(0)
  await expect(page.locator('text=1 reply')).toBeVisible()
})

test('Admin can reply back from the thread modal via SendMessageModal', async ({ page }) => {
  await openMessagesPanel(page)

  const threadResponse = page.waitForResponse((res) => res.url().includes(`/messages/${seededMessageId}/thread`) && res.request().method() === 'GET')
  await page.click('text=Thread QA subject')
  await threadResponse

  await page.click('button:has-text("Reply")')
  await expect(page.locator(`text=Sending to`)).toBeVisible()
  await expect(page.locator(`text=${instructorFullName}`)).toBeVisible()

  await page.fill('input[placeholder="Enter message subject…"]', 'Re: Thread QA subject')
  await page.fill('textarea[placeholder^="Write your message"]', 'Following up on this — thanks for the update.')

  const sendResponse = page.waitForResponse((res) => res.url().endsWith('/messages') && res.request().method() === 'POST')
  await page.click('button:has-text("Send Message")')
  await sendResponse

  await expect(page.locator('text=Reply sent')).toBeVisible()
})
