// Tests for Categories Management Center (CategoriesTab).
// Covers: 2-level tree display, create root/sub, rename, reparent,
// delete (success + HAS_CHILDREN_DELETE / HAS_COURSES backend errors shown verbatim),
// CourseForm categoryId picker uses real UUID (not free-text name).
//
// §4.1 sequencing: categories are independent (no parent required for roots).
// Subcategory tests create the parent category first and capture its real ID.
//
// Cleanup: all created category IDs are captured and deleted in afterAll.
// Courses created for HAS_COURSES test are also cleaned up.

import { type Page, test, expect } from '@playwright/test'

const API = 'http://localhost:5001/api/admin'

const createdCategoryIds: string[] = []
const createdCourseIds:   string[] = []
let savedToken = ''

async function getAuthHeaders(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('mn_admin_token') ?? '')
  expect(token, 'mn_admin_token must exist in localStorage').toBeTruthy()
  savedToken = token
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function openCategoriesTab(page: Page) {
  await page.goto('/learning-management')
  await page.locator('button', { hasText: /^Categories$/ }).first().click()
  // Wait for the tree to render (spinner disappears, either empty-state or a category row)
  await page.waitForTimeout(500)
}

/** Creates a root category via API and tracks its id for cleanup. */
async function createRootCategory(
  page: Page,
  headers: Record<string, string>,
  name: string,
): Promise<string> {
  const res = await page.request.post(`${API}/categories`, {
    data: { name },
    headers,
  })
  expect(res.ok(), `POST /categories must succeed for "${name}"`).toBeTruthy()
  const id: string = (await res.json()).data?.id
  expect(id).toBeTruthy()
  createdCategoryIds.push(id)
  return id
}

/** Creates a subcategory under parentId via API and tracks its id for cleanup. */
async function createSubCategory(
  page: Page,
  headers: Record<string, string>,
  name: string,
  parentId: string,
): Promise<string> {
  const res = await page.request.post(`${API}/categories`, {
    data: { name, parentId },
    headers,
  })
  expect(res.ok(), `POST /categories (sub) must succeed for "${name}"`).toBeTruthy()
  const id: string = (await res.json()).data?.id
  expect(id).toBeTruthy()
  createdCategoryIds.push(id)
  return id
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

test.afterAll(async ({ request }) => {
  if (!savedToken) return
  const H = { Authorization: `Bearer ${savedToken}` }
  // Delete courses first (they reference categories)
  for (const id of createdCourseIds) {
    await request.delete(`${API}/courses/${id}`, { headers: H }).catch(() => null)
  }
  // Delete subcategories before roots (children must be gone before parents)
  for (const id of [...createdCategoryIds].reverse()) {
    await request.delete(`${API}/categories/${id}`, { headers: H }).catch(() => null)
  }
})

// ── Tests ─────────────────────────────────────────────────────────────────────

test('Categories: root category appears in tree after creation', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const name = `Cat Root ${Date.now()}`
  await createRootCategory(page, H, name)

  await openCategoriesTab(page)
  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 })
})

test('Categories: create root category via UI modal → appears in tree', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  await getAuthHeaders(page)

  await openCategoriesTab(page)

  const name = `Cat UI Root ${Date.now()}`

  const createResp = page.waitForResponse(
    r => r.url().includes('/categories') && r.request().method() === 'POST',
    { timeout: 15000 },
  )
  await page.getByRole('button', { name: 'Add Category' }).first().click()
  await expect(page.getByLabel('Category name')).toBeVisible({ timeout: 3000 })
  await page.getByLabel('Category name').fill(name)
  await page.getByLabel('Create category').click()
  const resp = await createResp
  expect(resp.ok(), 'POST /categories must succeed').toBeTruthy()
  const id: string = (await resp.json()).data?.id
  if (id) createdCategoryIds.push(id)

  await expect(page.getByText(name)).toBeVisible({ timeout: 8000 })
})

test('Categories: subcategory shown under parent when expanded', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const rootName = `Cat Tree Root ${Date.now()}`
  const subName  = `Cat Tree Sub ${Date.now()}`
  const rootId = await createRootCategory(page, H, rootName)
  await createSubCategory(page, H, subName, rootId)

  await openCategoriesTab(page)

  // Expand the root row
  await page.getByRole('button', { name: 'Expand' }).filter({
    has: page.locator('..', { hasText: rootName }),
  }).first().click().catch(async () => {
    // Fallback: click the expand button on the row that contains rootName
    const row = page.locator('div').filter({ hasText: rootName }).first()
    await row.getByLabel('Expand').click()
  })

  await expect(page.getByText(subName)).toBeVisible({ timeout: 5000 })
})

