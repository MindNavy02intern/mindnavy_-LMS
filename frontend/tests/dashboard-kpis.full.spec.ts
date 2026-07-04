import { test, expect } from '@playwright/test'

// Asserts all 9 KPI cards from IMPACT_MAP §4a are present on the Dashboard.
//
// Blueprint: docs/blueprint/pages/01-dashboard.md widget #2
// "Quick Statistics — 9 KPI cards"
// All 9 cards read from the same query key ['dashboard','stats'] / getDashboardCore().
//
// Backend status (2026-07):
//   Live data (real counts):  Total Users · Active Learners · Courses
//                             Active Instructors · Pending Approvals · Live Sessions
//   Phase 2 stubs (show "—"): Completions · Revenue · Active Subscriptions
//                              (tables not yet built — confirm with Hassan)

test('Dashboard shows all 9 KPI card labels', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const labels = [
    'Total Users',
    'Active Learners',
    'Courses',
    'Completions',
    'Revenue',
    'Active Instructors',
    'Pending Approvals',
    'Active Subscriptions',
    'Live Sessions',
  ]

  for (const label of labels) {
    await expect(
      page.locator('.mn-lkpi-label', { hasText: label }),
      `KPI card label "${label}" must be visible`,
    ).toBeVisible({ timeout: 10000 })
  }
})

test('Dashboard KPI cards with live backend data show numeric values', async ({ page }) => {
  // Only cards backed by real DB counts are asserted here.
  // Phase 2 stubs (Completions, Revenue, Active Subscriptions) legitimately show
  // "—" until their tables are built — asserting "—" is acceptable for those.
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })

  const liveDataLabels = [
    'Total Users',         // prisma.appUser.count (always ≥ 1 — the logged-in admin)
    'Active Learners',     // prisma.appUser.count(role:LEARNER, status:ACTIVE)
    'Active Instructors',  // prisma.appUser.count(role:INSTRUCTOR, status:ACTIVE)
    'Pending Approvals',   // prisma.appUser.count(verificationState:PENDING)
    'Live Sessions',       // prisma.appUserSession.count(active, not expired)
  ]

  for (const label of liveDataLabels) {
    const card = page.locator('.mn-lkpi-card').filter({
      has: page.locator('.mn-lkpi-label', { hasText: label }),
    })
    await expect(card).toBeVisible({ timeout: 10000 })
    const value = await card.locator('.mn-lkpi-value').innerText({ timeout: 5000 })
    expect(
      value,
      `"${label}" KPI must show a numeric value, got "${value}"`,
    ).toMatch(/^\d/)
  }
})

test('Dashboard loads exactly 9 KPI cards (no skeleton)', async ({ page }) => {
  await page.goto('/dashboard')
  // Wait for load to complete — skeletons are replaced by real cards
  await expect(page.locator('.mn-lkpi-grid .mn-lkpi-card').first()).toBeVisible({ timeout: 15000 })
  // Skeleton uses mn-lkpi-card too but has mn-skeleton children — real cards have mn-lkpi-label
  const realCards = page.locator('.mn-lkpi-card').filter({
    has: page.locator('.mn-lkpi-label'),
  })
  await expect(realCards).toHaveCount(9, { timeout: 10000 })
})
