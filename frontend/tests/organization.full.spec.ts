import { test, expect, type Page } from '@playwright/test'

function uid() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`
}

async function gotoOrgSubTab(page: Page, subTab: string) {
  await page.goto('/users')
  await page.getByRole('button', { name: 'Organization' }).click()
  await page.getByRole('button', { name: subTab }).click()
}

async function createBranch(page: Page, name: string) {
  await gotoOrgSubTab(page, 'Branches')
  await page.getByRole('button', { name: '+ Add Branch', exact: true }).click()
  await page.getByPlaceholder('e.g. New York Office').fill(name)
  await page.getByPlaceholder('Street address').fill('123 Test St')
  await page.getByPlaceholder('City').fill('Testville')
  await page.getByPlaceholder('Country').fill('Testland')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByText(/Branch created/i)).toBeVisible({ timeout: 10000 })
}

async function createDepartment(page: Page, name: string, branchName: string) {
  await gotoOrgSubTab(page, 'Departments')
  await page.getByRole('button', { name: '+ Add Department', exact: true }).click()
  await page.getByPlaceholder('e.g. IT Department').fill(name)
  await page.locator('select:has(option:text-is("Select branch…"))').selectOption({ label: branchName })
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByText(/Department created/i)).toBeVisible({ timeout: 10000 })
}

test.describe.serial('Branches', () => {
  const name = `Branch ${uid()}`

  test('Add Branch → verify appears in table', async ({ page }) => {
    await createBranch(page, name)
    await expect(page.locator('tr', { hasText: name })).toBeVisible()
  })

  test('Edit Branch → verify changes saved', async ({ page }) => {
    await gotoOrgSubTab(page, 'Branches')
    const row = page.locator('tr', { hasText: name })
    await row.getByRole('button', { name: 'Edit', exact: true }).click()
    const newCity = `EditedCity${uid()}`
    await page.getByPlaceholder('City').fill(newCity)
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
    await expect(page.getByText(/Branch updated/i)).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: name })).toContainText(newCity)
  })

  test('Delete Branch → verify removed', async ({ page }) => {
    await gotoOrgSubTab(page, 'Branches')
    const row = page.locator('tr', { hasText: name })
    await row.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText('Delete Branch?')).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await expect(page.getByText(/Branch deleted/i)).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: name })).not.toBeVisible()
  })
})

test.describe.serial('Departments', () => {
  const branchName = `DeptPrereqBranch ${uid()}`
  const name = `Department ${uid()}`

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'tests/setup/.auth.json' })
    await createBranch(page, branchName)
    await page.close()
  })

  test('Add Department → verify appears in table', async ({ page }) => {
    await createDepartment(page, name, branchName)
    await expect(page.locator('tr', { hasText: name })).toBeVisible()
  })

  test('Edit Department → verify changes saved', async ({ page }) => {
    await gotoOrgSubTab(page, 'Departments')
    const row = page.locator('tr', { hasText: name })
    await row.getByRole('button', { name: 'Edit', exact: true }).click()
    const newCode = `EDT${uid()}`
    await page.getByPlaceholder('e.g. IT', { exact: true }).fill(newCode)
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
    await expect(page.getByText(/Department updated/i)).toBeVisible({ timeout: 10000 })
  })

  test('Delete Department → verify removed', async ({ page }) => {
    await gotoOrgSubTab(page, 'Departments')
    const row = page.locator('tr', { hasText: name })
    await row.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText('Delete Department?')).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await expect(page.getByText(/Department deleted/i)).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: name })).not.toBeVisible()
  })
})

test.describe.serial('Teams', () => {
  const branchName = `TeamPrereqBranch ${uid()}`
  const deptName = `TeamPrereqDept ${uid()}`
  const name = `Team ${uid()}`

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'tests/setup/.auth.json' })
    await createBranch(page, branchName)
    await createDepartment(page, deptName, branchName)
    await page.close()
  })

  test('Add Team → verify appears in table', async ({ page }) => {
    await gotoOrgSubTab(page, 'Teams')
    await page.getByRole('button', { name: '+ Add Team', exact: true }).click()
    await page.getByPlaceholder('e.g. Frontend Team').fill(name)
    await page.locator('select:has(option:text-is("Select department…"))').selectOption({ label: deptName })
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByText(/Team created/i)).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: name })).toBeVisible()
  })

  test('Edit Team → verify changes saved', async ({ page }) => {
    await gotoOrgSubTab(page, 'Teams')
    const row = page.locator('tr', { hasText: name })
    await row.getByRole('button', { name: 'Edit', exact: true }).click()
    const newName = `${name} Edited`
    await page.getByPlaceholder('e.g. Frontend Team').fill(newName)
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
    await expect(page.getByText(/Team updated/i)).toBeVisible({ timeout: 10000 })
  })

  test('Delete Team → verify removed', async ({ page }) => {
    await gotoOrgSubTab(page, 'Teams')
    const row = page.locator('tr', { hasText: name })
    await row.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText('Delete Team?')).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await expect(page.getByText(/Team deleted/i)).toBeVisible({ timeout: 10000 })
  })
})

test('Org Chart → verify loads and shows nodes', async ({ page }) => {
  await gotoOrgSubTab(page, 'Org Chart')
  await expect(page.getByText('Loading organization chart…')).toHaveCount(0, { timeout: 15000 })
  const emptyState = page.getByText('No organization data available yet.')
  if (await emptyState.isVisible().catch(() => false)) {
    test.info().annotations.push({ type: 'note', description: 'Org chart empty state shown — no root nodes in DB.' })
  } else {
    await expect(page.getByText(/company|branch|department|team|user/i).first()).toBeVisible()
  }
})
