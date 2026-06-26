import { test, expect, type Page, type Locator } from '@playwright/test'

function waitForApi(page: Page, urlSubstr: string, method: string) {
  return page.waitForResponse(resp => resp.url().includes(urlSubstr) && resp.request().method() === method, { timeout: 20000 })
}

// Stat cards in this codebase render a label element immediately followed by
// a sibling value element holding the formatted (.toLocaleString()) number —
// see KpiCard in RolesPermissionsStandalonePage.tsx, StatCard in
// AccessPoliciesTab.tsx (both <div> siblings), and StatRow in
// DashboardPage.tsx (two <span> siblings — pass valueTag: 'span' for that
// one). Scoping to a container first avoids ambiguity where the same label
// text appears elsewhere on the page (e.g. a tab button or an unrelated info
// card sharing the exact label string).
async function readStatCardValue(scope: Page | Locator, label: string, valueTag: 'div' | 'span' = 'div'): Promise<number> {
  const valueEl = scope.getByText(label, { exact: true }).locator(`xpath=following-sibling::${valueTag}[1]`)
  const text = (await valueEl.textContent()) ?? ''
  return Number(text.replace(/,/g, '').trim())
}

test('Access Policies count is consistent between the header card and the tab', async ({ page }) => {
  // 1) Header KPI grid on /roles-permissions (the 'lms' tab's 6-column grid).
  const headerStatsPromise = waitForApi(page, '/access-policies/stats', 'GET')
  await page.goto('/roles-permissions')
  const headerStatsResp = await headerStatsPromise
  expect(headerStatsResp.ok()).toBeTruthy()
  const headerBackendTotal = (await headerStatsResp.json()).data.totalPolicies

  const kpiGrid = page.locator('div[style*="repeat(6, 1fr)"]')
  const headerCardValue = await readStatCardValue(kpiGrid, 'Access Policies')

  // 2) The Access Policies tab's own 5-column stats grid.
  const tabStatsPromise = waitForApi(page, '/access-policies/stats', 'GET')
  await page.getByRole('button', { name: 'Access Policies', exact: true }).click()
  const tabStatsResp = await tabStatsPromise
  expect(tabStatsResp.ok()).toBeTruthy()
  const tabBackendTotal = (await tabStatsResp.json()).data.totalPolicies

  const tabStatsGrid = page.locator('div[style*="repeat(5, 1fr)"]')
  const tabCardValue = await readStatCardValue(tabStatsGrid, 'Total Policies')

  // Pin both UI numbers to the backend's single source of truth, not just to
  // each other — this is what actually catches the regression class (one UI
  // location silently falling back to a stale/wrong value while the other
  // reads correctly from the same endpoint).
  expect(headerCardValue).toBe(headerBackendTotal)
  expect(tabCardValue).toBe(tabBackendTotal)
  expect(headerCardValue).toBe(tabCardValue)
})

// Dashboard's LKpiCard (.mn-lkpi-card / .mn-lkpi-value) and the Users page's
// UserKpiCards (plain inline-styled divs, no class) both put the label and
// value in non-adjacent positions — the label sits inside an icon+label row,
// while the value is a separate sibling of that row, not of the label itself.
// So unlike readStatCardValue above, this scopes to the card (by the text it
// contains) and then locates the value within it by its own selector.
async function readKpiCardValue(card: Locator, valueSelector: string): Promise<number> {
  const text = (await card.locator(valueSelector).textContent()) ?? ''
  return Number(text.replace(/,/g, '').trim())
}

test('Total Users is consistent between Dashboard and Users page', async ({ page }) => {
  // 1) Dashboard — getDashboardCore() response shape is { kpis: { totalUsers, ... }, ... }.
  const dashboardPromise = waitForApi(page, '/dashboard/core', 'GET')
  await page.goto('/dashboard')
  const dashboardResp = await dashboardPromise
  expect(dashboardResp.ok()).toBeTruthy()
  const dashboardBackendTotal = (await dashboardResp.json()).kpis.totalUsers

  const dashboardCard = page.locator('.mn-lkpi-card').filter({ hasText: 'Total Users' })
  const dashboardCardValue = await readKpiCardValue(dashboardCard, '.mn-lkpi-value')

  // 2) Users page — GET /users response shape is { kpiSummary: { totalUsers, ... }, ... }.
  // Match on '/users?' (not just '/users') so this doesn't also catch
  // /users/export, /users/bulk-action, etc.
  const usersPromise = waitForApi(page, '/users?', 'GET')
  await page.goto('/users')
  const usersResp = await usersPromise
  expect(usersResp.ok()).toBeTruthy()
  const usersBackendTotal = (await usersResp.json()).kpiSummary.totalUsers

  const usersCardValue = await readUserKpiCardValue(page, 'Total Users')

  // Pin each UI number to its OWN backend response first. If this passes for
  // both but the final comparison fails, that's a genuine backend
  // inconsistency between getDashboardCore() and GET /users' kpiSummary —
  // not a test bug, and not something to force-fix here.
  expect(dashboardCardValue).toBe(dashboardBackendTotal)
  expect(usersCardValue).toBe(usersBackendTotal)
  expect(dashboardCardValue).toBe(usersCardValue)
})

