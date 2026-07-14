import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function uid() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`
}

// ── Cleanup state (option c: self-cleaning tests) ─────────────────────────────
const createdUserIds: string[] = []
const createdUserEmails: string[] = []  // for CSV-imported users (IDs resolved in afterAll)
let savedToken: string | null = null

async function stashToken(page: Page) {
  if (!savedToken) {
    savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  }
}

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }

  // Resolve emails → IDs for CSV-imported users (importUsers returns no IDs).
  for (const email of createdUserEmails) {
    const resp = await request.get(
      `http://localhost:5001/api/admin/users?search=${encodeURIComponent(email)}`,
      { headers: H },
    ).catch(() => null)
    if (resp?.ok()) {
      const body = await resp.json().catch(() => null) as { data?: { users?: { id: string }[] } } | null
      const id = body?.data?.users?.[0]?.id
      if (id) createdUserIds.push(id)
    }
  }

  // Archive then permanently delete each user. Both calls are best-effort —
  // if rate-limited, the backstop cleanup:test-data script handles the rest.
  for (const id of createdUserIds) {
    await request.delete(
      `http://localhost:5001/api/admin/users/${id}`,
      { headers: H },
    ).catch(() => null)
    await request.delete(
      `http://localhost:5001/api/admin/users/${id}/permanent`,
      { headers: H },
    ).catch(() => null)
  }
})

async function gotoUsersTab(page: Page, tabText: string) {
  await page.goto('/users')
  await page.getByRole('button', { name: tabText }).click()
}

async function addUser(page: Page, opts: { name: string; email: string }) {
  await stashToken(page)
  await page.goto('/users')
  await page.getByRole('button', { name: '+ Add User', exact: true }).click()
  await page.getByPlaceholder('John Doe').fill(opts.name)
  await page.getByPlaceholder('john@example.com').fill(opts.email)
  await page.getByPlaceholder('Enter password').fill('TestPass@123')
  await page.getByPlaceholder('Confirm password').fill('TestPass@123')
  await page.locator('select:has(option:text-is("Select role…"))').selectOption('LEARNER')
  const respPromise = page.waitForResponse(resp => resp.url().includes('/users') && resp.request().method() === 'POST', { timeout: 20000 })
  await page.getByRole('button', { name: '+ Add User', exact: true }).last().click()
  const resp = await respPromise
  if (resp.status() === 429) {
    throw new Error(
      `addUser() was rate-limited (429) creating ${opts.email}. adminUserActionRateLimiter ` +
      `allows 60 writes/10min shared across every users.routes.js write endpoint — this usually ` +
      `means the suite was re-run multiple times within the same 10-minute window and the budget ` +
      `is exhausted, not an app bug. Wait for the window to reset, or seed bulk fixtures via CSV ` +
      `import (see importUsersCsv) instead of repeated addUser() calls.`
    )
  }
  expect(resp.ok()).toBeTruthy()
  const userId = ((await resp.json()) as { user?: { id?: string } }).user?.id
  if (userId) createdUserIds.push(userId)
  await expect(page.getByText('User created successfully')).toBeVisible({ timeout: 10000 })
}

// Seeds multiple users via CSV import in a single request, instead of N
// addUser() calls. Import goes through adminUsersImportRateLimiter (5/10min)
// — a separate budget from adminUserActionRateLimiter (60/10min, shared by
// every other write in this file: create/edit/suspend/archive/restore/etc).
// Bulk tests run last in the file and need 2 fixture users each; seeding
// them this way means they don't draw down the same shared budget that
// earlier tests (and earlier re-runs within the same window) have already
// been consuming.
async function importUsersCsv(page: Page, users: { name: string; email: string }[]) {
  await stashToken(page)
  const csvPath = path.join(__dirname, `bulk-import-${uid()}.csv`)
  const rows = users.map(u => `${u.name},${u.email},TestPass@123,LEARNER`).join('\n')
  fs.writeFileSync(csvPath, `fullName,email,password,role\n${rows}\n`)

  await page.goto('/users')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page.locator('input[type="file"]').setInputFiles(csvPath)
  await expect(page.getByText(/data row/i)).toBeVisible({ timeout: 10000 })
  const respPromise = page.waitForResponse(resp => resp.url().includes('/import') && resp.request().method() === 'POST', { timeout: 20000 })
  await page.getByRole('button', { name: 'Import Users' }).click()
  const resp = await respPromise
  if (resp.status() === 429) {
    throw new Error('importUsersCsv() was rate-limited (429) — adminUsersImportRateLimiter allows 5 imports/10min.')
  }
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText(/Imported \d+ users? successfully/i)).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Done' }).click()

  // Track emails for afterAll cleanup (IDs resolved via search, since importUsers returns no IDs).
  for (const u of users) createdUserEmails.push(u.email)
  fs.unlinkSync(csvPath)
}

