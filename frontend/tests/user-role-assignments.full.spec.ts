import { test, expect, type Page } from '@playwright/test'

function uid() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`
}

function futureDateStr(daysFromNow: number) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

// ── Cleanup state (option c: self-cleaning tests) ─────────────────────────────
const createdUserIds: string[] = []
const createdRoleIds: string[] = []
let savedToken: string | null = null

async function stashToken(page: Page) {
  if (!savedToken) {
    // localStorage is inaccessible on the pre-navigation about:blank page.
    if (page.url() === 'about:blank') await page.goto('/dashboard')
    savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  }
}

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }
  for (const id of createdRoleIds) {
    await request.delete(
      `http://localhost:5001/api/admin/roles/${id}`,
      { headers: H },
    ).catch(() => null)
  }
  for (const id of createdUserIds) {
    await request.delete(`http://localhost:5001/api/admin/users/${id}`, { headers: H }).catch(() => null)
    await request.delete(`http://localhost:5001/api/admin/users/${id}/permanent`, { headers: H }).catch(() => null)
  }
})

async function gotoAssignments(page: Page) {
  await page.goto('/roles-permissions')
  await page.getByRole('button', { name: 'User Role Assignments', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=assignments/)
}

// Modals in this codebase render as a `position: fixed; inset: 0` overlay root.
// Closed modals from earlier tests stay mounted (hidden) in the DOM, so
// `:visible` is required too — otherwise `.last()` can pick a stale instance.
function modalScope(page: Page, anchorText: string) {
  return page.locator('[style*="position: fixed"]:visible').filter({ hasText: anchorText }).last()
}

function waitForApi(page: Page, urlSubstr: string, method: string) {
  return page.waitForResponse(resp => resp.url().includes(urlSubstr) && resp.request().method() === method, { timeout: 20000 })
}

async function userRow(page: Page, email: string) {
  return page.locator('tr', { hasText: email })
}

// ── Fixtures: a test user + a test role to assign it ───────────────────────────

async function addUser(page: Page, opts: { name: string; email: string }) {
  await stashToken(page)
  await page.goto('/users')
  await page.getByRole('button', { name: '+ Add User', exact: true }).click()
  await page.getByPlaceholder('John Doe').fill(opts.name)
  await page.getByPlaceholder('john@example.com').fill(opts.email)
  await page.getByPlaceholder('Enter password').fill('TestPass@123')
  await page.getByPlaceholder('Confirm password').fill('TestPass@123')
  await page.locator('select:has(option:text-is("Select role…"))').selectOption('LEARNER')
  const respPromise = waitForApi(page, '/users', 'POST')
  await page.getByRole('button', { name: '+ Add User', exact: true }).last().click()
  const resp = await respPromise
  expect(resp.ok()).toBeTruthy()
  const userId = ((await resp.json()) as { user?: { id?: string } }).user?.id
  if (userId) createdUserIds.push(userId)
  await expect(page.getByText('User created successfully')).toBeVisible({ timeout: 10000 })
}

async function createRole(page: Page, name: string) {
  await stashToken(page)
  await page.goto('/roles-permissions')
  await page.getByRole('button', { name: 'LMS Roles', exact: true }).click()
  await page.getByRole('button', { name: 'Create Role', exact: true }).click()
  await page.getByPlaceholder('e.g. Content Manager').fill(name)
  const respPromise = waitForApi(page, '/roles', 'POST')
  await page.getByRole('button', { name: 'Create Role', exact: true }).last().click()
  const resp = await respPromise
  expect(resp.ok()).toBeTruthy()
  const roleId = ((await resp.json()) as { data?: { id?: string } }).data?.id
  if (roleId) createdRoleIds.push(roleId)
  await expect(page.getByText('Role created successfully')).toBeVisible({ timeout: 10000 })
}

interface AssignOpts {
  email:      string
  roleName:   string
  type?:      'Secondary' | 'Temporary' | 'Emergency'
  expiresAt?: string
}

async function assignRole(page: Page, opts: AssignOpts) {
  await gotoAssignments(page)
  await page.getByRole('button', { name: 'Manage Assignments', exact: true }).click()
  const modal = modalScope(page, 'Assign Role')

  await modal.getByPlaceholder('Search by name or email…').fill(opts.email)
  await expect(modal.getByText(opts.email)).toBeVisible({ timeout: 10000 })
  await modal.getByText(opts.email).click()

  const roleSelect = modal.locator('select:has(option:text-is("Select role…"))')
  await expect(roleSelect).toBeEnabled({ timeout: 10000 })
  await roleSelect.selectOption({ label: opts.roleName })

  if (opts.type) {
    await modal.getByText(opts.type, { exact: true }).click()
  }
  if (opts.expiresAt) {
    await modal.locator('input[type="date"]').fill(opts.expiresAt)
  }

  const respPromise = waitForApi(page, '/user-role-assignments', 'POST')
  await modal.getByRole('button', { name: 'Assign Role', exact: true }).click()
  const resp = await respPromise
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText(/Role assigned to/)).toBeVisible({ timeout: 10000 })
}

