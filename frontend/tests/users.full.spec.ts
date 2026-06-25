import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function uid() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`
}

async function gotoUsersTab(page: Page, tabText: string) {
  await page.goto('/users')
  await page.getByRole('button', { name: tabText }).click()
}

async function addUser(page: Page, opts: { name: string; email: string }) {
  await page.goto('/users')
  await page.getByRole('button', { name: '+ Add User', exact: true }).click()
  await page.getByPlaceholder('John Doe').fill(opts.name)
  await page.getByPlaceholder('john@example.com').fill(opts.email)
  await page.getByPlaceholder('Enter password').fill('TestPass@123')
  await page.getByPlaceholder('Confirm password').fill('TestPass@123')
  await page.locator('select:has(option:text-is("Select role…"))').selectOption('LEARNER')
  await page.getByRole('button', { name: '+ Add User', exact: true }).last().click()
  await expect(page.getByText('User created successfully')).toBeVisible({ timeout: 10000 })
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
    await page.locator('select:has(option:text-is("All Status"))').selectOption('active')
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
  // Scope to the small VISIBLE panel containing the Primary/Secondary/Temporary
  // type buttons — closed modals from earlier tests stay mounted (hidden) in
  // the DOM, so `.last()` alone can pick a stale, zero-option instance.
  const modal = page.locator('div:visible').filter({ has: page.getByRole('button', { name: 'Temporary', exact: true }) }).last()
  const roleSelect = modal.locator('select')
  await expect(async () => {
    expect(await roleSelect.locator('option').count()).toBeGreaterThan(1)
  }).toPass({ timeout: 10000 })
  await roleSelect.selectOption({ index: 1 })
  await modal.getByRole('button', { name: 'Primary', exact: true }).click()
  await modal.getByRole('button', { name: 'Assign Role', exact: true }).click()
  await expect(roleSelect).not.toBeVisible({ timeout: 10000 })
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
  const a = `import.${uid()}@mindnavy.com`
  const csvPath = path.join(__dirname, `import-${uid()}.csv`)
  fs.writeFileSync(csvPath, `fullName,email,password,role\nImport User ${uid()},${a},TestPass@123,LEARNER\n`)

  await page.goto('/users')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page.locator('input[type="file"]').setInputFiles(csvPath)
  await expect(page.getByText(/data row/i)).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Import Users' }).click()
  await expect(page.getByText(/Imported \d+ users? successfully/i)).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Done' }).click()
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
  for (let i = 0; i < 2; i++) {
    const email = `bulksuspend${i}.${uid()}@mindnavy.com`
    await addUser(page, { name: `Bulk Suspend ${i} ${uid()}`, email })
    emails.push(email)
  }
  await page.goto('/users')
  for (const email of emails) {
    const row = await findUserRow(page, email)
    await row.locator('input[type="checkbox"]').check()
  }
  await page.getByRole('button', { name: 'Bulk Actions' }).click()
  await page.getByRole('button', { name: 'Suspend All' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await page.waitForTimeout(1500)
  await gotoUsersTab(page, 'Suspended')
  for (const email of emails) {
    await expect(page.locator('tr', { hasText: email })).toBeVisible({ timeout: 10000 })
  }
})

test('Bulk Assign Role → verify multiple users updated', async ({ page }) => {
  const emails: string[] = []
  for (let i = 0; i < 2; i++) {
    const email = `bulkrole${i}.${uid()}@mindnavy.com`
    await addUser(page, { name: `Bulk Role ${i} ${uid()}`, email })
    emails.push(email)
  }
  await page.goto('/users')
  for (const email of emails) {
    const row = await findUserRow(page, email)
    await row.locator('input[type="checkbox"]').check()
  }
  await page.getByRole('button', { name: 'Bulk Actions' }).click()
  await page.getByRole('button', { name: 'Assign Role' }).click()
  // Scope to the VISIBLE panel containing the Apply button — closed panels
  // from earlier tests stay mounted (hidden) in the DOM.
  const panel = page.locator('div:visible').filter({ has: page.getByRole('button', { name: 'Apply', exact: true }) }).last()
  const roleSelect = panel.locator('select')
  await expect(async () => {
    expect(await roleSelect.locator('option').count()).toBeGreaterThan(1)
  }).toPass({ timeout: 10000 })
  const options = await roleSelect.locator('option').allTextContents()
  const targetIndex = options.findIndex(o => o.trim() && !/learner|select/i.test(o))
  await roleSelect.selectOption({ index: targetIndex >= 0 ? targetIndex : 1 })
  await panel.getByRole('button', { name: 'Apply', exact: true }).click()
  await page.waitForTimeout(1500)
  await page.goto('/users')
  for (const email of emails) {
    await expect(page.locator('tr', { hasText: email })).not.toContainText('learner', { timeout: 10000 })
  }
})
