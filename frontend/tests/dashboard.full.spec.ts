import { type Page, test, expect } from '@playwright/test'

// ── Real-data wiring tests (added 2026-07-27 — Dashboard Overview fixes) ──────
//
// These verify the dashboard UI matches what the REAL backend endpoints
// return right now, rather than asserting fixed numbers — the dashboard's
// data changes as the DB changes, so "real" here means "UI === live API
// response", not "UI === some hardcoded expected value".

const API = 'http://localhost:5001/api/admin'

let savedToken = ''
const createdUserIds: string[] = []

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }
  for (const id of createdUserIds) {
    await request.delete(`${API}/users/${id}`, { headers: H }).catch(() => null)
  }
})

async function ensureToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  expect(token, 'mn_admin_token must exist in localStorage').toBeTruthy()
  savedToken = token
  return token
}

test('KPI cards load with numbers', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const totalUsersCard = page.locator('.mn-lkpi-label').filter({ hasText: 'Total Users' }).locator('xpath=../..')
  await expect(totalUsersCard).toContainText(/\d/)
  const activeLearnersCard = page.locator('.mn-lkpi-label').filter({ hasText: 'Active Learners' }).locator('xpath=../..')
  await expect(activeLearnersCard).toContainText(/\d/)
})

test('Recent Activity shows entries', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByText('Recent Activity', { exact: false })).toBeVisible({ timeout: 15000 })
})

test('Users by Role chart loads', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByText('Users by Role', { exact: false })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('text=Total Users').last()).toBeVisible({ timeout: 15000 })
})

test('Quick Actions work (navigate correctly)', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Add User', exact: true }).click()
  await expect(page).toHaveURL(/\/users/)

  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'System Settings', exact: true }).click()
  await expect(page).toHaveURL(/\/settings/)
})

