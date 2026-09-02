import { test, expect } from '@playwright/test'

// Regression guard for the "Recent Role Activity" preview card on
// /roles-permissions (LMS Roles tab, bottom info-card row).
//
// It used to call GET /api/admin/audit-logs — a route that was never mounted in
// backend/server.js — so every page load fired a 404 into the console and the
// card sat on a permanent loading skeleton. The project's recorded decision
// (IMPACT_MAP "Audit & Security", DEFERRED_ITEMS 2026-08-17) is that
// reports.service.getAuditReports is the ONE owner of the audit-log query, so
// the card now reuses GET /reports/audit like AuditTrackingTab already did.
//
// These tests assert the wiring, not the row content — this DB has no
// COMPANY_ROLE_*/DELEGATED_ADMIN_* rows yet, so the truthful render is the
// empty state.

const AUDIT_ENDPOINT = /\/api\/admin\/reports\/audit\?/

test('Recent Role Activity card loads from /reports/audit, not the missing /audit-logs', async ({ page }) => {
  const auditLogsCalls: string[] = []
  page.on('request', req => {
    if (req.url().includes('/api/admin/audit-logs')) auditLogsCalls.push(req.url())
  })

  const auditResponse = page.waitForResponse(
    res => AUDIT_ENDPOINT.test(res.url()) && res.request().method() === 'GET',
    { timeout: 20000 },
  )

  await page.goto('/roles-permissions?tab=roles')

  const res = await auditResponse
  expect(res.status()).toBe(200)

  // The dead endpoint must never be requested again.
  expect(auditLogsCalls).toEqual([])
})

test('Recent Role Activity card requests the same action filter as the Audit & Tracking tab', async ({ page }) => {
  const auditResponse = page.waitForResponse(
    res => AUDIT_ENDPOINT.test(res.url()) && res.request().method() === 'GET',
    { timeout: 20000 },
  )

  await page.goto('/roles-permissions?tab=roles')
  const url = new URL((await auditResponse).url())

  // Both surfaces read ROLE_AUDIT_ACTIONS / ROLE_AUDIT_RANGE from
  // src/constants/roleAuditActions.ts — a card previewing a different set than
  // the tab it opens would be a drift bug (R4).
  const actions = (url.searchParams.get('actions') ?? '').split(',')
  expect(actions).toContain('COMPANY_ROLE_CREATED')
  expect(actions).toContain('DELEGATED_ADMIN_GRANTED')
  expect(url.searchParams.get('dateRange')).toBe('quarter')
  expect(url.searchParams.get('limit')).toBe('4')
})

test('Recent Role Activity card settles into a real state, never a stuck skeleton', async ({ page }) => {
  await page.goto('/roles-permissions?tab=roles')

  const card = page.locator('div').filter({ hasText: /^Recent Role Activity/ }).first()
  await expect(card).toBeVisible({ timeout: 15000 })

  // With no role-audit rows in this DB the card must show the truthful empty
  // state. Previously the 404 left it on the skeleton forever.
  await expect(page.getByText('No recent activity')).toBeVisible({ timeout: 20000 })
})

test('Audit & Tracking tab loads over the same endpoint', async ({ page }) => {
  const auditResponse = page.waitForResponse(
    res => AUDIT_ENDPOINT.test(res.url()) && res.url().includes('limit=50'),
    { timeout: 20000 },
  )

  await page.goto('/roles-permissions?tab=audit')

  expect((await auditResponse).status()).toBe(200)
  await expect(page.getByText('Audit & Tracking').first()).toBeVisible({ timeout: 15000 })
})
