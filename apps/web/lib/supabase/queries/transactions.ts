import { createClient } from '@/lib/supabase/server'
import type { Transaction, TransactionType } from '@/types/database'

export type TransactionWithCategory = Transaction & {
  category: { id: string; name: string; color: string } | null
}

/**
 * Fetch transactions for the currently authenticated user, joined with their
 * category name and color, ordered by date desc then created_at desc.
 *
 * @param typeFilter Optional — restrict to a single transaction type.
 *
 * RLS ensures only the current user's rows are returned.
 */
export async function getTransactions(
  typeFilter?: TransactionType,
): Promise<TransactionWithCategory[]> {
  const supabase = await createClient()

  let query = supabase
    .from('transactions')
    .select(`
      *,
      category:categories(id, name, color)
    `)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (typeFilter) {
    query = query.eq('type', typeFilter)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`)
  }

  return (data ?? []) as TransactionWithCategory[]
}