// UserKpiCards (frontend/src/components/users/UserKpiCards.tsx): confirmed
// from the real rendered accessibility tree (Playwright's error-context.md
// snapshot, captured while diagnosing the "Total Users" test above), not
// guessed from the .tsx source. Every one of its 5 cards shares this exact
// structure:
//   <card div>
//     <icon+label row div> <icon/> <span>{label}</span> </row>
//     <value div>{value}</value>
//     <change row div>...</row>
//   </card>
// i.e. the label <span> sits inside the icon+label row, and the value <div>
// is a sibling of that ROW, not of the label itself — so: find the label
// span, go up to its parent row, then take the row's very next sibling.
// Deliberately does NOT scope through the grid container's inline
// grid-template-columns style — matching that as a substring is unreliable
// (the browser can reformat/normalize the serialized style; two different
// guesses at it both failed before this was rewritten) and is unnecessary
// since each of these labels is unique on the /users page.
async function readUserKpiCardValue(page: Page, label: string): Promise<number> {
  const labelSpan = page.locator('span').filter({ hasText: label })
  const valueDiv = labelSpan.locator('xpath=../following-sibling::div[1]')
  const text = (await valueDiv.textContent()) ?? ''
  return Number(text.replace(/,/g, '').trim())
}

test('Suspended Users is consistent between Dashboard and Users page', async ({ page }) => {
  // Dashboard's "Suspended Users" StatRow reads from getDashboardAnalytics()
  // (/dashboard/analytics → userAnalytics.suspendedUsers), via
  // analytics?.userAnalytics passed into UserAnalyticsCard — NOT
  // getDashboardCore(), which has no suspendedUsers field at all. Confirmed
  // by reading DashboardPage.tsx's actual prop wiring, not assumed.
  const dashboardPromise = waitForApi(page, '/dashboard/analytics', 'GET')
  await page.goto('/dashboard')
  const dashboardResp = await dashboardPromise
  expect(dashboardResp.ok()).toBeTruthy()
  const dashboardBackendTotal = (await dashboardResp.json()).userAnalytics.suspendedUsers

  const dashboardCardValue = await readStatCardValue(page, 'Suspended Users', 'span')

  const usersPromise = waitForApi(page, '/users?', 'GET')
  await page.goto('/users')
  const usersResp = await usersPromise
  expect(usersResp.ok()).toBeTruthy()
  const usersBackendTotal = (await usersResp.json()).kpiSummary.suspendedUsers

  const usersCardValue = await readUserKpiCardValue(page, 'Suspended Users')

  expect(dashboardCardValue).toBe(dashboardBackendTotal)
  expect(usersCardValue).toBe(usersBackendTotal)
  expect(dashboardCardValue).toBe(usersCardValue)
})

test('Active Users is consistent between Dashboard and Users page', async ({ page }) => {
  // Same source as Suspended Users above: getDashboardAnalytics() →
  // userAnalytics.activeUsers, not getDashboardCore().
  const dashboardPromise = waitForApi(page, '/dashboard/analytics', 'GET')
  await page.goto('/dashboard')
  const dashboardResp = await dashboardPromise
  expect(dashboardResp.ok()).toBeTruthy()
  const dashboardBackendTotal = (await dashboardResp.json()).userAnalytics.activeUsers

  const dashboardCardValue = await readStatCardValue(page, 'Active Users', 'span')

  const usersPromise = waitForApi(page, '/users?', 'GET')
  await page.goto('/users')
  const usersResp = await usersPromise
  expect(usersResp.ok()).toBeTruthy()
  const usersBackendTotal = (await usersResp.json()).kpiSummary.activeUsers

  const usersCardValue = await readUserKpiCardValue(page, 'Active Users')

  expect(dashboardCardValue).toBe(dashboardBackendTotal)
  expect(usersCardValue).toBe(usersBackendTotal)
  expect(dashboardCardValue).toBe(usersCardValue)
})

test('Pending Verification is consistent between Users page and its own tab', async ({ page }) => {
  // The Dashboard has no "Pending Verification" stat anywhere (checked both
  // getDashboardCore() consumers and getDashboardAnalytics()'s
  // UserAnalyticsCard — neither shows it), so per instruction this pairs
  // UserKpiCards against PendingVerificationTab's own pagination total
  // instead (both ultimately query the same GET /users?verificationState=
  // pending shape, just via different call sites).
  const usersPromise = waitForApi(page, '/users?', 'GET')
  await page.goto('/users')
  const usersResp = await usersPromise
  expect(usersResp.ok()).toBeTruthy()
  const usersBackendTotal = (await usersResp.json()).kpiSummary.pendingVerification

  const usersCardValue = await readUserKpiCardValue(page, 'Pending Verification')

  // Let the main tab's own initial fetch settle before clicking into the
  // Pending Verification tab — otherwise the next waitForResponse can catch
  // that still-in-flight request instead of the tab's own (same race class
  // fixed earlier in invitations.full.spec.ts's status filter test). The
  // verificationState=pending substring match is the real safeguard though,
  // since the main list's call never has that param.
  await page.waitForLoadState('networkidle')
  const tabPromise = waitForApi(page, 'verificationState=pending', 'GET')
  await page.getByRole('button', { name: 'Pending Verification' }).click()
  const tabResp = await tabPromise
  expect(tabResp.ok()).toBeTruthy()
  const tabBackendTotal = (await tabResp.json()).pagination.total

  // PendingVerificationTab renders its own total as "{total} pending
  // user(s)" (see PendingVerificationTab.tsx:262) — not a label+value card,
  // so just regex out the leading number.
  const tabCardText = (await page.getByText(/\d+ pending users?/).textContent()) ?? ''
  const tabCardValue = Number(tabCardText.match(/\d+/)?.[0] ?? NaN)

  expect(usersCardValue).toBe(usersBackendTotal)
  expect(tabCardValue).toBe(tabBackendTotal)
  expect(usersCardValue).toBe(tabCardValue)
})
