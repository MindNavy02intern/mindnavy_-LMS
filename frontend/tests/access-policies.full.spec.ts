import { test, expect, type Page } from '@playwright/test'

function uid() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`
}

async function gotoAccessPolicies(page: Page) {
  await page.goto('/roles-permissions')
  await page.getByRole('button', { name: 'Access Policies', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=policies/)
}

// Modals in this codebase render as a `position: fixed; inset: 0` overlay root.
// The trigger button and the modal's heading/submit button often share the
// same text (e.g. "Create Policy" is both the toolbar button and the modal
// heading/submit button) — the trigger isn't `position: fixed`, so scoping
// here reliably isolates the modal. Closed modals from earlier tests stay
// mounted (hidden) in the DOM, so `:visible` is required too — otherwise
// `.last()` can pick a stale instance.
function modalScope(page: Page, anchorText: string) {
  return page.locator('[style*="position: fixed"]:visible').filter({ hasText: anchorText }).last()
}

function waitForApi(page: Page, urlSubstr: string, method: string) {
  return page.waitForResponse(resp => resp.url().includes(urlSubstr) && resp.request().method() === method, { timeout: 20000 })
}

async function policyRow(page: Page, name: string) {
  return page.locator('tr', { hasText: name })
}

interface CreatePolicyOpts {
  name: string
  resource?: string
  action?: string
  effect?: 'ALLOW' | 'DENY'
  status?: 'ACTIVE' | 'INACTIVE'
  priority?: number
}

async function createPolicy(page: Page, opts: CreatePolicyOpts) {
  await gotoAccessPolicies(page)
  await page.getByRole('button', { name: 'Create Policy', exact: true }).click()
  const modal = modalScope(page, 'Create Policy')

  await modal.getByPlaceholder('e.g. Restrict report exports').fill(opts.name)
  await modal.locator('select:has(option:text-is("Select resource…"))').selectOption(opts.resource ?? 'USERS')
  await modal.locator('select:has(option:text-is("Select action…"))').selectOption(opts.action ?? 'VIEW')

  if (opts.effect === 'DENY') {
    await modal.getByRole('button', { name: '❌ Deny', exact: true }).click()
  }
  if (opts.status === 'INACTIVE') {
    await modal.locator('select:has(option:text-is("Active"))').selectOption('INACTIVE')
  }
  if (opts.priority !== undefined) {
    await modal.locator('input[type="number"]').fill(String(opts.priority))
  }

  const respPromise = waitForApi(page, '/access-policies', 'POST')
  await modal.getByRole('button', { name: 'Create Policy', exact: true }).click()
  const resp = await respPromise
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText('Policy created successfully')).toBeVisible({ timeout: 10000 })
}

// ── 1) Stats ──────────────────────────────────────────────────────────────────

test('Access Policies stats → verify all 5 cards render with numbers', async ({ page }) => {
  await gotoAccessPolicies(page)
  for (const label of ['Total Policies', 'Active Policies', 'Inactive Policies', 'Allow Policies', 'Deny Policies']) {
    const card = page.getByText(label, { exact: true }).locator('xpath=..')
    await expect(card).toContainText(/\d/, { timeout: 15000 })
  }
})

// ── 2/3/4) Create → Edit → Delete ────────────────────────────────────────────

test.describe.serial('Access Policy CRUD', () => {
  const name = `Policy ${uid()}`

  test('Create Policy → verify appears in table', async ({ page }) => {
    await createPolicy(page, { name, resource: 'USERS', action: 'VIEW', effect: 'ALLOW', priority: 25 })
    await expect(await policyRow(page, name)).toBeVisible()
    await expect(await policyRow(page, name)).toContainText('USERS')
    await expect(await policyRow(page, name)).toContainText('VIEW')
    await expect(await policyRow(page, name)).toContainText('Allow')
    await expect(await policyRow(page, name)).toContainText('25')
  })

  test('Edit Policy → verify changes saved', async ({ page }) => {
    await gotoAccessPolicies(page)
    const row = await policyRow(page, name)
    await row.getByRole('button', { name: 'Edit policy' }).click()

    const modal = modalScope(page, 'Edit Policy')
    const newDesc = `Edited description ${uid()}`
    await modal.getByPlaceholder('What this policy controls…').fill(newDesc)
    await modal.locator('input[type="number"]').fill('77')

    const respPromise = waitForApi(page, '/access-policies', 'PATCH')
    await modal.getByRole('button', { name: 'Save Changes', exact: true }).click()
    const resp = await respPromise
    expect(resp.ok()).toBeTruthy()
    await expect(page.getByText('Policy updated successfully')).toBeVisible({ timeout: 10000 })

    const rowAfter = await policyRow(page, name)
    await expect(rowAfter).toContainText('77')
    await expect(rowAfter).toContainText(newDesc)
  })

  test('Delete Policy → verify removed', async ({ page }) => {
    await gotoAccessPolicies(page)
    const row = await policyRow(page, name)

    page.once('dialog', dialog => dialog.accept())
    const respPromise = waitForApi(page, '/access-policies', 'DELETE')
    await row.getByRole('button', { name: 'Delete policy' }).click()
    const resp = await respPromise
    expect(resp.ok()).toBeTruthy()
    await expect(page.getByText('Policy deleted')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: name })).not.toBeVisible({ timeout: 10000 })
  })
})

// ── 5) Filters ────────────────────────────────────────────────────────────────

test.describe('Filters', () => {
  const allowName = `FilterAllow ${uid()}`
  const denyName  = `FilterDeny ${uid()}`

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'tests/setup/.auth.json' })
    await createPolicy(page, { name: allowName, resource: 'USERS',    action: 'VIEW',   effect: 'ALLOW', status: 'ACTIVE' })
    await createPolicy(page, { name: denyName,  resource: 'SETTINGS', action: 'DELETE', effect: 'DENY',  status: 'INACTIVE' })
    await page.close()
  })

  test('Filter by Status → verify correct items shown', async ({ page }) => {
    await gotoAccessPolicies(page)
    const respPromise = waitForApi(page, '/access-policies', 'GET')
    await page.locator('select:has(option:text-is("All Status"))').selectOption('INACTIVE')
    await respPromise
    await expect(page.locator('tr', { hasText: allowName })).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: denyName })).toBeVisible()
  })

  test('Filter by Effect → verify correct items shown', async ({ page }) => {
    await gotoAccessPolicies(page)
    const respPromise = waitForApi(page, '/access-policies', 'GET')
    await page.locator('select:has(option:text-is("All Effects"))').selectOption('ALLOW')
    await respPromise
    await expect(page.locator('tr', { hasText: allowName })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: denyName })).not.toBeVisible()
  })

  test('Filter by Resource → verify correct items shown', async ({ page }) => {
    await gotoAccessPolicies(page)
    const respPromise = waitForApi(page, '/access-policies', 'GET')
    await page.locator('select:has(option:text-is("All Resources"))').selectOption('SETTINGS')
    await respPromise
    await expect(page.locator('tr', { hasText: denyName })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: allowName })).not.toBeVisible()
  })

  test('Filter by Action → verify correct items shown', async ({ page }) => {
    await gotoAccessPolicies(page)
    const respPromise = waitForApi(page, '/access-policies', 'GET')
    await page.locator('select:has(option:text-is("All Actions"))').selectOption('DELETE')
    await respPromise
    await expect(page.locator('tr', { hasText: denyName })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tr', { hasText: allowName })).not.toBeVisible()
  })
})

// ── 6) Search ─────────────────────────────────────────────────────────────────

test('Search Access Policies → verify filtered results', async ({ page }) => {
  const name = `SearchPolicy ${uid()}`
  await createPolicy(page, { name })

  await gotoAccessPolicies(page)
  // gotoAccessPolicies triggers a mount-time GET /access-policies (unfiltered).
  // Registering waitForResponse immediately after fill() can catch that
  // still-in-flight stale response instead of the debounced search-triggered
  // one — same race already fixed in invitations.full.spec.ts's status
  // filter test. Let the initial fetch settle first.
  await page.waitForLoadState('networkidle')
  const respPromise = waitForApi(page, '/access-policies', 'GET')
  await page.getByPlaceholder('Search policies...').fill(name)
  await respPromise
  // Exact row-count isn't a meaningful invariant here — other tests'
  // policies (e.g. the Filters block's FilterAllow/FilterDeny, which are
  // never deleted) can coexist in the table. What search is actually
  // supposed to guarantee is that every visible row matches the term.
  await expect(async () => {
    const rows = page.locator('tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText(name)
    }
  }).toPass({ timeout: 10000 })
})

// ── 7) Empty state ────────────────────────────────────────────────────────────

test('Empty state → shown when filters match nothing', async ({ page }) => {
  await gotoAccessPolicies(page)
  const respPromise = waitForApi(page, '/access-policies', 'GET')
  await page.getByPlaceholder('Search policies...').fill(`nomatch-${uid()}`)
  await respPromise
  await expect(page.getByText('No access policies found.')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: '+ Create your first policy' })).toBeVisible()
})
