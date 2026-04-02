'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TransactionWithCategory } from '@/lib/supabase/queries/transactions'

/**
 * Client hook that holds transaction state and subscribes to Supabase Realtime
 * so changes (INSERT / UPDATE / DELETE) appear in all open tabs within 5 s.
 *
 * @param initialData - Server-fetched transactions passed as a prop (or from a
 *   server component). The hook re-syncs whenever this reference changes, e.g.
 *   after a server revalidation triggers a re-render.
 *
 * NOTE: Realtime `postgres_changes` payloads contain only the flat transaction
 * row — the category join is NOT included. For INSERT/UPDATE events the
 * category field will be null until the next server fetch. This is acceptable
 * for Phase 1.
 */
export function useTransactions(
  initialData: TransactionWithCategory[],
): TransactionWithCategory[] {
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>(initialData)

  // Sync when initialData changes (e.g. after server revalidation)
  useEffect(() => {
    setTransactions(initialData)
  }, [initialData])

  useEffect(() => {
    const supabase = createClient()
    // Use a unique channel name per hook instance to avoid shared-channel issues
    // when multiple components mount useTransactions simultaneously.
    const channelName = `transactions-changes-${crypto.randomUUID()}`

    let channel: ReturnType<typeof supabase.channel>

    // Get the current user to scope the Realtime filter to their transactions only.
    // This prevents receiving other users' change events if Realtime RLS is misconfigured.
    supabase.auth.getUser().then(({ data: { user } }) => {
      const filter = user ? `user_id=eq.${user.id}` : undefined

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transactions', ...(filter ? { filter } : {}) },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Prepend new row; category will be null until next server fetch
            setTransactions((prev) => [
              payload.new as TransactionWithCategory,
              ...prev,
            ])
          } else if (payload.eventType === 'UPDATE') {
            // Merge updated fields while preserving any existing category join
            setTransactions((prev) =>
              prev.map((t) =>
                t.id === payload.new.id
                  ? ({ ...t, ...payload.new } as TransactionWithCategory)
                  : t,
              ),
            )
          } else if (payload.eventType === 'DELETE') {
            setTransactions((prev) =>
              prev.filter((t) => t.id !== payload.old.id),
            )
          }
        },
        )
        .subscribe()
    })

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return transactions
}
