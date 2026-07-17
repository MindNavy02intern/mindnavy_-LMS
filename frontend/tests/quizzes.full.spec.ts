// Assessments tab (Quizzes & Exams) — end-to-end tests (v1: MULTIPLE_CHOICE,
// TRUE_FALSE, MULTI_SELECT, ESSAY question types only).
//
// No QUIZZES_CONTRACT.md exists in the repo — endpoints/shapes were reverse-
// engineered from backend/src/{routes,controllers,services,validators}/
// quizzes.*.js and verified live against a running server before this suite
// was written.
//
// §4.1 sequencing rule: a quiz must be created via a REAL API call before any
// question can be added to it. Every test that needs questions first creates
// the quiz via the API, never a hard-coded id.
//
// Zero data-leak rule: every quiz (and any fixture course) created here is
// captured by its real returned id and deleted/archived in afterAll — mirrors
// courses-invalidation.full.spec.ts / learning-paths.full.spec.ts.

import { type Page, test, expect } from '@playwright/test'

const API = 'http://localhost:5001/api/admin'

// ── Cleanup state ─────────────────────────────────────────────────────────────

let savedToken = ''
const createdQuizIds:   string[] = []
const createdCourseIds: string[] = []   // fixture courses; archived in afterAll

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }

  // Hard-delete quizzes (cascade removes questions)
  for (const id of createdQuizIds) {
    await request.delete(`${API}/quizzes/${id}`, { headers: H }).catch(() => null)
  }

  // Soft-archive fixture courses
  for (const id of createdCourseIds) {
    await request.delete(`${API}/courses/${id}`, { headers: H }).catch(() => null)
  }
})

// ── Auth + fixture helpers ────────────────────────────────────────────────────

async function ensureToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  expect(token, 'mn_admin_token must exist in localStorage').toBeTruthy()
  savedToken = token
  return token
}

async function apiHeaders(page: Page) {
  const token = await ensureToken(page)
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function getInstructorId(page: Page, H: Record<string, string>): Promise<string> {
  const res = await page.request.get(`${API}/lm/filter-options`, { headers: H })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.instructors?.[0]?.id
  expect(id, 'At least one INSTRUCTOR user must exist in the DB').toBeTruthy()
  return id
}

async function createFixtureCourse(page: Page, H: Record<string, string>, title: string): Promise<string> {
  const instructorId = await getInstructorId(page, H)
  const res = await page.request.post(`${API}/courses`, {
    data: { title, instructorId },
    headers: H,
  })
  expect(res.ok(), `POST /courses must succeed for "${title}"`).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id, 'Course id must be returned').toBeTruthy()
  createdCourseIds.push(id)
  return id
}

async function createFixtureQuiz(
  page: Page, H: Record<string, string>, title: string, extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await page.request.post(`${API}/quizzes`, {
    data: { title, ...extra },
    headers: H,
  })
  expect(res.ok(), `POST /quizzes must succeed for "${title}"`).toBeTruthy()
  const body = await res.json()
  const id: string = body.data?.id
  expect(id, 'Quiz id must be returned').toBeTruthy()
  createdQuizIds.push(id)
  return id
}

async function addQuestionViaApi(
  page: Page, H: Record<string, string>, quizId: string, payload: Record<string, unknown>,
) {
  const res = await page.request.post(`${API}/quizzes/${quizId}/questions`, { data: payload, headers: H })
  expect(res.ok(), 'POST /quizzes/:id/questions must succeed').toBeTruthy()
  return ((await res.json()).data) as { id: string; type: string }
}

// ── Navigation helper ─────────────────────────────────────────────────────────

async function gotoAssessmentsTab(page: Page) {
  await page.goto('/learning-management')
  await page.getByRole('button', { name: 'Assessments', exact: true }).click()
  await expect(page).toHaveURL(/[?&]tab=assessments/)
  await expect(page.getByRole('heading', { name: 'Assessments', exact: true })).toBeVisible({ timeout: 10000 })
}

// ── Tests: quiz CRUD ──────────────────────────────────────────────────────────