async function findUserRow(page: Page, email: string) {
  return page.locator('tr', { hasText: email })
}

async function openDrawerFor(page: Page, email: string) {
  const row = await findUserRow(page, email)
  await row.locator('button[title="View"]').click()
}

test.describe.serial('Add / Edit / Search / Filter', () => {
  const name = `Test User ${uid()}`
  const email = `test.${uid()}@mindnavy.com`

  test('Add User → verify appears in table', async ({ page }) => {
    await addUser(page, { name, email })
    await page.goto('/users')
    await expect(page.locator('tr', { hasText: email })).toBeVisible()
  })

  test('Edit User → verify changes saved', async ({ page }) => {
    await page.goto('/users')
    const row = await findUserRow(page, email)
    await row.locator('button[title="Edit"]').click()
    const newName = `${name} Edited`
    const fullNameInput = page.getByPlaceholder('Full name')
    await fullNameInput.fill(newName)
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText('User updated successfully')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: email })).toContainText(newName)
  })

  test('Search User → verify filtered results', async ({ page }) => {
    await page.goto('/users')
    await page.getByPlaceholder('Search users...').fill(name)
    await page.waitForTimeout(600)
    await expect(page.locator('tr', { hasText: email })).toBeVisible()
    const rowCount = await page.locator('tbody tr').count()
    expect(rowCount).toBeGreaterThan(0)
  })

  test('Filter by Role → verify correct users shown', async ({ page }) => {
    await page.goto('/users')
    await page.locator('select:has(option:text-is("All Roles"))').selectOption('LEARNER')
    await page.waitForTimeout(600)
    const rows = page.locator('tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText(/learner/i)
    }
  })

  test('Filter by Status → verify correct users shown', async ({ page }) => {
    await page.goto('/users')
    // AddUserModal has no status field — every UI-created user gets the
    // backend default of PENDING (see users.service.js createUser), never
    // "active". Filtering by "active" would correctly exclude this user;
    // filter by the status it actually has.
    const respPromise = page.waitForResponse(resp => resp.url().includes('/users') && resp.request().method() === 'GET', { timeout: 20000 })
    await page.locator('select:has(option:text-is("All Status"))').selectOption('pending')
    await respPromise
    await expect(page.locator('tr', { hasText: email })).toBeVisible({ timeout: 10000 })
  })
})

test('Suspend User → verify moves to Suspended tab', async ({ page }) => {
  const name = `Suspend User ${uid()}`
  const email = `suspend.${uid()}@mindnavy.com`
  await addUser(page, { name, email })
  await page.goto('/users')
  await openDrawerFor(page, email)
  await page.getByRole('button', { name: 'Suspend User' }).click()
  await page.getByPlaceholder('Enter reason for suspension…').fill('E2E test suspension')
  await page.getByRole('button', { name: 'Confirm Suspend' }).click()
  await expect(page.getByPlaceholder('Enter reason for suspension…')).not.toBeVisible({ timeout: 10000 })
  await page.keyboard.press('Escape')
  await gotoUsersTab(page, 'Suspended')
  await expect(page.locator('tr', { hasText: email })).toBeVisible()
})

test.describe.serial('Archive / Restore', () => {
  const name = `Archive User ${uid()}`
  const email = `archive.${uid()}@mindnavy.com`

  test('Archive User → verify moves to Archived tab', async ({ page }) => {
    await addUser(page, { name, email })
    await page.goto('/users')
    const row = await findUserRow(page, email)
    await row.locator('button[title="More"]').click()
    await page.getByRole('button', { name: 'Delete User' }).click()
    await page.getByPlaceholder(email).fill(email)
    await page.getByRole('button', { name: 'Archive User' }).click()
    await gotoUsersTab(page, 'Archived')
    await expect(page.locator('tr', { hasText: email })).toBeVisible({ timeout: 10000 })
  })

  test('Restore Archived User → verify back in Users tab', async ({ page }) => {
    await gotoUsersTab(page, 'Archived')
    const row = await findUserRow(page, email)
    await row.getByRole('button', { name: '↩ Restore' }).click()
    await row.getByRole('button', { name: 'Confirm' }).click()
    await expect(page.locator('tr', { hasText: email })).not.toBeVisible({ timeout: 10000 })
    await page.goto('/users')
    await expect(page.locator('tr', { hasText: email })).toBeVisible()
  })
})

