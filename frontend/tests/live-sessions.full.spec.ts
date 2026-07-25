// Live Sessions tab — end-to-end tests (v1: real Zoom integration).
//
// Zoom credentials are NOT configured on this server yet (confirmed via direct
// curl before writing this suite: GET /live-sessions returns 200 with an empty
// array, and POST returns 503). That is the EXPECTED v1 state, not a bug — the
// 503 test below asserts the UI renders it correctly rather than skipping it.
//
// Because no real session can be created while Zoom is unconfigured, the
// Join/Start(host)/Edit/Cancel mechanics are tested against a page.route()
// fixture row (same pattern learning-paths.full.spec.ts uses for scenarios the
// live API cannot currently produce) — the create-flow and validation tests
// hit the real backend.
//
// Run with: npx playwright test live-sessions.full --workers=1

import { type Page, test, expect } from '@playwright/test'

const API = 'http://localhost:5001/api/admin'

let savedToken = ''

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

async function getInstructor(page: Page, H: Record<string, string>): Promise<{ id: string; name: string }> {
  const res = await page.request.get(`${API}/users?role=instructor&limit=1`, { headers: H })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  const u = body.users?.[0]
  expect(u?.id, 'At least one INSTRUCTOR user must exist in the DB').toBeTruthy()
  return { id: u.id, name: u.fullName }
}

async function gotoLiveSessionsTab(page: Page) {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Live Sessions', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=live/)
  await expect(page.getByRole('heading', { name: 'Live Sessions', exact: true })).toBeVisible({ timeout: 10000 })
}

function futureIso(daysAhead = 30): string {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
  d.setMinutes(0, 0, 0)
  return d.toISOString()
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const FIXTURE_SESSION = {
  id: 'fixture-ls-1',
  title: 'Fixture Session',
  description: 'A fixture session for UI mechanics tests.',
  courseId: null, courseTitle: null,
  instructorId: 'fixture-instructor', instructorName: 'Fixture Instructor',
  startTime: futureIso(10), durationMin: 60, timezone: 'UTC', maxParticipants: null,
  provider: 'ZOOM', zoomMeetingId: 'fixture-zoom-id',
  joinUrl: 'https://zoom.us/j/FIXTURE-JOIN-URL',
  startUrl: 'https://zoom.us/s/FIXTURE-START-URL-HOST-ONLY',
  status: 'UPCOMING',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}

async function mockFixtureList(page: Page) {
  await page.route('**/live-sessions/?*', (route) => {
    if (route.request().method() === 'GET') route.fulfill({ json: { success: true, data: [FIXTURE_SESSION] } })
    else route.continue()
  })
  await page.route('**/live-sessions/', (route) => {
    if (route.request().method() === 'GET') route.fulfill({ json: { success: true, data: [FIXTURE_SESSION] } })
    else route.continue()
  })
}

// Intercept window.open so Join/Start(host) never actually navigate — capture
// the target URL instead, and never let startUrl leak into a real open tab.
async function interceptWindowOpen(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __openedUrls: string[] }).__openedUrls = []
    window.open = (url?: string | URL) => {
      (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url ?? ''))
      return null
    }
  })
}

async function getOpenedUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __openedUrls: string[] }).__openedUrls)
}

// ── Real-backend tests ────────────────────────────────────────────────────────