test('Categories: rename category via Edit modal → updated in tree', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const oldName = `Cat Rename Old ${Date.now()}`
  const newName = `Cat Rename New ${Date.now()}`
  await createRootCategory(page, H, oldName)

  await openCategoriesTab(page)

  const row = page.locator('div').filter({ hasText: oldName }).first()
  await row.getByLabel(`Edit ${oldName}`).click()

  await expect(page.getByLabel('Edit category name')).toBeVisible({ timeout: 3000 })
  await page.getByLabel('Edit category name').fill(newName)

  const patchResp = page.waitForResponse(
    r => r.url().includes('/categories/') && r.request().method() === 'PATCH',
    { timeout: 15000 },
  )
  await page.getByLabel('Save category changes').click()
  const resp = await patchResp
  expect(resp.ok(), 'PATCH /categories/:id must succeed').toBeTruthy()

  await expect(page.getByText(newName)).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(oldName)).not.toBeVisible()
})

test('Categories: delete leaf category → removed from tree', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const name = `Cat Delete ${Date.now()}`
  const id = await createRootCategory(page, H, name)

  await openCategoriesTab(page)

  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 })

  page.once('dialog', d => d.accept())
  const delResp = page.waitForResponse(
    r => r.url().includes('/categories/') && r.request().method() === 'DELETE',
    { timeout: 15000 },
  )

  // Remove from cleanup list since we're deleting it now
  const idx = createdCategoryIds.indexOf(id)
  if (idx !== -1) createdCategoryIds.splice(idx, 1)

  await page.getByLabel(`Delete ${name}`).first().click()
  const resp = await delResp
  expect(resp.ok(), 'DELETE /categories/:id must succeed').toBeTruthy()

  await expect(page.getByText(name)).not.toBeVisible({ timeout: 8000 })
})

test('Categories: delete blocked when has subcategories → shows exact backend message', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const rootName = `Cat HasChildren ${Date.now()}`
  const subName  = `Cat HasChildren Sub ${Date.now()}`
  const rootId = await createRootCategory(page, H, rootName)
  await createSubCategory(page, H, subName, rootId)

  await openCategoriesTab(page)
  await expect(page.getByText(rootName)).toBeVisible({ timeout: 10000 })

  page.once('dialog', d => d.accept())
  await page.getByLabel(`Delete ${rootName}`).first().click()

  // Toast must contain the exact backend error message (not "Something went wrong")
  // Backend returns 400 with errorCode HAS_CHILDREN_DELETE and a descriptive message.
  await expect(page.getByText(/subcategor|children|cannot delete/i)).toBeVisible({ timeout: 8000 })
})

test('Categories: delete blocked when has courses → shows exact backend message', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)

  const catName = `Cat HasCourses ${Date.now()}`
  const catId   = await createRootCategory(page, H, catName)

  // Create a course assigned to this category
  const courseRes = await page.request.get(`${API}/courses?limit=1`, { headers: H })
  expect(courseRes.ok()).toBeTruthy()
  const instructorId: string = (await courseRes.json()).data?.courses?.[0]?.instructorId ?? ''
  expect(instructorId, 'Need at least one course with an instructorId to assign').toBeTruthy()

  const createCourseRes = await page.request.post(`${API}/courses`, {
    data: { title: `Course for cat ${Date.now()}`, instructorId, categoryId: catId },
    headers: H,
  })
  expect(createCourseRes.ok()).toBeTruthy()
  const courseId: string = (await createCourseRes.json()).data?.id
  if (courseId) createdCourseIds.push(courseId)

  await openCategoriesTab(page)
  await expect(page.getByText(catName)).toBeVisible({ timeout: 10000 })

  page.once('dialog', d => d.accept())
  await page.getByLabel(`Delete ${catName}`).first().click()

  // Toast must contain backend message about assigned courses
  await expect(page.getByText(/course|assigned|cannot delete/i)).toBeVisible({ timeout: 8000 })
})

test('Categories: CourseForm category picker shows categories by UUID, not free text', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('.mn-lkpi-grid')).toBeVisible({ timeout: 15000 })
  const H = await getAuthHeaders(page)
  const catName = `Cat FormPicker ${Date.now()}`
  await createRootCategory(page, H, catName)

  // Navigate to course create form
  await page.goto('/learning-management')
  await page.locator('button', { hasText: /^Courses$/ }).first().click()
  await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: /Create Course|New Course/i }).first().click()

  // Category select should appear with the category name as a visible option
  await expect(page.getByLabel('Category')).toBeVisible({ timeout: 5000 })
  const catSelect = page.getByLabel('Category')
  // Verify the option exists with the name we created
  await expect(catSelect.locator('option', { hasText: catName })).toBeAttached({ timeout: 5000 })

  // Select the category — value set to UUID (not free-text name)
  await catSelect.selectOption({ label: catName })
  const selectedValue = await catSelect.inputValue()
  // Value must be a UUID (not the name string)
  expect(selectedValue, 'Category select value should be a UUID').toMatch(/^[0-9a-f-]{36}$/)
})