test('Create quiz without a course — form opens, validates, submits, appears in list', async ({ page }) => {
  await gotoAssessmentsTab(page)
  await ensureToken(page)

  const title = `Quiz Create Test ${Date.now()}`

  await page.getByRole('button', { name: 'Create Quiz', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Create Quiz' })).toBeVisible({ timeout: 5000 })

  // Submit disabled until title filled
  await expect(page.getByRole('button', { name: 'Create Quiz' })).toBeDisabled()

  await page.getByPlaceholder(/React Fundamentals Quiz/i).fill(title)
  await expect(page.getByRole('button', { name: 'Create Quiz' })).toBeEnabled()

  const postResp = page.waitForResponse(
    r => r.url().includes('/quizzes') && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Create Quiz' }).click()
  const resp = await postResp
  const body = await resp.json()
  const id: string = body.data?.id
  expect(id, 'POST must return a quiz id').toBeTruthy()
  createdQuizIds.push(id)

  // Defaults per backend contract
  expect(body.data.passingGrade).toBe(60)
  expect(body.data.attemptsAllowed).toBeNull()
  expect(body.data.timeLimit).toBeNull()
  expect(body.data.questionCount).toBe(0)

  await expect(page.getByRole('heading', { name: 'Assessments', exact: true })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(title)).toBeVisible()
})

test('Create quiz attached to a course — courseId carried through', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const courseTitle = `Quiz Course Fixture ${Date.now()}`
  const courseId = await createFixtureCourse(page, H, courseTitle)

  await gotoAssessmentsTab(page)
  const title = `Quiz Attached Test ${Date.now()}`

  await page.getByRole('button', { name: 'Create Quiz', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Create Quiz' })).toBeVisible({ timeout: 5000 })
  await page.getByPlaceholder(/React Fundamentals Quiz/i).fill(title)
  await page.getByLabel('Link to course').selectOption(courseId)

  const postResp = page.waitForResponse(
    r => r.url().includes('/quizzes') && r.request().method() === 'POST' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Create Quiz' }).click()
  const resp = await postResp
  const body = await resp.json()
  createdQuizIds.push(body.data.id)
  expect(body.data.courseId).toBe(courseId)

  await expect(page.getByText(title)).toBeVisible({ timeout: 5000 })
})

test('Edit quiz — passingGrade updates, attempts/timeLimit clear to unlimited/none (null)', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz Edit Test ${Date.now()}`
  const quizId = await createFixtureQuiz(page, H, title, { passingGrade: 50, attemptsAllowed: 5, timeLimit: 45 })

  await gotoAssessmentsTab(page)
  await expect(page.getByText(title)).toBeVisible({ timeout: 10000 })

  await page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
    .getByRole('button', { name: /Edit/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Edit Quiz' })).toBeVisible({ timeout: 5000 })

  // Change passingGrade, then explicitly clear attempts + time limit to null via their checkboxes
  const passingGradeInput = page.locator('input[type="number"]').first()
  await passingGradeInput.fill('75')
  await page.getByRole('checkbox', { name: 'Unlimited' }).check()
  await page.getByRole('checkbox', { name: 'No time limit' }).check()

  const patchResp = page.waitForResponse(
    r => r.url().includes('/quizzes/') && r.request().method() === 'PATCH' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Save Changes' }).click()
  const resp = await patchResp
  const body = await resp.json()
  expect(body.data.passingGrade).toBe(75)
  expect(body.data.attemptsAllowed, 'attemptsAllowed must clear to null (unlimited)').toBeNull()
  expect(body.data.timeLimit, 'timeLimit must clear to null (none)').toBeNull()

  void quizId
  await expect(page.getByRole('heading', { name: 'Assessments', exact: true })).toBeVisible({ timeout: 5000 })
})

test('Edit quiz: nothing changed → no PATCH sent (empty patch is a backend 400)', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz NoChange ${Date.now()}`
  await createFixtureQuiz(page, H, title)

  await gotoAssessmentsTab(page)
  await expect(page.getByText(title)).toBeVisible({ timeout: 10000 })

  await page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
    .getByRole('button', { name: /Edit/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Edit Quiz' })).toBeVisible()

  let patchFired = false
  page.on('request', req => {
    if (req.method() === 'PATCH' && req.url().includes('/quizzes/')) patchFired = true
  })

  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByRole('heading', { name: 'Assessments', exact: true })).toBeVisible({ timeout: 5000 })
  expect(patchFired, 'No PATCH when nothing changed').toBe(false)
})

test('Delete quiz — confirm dialog required, permanently removes quiz and its questions', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz Delete Test ${Date.now()}`
  const quizId = await createFixtureQuiz(page, H, title)
  await addQuestionViaApi(page, H, quizId, { type: 'ESSAY', prompt: 'Will be cascaded away' })

  await gotoAssessmentsTab(page)
  await expect(page.getByText(title)).toBeVisible({ timeout: 10000 })

  page.once('dialog', (d) => {
    expect(d.message()).toContain('permanently delete the quiz and all its questions')
    expect(d.message()).toContain('cannot be undone')
    d.accept()
  })

  const deleteResp = page.waitForResponse(
    r => r.url().includes(`/quizzes/${quizId}`) && r.request().method() === 'DELETE' && r.ok(),
    { timeout: 10000 },
  )
  await page.locator('tr').filter({ has: page.locator('td', { hasText: title }) })
    .getByRole('button', { name: /Delete/i }).first().click()
  await deleteResp

  await expect(page.getByText(title)).not.toBeVisible({ timeout: 5000 })

  const gone = await page.request.get(`${API}/quizzes/${quizId}`, { headers: H })
  expect(gone.status()).toBe(404)

  const idx = createdQuizIds.indexOf(quizId)
  if (idx !== -1) createdQuizIds.splice(idx, 1)
})

// ── Tests: question type picker (v1 scope guard) ────────────────────────────────

test('Question type picker offers ONLY the 4 v1 types — no Fill-in-Blank / Matching', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz Picker Guard ${Date.now()}`
  await createFixtureQuiz(page, H, title)

  await gotoAssessmentsTab(page)
  await page.getByText(title).first().click()
  await expect(page.getByRole('button', { name: 'Add Question' })).toBeVisible({ timeout: 5000 })

  // Empty quiz shows the empty state (questionCount starts at 0)
  await expect(page.getByText('No questions yet.')).toBeVisible()

  await page.getByRole('button', { name: 'Add Question' }).click()
  const dialog = page.getByRole('dialog', { name: /Add question/i })
  await expect(dialog).toBeVisible({ timeout: 5000 })

  await expect(dialog.getByRole('button', { name: 'Multiple Choice' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'True / False' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Multi-Select' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Essay' })).toBeVisible()

  // Exactly 4 type options in the picker grid
  await expect(dialog.locator('[aria-pressed]')).toHaveCount(4)

  const dialogText = await dialog.textContent()
  expect(dialogText).not.toMatch(/Fill.?in.?Blank/i)
  expect(dialogText).not.toMatch(/Matching/i)
})

// ── Tests: questions — all 4 v1 types, correct data shapes ──────────────────────

test('Add all 4 question types via the UI — correct data shapes, Essay flagged manually graded', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz AllTypes ${Date.now()}`
  const quizId = await createFixtureQuiz(page, H, title)

  await gotoAssessmentsTab(page)
  await page.getByText(title).first().click()
  await expect(page.getByRole('button', { name: 'Add Question' })).toBeVisible({ timeout: 5000 })

  // MULTIPLE_CHOICE — 3 options, correct = index 1
  await page.getByRole('button', { name: 'Add Question' }).click()
  let dialog = page.getByRole('dialog', { name: /Add question/i })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await dialog.getByRole('button', { name: 'Multiple Choice' }).click()
  await dialog.getByPlaceholder('Enter the question text…').fill('Which hook manages local state?')
  await dialog.getByLabel('Option 1 text').fill('useEffect')
  await dialog.getByLabel('Option 2 text').fill('useState')
  await dialog.getByRole('button', { name: 'Add option' }).click()
  await dialog.getByLabel('Option 3 text').fill('useRef')
  await dialog.getByLabel('Mark option 2 as correct').check()
  let postResp = page.waitForResponse(r => r.url().includes('/questions') && r.request().method() === 'POST' && r.ok(), { timeout: 10000 })
  await dialog.getByRole('button', { name: 'Add Question' }).click()
  let resp = await postResp
  let body = (await resp.json()).data
  expect(body.type).toBe('MULTIPLE_CHOICE')
  expect(body.data.options).toEqual(['useEffect', 'useState', 'useRef'])
  expect(body.data.correctIndex).toBe(1)
  await expect(dialog).not.toBeVisible({ timeout: 5000 })

  // TRUE_FALSE — correct = true
  await page.getByRole('button', { name: 'Add Question' }).click()
  dialog = page.getByRole('dialog', { name: /Add question/i })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await dialog.getByRole('button', { name: 'True / False' }).click()
  await dialog.getByPlaceholder('Enter the question text…').fill('React re-renders every component on every state change.')
  await dialog.getByRole('button', { name: 'True', exact: true }).click()
  postResp = page.waitForResponse(r => r.url().includes('/questions') && r.request().method() === 'POST' && r.ok(), { timeout: 10000 })
  await dialog.getByRole('button', { name: 'Add Question' }).click()
  resp = await postResp
  body = (await resp.json()).data
  expect(body.type).toBe('TRUE_FALSE')
  expect(body.data.correct).toBe(true)
  await expect(dialog).not.toBeVisible({ timeout: 5000 })

  // MULTI_SELECT — 2 correct answers, options + indexes preserved
  await page.getByRole('button', { name: 'Add Question' }).click()
  dialog = page.getByRole('dialog', { name: /Add question/i })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await dialog.getByRole('button', { name: 'Multi-Select' }).click()
  await dialog.getByPlaceholder('Enter the question text…').fill('Which of these are valid array methods?')
  await dialog.getByLabel('Option 1 text').fill('map')
  await dialog.getByLabel('Option 2 text').fill('push')
  await dialog.getByRole('button', { name: 'Add option' }).click()
  await dialog.getByLabel('Option 3 text').fill('reducer')
  await dialog.getByLabel('Mark option 1 as correct').check()
  await dialog.getByLabel('Mark option 3 as correct').check()
  postResp = page.waitForResponse(r => r.url().includes('/questions') && r.request().method() === 'POST' && r.ok(), { timeout: 10000 })
  await dialog.getByRole('button', { name: 'Add Question' }).click()
  resp = await postResp
  body = (await resp.json()).data
  expect(body.type).toBe('MULTI_SELECT')
  expect(body.data.correctIndexes.sort()).toEqual([0, 2])
  await expect(dialog).not.toBeVisible({ timeout: 5000 })

  // ESSAY — no answer data, manually graded badge shown
  await page.getByRole('button', { name: 'Add Question' }).click()
  dialog = page.getByRole('dialog', { name: /Add question/i })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await dialog.getByRole('button', { name: 'Essay' }).click()
  await dialog.getByPlaceholder('Enter the question text…').fill('Explain the virtual DOM in your own words.')
  postResp = page.waitForResponse(r => r.url().includes('/questions') && r.request().method() === 'POST' && r.ok(), { timeout: 10000 })
  await dialog.getByRole('button', { name: 'Add Question' }).click()
  resp = await postResp
  body = (await resp.json()).data
  expect(body.type).toBe('ESSAY')
  expect(body.data).toBeNull()
  await expect(dialog).not.toBeVisible({ timeout: 5000 })

  // Badge visible on the essay row without a reload — appended locally
  await expect(page.getByText('Manually graded')).toBeVisible({ timeout: 5000 })

  // All 4 prompts visible in the list, no refetch-flicker issue
  await expect(page.getByText('Which hook manages local state?')).toBeVisible()
  await expect(page.getByText('React re-renders every component on every state change.')).toBeVisible()
  await expect(page.getByText('Which of these are valid array methods?')).toBeVisible()
  await expect(page.getByText('Explain the virtual DOM in your own words.')).toBeVisible()

  void quizId
})

test('Edit an existing question — type+data always sent together, change persists', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz EditQuestion ${Date.now()}`
  const quizId = await createFixtureQuiz(page, H, title)
  const q = await addQuestionViaApi(page, H, quizId, {
    type: 'TRUE_FALSE', prompt: 'Original prompt', data: { correct: false },
  })

  await gotoAssessmentsTab(page)
  await page.getByText(title).first().click()
  await expect(page.getByText('Original prompt')).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: /Edit question: Original prompt/i }).click()
  const dialog = page.getByRole('dialog', { name: /Edit question/i })
  await expect(dialog).toBeVisible({ timeout: 5000 })

  // Flip the correct answer without changing type — UI must still bundle (type, data)
  await dialog.getByRole('button', { name: 'True', exact: true }).click()

  let patchBody: Record<string, unknown> | undefined
  const patchResp = page.waitForResponse(async r => {
    if (r.url().includes(`/questions/${q.id}`) && r.request().method() === 'PATCH') {
      patchBody = r.request().postDataJSON()
      return true
    }
    return false
  }, { timeout: 10000 })
  await dialog.getByRole('button', { name: 'Save Changes' }).click()
  const resp = await patchResp
  expect(resp.ok(), 'PATCH must succeed').toBeTruthy()
  expect(patchBody?.type, 'type must be present whenever data is present').toBe('TRUE_FALSE')
  expect((patchBody?.data as { correct: boolean }).correct, 'data must be present whenever type is present').toBe(true)

  await expect(dialog).not.toBeVisible({ timeout: 5000 })
})

test('Delete a question — confirm required, removed from the list', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz DeleteQuestion ${Date.now()}`
  const quizId = await createFixtureQuiz(page, H, title)
  const q = await addQuestionViaApi(page, H, quizId, {
    type: 'ESSAY', prompt: 'Question to delete',
  })

  await gotoAssessmentsTab(page)
  await page.getByText(title).first().click()
  await expect(page.getByText('Question to delete')).toBeVisible({ timeout: 10000 })

  page.once('dialog', (d) => d.accept())
  const deleteResp = page.waitForResponse(
    r => r.url().includes(`/questions/${q.id}`) && r.request().method() === 'DELETE' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: /Delete question: Question to delete/i }).click()
  await deleteResp

  await expect(page.getByText('Question to delete')).not.toBeVisible({ timeout: 5000 })
})

// ── Tests: question editor never silently no-ops on invalid submit ─────────────
// Regression coverage: "Add Question" used to fail validation correctly but
// show NO error at all (the message rendered below the fold in the scrollable
// dialog), so a missing required field looked exactly like a dead button.
// One case per question type, each hitting that type's natural required-field gap.

test('Multiple Choice: no correct answer selected → visible error, no POST, dialog stays open', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz MCNoAnswer ${Date.now()}`
  await createFixtureQuiz(page, H, title)

  await gotoAssessmentsTab(page)
  await page.getByText(title).first().click()
  await expect(page.getByRole('button', { name: 'Add Question' })).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: 'Add Question' }).click()
  const dialog = page.getByRole('dialog', { name: /Add question/i })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  // MULTIPLE_CHOICE is the default type — fill prompt + both default options,
  // but never select a correct answer.
  await dialog.getByPlaceholder('Enter the question text…').fill('Which one is correct?')
  await dialog.getByLabel('Option 1 text').fill('First')
  await dialog.getByLabel('Option 2 text').fill('Second')

  let postFired = false
  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/questions')) postFired = true
  })

  await dialog.getByRole('button', { name: 'Add Question' }).click()

  await expect(dialog.getByRole('alert')).toContainText('Select the correct answer before saving.', { timeout: 5000 })
  await expect(dialog).toBeVisible()
  expect(postFired, 'Save must not call the API when validation fails').toBe(false)
})

