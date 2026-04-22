import { test, expect, type Page } from '@playwright/test'

/**
 * E2E happy-path coverage for the three transaction types introduced by
 * IP-20260422-004 (income / expense / transfer).
 *
 * Requires a pre-provisioned test user. Set the following env vars to
 * enable the suite — otherwise the whole file is skipped.
 *
 *   E2E_TEST_EMAIL=...
 *   E2E_TEST_PASSWORD=...
 *
 * Uses unique merchant / account names per run so assertions work even
 * when leftover rows exist in the shared dev DB.
 */

const EMAIL = process.env.E2E_TEST_EMAIL
const PASSWORD = process.env.E2E_TEST_PASSWORD

const runSuite = Boolean(EMAIL && PASSWORD)

test.describe('Transactions — income / expense / transfer', () => {
  test.skip(!runSuite, 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to enable')

  // Keep each row unique so we can find it regardless of prior test runs.
  const stamp = Date.now()

  async function signIn(page: Page) {
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL!)
    await page.getByLabel('Password').fill(PASSWORD!)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
  }

  test('expense appears in the list with the Expense badge', async ({ page }) => {
    const merchant = `E2E-Expense-${stamp}`

    await signIn(page)
    await page.goto('/dashboard/transactions/new')

    // Default type is Expense — no need to click the tab.
    await page.getByLabel('Merchant').fill(merchant)
    await page.getByLabel('Amount (PLN)').fill('12.34')
    await page.getByRole('button', { name: /add transaction/i }).click()

    await page.waitForURL(/\/dashboard\/transactions(?:\?|$)/)
    const row = page.locator('tr', { hasText: merchant })
    await expect(row).toBeVisible()
    await expect(row.getByText('Expense', { exact: true })).toBeVisible()
    await expect(row.locator('td').last()).toContainText('−')
  })

  test('income appears with Income badge and dashboard Monthly Income is populated', async ({
    page,
  }) => {
    const source = `E2E-Income-${stamp}`

    await signIn(page)
    await page.goto('/dashboard/transactions/new')

    await page.getByRole('tab', { name: 'Income' }).click()
    await page.getByLabel('Source').fill(source)
    await page.getByLabel('Amount (PLN)').fill('500.00')
    await page.getByRole('button', { name: /add transaction/i }).click()

    await page.waitForURL(/\/dashboard\/transactions(?:\?|$)/)
    const row = page.locator('tr', { hasText: source })
    await expect(row).toBeVisible()
    await expect(row.getByText('Income', { exact: true })).toBeVisible()
    await expect(row.locator('td').last()).toContainText('+')

    // Dashboard card should now render a real PLN value, not the em-dash placeholder.
    await page.goto('/dashboard')
    const incomeCard = page.locator('div', { hasText: /^Monthly Income$/ }).first()
    await expect(incomeCard).toBeVisible()
    await expect(incomeCard).not.toContainText(/^—$/)
    await expect(incomeCard).toContainText('zł')
  })

  test('transfer appears with Transfer badge and from → to description', async ({ page }) => {
    const fromAcct = `E2E-Checking-${stamp}`
    const toAcct = `E2E-Savings-${stamp}`

    await signIn(page)
    await page.goto('/dashboard/transactions/new')

    await page.getByRole('tab', { name: 'Transfer' }).click()
    await page.getByLabel('From account').fill(fromAcct)
    await page.getByLabel('To account').fill(toAcct)
    await page.getByLabel('Amount (PLN)').fill('250.00')
    await page.getByRole('button', { name: /add transaction/i }).click()

    await page.waitForURL(/\/dashboard\/transactions(?:\?|$)/)
    const row = page.locator('tr', { hasText: fromAcct })
    await expect(row).toBeVisible()
    await expect(row.getByText('Transfer', { exact: true })).toBeVisible()
    await expect(row).toContainText(`${fromAcct} → ${toAcct}`)
    // Transfer amount is neither prefixed with + nor − per TransactionList.tsx.
    const amountCell = row.locator('td').nth(4)
    await expect(amountCell).not.toContainText('+')
    await expect(amountCell).not.toContainText('−')
  })

  test('type filter bar narrows the list to the chosen type', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/transactions?type=transfer')

    // All visible rows should show the Transfer badge.
    const badges = page.locator('tbody tr td:nth-child(2)')
    const count = await badges.count()
    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toContainText('Transfer')
    }
  })
})
