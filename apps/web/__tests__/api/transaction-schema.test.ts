/**
 * Unit tests for the shared TransactionSchema.
 * Covers the superRefine rules that enforce transfer-endpoint integrity.
 */
import { describe, it, expect } from 'vitest'
import { TransactionSchema } from '@/lib/schemas/transaction'

const VALID_UUID = '00000000-0000-4000-8000-000000000000'

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

  it('rejects transfer without from_account', () => {
    const result = TransactionSchema.safeParse({
      ...baseExpense,
      type: 'transfer',
      merchant: 'Transfer',
      to_account: 'Savings',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.from_account).toBeTruthy()
    }
  })

  it('rejects transfer without to_account', () => {
    const result = TransactionSchema.safeParse({
      ...baseExpense,
      type: 'transfer',
      merchant: 'Transfer',
      from_account: 'Checking',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.to_account).toBeTruthy()
    }
  })

  it('rejects transfer where from_account equals to_account', () => {
    const result = TransactionSchema.safeParse({
      ...baseExpense,
      type: 'transfer',
      merchant: 'Transfer',
      from_account: 'Checking',
      to_account: 'checking',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.to_account).toBeTruthy()
    }
  })

  it('accepts a valid transfer', () => {
    const result = TransactionSchema.safeParse({
      ...baseExpense,
      type: 'transfer',
      merchant: 'Transfer',
      from_account: 'Checking',
      to_account: 'Savings',
      category_id: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects expense with from_account set', () => {
    const result = TransactionSchema.safeParse({
      ...baseExpense,
      from_account: 'Checking',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.from_account).toBeTruthy()
    }
  })

  it('rejects expense with to_account set', () => {
    const result = TransactionSchema.safeParse({
      ...baseExpense,
      to_account: 'Savings',
    })
    expect(result.success).toBe(false)
  })
})
