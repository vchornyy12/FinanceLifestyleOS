import { createClient } from '@/lib/supabase/server'
import type { Transaction } from '@/types/database'

export type TransactionWithCategory = Transaction & {
  category: { id: string; name: string; color: string } | null
}

/**
 * Fetch all transactions for the currently authenticated user,
 * joined with their category name and color, ordered by date descending
 * then created_at descending (newest first within the same date).
 *
 * RLS ensures only the current user's rows are returned — no manual
 * user_id filter is needed.
 */
export async function getTransactions(): Promise<TransactionWithCategory[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      category:categories(id, name, color)
    `)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`)
  }

  return (data ?? []) as TransactionWithCategory[]
}
