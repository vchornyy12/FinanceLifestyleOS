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
 * Uses unique merchant / wallet names per run so assertions work even
 * when leftover rows exist in the shared dev DB.
 */

const EMAIL = process.env.E2E_TEST_EMAIL
const PASSWORD = process.env.E2E_TEST_PASSWORD

const runSuite = Boolean(EMAIL && PASSWORD)

test.describe('Transactions — income / expense / transfer', () => {
  test.skip(!runSuite, 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to enable')

  // Unique suffix for every test run so rows are identifiable.
  const stamp = Date.now()

  async function signIn(page: Page) {
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL!)
    await page.getByLabel('Password').fill(PASSWORD!)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
  }

  /**
   * Creates two cash wallets with unique names and returns those names.
   * The transfer test calls this to guarantee from/to options exist.
   */
  async function createWallets(page: Page) {
    const w1 = `E2E-Checking-${stamp}`
    const w2 = `E2E-Savings-${stamp}`

    for (const name of [w1, w2]) {
      await page.goto('/dashboard/wallets/new')
      await page.getByLabel('Name').fill(name)
      await page.getByRole('button', { name: /create wallet/i }).click()
      await page.waitForURL(/\/dashboard\/wallets/)
    }

    return { w1, w2 }
  }

  /**
   * Finds an <option> inside a <select> whose text contains `walletName`
   * and returns its value attribute (the UUID).
   */
  async function walletIdByName(page: Page, selectId: string, walletName: string) {
    const opt = page.locator(`#${selectId} option`, { hasText: walletName })
    const value = await opt.getAttribute('value')
    if (!value) throw new Error(`No wallet option found for "${walletName}" in #${selectId}`)
    return value
  }

  // ---------------------------------------------------------------------------
  // Expense
  // ---------------------------------------------------------------------------

  test('expense appears in the list with the Expense badge', async ({ page }) => {
    const merchant = `E2E-Expense-${stamp}`

    await signIn(page)
    await page.goto('/dashboard/transactions/new')

    // Default type is Expense — no tab click needed.
    await page.getByLabel('Merchant').fill(merchant)
    await page.getByLabel('Amount (PLN)').fill('12.34')
    await page.getByRole('button', { name: /add transaction/i }).click()

    await page.waitForURL(/\/dashboard\/transactions(?:\?|$)/)

    const row = page.locator('tr', { hasText: merchant })
    await expect(row).toBeVisible()

    // Type badge (column 1)
    await expect(row.locator('span', { hasText: 'Expense' })).toBeVisible()

    // Amount column (index 4): should be prefixed with −
    await expect(row.locator('td').nth(4)).toContainText('−')
  })

  // ---------------------------------------------------------------------------
  // Income
  // ---------------------------------------------------------------------------

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
    await expect(row.locator('span', { hasText: 'Income' })).toBeVisible()
    // Amount column (index 4): should be prefixed with +
    await expect(row.locator('td').nth(4)).toContainText('+')

    // Dashboard "Monthly Income" card should show a real PLN value.
    await page.goto('/dashboard')
    const incomeCard = page
      .locator('div')
      .filter({ has: page.locator('p', { hasText: 'Monthly Income' }) })
      .first()
    await expect(incomeCard).toBeVisible()
    // After adding income the card should render a PLN figure, not the em-dash.
    await expect(incomeCard.locator('p').last()).not.toContainText('—')
    await expect(incomeCard.locator('p').last()).toContainText('zł')
  })

  // ---------------------------------------------------------------------------
  // Transfer
  // ---------------------------------------------------------------------------

  test('transfer appears with Transfer badge and a neutral (un-prefixed) amount', async ({
    page,
  }) => {
    await signIn(page)
    const { w1, w2 } = await createWallets(page)

    await page.goto('/dashboard/transactions/new')
    await page.getByRole('tab', { name: 'Transfer' }).click()

    // Wallet selects are <select id="from_wallet_id"> / <select id="to_wallet_id">.
    // Find each wallet's UUID by matching option text, then selectOption by value.
    const fromId = await walletIdByName(page, 'from_wallet_id', w1)
    const toId = await walletIdByName(page, 'to_wallet_id', w2)
    await page.locator('#from_wallet_id').selectOption(fromId)
    await page.locator('#to_wallet_id').selectOption(toId)

    await page.getByLabel('Amount (PLN)').fill('250.00')
    await page.getByRole('button', { name: /add transaction/i }).click()

    await page.waitForURL(/\/dashboard\/transactions(?:\?|$)/)

    // Find the row: Transfer badge + contains "250.00". Description shows
    // truncated wallet UUIDs so we can't assert it by wallet name.
    const row = page
      .locator('tbody tr')
      .filter({ has: page.locator('span', { hasText: 'Transfer' }) })
      .filter({ hasText: '250.00' })
      .first()
    await expect(row).toBeVisible()

    // Amount (index 4) must have no +/− prefix for transfers.
    const amountCell = row.locator('td').nth(4)
    await expect(amountCell).not.toContainText('+')
    await expect(amountCell).not.toContainText('−')
    await expect(amountCell).toContainText('250.00')
  })

  // ---------------------------------------------------------------------------
  // Type filter
  // ---------------------------------------------------------------------------

  test('type filter narrows the list to Transfer rows only', async ({ page }) => {
    await signIn(page)
    await page.goto('/dashboard/transactions?type=transfer')

    const rows = page.locator('tbody tr')
    const count = await rows.count()

    // If no transfers exist yet (fresh DB) the list is empty — that's fine.
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).locator('span', { hasText: 'Transfer' })).toBeVisible()
    }
  })
})
