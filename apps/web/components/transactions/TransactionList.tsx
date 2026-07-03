'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import type { TransactionType } from '@/types/database'
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
// Type presentation helpers
// ---------------------------------------------------------------------------

function typePresentation(type: TransactionType) {
  if (type === 'income') {
    return {
      symbol: '+',
      amountClass: 'text-mac-green',
      badgeClass:
        'bg-mac-green/15 text-mac-green',
      label: 'Income',
      arrow: '↑',
    }
  }
  if (type === 'transfer') {
    return {
      symbol: '',
      amountClass: 'text-mac-secondary',
      badgeClass: 'bg-mac-label/8 text-mac-secondary',
      label: 'Transfer',
      arrow: '↔',
    }
  }
  return {
    symbol: '−',
    amountClass: 'text-mac-red',
    badgeClass: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
    label: 'Expense',
    arrow: '↓',
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TransactionList({ initialData }: TransactionListProps) {
  const transactions = useTransactions(initialData)
  const [confirming, setConfirming] = useState<string | null>(null)

  if (transactions.length === 0) {
    return (
      <p className="text-sm text-mac-secondary">
        No transactions yet. Add one using the button above.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-mac-hairline bg-mac-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mac-hairline bg-mac-label/4">
            <th className="px-4 py-3 text-left text-xs font-semibold text-mac-secondary">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-mac-secondary">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-mac-secondary">
              Description
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-mac-secondary">
              Category
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-mac-secondary">
              Amount
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-mac-secondary">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mac-hairline">
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
  const pres = typePresentation(transaction.type)
  const amount = parseFloat(transaction.amount).toFixed(2)
  const formattedAmount = `${pres.symbol}${amount} PLN`

  const description =
    transaction.type === 'transfer'
      ? `${transaction.from_wallet_id?.slice(-8) ?? '?'} → ${transaction.to_wallet_id?.slice(-8) ?? '?'}`
      : transaction.merchant

  return (
    <tr className="group transition-colors hover:bg-mac-label/5/40">
      <td className="whitespace-nowrap px-4 py-3 text-mac-secondary">
        {transaction.date}
      </td>

      <td className="px-4 py-3">
        <span
          className={
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ' +
            pres.badgeClass
          }
        >
          <span aria-hidden="true">{pres.arrow}</span>
          {pres.label}
        </span>
      </td>

      <td className="px-4 py-3 font-medium text-mac-label">
        {description}
        {transaction.note && (
          <p className="text-xs font-normal text-mac-tertiary">
            {transaction.note}
          </p>
        )}
      </td>

      <td className="px-4 py-3">
        {transaction.category ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{
                backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(transaction.category.color)
                  ? transaction.category.color
                  : 'transparent',
              }}
              aria-hidden="true"
            />
            <span className="text-mac-secondary">
              {transaction.category.name}
            </span>
          </span>
        ) : (
          <span className="text-mac-tertiary">—</span>
        )}
      </td>

      <td
        className={
          'whitespace-nowrap px-4 py-3 text-right font-medium ' + pres.amountClass
        }
      >
        {formattedAmount}
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-right">
        {isConfirming ? (
          <span className="inline-flex items-center gap-2">
            <span className="text-xs text-mac-secondary">Delete?</span>
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
              className="rounded-md px-2 py-1 text-xs font-medium text-mac-secondary transition-colors hover:bg-mac-label/5 hover:text-mac-label"
            >
              No
            </button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Link
              href={`/dashboard/transactions/${transaction.id}/edit`}
              className="rounded-md px-2 py-1 text-xs font-medium text-mac-secondary transition-colors hover:bg-mac-label/5 hover:text-mac-label"
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
          <p className="mt-1 text-xs text-mac-red">{state.error}</p>
        )}
      </td>
    </tr>
  )
}
