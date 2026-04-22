import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface MonthlyMetrics {
  income: number
  expense: number
  net: number
}

function monthBounds(yearMonth: string): { first: string; last: string } {
  const [y, m] = yearMonth.split('-').map(Number)
  const first = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
  const nextFirst = new Date(Date.UTC(y, m, 1))
  const lastDay = new Date(nextFirst.getTime() - 86_400_000)
  const last = `${lastDay.getUTCFullYear()}-${String(lastDay.getUTCMonth() + 1).padStart(2, '0')}-${String(lastDay.getUTCDate()).padStart(2, '0')}`
  return { first, last }
}

export function useMonthlyMetrics(userId: string, yearMonth: string) {
  const [metrics, setMetrics] = useState<MonthlyMetrics>({ income: 0, expense: 0, net: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    let cancelled = false
    const { first, last } = monthBounds(yearMonth)

    async function refresh() {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('user_id', userId)
        .in('type', ['income', 'expense'])
        .gte('date', first)
        .lte('date', last)

      if (cancelled) return
      if (error) {
        console.error('useMonthlyMetrics error:', error)
        setLoading(false)
        return
      }

      let income = 0
      let expense = 0
      for (const row of data ?? []) {
        const amount = Number(row.amount)
        if (row.type === 'income') income += amount
        else if (row.type === 'expense') expense += amount
      }

      setMetrics({
        income: Number(income.toFixed(2)),
        expense: Number(expense.toFixed(2)),
        net: Number((income - expense).toFixed(2)),
      })
      setLoading(false)
    }

    refresh()

    const channel = supabase
      .channel(`metrics:${userId}:${yearMonth}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        () => refresh(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [userId, yearMonth])

  return { metrics, loading }
}
