import { test, expect, type Page } from '@playwright/test'

function uid() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`
}

async function gotoRoleTemplates(page: Page) {
  await page.goto('/roles-permissions')
  await page.getByRole('button', { name: 'Role Templates', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=templates/)
}

// Modals in this codebase render as a `position: fixed; inset: 0` overlay root.
// The trigger button and the modal's heading/submit button can share text
// (e.g. "Create Template" is both the toolbar button and the modal heading
// AND submit button) — the trigger isn't `position: fixed`, so scoping here
// reliably isolates the modal. `:visible` excludes stale closed-modal DOM.
function modalScope(page: Page, anchorText: string) {
  return page.locator('[style*="position: fixed"]:visible').filter({ hasText: anchorText }).last()
}

function waitForApi(page: Page, urlSubstr: string, method: string) {
  return page.waitForResponse(resp => resp.url().includes(urlSubstr) && resp.request().method() === method, { timeout: 20000 })
}

// Cards are plain <div>s, not <tr>s — scope by the template name's containing
// card, disambiguated from any shallower ancestor (e.g. the grid container)
// by also requiring the card's own "Use" button as a descendant. `.last()`
// picks the deepest (most specific) match, same trick used elsewhere this
// session for non-table panels (BulkActionsMenu, AssignUsersToRoleModal).
function templateCard(page: Page, name: string) {
  return page.locator('div:visible')
    .filter({ hasText: name })
    .filter({ has: page.getByRole('button', { name: 'Use', exact: true }) })
    .last()
}

async function searchTemplates(page: Page, query: string) {
  const respPromise = waitForApi(page, '/role-templates?', 'GET')
  await page.getByPlaceholder('Search templates...').fill(query)
  const resp = await respPromise
  expect(resp.ok()).toBeTruthy()
  return resp
}

// ── 1) Tab loads with seeded templates ───────────────────────────────────────

test('Role Templates tab loads → seeded templates appear with correct permission counts', async ({ page }) => {
  await gotoRoleTemplates(page)
  await page.waitForLoadState('networkidle')

  const seeded = ['Instructor Template', 'HR Manager Template', 'Finance Manager Template', 'Branch Manager Template']
  for (const name of seeded) {
    const resp = await searchTemplates(page, name)
    const body = await resp.json()
    const apiItem = body.data.find((t: { name: string }) => t.name === name)
    expect(apiItem, `Expected seeded template "${name}" to exist`).toBeTruthy()

    const card = templateCard(page, name)
    await expect(card).toBeVisible()
    await expect(card).toContainText(`${apiItem.permissionCount} perm`)
  }
})

// ── 2) Expand a card → permissions load from the real detail endpoint ───────

test('Expand a template card → its permissions load', async ({ page }) => {
  await gotoRoleTemplates(page)
  await page.waitForLoadState('networkidle')

  await searchTemplates(page, 'Instructor Template')
  const card = templateCard(page, 'Instructor Template')
  await expect(card).toBeVisible()

  // '/role-templates/' (trailing slash) only matches the detail endpoint
  // (/role-templates/{id}), never the list endpoint (/role-templates?...).
  const detailsPromise = waitForApi(page, '/role-templates/', 'GET')
  await card.getByRole('button', { name: 'View permissions' }).click()
  const detailsResp = await detailsPromise
  expect(detailsResp.ok()).toBeTruthy()
  const detailsBody = await detailsResp.json()
  expect(detailsBody.data.permissions.length).toBeGreaterThan(0)

  const firstPermName = detailsBody.data.permissions[0].name
  await expect(card.getByText(firstPermName, { exact: true })).toBeVisible()
})

// ── 3-7) Create → duplicate-409 → apply → re-apply → delete ────────────────

test.describe.serial('Create / Apply / Re-apply / Delete', () => {
  const templateName = `Test Template ${uid()}`
  let appliedRoleName = ''

  test('Create Template → fill name + permissions + save → appears in grid', async ({ page }) => {
    await gotoRoleTemplates(page)
    await page.getByRole('button', { name: 'Create Template', exact: true }).click()

    const modal = modalScope(page, 'Create Template')
    await modal.getByPlaceholder('e.g. Support Lead').fill(templateName)
    await modal.getByPlaceholder('What this template covers…').fill('E2E test template')

    // Pick the first 2 permission checkboxes — which specific ones doesn't
    // matter for this test, only that exactly 2 get sent and reflected back.
    const checkboxes = modal.locator('input[type="checkbox"]')
    await checkboxes.nth(0).check()
    await checkboxes.nth(1).check()

    const createPromise = waitForApi(page, '/role-templates', 'POST')
    await modal.getByRole('button', { name: 'Create Template', exact: true }).click()
    const createResp = await createPromise
    expect(createResp.ok()).toBeTruthy()
    const createBody = await createResp.json()
    expect(createBody.data.permissionCount).toBe(2)

    await expect(page.getByText('Template created successfully')).toBeVisible({ timeout: 10000 })

    await searchTemplates(page, templateName)
    await expect(templateCard(page, templateName)).toBeVisible()
  })

  test('Create with duplicate name → friendly 409 error shown', async ({ page }) => {
    await gotoRoleTemplates(page)
    await page.getByRole('button', { name: 'Create Template', exact: true }).click()

    const modal = modalScope(page, 'Create Template')
    // Reuses the exact name created above — guaranteed to already exist.
    await modal.getByPlaceholder('e.g. Support Lead').fill(templateName)

    const createPromise = waitForApi(page, '/role-templates', 'POST')
    await modal.getByRole('button', { name: 'Create Template', exact: true }).click()
    const createResp = await createPromise
    expect(createResp.status()).toBe(409)

    // Both the modal's inline form error (a <div>) and the toast (a <span> in
    // Toast.tsx) show this exact text — scope to the modal to assert the real
    // form error specifically, since the toast lives outside the modal's DOM
    // entirely and would otherwise make this a strict-mode-violating match.
    await expect(modal.getByText('A template with this name already exists.')).toBeVisible({ timeout: 10000 })
  })

  test('Apply template to a role → role picker shows roles (not users), success shown', async ({ page }) => {
    await gotoRoleTemplates(page)
    await page.waitForLoadState('networkidle')
    await searchTemplates(page, templateName)

    const card = templateCard(page, templateName)
    const rolesPromise = waitForApi(page, '/roles?', 'GET')
    await card.getByRole('button', { name: 'Use', exact: true }).click()
    const rolesResp = await rolesPromise
    expect(rolesResp.ok()).toBeTruthy()
    const rolesBody = await rolesResp.json()

    // Proves this is a ROLE picker: the dropdown is populated from a real
    // GET /roles response, and we apply against a role from that exact
    // response — never a user. "Learner" is seeded with zero permissions
    // (see prisma/seed.js — only Administrator/Manager/Instructor get
    // assignments), so applying this fresh 2-permission template to it is
    // guaranteed to be a real grant the first time, not a no-op.
    const learnerRole = rolesBody.data.find((r: { name: string }) => r.name === 'Learner')
    expect(learnerRole, 'Expected seeded "Learner" role to exist').toBeTruthy()
    appliedRoleName = learnerRole.name

    const modal = modalScope(page, 'Apply Template')
    const roleSelect = modal.locator('select:has(option:text-is("Select a role…"))')
    await expect(roleSelect.getByRole('option', { name: appliedRoleName, exact: true })).toHaveCount(1)
    await roleSelect.selectOption({ label: appliedRoleName })

    const applyPromise = page.waitForResponse(resp => resp.url().includes('/apply') && resp.request().method() === 'POST')
    await modal.getByRole('button', { name: 'Apply', exact: true }).click()
    const applyResp = await applyPromise
    if (!applyResp.ok()) {
      const errorBody = await applyResp.json().catch(() => null)
      console.log('Apply failed:', { status: applyResp.status(), errorBody, url: applyResp.url(), roleId: learnerRole.id })
    }
    expect(applyResp.ok()).toBeTruthy()
    const applyBody = await applyResp.json()
    expect(applyBody.data.roleId).toBe(learnerRole.id)

    // A fresh grant or an already-applied no-op are both "graceful success"
    // here — re-running this suite across sessions could legitimately land
    // on either if a prior run already granted these same permissions to
    // Learner. The very next test forces the guaranteed-already-applied case.
    await expect(page.getByText(/Applied \d+ permission|already fully applied/)).toBeVisible({ timeout: 10000 })
  })

  test('Re-apply same template to same role → applied:0 handled gracefully (not an error)', async ({ page }) => {
    await gotoRoleTemplates(page)
    await page.waitForLoadState('networkidle')
    await searchTemplates(page, templateName)

    const card = templateCard(page, templateName)
    await card.getByRole('button', { name: 'Use', exact: true }).click()

    const modal = modalScope(page, 'Apply Template')
    const roleSelect = modal.locator('select:has(option:text-is("Select a role…"))')
    await expect(async () => {
      expect(await roleSelect.locator('option').count()).toBeGreaterThan(1)
    }).toPass({ timeout: 20000 })
    await roleSelect.selectOption({ label: appliedRoleName })

    const applyPromise = page.waitForResponse(resp => resp.url().includes('/apply') && resp.request().method() === 'POST')
    await modal.getByRole('button', { name: 'Apply', exact: true }).click()
    const applyResp = await applyPromise
    expect(applyResp.ok()).toBeTruthy()
    const applyBody = await applyResp.json()
    // Guaranteed 0 regardless of Learner's prior history, since this exact
    // role+template pairing was just applied moments ago in the test above.
    expect(applyBody.data.applied).toBe(0)

    await expect(page.getByText(/already fully applied/)).toBeVisible({ timeout: 10000 })
  })

  test('Delete template → removed from grid', async ({ page }) => {
    await gotoRoleTemplates(page)
    await page.waitForLoadState('networkidle')
    await searchTemplates(page, templateName)

    const card = templateCard(page, templateName)
    await expect(card).toBeVisible()

    page.once('dialog', dialog => dialog.accept())
    const deletePromise = page.waitForResponse(resp => resp.url().includes('/role-templates/') && resp.request().method() === 'DELETE')
    await card.getByRole('button', { name: 'Delete', exact: true }).click()
    const deleteResp = await deletePromise
    expect(deleteResp.ok()).toBeTruthy()

    await expect(page.getByText('Template deleted')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('div:visible').filter({ hasText: templateName })).not.toBeVisible({ timeout: 10000 })
  })
})