test('Schedule session — past start time blocked client-side, no POST fired', async ({ page }) => {
  await gotoLiveSessionsTab(page)
  const H = await apiHeaders(page)
  const instructor = await getInstructor(page, H)

  await page.getByRole('button', { name: 'Schedule Session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Schedule Session' })).toBeVisible({ timeout: 5000 })

  await page.getByPlaceholder(/Intro Webinar/i).fill(`Past Session ${Date.now()}`)
  await page.getByLabel('Instructor').selectOption({ label: new RegExp(instructor.name) })

  const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const pastLocal = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}T${pad(past.getHours())}:${pad(past.getMinutes())}`
  await page.locator('input[type="datetime-local"]').fill(pastLocal)

  let postFired = false
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/live-sessions')) postFired = true
  })

  await page.getByRole('button', { name: 'Schedule Session', exact: true }).last().click()

  await expect(page.getByText('Start time must be in the future.')).toBeVisible({ timeout: 3000 })
  expect(postFired, 'No POST when client-side validation fails').toBe(false)
})

test('Schedule session — real backend responds; 503 (Zoom unconfigured) rendered verbatim if that is the current state', async ({ page }) => {
  await gotoLiveSessionsTab(page)
  const H = await apiHeaders(page)
  const instructor = await getInstructor(page, H)

  await page.getByRole('button', { name: 'Schedule Session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Schedule Session' })).toBeVisible({ timeout: 5000 })

  const title = `LS Create Test ${Date.now()}`
  await page.getByPlaceholder(/Intro Webinar/i).fill(title)
  await page.getByLabel('Instructor').selectOption({ label: new RegExp(instructor.name) })
  await page.locator('input[type="datetime-local"]').fill(toDatetimeLocal(futureIso(30)))

  const postResp = page.waitForResponse(
    (r) => r.url().includes('/live-sessions') && r.request().method() === 'POST',
    { timeout: 15000 },
  )
  await page.getByRole('button', { name: 'Schedule Session', exact: true }).last().click()
  const resp = await postResp
  const body = await resp.json()

  if (resp.status() === 503) {
    // Expected v1 state — assert the exact backend message renders, not a generic error.
    await expect(page.getByRole('status')).toContainText(body.message, { timeout: 5000 })
  } else {
    expect(resp.ok(), 'POST must succeed once Zoom is configured').toBeTruthy()
    const id: string = body.data?.id
    expect(id, 'POST must return a session id').toBeTruthy()
    await page.request.delete(`${API}/live-sessions/${id}`, { headers: H }).catch(() => null)
  }
})

test('Unknown instructor — exact backend message shown inline, not a toast (* mock)', async ({ page }) => {
  await gotoLiveSessionsTab(page)

  await page.getByRole('button', { name: 'Schedule Session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Schedule Session' })).toBeVisible({ timeout: 5000 })

  await page.getByPlaceholder(/Intro Webinar/i).fill(`Unknown Instructor Test ${Date.now()}`)

  // Force a value into the instructor select bypassing the real option list
  // (mirrors learning-paths.full.spec.ts's "Reject unknown itemId" pattern).
  const select = page.getByLabel('Instructor')
  await select.evaluate((el: HTMLSelectElement) => {
    const opt = el.options[1]
    if (opt) { el.value = opt.value; el.dispatchEvent(new Event('change', { bubbles: true })) }
  })
  await page.locator('input[type="datetime-local"]').fill(toDatetimeLocal(futureIso(30)))

  await page.route('**/live-sessions/', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 400, json: { success: false, message: 'Instructor not found or is not an active instructor.' } })
    } else {
      route.continue()
    }
  })

  await page.getByRole('button', { name: 'Schedule Session', exact: true }).last().click()
  await expect(page.getByRole('alert')).toContainText('Instructor not found or is not an active instructor.', { timeout: 5000 })
})

// ── Fixture-row tests (Zoom unconfigured — no real session exists to test against) ─

test('startUrl exposed ONLY via "Start (host)" — Join uses joinUrl, startUrl never leaks elsewhere (* mock)', async ({ page }) => {
  await interceptWindowOpen(page)
  await mockFixtureList(page)
  await gotoLiveSessionsTab(page)

  await expect(page.getByText(FIXTURE_SESSION.title)).toBeVisible({ timeout: 10000 })

  // startUrl must not appear as visible text anywhere on the page.
  await expect(page.getByText(FIXTURE_SESSION.startUrl)).toHaveCount(0)

  await page.getByRole('button', { name: 'Join', exact: true }).click()
  let opened = await getOpenedUrls(page)
  expect(opened).toContain(FIXTURE_SESSION.joinUrl)
  expect(opened).not.toContain(FIXTURE_SESSION.startUrl)

  await page.getByRole('button', { name: 'Start (host)', exact: true }).click()
  opened = await getOpenedUrls(page)
  expect(opened).toContain(FIXTURE_SESSION.startUrl)
})

test('Status badge is a pure render of the server value — no status control in the UI (* mock)', async ({ page }) => {
  await mockFixtureList(page)
  await gotoLiveSessionsTab(page)

  await expect(page.getByText(FIXTURE_SESSION.title)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Upcoming', { exact: true })).toBeVisible()

  // No select/dropdown/button anywhere offers to set status directly.
  await expect(page.getByLabel(/^status$/i)).toHaveCount(0)
})

test('Edit: nothing changed → no PATCH sent (empty patch is a backend 400) (* mock)', async ({ page }) => {
  await mockFixtureList(page)
  await gotoLiveSessionsTab(page)

  await expect(page.getByText(FIXTURE_SESSION.title)).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: `Edit ${FIXTURE_SESSION.title}` }).click()
  await expect(page.getByRole('heading', { name: 'Edit Session' })).toBeVisible({ timeout: 5000 })

  let patchFired = false
  page.on('request', (req) => {
    if (req.method() === 'PATCH' && req.url().includes('/live-sessions/')) patchFired = true
  })

  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByRole('heading', { name: 'Live Sessions', exact: true })).toBeVisible({ timeout: 5000 })
  expect(patchFired, 'No PATCH when nothing changed').toBe(false)
})

test('Cancel — confirm dialog explicitly mentions Zoom meeting deletion, DELETE fires (* mock)', async ({ page }) => {
  await mockFixtureList(page)
  await gotoLiveSessionsTab(page)
  await expect(page.getByText(FIXTURE_SESSION.title)).toBeVisible({ timeout: 10000 })

  let dialogMessage = ''
  page.once('dialog', (d) => { dialogMessage = d.message(); d.accept() })

  await page.route(`**/live-sessions/${FIXTURE_SESSION.id}`, (route) => {
    if (route.request().method() === 'DELETE') {
      route.fulfill({ json: { success: true, message: 'Live session canceled.', data: { id: FIXTURE_SESSION.id } } })
    } else {
      route.continue()
    }
  })

  const deleteResp = page.waitForResponse(
    (r) => r.url().includes(`/live-sessions/${FIXTURE_SESSION.id}`) && r.request().method() === 'DELETE',
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: `Cancel ${FIXTURE_SESSION.title}` }).click()
  await deleteResp

  expect(dialogMessage.toLowerCase()).toContain('delete the zoom meeting')
  await expect(page.getByText(FIXTURE_SESSION.title)).not.toBeVisible({ timeout: 5000 })
})

test('Provider picker is never rendered — ZOOM-only v1, no Meet/Teams options anywhere', async ({ page }) => {
  await gotoLiveSessionsTab(page)
  await page.getByRole('button', { name: 'Schedule Session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Schedule Session' })).toBeVisible({ timeout: 5000 })

  await expect(page.getByText('Zoom', { exact: false })).toHaveCount(0)
  await expect(page.getByText('Google Meet')).toHaveCount(0)
  await expect(page.getByText('Microsoft Teams')).toHaveCount(0)
})
