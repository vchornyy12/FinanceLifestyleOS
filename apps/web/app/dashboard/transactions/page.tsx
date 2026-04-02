import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTransactions } from '@/lib/supabase/queries/transactions'
import TransactionList from '@/components/transactions/TransactionList'

export const metadata = {
  title: 'Transactions | Finance Lifestyle OS',
}

export default async function TransactionsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const initialData = await getTransactions()

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Transactions</h1>
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

      {/* Transaction list */}
      <TransactionList initialData={initialData} />
    </div>
  )
}
