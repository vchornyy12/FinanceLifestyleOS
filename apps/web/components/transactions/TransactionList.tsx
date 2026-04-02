'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import type { TransactionWithCategory } from '@/lib/supabase/queries/transactions'
import { deleteTransaction, type TransactionActionState } from '@/lib/actions/transactions'
import { useTransactions } from '@/hooks/useTransactions'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TransactionListProps {
  initialData: TransactionWithCategory[]
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TransactionList({ initialData }: TransactionListProps) {
  const transactions = useTransactions(initialData)
  const [confirming, setConfirming] = useState<string | null>(null)

  if (transactions.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No transactions yet. Add one using the button above.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Merchant
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Category
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Amount
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              confirming={confirming}
              setConfirming={setConfirming}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TransactionRow
// ---------------------------------------------------------------------------

interface TransactionRowProps {
  transaction: TransactionWithCategory
  confirming: string | null
  setConfirming: (id: string | null) => void
}

function TransactionRow({ transaction, confirming, setConfirming }: TransactionRowProps) {
  const [state, formAction, isPending] = useActionState<TransactionActionState, FormData>(
    deleteTransaction,
    null,
  )

  const isConfirming = confirming === transaction.id
  const formattedAmount = `${parseFloat(transaction.amount).toFixed(2)} PLN`

  return (
    <tr className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
      {/* Date */}
      <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
        {transaction.date}
      </td>

      {/* Merchant */}
      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
        {transaction.merchant}
        {transaction.note && (
          <p className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
            {transaction.note}
          </p>
        )}
      </td>

      {/* Category */}
      <td className="px-4 py-3">
        {transaction.category ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(transaction.category.color) ? transaction.category.color : 'transparent' }}
              aria-hidden="true"
            />
            <span className="text-zinc-700 dark:text-zinc-300">{transaction.category.name}</span>
          </span>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500">—</span>
        )}
      </td>

      {/* Amount */}
      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
        {formattedAmount}
      </td>

      {/* Actions */}
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {isConfirming ? (
          <span className="inline-flex items-center gap-2">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">Delete?</span>
            <form action={formAction}>
              <input type="hidden" name="id" value={transaction.id} />
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                {isPending ? 'Deleting…' : 'Yes'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              No
            </button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Link
              href={`/dashboard/transactions/${transaction.id}/edit`}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={() => setConfirming(transaction.id)}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              Delete
            </button>
          </span>
        )}
        {state?.error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
        )}
      </td>
    </tr>
  )
}
