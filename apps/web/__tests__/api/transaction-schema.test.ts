/**
 * Unit tests for the shared TransactionSchema.
 * Covers the superRefine rules that enforce transfer-endpoint integrity.
 */
import { describe, it, expect } from 'vitest'
import { TransactionSchema } from '@/lib/schemas/transaction'

const VALID_UUID = '00000000-0000-4000-8000-000000000000'
const VALID_UUID_2 = '11111111-1111-4111-8111-111111111111'

const baseExpense = {
  type: 'expense' as const,
  merchant: 'Biedronka',
  amount: '12.50',
  category_id: VALID_UUID,
  date: '2026-04-22',
  note: '',
}

describe('TransactionSchema', () => {
  it('accepts a valid expense', () => {
    const result = TransactionSchema.safeParse(baseExpense)
    expect(result.success).toBe(true)
  })

  it('accepts a valid income', () => {
    const result = TransactionSchema.safeParse({
      ...baseExpense,
      type: 'income',
      merchant: 'Employer',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid expense with wallet_id', () => {
    const result = TransactionSchema.safeParse({ ...baseExpense, wallet_id: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it('rejects amount = 0', () => {
    const result = TransactionSchema.safeParse({ ...baseExpense, amount: '0' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.amount).toBeTruthy()
    }
  })

  it('rejects amount with invalid format', () => {
    const result = TransactionSchema.safeParse({ ...baseExpense, amount: '12.345' })
    expect(result.success).toBe(false)
  })

  it('rejects empty merchant', () => {
    const result = TransactionSchema.safeParse({ ...baseExpense, merchant: '' })
    expect(result.success).toBe(false)
  })

  it('rejects transfer without from_wallet_id', () => {
    const result = TransactionSchema.safeParse({
      ...baseExpense,
      type: 'transfer',
      merchant: 'Transfer',
      to_wallet_id: VALID_UUID,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.from_wallet_id).toBeTruthy()
    }
  })

  it('rejects transfer without to_wallet_id', () => {
    const result = TransactionSchema.safeParse({
      ...baseExpense,
      type: 'transfer',
      merchant: 'Transfer',
      from_wallet_id: VALID_UUID,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.to_wallet_id).toBeTruthy()
    }
  })

  it('rejects transfer where from_wallet_id equals to_wallet_id', () => {
    const result = TransactionSchema.safeParse({
      ...baseExpense,
      type: 'transfer',
      merchant: 'Transfer',
      from_wallet_id: VALID_UUID,
      to_wallet_id: VALID_UUID,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.to_wallet_id).toBeTruthy()
    }
  })

  it('accepts a valid transfer', () => {
    const result = TransactionSchema.safeParse({
      ...baseExpense,
      type: 'transfer',
      merchant: 'Transfer',
      from_wallet_id: VALID_UUID,
      to_wallet_id: VALID_UUID_2,
      category_id: null,
    })
    expect(result.success).toBe(true)
  })
})
