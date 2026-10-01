import { test, expect } from '@playwright/test'

test('login → dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@demo.local')
  await page.getByLabel('Password').fill('changeme123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)
})
