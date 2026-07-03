import type { WalletWithBalance, TransactionType } from '@/types/database'
import type { MonthlyMetrics } from '@/lib/supabase/queries/metrics'
import type { TopProduct, ReceiptWithItems } from '@/lib/supabase/queries/receiptItems'

interface Transaction {
  date: string
  merchant: string
  type: TransactionType
  amount: string
  category: string | null
}

interface PromptContext {
  today: string
  yearMonth: string
  metrics: MonthlyMetrics
  wallets: WalletWithBalance[]
  transactions: Transaction[]
  topProducts: TopProduct[]
  recentReceipts: ReceiptWithItems[]
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const walletLines = ctx.wallets
    .map((w) => `- ${w.name} (${w.type}): ${w.balance.toFixed(2)} ${w.currency}`)
    .join('\n')

  const txLines = ctx.transactions
    .map((t) => `${t.date} | ${t.merchant} | ${t.type} | ${t.amount} | ${t.category ?? '—'}`)
    .join('\n')

  const productLines = ctx.topProducts
    .map((p, i) => `${i + 1}. ${p.name} — ${p.total.toFixed(2)} PLN (×${p.count})`)
    .join('\n')

  const receiptBlocks = ctx.recentReceipts
    .map((r) => {
      const itemLines = r.items
        .map((i) => `- ${i.name} ×${i.quantity} — ${i.total_price.toFixed(2)} (${i.category ?? '—'})`)
        .join('\n')
      return `### ${r.merchant} — ${r.date} — ${Number(r.total).toFixed(2)} PLN\n${itemLines}`
    })
    .join('\n\n')

  return `You are a personal finance coach for a Polish user.
Today is ${ctx.today}. All amounts are in PLN unless noted otherwise.

## This month (${ctx.yearMonth})
- Income:      ${ctx.metrics.income.toFixed(2)} PLN
- Expenses:    ${ctx.metrics.expense.toFixed(2)} PLN
- Net:         ${ctx.metrics.net.toFixed(2)} PLN
- Savings rate: ${ctx.metrics.income > 0 ? (((ctx.metrics.income - ctx.metrics.expense) / ctx.metrics.income) * 100).toFixed(0) : '0'}%

## Wallets
${walletLines || 'No wallets yet.'}

## Recent transactions
date       | merchant | type | amount | category
${txLines || 'No transactions yet.'}

## Recent receipts (line items)
${receiptBlocks || 'No receipts scanned yet.'}

The receipt list above covers only the most recent receipts. For older purchases or
specific product searches, call the query_receipt_items tool with a date range.

## Top products this month (from scanned receipts)
${productLines || 'No receipt data yet.'}

Answer in the same language the user writes in.
Be concise and specific — refer to actual numbers from the data above.`
}