test('True/False: empty prompt → visible error, no POST, dialog stays open', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz TFNoPrompt ${Date.now()}`
  await createFixtureQuiz(page, H, title)

  await gotoAssessmentsTab(page)
  await page.getByText(title).first().click()
  await expect(page.getByRole('button', { name: 'Add Question' })).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: 'Add Question' }).click()
  const dialog = page.getByRole('dialog', { name: /Add question/i })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await dialog.getByRole('button', { name: 'True / False' }).click()
  await dialog.getByRole('button', { name: 'True', exact: true }).click()
  // Prompt left empty on purpose

  let postFired = false
  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/questions')) postFired = true
  })

  await dialog.getByRole('button', { name: 'Add Question' }).click()

  await expect(dialog.getByRole('alert')).toContainText('Prompt is required.', { timeout: 5000 })
  await expect(dialog).toBeVisible()
  expect(postFired, 'Save must not call the API when validation fails').toBe(false)
})

test('Multi-Select: no correct checkboxes selected → visible error, no POST, dialog stays open', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz MSNoAnswer ${Date.now()}`
  await createFixtureQuiz(page, H, title)

  await gotoAssessmentsTab(page)
  await page.getByText(title).first().click()
  await expect(page.getByRole('button', { name: 'Add Question' })).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: 'Add Question' }).click()
  const dialog = page.getByRole('dialog', { name: /Add question/i })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await dialog.getByRole('button', { name: 'Multi-Select' }).click()
  await dialog.getByPlaceholder('Enter the question text…').fill('Pick any that apply')
  await dialog.getByLabel('Option 1 text').fill('First')
  await dialog.getByLabel('Option 2 text').fill('Second')
  // No checkboxes checked on purpose

  let postFired = false
  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/questions')) postFired = true
  })

  await dialog.getByRole('button', { name: 'Add Question' }).click()

  await expect(dialog.getByRole('alert')).toContainText('Select at least one correct answer before saving.', { timeout: 5000 })
  await expect(dialog).toBeVisible()
  expect(postFired, 'Save must not call the API when validation fails').toBe(false)
})

