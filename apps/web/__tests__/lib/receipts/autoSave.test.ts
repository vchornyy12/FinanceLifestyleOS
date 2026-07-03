import { describe, it, expect, vi, beforeEach } from 'vitest'
import { autoSaveReceipt } from '../../../lib/receipts/autoSave'

const mockUpsertLearning = vi.fn().mockResolvedValue(undefined)
vi.mock('../../../lib/supabase/queries/categoryLearning', () => ({
  upsertCategoryLearning: (...args: unknown[]) => mockUpsertLearning(...args),
}))

const mockTxInsert = vi.fn()
const mockItemsInsert = vi.fn()
const mockCategories = vi.fn()
const mockWallets = vi.fn()

function makeSupabase() {
  return {
    from: (table: string) => {
      if (table === 'transactions') {
        return { insert: (row: unknown) => ({ select: () => ({ single: () => mockTxInsert(row) }) }) }
      }
      if (table === 'receipt_items') {
        return { insert: (rows: unknown) => mockItemsInsert(rows) }
      }
      if (table === 'categories') {
        return { select: () => ({ eq: () => mockCategories() }) }
      }
      if (table === 'wallets') {
        return {
          select: () => ({
            eq: () => ({ order: () => ({ limit: () => mockWallets() }) }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as never
}

const receipt = {
  store: 'Biedronka',
  date: '2026-07-01',
  total: 10.48,
  items: [
    {
      name: 'Chleb', raw_name: 'CHLEB ZWYKLY', quantity: 1, unit_price: 3.49, total_price: 3.49,
      category: 'Bakery', confidence: 'high' as const, history_category_id: null,
    },
    {
      name: 'Mleko', raw_name: 'MLEKO 2%', quantity: 2, unit_price: 3.495, total_price: 6.99,
      category: 'Dairy', confidence: 'high' as const, history_category_id: 'c-dairy',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCategories.mockResolvedValue({
    data: [{ id: 'c-bakery', name: 'Bakery' }, { id: 'c-dairy', name: 'Dairy' }],
    error: null,
  })
  mockWallets.mockResolvedValue({ data: [{ id: 'w1' }], error: null })
  mockTxInsert.mockResolvedValue({ data: { id: 'tx1' }, error: null })
  mockItemsInsert.mockResolvedValue({ error: null })
})

describe('autoSaveReceipt', () => {
  it('saves a transaction with the oldest wallet and resolved categories', async () => {
    const result = await autoSaveReceipt(makeSupabase(), 'u1', receipt)
    expect(result.transactionId).toBe('tx1')
    expect(mockTxInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', type: 'expense', amount: '10.48', wallet_id: 'w1', source: 'ocr' }),
    )
    const rows = mockItemsInsert.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows[0]).toMatchObject({ category_id: 'c-bakery', transaction_id: 'tx1' })
    expect(rows[1]).toMatchObject({ category_id: 'c-dairy' })
  })

  it('saves with wallet_id null when the user has no wallets', async () => {
    mockWallets.mockResolvedValue({ data: [], error: null })
    await autoSaveReceipt(makeSupabase(), 'u1', receipt)
    expect(mockTxInsert).toHaveBeenCalledWith(expect.objectContaining({ wallet_id: null }))
  })

  it('records category learning for categorized items', async () => {
    await autoSaveReceipt(makeSupabase(), 'u1', receipt)
    expect(mockUpsertLearning).toHaveBeenCalledTimes(2)
    expect(mockUpsertLearning).toHaveBeenCalledWith(
      expect.anything(), 'u1', 'CHLEB ZWYKLY', null, 'Biedronka', 'c-bakery', false,
    )
  })

  it('throws when the transaction insert fails', async () => {
    mockTxInsert.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(autoSaveReceipt(makeSupabase(), 'u1', receipt)).rejects.toThrow(/boom/)
  })
})