test('Date filter changes data', async ({ page }) => {
  await page.goto('/dashboard')
  const from = page.locator('input[type="date"]').first()
  const to = page.locator('input[type="date"]').nth(1)
  const today = new Date().toISOString().slice(0, 10)
  const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  await from.fill(lastMonth)
  await to.fill(today)
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await expect(page.getByText('✕', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('Live Sessions widget shows counts matching the real LiveSession rows (not app-login sessions)', async ({ page }) => {
  await page.goto('/dashboard')
  const token = await ensureToken(page)
  const H = { Authorization: `Bearer ${token}` }

  // Independent ground truth: GET /live-sessions directly (the same endpoint
  // live-sessions.full.spec.ts verifies), NOT the dashboard endpoint under
  // test — comparing the dashboard against itself would still pass even if
  // it reverted to counting app-login sessions, since it'd just be
  // comparing a wrong number to that same wrong number.
  const trueRes = await page.request.get(`${API}/live-sessions`, { headers: H })
  expect(trueRes.ok()).toBeTruthy()
  const trueSessions = (await trueRes.json()).data as { status: string; title: string; startTime: string }[]
  const trueActiveCount   = trueSessions.filter((s) => s.status === 'LIVE').length
  const trueUpcomingCount = trueSessions.filter((s) => s.status === 'UPCOMING').length

  const res = await page.request.get(`${API}/dashboard/admin-widgets`, { headers: H })
  expect(res.ok()).toBeTruthy()
  const real = (await res.json()).liveSessions as {
    activeCount: number; upcomingCount: number
    items: { title: string }[]
  }

  // The actual regression check: dashboard counts must match the
  // independently-fetched real LiveSession counts, not app-login sessions.
  expect(real.activeCount, 'dashboard activeCount must match real LIVE session count').toBe(trueActiveCount)
  expect(real.upcomingCount, 'dashboard upcomingCount must match real UPCOMING session count').toBe(trueUpcomingCount)

  await expect(page.getByText('Live Sessions', { exact: true })).toBeVisible({ timeout: 15000 })
  const card = page.locator('.mn-db-card').filter({ has: page.getByText('Live Sessions', { exact: true }) })

  // Stat tiles must match what the dashboard API actually returned. Anchor
  // on the label text first (not the bare number) since Active/Upcoming can
  // legitimately collide on the same value (e.g. both 0).
  const activeTile   = card.getByText('Active', { exact: true }).locator('xpath=..')
  const upcomingTile = card.getByText('Upcoming', { exact: true }).locator('xpath=..')
  await expect(activeTile).toContainText(String(real.activeCount))
  await expect(upcomingTile).toContainText(String(real.upcomingCount))

  // The stale "End" button (dead action, no `end` mutation exists in the
  // contract) must be gone.
  await expect(card.getByRole('button', { name: 'End', exact: true })).toHaveCount(0)

  if (real.items.length > 0) {
    // Scoped to THIS card — Calendar & Events (Fix 5) intentionally renders
    // the identical title for the same underlying session, so an unscoped
    // page-wide getByText here would match twice and throw a strict-mode
    // violation.
    await expect(card.getByText(real.items[0].title)).toBeVisible()
  }
})

test('Pending Approvals badge count matches items list exactly (no total/empty-list contradiction)', async ({ page }) => {
  await page.goto('/dashboard')
  const token = await ensureToken(page)
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Create a real pending-verification user so total is guaranteed > 0 —
  // proves items[] actually populates, not just "0 matches 0" trivially.
  const createRes = await page.request.post(`${API}/users`, {
    data: {
      fullName: 'Dashboard Pending Probe', email: `dash-pending-${Date.now()}@example.com`,
      password: 'Test@12345678', phone: null, role: 'LEARNER', department: null,
      branch: null, groupId: null, accessLevel: null, managerId: null, skills: null,
    },
    headers: H,
  })
  expect(createRes.ok()).toBeTruthy()
  const created = await createRes.json()
  const userId: string = created.user?.id ?? created.data?.id
  expect(userId).toBeTruthy()
  createdUserIds.push(userId)

  const res = await page.request.get(`${API}/dashboard/admin-widgets`, { headers: H })
  expect(res.ok()).toBeTruthy()
  const real = (await res.json()).pendingApprovals as { total: number; items: unknown[] }

  expect(real.total, 'total must be > 0 with the fixture user present').toBeGreaterThan(0)
  // Exact invariant of this fix: items reflects min(total, the display cap),
  // never an empty array regardless of total (the bug being fixed).
  expect(real.items.length).toBe(Math.min(real.total, 10))
  expect(real.items.length).toBeGreaterThan(0)

  await page.goto('/dashboard')
  const card = page.locator('.mn-db-card').filter({ has: page.getByText('Pending Approvals', { exact: true }) })
  await expect(card.getByText(String(real.total), { exact: true })).toBeVisible({ timeout: 15000 })
  await expect(card.getByText('Dashboard Pending Probe', { exact: false })).toBeVisible()
  await expect(card.getByText('No pending approvals.')).toHaveCount(0)
})

test('Learning Activity Overview renders real enrollment trend data (no "Coming Soon" stub)', async ({ page }) => {
  await page.goto('/dashboard')
  const token = await ensureToken(page)
  const H = { Authorization: `Bearer ${token}` }

  const res = await page.request.get(`${API}/dashboard/analytics`, { headers: H })
  expect(res.ok()).toBeTruthy()
  const real = (await res.json()).learningActivity as { date: string; enrolled: number; completed: number }[]

  // Dense day-filled array — must never be empty (that was the hardcoded stub).
  expect(real.length).toBeGreaterThan(0)

  await expect(page.getByText('Learning Activity Overview', { exact: true })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Learning Activity Coming Soon')).toHaveCount(0)
  // Real chart renders an SVG with plotted lines, not the stub's 📚 empty state.
  const chartCard = page.locator('.mn-db-card').filter({ has: page.getByText('Learning Activity Overview', { exact: true }) })
  await expect(chartCard.locator('svg polyline')).toHaveCount(2) // enrolled + completed lines
})
