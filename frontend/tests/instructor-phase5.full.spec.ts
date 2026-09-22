import { type Page, test, expect } from '@playwright/test'

// Covers Phase 5 of the Instructor Dashboard (INSTRUCTOR_DASHBOARD_BLUEPRINT.docx
// Sections 2.6 My Reviews, 2.8 My Competencies, 2.9 My Earnings, 2.11 My
// Reports). Same beforeAll/afterAll API-setup pattern as
// instructor-students.full.spec.ts: an admin session + a fresh instructor
// account seed real data via Prisma-backed admin endpoints, the instructor
// logs in through the real UI for the actual assertions. All four pages are
// read-only this phase — no write actions to exercise.

const ADMIN_API = 'http://localhost:5001/api/admin'
const INSTRUCTOR_AUTH_API = 'http://localhost:5001/api/instructor/auth'
const INSTRUCTOR_API = 'http://localhost:5001/api/instructor'

let savedAdminToken: string | null = null
let instructorToken: string | null = null
let testInstructorId: string | null = null
let testCourseId: string | null = null

const stamp = Date.now()
const instructorEmail = `qa.instructor.phase5.${stamp}@example.com`
const instructorPassword = 'TestInstr123!'
const instructorFullName = `QA Instructor Phase5 ${stamp}`
const courseTitle = `QA Phase5 Course ${stamp}`

async function loginAsInstructor(page: Page) {
  await page.goto('/instructor/login')
  await page.fill('#instructor-login-email', instructorEmail)
  await page.fill('#instructor-login-password', instructorPassword)
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

  const loginResp = await request.post(`${INSTRUCTOR_AUTH_API}/login`, {
    data: { email: instructorEmail, password: instructorPassword },
  })
  expect(loginResp.status()).toBe(200)
  instructorToken = (await loginResp.json())?.token ?? null
  expect(instructorToken).toBeTruthy()

  const courseResp = await request.post(`${INSTRUCTOR_API}/courses`, {
    headers: { Authorization: `Bearer ${instructorToken}` },
    data: { title: courseTitle },
  })
  expect(courseResp.status()).toBe(201)
  testCourseId = (await courseResp.json())?.data?.id ?? null
  expect(testCourseId).toBeTruthy()

  // No HTTP endpoint anywhere can seed a review/skill-mapping/payout for this
  // instructor (reviews have no student-facing submit route — blueprint 2.6's
  // own documented gap; skill<->course mapping and payout creation are
  // admin-console actions with no instructor-facing equivalent). This test
  // therefore covers the honest-empty-state path for a brand-new instructor;
  // the non-empty / cross-instructor-isolation path is covered by the Part 6
  // curl verification (which seeds via Prisma directly) in this phase's report.
})

test.afterAll(async ({ request }) => {
  if (testCourseId && savedAdminToken) {
    await request.delete(`${ADMIN_API}/courses/${testCourseId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
  if (testInstructorId && savedAdminToken) {
    await request.delete(`${ADMIN_API}/instructors/${testInstructorId}`, { headers: { Authorization: `Bearer ${savedAdminToken}` } })
  }
})

test('My Reviews shows honest empty state and stats for a brand-new instructor', async ({ page }) => {
  await loginAsInstructor(page)

  const statsResponse = page.waitForResponse((res) => res.url().includes('/api/instructor/reviews/stats'))
  await page.goto('/instructor/reviews')
  await statsResponse

  await expect(page.locator('text=Average Rating')).toBeVisible()
  await expect(page.locator('text=Total Reviews')).toBeVisible()
  await expect(page.locator('text=No reviews yet.')).toBeVisible()
})

test('My Competencies has both tabs and switches between them', async ({ page }) => {
  await loginAsInstructor(page)

  const skillsResponse = page.waitForResponse((res) => res.url().includes('/api/instructor/competencies/skills-in-my-courses'))
  await page.goto('/instructor/competencies')
  await skillsResponse
  await expect(page.locator('text=None of your courses have skills mapped to them yet.')).toBeVisible()

  const certsResponse = page.waitForResponse((res) => res.url().includes('/api/instructor/competencies/my-certifications'))
  await page.click('text=My Certifications')
  await certsResponse
  await expect(page.locator('text=You have no competency certifications yet.')).toBeVisible()
})

test('My Earnings shows real $0 summary cards, not a coming-soon stub', async ({ page }) => {
  await loginAsInstructor(page)

  const summaryResponse = page.waitForResponse((res) => res.url().includes('/api/instructor/earnings/summary'))
  await page.goto('/instructor/earnings')
  await summaryResponse

  await expect(page.locator('text=Lifetime Earnings')).toBeVisible()
  await expect(page.locator('text=$0.00').first()).toBeVisible()
  await expect(page.locator('text=No payouts yet.')).toBeVisible()
})

test('My Reports shows KPI cards, trend chart section, and per-course breakdown', async ({ page }) => {
  await loginAsInstructor(page)

  const overviewResponse = page.waitForResponse((res) => res.url().includes('/api/instructor/reports/overview'))
  await page.goto('/instructor/reports')
  await overviewResponse

  await expect(page.locator('text=Course Completion Rate')).toBeVisible()
  await expect(page.locator('text=Avg. Rating')).toBeVisible()
  await expect(page.locator('text=Live Session Attendance')).toBeVisible()
  await expect(page.locator('text=Performance Trend')).toBeVisible()
  await expect(page.locator('text=Per-Course Breakdown')).toBeVisible()
})

test('Sidebar no longer shows Reviews/Competencies/Earnings/Reports as Coming Soon', async ({ page }) => {
  await loginAsInstructor(page)
  for (const path of ['/instructor/reviews', '/instructor/competencies', '/instructor/earnings', '/instructor/reports']) {
    await page.goto(path)
    await expect(page.locator('text=Coming Soon')).not.toBeVisible()
  }
})
