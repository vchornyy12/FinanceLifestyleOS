import type { WalletWithBalance, TransactionType } from '@/types/database'
import type { MonthlyMetrics } from '@/lib/supabase/queries/metrics'

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
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const walletLines = ctx.wallets
    .map((w) => `- ${w.name} (${w.type}): ${w.balance.toFixed(2)} ${w.currency}`)
    .join('\n')

  const txLines = ctx.transactions
    .map((t) => `${t.date} | ${t.merchant} | ${t.type} | ${t.amount} | ${t.category ?? '—'}`)
    .join('\n')

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

Answer in the same language the user writes in.
Be concise and specific — refer to actual numbers from the data above.`
}
