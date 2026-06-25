import { test, expect, type Page } from '@playwright/test'

function uid() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`
}

async function gotoRoles(page: Page) {
  await page.goto('/roles-permissions')
  await page.getByRole('button', { name: 'LMS Roles', exact: true }).click()
}

// Scope to rows that have row-action buttons, excluding the Permission Matrix
// Preview sidebar table (which can also contain the role's name as a column header).
function roleRow(page: Page, name: string) {
  return page.locator('tr:has(button[title="Edit role"])', { hasText: name })
}

// Modals in this codebase render as a `position: fixed; inset: 0` overlay root.
// Scoping to that root avoids matching unrelated checkboxes elsewhere on the page.
// Closed modals from earlier tests stay mounted (hidden) in the DOM, so we
// require `:visible` too — otherwise `.last()` can pick a stale instance.
function modalScope(page: Page, anchorText: string) {
  return page.locator('[style*="position: fixed"]:visible').filter({ hasText: anchorText }).last()
}

async function createRole(page: Page, name: string, opts?: { checkPermission?: string }) {
  await gotoRoles(page)
  await page.getByRole('button', { name: 'Create Role', exact: true }).click()
  await page.getByPlaceholder('e.g. Content Manager').fill(name)
  if (opts?.checkPermission) {
    const modal = modalScope(page, 'Create Role')
    await modal.locator('div, label').filter({ hasText: opts.checkPermission }).last().locator('input[type="checkbox"]').check()
  }
  await page.getByRole('button', { name: 'Create Role', exact: true }).last().click()
  await expect(page.getByText('Role created successfully')).toBeVisible({ timeout: 10000 })
}

test.describe.serial('Role CRUD', () => {
  const name = `Role ${uid()}`

  test('Create Role → verify appears in table', async ({ page }) => {
    await createRole(page, name)
    await expect(roleRow(page, name)).toBeVisible()
  })

  test('Edit Role → verify changes saved', async ({ page }) => {
    await gotoRoles(page)
    const row = roleRow(page, name)
    await row.locator('button[title="Edit role"]').click()
    const newDesc = `Edited description ${uid()}`
    await page.getByPlaceholder('What this role can do…').fill(newDesc)
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
    await expect(page.getByText('Role updated successfully')).toBeVisible({ timeout: 10000 })
  })

  test('Delete Role without users → verify removed', async ({ page }) => {
    await gotoRoles(page)
    const row = roleRow(page, name)
    page.once('dialog', dialog => dialog.accept())
    await row.locator('button[title="Delete"]').click()
    await expect(page.getByText(/deleted successfully/i)).toBeVisible({ timeout: 10000 })
    await expect(roleRow(page, name)).not.toBeVisible()
  })
})

test('Delete Role with users → verify error shown', async ({ page }) => {
  const roleName = `RoleWithUsers ${uid()}`
  const userEmail = `roleuser.${uid()}@mindnavy.com`
  const userName = `Role User ${uid()}`

  await createRole(page, roleName)

  // Create a user via Users tab so we have someone to assign
  await page.goto('/users')
  await page.getByRole('button', { name: '+ Add User', exact: true }).click()
  await page.getByPlaceholder('John Doe').fill(userName)
  await page.getByPlaceholder('john@example.com').fill(userEmail)
  await page.getByPlaceholder('Enter password').fill('TestPass@123')
  await page.getByPlaceholder('Confirm password').fill('TestPass@123')
  await page.locator('select:has(option:text-is("Select role…"))').selectOption('LEARNER')
  await page.getByRole('button', { name: '+ Add User', exact: true }).last().click()
  await expect(page.getByText('User created successfully')).toBeVisible({ timeout: 10000 })

  // Open the role, assign the user to it
  await gotoRoles(page)
  const row = roleRow(page, roleName)
  await row.locator('button[title="View details"]').click()
  await page.getByRole('button', { name: '👥 Assign Users' }).click()
  await page.getByPlaceholder('Search for a user to assign…').fill(userEmail)
  // Anchor on the placeholder text itself (unique to this modal) rather than
  // the "Assign Users" heading, which also matches the trigger button.
  const assignModal = modalScope(page, 'Search for a user to assign…')
  // Search is server-side and debounced (300ms) — wait for the result row.
  await assignModal.getByText(userEmail).waitFor({ timeout: 10000 })
  await assignModal.locator('div').filter({ hasText: userEmail, has: page.locator('input[type="checkbox"]') }).last().locator('input[type="checkbox"]').check()
  await assignModal.getByRole('button', { name: /Assign \d+ User/ }).click()
  await expect(page.getByText(/assigned to/i)).toBeVisible({ timeout: 10000 })

  // Attempt delete — expect ROLE_HAS_USERS error, not removal
  await gotoRoles(page)
  const roleRowAfter = roleRow(page, roleName)
  page.once('dialog', dialog => dialog.accept())
  await roleRowAfter.locator('button[title="Delete"]').click()
  await expect(page.getByText(/Cannot delete.*users assigned/i)).toBeVisible({ timeout: 10000 })
  await expect(roleRow(page, roleName)).toBeVisible()
})

test('Duplicate Role → verify copy created', async ({ page }) => {
  const name = `DupRole ${uid()}`
  await createRole(page, name)
  await gotoRoles(page)
  const row = roleRow(page, name)
  await row.locator('button[title="Duplicate"]').click()
  await expect(page.getByText(/Role duplicated as/i)).toBeVisible({ timeout: 10000 })
})

test.skip('Add Permission → verify appears in list', () => {
  // No standalone Permission CRUD UI exists — permissions are fixed/seeded.
  // Confirmed by reading RolesPermissionsStandalonePage.tsx and rolesPermissionsPage/*:
  // permissions are only manageable via CreateRoleModal checkboxes or the Permission Matrix toggle.
})

test.skip('Edit Permission → verify changes saved', () => {
  // Same as above — no Edit Permission UI exists.
})

test.skip('Delete Permission → verify removed', () => {
  // Same as above — no Delete Permission UI exists.
})

test('Assign Permission to Role → verify checkbox checked', async ({ page }) => {
  const name = `PermRole ${uid()}`
  await createRole(page, name, { checkPermission: 'View Users' })
  await gotoRoles(page)
  const row = roleRow(page, name)
  await row.locator('button[title="Edit role"]').click()
  const modal = modalScope(page, 'Edit Role')
  const checkbox = modal.locator('div, label').filter({ hasText: 'View Users' }).last().locator('input[type="checkbox"]')
  await expect(checkbox).toBeChecked()
})

test('Permission Matrix → verify loads', async ({ page }) => {
  await page.goto('/roles-permissions')
  await page.getByRole('button', { name: 'Permission Matrix', exact: true }).click()
  await expect(page.getByText(/roles · \d+ permissions · \d+ assignments/i)).toBeVisible({ timeout: 15000 })
})

test('Toggle Permission Matrix cell → verify updates', async ({ page }) => {
  const name = `MatrixRole ${uid()}`
  await createRole(page, name)
  await page.goto('/roles-permissions')
  await page.getByRole('button', { name: 'Permission Matrix', exact: true }).click()
  await page.getByPlaceholder('Search roles or permissions...').fill(name)
  await page.waitForTimeout(600)

  const cell = page.locator(`[title^="${name}:"]`).first()
  await expect(cell).toBeVisible({ timeout: 10000 })
  const titleBefore = await cell.getAttribute('title')

  const togglePromise = page.waitForResponse(resp => resp.url().includes('/permission-matrix/toggle'))
  await cell.click()
  await togglePromise
  await page.waitForTimeout(500)

  const titleAfter = await cell.getAttribute('title')
  expect(titleAfter).not.toEqual(titleBefore)
})
