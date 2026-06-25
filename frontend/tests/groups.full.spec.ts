import { test, expect, type Page } from '@playwright/test'

function uid() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`
}

async function gotoGroups(page: Page) {
  await page.goto('/users')
  await page.getByRole('button', { name: 'Groups' }).click()
}

// Waits for the actual API response before checking the UI — confirmed via
// isolated runs that CreateGroupModal/EditGroupModal correctly call
// onSaved() → close the modal on success; the modal-closing race only shows
// up under full-suite backend load, not as an app defect.
function waitForApi(page: Page, urlSubstr: string, method: string) {
  return page.waitForResponse(resp => resp.url().includes(urlSubstr) && resp.request().method() === method, { timeout: 20000 })
}

async function addPlainUser(page: Page, name: string, email: string) {
  await page.goto('/users')
  await page.getByRole('button', { name: '+ Add User', exact: true }).click()
  await page.getByPlaceholder('John Doe').fill(name)
  await page.getByPlaceholder('john@example.com').fill(email)
  await page.getByPlaceholder('Enter password').fill('TestPass@123')
  await page.getByPlaceholder('Confirm password').fill('TestPass@123')
  await page.locator('select:has(option:text-is("Select role…"))').selectOption('LEARNER')
  await page.getByRole('button', { name: '+ Add User', exact: true }).last().click()
  await expect(page.getByText('User created successfully')).toBeVisible({ timeout: 10000 })
}

async function createGroup(page: Page, name: string) {
  await gotoGroups(page)
  await page.getByRole('button', { name: '+ Add Group', exact: true }).click()
  await page.getByPlaceholder('e.g. Development Team').fill(name)
  const respPromise = waitForApi(page, '/groups', 'POST')
  await page.getByRole('button', { name: 'Create Group', exact: true }).click()
  const resp = await respPromise
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByPlaceholder('e.g. Development Team')).not.toBeVisible({ timeout: 10000 })
}

function extractCount(text: string): number {
  // The row's own name contains a 13-digit timestamp (e.g. "MemberGroup
  // 1782346141182500") — a bare /(\d+)/ match grabs that instead of the
  // member-count badge. The count itself is always a short number, so match
  // a standalone 1–3 digit run instead.
  const m = text.match(/\b(\d{1,3})\b/)
  return m ? parseInt(m[1], 10) : -1
}

// Modals in this codebase render as a `position: fixed; inset: 0` overlay root.
// Closed modals from earlier tests stay mounted (hidden) in the DOM, so we
// require `:visible` too — otherwise `.last()` can pick a stale instance.
function modalScope(page: Page, anchorText: string) {
  return page.locator('[style*="position: fixed"]:visible').filter({ hasText: anchorText }).last()
}

test.describe.serial('Group CRUD', () => {
  const name = `Group ${uid()}`

  test('Create Group → verify appears in table', async ({ page }) => {
    await createGroup(page, name)
    await expect(page.locator('tr', { hasText: name })).toBeVisible()
  })

  test('Edit Group → verify changes saved', async ({ page }) => {
    await gotoGroups(page)
    const row = page.locator('tr', { hasText: name })
    await row.getByRole('button', { name: '✏️ Edit' }).click()
    const newDesc = `Edited group desc ${uid()}`
    await page.locator('textarea').fill(newDesc)
    const respPromise = waitForApi(page, '/groups', 'PATCH')
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
    const resp = await respPromise
    expect(resp.ok()).toBeTruthy()
    await expect(page.getByText('Save Changes')).not.toBeVisible({ timeout: 10000 })
  })

  test('Delete Group → verify removed', async ({ page }) => {
    await gotoGroups(page)
    const row = page.locator('tr', { hasText: name })
    await row.getByRole('button', { name: '🗑️ Delete' }).click()
    await expect(page.getByText('Delete Group?')).toBeVisible()
    const respPromise = waitForApi(page, '/groups', 'DELETE')
    await page.getByRole('button', { name: 'Yes, Delete', exact: true }).click()
    const resp = await respPromise
    expect(resp.ok()).toBeTruthy()
    await expect(page.locator('tr', { hasText: name })).not.toBeVisible({ timeout: 10000 })
  })
})

test.describe.serial('Group Members', () => {
  const groupName = `MemberGroup ${uid()}`
  const userName = `Group Member ${uid()}`
  const userEmail = `groupmember.${uid()}@mindnavy.com`
  let countBefore = -1

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'tests/setup/.auth.json' })
    await createGroup(page, groupName)
    await addPlainUser(page, userName, userEmail)
    await page.close()
  })

  test('Add Members to Group → verify member count increases', async ({ page }) => {
    await gotoGroups(page)
    const row = page.locator('tr', { hasText: groupName })
    countBefore = extractCount(await row.innerText())

    await row.getByRole('button', { name: '👤 Members' }).click()
    await page.getByRole('button', { name: 'Add Members', exact: true }).click()
    // Anchor on the "Add Members" tab label — a placeholder string isn't real
    // textContent, so `hasText` can't match it. The outer "👤 Members" trigger
    // button isn't `position: fixed`, so it's excluded by that requirement.
    const modal = modalScope(page, 'Add Members')
    await modal.getByPlaceholder('Search by name or email…').fill(userEmail)
    await page.waitForTimeout(500)
    // Search narrows to this one user, so the first checkbox is theirs.
    await modal.locator('input[type="checkbox"]').first().check()
    const respPromise = waitForApi(page, '/groups', 'POST')
    await modal.getByRole('button', { name: /Add \d+ Member/ }).click()
    const resp = await respPromise
    expect(resp.ok()).toBeTruthy()
    await page.keyboard.press('Escape')

    await gotoGroups(page)
    const rowAfter = page.locator('tr', { hasText: groupName })
    const countAfter = extractCount(await rowAfter.innerText())
    expect(countAfter).toBeGreaterThan(countBefore)
  })

  test('Remove Member from Group → verify count decreases', async ({ page }) => {
    await gotoGroups(page)
    const row = page.locator('tr', { hasText: groupName })
    const countBeforeRemove = extractCount(await row.innerText())

    await row.getByRole('button', { name: '👤 Members' }).click()
    const memberRow = page.locator('div')
      .filter({ hasText: userEmail, has: page.getByRole('button', { name: 'Remove', exact: true }) })
      .last()
    const respPromise = waitForApi(page, '/groups', 'DELETE')
    await memberRow.getByRole('button', { name: 'Remove', exact: true }).click()
    const resp = await respPromise
    expect(resp.ok()).toBeTruthy()
    await page.keyboard.press('Escape')

    await gotoGroups(page)
    const rowAfter = page.locator('tr', { hasText: groupName })
    const countAfter = extractCount(await rowAfter.innerText())
    expect(countAfter).toBeLessThan(countBeforeRemove)
  })
})

test('Search Groups → verify filtered results', async ({ page }) => {
  const name = `SearchGroup ${uid()}`
  await createGroup(page, name)

  await gotoGroups(page)
  await page.getByPlaceholder('Search groups…').fill(name)
  await page.waitForTimeout(500)
  await expect(page.locator('tr', { hasText: name })).toBeVisible()
  const rowCount = await page.locator('tbody tr').count()
  expect(rowCount).toBe(1)
})
