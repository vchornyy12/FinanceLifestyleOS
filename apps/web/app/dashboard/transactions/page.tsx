import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTransactions } from '@/lib/supabase/queries/transactions'
import type { TransactionType } from '@/types/database'
import TransactionList from '@/components/transactions/TransactionList'

export const metadata = {
  title: 'Transactions | Finance Lifestyle OS',
}

const VALID_TYPES: ReadonlyArray<TransactionType> = ['expense', 'income', 'transfer']

const FILTER_OPTIONS: Array<{ value: TransactionType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' },
]

function parseTypeParam(raw: string | string[] | undefined): TransactionType | undefined {
  if (typeof raw !== 'string') return undefined
  return (VALID_TYPES as readonly string[]).includes(raw)
    ? (raw as TransactionType)
    : undefined
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { type: rawType } = await searchParams
  const activeType = parseTypeParam(rawType)
  const activeKey: TransactionType | 'all' = activeType ?? 'all'

  const initialData = await getTransactions(activeType)

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            View and manage your financial transactions.
          </p>
        </div>
        <Link
          href="/dashboard/transactions/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          + New transaction
        </Link>
      </div>

      {/* Filter bar */}
      <nav
        aria-label="Filter by type"
        className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {FILTER_OPTIONS.map((opt) => {
          const active = activeKey === opt.value
          const href = opt.value === 'all' ? '/dashboard/transactions' : `/dashboard/transactions?type=${opt.value}`
          return (
            <Link
              key={opt.value}
              href={href}
              className={
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors ' +
                (active
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800')
              }
            >
              {opt.label}
            </Link>
          )
        })}
      </nav>

      <TransactionList initialData={initialData} />
    </div>
  )
}