test('Essay: empty prompt → visible error, no POST, dialog stays open', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz EssayNoPrompt ${Date.now()}`
  await createFixtureQuiz(page, H, title)

  await gotoAssessmentsTab(page)
  await page.getByText(title).first().click()
  await expect(page.getByRole('button', { name: 'Add Question' })).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: 'Add Question' }).click()
  const dialog = page.getByRole('dialog', { name: /Add question/i })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await dialog.getByRole('button', { name: 'Essay' }).click()
  // Prompt left empty on purpose

  let postFired = false
  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/questions')) postFired = true
  })

  await dialog.getByRole('button', { name: 'Add Question' }).click()

  await expect(dialog.getByRole('alert')).toContainText('Prompt is required.', { timeout: 5000 })
  await expect(dialog).toBeVisible()
  expect(postFired, 'Save must not call the API when validation fails').toBe(false)
})

test('Reorder questions — ONE bulk PATCH to /reorder, state replaced from full response', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz Reorder ${Date.now()}`
  const quizId = await createFixtureQuiz(page, H, title)
  await addQuestionViaApi(page, H, quizId, { type: 'ESSAY', prompt: 'Question A' })
  await addQuestionViaApi(page, H, quizId, { type: 'ESSAY', prompt: 'Question B' })

  await gotoAssessmentsTab(page)
  await page.getByText(title).first().click()
  await expect(page.getByText('Question A')).toBeVisible({ timeout: 10000 })

  let reorderCallCount = 0
  page.on('request', req => {
    if (req.method() === 'PATCH' && req.url().includes('/reorder')) reorderCallCount++
  })

  const reorderResp = page.waitForResponse(
    r => r.url().includes('/reorder') && r.request().method() === 'PATCH' && r.ok(),
    { timeout: 10000 },
  )
  await page.getByRole('button', { name: 'Move question up' }).nth(1).click()
  const resp = await reorderResp
  const body = await resp.json()

  expect(reorderCallCount, 'Exactly ONE bulk PATCH to /reorder').toBe(1)
  // Response carries the FULL quiz detail — used to replace local state
  expect(body.data.id).toBe(quizId)
  expect(Array.isArray(body.data.questions)).toBe(true)
  expect(body.data.questions[0].prompt).toBe('Question B')
})

// ── Test: backend validation guard (direct API — this UI can never send it) ────

test('PATCH question with type but no data → 400 (verifies the pairing rule the UI is built to never violate)', async ({ page }) => {
  await page.goto('/dashboard')
  const H = await apiHeaders(page)
  const title = `Quiz TypeDataGuard ${Date.now()}`
  const quizId = await createFixtureQuiz(page, H, title)
  const q = await addQuestionViaApi(page, H, quizId, {
    type: 'TRUE_FALSE', prompt: 'Guard check', data: { correct: false },
  })

  const res = await page.request.patch(`${API}/quizzes/${quizId}/questions/${q.id}`, {
    data: { type: 'MULTIPLE_CHOICE' }, // type WITHOUT data
    headers: H,
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.message).toMatch(/type and data must be provided together/i)
})
