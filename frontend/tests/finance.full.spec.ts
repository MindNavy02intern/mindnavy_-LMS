import { test, expect } from '@playwright/test'

// Finance module — full stack (Parts 1-4). Real backend throughout (no route
// mocking) — a disposable learner is created via the real API for the
// Generate Invoice flow, same pattern as competencies.full.spec.ts. See
// backend/contact md files/FINANCE_CONTRACT.md for the endpoint shapes.
//
// Run with: npx playwright test finance.full --workers=1
//
// Every table in this module starts genuinely empty (no payment gateway, no
// seed data) — the dashboard-empty-states test asserts the HONEST empty
// state, not a loading placeholder.
//
// CLEANUP NOTE: coupons and tax rules support a real hard DELETE, so afterAll
// removes them outright. Invoices have no delete endpoint in v1 (only void,
// per the contract) — afterAll voids the disposable invoice instead, the
// same "reach the everyday terminal state" fallback competencies.full.spec.ts
// uses (archive instead of delete) when a hard delete isn't available.

const API = 'http://localhost:5001/api/admin'

let savedToken: string | null = null
let learnerId: string | null = null
let learnerName: string | null = null
let couponId: string | null = null
let couponCode: string | null = null
let taxRuleId: string | null = null
let taxRuleName: string | null = null
let invoiceId: string | null = null
let invoiceNumber: string | null = null

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/finance')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()
  if (!savedToken) return

  const stamp = Date.now()
  learnerName = `QA Finance Learner ${stamp}`
  const learnerResp = await request.post(`${API}/learners`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: {
      fullName: learnerName,
      email: `qa.finance.learner.${stamp}@example.com`,
      password: 'Qatest!2345678',
      status: 'ACTIVE',
    },
  })
  const learnerBody = await learnerResp.json().catch(() => null)
  learnerId = learnerBody?.data?.id ?? null
})

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }

  if (couponId) {
    await request.delete(`${API}/finance/coupons/${couponId}`, { headers: H }).catch(() => null)
  }
  if (taxRuleId) {
    await request.delete(`${API}/finance/tax-rules/${taxRuleId}`, { headers: H }).catch(() => null)
  }
  if (invoiceId) {
    await request.patch(`${API}/finance/invoices/${invoiceId}/void`, { headers: H }).catch(() => null)
  }
  if (learnerId) {
    await request.delete(`${API}/learners/${learnerId}`, { headers: H }).catch(() => null)
  }
})

test('Finance page loads with header, KPI cards, and all tabs', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/finance/stats') && r.ok(), { timeout: 15000 }),
    page.goto('/finance'),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Total Revenue')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Monthly Revenue')).toBeVisible({ timeout: 10000 })
  // exact: true — non-exact also substring-matches the Dashboard tab's
  // "No active subscriptions yet." empty-state text.
  await expect(page.getByText('Active Subscriptions', { exact: true })).toBeVisible({ timeout: 10000 })
  for (const label of ['Dashboard', 'Payments', 'Subscriptions', 'Invoices', 'Refunds', 'Payouts', 'Coupons', 'Tax Management']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 10000 })
  }
})

test('Dashboard tab shows honest empty states for all four charts', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/finance/analytics') && r.ok(), { timeout: 15000 }),
    page.goto('/finance'),
  ])
  expect(resp.ok()).toBeTruthy()

  await expect(page.getByText('No revenue recorded yet')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('No active subscriptions yet.')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('No refunds processed yet.')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('No course revenue recorded yet.')).toBeVisible({ timeout: 10000 })
})

test('Create Coupon creates a coupon and it appears in the Coupons tab', async ({ page }) => {
  const stamp = Date.now()
  couponCode = `QA${stamp}`

  await page.goto('/finance?tab=coupons')
  await expect(page.getByRole('button', { name: 'Create Coupon', exact: true })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'Create Coupon', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create Coupon' })).toBeVisible({ timeout: 5000 })
  await page.getByPlaceholder('SUMMER2026').fill(couponCode)
  await page.getByPlaceholder('e.g. 15').fill('15')

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/finance/coupons') && r.request().method() === 'POST', { timeout: 15000 }),
    page.locator('form button[type="submit"]').click(),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  couponId = body?.data?.id ?? null
  expect(couponId, 'Created coupon must return a real id').toBeTruthy()

  await expect(page.getByText(couponCode)).toBeVisible({ timeout: 10000 })
})

test('Add Tax Rule creates a rule and it appears in the Tax Management tab', async ({ page }) => {
  const stamp = Date.now()
  taxRuleName = `QA Tax Rule ${stamp}`

  await page.goto('/finance?tab=tax')
  await page.getByRole('button', { name: 'Add Tax Rule', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Add Tax Rule' })).toBeVisible({ timeout: 5000 })

  await page.getByPlaceholder('EU VAT').fill(taxRuleName)
  await page.getByPlaceholder('e.g. European Union').fill('European Union')
  await page.getByPlaceholder('e.g. Germany').fill('Germany')
  await page.getByPlaceholder('e.g. 19').fill('19')

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/finance/tax-rules') && r.request().method() === 'POST', { timeout: 15000 }),
    page.locator('form button[type="submit"]').click(),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  taxRuleId = body?.data?.id ?? null
  expect(taxRuleId, 'Created tax rule must return a real id').toBeTruthy()

  await expect(page.getByText(taxRuleName)).toBeVisible({ timeout: 10000 })
})

test('Generate Invoice creates an invoice with a correct sequential number', async ({ page }) => {
  test.skip(!learnerId, 'Setup learner was not created — backend may be unavailable')

  await page.goto('/finance?tab=invoices')
  // .first(): both the page header's "Generate Invoice" and the Invoices
  // tab's own button are visible at once — either opens the same modal.
  await page.getByRole('button', { name: 'Generate Invoice', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Generate Invoice' })).toBeVisible({ timeout: 5000 })

  await page.getByPlaceholder('Search by name or email…').fill(learnerName as string)
  await expect(page.getByRole('button', { name: new RegExp(learnerName as string) })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: new RegExp(learnerName as string) }).click()

  await page.getByPlaceholder('Item name').fill('QA Test Course Access')
  await page.getByPlaceholder('Unit price').fill('49.99')

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/finance/invoices') && r.request().method() === 'POST', { timeout: 15000 }),
    page.locator('form button[type="submit"]').click(),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  invoiceId = body?.data?.id ?? null
  invoiceNumber = body?.data?.invoiceNumber ?? null
  expect(invoiceId, 'Created invoice must return a real id').toBeTruthy()
  expect(invoiceNumber).toMatch(/^INV-\d{4}$/)

  await expect(page.getByText(invoiceNumber as string)).toBeVisible({ timeout: 10000 })
})
