import { createClient } from '@/lib/supabase/server'

export interface MonthlyMetrics {
  income: number
  expense: number
  net: number
}

function monthBounds(yearMonth: string): { first: string; last: string } {
  const [y, m] = yearMonth.split('-').map(Number)
  const first = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
  const nextMonthFirst = new Date(Date.UTC(y, m, 1))
  const lastDay = new Date(nextMonthFirst.getTime() - 86_400_000)
  const last = `${lastDay.getUTCFullYear()}-${String(lastDay.getUTCMonth() + 1).padStart(2, '0')}-${String(lastDay.getUTCDate()).padStart(2, '0')}`
  return { first, last }
}

/**
 * Sum income and expense totals for the signed-in user over a given
 * calendar month (`YYYY-MM`). Transfers are deliberately excluded — they
 * are neither income nor spend.
 *
 * RLS enforces the user filter; no manual user_id is required.
 */
export async function getMonthlyMetrics(yearMonth: string): Promise<MonthlyMetrics> {
  const supabase = await createClient()
  const { first, last } = monthBounds(yearMonth)

  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .gte('date', first)
    .lte('date', last)
    .in('type', ['income', 'expense'])

  if (error) {
    throw new Error(`Failed to fetch monthly metrics: ${error.message}`)
  }

  let income = 0
  let expense = 0
  for (const row of data ?? []) {
    const amount = parseFloat(row.amount as unknown as string)
    if (row.type === 'income') income += amount
    else if (row.type === 'expense') expense += amount
  }

  return {
    income: Number(income.toFixed(2)),
    expense: Number(expense.toFixed(2)),
    net: Number((income - expense).toFixed(2)),
  }
}

/**
 * All-time net position = SUM(income) - SUM(expense).
 * Transfers excluded. Proxy for "Total Balance" until accounts land in Phase 4.
 */
export async function getAllTimeNet(): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .in('type', ['income', 'expense'])

  if (error) {
    throw new Error(`Failed to fetch all-time net: ${error.message}`)
  }

  let net = 0
  for (const row of data ?? []) {
    const amount = parseFloat(row.amount as unknown as string)
    net += row.type === 'income' ? amount : -amount
  }

  return Number(net.toFixed(2))
}
