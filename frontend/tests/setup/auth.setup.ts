/// <reference types="node" />
import { test as setup } from '@playwright/test'

// Credentials come from the environment (see playwright.config.ts) — never
// hard-code them here: this repository is public.
const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

setup('authenticate', async ({ page }) => {
  if (!email || !password) {
    throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in frontend/tests/.env.e2e (gitignored) or your shell.')
  }
  await page.goto('/')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard/)
  await page.context().storageState({
    path: 'tests/setup/.auth.json',
  })
})
