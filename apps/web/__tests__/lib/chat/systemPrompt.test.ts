import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/lib/chat/systemPrompt'

describe('buildSystemPrompt', () => {
  const context = {
    today: '2026-04-29',
    yearMonth: '2026-04',
    metrics: { income: 5000, expense: 3200, net: 1800 },
    wallets: [
      { name: 'Checking', type: 'debit' as const, balance: 2400, currency: 'PLN' },
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
