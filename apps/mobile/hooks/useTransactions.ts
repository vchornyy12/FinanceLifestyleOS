import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface TransactionRow {
  id: string
  user_id: string
  category_id: string | null
  amount: number
  merchant: string
  note: string | null
  date: string
  transaction_source: string
  receipt_url: string | null
  created_at: string
}

export function useTransactions(userId: string) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    // Initial fetch
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('useTransactions fetch error:', error)
        if (data) setTransactions(data as TransactionRow[])
        setLoading(false)
      })

    // Realtime subscription
    const channel = supabase
      .channel(`transactions:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        (payload) => setTransactions((prev) =>
          prev.some((t) => t.id === (payload.new as TransactionRow).id)
            ? prev
            : [payload.new as TransactionRow, ...prev]
        )
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        (payload) => setTransactions((prev) => prev.filter((t) => t.id !== payload.old.id))
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        (payload) => setTransactions((prev) =>
          prev.map((t) => t.id === (payload.new as TransactionRow).id ? payload.new as TransactionRow : t)
        )
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { transactions, loading }
}