test('Approve Pending Verification → verify status changes', async ({ page }) => {
  const name = `Approve User ${uid()}`
  const email = `approve.${uid()}@mindnavy.com`
  await addUser(page, { name, email })
  await gotoUsersTab(page, 'Pending Verification')
  const row = await findUserRow(page, email)
  await row.getByRole('button', { name: '✓ Approve' }).click()
  await row.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.locator('tr', { hasText: email })).not.toBeVisible({ timeout: 10000 })
  await page.goto('/users')
  await page.locator('select:has(option:text-is("All Status"))').selectOption('active')
  await page.waitForTimeout(500)
  await expect(page.locator('tr', { hasText: email })).toBeVisible()
})

test('Reject Pending Verification → verify status changes', async ({ page }) => {
  const name = `Reject User ${uid()}`
  const email = `reject.${uid()}@mindnavy.com`
  await addUser(page, { name, email })
  await gotoUsersTab(page, 'Pending Verification')
  const row = await findUserRow(page, email)
  await row.getByRole('button', { name: 'Reject' }).click()
  await row.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.locator('tr', { hasText: email })).not.toBeVisible({ timeout: 10000 })
})

test('Assign Role to User → verify role updated', async ({ page }) => {
  const name = `AssignRole User ${uid()}`
  const email = `assignrole.${uid()}@mindnavy.com`
  await addUser(page, { name, email })
  await page.goto('/users')
  await openDrawerFor(page, email)
  await page.getByRole('button', { name: 'Assign Role' }).click()
  // AssignRoleModal renders as a `position: fixed; inset: 0` overlay (same as
  // UserDetailsDrawer's own root, so anchor on "Type" — unique to this modal's
  // content — rather than "has a Temporary button", which previously matched
  // the Type field's own narrow <div> instead of the modal that contains both
  // the Type field AND the Role <select> as siblings).
  const modal = page.locator('[style*="position: fixed"]:visible').filter({ hasText: 'Type *' }).last()
  const roleSelect = modal.locator('select')
  await expect(async () => {
    expect(await roleSelect.locator('option').count()).toBeGreaterThan(1)
  }).toPass({ timeout: 20000 })
  // Must pick one of the 4 system roles (Learner/Instructor/Manager/
  // Administrator) — the backend's PATCH /users/:id/role only accepts role
  // names that map to its AppUserRole enum (see users.service.js
  // roleNameToAppEnum). Any custom role (e.g. "MatrixRole 123...") 400s with
  // "has no matching system role", so an arbitrary index is unsafe once the
  // dropdown accumulates custom roles from other tests.
  await roleSelect.selectOption({ label: 'Instructor' })
  await modal.getByRole('button', { name: 'Primary', exact: true }).click()
  await modal.getByRole('button', { name: 'Assign Role', exact: true }).click()
  // AssignRoleModal shows a toast on success and closes via onSuccess() — the
  // toast is the documented, guaranteed signal (close timing isn't).
  await expect(page.getByText(/role assigned/i)).toBeVisible({ timeout: 15000 })
})

test('Send Message to User → verify success toast', async ({ page }) => {
  const name = `Message User ${uid()}`
  const email = `message.${uid()}@mindnavy.com`
  await addUser(page, { name, email })
  await page.goto('/users')
  await openDrawerFor(page, email)
  await page.getByRole('button', { name: 'Send Message' }).click()
  await page.getByPlaceholder('Enter message subject…').fill('E2E test subject')
  await page.getByPlaceholder('Write your message here (min. 10 characters)…').fill('This is an automated E2E test message body.')
  await page.getByRole('button', { name: '✉ Send Message' }).click()
  await expect(page.getByText('Message sent successfully')).toBeVisible({ timeout: 10000 })
})

