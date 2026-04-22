import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('invalid login shows error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('nonexistent@example.com')
    await page.getByLabel('Password').fill('wrongpassword123')
    await page.getByRole('button', { name: /sign in/i }).click()
    // Next.js 16 renders an empty announcer div with role="alert", so scope
    // the assertion to the form's own error element.
    const formAlert = page.getByRole('alert').filter({ hasText: /./ })
    await expect(formAlert).toBeVisible()
    await expect(formAlert).toContainText(/invalid/i)
  })

  test('register page renders with all required fields', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Confirm password')).toBeVisible()
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
  })
})
