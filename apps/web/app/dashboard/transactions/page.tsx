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
          <h1 className="text-2xl font-semibold text-mac-label">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-mac-secondary">
            View and manage your financial transactions.
          </p>
        </div>
        <Link
          href="/dashboard/transactions/new"
          className="rounded-lg bg-mac-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          + New transaction
        </Link>
      </div>

      {/* Filter bar */}
      <nav
        aria-label="Filter by type"
        className="inline-flex rounded-lg bg-mac-label/8 p-0.5"
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
                  ? 'bg-mac-surface text-mac-label shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                  : 'text-mac-secondary hover:text-mac-label')
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
