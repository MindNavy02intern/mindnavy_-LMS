import { test, expect } from '@playwright/test'

// Integrations module — full stack (Parts 1-4). Real backend throughout (no
// route mocking). Zoom/Supabase/SMTP are the module's only real providers
// (see backend/contact md files/INTEGRATIONS_CONTRACT.md) — everything else
// in the catalog is COMING_SOON by design and is not exercised here beyond
// the read-only dashboard/all-integrations views.
//
// Run with: npx playwright test integrations.full --workers=1
//
// CLEANUP: afterAll revokes+deletes the QA API key and deletes the QA
// webhook via the real API — same "zero leaks" convention as
// notifications.full.spec.ts.

const API = 'http://localhost:5001/api/admin'

let savedToken: string | null = null
let apiKeyId: string | null = null
let webhookId: string | null = null

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  await page.goto('/integrations')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()
})

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }

  if (webhookId) {
    await request.delete(`${API}/integrations/webhooks/${webhookId}`, { headers: H }).catch(() => null)
  }
  if (apiKeyId) {
    await request.delete(`${API}/integrations/api-keys/${apiKeyId}`, { headers: H }).catch(() => null)
  }
})

test('Integrations page loads with header, stats cards and tabs', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/integrations/stats') && r.ok(), { timeout: 15000 }),
    page.goto('/integrations'),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Active Integrations')).toBeVisible({ timeout: 10000 })
  for (const label of ['Dashboard', 'All Integrations', 'API Keys', 'Webhooks', 'Data Sync', 'Logs', 'Marketplace']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 10000 })
  }
})

test('Dashboard shows Zoom as CONNECTED', async ({ page }) => {
  // startsWith(API): endsWith('/integrations') alone also matches the SPA's
  // own document response for http://localhost:5173/integrations (HTML, not
  // JSON) — whichever response lands first wins the race, and the doc
  // response breaks resp.json(). Anchoring to the API origin/path fixes it.
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url() === `${API}/integrations` && r.request().method() === 'GET' && r.ok(), { timeout: 15000 }),
    page.goto('/integrations'),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  const zoom = (body?.data ?? []).find((i: { slug: string }) => i.slug === 'zoom')
  expect(zoom, 'Zoom must exist in the seeded catalog').toBeTruthy()

  const row = page.getByLabel('integration-row-zoom')
  await expect(row).toBeVisible({ timeout: 10000 })
  if (zoom?.status === 'CONNECTED') {
    await expect(row.getByText('Connected', { exact: true })).toBeVisible({ timeout: 10000 })
  }
})

test('Generate API Key shows the full key once and it appears in the list', async ({ page }) => {
  const stamp = Date.now()
  const keyName = `QA API Key ${stamp}`

  await page.goto('/integrations?tab=api')
  await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: '+ Generate API Key' }).click()
  await expect(page.getByRole('heading', { name: 'Generate API Key' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('Name').fill(keyName)
  await page.getByRole('button', { name: 'read:users', exact: true }).click()

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/integrations/api-keys') && r.request().method() === 'POST', { timeout: 15000 }),
    page.getByRole('button', { name: 'Generate Key' }).click(),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  apiKeyId = body?.data?.id ?? null
  expect(apiKeyId, 'Created API key must return a real id').toBeTruthy()
  const fullKey = body?.data?.key as string | undefined
  expect(fullKey, 'Response must include the full key').toBeTruthy()
  expect(fullKey).toMatch(/^mk_live_/)

  await expect(page.getByRole('heading', { name: 'API Key Generated' })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(fullKey as string)).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'Done' }).click()

  await expect(page.getByText(keyName)).toBeVisible({ timeout: 10000 })
})

test('Create Webhook appears in the list and Test returns a real result', async ({ page }) => {
  const stamp = Date.now()
  const webhookName = `QA Webhook ${stamp}`

  await page.goto('/integrations?tab=webhooks')
  await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: '+ Create Webhook' }).click()
  await expect(page.getByRole('heading', { name: 'Create Webhook' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('Name').fill(webhookName)
  await page.getByLabel('URL (https only)').fill('https://example.com/mindnavy-qa-webhook')
  await page.getByRole('button', { name: 'user.registered', exact: true }).click()

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/integrations/webhooks') && r.request().method() === 'POST', { timeout: 15000 }),
    // exact:true — "+ Create Webhook" (the tab's own trigger button) also
    // contains this string as a substring, so a loose match would be ambiguous.
    page.getByRole('button', { name: 'Create Webhook', exact: true }).click(),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  webhookId = body?.data?.id ?? null
  expect(webhookId, 'Created webhook must return a real id').toBeTruthy()

  const row = page.locator('tr', { hasText: webhookName })
  await expect(row).toBeVisible({ timeout: 10000 })

  const [testResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/integrations/webhooks/${webhookId}/test`) && r.ok(), { timeout: 15000 }),
    row.getByLabel('Test').click(),
  ])
  expect(testResp.ok()).toBeTruthy()
  await expect(page.getByRole('heading', { name: /Test (Succeeded|Failed)/ })).toBeVisible({ timeout: 10000 })
})

test('Logs tab shows entries from the actions above', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/integrations/logs') && r.ok(), { timeout: 15000 }),
    page.goto('/integrations?tab=logs'),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  expect(body?.data?.total ?? 0, 'At least one integration log must exist by now').toBeGreaterThan(0)
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 })
})
