/// <reference types="node" />
import { test, expect } from '@playwright/test'

// Real credentials come from the environment (see playwright.config.ts) —
// this repository is public, so they must never be written here.
const email = process.env.E2E_ADMIN_EMAIL ?? ''
const password = process.env.E2E_ADMIN_PASSWORD ?? ''

test('Login page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('Login with valid credentials', async ({ page }) => {
  if (!email || !password) throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (see playwright.config.ts).')
  await page.goto('/')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/dashboard/)
})

test('Login with wrong password shows error', async ({ page }) => {
  if (!email) throw new Error('Set E2E_ADMIN_EMAIL (see playwright.config.ts).')
  await page.goto('/')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', 'wrongpassword')
  await page.click('button[type="submit"]')
  await expect(page.locator('text=Invalid')).toBeVisible()
})
