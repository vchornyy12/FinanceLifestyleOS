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
    topProducts: [],
    recentReceipts: [],
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

  it('renders receipt line items grouped by receipt', () => {
    const prompt = buildSystemPrompt({
      ...context,
      recentReceipts: [
        {
          merchant: 'Lidl', date: '2026-04-20', total: '10.48',
          items: [
            { name: 'Chleb zwykły', quantity: 1, total_price: 3.49, category: 'Groceries' },
            { name: 'Mleko 2%', quantity: 2, total_price: 6.99, category: null },
          ],
        },
      ],
    })
    expect(prompt).toContain('### Lidl — 2026-04-20 — 10.48 PLN')
    expect(prompt).toContain('- Chleb zwykły ×1 — 3.49 (Groceries)')
    expect(prompt).toContain('- Mleko 2% ×2 — 6.99 (—)')
  })

  it('shows empty state when no receipts', () => {
    expect(buildSystemPrompt(context)).toContain('No receipts scanned yet.')
  })

  it('tells the model about the query_receipt_items tool', () => {
    expect(buildSystemPrompt(context)).toContain('query_receipt_items')
  })
})
