import { createClient } from '@/lib/supabase/server'
import { monthBounds } from './metrics'

export interface CategorySpend {
  categoryId: string | null
  name: string
  color: string | null
  total: number
}

type BreakdownRow = {
  amount: string
  category: { id: string; name: string; color: string } | null
}

export function aggregateByCategory(rows: BreakdownRow[]): CategorySpend[] {
  const buckets = new Map<string | null, CategorySpend>()
  for (const row of rows) {
    const key = row.category?.id ?? null
    const existing = buckets.get(key)
    const amount = Number(row.amount)
    if (existing) {
      existing.total += amount
    } else {
      buckets.set(key, {
        categoryId: key,
        name: row.category?.name ?? 'Other',
        color: row.category?.color ?? null,
        total: amount,
      })
    }
  }
  return [...buckets.values()].sort((a, b) => b.total - a.total)
}

/**
 * Current-month expense totals grouped by category. Uncategorized spending
 * is bucketed as "Other". RLS scopes rows to the current user.
 */
export async function getMonthlyCategoryBreakdown(yearMonth: string): Promise<CategorySpend[]> {
  const supabase = await createClient()
  const { first, last } = monthBounds(yearMonth)

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, category:categories(id, name, color)')
    .eq('type', 'expense')
    .gte('date', first)
    .lte('date', last)

  if (error) throw new Error(`Failed to load category breakdown: ${error.message}`)
  return aggregateByCategory((data ?? []) as unknown as BreakdownRow[])
}
