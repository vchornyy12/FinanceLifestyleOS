import { test, expect } from '@playwright/test'

test.describe('Transactions', () => {
  test('unauthenticated /dashboard/transactions redirects to /login', async ({ page }) => {
    await page.goto('/dashboard/transactions')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated /dashboard/transactions/new redirects to /login', async ({ page }) => {
    await page.goto('/dashboard/transactions/new')
    await expect(page).toHaveURL(/\/login/)
  })

  // Requires real authenticated session — skip in Phase 1 CI
  test.skip('new transaction appears in second tab within 5s (real-time)', async ({ browser }) => {
    // Context 1: user A creates a transaction
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()
    // ... authenticate, go to /dashboard/transactions, create a transaction

    // Context 2: user A in a second tab watches for the change
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    // ... authenticate same user, go to /dashboard/transactions
    // ... expect the new transaction to appear within 5 seconds

    await context1.close()
    await context2.close()
  })
})
