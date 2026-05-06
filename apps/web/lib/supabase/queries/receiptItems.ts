import { createClient } from '@/lib/supabase/server'

export interface TopProduct {
  name: string
  total: number
  count: number
}

function monthBounds(yearMonth: string): { first: string; last: string } {
  const [y, m] = yearMonth.split('-').map(Number)
  const first = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
  const nextFirst = new Date(Date.UTC(y, m, 1))
  const lastDay = new Date(nextFirst.getTime() - 86_400_000)
  const last = `${lastDay.getUTCFullYear()}-${String(lastDay.getUTCMonth() + 1).padStart(2, '0')}-${String(lastDay.getUTCDate()).padStart(2, '0')}`
  return { first, last }
}

/**
 * Top 10 products by spend for the signed-in user in the given month.
 * Joins receipt_items → transactions to filter by date.
 * RLS enforces user scoping — no manual user_id filter needed.
 */
export async function getTopProducts(yearMonth: string): Promise<TopProduct[]> {
  const supabase = await createClient()
  const { first, last } = monthBounds(yearMonth)

  const { data, error } = await supabase
    .from('receipt_items')
    .select('name, canonical_product_name, normalized_name, total_price, transaction:transactions!transaction_id(date)')
    .gte('transaction.date', first)
    .lte('transaction.date', last)
    .not('transaction', 'is', null)

  if (error) {
    throw new Error(`Failed to fetch top products: ${error.message}`)
  }

  // Aggregate client-side — Supabase PostgREST doesn't support GROUP BY directly.
  // Fallback chain: canonical_product_name → normalized_name → name
  const map = new Map<string, { total: number; count: number }>()
  for (const row of data ?? []) {
    const displayName = (row as { canonical_product_name?: string | null; normalized_name?: string | null; name: string }).canonical_product_name
      ?? (row as { normalized_name?: string | null }).normalized_name
      ?? row.name
    const existing = map.get(displayName) ?? { total: 0, count: 0 }
    existing.total += Number(row.total_price)
    existing.count += 1
    map.set(displayName, existing)
  }

  return Array.from(map.entries())
    .map(([name, { total, count }]) => ({
      name,
      total: Number(total.toFixed(2)),
      count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
}
