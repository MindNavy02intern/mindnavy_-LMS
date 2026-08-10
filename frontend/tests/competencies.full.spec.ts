import { test, expect } from '@playwright/test'

// Competencies module — full stack (Parts 1-4). Real backend throughout (no
// route mocking) — a disposable learner + skill + framework are created via
// the real UI/API, same pattern as learners.full.spec.ts. See
// backend/contact md files/COMPETENCIES_CONTRACT.md for the endpoint shapes.
//
// Run with: npx playwright test competencies.full --workers=1
//
// CLEANUP NOTE (documented, not a bug): `skillId` gets a real
// SkillAssessment + UserSkillProfile row from the assessment test. Per the
// contract (note 3), DELETE /skills/:id 409s while ANY such row references
// it, and there is no delete endpoint for assessments/profiles (same
// append-only-history shape as Learners' QuizAttempt — no delete-attempt
// endpoint exists there either). afterAll deletes the framework (unguarded,
// cascades its FrameworkSkill row) then tries to delete the skill; if that
// 409s (expected, once the assessment test has run) it archives the skill
// instead — the same "everyday deactivation" terminal state a real admin
// would reach, not a leaked row.

const API = 'http://localhost:5001/api/admin'

let savedToken: string | null = null
let learnerId: string | null = null
let learnerName: string | null = null
let skillId: string | null = null
let skillName: string | null = null
let frameworkId: string | null = null
let frameworkName: string | null = null