// ── 1) Stats ──────────────────────────────────────────────────────────────────

test('User Role Assignments stats → verify all 4 cards render with numbers', async ({ page }) => {
  await gotoAssignments(page)
  for (const label of ['Total Users with Roles', 'Users with Multiple Roles', 'Temporary Role Assignments', 'Expired Role Assignments']) {
    const card = page.getByText(label, { exact: true }).locator('xpath=..')
    await expect(card).toContainText(/\d/, { timeout: 15000 })
  }
})

// ── 2/3/5) Create → Edit → Remove ────────────────────────────────────────────

test.describe.serial('Assignment CRUD', () => {
  const userName = `Assignee ${uid()}`
  const email     = `assignee.${uid()}@mindnavy.com`
  const roleName  = `AssignRole ${uid()}`

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'tests/setup/.auth.json' })
    await addUser(page, { name: userName, email })
    await createRole(page, roleName)
    await page.close()
  })

  test('Create assignment → appears in table with correct role badge', async ({ page }) => {
    await assignRole(page, { email, roleName })
    const row = await userRow(page, email)
    await expect(row).toBeVisible()
    await expect(row).toContainText(roleName)
    await expect(row).toContainText('PRIMARY')
    await expect(row).toContainText('Active')
  })

  test('Edit assignment type → badge updates', async ({ page }) => {
    await gotoAssignments(page)
    const row = await userRow(page, email)
    await row.getByRole('button', { name: 'Edit assignment' }).click()

    const modal = modalScope(page, 'Edit Assignment')
    await modal.getByText('Secondary', { exact: true }).click()

    const respPromise = waitForApi(page, '/user-role-assignments', 'PATCH')
    await modal.getByRole('button', { name: 'Save Changes', exact: true }).click()
    const resp = await respPromise
    expect(resp.ok()).toBeTruthy()
    await expect(page.getByText('Assignment updated successfully')).toBeVisible({ timeout: 10000 })

    const rowAfter = await userRow(page, email)
    await expect(rowAfter).toContainText('SECONDARY')
  })

  test('Remove assignment → row removed', async ({ page }) => {
    await gotoAssignments(page)
    const row = await userRow(page, email)

    page.once('dialog', dialog => dialog.accept())
    const respPromise = waitForApi(page, '/user-role-assignments', 'DELETE')
    await row.getByRole('button', { name: 'Remove assignment' }).click()
    const resp = await respPromise
    expect(resp.ok()).toBeTruthy()
    await expect(page.getByText('Assignment removed')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: email })).not.toBeVisible({ timeout: 10000 })
  })
})

// ── 4) Temporary assignment expiry ───────────────────────────────────────────

test('Temporary assignment → expiry date shown in table', async ({ page }) => {
  const userName = `TempAssignee ${uid()}`
  const email     = `tempassignee.${uid()}@mindnavy.com`
  const roleName  = `TempAssignRole ${uid()}`
  const expiresAt = futureDateStr(7)

  await addUser(page, { name: userName, email })
  await createRole(page, roleName)
  await assignRole(page, { email, roleName, type: 'Temporary', expiresAt })

  const row = await userRow(page, email)
  await expect(row).toBeVisible()
  await expect(row).toContainText('TEMPORARY')
  const expectedLabel = new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  await expect(row).toContainText(expectedLabel)
})