test('Force Logout User → verify sessions = 0', async ({ page }) => {
  const name = `Logout User ${uid()}`
  const email = `logout.${uid()}@mindnavy.com`
  await addUser(page, { name, email })
  await page.goto('/users')
  await openDrawerFor(page, email)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Force Logout' }).click()
  await expect(page.getByText('User logged out of all sessions successfully')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Active Sessions')).toBeVisible()
  await expect(page.locator('text=Active Sessions').locator('xpath=..').getByText('0')).toBeVisible()
})

test('Import Users CSV → verify users added', async ({ page }) => {
  await stashToken(page)
  const a = `import.${uid()}@mindnavy.com`
  const csvPath = path.join(__dirname, `import-${uid()}.csv`)
  fs.writeFileSync(csvPath, `fullName,email,password,role\nImport User ${uid()},${a},TestPass@123,LEARNER\n`)

  await page.goto('/users')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page.locator('input[type="file"]').setInputFiles(csvPath)
  await expect(page.getByText(/data row/i)).toBeVisible({ timeout: 10000 })
  const respPromise = page.waitForResponse(resp => resp.url().includes('/import') && resp.request().method() === 'POST', { timeout: 20000 })
  await page.getByRole('button', { name: 'Import Users' }).click()
  await respPromise
  await expect(page.getByText(/Imported \d+ users? successfully/i)).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Done' }).click()
  createdUserEmails.push(a)
  await page.goto('/users')
  await page.getByPlaceholder('Search users...').fill(a)
  await page.waitForTimeout(600)
  await expect(page.locator('tr', { hasText: a })).toBeVisible()

  fs.unlinkSync(csvPath)
})

test('Export Users → verify file downloads', async ({ page }) => {
  await page.goto('/users')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Download/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBeTruthy()
})

test('Bulk Suspend → verify multiple users suspended', async ({ page }) => {
  const emails: string[] = []
  const fixtures: { name: string; email: string }[] = []
  for (let i = 0; i < 2; i++) {
    const email = `bulksuspend${i}.${uid()}@mindnavy.com`
    fixtures.push({ name: `Bulk Suspend ${i} ${uid()}`, email })
    emails.push(email)
  }
  await importUsersCsv(page, fixtures)
  await page.goto('/users')
  for (const email of emails) {
    const row = await findUserRow(page, email)
    await row.locator('input[type="checkbox"]').check()
  }
  await page.getByRole('button', { name: 'Bulk Actions' }).click()
  await page.getByRole('button', { name: 'Suspend All' }).click()
  const suspendPromise = page.waitForResponse(resp => resp.url().includes('/bulk-action') && resp.request().method() === 'POST', { timeout: 20000 })
  await page.getByRole('button', { name: 'Confirm' }).click()
  const suspendResp = await suspendPromise
  expect(suspendResp.ok()).toBeTruthy()
  const suspendBody = await suspendResp.json()
  expect(suspendBody.succeeded).toBe(2)
  await page.waitForTimeout(1500)
  await gotoUsersTab(page, 'Suspended')
  for (const email of emails) {
    await expect(page.locator('tr', { hasText: email })).toBeVisible({ timeout: 10000 })
  }
})

test('Bulk Assign Role → verify multiple users updated', async ({ page }) => {
  const emails: string[] = []
  const fixtures: { name: string; email: string }[] = []
  for (let i = 0; i < 2; i++) {
    const email = `bulkrole${i}.${uid()}@mindnavy.com`
    fixtures.push({ name: `Bulk Role ${i} ${uid()}`, email })
    emails.push(email)
  }
  await importUsersCsv(page, fixtures)
  await page.goto('/users')
  for (const email of emails) {
    const row = await findUserRow(page, email)
    await row.locator('input[type="checkbox"]').check()
  }
  await page.getByRole('button', { name: 'Bulk Actions' }).click()
  await page.getByRole('button', { name: 'Assign Role' }).click()
  // BulkActionsMenu's panel is `position: absolute` (not `fixed`), so there's
  // no cheap way to exclude nested divs by style. "Assign role to N user(s)"
  // is its own text-only <div>, a sibling of the <select> — not an ancestor —
  // so requiring `has: select` is needed to land on the actual containing panel.
  const panel = page.locator('div:visible').filter({ hasText: 'Assign role to', has: page.locator('select') }).last()
  const roleSelect = panel.locator('select')
  await expect(async () => {
    expect(await roleSelect.locator('option').count()).toBeGreaterThan(1)
  }).toPass({ timeout: 20000 })
  // Must pick one of the 4 system roles — same backend constraint as
  // AssignRoleModal (see users.service.js bulkActionUsers' assign_role
  // branch). Picking any other option (custom test roles like "MatrixRole
  // 123...") 400s with "Invalid role", which is why this previously left the
  // row's role unchanged at "learner".
  await roleSelect.selectOption({ label: 'Instructor' })
  const roleValueAtClick = await roleSelect.inputValue()
  const applyPromise = page.waitForResponse(resp => resp.url().includes('/bulk-action') && resp.request().method() === 'POST')
  await panel.getByRole('button', { name: 'Apply', exact: true }).click()
  const applyResp = await applyPromise
  if (!applyResp.ok()) {
    const errorBody = await applyResp.json().catch(() => null)
    console.log('Bulk Assign Role failed:', {
      status: applyResp.status(),
      errorBody,
      roleSelectValueAtClick: roleValueAtClick,
      requestBodySent: applyResp.request().postData(),
    })
  }
  expect(applyResp.ok()).toBeTruthy()
  await page.goto('/users')
  for (const email of emails) {
    await expect(page.locator('tr', { hasText: email })).toContainText('instructor', { timeout: 10000 })
  }
})
