import { describe, it, expect } from 'vitest'
import type { WalletWithBalance } from '@/types/database'
import { buildSystemPrompt } from '@/lib/chat/systemPrompt'

describe('buildSystemPrompt', () => {
  const context = {
    today: '2026-04-29',
    yearMonth: '2026-04',
    metrics: { income: 5000, expense: 3200, net: 1800 },
    wallets: [
      {
        id: 'w1',
        user_id: 'u1',
        name: 'Checking',
        type: 'debit' as const,
        balance: 2400,
        currency: 'PLN',
        opening_balance: 0,
        credit_limit: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      } satisfies WalletWithBalance,
    ],
    transactions: [
      { date: '2026-04-15', merchant: 'Biedronka', type: 'expense' as const, amount: '120.50', category: 'Groceries' },
    ],
  }

  it('includes monthly income figure', () => {
    expect(buildSystemPrompt(context)).toContain('5000')
  })

  it('includes wallet name', () => {
    expect(buildSystemPrompt(context)).toContain('Checking')
  })

  it('includes transaction merchant', () => {
    expect(buildSystemPrompt(context)).toContain('Biedronka')
  })
})