test.beforeAll(async ({ browser, request }) => {
  const page = await browser.newPage()
  await page.goto('/competencies')
  savedToken = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  await page.close()
  if (!savedToken) return

  const stamp = Date.now()
  learnerName = `QA Competencies Learner ${stamp}`
  const learnerResp = await request.post(`${API}/learners`, {
    headers: { Authorization: `Bearer ${savedToken}` },
    data: {
      fullName: learnerName,
      email: `qa.competencies.learner.${stamp}@example.com`,
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

  // Framework delete is unguarded (cascades its FrameworkSkill row) — always
  // safe, do it before touching the skill.
  if (frameworkId) {
    await request.delete(`${API}/competencies/frameworks/${frameworkId}`, { headers: H }).catch(() => null)
  }
  if (skillId) {
    const del = await request.delete(`${API}/competencies/skills/${skillId}`, { headers: H }).catch(() => null)
    if (!del || !del.ok()) {
      // Expected 409 SKILL_IN_USE once the assessment test ran (real
      // SkillAssessment/UserSkillProfile history now references it, and
      // there's no delete endpoint for either) — archive instead of leaving
      // an active row cluttering the Competency List.
      await request.patch(`${API}/competencies/skills/${skillId}`, { headers: H, data: { status: 'ARCHIVED' } }).catch(() => null)
    }
  }
  if (learnerId) {
    await request.delete(`${API}/learners/${learnerId}`, { headers: H }).catch(() => null)
  }
})

test('Competencies page loads with header, stats cards and tabs', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/competencies/stats') && r.ok(), { timeout: 15000 }),
    page.goto('/competencies'),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByRole('heading', { name: 'Competencies' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Total Competencies')).toBeVisible({ timeout: 10000 })
  for (const label of ['Overview', 'Competency List', 'Frameworks', 'Categories', 'Assessments', 'Skill Gaps']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 10000 })
  }
})

test('Create Competency creates a skill and it appears in the Competency List tab', async ({ page }) => {
  const stamp = Date.now()
  skillName = `QA Competency ${stamp}`

  // From Overview (not the List tab) — the List tab has its own local
  // "Create Competency" trigger too, and both share the same visible text,
  // so this avoids a two-match locator collision.
  await page.goto('/competencies')
  await expect(page.getByRole('heading', { name: 'Competencies' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'Create Competency', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create Competency' })).toBeVisible({ timeout: 5000 })
  await page.getByPlaceholder('e.g. React Development').fill(skillName)

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/competencies/skills') && r.request().method() === 'POST', { timeout: 15000 }),
    page.locator('form button[type="submit"]').click(),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  skillId = body?.data?.id ?? null
  expect(skillId, 'Created skill must return a real id').toBeTruthy()

  const [listResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/competencies/skills?') && r.ok(), { timeout: 15000 }),
    page.goto('/competencies?tab=list'),
  ])
  expect(listResp.ok()).toBeTruthy()
  await expect(page.getByText(skillName)).toBeVisible({ timeout: 10000 })
})

test('Creating a framework and adding the competency as a required skill', async ({ page }) => {
  test.skip(!skillId, 'Setup skill was not created — backend may be unavailable')
  const stamp = Date.now()
  frameworkName = `QA Framework ${stamp}`

  await page.goto('/competencies?tab=frameworks')
  await expect(page.locator('button[aria-label="Add Framework"]')).toBeVisible({ timeout: 10000 })

  await page.locator('button[aria-label="Add Framework"]').click()
  await expect(page.getByRole('heading', { name: 'Create Framework' })).toBeVisible({ timeout: 5000 })
  await page.getByPlaceholder('e.g. Frontend Developer').fill(frameworkName)

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/competencies/frameworks') && r.request().method() === 'POST', { timeout: 15000 }),
    page.locator('form button[type="submit"]').click(),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  frameworkId = body?.data?.id ?? null
  expect(frameworkId, 'Created framework must return a real id').toBeTruthy()

  // Select it explicitly — the list doesn't reliably auto-select a freshly
  // created row if another framework already existed and was selected.
  await page.getByText(frameworkName, { exact: true }).first().click()
  await expect(page.getByText('Required Skills')).toBeVisible({ timeout: 10000 })

  // Exactly 3 <select>s exist in this view: add-skill, required-level, importance.
  const selects = page.locator('select')
  await selects.nth(0).selectOption({ label: skillName as string })
  await selects.nth(1).selectOption({ label: 'Certified' })

  const [addResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/competencies/frameworks/${frameworkId}/skills`) && r.request().method() === 'POST', { timeout: 15000 }),
    page.locator('button[aria-label="Add skill to framework"]').click(),
  ])
  expect(addResp.ok()).toBeTruthy()

  const row = page.locator('tr', { hasText: skillName as string })
  await expect(row).toBeVisible({ timeout: 10000 })
  await expect(row.getByText('Certified')).toBeVisible({ timeout: 10000 })
})

test('Recording an assessment updates the user, surfaces a skill gap, and renders in User Progress', async ({ page }) => {
  test.skip(!skillId || !frameworkId || !learnerId, 'Setup skill/framework/learner was not created — backend may be unavailable')

  await page.goto('/competencies?tab=assessments')
  await page.getByRole('button', { name: 'New Assessment', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Record Assessment' })).toBeVisible({ timeout: 5000 })

  await page.locator('#assessment-user-search').fill(learnerName as string)
  await expect(page.getByRole('button', { name: new RegExp(learnerName as string) })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: new RegExp(learnerName as string) }).click()

  await page.locator('#assessment-skill').selectOption({ label: skillName as string })
  await page.locator('#assessment-score').fill('20')
  await page.locator('#assessment-maxscore').fill('100')

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/competencies/assessments') && r.request().method() === 'POST', { timeout: 15000 }),
    page.locator('form button[type="submit"]').click(),
  ])
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  // 20% -> BEGINNER (rank 1); required CERTIFIED (rank 5) -> gapSize 4.
  expect(body?.data?.profile?.currentLevel).toBe('BEGINNER')

  // Skill gap surfaces on the Skill Gaps tab.
  const [gapsResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/competencies/skill-gaps') && r.ok(), { timeout: 15000 }),
    page.goto('/competencies?tab=gaps'),
  ])
  expect(gapsResp.ok()).toBeTruthy()
  const gapRow = page.locator('tr', { hasText: skillName as string })
  await expect(gapRow).toBeVisible({ timeout: 10000 })
  await expect(gapRow.getByText(learnerName as string)).toBeVisible({ timeout: 10000 })
  await expect(gapRow.getByText('4', { exact: true })).toBeVisible({ timeout: 10000 })

  // Same data reflected in User Progress.
  await page.goto('/competencies?tab=progress')
  await page.locator('input[placeholder="Search a user by name or email…"]').fill(learnerName as string)
  await expect(page.getByRole('button', { name: new RegExp(learnerName as string) })).toBeVisible({ timeout: 10000 })

  const [progressResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(`/competencies/users/${learnerId}/skills`) && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: new RegExp(learnerName as string) }).click(),
  ])
  expect(progressResp.ok()).toBeTruthy()
  await expect(page.getByText(skillName as string)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('20% proficiency')).toBeVisible({ timeout: 10000 })
})

test('Overview analytics charts render', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/competencies/analytics') && r.ok(), { timeout: 15000 }),
    page.goto('/competencies'),
  ])
  expect(resp.ok()).toBeTruthy()

  await expect(page.getByText('Competency Categories')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Skill Gap Overview')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Proficiency Trend')).toBeVisible({ timeout: 10000 })
  // Not "Competency Matrix" by itself — the header button has identical text;
  // its chart-card action link is the unique signal that this section rendered.
  await expect(page.getByText('View Full Competency Matrix')).toBeVisible({ timeout: 10000 })
  // At least one recharts SVG actually mounted, not just the card shells.
  await expect(page.locator('.recharts-wrapper').first()).toBeVisible({ timeout: 10000 })
})

test('Competency Matrix header button switches to Overview and scrolls the matrix into view', async ({ page }) => {
  await page.goto('/competencies')
  await expect(page.getByRole('heading', { name: 'Competencies' })).toBeVisible({ timeout: 10000 })

  // Start from a different tab so the click has to both switch tabs AND scroll.
  await page.getByRole('button', { name: 'Competency List', exact: true }).click()
  await expect(page).toHaveURL(/tab=list/, { timeout: 10000 })

  await page.getByRole('button', { name: 'Competency Matrix', exact: true }).click()
  await expect(page).toHaveURL(/tab=overview/, { timeout: 10000 })
  await expect(page.locator('#matrix')).toBeInViewport({ timeout: 10000 })

  // Scroll away, then click again while ALREADY on Overview — the effect is
  // token-based (bumped on every click), not a mount-only effect that would
  // silently no-op on a second click from the same tab.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.getByRole('button', { name: 'Competency Matrix', exact: true }).click()
  await expect(page.locator('#matrix')).toBeInViewport({ timeout: 10000 })
})

test('Import/Export tab: export downloads a CSV and import creates a competency', async ({ page, request }) => {
  await page.goto('/competencies?tab=import-export')
  await expect(page.getByText('Export Competencies', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Import Competencies', { exact: true }).first()).toBeVisible({ timeout: 10000 })

  // ── Export ──
  const [download, exportResp] = await Promise.all([
    page.waitForEvent('download'),
    page.waitForResponse(r => r.url().includes('/competencies/skills/export') && r.ok(), { timeout: 15000 }),
    page.getByRole('button', { name: 'Download CSV', exact: true }).click(),
  ])
  expect(exportResp.ok()).toBeTruthy()
  expect(download.suggestedFilename()).toMatch(/^competencies-export-.*\.csv$/)

  // ── Import ──
  const stamp = Date.now()
  const importSkillName = `QA Import Competency ${stamp}`
  const csvContent = `Name,Category,Level,Status\n${importSkillName},,INTERMEDIATE,ACTIVE\n`
  await page.setInputFiles('input[type="file"]', {
    name: 'qa-import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvContent),
  })
  await expect(page.getByText(importSkillName)).toBeVisible({ timeout: 5000 })

  const [importResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/competencies/skills/import') && r.request().method() === 'POST', { timeout: 15000 }),
    page.getByRole('button', { name: 'Import Competencies', exact: true }).click(),
  ])
  expect(importResp.ok()).toBeTruthy()
  const importBody = await importResp.json()
  expect(importBody?.summary?.created).toBe(1)
  expect(importBody?.summary?.failed).toBe(0)

  await expect(page.getByText('Import completed.', { exact: true })).toBeVisible({ timeout: 10000 })

  // Reflected in the Competency List tab (no page reload — same reflection
  // rule the rest of this suite follows).
  const [listResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/competencies/skills?') && r.ok(), { timeout: 15000 }),
    page.goto('/competencies?tab=list'),
  ])
  expect(listResp.ok()).toBeTruthy()
  await expect(page.getByText(importSkillName)).toBeVisible({ timeout: 10000 })

  // Cleanup — imported skill has no assessment/framework history, so a plain
  // hard delete succeeds (unlike the setup skill in afterAll, which doesn't
  // by the time the assessment test has run).
  if (savedToken) {
    const H = { Authorization: `Bearer ${savedToken}` }
    const lookup = await request.get(`${API}/competencies/skills?search=${encodeURIComponent(importSkillName)}`, { headers: H })
    const lookupBody = await lookup.json().catch(() => null)
    const importedId: string | null = lookupBody?.data?.skills?.[0]?.id ?? null
    if (importedId) {
      await request.delete(`${API}/competencies/skills/${importedId}`, { headers: H }).catch(() => null)
    }
  }
})

test('Settings tab: updating the passing threshold persists via PATCH and survives reload', async ({ page }) => {
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/competencies/settings') && r.request().method() === 'GET' && r.ok(), { timeout: 15000 }),
    page.goto('/competencies?tab=settings'),
  ])
  expect(resp.ok()).toBeTruthy()
  await expect(page.getByText('Assessment Passing Threshold', { exact: true })).toBeVisible({ timeout: 10000 })

  const input = page.locator('#settings-passing-threshold')
  await expect(input).toBeVisible({ timeout: 10000 })
  const original = await input.inputValue()
  const updatedValue = original === '65' ? '70' : '65'
  await input.fill(updatedValue)

  const [patchResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/competencies/settings') && r.request().method() === 'PATCH', { timeout: 15000 }),
    page.getByRole('button', { name: 'Save Changes', exact: true }).click(),
  ])
  expect(patchResp.ok()).toBeTruthy()
  const patchBody = await patchResp.json()
  expect(patchBody?.data?.passingThresholdPercent).toBe(Number(updatedValue))

  // Reload to confirm the value actually persisted server-side, not just in
  // local component state.
  const [reloadResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/competencies/settings') && r.request().method() === 'GET' && r.ok(), { timeout: 15000 }),
    page.reload(),
  ])
  expect(reloadResp.ok()).toBeTruthy()
  await expect(page.locator('#settings-passing-threshold')).toHaveValue(updatedValue, { timeout: 10000 })

  // Restore the original value — Settings is a shared singleton row (unlike
  // the disposable skill/framework/learner fixtures elsewhere in this file),
  // so leaving it mutated would affect every other admin and test run.
  await page.locator('#settings-passing-threshold').fill(original)
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/competencies/settings') && r.request().method() === 'PATCH', { timeout: 15000 }),
    page.getByRole('button', { name: 'Save Changes', exact: true }).click(),
  ])
})
